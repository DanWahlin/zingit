// server/src/index.ts

import { WebSocketServer, WebSocket } from 'ws';
import { CopilotAgent } from './agents/copilot.js';
import { ClaudeCodeAgent } from './agents/claude.js';
import type { Agent, AgentSession, WSIncomingMessage, WSOutgoingMessage } from './types.js';

const PORT = parseInt(process.env.PORT || '8765', 10);
const AGENT_TYPE = process.env.AGENT || 'copilot';

if (!process.env.PROJECT_DIR) {
  console.error('ERROR: PROJECT_DIR environment variable is required');
  console.error('Example: PROJECT_DIR=/path/to/your/project AGENT=claude npm run dev');
  process.exit(1);
}

const PROJECT_DIR: string = process.env.PROJECT_DIR;

// Agent registry - choose agent via AGENT env var
// AGENT=copilot npm run dev   -> Uses GitHub Copilot SDK (simulated)
// AGENT=claude npm run dev    -> Uses Claude Code CLI
const agents: Record<string, new () => Agent> = {
  copilot: CopilotAgent,
  claude: ClaudeCodeAgent,
};

async function main(): Promise<void> {
  // Initialize agent
  const AgentClass = agents[AGENT_TYPE];
  if (!AgentClass) {
    console.error(`Unknown agent: ${AGENT_TYPE}`);
    console.error(`Available agents: ${Object.keys(agents).join(', ')}`);
    process.exit(1);
  }

  const agent = new AgentClass();

  try {
    await agent.start();
  } catch (err) {
    console.error(`Failed to start ${AGENT_TYPE}:`, (err as Error).message);
    process.exit(1);
  }

  // WebSocket server
  const wss = new WebSocketServer({ port: PORT });
  console.log(`✓ PokeUI server running on ws://localhost:${PORT}`);
  console.log(`✓ Agent: ${AGENT_TYPE}`);
  console.log(`✓ Project directory: ${PROJECT_DIR}`);

  // Track sessions
  const sessions = new Map<WebSocket, AgentSession>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected');
    let session: AgentSession | null = null;

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
          case 'batch':
            if (!msg.data) break;

            // Use client-specified projectDir, or fall back to server default
            const projectDir = msg.data.projectDir || PROJECT_DIR;

            if (!session) {
              session = await agent.createSession(ws, projectDir);
              sessions.set(ws, session);
            }

            const prompt = agent.formatPrompt(msg.data, projectDir);
            sendMessage(ws, { type: 'processing' });
            await session.send({ prompt });
            break;

          case 'message':
            if (session && msg.content) {
              await session.send({ prompt: msg.content });
            }
            break;

          case 'reset':
            if (session) {
              await session.destroy();
              session = null;
              sessions.delete(ws);
            }
            sendMessage(ws, { type: 'reset_complete' });
            break;

          case 'stop':
            // Stop current agent execution
            if (session) {
              console.log('Stopping agent execution...');
              await session.destroy();
              session = null;
              sessions.delete(ws);
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
      if (session) {
        await session.destroy();
        sessions.delete(ws);
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
    });

    sendMessage(ws, {
      type: 'connected',
      agent: AGENT_TYPE,
      model: agent.model,
      projectDir: PROJECT_DIR
    });
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    for (const session of sessions.values()) {
      await session.destroy();
    }
    await agent.stop();
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
