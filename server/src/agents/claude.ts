// server/src/agents/claude.ts
// Agent that uses Claude Agent SDK

import type { WebSocket } from 'ws';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { BaseAgent } from './base.js';
import type { AgentSession, WSOutgoingMessage } from '../types.js';

export class ClaudeCodeAgent extends BaseAgent {
  name = 'claude';
  model = 'claude-sonnet-4-20250514';

  async start(): Promise<void> {
    console.log(`✓ Claude Agent SDK initialized (model: ${this.model})`);
  }

  async stop(): Promise<void> {
    // SDK handles cleanup automatically
  }

  async createSession(ws: WebSocket, projectDir: string): Promise<AgentSession> {
    const send = (data: WSOutgoingMessage): void => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
      }
    };

    let currentSessionId: string | undefined;

    return {
      send: async (msg: { prompt: string }) => {
        try {
          const response = query({
            prompt: msg.prompt,
            options: {
              model: this.model,
              cwd: projectDir,
              permissionMode: 'acceptEdits',  // Auto-approve file edits (no interactive terminal)
              systemPrompt: `You are a UI debugging assistant. When given annotations about UI elements,
you search for the corresponding code using the selectors and HTML context provided,
then make the requested changes. Be thorough in finding the right files and making precise edits.`
            }
          });

          // Process streaming response
          for await (const message of response) {
            switch (message.type) {
              case 'system':
                if (message.subtype === 'init') {
                  currentSessionId = message.session_id;
                }
                break;

              case 'assistant':
                // Handle assistant message - extract text from BetaMessage content
                if (message.message?.content) {
                  for (const block of message.message.content) {
                    if (block.type === 'text') {
                      send({ type: 'delta', content: block.text });
                    }
                  }
                }
                break;

              case 'stream_event':
                // Handle streaming events for real-time updates
                if (message.event?.type === 'content_block_delta') {
                  const delta = message.event.delta;
                  if (delta && 'text' in delta) {
                    send({ type: 'delta', content: delta.text });
                  }
                }
                break;

              case 'tool_progress':
                // Tool is being executed
                send({ type: 'tool_start', tool: message.tool_name });
                break;

              case 'result':
                // Query completed
                send({ type: 'idle' });
                break;
            }
          }
        } catch (err) {
          send({ type: 'error', message: (err as Error).message });
        }
      },
      destroy: async () => {
        // SDK handles session cleanup automatically
      }
    };
  }
}
