// server/src/types.ts

import type { WebSocket } from 'ws';

export interface Agent {
  name: string;
  model: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  createSession(ws: WebSocket, projectDir: string): Promise<AgentSession>;
  formatPrompt(data: BatchData, projectDir: string): string;
}

export interface AgentSession {
  send(msg: { prompt: string }): Promise<void>;
  destroy(): Promise<void>;
}

export interface Annotation {
  id: string;
  selector: string;
  identifier: string;
  html: string;
  notes: string;
  selectedText?: string;
  parentContext?: string;  // Parent elements path like "div.card > section.content"
  textContent?: string;    // Plain text content (easier to search than HTML)
  siblingContext?: string; // Position among siblings (e.g., "Position 1 of 3 in parent")
  parentHtml?: string;     // Parent HTML with target element marked (data-pokeui-target="true")
}

export interface BatchData {
  pageUrl: string;
  pageTitle: string;
  annotations: Annotation[];
  projectDir?: string;  // Client-specified project directory (overrides server default)
}

export type WSIncomingType = 'batch' | 'message' | 'reset' | 'stop';

export interface WSIncomingMessage {
  type: WSIncomingType;
  data?: BatchData;
  content?: string;
}

export type WSOutgoingType =
  | 'connected'
  | 'processing'
  | 'response'
  | 'delta'
  | 'tool_start'
  | 'tool_end'
  | 'idle'
  | 'error'
  | 'reset_complete';

export interface WSOutgoingMessage {
  type: WSOutgoingType;
  content?: string;
  message?: string;
  tool?: string;
  agent?: string;
  model?: string;
  projectDir?: string;  // Server's default project directory
}
