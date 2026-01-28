// server/src/agents/claude.ts
// Agent that uses Claude Agent SDK

import type { WebSocket } from 'ws';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { BaseAgent } from './base.js';
import type { AgentSession, WSOutgoingMessage, ImageContent } from '../types.js';

// Content block types for Claude API multimodal support
type TextBlock = { type: 'text'; text: string };
type ImageBlock = {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
};
type ContentBlock = TextBlock | ImageBlock;

// SDK-compatible user message type
type SDKUserMessage = {
  type: 'user';
  message: {
    role: 'user';
    content: ContentBlock[];
  };
  parent_tool_use_id: string | null;
  session_id: string;
};

export class ClaudeCodeAgent extends BaseAgent {
  name = 'claude';
  model = 'claude-sonnet-4-20250514';

  async start(): Promise<void> {
    console.log(`✓ Claude Agent SDK initialized (model: ${this.model})`);
  }

  async stop(): Promise<void> {
    // SDK handles cleanup automatically
  }

  /**
   * Build content blocks for multimodal message with images and text
   */
  private buildContentBlocks(prompt: string, images?: ImageContent[]): ContentBlock[] {
    const content: ContentBlock[] = [];

    // Add images first so Claude sees them before the text instructions
    if (images && images.length > 0) {
      for (const img of images) {
        // Add label as text before each image for context
        if (img.label) {
          content.push({ type: 'text', text: `[${img.label}]` });
        }
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mediaType,
            data: img.base64
          }
        });
      }
    }

    // Add the main text prompt
    content.push({ type: 'text', text: prompt });

    return content;
  }

  /**
   * Create a generator that yields the initial user message with optional images
   */
  private async *createMessageGenerator(prompt: string, images?: ImageContent[]): AsyncGenerator<SDKUserMessage> {
    const content = this.buildContentBlocks(prompt, images);
    yield {
      type: 'user' as const,
      message: {
        role: 'user' as const,
        content
      },
      parent_tool_use_id: null,
      session_id: ''  // SDK will assign the actual session ID
    };
  }

  async createSession(ws: WebSocket, projectDir: string, resumeSessionId?: string): Promise<AgentSession> {
    const send = (data: WSOutgoingMessage): void => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
      }
    };

    // Track session ID for conversation continuity (stable V1 resume feature)
    // Start with provided sessionId if resuming previous conversation
    let sessionId: string | undefined = resumeSessionId;

    return {
      send: async (msg: { prompt: string; images?: ImageContent[] }) => {
        try {
          // Use generator function to pass multimodal content (text + images)
          const messageGenerator = this.createMessageGenerator(msg.prompt, msg.images);

          const response = query({
            prompt: messageGenerator,
            options: {
              model: this.model,
              cwd: projectDir,
              permissionMode: 'acceptEdits',  // Auto-approve file edits (no interactive terminal)
              // Resume previous session if we have a session ID (enables follow-up conversations)
              ...(sessionId && { resume: sessionId }),
              systemPrompt: `You are a UI debugging assistant. When given annotations about UI elements,
you search for the corresponding code using the selectors and HTML context provided,
then make the requested changes. Be thorough in finding the right files and making precise edits.

When screenshots are provided, use them to:
- Better understand the visual context and styling of the elements
- Identify the exact appearance that needs to be changed
- Verify you're targeting the correct element based on its visual representation

IMPORTANT: Format all responses using markdown:
- Use **bold** for emphasis on important points
- Use numbered lists for sequential steps (1. 2. 3.)
- Use bullet points for non-sequential items
- Use code blocks with \`\`\`language syntax for code examples
- Use inline \`code\` for file paths, selectors, and technical terms`
            }
          });

          // Process streaming response
          for await (const message of response) {
            switch (message.type) {
              case 'system':
                // Capture session ID from init message for follow-up conversations
                if ('subtype' in message && message.subtype === 'init') {
                  sessionId = message.session_id;
                  console.log('[Claude Agent] Session initialized:', sessionId);
                }
                break;

              case 'assistant':
                // Skip - we handle streaming via stream_event instead
                // (Full message sent at end would duplicate streaming content)
                break;

              case 'stream_event':
                // Handle streaming events for real-time updates
                if (message.event?.type === 'content_block_delta') {
                  const delta = message.event.delta;
                  if (delta && 'text' in delta) {
                    send({ type: 'delta', content: delta.text });
                  }
                } else if (message.event?.type === 'content_block_stop') {
                  console.log('[Claude Agent] Content block stopped');
                } else if (message.event?.type === 'message_stop') {
                  console.log('[Claude Agent] Message stopped');
                }
                break;

              case 'tool_progress':
                // Tool is being executed
                console.log('[Claude Agent] Tool executing:', message.tool_name);
                send({ type: 'tool_start', tool: message.tool_name });
                break;

              case 'result':
                // Query completed
                console.log('[Claude Agent] Query completed, sending idle');
                send({ type: 'idle' });
                break;
            }
          }
          console.log('[Claude Agent] Response stream ended');
        } catch (err) {
          send({ type: 'error', message: (err as Error).message });
        }
      },
      destroy: async () => {
        // SDK handles session cleanup automatically
      },
      getSessionId: () => sessionId || null
    };
  }
}
