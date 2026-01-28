// server/src/agents/copilot.ts
// Agent that uses GitHub Copilot SDK

import type { WebSocket } from 'ws';
import { CopilotClient } from '@github/copilot-sdk';
import { BaseAgent } from './base.js';
import type { AgentSession, WSOutgoingMessage, ImageContent } from '../types.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

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

When screenshots are provided, use them to:
- Better understand the visual context and styling of the elements
- Identify the exact appearance that needs to be changed
- Verify you're targeting the correct element based on its visual representation

IMPORTANT: Format all responses using markdown:
- Use **bold** for emphasis on important points
- Use numbered lists for sequential steps (1. 2. 3.)
- Use bullet points for non-sequential items
- Use code blocks with \`\`\`language syntax for code examples
- Use inline \`code\` for file paths, selectors, and technical terms
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

    // Track temp files for cleanup on session destroy (prevents race condition)
    const sessionTempFiles: string[] = [];

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
      send: async (msg: { prompt: string; images?: ImageContent[] }) => {
        try {
          // If images are provided, save them as temp files and attach them
          // Copilot SDK supports file attachments for images
          const attachments: Array<{ type: 'file'; path: string; displayName?: string }> = [];

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

              attachments.push({
                type: 'file',
                path: tempPath,
                displayName: img.label || `Screenshot ${i + 1}`
              });
            }
          }

          await session.sendAndWait({
            prompt: msg.prompt,
            attachments: attachments.length > 0 ? attachments : undefined
          });
        } catch (err) {
          send({ type: 'error', message: (err as Error).message });
        }
        // Note: Temp files cleaned up on session destroy to avoid race condition
      },
      destroy: async () => {
        try {
          unsubscribe();
          await session.destroy();
        } finally {
          // Clean up all temp files even if destroy() fails
          for (const tempPath of sessionTempFiles) {
            try {
              await fs.unlink(tempPath);
            } catch (cleanupErr) {
              // Ignore errors (file may already be deleted)
              console.warn(`ZingIt: Failed to clean up temp file ${tempPath}:`, (cleanupErr as Error).message);
            }
          }
          sessionTempFiles.length = 0; // Clear the array
        }
      }
    };
  }
}
