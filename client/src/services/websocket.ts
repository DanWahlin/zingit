// client/src/services/websocket.ts
// WebSocket client with exponential backoff reconnection

import type { WSMessage, BatchData } from '../types/index.js';

export type WSEventType = 'open' | 'close' | 'message' | 'error' | 'max_attempts';
export type WSEventHandler = (data?: WSMessage) => void;

interface QueuedMessage {
  message: object;
  retries: number;
  maxRetries: number;
  onFail?: () => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<WSEventType, Set<WSEventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: number | null = null;
  private maxAttemptsReached = false;

  // Message queue for retry on reconnection
  private messageQueue: QueuedMessage[] = [];
  private maxQueueSize = 10;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.maxAttemptsReached = false;
        this.emit('open');
        // Flush any queued messages
        this.flushMessageQueue();
      };

      this.ws.onclose = () => {
        this.emit('close');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.emit('error');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WSMessage;
          this.emit('message', data);
        } catch {
          console.warn('ZingIt: Invalid WebSocket message');
        }
      };
    } catch (err) {
      console.error('ZingIt: WebSocket connection failed', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    // Clear any existing timer to prevent multiple concurrent timers
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.maxAttemptsReached) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.maxAttemptsReached = true;
      this.emit('max_attempts');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`ZingIt: Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  forceReconnect(): void {
    this.reconnectAttempts = 0;
    this.maxAttemptsReached = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connect();
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.maxAttemptsReached = true; // Prevent reconnection

    // Clear message queue and call failure handlers
    for (const item of this.messageQueue) {
      item.onFail?.();
    }
    this.messageQueue = [];

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: object, options?: { retry?: boolean; maxRetries?: number; onFail?: () => void }): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (err) {
        console.warn('ZingIt: Failed to send message', err);
        if (options?.retry) {
          this.queueMessage(message, options.maxRetries ?? 3, options.onFail);
        }
        return false;
      }
    } else {
      console.warn('ZingIt: WebSocket not connected');
      if (options?.retry) {
        this.queueMessage(message, options.maxRetries ?? 3, options.onFail);
      }
      return false;
    }
  }

  private queueMessage(message: object, maxRetries: number, onFail?: () => void): void {
    // Limit queue size to prevent memory issues
    if (this.messageQueue.length >= this.maxQueueSize) {
      const dropped = this.messageQueue.shift();
      dropped?.onFail?.();
      console.warn('ZingIt: Message queue full, dropped oldest message');
    }
    this.messageQueue.push({ message, retries: 0, maxRetries, onFail });
  }

  private flushMessageQueue(): void {
    const queue = [...this.messageQueue];
    this.messageQueue = [];

    for (const item of queue) {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify(item.message));
        } catch {
          item.retries++;
          if (item.retries < item.maxRetries) {
            this.messageQueue.push(item);
          } else {
            item.onFail?.();
            console.warn('ZingIt: Message dropped after max retries');
          }
        }
      } else {
        // Still not connected, re-queue
        item.retries++;
        if (item.retries < item.maxRetries) {
          this.messageQueue.push(item);
        } else {
          item.onFail?.();
        }
      }
    }
  }

  sendBatch(data: BatchData, projectDir?: string, agent?: string, onFail?: () => void): boolean {
    // Include projectDir if specified (overrides server default)
    // Include agent if specified (for initial batch without prior agent selection)
    const batchData = projectDir ? { ...data, projectDir } : data;
    const message: { type: string; data: BatchData; agent?: string } = { type: 'batch', data: batchData };
    if (agent) {
      message.agent = agent;
    }
    // Batch messages are important - enable retry
    return this.send(message, { retry: true, maxRetries: 3, onFail });
  }

  sendMessage(content: string, pageUrl?: string): void {
    this.send({ type: 'message', content, pageUrl });
  }

  sendReset(): void {
    this.send({ type: 'reset' });
  }

  sendStop(): void {
    this.send({ type: 'stop' });
  }

  requestAgents(): void {
    this.send({ type: 'get_agents' });
  }

  selectAgent(agent: string): void {
    this.send({ type: 'select_agent', agent });
  }

  on(event: WSEventType, handler: WSEventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: WSEventType, handler: WSEventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: WSEventType, data?: WSMessage): void {
    this.handlers.get(event)?.forEach(handler => handler(data));
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get isMaxAttemptsReached(): boolean {
    return this.maxAttemptsReached;
  }

  setUrl(url: string): void {
    this.url = url;
  }
}
