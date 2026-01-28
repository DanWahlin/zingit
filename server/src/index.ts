// server/src/index.ts

import { WebSocketServer, WebSocket } from 'ws';
import { CopilotAgent } from './agents/copilot.js';
import { ClaudeCodeAgent } from './agents/claude.js';
import { CodexAgent } from './agents/codex.js';
import { detectAgents } from './utils/agent-detection.js';
import { GitManager, GitManagerError } from './services/git-manager.js';
import type { Agent, WSIncomingMessage, WSOutgoingMessage } from './types.js';
import type { ConnectionState, MessageHandlerDeps } from './handlers/messageHandlers.js';
import {
  sendMessage,
  handleGetAgents,
  handleSelectAgent,
  handleBatch,
  handleMessage,
  handleReset,
  handleStop,
  handleGetHistory,
  handleUndo,
  handleRevertTo,
  handleClearHistory
} from './handlers/messageHandlers.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

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

// ConnectionState is now defined in handlers/messageHandlers.ts

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

  // WebSocket server with payload limit to prevent accidental memory issues
  const wss = new WebSocketServer({
    port: PORT,
    maxPayload: 10 * 1024 * 1024  // 10MB limit (prevents accidental memory exhaustion)
  });
  console.log(`✓ ZingIt server running on ws://localhost:${PORT}`);
  console.log(`✓ Project directory: ${PROJECT_DIR}`);
  if (DEFAULT_AGENT) {
    console.log(`✓ Default agent: ${DEFAULT_AGENT}`);
  } else {
    console.log('✓ Dynamic agent selection enabled (client chooses agent)');
  }

  // Track connections and use shared global state for session persistence
  const connections = new Set<WebSocket>();

  // Global state that persists across WebSocket reconnections
  // NOTE: This is designed for single-user local development.
  // Multiple simultaneous clients will share the same agent session.
  const gitManager = new GitManager(PROJECT_DIR);
  gitManager.initialize().catch((err) => {
    console.warn('Failed to initialize GitManager:', err.message);
  });

  const globalState: ConnectionState = {
    session: null,
    agentName: DEFAULT_AGENT,  // Use default if set
    agent: DEFAULT_AGENT ? initializedAgents.get(DEFAULT_AGENT) || null : null,
    gitManager,
    currentCheckpointId: null,
  };

  // Track cleanup timer to prevent race conditions
  let sessionCleanupTimer: NodeJS.Timeout | null = null;

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected');
    connections.add(ws);
    const state = globalState; // Use shared state

    // Clear any pending cleanup timer since we have an active connection
    if (sessionCleanupTimer) {
      clearTimeout(sessionCleanupTimer);
      sessionCleanupTimer = null;
      console.log('Cancelled session cleanup - client reconnected');
    }

    // Heartbeat mechanism to detect dead connections
    let isAlive = true;
    ws.on('pong', () => {
      isAlive = true;
    });

    const heartbeatInterval = setInterval(() => {
      if (!isAlive) {
        console.log('Client failed to respond to ping - terminating connection');
        clearInterval(heartbeatInterval);
        ws.terminate(); // This will trigger the 'close' event which handles cleanup
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30000); // Ping every 30 seconds

    // Create dependencies object for handlers
    const deps: MessageHandlerDeps = {
      projectDir: PROJECT_DIR,
      detectAgents,
      getAgent
    };

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
          case 'get_agents':
            await handleGetAgents(ws, deps);
            break;

          case 'select_agent':
            await handleSelectAgent(ws, state, msg, deps);
            break;

          case 'batch':
            await handleBatch(ws, state, msg, deps);
            break;

          case 'message':
            await handleMessage(ws, state, msg, deps);
            break;

          case 'reset':
            await handleReset(ws, state);
            break;

          case 'stop':
            await handleStop(ws, state);
            break;

          case 'get_history':
            await handleGetHistory(ws, state);
            break;

          case 'undo':
            await handleUndo(ws, state, GitManagerError);
            break;

          case 'revert_to':
            await handleRevertTo(ws, state, msg, GitManagerError);
            break;

          case 'clear_history':
            await handleClearHistory(ws, state);
            break;
        }
      } catch (err) {
        sendMessage(ws, { type: 'error', message: (err as Error).message });
      }
    });

    ws.on('close', async () => {
      console.log('Client disconnected');
      connections.delete(ws);

      // Clean up heartbeat interval
      clearInterval(heartbeatInterval);

      // Destroy session immediately on disconnect since it holds a stale WebSocket reference
      // When client reconnects, a new session will be created with the new WebSocket
      if (state.session) {
        try {
          await state.session.destroy();
          console.log('Session destroyed due to client disconnect');
        } catch (err) {
          console.error('Error destroying session during disconnect:', (err as Error).message);
        } finally {
          state.session = null;
        }
      }

      // Clear any existing cleanup timer
      if (sessionCleanupTimer) {
        clearTimeout(sessionCleanupTimer);
        sessionCleanupTimer = null;
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
      // Clean up heartbeat interval on error
      clearInterval(heartbeatInterval);
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
    if (globalState.session) {
      try {
        await globalState.session.destroy();
      } catch (err) {
        console.error('Error destroying session during shutdown:', (err as Error).message);
      }
    }
    for (const agent of initializedAgents.values()) {
      try {
        await agent.stop();
      } catch (err) {
        console.error('Error stopping agent during shutdown:', (err as Error).message);
      }
    }
    wss.close();
    process.exit(0);
  });
}

main().catch(console.error);
