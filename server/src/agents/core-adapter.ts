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
  const content = event.content?.trim();

  switch (event.type) {
    case 'output':
      return content ? { type: 'delta', content: event.content, replace: event.metadata?.replace } : null;
    case 'thinking':
      return null;
    case 'command_output':
      return mapDiagnosticEvent(event.content, false);
    case 'test_result':
      return mapDiagnosticEvent(event.content, true);
    case 'command':
      return { type: 'tool_start', tool: formatToolStatus(event, 'Running command') };
    case 'file_read':
      return { type: 'tool_start', tool: formatToolStatus(event, 'Reading file') };
    case 'file_write':
    case 'file_edit':
      return { type: 'tool_start', tool: formatToolStatus(event, 'Updating file') };
    case 'tool_call':
      return { type: 'tool_start', tool: formatToolStatus(event, 'Using tool') };
    case 'complete':
      return { type: 'idle' };
    case 'error':
      return { type: 'error', message: event.content };
    default:
      return null;
  }
}

function createCoreEventMapper(): (event: AgentEvent) => WSOutgoingMessage | null {
  let accumulatedOutput = '';
  const diagnosticsSeen = new Set<string>();

  return (event: AgentEvent) => {
    if (event.type === 'complete' || event.type === 'error') {
      accumulatedOutput = '';
      diagnosticsSeen.clear();
    }

    const wsMsg = mapCoreEventToWS(event);

    if (wsMsg?.type === 'diagnostic') {
      const normalized = normalizeForComparison(wsMsg.content || '');
      const key = `${wsMsg.level || 'info'}:${normalized}`;
      if (!normalized || diagnosticsSeen.has(key)) return null;
      diagnosticsSeen.add(key);
      return { ...wsMsg, content: formatDiagnosticContent(wsMsg.content || '') };
    }

    if (wsMsg?.type !== 'delta') return wsMsg;

    const content = wsMsg.content || '';
    const diagnostic = classifyStandaloneDiffOutput(content);
    if (diagnostic) {
      const key = `${diagnostic.level}:${normalizeForComparison(diagnostic.content)}`;
      if (diagnosticsSeen.has(key)) return null;
      diagnosticsSeen.add(key);
      return { type: 'diagnostic', ...diagnostic };
    }

    if (isSuppressibleToolOutput(content)) return null;

    const comparableContent = normalizeForComparison(content);
    const comparableAccumulated = normalizeForComparison(accumulatedOutput);
    if (!comparableContent) return null;

    if (wsMsg.replace) {
      accumulatedOutput = content;
      return wsMsg;
    }

    if (comparableContent === comparableAccumulated || comparableAccumulated.endsWith(comparableContent)) {
      return null;
    }

    if (comparableAccumulated && comparableContent.startsWith(comparableAccumulated)) {
      const snapshotStart = content.indexOf(comparableAccumulated);
      const delta = snapshotStart >= 0
        ? content.slice(snapshotStart + comparableAccumulated.length)
        : comparableContent.slice(comparableAccumulated.length);

      accumulatedOutput = content;
      return normalizeForComparison(delta) ? { ...wsMsg, content: delta } : null;
    }

    accumulatedOutput += content;
    return wsMsg;
  };
}

function classifyStandaloneDiffOutput(content: string): { content: string; level: 'info' } | null {
  const trimmed = content.trim();
  return /^(diff --git\s|@@\s+-\d+)/.test(trimmed)
    ? { content: trimmed, level: 'info' }
    : null;
}

function mapDiagnosticEvent(content: string | undefined, alwaysInclude: boolean): WSOutgoingMessage | null {
  const trimmed = content?.trim();
  if (!trimmed || (!alwaysInclude && !isImportantCommandOutput(trimmed))) return null;

  return {
    type: 'diagnostic',
    content: trimmed,
    level: getDiagnosticLevel(trimmed),
  };
}

function isImportantCommandOutput(content: string): boolean {
  return /\b(error|failed|failure|exception|traceback|warning|warn|tests?\s+failed|failing|exit code\s+[1-9]\d*)\b/i.test(content);
}

function isSuppressibleToolOutput(content: string): boolean {
  const trimmed = content.trim();
  return /^(vite v\d|transforming\.\.\.|rendering chunks\.\.\.|computing gzip size\.\.\.|dist\/|✓ \d+ modules transformed|✓ built in \d|npm (run|notice))/m.test(trimmed);
}

function getDiagnosticLevel(content: string): 'info' | 'warning' | 'error' {
  if (/\b(error|failed|failure|exception|traceback|tests?\s+failed|failing|exit code\s+[1-9]\d*)\b/i.test(content)) {
    return 'error';
  }

  return isImportantCommandOutput(content) ? 'warning' : 'info';
}

function formatDiagnosticContent(content: string): string {
  const maxLength = 6000;
  const trimmed = content.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}\n...` : trimmed;
}

function normalizeForComparison(content: string): string {
  return content.replace(/\r\n/g, '\n').trim();
}

function formatToolStatus(event: AgentEvent, fallback: string): string {
  if (event.metadata?.file) {
    return `${fallback}: ${path.basename(event.metadata.file)}`;
  }

  const command = event.metadata?.command || event.content?.split('\n')[0]?.trim();
  if (!command) return fallback;

  if (command === 'report_intent') return 'Planning next step';

  return command.length > 80 ? `${command.slice(0, 77)}...` : command;
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
    const mapEvent = createCoreEventMapper();

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
        const wsMsg = mapEvent(event);
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

          await coreSession.execute(msg.prompt, attachments);
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
