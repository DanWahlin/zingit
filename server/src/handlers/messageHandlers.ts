// server/src/handlers/messageHandlers.ts

import type { WebSocket } from 'ws';
import type { Agent, WSIncomingMessage, WSOutgoingMessage } from '../types.js';
import type { GitManager, GitManagerError as GitManagerErrorType } from '../services/git-manager.js';
import { validateBatchData } from '../validation/payload.js';

// Re-export GitManagerError for instanceof checks
export { GitManagerError } from '../services/git-manager.js';

export interface ConnectionState {
  session: any | null;
  agentName: string | null;
  agent: Agent | null;
  gitManager: GitManager | null;
  currentCheckpointId: string | null;
}

export interface MessageHandlerDeps {
  projectDir: string;
  detectAgents: () => Promise<any[]>;
  getAgent: (name: string) => Promise<Agent>;
}

// Helper to send messages
export function sendMessage(ws: WebSocket, msg: WSOutgoingMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Handle get_agents message
 */
export async function handleGetAgents(
  ws: WebSocket,
  deps: MessageHandlerDeps
): Promise<void> {
  const agents = await deps.detectAgents();
  sendMessage(ws, { type: 'agents', agents });
}

/**
 * Handle select_agent message
 */
export async function handleSelectAgent(
  ws: WebSocket,
  state: ConnectionState,
  msg: WSIncomingMessage,
  deps: MessageHandlerDeps
): Promise<void> {
  if (!msg.agent) {
    sendMessage(ws, { type: 'agent_error', message: 'No agent specified' });
    return;
  }

  // Check if agent is available
  const agentInfo = (await deps.detectAgents()).find(a => a.name === msg.agent);
  if (!agentInfo) {
    sendMessage(ws, { type: 'agent_error', message: `Unknown agent: ${msg.agent}` });
    return;
  }
  if (!agentInfo.available) {
    sendMessage(ws, {
      type: 'agent_error',
      message: agentInfo.reason || `Agent ${msg.agent} is not available`,
      agent: msg.agent
    });
    return;
  }

  // Destroy existing session if switching agents
  if (state.session && state.agentName !== msg.agent) {
    try {
      await state.session.destroy();
    } catch (err) {
      console.error('Error destroying session during agent switch:', (err as Error).message);
    } finally {
      state.session = null;
    }
  }

  // Initialize the agent
  try {
    state.agent = await deps.getAgent(msg.agent);
    state.agentName = msg.agent;
    sendMessage(ws, {
      type: 'agent_selected',
      agent: msg.agent,
      model: state.agent.model,
      projectDir: deps.projectDir
    });
  } catch (err) {
    sendMessage(ws, {
      type: 'agent_error',
      message: `Failed to initialize ${msg.agent}: ${(err as Error).message}`,
      agent: msg.agent
    });
  }
}

/**
 * Handle batch message
 */
export async function handleBatch(
  ws: WebSocket,
  state: ConnectionState,
  msg: WSIncomingMessage,
  deps: MessageHandlerDeps
): Promise<void> {
  if (!msg.data) return;

  // Validate batch data
  const validation = validateBatchData(msg.data);
  if (!validation.valid) {
    sendMessage(ws, { type: 'error', message: validation.error || 'Invalid batch data' });
    return;
  }

  // Use sanitized data
  const batchData = validation.sanitizedData!;

  // Check if agent is selected
  if (!state.agentName || !state.agent) {
    // If agent specified in batch message, try to select it
    if (msg.agent) {
      const agentInfo = (await deps.detectAgents()).find(a => a.name === msg.agent);
      if (!agentInfo?.available) {
        sendMessage(ws, {
          type: 'agent_error',
          message: `Agent ${msg.agent} is not available. Please select a different agent.`
        });
        return;
      }
      try {
        state.agent = await deps.getAgent(msg.agent);
        state.agentName = msg.agent;
      } catch (err) {
        sendMessage(ws, { type: 'error', message: (err as Error).message });
        return;
      }
    } else {
      sendMessage(ws, { type: 'error', message: 'No agent selected. Please select an agent first.' });
      return;
    }
  }

  // Use client-specified projectDir, or fall back to server default
  const projectDir = batchData.projectDir || deps.projectDir;

  // Create a checkpoint before AI modifications (if git manager available)
  if (state.gitManager) {
    try {
      console.log('[Batch] Creating checkpoint...');
      const checkpoint = await state.gitManager.createCheckpoint({
        annotations: batchData.annotations,
        pageUrl: batchData.pageUrl,
        pageTitle: batchData.pageTitle,
        agentName: state.agentName,
      });
      state.currentCheckpointId = checkpoint.id;
      console.log('[Batch] Checkpoint created, sending to client');
      sendMessage(ws, {
        type: 'checkpoint_created',
        checkpoint: {
          id: checkpoint.id,
          timestamp: checkpoint.timestamp,
          annotations: checkpoint.annotations,
          filesModified: 0,
          linesChanged: 0,
          agentName: checkpoint.agentName,
          pageUrl: checkpoint.pageUrl,
          status: 'pending',
          canUndo: false,
        },
      });
    } catch (err) {
      // Log but don't block - checkpoint is optional
      console.warn('Failed to create checkpoint:', (err as Error).message);
    }
  }

  console.log('[Batch] Creating session if needed...');
  if (!state.session) {
    state.session = await state.agent.createSession(ws, projectDir);
    console.log('[Batch] New session created');
  } else {
    console.log('[Batch] Reusing existing session');
  }

  console.log('[Batch] Formatting prompt and extracting images...');
  const prompt = state.agent.formatPrompt(batchData, projectDir);
  const images = state.agent.extractImages(batchData);
  console.log('[Batch] Sending processing message to client');
  sendMessage(ws, { type: 'processing' });
  console.log('[Batch] Starting agent session.send()...');
  await state.session.send({ prompt, images: images.length > 0 ? images : undefined });
  console.log('[Batch] Agent session.send() completed');

  // Finalize checkpoint after processing
  if (state.gitManager && state.currentCheckpointId) {
    try {
      await state.gitManager.finalizeCheckpoint(
        state.currentCheckpointId
      );
      // Send updated checkpoint info
      const checkpoints = await state.gitManager.getHistory();
      const updatedCheckpoint = checkpoints.find(
        (c) => c.id === state.currentCheckpointId
      );
      if (updatedCheckpoint) {
        sendMessage(ws, {
          type: 'checkpoint_created',
          checkpoint: updatedCheckpoint,
        });
      }
    } catch (err) {
      console.warn('Failed to finalize checkpoint:', (err as Error).message);
    }
    state.currentCheckpointId = null;
  }
}

/**
 * Handle message (follow-up message to agent)
 */
export async function handleMessage(
  ws: WebSocket,
  state: ConnectionState,
  msg: WSIncomingMessage,
  deps: MessageHandlerDeps
): Promise<void> {
  if (!msg.content) {
    return;
  }

  // Create session if it doesn't exist (allows direct messaging without annotations)
  if (!state.session) {
    if (!state.agent) {
      console.warn('[ZingIt] No agent selected for message');
      sendMessage(ws, { type: 'error', message: 'No agent selected. Please select an agent first.' });
      return;
    }
    console.log('[ZingIt] Creating session for direct message');
    state.session = await state.agent.createSession(ws, deps.projectDir);
  }

  try {
    console.log(`[ZingIt] Sending message: "${msg.content.substring(0, 50)}..."`);
    sendMessage(ws, { type: 'processing' });

    // Add timeout to detect if SDK hangs
    const timeoutMs = 120000; // 2 minutes
    const sendPromise = state.session.send({ prompt: msg.content });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Agent response timeout')), timeoutMs)
    );

    await Promise.race([sendPromise, timeoutPromise]);
    console.log('[ZingIt] Message sent to agent');
  } catch (err) {
    console.error('[ZingIt] Error sending message:', (err as Error).message);
    sendMessage(ws, { type: 'error', message: `Failed to send message: ${(err as Error).message}` });
  }
}

