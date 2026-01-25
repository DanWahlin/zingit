// server/src/index.ts

import { WebSocketServer, WebSocket } from 'ws';
import { CopilotAgent } from './agents/copilot.js';
import { ClaudeCodeAgent } from './agents/claude.js';
import { CodexAgent } from './agents/codex.js';
import { detectAgents, type AgentInfo } from './utils/agent-detection.js';
import { GitManager, GitManagerError } from './services/git-manager.js';
import type { Agent, AgentSession, WSIncomingMessage, WSOutgoingMessage, BatchData, Annotation } from './types.js';

// ============================================
// Payload Validation
// ============================================

const MAX_ANNOTATIONS = 50;
const MAX_HTML_LENGTH = 50000;
const MAX_NOTES_LENGTH = 5000;
const MAX_SELECTOR_LENGTH = 1000;
const MAX_SCREENSHOT_SIZE = 500000; // ~500KB base64

interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedData?: BatchData;
}

const VALID_STATUSES = ['pending', 'processing', 'completed'];

function validateAnnotation(annotation: Annotation, index: number): { valid: boolean; error?: string } {
  if (!annotation.id || typeof annotation.id !== 'string') {
    return { valid: false, error: `Annotation ${index}: missing or invalid id` };
  }
  if (!annotation.identifier || typeof annotation.identifier !== 'string') {
    return { valid: false, error: `Annotation ${index}: missing or invalid identifier` };
  }
  if (annotation.status && !VALID_STATUSES.includes(annotation.status)) {
    return { valid: false, error: `Annotation ${index}: invalid status '${annotation.status}'` };
  }
  if (annotation.selector && annotation.selector.length > MAX_SELECTOR_LENGTH) {
    return { valid: false, error: `Annotation ${index}: selector too long (max ${MAX_SELECTOR_LENGTH})` };
  }
  if (annotation.html && annotation.html.length > MAX_HTML_LENGTH) {
    return { valid: false, error: `Annotation ${index}: html too long (max ${MAX_HTML_LENGTH})` };
  }
  if (annotation.notes && annotation.notes.length > MAX_NOTES_LENGTH) {
    return { valid: false, error: `Annotation ${index}: notes too long (max ${MAX_NOTES_LENGTH})` };
  }
  if (annotation.screenshot && annotation.screenshot.length > MAX_SCREENSHOT_SIZE) {
    return { valid: false, error: `Annotation ${index}: screenshot too large (max ${MAX_SCREENSHOT_SIZE / 1000}KB)` };
  }
  return { valid: true };
}

function validateBatchData(data: BatchData): ValidationResult {
  if (!data) {
    return { valid: false, error: 'Missing batch data' };
  }

  if (!data.annotations || !Array.isArray(data.annotations)) {
    return { valid: false, error: 'Missing or invalid annotations array' };
  }

  if (data.annotations.length === 0) {
    return { valid: false, error: 'No annotations provided' };
  }

  if (data.annotations.length > MAX_ANNOTATIONS) {
    return { valid: false, error: `Too many annotations (max ${MAX_ANNOTATIONS})` };
  }

  // Validate each annotation
  for (let i = 0; i < data.annotations.length; i++) {
    const result = validateAnnotation(data.annotations[i], i);
    if (!result.valid) {
      return { valid: false, error: result.error };
    }
  }

  // Sanitize and return
  return {
    valid: true,
    sanitizedData: {
      ...data,
      pageUrl: data.pageUrl ? data.pageUrl.slice(0, 2000) : data.pageUrl,
      pageTitle: data.pageTitle ? data.pageTitle.slice(0, 500) : data.pageTitle,
    }
  };
}

const PORT = parseInt(process.env.PORT || '8765', 10);

// Legacy support: still allow AGENT env var for backwards compatibility
const DEFAULT_AGENT = process.env.AGENT || null;

if (!process.env.PROJECT_DIR) {
  console.error('ERROR: PROJECT_DIR environment variable is required');
  console.error('Example: PROJECT_DIR=/path/to/your/project npm run dev');
  process.exit(1);
}

const PROJECT_DIR: string = process.env.PROJECT_DIR;

// Agent registry
const agentClasses: Record<string, new () => Agent> = {
  copilot: CopilotAgent,
  claude: ClaudeCodeAgent,
  codex: CodexAgent,
};

