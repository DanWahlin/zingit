# ZingIt - AI Agent Guide

## Project Overview

ZingIt is a browser-based annotation tool that allows users to click on webpage elements and add notes/instructions. These annotations are then sent to an AI agent (Claude Code or GitHub Copilot) which can automatically implement the requested changes.

**Use case**: Point-and-click UI feedback that gets automatically implemented by AI.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   ZingIt Client                      │    │
│  │  (Lit Web Components injected via bookmarklet)       │    │
│  └──────────────────────┬──────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────┘
                          │ WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    ZingIt Server                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ WebSocket   │───▶│   Agent     │───▶│ Claude Code │     │
│  │ Handler     │    │  Registry   │    │ or Copilot  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
zingit/
├── client/                    # Browser-side UI (Lit + Vite)
│   ├── src/
│   │   ├── components/        # Lit Web Components
│   │   │   ├── zing-ui.ts     # Main orchestrator component
│   │   │   ├── toolbar.ts     # Action buttons and status
│   │   │   ├── highlight.ts   # Element hover highlight
│   │   │   ├── markers.ts     # Numbered annotation badges
│   │   │   ├── modal.ts       # Annotation input dialog
│   │   │   ├── settings.ts    # Configuration panel
│   │   │   ├── response.ts    # Agent response display
│   │   │   ├── toast.ts       # Notification toasts
│   │   │   └── help.ts        # Keyboard shortcuts overlay
│   │   ├── services/
│   │   │   ├── selector.ts    # CSS selector generation
│   │   │   ├── storage.ts     # localStorage persistence
│   │   │   └── websocket.ts   # WebSocket client with reconnection
│   │   ├── utils/
│   │   │   ├── geometry.ts    # Viewport/rect calculations
│   │   │   └── markdown.ts    # Export formatting
│   │   ├── types/index.ts     # TypeScript interfaces
│   │   └── index.ts           # Entry point
│   ├── index.html             # Dev page
│   ├── products.html          # Test page
│   ├── about.html             # Test page
│   ├── contact.html           # Test page
│   ├── styles.css             # Shared styles for test pages
│   └── vite.config.ts         # Build config (IIFE for bookmarklet)
│
├── server/                    # Node.js WebSocket server
│   └── src/
│       ├── agents/
│       │   ├── base.ts        # Abstract base agent class
│       │   ├── claude.ts      # Claude Code CLI integration
│       │   └── copilot.ts     # GitHub Copilot SDK integration
│       ├── types.ts           # Server-side TypeScript interfaces
│       └── index.ts           # WebSocket server entry point
│
└── AGENTS.md                  # This file
```

## Tech Stack

### Client
- **Lit 3.x** - Web Components framework
- **TypeScript** - Strict mode enabled
- **Vite** - Dev server and build tool
- **Shadow DOM** - Style isolation (critical for bookmarklet injection)

### Server
- **Node.js** - Runtime
- **ws** - WebSocket library
- **tsx** - TypeScript execution
- **@anthropic-ai/claude-agent-sdk** - Claude Code integration
- **@github/copilot-sdk** - GitHub Copilot integration

## Key Concepts

### Annotations
An annotation captures:
- `selector` - CSS selector to locate the element
- `identifier` - Human-readable element description (e.g., "button.primary")
- `html` - Outer HTML of the element
- `notes` - User's instructions for changes
- `selectedText` - Any text the user had selected
- `parentContext` - Parent element path for context
- `textContent` - Plain text content

### WebSocket Messages
- **Client → Server**: `batch` (send annotations), `message` (follow-up), `reset` (clear session)
- **Server → Client**: `connected`, `processing`, `delta` (streaming), `tool_start`/`tool_end`, `idle`, `error`

### Agent System
The server uses a pluggable agent architecture:
- Set `AGENT=claude` or `AGENT=copilot` environment variable
- Agents implement `Agent` interface with `createSession()` and `formatPrompt()`
- Claude agent spawns `claude --print` CLI process
- Copilot agent uses the GitHub Copilot SDK

## Development Commands

### Client
```bash
cd client
npm install
npm run dev          # Start Vite dev server (http://localhost:5200)
npm run build        # Build for production (outputs IIFE bundle)
npm run typecheck    # Type check without emitting
npm run typecheck:watch  # Watch mode type checking
```

### Server
```bash
cd server
npm install
AGENT=claude npm run dev   # Start with Claude Code agent
AGENT=copilot npm run dev  # Start with GitHub Copilot agent
npm run typecheck          # Type check
npm run typecheck:watch    # Watch mode type checking
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `P` | Toggle annotation mode on/off |
| `Ctrl/Cmd+Z` | Undo last annotation |
| `?` | Show help overlay |
| `` ` `` | Toggle ZingIt visibility |
| `Esc` | Close current panel/modal |
| `Ctrl/Cmd+Enter` | Save annotation (in modal) |

## State Persistence

The client persists state to `localStorage`:
- `zingit_annotations` - Current page annotations (URL-scoped)
- `zingit_settings` - User preferences (wsUrl, colors, projectDir)
- `zingit_active` - Annotation mode on/off (persists across pages)

## Important Implementation Details

### Shadow DOM
All components use Shadow DOM for style isolation. This is critical because ZingIt is injected as a bookmarklet into arbitrary pages - styles must not leak in or out.

### Viewport Coordinates
The highlight and marker positioning uses viewport coordinates (not page coordinates) because the main `zing-ui` component is `position: fixed`. Use `getElementViewportRect()` from `geometry.ts`.

### WebSocket Reconnection
The WebSocket client implements exponential backoff reconnection:
- Delays: 1s, 2s, 4s, 8s, 16s, 30s (capped)
- Max 10 attempts before showing "Reconnect" button
- Call `forceReconnect()` to manually retry

### Component Communication
Components communicate via custom events that bubble through Shadow DOM:
```typescript
this.dispatchEvent(new CustomEvent('save', {
  bubbles: true,
  composed: true,  // Crosses shadow boundaries
  detail: { ... }
}));
```

## Common Tasks

### Adding a New Component
1. Create `client/src/components/my-component.ts`
2. Use `@customElement('zing-my-component')` decorator
3. Import in `zing-ui.ts`
4. Add to render method with event handlers

### Adding a New Agent
1. Create `server/src/agents/my-agent.ts`
2. Extend `BaseAgent` class
3. Implement `createSession()` method
4. Register in `server/src/index.ts` agent registry

### Modifying the Toolbar
Edit `client/src/components/toolbar.ts`:
- Add new `@property()` for state
- Add button in `render()` method
- Create handler method that dispatches event
- Wire up event in `zing-ui.ts`

## Testing

Test pages are available at:
- `http://localhost:5200/` - Main demo page
- `http://localhost:5200/products.html` - Product cards
- `http://localhost:5200/about.html` - About page with stats/timeline
- `http://localhost:5200/contact.html` - Contact form and FAQ

## Build Output

The Vite build produces:
- `dist/zingit.es.js` - ES module version
- `dist/zingit.iife.js` - IIFE for bookmarklet injection

The IIFE can be used as a bookmarklet:
```javascript
javascript:(function(){var s=document.createElement('script');s.src='http://localhost:5200/dist/zingit.iife.js';document.body.appendChild(s);})()
```
