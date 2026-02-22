// server/src/agents/core-adapter.ts
// Adapts @codewithdan/agent-sdk-core providers to the zingit Agent/AgentSession interface.
// This lets zingit use the shared provider implementations while keeping
// its own WS transport model (agents send directly to per-connection WebSocket).

import type { AgentSession as ZingitSession, ImageContent, WebSocketRef, WSOutgoingMessage } from '../types.js';
import type {
  AgentProvider as CoreProvider,
  AgentSession as CoreSession,
  AgentEvent,
  AgentAttachment,
} from '@codewithdan/agent-sdk-core';
import { BaseAgent } from './base.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

/**
 * Maps core AgentEvent types to zingit WSOutgoingMessage types.
 * Zingit uses a simpler event model: delta, tool_start, tool_end, idle, error.
 */
function mapCoreEventToWS(event: AgentEvent): WSOutgoingMessage | null {
  switch (event.type) {
    case 'output':
    case 'thinking':
    case 'command_output':
    case 'test_result':
      return { type: 'delta', content: event.content };
    case 'command':
    case 'file_read':
    case 'file_write':
    case 'file_edit':
    case 'tool_call':
      return { type: 'tool_start', tool: event.metadata?.command || event.content };
    case 'complete':
      return { type: 'idle' };
    case 'error':
      return { type: 'error', message: event.content };
    default:
      return null;
  }
}

/**
 * Convert zingit ImageContent[] to core AgentAttachment[].
 */
function imagesToAttachments(images?: ImageContent[]): AgentAttachment[] | undefined {
  if (!images || images.length === 0) return undefined;
  return images.map(img => ({
    type: 'base64_image' as const,
    data: img.base64,
    mediaType: img.mediaType,
    displayName: img.label,
  }));
}

/**
 * Adapter that wraps a @codewithdan/agent-sdk-core provider to match zingit's Agent interface.
 */
export class CoreProviderAdapter extends BaseAgent {
  name: string;
  model: string;
  private provider: CoreProvider;
  private started = false;

  constructor(provider: CoreProvider) {
    super();
    this.name = provider.name;
    this.model = provider.model;
    this.provider = provider;
  }

  async start(): Promise<void> {
    if (!this.started) {
      await this.provider.start();
      this.started = true;
    }
  }

  async stop(): Promise<void> {
    if (this.started) {
      await this.provider.stop();
      this.started = false;
    }
  }

  async createSession(
    wsRef: WebSocketRef,
    projectDir: string,
    resumeSessionId?: string,
  ): Promise<ZingitSession> {
    const send = (data: WSOutgoingMessage): void => {
      const ws = wsRef.current;
      if (ws && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
      }
    };

    const contextId = `zingit-${randomUUID()}`;
    const sessionTempFiles: string[] = [];

    // Build system prompt for the zingit context
    const systemPrompt = `
<context>
You are a UI debugging assistant working in the project directory: ${projectDir}

When given markers about UI elements:
1. Search for the corresponding code using the selectors and HTML context provided
2. Make the requested changes in the project at ${projectDir}
3. Be thorough in finding the right files and making precise edits

IMPORTANT: Format all responses using markdown.
</context>
`;

    const coreSession: CoreSession = await this.provider.createSession({
      contextId,
      workingDirectory: projectDir,
      systemPrompt,
      resumeSessionId: resumeSessionId || undefined,
      onEvent: (event: AgentEvent) => {
        const wsMsg = mapCoreEventToWS(event);
        if (wsMsg) send(wsMsg);
      },
    });

    return {
      send: async (msg: { prompt: string; images?: ImageContent[] }) => {
        try {
          // For the first message we use execute(), for follow-ups we use send()
          // Since zingit always calls send(), we use execute() which handles both
          const attachments = imagesToAttachments(msg.images);

          // If we have attachments that need temp files (for providers that need file paths),
          // save them now
          if (msg.images && msg.images.length > 0) {
            for (const img of msg.images) {
              const ext = img.mediaType.split('/')[1] || 'png';
              const tempPath = path.join(os.tmpdir(), `zingit-screenshot-${randomUUID()}.${ext}`);
              try {
                const buffer = Buffer.from(img.base64, 'base64');
                await fs.writeFile(tempPath, buffer, { mode: 0o600 });
                sessionTempFiles.push(tempPath);
              } catch {
                // Skip failed images
              }
            }
          }

          await coreSession.execute(msg.prompt);
        } catch (err) {
          send({ type: 'error', message: (err as Error).message });
        }
      },
      destroy: async () => {
        try {
          await coreSession.destroy();
        } finally {
          for (const tempPath of sessionTempFiles) {
            try { await fs.unlink(tempPath); } catch { /* ignore */ }
          }
          sessionTempFiles.length = 0;
        }
      },
      getSessionId: () => coreSession.sessionId,
    };
  }
}
