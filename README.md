# ZingIt

A browser-based annotation tool that lets you highlight and comment on UI elements, then send those annotations to an AI agent for automated fixes.

Visit https://danwahlin.github.io/zingit and try it out!

## Features

- **Visual Annotations**: Click any element to add notes about changes you want
- **Smart Selectors**: Automatically generates CSS selectors for targeted elements
- **AI Integration**: Supports Claude Agent SDK, GitHub Copilot SDK, and OpenAI Codex SDK
- **Streaming Responses**: Watch the AI work in real-time
- **Persistent Storage**: Annotations survive page refreshes
- **Bookmarklet Ready**: Single-file build for easy injection

## Quick Start

### 1. Install Dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 2. Start the Server

The server requires two environment variables:
- `PROJECT_DIR` - Path to the project the AI agent should work in
- `AGENT` - Which AI agent to use (`claude`, `copilot`, or `codex`)

```bash
cd server

# Using Claude Agent SDK
PROJECT_DIR=/path/to/your/project AGENT=claude npm run dev

# Using GitHub Copilot SDK
PROJECT_DIR=/path/to/your/project AGENT=copilot npm run dev

# Using OpenAI Codex SDK
PROJECT_DIR=/path/to/your/project AGENT=codex npm run dev
```

The agent will read and edit files within the specified `PROJECT_DIR`.

You can also override this per-session in the client settings (see Configuration).

### 3. Start the Client Dev Server

```bash
cd client
npm run dev
```

The browser will open automatically to `http://localhost:5200` with the demo page.

## Usage

1. **Click any element** on the page to open the annotation modal
2. **Add notes** describing the issue or change you want
3. **Repeat** for multiple elements
4. Click **"Send to Agent"** to send all annotations to the AI
5. Watch the **response panel** for the agent's work

### Keyboard Shortcuts

- `P` - Toggle annotation mode on/off
- `Escape` - Close modals/panels
- `Cmd/Ctrl + Enter` - Save annotation in modal

## Building for Production

### Bookmarklet

Build a single-file version that can be injected via bookmarklet:

```bash
cd client
npm run build
```

The `dist/zingit.iife.js` file contains everything needed. Create a bookmarklet:

```javascript
javascript:(function(){var s=document.createElement('script');s.src='http://localhost:5200/zingit.iife.js';document.body.appendChild(s);})()
```

### ES Module

For integration into existing projects:

```bash
cd client
npm run build
```

Use `dist/zingit.es.js` as an ES module.

## Configuration

Click the **gear icon** in the toolbar to open settings:

| Setting | Default | Description |
|---------|---------|-------------|
| WebSocket URL | `ws://localhost:8765` | Server connection URL |
| Project Directory | *(empty)* | Override server's default project directory. Leave empty to use server default (shown as placeholder) |
| Highlight Color | `#fbbf24` | Color of element highlight on hover |
| Marker Color | `#3b82f6` | Color of numbered annotation markers |
| Auto-connect | `true` | Connect to server on startup |

Settings are saved to localStorage.

**Project Directory Priority:**
1. Client setting (if specified) - highest priority
2. Server's `PROJECT_DIR` environment variable (required)

## Architecture

```
zingit/
├── client/                 # Browser-side Lit components
│   ├── src/
│   │   ├── components/    # Lit web components
│   │   │   ├── zing-ui.ts    # Main orchestrator
│   │   │   ├── toolbar.ts    # Status and actions
│   │   │   ├── highlight.ts  # Hover overlay
│   │   │   ├── markers.ts    # Numbered badges
│   │   │   ├── modal.ts      # Annotation form
│   │   │   ├── settings.ts   # Config panel
│   │   │   └── response.ts   # AI response display
│   │   ├── services/      # WebSocket, storage, selectors
│   │   ├── utils/         # Geometry, markdown helpers
│   │   └── types/         # TypeScript interfaces
│   └── vite.config.ts
│
└── server/                 # WebSocket server + AI agents
    └── src/
        ├── agents/
        │   ├── base.ts       # Abstract agent interface
        │   ├── claude.ts     # Claude Agent SDK integration
        │   ├── copilot.ts    # GitHub Copilot SDK integration
        │   └── codex.ts      # OpenAI Codex SDK integration
        ├── types.ts
        └── index.ts          # WebSocket server
```

