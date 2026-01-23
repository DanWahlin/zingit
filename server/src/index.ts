// server/src/index.ts

import { WebSocketServer, WebSocket } from 'ws';
import { CopilotAgent } from './agents/copilot.js';
import { ClaudeCodeAgent } from './agents/claude.js';
import { CodexAgent } from './agents/codex.js';
import { detectAgents, type AgentInfo } from './utils/agent-detection.js';
import type { Agent, AgentSession, WSIncomingMessage, WSOutgoingMessage } from './types.js';

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
}

async function main(): Promise<void> {
  // Detect available agents on startup
  const availableAgents = detectAgents();
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
  console.log(`✓ PokeUI server running on ws://localhost:${PORT}`);
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
    const state: ConnectionState = {
      session: null,
      agentName: DEFAULT_AGENT,  // Use default if set
      agent: DEFAULT_AGENT ? initializedAgents.get(DEFAULT_AGENT) || null : null
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
            const agents = detectAgents();
            sendMessage(ws, { type: 'agents', agents });
            break;
          }

          case 'select_agent': {
            if (!msg.agent) {
              sendMessage(ws, { type: 'agent_error', message: 'No agent specified' });
              break;
            }

            // Check if agent is available
            const agentInfo = detectAgents().find(a => a.name === msg.agent);
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

            // Check if agent is selected
            if (!state.agentName || !state.agent) {
              // If agent specified in batch message, try to select it
              if (msg.agent) {
                const agentInfo = detectAgents().find(a => a.name === msg.agent);
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
            const projectDir = msg.data.projectDir || PROJECT_DIR;

            if (!state.session) {
              state.session = await state.agent.createSession(ws, projectDir);
            }

            const prompt = state.agent.formatPrompt(msg.data, projectDir);
            sendMessage(ws, { type: 'processing' });
            await state.session.send({ prompt });
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
