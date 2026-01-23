// server/src/agents/copilot.ts
// Agent that uses GitHub Copilot SDK

import type { WebSocket } from 'ws';
import { CopilotClient } from '@github/copilot-sdk';
import { BaseAgent } from './base.js';
import type { AgentSession, WSOutgoingMessage } from '../types.js';

export class CopilotAgent extends BaseAgent {
  name = 'copilot';
  model: string;
  private client: CopilotClient | null = null;

  constructor() {
    super();
    this.model = process.env.COPILOT_MODEL || 'claude-sonnet-4-20250514';
  }

  async start(): Promise<void> {
    // Initialize the Copilot client
    this.client = new CopilotClient({
      logLevel: 'info',
      autoRestart: true,
    });

    await this.client.start();
    console.log(`✓ Copilot SDK initialized (model: ${this.model})`);
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      this.client = null;
    }
  }

  async createSession(ws: WebSocket, projectDir: string): Promise<AgentSession> {
    if (!this.client) {
      throw new Error('Copilot client not initialized');
    }

    const send = (data: WSOutgoingMessage): void => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
      }
    };

    // Create a Copilot session with streaming enabled
    // Note: Copilot SDK doesn't support cwd in session config, so we include it in the system message
    const session = await this.client.createSession({
      model: this.model,
      streaming: true,
      systemMessage: {
        mode: 'append',
        content: `
<context>
You are a UI debugging assistant working in the project directory: ${projectDir}

When given annotations about UI elements:
1. Search for the corresponding code using the selectors and HTML context provided
2. Make the requested changes in the project at ${projectDir}
3. Be thorough in finding the right files and making precise edits
</context>
`
      },
      onPermissionRequest: async (request) => {
        // Auto-approve read/write operations for file edits
        if (request.kind === 'read' || request.kind === 'write') {
          return { kind: 'approved' };
        }
        return { kind: 'approved' };
      },
    });

    // Subscribe to streaming events and capture unsubscribe function
    const unsubscribe = session.on((event) => {
      switch (event.type) {
        case 'assistant.message_delta':
          // Streaming chunk
          send({ type: 'delta', content: event.data.deltaContent });
          break;

        case 'assistant.message':
          // Final message (we already sent deltas, so just log)
          break;

        case 'tool.execution_start':
          send({ type: 'tool_start', tool: event.data.toolName });
          break;

        case 'tool.execution_complete':
          send({ type: 'tool_end', tool: event.data.toolCallId });
          break;

        case 'session.idle':
          send({ type: 'idle' });
          break;

        case 'session.error':
          send({ type: 'error', message: event.data.message });
          break;
      }
    });

    return {
      send: async (msg: { prompt: string }) => {
        try {
          await session.sendAndWait({
            prompt: msg.prompt,
          });
        } catch (err) {
          send({ type: 'error', message: (err as Error).message });
        }
      },
      destroy: async () => {
        unsubscribe();
        await session.destroy();
      }
    };
  }
}
