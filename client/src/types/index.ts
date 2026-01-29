// client/src/types/index.ts

export type MarkerStatus = 'pending' | 'processing' | 'completed';

export interface Marker {
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
  status?: MarkerStatus;  // pending = blue (default), processing = red, completed = green
  screenshot?: string;     // Base64 encoded screenshot of the element
}

export interface ZingSettings {
  wsUrl: string;
  highlightColor: string;
  markerColor: string;           // Pending status color (blue default)
  processingColor: string;       // Processing status color (red default)
  completedColor: string;        // Completed status color (green default)
  projectDir: string;            // Project directory for AI agent to work in
  playSoundOnComplete: boolean;  // Play a ding sound when agent completes
  selectedAgent: string;         // Selected agent name (claude, copilot, codex)
  autoRefresh: boolean;          // Auto refresh page when agent completes
  // Undo/Redo features
  showUndoBar: boolean;          // Show undo toast after changes (default: true)
  undoBarTimeout: number;        // Undo bar auto-dismiss timeout ms (default: 10000)
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
  markers: Marker[];
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
  | 'agent_error'
  // History/Undo feature
  | 'get_history'
  | 'undo'
  | 'revert_to'
  | 'clear_history'
  | 'checkpoint_created'
  | 'history'
  | 'undo_complete'
  | 'revert_complete'
  | 'history_cleared';

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
  // History/Undo feature
  checkpoint?: CheckpointInfo;      // For checkpoint_created
  checkpoints?: CheckpointInfo[];   // For history
  checkpointId?: string;            // For undo/revert operations
  filesReverted?: string[];         // For undo_complete, revert_complete
}

// ============================================
// History/Undo Feature Types
// ============================================

export interface MarkerSummary {
  id: string;           // Marker UUID for precise matching during undo
  identifier: string;
  notes: string;
}

export interface CheckpointInfo {
  id: string;
  timestamp: string;
  markers: MarkerSummary[];
  filesModified: number;
  linesChanged: number;
  agentName: string;
  pageUrl: string;
  status: 'pending' | 'applied' | 'reverted';
  canUndo: boolean;
}

export interface HistoryState {
  checkpoints: CheckpointInfo[];
  isLoading: boolean;
  error: string | null;
}
