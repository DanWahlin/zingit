// server/src/agents/codex.ts
// Agent that uses OpenAI Codex SDK

import type { WebSocket } from 'ws';
import { Codex } from '@openai/codex-sdk';
import { BaseAgent } from './base.js';
import type { AgentSession, WSOutgoingMessage, ImageContent } from '../types.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

export class CodexAgent extends BaseAgent {
  name = 'codex';
  model: string;
  private codex: Codex | null = null;

  constructor() {
    super();
    this.model = process.env.CODEX_MODEL || 'gpt-5.2-codex';
  }

  async start(): Promise<void> {
    // Initialize the Codex client
    // Uses cached credentials from ~/.codex/auth.json (login via `codex` CLI)
    this.codex = new Codex();
    console.log(`✓ Codex SDK initialized (model: ${this.model})`);
  }

  async stop(): Promise<void> {
    // Codex SDK doesn't require explicit cleanup
    this.codex = null;
  }

  async createSession(ws: WebSocket, projectDir: string): Promise<AgentSession> {
    if (!this.codex) {
      throw new Error('Codex client not initialized');
    }

    const send = (data: WSOutgoingMessage): void => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
      }
    };

    // Start a Codex thread with the project directory
    const thread = this.codex.startThread({
      workingDirectory: projectDir,
    });

    let abortController: AbortController | null = null;

    // Track temp files for cleanup on session destroy (prevents race condition)
    const sessionTempFiles: string[] = [];

    return {
      send: async (msg: { prompt: string; images?: ImageContent[] }) => {
        try {
          abortController = new AbortController();

          // Build structured input for Codex SDK
          // Codex supports: string | Array<{ type: "text", text } | { type: "local_image", path }>
          type UserInput = { type: 'text'; text: string } | { type: 'local_image'; path: string };
          const input: UserInput[] = [];

          // If images are provided, save them as temp files and add to structured input
          if (msg.images && msg.images.length > 0) {
            const tempDir = os.tmpdir();

            for (let i = 0; i < msg.images.length; i++) {
              const img = msg.images[i];
              // Use UUID to avoid filename collisions
              const ext = img.mediaType.split('/')[1] || 'png';
              const tempPath = path.join(tempDir, `zingit-screenshot-${randomUUID()}.${ext}`);

              // Decode base64 to buffer with error handling
              let buffer: Buffer;
              try {
                buffer = Buffer.from(img.base64, 'base64');
              } catch (decodeErr) {
                console.warn(`ZingIt: Failed to decode base64 for image ${i + 1}:`, decodeErr);
                continue; // Skip this image
              }

              // Save with restrictive permissions (owner read/write only)
              await fs.writeFile(tempPath, buffer, { mode: 0o600 });
              sessionTempFiles.push(tempPath);

              // Add label text before image
              if (img.label) {
                input.push({ type: 'text', text: `[${img.label}]` });
              }
              // Add image as local_image input
              input.push({ type: 'local_image', path: tempPath });
            }
          }

          // Add the main prompt text
          input.push({ type: 'text', text: msg.prompt });

          // Use runStreamed with structured input for real-time progress
          const { events } = await thread.runStreamed(input);

          for await (const event of events) {
            // Check if aborted
            if (abortController?.signal.aborted) {
              break;
            }

            switch (event.type) {
              case 'item.started':
                // Tool/action started
                if (event.item?.type) {
                  const toolName = getToolDisplayName(event.item);
                  send({ type: 'tool_start', tool: toolName });
                }
                break;

              case 'item.completed':
                // Item completed - extract content based on type
                if (event.item) {
                  switch (event.item.type) {
                    case 'agent_message':
                      // Agent's text response
                      send({ type: 'delta', content: event.item.text + '\n' });
                      break;
                    case 'reasoning':
                      // Optional: show reasoning
                      send({ type: 'delta', content: `\n*[Reasoning]* ${event.item.text}\n` });
                      break;
                    case 'command_execution':
                      // Command was executed
                      send({ type: 'delta', content: `\n$ ${event.item.command}\n${event.item.aggregated_output}\n` });
                      break;
                    case 'file_change':
                      // Files were changed
                      const files = event.item.changes.map(c => `${c.kind}: ${c.path}`).join(', ');
                      send({ type: 'delta', content: `\n*[Files changed]* ${files}\n` });
                      break;
                  }
                  send({ type: 'tool_end', tool: event.item.type });
                }
                break;

              case 'turn.completed':
                // Turn finished
                send({ type: 'idle' });
                break;

              case 'turn.failed':
                // Turn failed with error
                send({ type: 'error', message: event.error?.message || 'Codex turn failed' });
                break;

              case 'error':
                send({ type: 'error', message: event.message || 'Unknown Codex error' });
                break;
            }
          }
        } catch (err) {
          send({ type: 'error', message: (err as Error).message });
        }
        // Note: Temp files cleaned up on session destroy to avoid race condition
      },
      destroy: async () => {
        // Abort any ongoing operation
        if (abortController) {
          abortController.abort();
          abortController = null;
        }
        // Thread cleanup happens automatically

        // Clean up all temp files after session is fully destroyed
        for (const tempPath of sessionTempFiles) {
          fs.unlink(tempPath).catch((cleanupErr) => {
            console.debug(`ZingIt: Failed to clean up temp file ${tempPath}:`, cleanupErr);
          });
        }
        sessionTempFiles.length = 0; // Clear the array
      }
    };
  }
}

// Helper to get a readable tool name
function getToolDisplayName(item: { type: string; command?: string; tool?: string }): string {
  switch (item.type) {
    case 'command_execution':
      return `Running: ${item.command?.split(' ')[0] || 'command'}`;
    case 'mcp_tool_call':
      return `Tool: ${item.tool || 'mcp'}`;
    case 'file_change':
      return 'Editing files';
    case 'web_search':
      return 'Searching web';
    case 'reasoning':
      return 'Thinking...';
    default:
      return item.type;
  }
}
