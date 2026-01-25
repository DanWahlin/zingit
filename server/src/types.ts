// server/src/types.ts

import type { WebSocket } from 'ws';
import type { CheckpointInfo } from './services/git-manager.js';

export interface Agent {
  name: string;
  model: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  createSession(ws: WebSocket, projectDir: string): Promise<AgentSession>;
  formatPrompt(data: BatchData, projectDir: string): string;
  extractImages(data: BatchData): ImageContent[];
}

export interface ImageContent {
  base64: string;      // Base64 encoded image data (without prefix)
  mediaType: string;   // e.g., 'image/png'
  label?: string;      // Optional label for the image (e.g., "Screenshot of element: button.submit")
}

export interface AgentSession {
  send(msg: { prompt: string; images?: ImageContent[] }): Promise<void>;
  destroy(): Promise<void>;
}

export interface Annotation {
  id: string;
  selector: string;
  identifier: string;
  html: string;
  notes: string;
  status?: 'pending' | 'processing' | 'completed';  // Annotation processing status
  selectedText?: string;
  parentContext?: string;  // Parent elements path like "div.card > section.content"
  textContent?: string;    // Plain text content (easier to search than HTML)
  siblingContext?: string; // Position among siblings (e.g., "Position 1 of 3 in parent")
  parentHtml?: string;     // Parent HTML with target element marked (data-zingit-target="true")
  screenshot?: string;     // Base64 encoded screenshot of the element (without data:image/png;base64, prefix)
}

export interface BatchData {
  pageUrl: string;
  pageTitle: string;
  annotations: Annotation[];
  projectDir?: string;  // Client-specified project directory (overrides server default)
}

export type WSIncomingType =
  | 'batch'
  | 'message'
  | 'reset'
  | 'stop'
  | 'get_agents'
  | 'select_agent'
  // History/Undo feature
  | 'get_history'
  | 'undo'
  | 'revert_to'
  | 'clear_history';

export interface WSIncomingMessage {
  type: WSIncomingType;
  data?: BatchData;
  content?: string;
  agent?: string;  // For select_agent and batch messages
  // History/Undo feature
  checkpointId?: string;  // For revert_to
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
  | 'reset_complete'
  | 'agents'
  | 'agent_selected'
  | 'agent_error'
  // History/Undo feature
  | 'checkpoint_created'
  | 'history'
  | 'undo_complete'
  | 'revert_complete'
  | 'history_cleared';

export interface AgentInfoMessage {
  name: string;
  displayName: string;
  available: boolean;
  version?: string;
  reason?: string;
  installCommand: string;
}

export interface WSOutgoingMessage {
  type: WSOutgoingType;
  content?: string;
  message?: string;
  tool?: string;
  agent?: string;
  model?: string;
  projectDir?: string;  // Server's default project directory
  agents?: AgentInfoMessage[];  // For 'agents' message type
  // History/Undo feature
  checkpoint?: CheckpointInfo;      // For checkpoint_created
  checkpoints?: CheckpointInfo[];   // For history
  checkpointId?: string;            // For undo_complete, revert_complete
  filesReverted?: string[];         // For undo_complete, revert_complete
}