/**
 * Handle reset message
 */
export async function handleReset(
  ws: WebSocket,
  state: ConnectionState
): Promise<void> {
  if (state.session) {
    try {
      await state.session.destroy();
    } catch (err) {
      console.error('Error destroying session during reset:', (err as Error).message);
    } finally {
      state.session = null;
    }
  }
  sendMessage(ws, { type: 'reset_complete' });
}

/**
 * Handle stop message
 */
export async function handleStop(
  ws: WebSocket,
  state: ConnectionState
): Promise<void> {
  // Stop current agent execution
  if (state.session) {
    console.log('Stopping agent execution...');
    try {
      await state.session.destroy();
    } catch (err) {
      console.error('Error destroying session during stop:', (err as Error).message);
    } finally {
      state.session = null;
    }
  }
  sendMessage(ws, { type: 'idle' });
}

/**
 * Handle get_history message
 */
export async function handleGetHistory(
  ws: WebSocket,
  state: ConnectionState
): Promise<void> {
  if (!state.gitManager) {
    sendMessage(ws, { type: 'error', message: 'Git manager not initialized' });
    return;
  }
  try {
    const checkpoints = await state.gitManager.getHistory();
    sendMessage(ws, { type: 'history', checkpoints });
  } catch (err) {
    sendMessage(ws, {
      type: 'error',
      message: `Failed to get history: ${(err as Error).message}`,
    });
  }
}

