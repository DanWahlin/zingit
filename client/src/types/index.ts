// client/src/types/index.ts

export type AnnotationStatus = 'pending' | 'processing' | 'completed';

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
  parentHtml?: string;     // Parent HTML with target element marked
  status?: AnnotationStatus;  // pending = blue (default), processing = red, completed = green
}

export interface PokeSettings {
  wsUrl: string;
  highlightColor: string;
  markerColor: string;           // Pending status color (blue default)
  processingColor: string;       // Processing status color (red default)
  completedColor: string;        // Completed status color (green default)
  autoConnect: boolean;
  projectDir: string;            // Project directory for AI agent to work in
  playSoundOnComplete: boolean;  // Play a ding sound when agent completes
  selectedAgent: string;         // Selected agent name (claude, copilot, codex)
  autoRefresh: boolean;          // Auto refresh page when agent completes
}

export interface AgentInfo {
  name: string;
  displayName: string;
  available: boolean;
  version?: string;
  reason?: string;
  installCommand: string;
}

export interface BatchData {
  pageUrl: string;
  pageTitle: string;
  annotations: Annotation[];
  projectDir?: string;  // Project directory (overrides server default)
}

// WebSocket message types
export type WSMessageType =
  | 'connected'
  | 'disconnected'
  | 'processing'
  | 'response'
  | 'delta'
  | 'tool_start'
  | 'tool_end'
  | 'idle'
  | 'error'
  | 'max_attempts'
  | 'batch'
  | 'message'
  | 'reset'
  | 'reset_complete'
  | 'get_agents'
  | 'select_agent'
  | 'agents'
  | 'agent_selected'
  | 'agent_error';

export interface WSMessage {
  type: WSMessageType;
  content?: string;
  message?: string;
  tool?: string;
  agent?: string;
  model?: string;
  data?: BatchData;
  projectDir?: string;  // Server's default project directory (sent on connect)
  agents?: AgentInfo[]; // Available agents (from 'agents' message)
}
