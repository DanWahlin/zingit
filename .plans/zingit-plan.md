# ZingIt - Implementation Plan

> **Tired of typing "the submit button on the checkout page"? Just click it. ZingIt handles the rest.**

ZingIt lets you click on any element in your browser, add feedback, and send it straight to your AI coding agent. It captures the selectors, context, and structure the agent needs to find the exact code and fix it.

Works with Claude Code, GitHub Copilot, Cursor, or any AI tool that can read your codebase.

---

## Overview

A browser-based annotation tool that captures UI feedback and sends it to AI coding agents for automated fixes. Similar to [Agentation](https://agentation.dev/) but with direct agent integration.

**Technology Stack:**
- **Language:** TypeScript (client and server)
- **Client Framework:** Lit 3.x (Web Components)
- **Build Tool:** Vite (fast builds, great DX)
- **Server Runtime:** Node.js with tsx
- **Style Isolation:** Shadow DOM

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Lit Web Components (TypeScript)        │    │
│  │                                                      │    │
│  │  <zing-ui>                  (Main orchestrator)     │    │
│  │    <zing-toolbar>           (Floating toolbar)      │    │
│  │    <zing-highlight>         (Element highlight)     │    │
│  │    <zing-markers>           (Annotation markers)    │    │
│  │    <zing-modal>             (Annotation dialog)     │    │
│  │    <zing-settings>          (Settings panel)        │    │
│  │    <zing-response>          (Agent response)        │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │ WebSocket                          │
└─────────────────────────┼───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Bridge Server (Node.js + TypeScript)            │
│  WebSocket Server ──► AI Agent SDK ──► Agent CLI            │
│                                                              │
│  Supported agents:                                           │
│  • GitHub Copilot (@github/copilot-sdk)                     │
│  • Claude Agent SDK (@anthropic-ai/claude-agent-sdk)        │
│  • OpenAI Codex SDK (@openai/codex-sdk)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
zingit/
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html              # Dev entry point
│   └── src/
│       ├── index.ts            # Main entry, registers components
│       ├── components/
│       │   ├── zing-ui.ts      # Main orchestrator
│       │   ├── toolbar.ts      # <zing-toolbar>
│       │   ├── highlight.ts    # <zing-highlight>
│       │   ├── markers.ts      # <zing-markers>
│       │   ├── modal.ts        # <zing-modal>
│       │   ├── settings.ts     # <zing-settings>
│       │   └── response.ts     # <zing-response>
│       ├── services/
│       │   ├── websocket.ts    # WebSocket client
│       │   ├── storage.ts      # localStorage persistence
│       │   └── selector.ts     # Element identification
│       ├── utils/
│       │   ├── geometry.ts     # Rect intersection, etc.
│       │   └── markdown.ts     # Output generation
│       └── types/
│           └── index.ts        # Shared type definitions
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Server entry point
│       ├── server.ts           # WebSocket server
│       └── agents/
│           ├── base.ts         # Base agent interface
│           ├── copilot.ts      # GitHub Copilot SDK adapter
│           ├── claude.ts       # Claude Agent SDK adapter
│           └── codex.ts        # OpenAI Codex SDK adapter
└── README.md
```

---

## Phase 1: Project Setup

### 1.1 Server Configuration

**server/package.json**
```json
{
  "name": "zingit-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.17",
    "@github/copilot-sdk": "^0.1.16",
    "@openai/codex-sdk": "^0.89.0",
    "ws": "^8.19.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/ws": "^8.5.10",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

**server/tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.2 Client Configuration

**client/package.json**
```json
{
  "name": "zingit-client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "lit": "^3.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3",
    "vite": "^5.0.12"
  }
}
```

**client/tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**client/vite.config.ts**
```typescript
import { defineConfig, type Plugin } from 'vite';

// Plugin to inline CSS into JS bundle for single-file bookmarklet
function inlineCssPlugin(): Plugin {
  return {
    name: 'inline-css',
    generateBundle(options, bundle) {
      const cssFile = Object.keys(bundle).find(k => k.endsWith('.css'));
      const jsFile = Object.keys(bundle).find(k => k.endsWith('.iife.js'));

      if (cssFile && jsFile) {
        const cssAsset = bundle[cssFile];
        const jsChunk = bundle[jsFile];

        if (cssAsset.type === 'asset' && jsChunk.type === 'chunk') {
          // Inject CSS at runtime
          const cssContent = JSON.stringify(cssAsset.source);
          jsChunk.code = `(function(){var s=document.createElement('style');s.textContent=${cssContent};document.head.appendChild(s);})();${jsChunk.code}`;
          delete bundle[cssFile];
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [inlineCssPlugin()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ZingIt',
      fileName: (format) => `zingit.${format}.js`,
      formats: ['es', 'iife']
    },
    rollupOptions: {
      output: {
        // Bundle everything into single file for bookmarklet
        inlineDynamicImports: true,
        // Ensure no code splitting
        manualChunks: undefined
      }
    },
    // Minification for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,  // Keep console for debugging
        drop_debugger: true
      }
    },
    // No separate CSS file (handled by plugin)
    cssCodeSplit: false,
    // Target modern browsers (bookmarklet users)
    target: 'es2021',
    // Single output file
    sourcemap: false
  },
  server: {
    port: 3000
  }
});
```

**client/index.html**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ZingIt Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .card { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    button { padding: 10px 20px; border-radius: 6px; border: none; cursor: pointer; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-danger { background: #ef4444; color: white; }
    .animated { animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    kbd { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <h1>🎯 ZingIt Demo</h1>
  <p><em>Tired of typing "the submit button on the checkout page"? Just click it.</em></p>

  <div class="card">
    <h2>Quick Start</h2>
    <ol>
      <li>Start server: <code>cd server && npm run dev</code></li>
      <li>Press <kbd>S</kbd> to activate ZingIt</li>
      <li>Click any element to annotate it</li>
      <li>Press <kbd>Enter</kbd> to send to your AI agent</li>
    </ol>
  </div>

  <div class="card">
    <h2>Demo Elements</h2>
    <p>Try clicking these:</p>
    <button class="btn-primary">Submit Form</button>
    <button class="btn-danger">Delete Account</button>
  </div>

  <div class="card animated">
    <h2>Animated Element</h2>
    <p>Press <kbd>P</kbd> to pause this animation, then annotate.</p>
  </div>

  <div class="card">
    <h2>Text Selection</h2>
    <p>Select some of this text, then click to capture it as part of your annotation.</p>
  </div>

  <script type="module" src="/src/index.ts"></script>
  <zing-ui></zing-ui>
</body>
</html>
```

---

## Phase 2: Type Definitions

### 2.1 Shared Types (client/src/types/index.ts)

```typescript
// client/src/types/index.ts

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Annotation {
  id: string;
  selector: string;
  identifier: string;
  html: string;
  rect: Rect;
  selectedText: string;
  notes: string;
  timestamp: number;
}

export interface ModalData {
  element: Element;
  selector: string;
  identifier: string;
  html: string;
  rect: Rect;
  selectedText: string;
}

export interface Settings {
  outputDetail: 'compact' | 'standard' | 'detailed';
  markerColor: string;
  clearAfterCopy: boolean;
}

export interface PageInfo {
  url: string;
  title: string;
}

export interface ToolbarPosition {
  x: number;
  y: number;
}

// WebSocket message types
export type WSMessageType =
  | 'connected'
  | 'disconnected'
  | 'processing'
  | 'response'
  | 'delta'
  | 'tool_start'
  | 'tool_end'
  | 'idle'
  | 'error'
  | 'max_attempts'  // Fired when reconnection attempts exhausted
  | 'batch'
  | 'message'
  | 'reset'
  | 'reset_complete';

export interface WSMessage {
  type: WSMessageType;
  content?: string;
  message?: string;
  tool?: string;
  agent?: string;
  model?: string;
  data?: BatchData;
}

export interface BatchData {
  pageUrl: string;
  pageTitle: string;
  annotations: Annotation[];
}
```

### 2.2 Server Types (server/src/types.ts)

```typescript
// server/src/types.ts

import type { WebSocket } from 'ws';

export interface AgentSession {
  send(params: { prompt: string }): Promise<void>;
  destroy(): Promise<void>;
  on(handler: (event: AgentEvent) => void): void;
}

export interface AgentEvent {
  type: string;
  data?: {
    content?: string;
    name?: string;
    message?: string;
  };
}

export interface Agent {
  name: string;
  model?: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  createSession(ws: WebSocket): Promise<AgentSession>;
  formatPrompt(batch: BatchData): string;
}

export interface BatchData {
  pageUrl: string;
  pageTitle: string;
  annotations: Annotation[];
}

export interface Annotation {
  id: string;
  selector: string;
  identifier: string;
  html: string;
  selectedText: string;
  notes: string;
}

export interface WSIncomingMessage {
  type: 'batch' | 'message' | 'reset';
  content?: string;
  data?: BatchData;
}

export interface WSOutgoingMessage {
  type: string;
  content?: string;
  message?: string;
  tool?: string;
  agent?: string;
  model?: string;
}
```

---

## Phase 3: Server Implementation

### 3.1 Base Agent (server/src/agents/base.ts)

```typescript
// server/src/agents/base.ts

import type { WebSocket } from 'ws';
import type { Agent, AgentSession, BatchData, Annotation } from '../types.js';

export abstract class BaseAgent implements Agent {
  abstract name: string;
  abstract model?: string;

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract createSession(ws: WebSocket): Promise<AgentSession>;

  formatPrompt(batch: BatchData): string {
    let prompt = `# UI Annotations from ZingIt

**URL:** ${batch.pageUrl}
**Title:** ${batch.pageTitle}

## Annotations

`;

    batch.annotations.forEach((ann: Annotation, i: number) => {
      prompt += `### ${i + 1}. ${ann.identifier || ann.selector}
**Selector:** \`${ann.selector}\`
${ann.selectedText ? `**Selected Text:** "${ann.selectedText}"\n` : ''}
**Notes:** ${ann.notes}

\`\`\`html
${ann.html}
\`\`\`

---

`;
    });

    prompt += `\nSearch for these elements using the selectors and make the requested changes.`;
    return prompt;
  }
}
```

### 3.2 Copilot Agent (server/src/agents/copilot.ts)

```typescript
// server/src/agents/copilot.ts

import { CopilotClient } from '@github/copilot-sdk';
import type { WebSocket } from 'ws';
import { BaseAgent } from './base.js';
import type { AgentSession, WSOutgoingMessage } from '../types.js';

export class CopilotAgent extends BaseAgent {
  name = 'copilot';
  model: string;
  private client: CopilotClient | null = null;

  constructor() {
    super();
    // Available models: 'claude-opus-4.5', 'gpt-5', 'claude-sonnet-4.5'
    this.model = process.env.COPILOT_MODEL || 'claude-opus-4.5';
  }

  async start(): Promise<void> {
    this.client = new CopilotClient();
    await this.client.start();
    console.log(`✓ Copilot CLI connected (model: ${this.model})`);
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      this.client = null;
    }
  }

  async createSession(ws: WebSocket): Promise<AgentSession> {
    if (!this.client) {
      throw new Error('Copilot client not started');
    }

    try {
      const session = await this.client.createSession({
        model: this.model,
        streaming: true,
        systemMessage: {
          mode: 'append',  // Required: 'append' or 'replace'
          content: `You fix UI issues based on annotations from ZingIt.

When you receive annotations:
1. Use CSS selectors to grep/search for source files
2. Make minimal, targeted fixes
3. Explain changes briefly

You have file system access, Git, and other tools.`
        }
      });

      const send = (data: WSOutgoingMessage): void => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(data));
        }
      };

      session.on((event) => {
        switch (event.type) {
          case 'assistant.message':
            send({ type: 'response', content: event.data?.content });
            break;
          case 'assistant.message_delta':  // Fixed: was 'assistant.message.delta'
            send({ type: 'delta', content: event.data?.deltaContent });  // Fixed: deltaContent
            break;
          case 'tool.execution_start':  // Fixed: was 'tool.start'
            send({ type: 'tool_start', tool: event.data?.toolName });  // Fixed: toolName
            break;
          case 'tool.execution_end':  // Fixed: was 'tool.end'
            send({ type: 'tool_end', tool: event.data?.toolName });
            break;
          case 'session.idle':
            send({ type: 'idle' });
            break;
          case 'session.error':  // Fixed: was 'error'
            send({ type: 'error', message: event.data?.message });
            break;
        }
      });

      return session;
    } catch (err) {
      const error = err as Error;
      console.error('Failed to create Copilot session:', error.message);
      throw err;
    }
  }
}
```

### 3.2b Claude Code Agent (server/src/agents/claude.ts)

```typescript
// server/src/agents/claude.ts
// Alternative agent that uses Claude Code CLI for AI assistance

import { spawn, ChildProcess } from 'child_process';
import type { WebSocket } from 'ws';
import { BaseAgent } from './base.js';
import type { AgentSession, WSOutgoingMessage } from '../types.js';

export class ClaudeCodeAgent extends BaseAgent {
  name = 'claude';
  model = 'claude-opus-4.5';  // Default model for Claude Code
  private process: ChildProcess | null = null;

  async start(): Promise<void> {
    // Verify Claude Code CLI is installed
    try {
      const { execSync } = await import('child_process');
      execSync('claude --version', { stdio: 'pipe' });
      console.log(`✓ Claude Code CLI detected (model: ${this.model})`);
    } catch {
      throw new Error(
        'Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code'
      );
    }
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  async createSession(ws: WebSocket): Promise<AgentSession> {
    const send = (data: WSOutgoingMessage): void => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    };

    // Spawn Claude Code in non-interactive mode
    // Uses --print for single-turn interactions
    const runPrompt = async (prompt: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const args = [
          '--print',  // Non-interactive, outputs response and exits
          '--model', this.model,
          prompt
        ];

        this.process = spawn('claude', args, {
          cwd: process.cwd(),
          env: { ...process.env }
        });

        this.process.stdout?.on('data', (data: Buffer) => {
          send({ type: 'delta', content: data.toString() });
        });

        this.process.stderr?.on('data', (data: Buffer) => {
          const text = data.toString();
          // Claude Code outputs tool usage to stderr
          if (text.includes('Running')) {
            send({ type: 'tool_start', tool: text.trim() });
          } else if (text.includes('Error')) {
            send({ type: 'error', message: text.trim() });
          }
        });

        this.process.on('close', (code) => {
          send({ type: 'idle' });
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Claude Code exited with code ${code}`));
          }
        });

        this.process.on('error', (err) => {
          send({ type: 'error', message: err.message });
          reject(err);
        });
      });
    };

    return {
      send: async (msg: { prompt: string }) => {
        try {
          await runPrompt(msg.prompt);
        } catch (err) {
          send({ type: 'error', message: (err as Error).message });
        }
      },
      destroy: async () => {
        if (this.process) {
          this.process.kill();
          this.process = null;
        }
      }
    };
  }
}
```

### 3.2c OpenAI Codex Agent (server/src/agents/codex.ts)

```typescript
// server/src/agents/codex.ts
// Agent that uses OpenAI Codex SDK

import type { WebSocket } from 'ws';
import { Codex } from '@openai/codex-sdk';
import { BaseAgent } from './base.js';
import type { AgentSession, WSOutgoingMessage } from '../types.js';

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

    return {
      send: async (msg: { prompt: string }) => {
        try {
          abortController = new AbortController();
          const { events } = await thread.runStreamed(msg.prompt);

          for await (const event of events) {
            if (abortController?.signal.aborted) break;

            switch (event.type) {
              case 'item.started':
                if (event.item?.type) {
                  send({ type: 'tool_start', tool: event.item.type });
                }
                break;

              case 'item.completed':
                if (event.item) {
                  switch (event.item.type) {
                    case 'agent_message':
                      send({ type: 'delta', content: event.item.text + '\n' });
                      break;
                    case 'reasoning':
                      send({ type: 'delta', content: `\n*[Reasoning]* ${event.item.text}\n` });
                      break;
                    case 'command_execution':
                      send({ type: 'delta', content: `\n$ ${event.item.command}\n${event.item.aggregated_output}\n` });
                      break;
                    case 'file_change':
                      const files = event.item.changes.map(c => `${c.kind}: ${c.path}`).join(', ');
                      send({ type: 'delta', content: `\n*[Files changed]* ${files}\n` });
                      break;
                  }
                  send({ type: 'tool_end', tool: event.item.type });
                }
                break;

              case 'turn.completed':
                send({ type: 'idle' });
                break;

              case 'turn.failed':
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
      },
      destroy: async () => {
        if (abortController) {
          abortController.abort();
          abortController = null;
        }
      }
    };
  }
}
```

**Codex SDK Features:**
- Uses cached credentials from `~/.codex/auth.json` (no API key needed)
- Requires ChatGPT Plus, Pro, Business, Edu, or Enterprise subscription
- Streaming events via `runStreamed()` for real-time progress
- Event types: `agent_message`, `reasoning`, `command_execution`, `file_change`
- Default model: `gpt-5.2-codex` (override with `CODEX_MODEL` env var)

### 3.3 Server Entry (server/src/index.ts)

```typescript
// server/src/index.ts

import { WebSocketServer, WebSocket } from 'ws';
import { CopilotAgent } from './agents/copilot.js';
import { ClaudeCodeAgent } from './agents/claude.js';
import { CodexAgent } from './agents/codex.js';
import type { Agent, AgentSession, WSIncomingMessage, WSOutgoingMessage } from './types.js';

const PORT = parseInt(process.env.PORT || '8765', 10);
const AGENT_TYPE = process.env.AGENT || 'copilot';

// Agent registry - choose agent via AGENT env var
// AGENT=copilot npm run dev   -> Uses GitHub Copilot SDK
// AGENT=claude npm run dev    -> Uses Claude Agent SDK
// AGENT=codex npm run dev     -> Uses OpenAI Codex SDK
const agents: Record<string, new () => Agent> = {
  copilot: CopilotAgent,
  claude: ClaudeCodeAgent,
  codex: CodexAgent,
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
  console.log(`✓ ZingIt server running on ws://localhost:${PORT}`);
  console.log(`✓ Agent: ${AGENT_TYPE}`);

  // Track sessions
  const sessions = new Map<WebSocket, AgentSession>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected');
    let session: AgentSession | null = null;

    ws.on('message', async (data: Buffer) => {
      const msg: WSIncomingMessage = JSON.parse(data.toString());

      try {
        switch (msg.type) {
          case 'batch':
            if (!msg.data) break;
            
            if (!session) {
              session = await agent.createSession(ws);
              sessions.set(ws, session);
            }

            const prompt = agent.formatPrompt(msg.data);
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

    sendMessage(ws, {
      type: 'connected',
      agent: AGENT_TYPE,
      model: agent.model
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
```

---

## Phase 4: Client Services

### 4.1 Selector Service (client/src/services/selector.ts)

```typescript
// client/src/services/selector.ts

/**
 * Generate a unique CSS selector path for an element
 */
export function getSelector(el: Element): string {
  if (!el || el === document.body) return 'body';

  const path: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body) {
    let part = current.tagName.toLowerCase();

    // ID is unique - stop here
    if (current.id) {
      path.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    // Add meaningful classes
    const classes = getSemanticClasses(current);
    if (classes.length) {
      part += '.' + classes.map(c => CSS.escape(c)).join('.');
    }

    // Add nth-of-type for disambiguation
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        c => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        part += `:nth-of-type(${index})`;
      }
    }

    path.unshift(part);
    current = current.parentElement;
  }

  return path.join(' > ');
}

/**
 * Get human-readable identifier for an element
 */
export function getIdentifier(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const text = el.textContent?.trim().slice(0, 40);

  if ((tag === 'button' || tag === 'a') && text) {
    return `"${text}" ${tag === 'a' ? 'link' : 'button'}`;
  }

  if (/^h[1-6]$/.test(tag) && text) {
    return `"${text}" heading`;
  }

  const alt = el.getAttribute('alt');
  if (tag === 'img' && alt) {
    return `"${alt}" image`;
  }

  if (tag === 'input') {
    const label = el.id 
      ? document.querySelector(`label[for="${el.id}"]`)?.textContent 
      : null;
    const placeholder = el.getAttribute('placeholder');
    if (label || placeholder) {
      return `"${label || placeholder}" input`;
    }
  }

  return getSelector(el);
}

/**
 * Filter out utility classes (Tailwind, etc.)
 */
function getSemanticClasses(el: Element): string[] {
  const className = el.className;
  if (!className || typeof className !== 'string') return [];

  const utilityPatterns = [
    /^-?[pmwh][-_]?\d/,
    /^-?(min|max)[-_]/,
    /^(text|bg|border|ring)[-_]/,
    /^(flex|grid|block|inline|hidden)$/,
    /^(absolute|relative|fixed|sticky)$/,
    /^(top|right|bottom|left)[-_]/,
    /^(hover|focus|active|disabled)[:_]/,
    /^(sm|md|lg|xl|2xl):/,
    /^(space|gap)[-_]/,
    /^(rounded|shadow|opacity|z)[-_]?/,
    /^(transition|duration|ease)/,
    /^(overflow|truncate|whitespace)/,
  ];

  return className
    .split(/\s+/)
    .filter(c => c && !utilityPatterns.some(p => p.test(c)))
    .slice(0, 3);
}

/**
 * Get truncated HTML context
 */
export function getHtmlContext(el: Element, maxLength = 500): string {
  const clone = el.cloneNode(true) as Element;

  clone.querySelectorAll('*').forEach(child => {
    if (child.children.length > 2) {
      child.innerHTML = '<!-- ... -->';
    }
  });

  let html = clone.outerHTML;
  if (html.length > maxLength) {
    html = html.slice(0, maxLength) + '...';
  }
  return html;
}
```

### 4.2 Storage Service (client/src/services/storage.ts)

```typescript
// client/src/services/storage.ts

import type { Annotation, Settings, ToolbarPosition } from '../types/index.js';

const EXPIRY_DAYS = 7;
const PREFIX = 'zingit';

interface StoredAnnotations {
  annotations: Annotation[];
  expiry: number;
}

export function loadAnnotations(pathname: string): Annotation[] {
  const key = `${PREFIX}-annotations-${pathname}`;
  try {
    const data = localStorage.getItem(key);
    if (!data) return [];
    
    const parsed: StoredAnnotations = JSON.parse(data);
    if (parsed.expiry > Date.now()) {
      return parsed.annotations;
    }
    localStorage.removeItem(key);
  } catch {
    // Invalid data
  }
  return [];
}

export function saveAnnotations(pathname: string, annotations: Annotation[]): void {
  const key = `${PREFIX}-annotations-${pathname}`;
  const data: StoredAnnotations = {
    annotations,
    expiry: Date.now() + (EXPIRY_DAYS * 24 * 60 * 60 * 1000)
  };
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadSettings(): Partial<Settings> {
  try {
    const data = localStorage.getItem(`${PREFIX}-settings`);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(`${PREFIX}-settings`, JSON.stringify(settings));
}

export function loadToolbarPosition(): ToolbarPosition | null {
  try {
    const data = localStorage.getItem(`${PREFIX}-toolbar-pos`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveToolbarPosition(pos: ToolbarPosition): void {
  localStorage.setItem(`${PREFIX}-toolbar-pos`, JSON.stringify(pos));
}
```

### 4.3 WebSocket Service (client/src/services/websocket.ts)

```typescript
// client/src/services/websocket.ts

import type { Annotation, PageInfo, WSMessage, BatchData } from '../types/index.js';

type WSEventType = WSMessage['type'];

export class WebSocketService extends EventTarget {
  private url: string;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;

  // Exponential backoff configuration
  private readonly maxReconnectAttempts = 10;
  private readonly baseReconnectDelay = 1000;  // 1 second
  private readonly maxReconnectDelay = 30000;  // 30 seconds

  public connected = false;
  public agent: string | null = null;
  public maxAttemptsReached = false;  // Expose for UI to show reconnect button

  constructor(url = 'ws://localhost:8765') {
    super();
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = (): void => {
      this.connected = true;
      this.reconnectAttempts = 0;  // Reset on successful connection
      this.dispatch('connected', {});
    };

    this.ws.onclose = (): void => {
      this.connected = false;
      this.agent = null;
      this.dispatch('disconnected', {});
      this.scheduleReconnect();
    };

    this.ws.onerror = (): void => {
      this.dispatch('error', { message: 'Connection failed' });
    };

    this.ws.onmessage = (e: MessageEvent): void => {
      try {
        const msg: WSMessage = JSON.parse(e.data);

        if (msg.type === 'connected' && msg.agent) {
          this.agent = msg.agent;
        }

        this.dispatch(msg.type, msg);
      } catch {
        this.dispatch('error', { message: 'Invalid message format' });
      }
    };
  }

  disconnect(): void {
    // Clear any pending reconnection
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close WebSocket without triggering reconnect
    if (this.ws) {
      this.ws.onclose = null;  // Prevent reconnect on intentional close
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.agent = null;
    this.reconnectAttempts = 0;
  }

  send(type: string, data: Record<string, unknown> = {}): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }

  sendBatch(annotations: Annotation[], pageInfo: PageInfo): void {
    const data: BatchData = {
      pageUrl: pageInfo.url,
      pageTitle: pageInfo.title,
      annotations
    };
    this.send('batch', { data });
  }

  private scheduleReconnect(): void {
    // Stop reconnecting after max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.maxAttemptsReached = true;
      this.dispatch('max_attempts', { message: 'Max reconnection attempts reached' });
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectAttempts++;
    console.log(`WebSocket reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  // Manual reconnect - resets attempts and tries again (for UI "Reconnect" button)
  forceReconnect(): void {
    this.reconnectAttempts = 0;
    this.maxAttemptsReached = false;
    this.connect();
  }

  private dispatch(type: WSEventType, detail: Partial<WSMessage>): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
```

### 4.4 Geometry Utils (client/src/utils/geometry.ts)

```typescript
// client/src/utils/geometry.ts

import type { Rect } from '../types/index.js';

export function getRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return {
    x: Math.round(r.x),
    y: Math.round(r.y),
    width: Math.round(r.width),
    height: Math.round(r.height)
  };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export function getBoundingRect(rects: Rect[]): Rect | null {
  if (!rects.length) return null;

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

export function isElementVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}
```

### 4.5 Markdown Generator (client/src/utils/markdown.ts)

```typescript
// client/src/utils/markdown.ts

import type { Annotation, PageInfo, Settings } from '../types/index.js';

type OutputDetail = Settings['outputDetail'];

export function generateMarkdown(
  annotations: Annotation[],
  pageInfo: PageInfo,
  detail: OutputDetail = 'standard'
): string {
  let md = `# ZingIt Annotations

**URL:** ${pageInfo.url}
**Title:** ${pageInfo.title}
**Date:** ${new Date().toISOString()}

---

`;

  annotations.forEach((ann, i) => {
    md += formatAnnotation(ann, i + 1, detail);
  });

  return md;
}

function formatAnnotation(
  ann: Annotation,
  num: number,
  detail: OutputDetail
): string {
  let md = `## ${num}. ${ann.identifier || 'Element'}\n\n`;

  md += `**Selector:** \`${ann.selector}\`\n`;
  if (ann.selectedText) {
    md += `**Selected Text:** "${ann.selectedText}"\n`;
  }
  md += `**Notes:** ${ann.notes}\n\n`;

  if (detail === 'compact') {
    return md + '---\n\n';
  }

  if (ann.html) {
    md += `**HTML:**\n\`\`\`html\n${ann.html}\n\`\`\`\n\n`;
  }

  if (detail === 'standard') {
    return md + '---\n\n';
  }

  if (ann.rect) {
    md += `**Position:** x=${ann.rect.x}, y=${ann.rect.y}, `;
    md += `${ann.rect.width}×${ann.rect.height}\n\n`;
  }

  return md + '---\n\n';
}
```

---

## Phase 5: Lit Components

### 5.1 Main Component (client/src/components/zing-ui.ts)

```typescript
// client/src/components/zing-ui.ts

import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { WebSocketService } from '../services/websocket.js';
import {
  loadAnnotations,
  saveAnnotations,
  loadSettings,
  saveSettings
} from '../services/storage.js';
import { getSelector, getIdentifier, getHtmlContext } from '../services/selector.js';
import { getRect } from '../utils/geometry.js';
import { generateMarkdown } from '../utils/markdown.js';
import type { Annotation, ModalData, Settings, WSMessage } from '../types/index.js';

// Import child components
import './toolbar.js';
import './highlight.js';
import './markers.js';
import './modal.js';
import './settings.js';
import './response.js';

const DEFAULT_SETTINGS: Settings = {
  outputDetail: 'standard',
  markerColor: '#eab308',
  clearAfterCopy: false
};

@customElement('zing-ui')
export class ZingIt extends LitElement {
  @property({ type: Boolean }) active = false;
  @property({ type: Array }) annotations: Annotation[] = [];
  @property({ type: Object }) settings: Settings = DEFAULT_SETTINGS;
  @property({ type: Boolean }) markersVisible = true;
  @property({ type: Boolean }) animationsPaused = false;

  @state() private hoveredElement: Element | null = null;
  @state() private showModal = false;
  @state() private modalData: ModalData | null = null;
  @state() private showSettings = false;
  @state() private showResponse = false;
  @state() private responseContent = '';
  @state() private wsConnected = false;
  @state() private wsAgent: string | null = null;
  @state() private wsMaxAttemptsReached = false;
  @state() private processing = false;

  private ws = new WebSocketService();

  constructor() {
    super();
    this.settings = { ...DEFAULT_SETTINGS, ...loadSettings() };
    this.annotations = loadAnnotations(window.location.pathname);
    this.setupWebSocket();
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('mousemove', this.onMouseMove, true);
    document.addEventListener('click', this.onClick, true);
    document.addEventListener('keydown', this.onKeyDown, true);
  }

  disconnectedCallback(): void {
    // Critical: Remove all document-level listeners to prevent memory leaks
    document.removeEventListener('mousemove', this.onMouseMove, true);
    document.removeEventListener('click', this.onClick, true);
    document.removeEventListener('keydown', this.onKeyDown, true);

    // Disconnect WebSocket
    this.ws.disconnect();

    // Remove any injected animation pause styles
    document.getElementById('zingit-pause-animations')?.remove();

    super.disconnectedCallback();
  }

  // NOTE: We keep Shadow DOM ENABLED (default) for style isolation.
  // This is critical for bookmarklet use - prevents host page CSS conflicts.
  // Document-level event listeners work fine with Shadow DOM.
  // Child component events use composed: true to cross shadow boundaries.

  private setupWebSocket(): void {
    this.ws.addEventListener('connected', ((e: CustomEvent<WSMessage>) => {
      this.wsConnected = true;
      this.wsAgent = e.detail.agent || null;
      this.wsMaxAttemptsReached = false;  // Reset on successful connection
    }) as EventListener);

    this.ws.addEventListener('disconnected', () => {
      this.wsConnected = false;
      this.wsAgent = null;
    });

    this.ws.addEventListener('processing', () => {
      this.processing = true;
      this.showResponse = true;
      this.responseContent = '';
    });

    this.ws.addEventListener('response', ((e: CustomEvent<WSMessage>) => {
      this.responseContent += e.detail.content || '';
    }) as EventListener);

    this.ws.addEventListener('delta', ((e: CustomEvent<WSMessage>) => {
      this.responseContent += e.detail.content || '';
    }) as EventListener);

    this.ws.addEventListener('tool_start', ((e: CustomEvent<WSMessage>) => {
      this.responseContent += `\n🔧 Running ${e.detail.tool}...\n`;
    }) as EventListener);

    this.ws.addEventListener('idle', () => {
      this.processing = false;
    });

    this.ws.addEventListener('error', ((e: CustomEvent<WSMessage>) => {
      this.processing = false;
      this.responseContent += `\n❌ Error: ${e.detail.message}\n`;
    }) as EventListener);

    this.ws.addEventListener('max_attempts', () => {
      this.wsMaxAttemptsReached = true;
    });
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.active || this.showModal) return;
    const target = e.target as Element;
    if (target.closest('zing-ui')) return;
    this.hoveredElement = target;
  };

  private onClick = (e: MouseEvent): void => {
    if (!this.active || this.showModal) return;
    const target = e.target as Element;
    if (target.closest('zing-ui')) return;

    e.preventDefault();
    e.stopPropagation();

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';

    this.modalData = {
      element: target,
      selector: getSelector(target),
      identifier: getIdentifier(target),
      html: getHtmlContext(target),
      rect: getRect(target),
      selectedText
    };

    this.hoveredElement = null;
    this.showModal = true;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const active = document.activeElement;
    if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;

    if (
      e.key.toLowerCase() === 's' ||
      ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a')
    ) {
      e.preventDefault();
      this.toggleActive();
      return;
    }

    if (!this.active) return;

    switch (e.key.toLowerCase()) {
      case 'escape':
        if (this.showModal) this.showModal = false;
        else if (this.showSettings) this.showSettings = false;
        else this.active = false;
        break;
      case 'p':
        this.toggleAnimations();
        break;
      case 'h':
        this.markersVisible = !this.markersVisible;
        break;
      case 'c':
        this.copyMarkdown();
        break;
      case 'x':
        this.clearAnnotations();
        break;
      case 'enter':
        if (this.annotations.length > 0) this.sendToAgent();
        break;
    }
  };

  private toggleActive(): void {
    this.active = !this.active;
    if (this.active) this.ws.connect();
  }

  private forceReconnect(): void {
    this.wsMaxAttemptsReached = false;
    this.ws.forceReconnect();
  }

  private addAnnotation(data: ModalData & { notes: string }): void {
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      selector: data.selector,
      identifier: data.identifier,
      html: data.html,
      rect: data.rect,
      selectedText: data.selectedText,
      notes: data.notes,
      timestamp: Date.now()
    };

    this.annotations = [...this.annotations, annotation];
    saveAnnotations(window.location.pathname, this.annotations);
    this.showModal = false;
  }

  private removeAnnotation(id: string): void {
    this.annotations = this.annotations.filter(a => a.id !== id);
    saveAnnotations(window.location.pathname, this.annotations);
  }

  private clearAnnotations(): void {
    this.annotations = [];
    saveAnnotations(window.location.pathname, []);
  }

  private toggleAnimations(): void {
    this.animationsPaused = !this.animationsPaused;
    const styleId = 'zingit-pause-animations';
    let style = document.getElementById(styleId);

    if (this.animationsPaused) {
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        style.textContent =
          '*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }';
        document.head.appendChild(style);
      }
    } else {
      style?.remove();
    }
  }

  private copyMarkdown(): void {
    const md = generateMarkdown(
      this.annotations,
      { url: window.location.href, title: document.title },
      this.settings.outputDetail
    );
    navigator.clipboard.writeText(md);

    if (this.settings.clearAfterCopy) {
      this.clearAnnotations();
    }
  }

  private sendToAgent(): void {
    if (!this.wsConnected) {
      alert('Not connected to agent. Is the ZingIt server running?');
      return;
    }

    this.ws.sendBatch(this.annotations, {
      url: window.location.href,
      title: document.title
    });
  }

  private updateSettings(newSettings: Partial<Settings>): void {
    this.settings = { ...this.settings, ...newSettings };
    saveSettings(this.settings);
  }

  render() {
    return html`
      <zing-toolbar
        .active=${this.active}
        .annotationCount=${this.annotations.length}
        .wsConnected=${this.wsConnected}
        .wsAgent=${this.wsAgent}
        .wsMaxAttemptsReached=${this.wsMaxAttemptsReached}
        .processing=${this.processing}
        .animationsPaused=${this.animationsPaused}
        .markersVisible=${this.markersVisible}
        @toggle-active=${() => this.toggleActive()}
        @toggle-animations=${() => this.toggleAnimations()}
        @toggle-markers=${() => (this.markersVisible = !this.markersVisible)}
        @copy-markdown=${() => this.copyMarkdown()}
        @send-to-agent=${() => this.sendToAgent()}
        @clear-all=${() => this.clearAnnotations()}
        @open-settings=${() => (this.showSettings = true)}
        @reconnect=${() => this.forceReconnect()}
      ></zing-toolbar>

      ${this.active && this.hoveredElement
        ? html`<zing-highlight .element=${this.hoveredElement}></zing-highlight>`
        : ''}

      ${this.markersVisible
        ? html`
            <zing-markers
              .annotations=${this.annotations}
              .markerColor=${this.settings.markerColor}
              @remove-annotation=${(e: CustomEvent<{ id: string }>) =>
                this.removeAnnotation(e.detail.id)}
            ></zing-markers>
          `
        : ''}

      ${this.showModal && this.modalData
        ? html`
            <zing-modal
              .data=${this.modalData}
              @save=${(e: CustomEvent<ModalData & { notes: string }>) =>
                this.addAnnotation(e.detail)}
              @close=${() => (this.showModal = false)}
            ></zing-modal>
          `
        : ''}

      ${this.showSettings
        ? html`
            <zing-settings
              .settings=${this.settings}
              @update=${(e: CustomEvent<Partial<Settings>>) =>
                this.updateSettings(e.detail)}
              @close=${() => (this.showSettings = false)}
            ></zing-settings>
          `
        : ''}

      ${this.showResponse
        ? html`
            <zing-response
              .content=${this.responseContent}
              .processing=${this.processing}
              .agent=${this.wsAgent}
              @close=${() => (this.showResponse = false)}
            ></zing-response>
          `
        : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-ui': ZingIt;
  }
}
```

### 5.2 Entry Point (client/src/index.ts)

```typescript
// client/src/index.ts

// Import main component (which imports all children)
import './components/zing-ui.js';

// Auto-create element if not already in DOM
if (!document.querySelector('zing-ui')) {
  document.body.appendChild(document.createElement('zing-ui'));
}

console.log('🎯 ZingIt loaded. Press S to start annotating.');
```

### 5.3 Toolbar Component (client/src/components/toolbar.ts)

```typescript
// client/src/components/toolbar.ts

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('zing-toolbar')
export class ZingToolbar extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483647;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(8px);
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      color: white;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #888;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #666;
    }

    .status.connected .status-dot { background: #22c55e; }
    .status.error .status-dot { background: #ef4444; }
    .status.processing .status-dot {
      background: #3b82f6;
      animation: pulse 1s infinite;
    }

    .reconnect-btn {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid #ef4444;
      color: #fca5a5;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
    }

    .reconnect-btn:hover {
      background: rgba(239, 68, 68, 0.3);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .divider {
      width: 1px;
      height: 20px;
      background: #444;
    }

    button {
      background: transparent;
      border: none;
      color: white;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background 0.15s;
    }

    button:hover { background: rgba(255, 255, 255, 0.1); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    button.active { background: rgba(59, 130, 246, 0.3); }

    .badge {
      background: #eab308;
      color: black;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
    }

    .logo { font-weight: 600; }
  `;

  @property({ type: Boolean }) active = false;
  @property({ type: Number }) annotationCount = 0;
  @property({ type: Boolean }) wsConnected = false;
  @property({ type: String }) wsAgent: string | null = null;
  @property({ type: Boolean }) wsMaxAttemptsReached = false;
  @property({ type: Boolean }) processing = false;
  @property({ type: Boolean }) animationsPaused = false;
  @property({ type: Boolean }) markersVisible = true;

  private emit(event: string): void {
    this.dispatchEvent(new CustomEvent(event, { bubbles: true, composed: true }));
  }

  render() {
    const statusClass = this.processing ? 'processing' :
                        this.wsConnected ? 'connected' :
                        this.wsMaxAttemptsReached ? 'error' : '';

    return html`
      <div class="toolbar">
        <span class="logo">🎯 ZingIt</span>

        <div class="divider"></div>

        <div class="status ${statusClass}">
          <span class="status-dot"></span>
          ${this.processing ? 'Processing...' :
            this.wsConnected ? this.wsAgent :
            this.wsMaxAttemptsReached ? 'Connection Failed' : 'Disconnected'}
        </div>

        ${this.wsMaxAttemptsReached ? html`
          <button
            class="reconnect-btn"
            @click=${() => this.emit('reconnect')}
            title="Retry connection"
          >
            🔄 Reconnect
          </button>
        ` : ''}

        <div class="divider"></div>

        <button
          class="${this.active ? 'active' : ''}"
          @click=${() => this.emit('toggle-active')}
          title="Toggle annotation mode (S)"
        >
          ${this.active ? '🔴 Stop' : '▶️ Start'}
        </button>

        ${this.annotationCount > 0 ? html`
          <span class="badge">${this.annotationCount}</span>
        ` : ''}

        <button
          @click=${() => this.emit('toggle-animations')}
          title="Pause/resume animations (P)"
        >
          ${this.animationsPaused ? '▶️' : '⏸️'}
        </button>

        <button
          @click=${() => this.emit('toggle-markers')}
          title="Show/hide markers (H)"
        >
          ${this.markersVisible ? '👁️' : '👁️‍🗨️'}
        </button>

        <button
          @click=${() => this.emit('copy-markdown')}
          ?disabled=${this.annotationCount === 0}
          title="Copy as Markdown (C)"
        >
          📋 Copy
        </button>

        <button
          @click=${() => this.emit('send-to-agent')}
          ?disabled=${this.annotationCount === 0 || !this.wsConnected}
          title="Send to AI agent (Enter)"
        >
          🚀 Send
        </button>

        <button
          @click=${() => this.emit('clear-all')}
          ?disabled=${this.annotationCount === 0}
          title="Clear all annotations (X)"
        >
          🗑️
        </button>

        <button @click=${() => this.emit('open-settings')} title="Settings">
          ⚙️
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-toolbar': ZingToolbar;
  }
}
```

### 5.4 Highlight Component (client/src/components/highlight.ts)

```typescript
// client/src/components/highlight.ts

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { getIdentifier } from '../services/selector.js';
import type { Rect } from '../types/index.js';

@customElement('zing-highlight')
export class ZingHighlight extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 2147483646;
    }

    .highlight {
      position: absolute;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      border-radius: 4px;
      transition: all 0.1s ease-out;
    }

    .label {
      position: absolute;
      bottom: 100%;
      left: 0;
      margin-bottom: 4px;
      background: #3b82f6;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      white-space: nowrap;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
  `;

  @property({ attribute: false }) element: Element | null = null;
  @state() private rect: Rect | null = null;
  @state() private label = '';

  updated(changed: Map<string, unknown>): void {
    if (changed.has('element') && this.element) {
      const r = this.element.getBoundingClientRect();
      this.rect = {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height)
      };
      this.label = getIdentifier(this.element);
    }
  }

  render() {
    if (!this.rect) return html``;

    return html`
      <div
        class="highlight"
        style="
          left: ${this.rect.x}px;
          top: ${this.rect.y}px;
          width: ${this.rect.width}px;
          height: ${this.rect.height}px;
        "
      >
        <div class="label">${this.label}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-highlight': ZingHighlight;
  }
}
```

### 5.5 Markers Component (client/src/components/markers.ts)

```typescript
// client/src/components/markers.ts

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Annotation, Rect } from '../types/index.js';

@customElement('zing-markers')
export class ZingMarkers extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 2147483645;
    }

    .marker {
      position: absolute;
      pointer-events: auto;
      cursor: pointer;
    }

    .marker-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: black;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      transition: transform 0.15s;
    }

    .marker:hover .marker-badge {
      transform: scale(1.2);
    }

    .marker-remove {
      position: absolute;
      top: -6px;
      right: -6px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #ef4444;
      color: white;
      border: none;
      cursor: pointer;
      font-size: 10px;
      display: none;
      align-items: center;
      justify-content: center;
    }

    .marker:hover .marker-remove {
      display: flex;
    }
  `;

  @property({ type: Array }) annotations: Annotation[] = [];
  @property({ type: String }) markerColor = '#eab308';

  @state() private positions: Map<string, Rect> = new Map();

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('scroll', this.updatePositions, true);
    window.addEventListener('resize', this.updatePositions);
    this.updatePositions();
  }

  disconnectedCallback(): void {
    window.removeEventListener('scroll', this.updatePositions, true);
    window.removeEventListener('resize', this.updatePositions);
    super.disconnectedCallback();
  }

  private updatePositions = (): void => {
    const newPositions = new Map<string, Rect>();

    for (const ann of this.annotations) {
      const el = document.querySelector(ann.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        newPositions.set(ann.id, {
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.width),
          height: Math.round(r.height)
        });
      }
    }

    this.positions = newPositions;
  };

  private removeAnnotation(id: string): void {
    this.dispatchEvent(new CustomEvent('remove-annotation', {
      detail: { id },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    return html`
      ${this.annotations.map((ann, i) => {
        const pos = this.positions.get(ann.id);
        if (!pos) return html``;

        return html`
          <div
            class="marker"
            style="left: ${pos.x - 12}px; top: ${pos.y - 12}px;"
            title="${ann.notes}"
          >
            <div class="marker-badge" style="background: ${this.markerColor}">
              ${i + 1}
            </div>
            <button
              class="marker-remove"
              @click=${() => this.removeAnnotation(ann.id)}
            >
              ×
            </button>
          </div>
        `;
      })}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-markers': ZingMarkers;
  }
}
```

### 5.6 Modal Component (client/src/components/modal.ts)

```typescript
// client/src/components/modal.ts

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ModalData } from '../types/index.js';

@customElement('zing-modal')
export class ZingModal extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
    }

    .modal {
      position: relative;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow: hidden;
      font-family: system-ui, sans-serif;
    }

    .header {
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      padding: 0;
      line-height: 1;
    }

    .close-btn:hover { color: #000; }

    .content {
      padding: 20px;
      overflow-y: auto;
    }

    .element-info {
      background: #f9fafb;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
      font-size: 13px;
    }

    .element-info strong {
      color: #374151;
    }

    .element-info code {
      background: #e5e7eb;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      word-break: break-all;
    }

    .selected-text {
      margin-top: 8px;
      padding: 8px;
      background: #fef3c7;
      border-radius: 4px;
      font-style: italic;
    }

    label {
      display: block;
      font-weight: 500;
      margin-bottom: 8px;
      color: #374151;
    }

    textarea {
      width: 100%;
      min-height: 100px;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
      box-sizing: border-box;
    }

    textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .footer {
      padding: 16px 20px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    button {
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }

    .cancel-btn {
      background: white;
      border: 1px solid #d1d5db;
      color: #374151;
    }

    .cancel-btn:hover {
      background: #f9fafb;
    }

    .save-btn {
      background: #3b82f6;
      border: none;
      color: white;
    }

    .save-btn:hover {
      background: #2563eb;
    }

    .save-btn:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }
  `;

  @property({ type: Object }) data: ModalData | null = null;
  @state() private notes = '';

  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.close();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      this.save();
    }
  };

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeydown);
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this.handleKeydown);
    super.disconnectedCallback();
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private save(): void {
    if (!this.data || !this.notes.trim()) return;

    this.dispatchEvent(new CustomEvent('save', {
      detail: { ...this.data, notes: this.notes.trim() },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    if (!this.data) return html``;

    return html`
      <div class="overlay" @click=${this.close}></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="header">
          <h2 id="modal-title">Add Annotation</h2>
          <button class="close-btn" @click=${this.close} aria-label="Close">&times;</button>
        </div>

        <div class="content">
          <div class="element-info">
            <strong>${this.data.identifier}</strong><br>
            <code>${this.data.selector}</code>
            ${this.data.selectedText ? html`
              <div class="selected-text">"${this.data.selectedText}"</div>
            ` : ''}
          </div>

          <label for="notes">What should be changed?</label>
          <textarea
            id="notes"
            placeholder="Describe the issue or requested change..."
            .value=${this.notes}
            @input=${(e: InputEvent) => this.notes = (e.target as HTMLTextAreaElement).value}
            autofocus
          ></textarea>
        </div>

        <div class="footer">
          <button class="cancel-btn" @click=${this.close}>Cancel</button>
          <button
            class="save-btn"
            @click=${this.save}
            ?disabled=${!this.notes.trim()}
          >
            Save (⌘+Enter)
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-modal': ZingModal;
  }
}
```

### 5.7 Settings Component (client/src/components/settings.ts)

```typescript
// client/src/components/settings.ts

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Settings } from '../types/index.js';

@customElement('zing-settings')
export class ZingSettings extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
    }

    .panel {
      position: relative;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 90%;
      max-width: 400px;
      font-family: system-ui, sans-serif;
    }

    .header {
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header h2 {
      margin: 0;
      font-size: 18px;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
    }

    .content {
      padding: 20px;
    }

    .setting {
      margin-bottom: 20px;
    }

    .setting:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      font-weight: 500;
      margin-bottom: 8px;
      color: #374151;
    }

    select, input[type="color"] {
      width: 100%;
      padding: 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
    }

    input[type="color"] {
      height: 44px;
      cursor: pointer;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
    }

    input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }

    .description {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }
  `;

  @property({ type: Object }) settings!: Settings;

  private close(): void {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private update(key: keyof Settings, value: string | boolean): void {
    this.dispatchEvent(new CustomEvent('update', {
      detail: { [key]: value },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    return html`
      <div class="overlay" @click=${this.close}></div>
      <div class="panel">
        <div class="header">
          <h2>Settings</h2>
          <button class="close-btn" @click=${this.close}>&times;</button>
        </div>

        <div class="content">
          <div class="setting">
            <label>Output Detail</label>
            <select
              .value=${this.settings.outputDetail}
              @change=${(e: Event) =>
                this.update('outputDetail', (e.target as HTMLSelectElement).value as Settings['outputDetail'])}
            >
              <option value="compact">Compact</option>
              <option value="standard">Standard</option>
              <option value="detailed">Detailed</option>
            </select>
            <p class="description">
              Controls how much information is included when copying markdown.
            </p>
          </div>

          <div class="setting">
            <label>Marker Color</label>
            <input
              type="color"
              .value=${this.settings.markerColor}
              @change=${(e: Event) =>
                this.update('markerColor', (e.target as HTMLInputElement).value)}
            >
          </div>

          <div class="setting">
            <label class="checkbox-label">
              <input
                type="checkbox"
                .checked=${this.settings.clearAfterCopy}
                @change=${(e: Event) =>
                  this.update('clearAfterCopy', (e.target as HTMLInputElement).checked)}
              >
              Clear annotations after copying
            </label>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-settings': ZingSettings;
  }
}
```

### 5.8 Response Component (client/src/components/response.ts)

```typescript
// client/src/components/response.ts

import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

// Simple markdown-like parsing for safe rendering (no innerHTML XSS risk)
interface ContentSegment {
  type: 'text' | 'tool' | 'error' | 'code';
  content: string;
}

@customElement('zing-response')
export class ZingResponse extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      font-family: system-ui, sans-serif;
    }

    .panel {
      background: #1f2937;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
      width: 400px;
      max-height: 500px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .header {
      padding: 12px 16px;
      background: #111827;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: white;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }

    .agent-badge {
      background: #374151;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      color: #9ca3af;
    }

    .close-btn {
      background: none;
      border: none;
      color: #9ca3af;
      font-size: 20px;
      cursor: pointer;
    }

    .close-btn:hover { color: white; }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      color: #e5e7eb;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .processing {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #9ca3af;
      padding: 16px;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #374151;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error {
      color: #f87171;
    }

    .tool {
      color: #60a5fa;
    }

    code {
      background: #374151;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
    }

    pre {
      background: #111827;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
    }
  `;

  @property({ type: String }) content = '';
  @property({ type: Boolean }) processing = false;
  @property({ type: String }) agent: string | null = null;

  @query('.content') private contentEl!: HTMLElement;

  // Auto-scroll to bottom when new content arrives
  updated(changed: Map<string, unknown>): void {
    if (changed.has('content') && this.contentEl) {
      this.contentEl.scrollTop = this.contentEl.scrollHeight;
    }
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  // Parse content into segments for safe rendering (no innerHTML XSS risk)
  private parseContent(content: string): ContentSegment[] {
    const segments: ContentSegment[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.startsWith('🔧 Running ')) {
        segments.push({ type: 'tool', content: line });
      } else if (line.startsWith('❌ Error:')) {
        segments.push({ type: 'error', content: line });
      } else if (line.startsWith('```')) {
        segments.push({ type: 'code', content: line });
      } else {
        segments.push({ type: 'text', content: line });
      }
    }

    return segments;
  }

  // Render segments safely using Lit templates (no innerHTML)
  private renderContent() {
    const segments = this.parseContent(this.content);

    return segments.map(seg => {
      switch (seg.type) {
        case 'tool':
          return html`<div class="tool">${seg.content}</div>`;
        case 'error':
          return html`<div class="error">${seg.content}</div>`;
        case 'code':
          return html`<code>${seg.content}</code>`;
        default:
          return html`<div>${seg.content}</div>`;
      }
    });
  }

  render() {
    return html`
      <div class="panel">
        <div class="header">
          <div class="header-title">
            🤖 Agent Response
            ${this.agent ? html`<span class="agent-badge">${this.agent}</span>` : nothing}
          </div>
          <button class="close-btn" @click=${this.close}>&times;</button>
        </div>

        <div class="content">
          ${this.processing && !this.content ? html`
            <div class="processing">
              <div class="spinner"></div>
              Processing your annotations...
            </div>
          ` : nothing}
          ${this.renderContent()}
          ${this.processing && this.content ? html`
            <div class="spinner" style="margin-top: 8px;"></div>
          ` : nothing}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-response': ZingResponse;
  }
}
```

---

## Phase 6: Build & Distribution

### 6.1 Build Commands

```bash
# Server
cd server
npm install
npm run dev      # Development with hot reload (tsx watch)
npm run build    # Compile to dist/
npm start        # Run compiled version

# Client
cd client
npm install
npm run dev      # Vite dev server on localhost:3000
npm run build    # Build to dist/
npm run preview  # Preview production build
npm run typecheck # Type check without emitting
```

### 6.2 Bookmarklet

After building the client, the bookmarklet loads the bundled IIFE:

```javascript
// Development (Vite dev server)
javascript:(function(){if(customElements.get('zing-ui')){return}var s=document.createElement('script');s.type='module';s.src='http://localhost:3000/src/index.ts';document.head.appendChild(s)})();

// Production (built bundle)
javascript:(function(){if(customElements.get('zing-ui')){return}var s=document.createElement('script');s.src='https://your-cdn.com/zingit.iife.js';document.head.appendChild(s)})();
```

---

## Phase 7: Testing Checklist

### TypeScript
- [ ] No type errors: `npm run typecheck` passes
- [ ] Server compiles: `cd server && npm run build`
- [ ] Client compiles: `cd client && npm run build`

### Server
- [ ] Starts with `npm run dev`
- [ ] Connects to Copilot CLI
- [ ] WebSocket accepts connections
- [ ] Types are enforced at runtime boundaries

### Client
- [ ] Vite dev server starts
- [ ] Components register without errors
- [ ] Hot reload works
- [ ] Production build creates single bundle

### Integration
- [ ] Full annotation flow works
- [ ] Bookmarklet injects correctly
- [ ] Keyboard shortcuts function
- [ ] Settings persist

---

## Simplifications (Deferred)

- Multi-select mode (Shift+click)
- Area selection (Alt+drag)
- Additional agent adapters
- Configurable marker colors in settings

## Out of Scope

- Mobile support
- Iframe/Shadow DOM content
- JS-driven animations
- Multi-page persistence

---

## Implementation Order

1. **Setup** - package.json, tsconfig.json, vite.config.ts
2. **Types** - client/src/types/index.ts, server/src/types.ts
3. **Server** - agents/base.ts, agents/copilot.ts, agents/claude.ts, agents/codex.ts, index.ts
4. **Services** - selector.ts, storage.ts, websocket.ts
5. **Utils** - geometry.ts, markdown.ts
6. **Components** - toolbar → highlight → modal → markers → response → settings → zing-ui
7. **Entry** - index.ts
8. **Testing** - Full flow verification

---

## Success Criteria

1. ✅ TypeScript compiles with no errors (strict mode)
2. ✅ Server connects to Copilot CLI
3. ✅ Vite builds single-file bundle
4. ✅ Components render with proper typing
5. ✅ Hover shows element selectors
6. ✅ Click adds typed annotations
7. ✅ Copy markdown works
8. ✅ Send to agent shows streaming response
9. ✅ Bookmarklet loads bundle correctly
10. ✅ All keyboard shortcuts work

---

## Phase 8: README.md

Create `README.md` at the project root:

```markdown
# ZingIt

> Click on UI elements, describe what needs to change, and let AI fix it.

ZingIt is a browser-based annotation tool that captures UI feedback and sends it to AI coding agents for automated fixes. Stop typing "the submit button on the checkout page" — just click it.

## Quick Start

### Prerequisites

- Node.js 18+
- One of the following AI agents:
  - **GitHub Copilot** with the CLI SDK (`npm install -g @github/copilot-sdk`)
  - **Claude Code** CLI (`npm install -g @anthropic-ai/claude-code`)
  - **OpenAI Codex** CLI (run `npx codex` to login with ChatGPT subscription)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/zingit.git
cd zingit

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Starting the Server

The server bridges your browser to the AI agent. Choose your agent:

```bash
# Option 1: Use GitHub Copilot (default)
cd server
PROJECT_DIR=/path/to/your/project npm run dev

# Option 2: Use Claude Agent SDK
cd server
PROJECT_DIR=/path/to/your/project AGENT=claude npm run dev

# Option 3: Use OpenAI Codex SDK
cd server
PROJECT_DIR=/path/to/your/project AGENT=codex npm run dev
```

You should see:
```
✓ Copilot SDK initialized (model: claude-sonnet-4-20250514)
✓ ZingIt server running on ws://localhost:8765
✓ Agent: copilot
✓ Project directory: /path/to/your/project
```

### Starting the Client (Development)

In a separate terminal:

```bash
cd client
npm run dev
```

Open http://localhost:3000 to test ZingIt on the demo page.

### Using the Bookmarklet

For use on any website, create a bookmarklet:

1. Build the client: `cd client && npm run build`
2. Create a new bookmark with this URL:

**Development (while Vite is running):**
```javascript
javascript:(function(){if(customElements.get('zing-ui')){return}var s=document.createElement('script');s.type='module';s.src='http://localhost:3000/src/index.ts';document.head.appendChild(s)})();
```

**Production (after build):**
```javascript
javascript:(function(){if(customElements.get('zing-ui')){return}var s=document.createElement('script');s.src='https://your-cdn.com/zingit.iife.js';document.head.appendChild(s)})();
```

3. Navigate to any webpage and click the bookmarklet
4. Press **S** to start annotating

## How It Works

1. **Activate** — Press `S` or click the bookmarklet to enable annotation mode
2. **Hover** — Move over elements to see their CSS selectors
3. **Click** — Click an element to open the annotation dialog
4. **Describe** — Write what should change ("Make this button larger", "Fix the alignment")
5. **Send** — Press `Enter` or click Send to dispatch annotations to your AI agent
6. **Watch** — The agent receives the selectors and context, then makes the changes

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `S` | Toggle annotation mode |
| `Ctrl/Cmd+Shift+A` | Toggle annotation mode (alternative) |
| `Escape` | Close modal/settings or exit annotation mode |
| `P` | Pause/resume page animations |
| `H` | Hide/show annotation markers |
| `C` | Copy annotations as Markdown |
| `X` | Clear all annotations |
| `Enter` | Send annotations to AI agent |

## Configuration

Click the ⚙️ settings button to configure:

- **Output Detail** — Compact, Standard, or Detailed markdown output
- **Marker Color** — Color for annotation markers
- **Clear After Copy** — Auto-clear annotations after copying

Settings are persisted in localStorage.

## Agent Configuration

### GitHub Copilot

Ensure you have the Copilot CLI SDK installed and authenticated:

```bash
npm install -g @github/copilot-sdk
```

Set the model via environment variable (optional):
```bash
COPILOT_MODEL=claude-opus-4.5 npm run dev
```

### Claude Code

Ensure Claude Code CLI is installed and authenticated:

```bash
npm install -g @anthropic-ai/claude-code
```

Start with Claude:
```bash
AGENT=claude npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8765` | WebSocket server port |
| `AGENT` | `copilot` | Agent to use (`copilot` or `claude`) |
| `COPILOT_MODEL` | `claude-opus-4.5` | Model for Copilot SDK |

## Building for Production

```bash
# Build client (creates dist/zingit.iife.js)
cd client
npm run build

# Build server (creates dist/)
cd ../server
npm run build
npm start
```

## Troubleshooting

### "Not connected to agent"
- Ensure the server is running (`npm run dev` in the server directory)
- Check that port 8765 is not blocked
- Look for errors in the server terminal

### "Connection Failed" with Reconnect button
- The server may have stopped — restart it
- Click the Reconnect button to retry

### Bookmarklet doesn't load
- Check browser console for CORS errors
- Ensure Vite dev server is running for development bookmarklet
- For production, host the built bundle on a CORS-enabled CDN

### Agent not responding
- Verify the agent CLI is installed (`copilot --version` or `claude --version`)
- Check agent authentication
- Look for errors in the server terminal

## How Annotations Are Sent to the Agent

When you click "Send", ZingIt formats your annotations like this:

```
You are fixing UI issues on a webpage.

Page: Example Site
URL: https://example.com/page

---

## Annotation 1: "Submit" button

**Selector:** `#checkout > button.submit-btn`
**Notes:** Make this button larger and change color to green

**HTML Context:**
\`\`\`html
<button class="submit-btn" type="submit">Submit</button>
\`\`\`

---

Search for these elements using the selectors and make the requested changes.
```

The agent uses the CSS selectors to grep your codebase and find the relevant files.

---

## Phase 9: Implementation Learnings & Refinements

This section documents lessons learned and refinements made during actual implementation that differ from or extend the original plan.

### 9.1 CSS Consolidation

All shared CSS for test pages was consolidated into a single stylesheet:

**client/styles.css**
- Contains all shared styles for nav, cards, forms, grids, etc.
- All pages use `max-width: 1000px` for consistent layout
- HTML pages import via `<link rel="stylesheet" href="/styles.css">`

### 9.2 Toolbar Icon Buttons

The toolbar was refined to use compact SVG icons instead of text buttons to save space:

| Button | Original | Refined |
|--------|----------|---------|
| Toggle | `ON`/`OFF` with shortcut | `ON`/`OFF` button only (no hotkey shown) |
| Send | `🚀 Send` | Paper plane icon with tooltip "Send to [Agent]" |
| Undo | `Undo (Ctrl+Z)` | Undo arrow icon with tooltip "Undo" |
| Copy | `📋 Copy` | Overlapping documents icon with tooltip "Copy annotations as Markdown" |
| Clear | `🗑️` | Broom icon with tooltip "Clear all annotations" |
| Help | `❓` | Question mark circle icon (stroke-width: 2.5 for visibility) |

**Key implementation details:**
- Agent name in Send tooltip is capitalized: `this.agent.charAt(0).toUpperCase() + this.agent.slice(1)`
- Removed `.shortcut` CSS class since hotkey indicators are no longer displayed on buttons
- Hotkeys still work but are only documented in the Help dialog

### 9.3 Visibility Toggle (Hidden State)

Instead of removing the component when closed, ZingIt now hides and can be toggled back:

```typescript
// In zing-ui.ts
@state() private hidden = false;

// Render returns minimal content when hidden
if (this.hidden) {
  return html`<zing-toast></zing-toast>`;
}

// Close handler hides instead of removing
private handleClose() {
  this.hidden = true;
  this.toast.info('Press ` to show ZingIt');
}

// Backtick key toggles visibility
if (e.key === '`') {
  const target = e.target as HTMLElement;
  const tagName = target.tagName?.toLowerCase();
  const isEditable = tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
  if (!isEditable) {
    this.hidden = !this.hidden;
  }
}
```

### 9.4 Hotkey Indicators Removed from Buttons

Hotkey indicators were removed from all interactive buttons to reduce visual clutter:

**Toolbar buttons affected:**
- Toggle button: Removed `(P)` from title
- Undo button: Removed `(Ctrl/Cmd+Z)` from title
- Help button: Removed `(?)` from title

**Modal buttons affected:**
- Cancel button: Removed `<span class="shortcut">Esc</span>`
- Save button: Removed `<span class="shortcut">Cmd+Enter</span>`

Hotkeys are still functional - they're documented only in the Help dialog (`zing-help.ts`).

### 9.5 Highlight Clearing Fix

Fixed issue where highlight remained visible when pressing P to disable annotation mode:

```typescript
// In zing-ui.ts - handleToggle method clears highlight when disabling
private handleToggle() {
  this.annotationActive = !this.annotationActive;
  saveAnnotationActive(this.annotationActive);
  if (!this.annotationActive) {
    this.highlightVisible = false;  // Clear highlight when disabling
  }
}

// Keyboard P handler now calls handleToggle() instead of duplicating logic
if (e.key === 'p' || e.key === 'P') {
  if (!isEditable) {
    this.handleToggle();
  }
}
```

### 9.6 Additional Components

Two components were added that weren't in the original plan:

**zing-toast.ts** - Notification toast component
- Shows temporary messages (info, success, error)
- Auto-dismisses after timeout
- Used for feedback like "Annotation saved", "Press \` to show ZingIt"

**zing-help.ts** - Keyboard shortcuts overlay
- Shows all available keyboard shortcuts
- Organized by section: Annotation Mode, Panels, In Modal
- Opened via `?` key or Help button

### 9.7 Updated Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `P` | Toggle annotation mode on/off |
| `Ctrl/Cmd+Z` | Undo last annotation |
| `?` | Show help overlay |
| `` ` `` | Toggle ZingIt visibility (new) |
| `Esc` | Close current panel/modal |
| `Ctrl/Cmd+Enter` | Save annotation (in modal) |

### 9.8 AGENTS.md Documentation

Created `/AGENTS.md` at the project root with comprehensive documentation for AI assistants:
- Project overview and architecture diagram
- Directory structure with file descriptions
- Tech stack details
- Key concepts (annotations, WebSocket messages, agent system)
- Development commands
- Keyboard shortcuts
- State persistence details
- Important implementation notes (Shadow DOM, viewport coordinates, reconnection)
- Common task guides

### 9.9 Component Communication Pattern

All components use custom events with `bubbles: true` and `composed: true` to cross Shadow DOM boundaries:

```typescript
this.dispatchEvent(new CustomEvent('event-name', {
  bubbles: true,
  composed: true,
  detail: { /* optional data */ }
}));
```

### 9.10 SVG Icon Reference

Common SVG icons used in toolbar (16x16, stroke-width 2):

**Paper Plane (Send)**
```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <line x1="22" y1="2" x2="11" y2="13"/>
  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
</svg>
```

**Undo Arrow**
```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M3 7v6h6"/>
  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 13"/>
</svg>
```

**Copy (Overlapping Documents)**
```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="8" y="8" width="12" height="14" rx="2"/>
  <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>
</svg>
```

**Broom (Clear)**
```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M5 21h14"/>
  <path d="M12 17V3"/>
  <path d="M8 21c0-4 1.5-7 4-7s4 3 4 7"/>
  <path d="M6 21c0-5 2-9 6-9s6 4 6 9"/>
</svg>
```

**Question Mark (Help)** - stroke-width 2.5 for visibility
```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <path d="M9.5 9a2.5 2.5 0 1 1 3 2.4 1.5 1.5 0 0 0-.5 1.1v.5"/>
  <circle cx="12" cy="17" r=".5" fill="currentColor"/>
</svg>
```

### 9.11 Annotation Status Colors

Annotations now have a status that affects their marker color:

| Status | Color | When |
|--------|-------|------|
| `pending` | Blue (#3b82f6) | Default - annotation created but not sent |
| `processing` | Red (#ef4444) | After sending to agent, waiting for completion |
| `completed` | Green (#22c55e) | Agent has finished processing |

**Implementation:**

```typescript
// types/index.ts
export type AnnotationStatus = 'pending' | 'processing' | 'completed';

export interface Annotation {
  // ... other fields
  status?: AnnotationStatus;  // pending = blue (default), processing = red, completed = green
}

// markers.ts - CSS classes for status colors
.marker.pending { background: var(--marker-color, #3b82f6); }
.marker.processing { background: #ef4444; }
.marker.completed { background: #22c55e; }

// zing-ui.ts - Status transitions
// On send: pending → processing
this.annotations = this.annotations.map(a =>
  a.status !== 'completed' ? { ...a, status: 'processing' as const } : a
);

// On idle (agent complete): processing → completed
this.annotations = this.annotations.map(a =>
  a.status === 'processing' ? { ...a, status: 'completed' as const } : a
);
```

### 9.12 Property Naming: Avoiding HTMLElement Conflicts

When using Lit with `@state()` decorators, avoid property names that conflict with built-in HTMLElement properties. For example, `hidden` is a built-in property on HTMLElement.

**Problem:**
```typescript
@state() private hidden = false;  // Conflicts with HTMLElement.hidden
```

**Solution:**
```typescript
@state() private isHidden = false;  // Use alternative name
```

---

## Phase 10: Selector Disambiguation & Settings Enhancements

### 10.1 The Selector Problem

CSS selectors work for the **rendered DOM** but don't help AI agents find elements in **source files**. When multiple similar elements exist (e.g., multiple `<button>` tags), the agent can't distinguish which one to modify.

**Solution: Add positional context**

Two new functions in `selector.ts`:

```typescript
// Get position among siblings with marker
export function getSiblingContext(element: Element): string {
  // Returns:
  // Position 1 of 4 in parent:
  //   1. <h2>Example Card</h2>
  //   2. <p>This card has...</p>
  //   3. <button>Primary</button> ← THIS ONE
  //   4. <button>Secondary</button>
}

// Get parent HTML with target marked
export function getParentHtml(element: Element, maxLength = 1000): string {
  // Returns parent element HTML with target marked:
  // <div class="card">
  //   <h2>Example Card</h2>
  //   <button data-zingit-target="true">Primary</button>
  //   <button>Secondary</button>
  // </div>
}
```

**New Annotation fields:**
```typescript
interface Annotation {
  // ... existing fields
  siblingContext?: string;  // Position among siblings
  parentHtml?: string;      // Parent HTML with target marked
}
```

### 10.2 Improved Agent Prompt

The `formatPrompt()` in `base.ts` now includes:

```
## Annotation 1: button: "Primary"

**Requested Change:** Change text to "Submit"

**Target Element HTML:**
<button>Primary</button>

**Position in DOM:**
Position 3 of 4 in parent:
  1. <h2>Example Card</h2>
  2. <p>This card has...</p>
  3. <button>Primary</button> ← THIS ONE
  4. <button>Secondary</button>

**Parent Context (target marked with data-zingit-target="true"):**
<div class="card">
  <h2>Example Card</h2>
  <button data-zingit-target="true">Primary</button>
  <button class="secondary">Secondary</button>
</div>

CRITICAL INSTRUCTIONS:
1. CAREFULLY identify the CORRECT element to modify:
   - The "Position in DOM" shows which element is the target (marked with "← THIS ONE")
   - The "Parent Context" shows the element with data-zingit-target="true" - THAT is the one to change
   - Do NOT change other similar elements
```

### 10.3 Marker Attribute Constant

Extract magic string to constant with sync comments:

```typescript
// selector.ts
/**
 * Marker attribute used to identify the target element in parent HTML context.
 * IMPORTANT: Keep in sync with server/src/agents/base.ts formatPrompt()
 */
export const TARGET_MARKER_ATTR = 'data-zingit-target';
```

### 10.4 Error Handling in getParentHtml()

Added try-catch for edge cases like detached elements:

```typescript
export function getParentHtml(element: Element, maxLength = 1000): string {
  try {
    // ... implementation
  } catch {
    // Handle edge cases like detached elements or exotic DOM nodes
    return '';
  }
}
```

### 10.5 Terminal Console Icon

Added always-visible terminal icon to toolbar that toggles the response panel:

```html
<!-- Terminal/console icon -->
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <polyline points="4 17 10 11 4 5"/>
  <line x1="12" y1="19" x2="20" y2="19"/>
</svg>
```

**Implementation:**
- `responseOpen` property tracks panel state
- Button has `.active` class when panel is open
- Emits `toggle-response` event (not just `show-response`)

```css
.btn-icon.active {
  color: #3b82f6;
  background: #1e3a5f;
}
```

### 10.6 Toolbar Divider Organization

Added dividers to group related actions:

```
[ON] | Status | Count | [Send] [Terminal] | [Undo] [Copy] [Clear] | [Help] [Settings] [Close]
      ↑         ↑                          ↑                        ↑
   divider   divider                    divider                  divider
```

Groups:
- **Agent actions**: Send, Terminal console
- **Annotation actions**: Undo, Copy, Clear
- **App actions**: Help, Settings, Close

### 10.7 Customizable Status Colors

Added settings for annotation status colors:

```typescript
interface ZingSettings {
  // ... existing
  markerColor: string;       // Pending (blue #3b82f6)
  processingColor: string;   // Processing (red #ef4444)
  completedColor: string;    // Completed (green #22c55e)
}
```

**Settings UI additions:**
- Pending Color picker
- Processing Color picker
- Completed Color picker

**Markers use CSS variables:**
```css
.marker.pending { background: var(--marker-color, #3b82f6); }
.marker.processing { background: var(--processing-color, #ef4444); }
.marker.completed { background: var(--completed-color, #22c55e); }
```

### 10.8 Project Directory Default Value

Fixed Settings panel to show server's default directory as actual text (not placeholder):

```typescript
// settings.ts - Use server default when local setting is empty
.value=${this.localSettings.projectDir || this.serverProjectDir}
```

### 10.9 Client/Server Type Separation

Keep types separate between client and server - they serve different purposes:

- **Client `Annotation`**: Includes `status` for UI state (blue/red/green markers)
- **Server `Annotation`**: Wire format only, no UI state needed

This is intentional separation of concerns. Add comments noting the relationship:
```typescript
// Wire format fields - keep in sync with server/src/types.ts (excluding UI-only fields like status)
```

### 10.10 Hot Reload Strategies

For different project types:

| Project Type | Hot Reload Strategy |
|--------------|---------------------|
| Static HTML | Custom DOM swap via fetch + replace |
| Angular | Angular CLI's `ng serve` handles it |
| React | Vite/CRA dev server handles it |
| Vue | Vite dev server handles it |

**For SPA frameworks**: Don't implement custom hot reload. Let the framework's dev server handle file watching and component updates. ZingIt annotations persist in localStorage and survive reloads.

**For static HTML only**:
```javascript
async function hotReloadSelector(selector) {
  const response = await fetch(window.location.href, { cache: 'no-store' });
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const newEl = doc.querySelector(selector);
  const oldEl = document.querySelector(selector);

  if (newEl && oldEl) {
    oldEl.replaceWith(newEl.cloneNode(true));
  }
}
```

---

## Phase 11: Agent Dialog Improvements & UX Polish

### 11.1 Centered Agent Dialog

Changed response panel positioning to center over the toolbar:

```css
/* response.ts - Before */
.panel {
  position: fixed;
  bottom: 80px;
  right: 20px;
  width: 400px;
}

/* response.ts - After */
.panel {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  width: 500px;
}
```

### 11.2 Stop Button

Added red Stop button that appears during agent processing:

```typescript
// response.ts - In header
${this.processing ? html`
  <button class="stop-btn" @click=${this.handleStop}>
    <svg><!-- stop icon --></svg>
    Stop
  </button>
` : /* ... */}
```

**Stop flow:**
1. Client dispatches `stop` event from response panel
2. `zing-ui.ts` handles event, calls `ws.sendStop()`
3. `websocket.ts` sends `{ type: 'stop' }` message
4. Server receives stop, destroys agent session (kills CLI process)
5. Client reverts processing annotations back to pending

**Server types update:**
```typescript
export type WSIncomingType = 'batch' | 'message' | 'reset' | 'stop';
```

### 11.3 Refresh Button

Added green Refresh button that appears after agent completes:

```typescript
// response.ts - Shows when not processing but has content
${!this.processing && this.content ? html`
  <button class="refresh-btn" @click=${this.handleRefresh}>
    <svg><!-- refresh icon --></svg>
    Refresh
  </button>
` : ''}

private handleRefresh() {
  window.location.reload();
}
```

### 11.4 Processing Marker Animation

Added pulse animation to markers with `processing` status:

```css
/* markers.ts */
.marker.processing {
  background: var(--processing-color, #ef4444);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  50% {
    transform: scale(1.15);
    box-shadow: 0 0 12px var(--processing-color, #ef4444);
  }
}

/* Pause animation on hover for smooth scale transition */
.marker.processing:hover {
  animation-play-state: paused;
}
```

### 11.5 Completion Sound

Added optional ding sound when agent completes using Web Audio API:

**New setting:**
```typescript
interface ZingSettings {
  // ... existing
  playSoundOnComplete: boolean;  // Default: true
}
```

**Sound generation (no external audio files):**
```typescript
// zing-ui.ts
private playCompletionSound() {
  const audioContext = new AudioContext();

  const playTone = (frequency: number, startTime: number, duration: number) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    // Envelope: quick attack, gentle decay
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  };

  const now = audioContext.currentTime;
  // Two-tone ding: C6 followed by E6 (major third interval)
  playTone(1047, now, 0.15);      // C6
  playTone(1319, now + 0.1, 0.2); // E6

  setTimeout(() => audioContext.close(), 500);
}
```

**Settings UI checkbox:**
```html
<input type="checkbox" id="playSoundOnComplete"
  .checked=${this.localSettings.playSoundOnComplete}
  @change=${(e) => this.updateSetting('playSoundOnComplete', e.target.checked)}
/>
<label for="playSoundOnComplete">Play sound when agent completes</label>
```

### 11.6 Send Only Pending Annotations

Fixed batch sending to only include pending annotations (not already completed ones):

```typescript
// zing-ui.ts - handleSend()
private handleSend() {
  // Only send pending annotations (not completed ones)
  const pendingAnnotations = this.annotations.filter(a => a.status !== 'completed');
  if (pendingAnnotations.length === 0) {
    this.toast.info('No pending annotations to send');
    return;
  }

  // Mark pending as processing
  this.annotations = this.annotations.map(a =>
    a.status === 'pending' ? { ...a, status: 'processing' as const } : a
  );
  saveAnnotations(this.annotations);

  // Send only processing annotations
  const annotationsToSend = this.annotations.filter(a => a.status === 'processing');
  this.ws.sendBatch({
    pageUrl: window.location.href,
    pageTitle: document.title,
    annotations: annotationsToSend
  }, projectDir);
}
```

### 11.7 Files Modified in Phase 11

| File | Changes |
|------|---------|
| `client/src/components/response.ts` | Centered panel, Stop button, Refresh button |
| `client/src/components/markers.ts` | Pulse animation for processing status |
| `client/src/components/zing-ui.ts` | Stop handler, sound playback, send filtering |
| `client/src/components/settings.ts` | Sound toggle checkbox |
| `client/src/services/websocket.ts` | `sendStop()` method |
| `client/src/services/storage.ts` | `playSoundOnComplete` default |
| `client/src/types/index.ts` | `playSoundOnComplete` setting |
| `server/src/types.ts` | Added 'stop' to WSIncomingType |
| `server/src/index.ts` | Handle 'stop' message, destroy session |

---

## License

MIT
