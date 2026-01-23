// client/src/services/websocket.ts
// WebSocket client with exponential backoff reconnection

import type { WSMessage, BatchData } from '../types/index.js';

export type WSEventType = 'open' | 'close' | 'message' | 'error' | 'max_attempts';
export type WSEventHandler = (data?: WSMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<WSEventType, Set<WSEventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: number | null = null;
  private maxAttemptsReached = false;

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
          console.warn('PokeUI: Invalid WebSocket message');
        }
      };
    } catch (err) {
      console.error('PokeUI: WebSocket connection failed', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
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

    console.log(`PokeUI: Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('PokeUI: WebSocket not connected');
    }
  }

  sendBatch(data: BatchData, projectDir?: string): void {
    // Include projectDir if specified (overrides server default)
    const batchData = projectDir ? { ...data, projectDir } : data;
    this.send({ type: 'batch', data: batchData });
  }

  sendMessage(content: string): void {
    this.send({ type: 'message', content });
  }

  sendReset(): void {
    this.send({ type: 'reset' });
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