// Cache for initialized agents (lazy initialization)
const initializedAgents: Map<string, Agent> = new Map();

/**
 * Get or initialize an agent
 */
async function getAgent(agentName: string): Promise<Agent> {
  // Check cache first
  const cached = initializedAgents.get(agentName);
  if (cached) {
    return cached;
  }

  // Initialize new agent
  const AgentClass = agentClasses[agentName];
  if (!AgentClass) {
    throw new Error(`Unknown agent: ${agentName}`);
  }

  const agent = new AgentClass();
  await agent.start();
  initializedAgents.set(agentName, agent);
  return agent;
}

// Connection state
interface ConnectionState {
  session: AgentSession | null;
  agentName: string | null;
  agent: Agent | null;
  // History/Undo feature
  gitManager: GitManager | null;
  currentCheckpointId: string | null;
}

async function main(): Promise<void> {
  // Detect available agents on startup
  const availableAgents = await detectAgents();
  console.log('✓ Agent availability:');
  for (const agent of availableAgents) {
    const status = agent.available ? '✓' : '✗';
    const version = agent.version ? ` (${agent.version})` : '';
    const reason = agent.reason ? ` - ${agent.reason}` : '';
    console.log(`  ${status} ${agent.displayName}${version}${reason}`);
  }

  // If DEFAULT_AGENT is set, pre-initialize it for backwards compatibility
  if (DEFAULT_AGENT) {
    const agentInfo = availableAgents.find(a => a.name === DEFAULT_AGENT);
    if (agentInfo?.available) {
      try {
        await getAgent(DEFAULT_AGENT);
        console.log(`✓ Pre-initialized agent: ${DEFAULT_AGENT}`);
      } catch (err) {
        console.warn(`⚠ Failed to pre-initialize ${DEFAULT_AGENT}:`, (err as Error).message);
      }
    }
  }

  // WebSocket server
  const wss = new WebSocketServer({ port: PORT });
  console.log(`✓ ZingIt server running on ws://localhost:${PORT}`);
  console.log(`✓ Project directory: ${PROJECT_DIR}`);
  if (DEFAULT_AGENT) {
    console.log(`✓ Default agent: ${DEFAULT_AGENT}`);
  } else {
    console.log('✓ Dynamic agent selection enabled (client chooses agent)');
  }

  // Track connection states
  const connections = new Map<WebSocket, ConnectionState>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected');

    // Initialize connection state
    const gitManager = new GitManager(PROJECT_DIR);

    // Initialize git manager (async but don't block connection)
    gitManager.initialize().catch((err) => {
      console.warn('Failed to initialize GitManager:', err.message);
    });

    const state: ConnectionState = {
      session: null,
      agentName: DEFAULT_AGENT,  // Use default if set
      agent: DEFAULT_AGENT ? initializedAgents.get(DEFAULT_AGENT) || null : null,
      gitManager,
      currentCheckpointId: null,
    };
    connections.set(ws, state);

    ws.on('message', async (data: Buffer) => {
      let msg: WSIncomingMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        sendMessage(ws, { type: 'error', message: 'Invalid JSON' });
        return;
      }

      try {
        switch (msg.type) {
          case 'get_agents': {
            // Return fresh agent availability info
            const agents = await detectAgents();
            sendMessage(ws, { type: 'agents', agents });
            break;
          }

          case 'select_agent': {
            if (!msg.agent) {
              sendMessage(ws, { type: 'agent_error', message: 'No agent specified' });
              break;
            }

            // Check if agent is available
            const agentInfo = (await detectAgents()).find(a => a.name === msg.agent);
            if (!agentInfo) {
              sendMessage(ws, { type: 'agent_error', message: `Unknown agent: ${msg.agent}` });
              break;
            }
            if (!agentInfo.available) {
              sendMessage(ws, {
                type: 'agent_error',
                message: agentInfo.reason || `Agent ${msg.agent} is not available`,
                agent: msg.agent
              });
              break;
            }

            // Destroy existing session if switching agents
            if (state.session && state.agentName !== msg.agent) {
              await state.session.destroy();
              state.session = null;
            }

            // Initialize the agent
            try {
              state.agent = await getAgent(msg.agent);
              state.agentName = msg.agent;
              sendMessage(ws, {
                type: 'agent_selected',
                agent: msg.agent,
                model: state.agent.model,
                projectDir: PROJECT_DIR
              });
            } catch (err) {
              sendMessage(ws, {
                type: 'agent_error',
                message: `Failed to initialize ${msg.agent}: ${(err as Error).message}`,
                agent: msg.agent
              });
            }
            break;
          }

          case 'batch': {
            if (!msg.data) break;

            // Validate batch data
            const validation = validateBatchData(msg.data);
            if (!validation.valid) {
              sendMessage(ws, { type: 'error', message: validation.error || 'Invalid batch data' });
              break;
            }

            // Use sanitized data
            const batchData = validation.sanitizedData!;

            // Check if agent is selected
            if (!state.agentName || !state.agent) {
              // If agent specified in batch message, try to select it
              if (msg.agent) {
                const agentInfo = (await detectAgents()).find(a => a.name === msg.agent);
                if (!agentInfo?.available) {
                  sendMessage(ws, {
                    type: 'agent_error',
                    message: `Agent ${msg.agent} is not available. Please select a different agent.`
                  });
                  break;
                }
                try {
                  state.agent = await getAgent(msg.agent);
                  state.agentName = msg.agent;
                } catch (err) {
                  sendMessage(ws, { type: 'error', message: (err as Error).message });
                  break;
                }
              } else {
                sendMessage(ws, { type: 'error', message: 'No agent selected. Please select an agent first.' });
                break;
              }
            }

            // Use client-specified projectDir, or fall back to server default
            const projectDir = batchData.projectDir || PROJECT_DIR;

            // Create a checkpoint before AI modifications (if git manager available)
            if (state.gitManager) {
              try {
                const checkpoint = await state.gitManager.createCheckpoint({
                  annotations: batchData.annotations,
                  pageUrl: batchData.pageUrl,
                  pageTitle: batchData.pageTitle,
                  agentName: state.agentName,
                });
                state.currentCheckpointId = checkpoint.id;
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

            if (!state.session) {
              state.session = await state.agent.createSession(ws, projectDir);
            }

            const prompt = state.agent.formatPrompt(batchData, projectDir);
            const images = state.agent.extractImages(batchData);
            sendMessage(ws, { type: 'processing' });
            await state.session.send({ prompt, images: images.length > 0 ? images : undefined });

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
            break;
          }

          case 'message':
            if (state.session && msg.content) {
              await state.session.send({ prompt: msg.content });
            }
            break;

          case 'reset':
            if (state.session) {
              await state.session.destroy();
              state.session = null;
            }
            sendMessage(ws, { type: 'reset_complete' });
            break;

          case 'stop':
            // Stop current agent execution
            if (state.session) {
              console.log('Stopping agent execution...');
              await state.session.destroy();
              state.session = null;
            }
            sendMessage(ws, { type: 'idle' });
            break;

          // ============================================
          // History/Undo Feature Handlers
          // ============================================

          case 'get_history': {
            if (!state.gitManager) {
              sendMessage(ws, { type: 'error', message: 'Git manager not initialized' });
              break;
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
            break;
          }

          case 'undo': {
            if (!state.gitManager) {
              sendMessage(ws, { type: 'error', message: 'Git manager not initialized' });
              break;
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
            break;
          }

          case 'revert_to': {
            if (!state.gitManager) {
              sendMessage(ws, { type: 'error', message: 'Git manager not initialized' });
              break;
            }
            if (!msg.checkpointId) {
              sendMessage(ws, { type: 'error', message: 'No checkpoint ID specified' });
              break;
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
            break;
          }

          case 'clear_history': {
            if (!state.gitManager) {
              sendMessage(ws, { type: 'error', message: 'Git manager not initialized' });
              break;
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
            break;
          }

        }
      } catch (err) {
        sendMessage(ws, { type: 'error', message: (err as Error).message });
      }
    });

    ws.on('close', async () => {
      console.log('Client disconnected');
      if (state.session) {
        await state.session.destroy();
      }
      connections.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
    });

    // Send connected message with current state
    sendMessage(ws, {
      type: 'connected',
      agent: state.agentName || undefined,
      model: state.agent?.model,
      projectDir: PROJECT_DIR
    });
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    for (const state of connections.values()) {
      if (state.session) {
        await state.session.destroy();
      }
    }
    for (const agent of initializedAgents.values()) {
      await agent.stop();
    }
    wss.close();
    process.exit(0);
  });
}

function sendMessage(ws: WebSocket, msg: WSOutgoingMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

main().catch(console.error);
