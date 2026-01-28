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

  async createSession(wsRef: import('../types.js').WebSocketRef, projectDir: string, resumeSessionId?: string): Promise<AgentSession> {
    const send = (data: WSOutgoingMessage): void => {
      const ws = wsRef.current;
      if (ws && ws.readyState === ws.OPEN) {
        if (data.type === 'delta') {
          console.log('[Claude Agent] Sending delta, content length:', (data.content || '').length);
        }
        ws.send(JSON.stringify(data));
      } else {
        console.warn('[Claude Agent] Cannot send message, WebSocket not open. Type:', data.type, 'ReadyState:', ws?.readyState);
      }
    };

    // Track session ID for conversation continuity (stable V1 resume feature)
    // Start with provided sessionId if resuming previous conversation
    let sessionId: string | undefined = resumeSessionId;

    // Track sent content to avoid duplicates (in case SDK sends same message multiple times)
    const sentContent = new Set<string>();

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
              systemPrompt: `You are a direct, efficient UI modification assistant.

CRITICAL EFFICIENCY RULES:
1. Use the provided selector and HTML context to quickly locate the target element
2. Make the requested change immediately - don't explore or explain unless there's ambiguity
3. For simple changes (text, styles, attributes), be concise - just do it and confirm
4. Only search/explore if the selector doesn't match or you need to understand complex context
5. Avoid explaining what annotations are or describing the codebase unnecessarily

WHEN TO BE BRIEF (90% of cases):
- Text changes: Find, change, confirm (1-2 sentences)
- Style changes: Find, modify CSS, confirm
- Simple DOM changes: Make the change, state what you did

WHEN TO BE THOROUGH (10% of cases):
- Ambiguous selectors (multiple matches)
- Complex architectural changes
- Need to understand component interactions

Response format:
- **Action taken:** Brief statement of what changed
- **File:** Path to modified file
- **Summary:** 1-2 sentence confirmation

Use screenshots to verify you're targeting the right element, but don't over-explain their purpose.`
            }
          });

          // Process streaming response
          for await (const message of response) {
            // Log ALL message types for debugging
            console.log('[Claude Agent] Message received:', message.type,
              message.type === 'stream_event' ? `event: ${message.event?.type}` : '');

            switch (message.type) {
              case 'system':
                // Capture session ID from init message for follow-up conversations
                if ('subtype' in message && message.subtype === 'init') {
                  sessionId = message.session_id;
                  console.log('[Claude Agent] Session initialized:', sessionId);
                }
                break;

              case 'assistant':
                // Extract text content from assistant messages
                // Content is nested in message.content, not directly in content
                if ('message' in message && message.message && 'content' in message.message) {
                  const content = message.message.content;
                  if (Array.isArray(content)) {
                    for (const block of content) {
                      if (block.type === 'text' && block.text) {
                        // Use content hash to avoid sending duplicates (SDK may replay conversation history)
                        const contentHash = `${block.text.substring(0, 100)}_${block.text.length}`;
                        if (!sentContent.has(contentHash)) {
                          sentContent.add(contentHash);
                          console.log('[Claude Agent] Sending assistant text, length:', block.text.length);
                          send({ type: 'delta', content: block.text });
                        } else {
                          console.log('[Claude Agent] Skipping duplicate assistant text');
                        }
                      }
                    }
                  }
                }
                break;

              case 'stream_event':
                // Handle streaming events for real-time updates
                if (message.event?.type === 'content_block_delta') {
                  const delta = message.event.delta;
                  if (delta && 'text' in delta) {
                    console.log('[Claude Agent] Content block delta, text length:', delta.text.length);
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