/**
 * Handle undo message
 */
export async function handleUndo(
  ws: WebSocket,
  state: ConnectionState,
  GitManagerError: typeof GitManagerErrorType
): Promise<void> {
  if (!state.gitManager) {
    sendMessage(ws, { type: 'error', message: 'Git manager not initialized' });
    return;
  }
  try {
    const result = await state.gitManager.undoLastCheckpoint();
    state.currentCheckpointId = null;
    sendMessage(ws, {
      type: 'undo_complete',
      checkpointId: result.checkpointId,
      filesReverted: result.filesReverted,
    });
  } catch (err) {
    if (err instanceof GitManagerError) {
      sendMessage(ws, { type: 'error', message: err.message });
    } else {
      sendMessage(ws, {
        type: 'error',
        message: `Undo failed: ${(err as Error).message}`,
      });
    }
  }
}

/**
 * Handle revert_to message
 */
export async function handleRevertTo(
  ws: WebSocket,
  state: ConnectionState,
  msg: WSIncomingMessage,
  GitManagerError: typeof GitManagerErrorType
): Promise<void> {
  if (!state.gitManager) {
    sendMessage(ws, { type: 'error', message: 'Git manager not initialized' });
    return;
  }
  if (!msg.checkpointId) {
    sendMessage(ws, { type: 'error', message: 'No checkpoint ID specified' });
    return;
  }
  try {
    const result = await state.gitManager.revertToCheckpoint(msg.checkpointId);
    sendMessage(ws, {
      type: 'revert_complete',
      checkpointId: msg.checkpointId,
      filesReverted: result.filesReverted,
    });
  } catch (err) {
    if (err instanceof GitManagerError) {
      sendMessage(ws, { type: 'error', message: err.message });
    } else {
      sendMessage(ws, {
        type: 'error',
        message: `Revert failed: ${(err as Error).message}`,
      });
    }
  }
}

/**
 * Handle clear_history message
 */
export async function handleClearHistory(
  ws: WebSocket,
  state: ConnectionState
): Promise<void> {
  if (!state.gitManager) {
    sendMessage(ws, { type: 'error', message: 'Git manager not initialized' });
    return;
  }
  try {
    await state.gitManager.clearHistory();
    sendMessage(ws, { type: 'history_cleared' });
  } catch (err) {
    sendMessage(ws, {
      type: 'error',
      message: `Failed to clear history: ${(err as Error).message}`,
    });
  }
}
