// server/src/index.ts

import { WebSocketServer, WebSocket } from 'ws';
import { CoreProviderAdapter } from './agents/core-adapter.js';
import {
  CopilotProvider,
  ClaudeProvider,
  CodexProvider,
  detectAgents as coreDetectAgents,
} from '@codewithdan/agent-sdk-core';
import type { SpawnOptions, SpawnedProcess } from '@anthropic-ai/claude-agent-sdk';
import { spawn } from 'node:child_process';
import { userInfo } from 'node:os';
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

import { resolve } from 'path';

const PORT = parseInt(process.env.PORT || '3000', 10);

// Legacy support: still allow AGENT env var for backwards compatibility
const DEFAULT_AGENT = process.env.AGENT || null;

// Resolve PROJECT_DIR: explicit env var > npm invocation directory > cwd
const rawProjectDir = process.env.PROJECT_DIR;
const initCwd = process.env.INIT_CWD || process.cwd();
let PROJECT_DIR: string;
if (rawProjectDir) {
  PROJECT_DIR = resolve(initCwd, rawProjectDir);
} else {
  PROJECT_DIR = initCwd;
  console.log(`ℹ PROJECT_DIR not set, defaulting to: ${PROJECT_DIR}`);
}

// Agent registry — wraps @codewithdan/agent-sdk-core providers with zingit adapter
function createClaudeSpawner(): { permissionMode: 'acceptEdits' | 'bypassPermissions'; spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess } {
  if (userInfo().uid === 0) {
    return {
      permissionMode: 'bypassPermissions',
      spawnClaudeCodeProcess: (options: SpawnOptions): SpawnedProcess => {
        const { command, args, cwd, env, signal } = options;
        const child = spawn('sudo', ['-u', 'ccrunner', '-E', command, ...args], {
          cwd,
          stdio: ['pipe', 'pipe', 'pipe'],
          signal,
          env: { ...env, HOME: '/home/ccrunner', USER: 'ccrunner' },
          windowsHide: true,
        });
        return {
          stdin: child.stdin!,
          stdout: child.stdout!,
          get killed() { return child.killed; },
          get exitCode() { return child.exitCode; },
          kill: (sig) => child.kill(sig),
          on: child.on.bind(child) as SpawnedProcess['on'],
          once: child.once.bind(child) as SpawnedProcess['once'],
          off: child.off.bind(child) as SpawnedProcess['off'],
        };
      },
    };
  }
  return { permissionMode: 'acceptEdits' };
}

function createAgentFactory(): Record<string, () => Agent> {
  const claudeOpts = createClaudeSpawner();
  return {
    copilot: () => new CoreProviderAdapter(new CopilotProvider()),
    claude: () => new CoreProviderAdapter(new ClaudeProvider(claudeOpts)),
    codex: () => new CoreProviderAdapter(new CodexProvider()),
  };
}
const agentFactories = createAgentFactory();

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
  const factory = agentFactories[agentName];
  if (!factory) {
    throw new Error(`Unknown agent: ${agentName}`);
  }

  const agent = factory();
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
    sessionId: null,  // Preserved across reconnections for conversation continuity
    wsRef: null,  // Will be created when first session is established
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

    // Update WebSocket reference if session exists (reconnection case)
    if (state.wsRef) {
      state.wsRef.current = ws;
      console.log('Updated WebSocket reference for existing session');
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

    // Serialize message processing to prevent race conditions
    // (e.g., undo arriving while batch finalization is still in progress)
    let messageQueue = Promise.resolve();

    ws.on('message', (data: Buffer) => {
      messageQueue = messageQueue.then(async () => {
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
    });

    ws.on('close', async () => {
      console.log('Client disconnected');
      connections.delete(ws);

      // Clean up heartbeat interval
      clearInterval(heartbeatInterval);

      // Don't immediately destroy the session - it may still be processing
      // Instead, schedule cleanup after a delay to allow for reconnection
      // If client reconnects, the wsRef will be updated with the new WebSocket
      if (state.session) {
        console.log('Scheduling session cleanup (allowing time for reconnection)');
        // Clear any existing cleanup timer
        if (sessionCleanupTimer) {
          clearTimeout(sessionCleanupTimer);
        }
        // Destroy session after 5 seconds if client doesn't reconnect
        sessionCleanupTimer = setTimeout(async () => {
          if (state.session) {
            try {
              await state.session.destroy();
              console.log('Session destroyed after reconnection timeout');
            } catch (err) {
              console.error('Error destroying session during cleanup:', (err as Error).message);
            } finally {
              state.session = null;
              state.wsRef = null;
            }
          }
          sessionCleanupTimer = null;
        }, 5000);
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