## Agents

### GitHub Copilot SDK

Uses the official `@github/copilot-sdk` package. Requires:
- GitHub Copilot CLI installed and in your PATH
- Active GitHub Copilot subscription

The SDK communicates with the Copilot CLI in server mode, handling session management, streaming responses, and tool execution automatically.

```bash
# Install Copilot CLI first
gh extension install github/gh-copilot

# Then run the server
PROJECT_DIR=/path/to/your/project AGENT=copilot npm run dev
```

### Claude Agent SDK

Uses the official `@anthropic-ai/claude-agent-sdk` package. Requires:
- Claude Code installed: `npm install -g @anthropic-ai/claude-code`
- Valid Anthropic API key or Claude Max subscription

The SDK provides streaming responses with tool execution status, allowing the agent to read files, search code, and make edits.

```bash
PROJECT_DIR=/path/to/your/project AGENT=claude npm run dev
```

### OpenAI Codex SDK

Uses the official `@openai/codex-sdk` package. Requires:
- Codex CLI installed and logged in (run `codex` once to authenticate)
- Active ChatGPT Plus, Pro, Business, Edu, or Enterprise subscription

The SDK uses your cached Codex CLI credentials (`~/.codex/auth.json`) - no API key needed. Just login once via the browser flow.

```bash
# First time: login to Codex (opens browser)
npx codex

# Then run the server
PROJECT_DIR=/path/to/your/project AGENT=codex npm run dev
```

You can optionally set `CODEX_MODEL` to override the default model (gpt-5.2-codex).

## API

### WebSocket Messages

**Client → Server:**

```typescript
// Send batch of annotations
{ type: 'batch', data: { pageUrl, pageTitle, annotations, projectDir? } }

// Send follow-up message
{ type: 'message', content: '...' }

// Reset session
{ type: 'reset' }
```

Note: `projectDir` is optional. If omitted, the server uses its default (from `PROJECT_DIR` env var or cwd).

**Server → Client:**

```typescript
{ type: 'connected', agent: 'claude', model: 'claude-sonnet-4-20250514', projectDir: '/path/to/project' }
{ type: 'processing' }
{ type: 'delta', content: '...' }     // Streaming text
{ type: 'tool_start', tool: '...' }   // Tool execution started
{ type: 'tool_end' }                  // Tool execution ended
{ type: 'idle' }                      // Processing complete
{ type: 'error', message: '...' }
{ type: 'reset_complete' }
```

## Troubleshooting

### "WebSocket not connected"

1. Ensure the server is running (`npm run dev` in `/server`)
2. Check the WebSocket URL in settings
3. Check browser console for connection errors
4. Click "Reconnect" if max attempts reached

### "Claude Code CLI not found"

Install Claude Code globally:

```bash
npm install -g @anthropic-ai/claude-code
```

### Annotations not persisting

- Check if localStorage is available and not full
- Annotations are URL-specific; changing pages clears them

### Elements not highlighting

- ZingIt ignores its own elements (anything starting with `zing-`)
- Some elements may have pointer-events disabled

## Development

### Type Checking

```bash
# Client
cd client && npm run typecheck

# Server
cd server && npm run typecheck
```

### Testing

The server includes a test suite to validate agent WebSocket communication.

```bash
cd server

# Run a single test (requires server to be running)
npm run test                    # Simple scenario
npm run test -- --scenario=multi    # Multiple annotations
npm run test -- --scenario=followup # With follow-up message

# Run all agents (starts/stops server automatically)
npm run test:all               # Test all agents
npm run test:copilot           # Test only Copilot
npm run test:claude            # Test only Claude
npm run test:codex             # Test only Codex

# Dry run to see what would be tested
./tests/run-all-tests.sh --dry-run
```

The test suite uses a sample project in `tests/test-project/` with a React file for agents to modify. Test scenarios send annotated UI changes and verify the agent responds correctly.

### Project Structure

The client uses Lit 3.x web components with Shadow DOM enabled for style isolation. This is critical for the bookmarklet use case where ZingIt must not conflict with the host page's styles.

The server is a simple WebSocket relay that forwards annotation data to the configured AI agent and streams responses back.

## License

MIT
