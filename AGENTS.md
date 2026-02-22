# ZingIt - AI Agent Guide

## Project Overview

ZingIt is a browser-based marker tool that allows users to click on webpage elements and add notes/instructions. These markers are then sent to an AI agent (Claude Code, GitHub Copilot CLI, or OpenAI Codex) which can automatically implement the requested changes.

**Use case**: Point-and-click UI feedback that gets automatically implemented by AI.

**Key Features**:
- Visual element selection with marking
- Multi-agent support (Claude, Copilot, Codex)
- Automatic screenshot capture
- Change history tracking
- Remote/local URL detection with warnings
- Keyboard shortcuts for fast workflow

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   ZingIt Client                      │    │
│  │  (Lit Web Components - ?zingit URL parameter)        │    │
│  └──────────────────────┬──────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────┘
                          │ WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    ZingIt Server                             │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐    │
│  │ WebSocket   │───▶│   Agent     │───▶│ Claude Code  │    │
│  │ Handler     │    │  Registry   │    │   Copilot    │    │
│  │             │    │             │    │    Codex     │    │
│  └─────────────┘    └─────────────┘    └──────────────┘    │
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
│   │   │   ├── markers.ts     # Numbered marker badges
│   │   │   ├── modal.ts       # Marker input dialog
│   │   │   ├── settings.ts    # Configuration panel
│   │   │   ├── response.ts    # Agent response display
│   │   │   ├── toast.ts       # Notification toasts
│   │   │   ├── help.ts        # Keyboard shortcuts overlay
│   │   │   ├── history.ts     # Change history panel
│   │   │   ├── site-header.ts # Demo site navigation
│   │   │   └── site-footer.ts # Demo site footer
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
│   ├── deploy/                # Build output for GitHub Pages
│   │   ├── index.html         # Static version of demo site
│   │   └── styles.css         # Copied styles
│   ├── scripts/
│   │   └── prepare-deploy.js  # Prepares deploy folder
│   └── vite.config.ts         # Build config
│
├── server/                    # Node.js WebSocket server
│   └── src/
│       ├── agents/
│       │   ├── base.ts        # Abstract base agent class
│       │   ├── claude.ts      # Claude Code CLI integration
│       │   ├── copilot.ts     # GitHub Copilot SDK integration
│       │   └── codex.ts       # OpenAI Codex integration
│       ├── handlers/
│       │   └── messageHandlers.ts  # WebSocket message handlers
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
- **Node.js** - Runtime (>=22.0.0)
- **ws** - WebSocket library
- **tsx** - TypeScript execution
- **@anthropic-ai/claude-agent-sdk** - Claude Code integration
- **@github/copilot-sdk** - GitHub Copilot integration
- **@openai/codex-sdk** - OpenAI Codex integration

## Key Concepts

### Markers
A marker captures:
- `selector` - CSS selector to locate the element
- `identifier` - Human-readable element description (e.g., "button.primary")
- `html` - Outer HTML of the element
- `notes` - User's instructions for changes
- `selectedText` - Any text the user had selected
- `parentContext` - Parent element path for context
- `textContent` - Plain text content

### Change History
The history component tracks all changes made by the AI agent:
- Displays a chronological list of modifications
- Shows file paths and change summaries
- Allows users to review what was changed
- Accessible via the clock icon in the toolbar

### WebSocket Messages
- **Client → Server**: `batch` (send markers), `message` (follow-up), `reset` (clear session)
- **Server → Client**: `connected`, `processing`, `delta` (streaming), `tool_start`/`tool_end`, `idle`, `error`

### Agent System
The server uses a pluggable agent architecture:
- Set `AGENT=claude`, `AGENT=copilot`, or `AGENT=codex` environment variable
- Agents implement `Agent` interface with `createSession()` and `formatPrompt()`
- Claude agent spawns `claude --print` CLI process
- Copilot agent uses the GitHub Copilot SDK
- Codex agent uses the OpenAI Codex SDK

## Development Commands

This project uses [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces). A single `npm install` at the root installs all dependencies for both client and server.

```bash
npm install          # Install all dependencies (run from root)
npm run dev          # Start both server and client concurrently
npm run build        # Build both client and server
npm run test         # Run client unit tests
```

### Client
```bash
npm run dev -w client          # Start Vite dev server (http://localhost:5200)
npm run build -w client        # Build for production
npm run deploy -w client       # Prepare and deploy to GitHub Pages
npm run typecheck -w client    # Type check without emitting
```

**Note**: The deploy script (`npm run deploy`) runs `prepare-deploy.js` which copies files to the `deploy/` folder, then uses `gh-pages` to publish to GitHub Pages.

### Server
```bash
npx cross-env AGENT=claude npm run dev -w server   # Start with Claude Code agent
npx cross-env AGENT=copilot npm run dev -w server  # Start with GitHub Copilot agent
npx cross-env AGENT=codex npm run dev -w server    # Start with OpenAI Codex agent
npm run typecheck -w server                         # Type check
```

### Running the Published Package
```bash
# For external users
npx cross-env PROJECT_DIR=/path/to/your/project npx @codewithdan/zingit
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Z` | Toggle marker mode on/off |
| `Ctrl/Cmd+Z` | Undo last marker |
| `?` | Show help overlay |
| `` ` `` | Toggle ZingIt visibility |
| `Esc` | Close current panel/modal |
| `Ctrl/Cmd+Enter` | Save marker (in modal) |

## State Persistence

The client persists state to `localStorage`:
- `zingit_markers` - Current page markers (URL-scoped)
- `zingit_settings` - User preferences (wsUrl, colors, projectDir)
- `zingit_active` - Marker mode on/off (persists across pages)

## Important Implementation Details

### Remote URL Detection
ZingIt detects when you're editing a published/remote site versus local development:
- **Local** (localhost, 127.0.0.1, etc.) - Changes appear immediately on refresh
- **Remote** (published sites) - Shows warning toast that changes are saved locally only
- Badge displayed in toolbar: "💻 Local" or "🌐 Remote"
- Warning can be dismissed but persists until user understands the limitation

### Shadow DOM
All components use Shadow DOM for style isolation. This is critical because ZingIt is injected into arbitrary pages - styles must not leak in or out.

### Viewport Coordinates
The highlight and marker positioning uses viewport coordinates (not page coordinates) because the main `zing-ui` component is `position: fixed`. Use `getElementViewportRect()` from `geometry.ts`.

### WebSocket Reconnection
The WebSocket client implements exponential backoff reconnection:
- Delays: 1s, 2s, 4s, 8s, 16s, 30s (capped)
- Max 10 attempts before showing "Reconnect" button
- Call `forceReconnect()` to manually retry

### Toast Notifications
The toast system supports multiple types with different styling:
- **success** - Green background for successful operations
- **error** - Red background for failures
- **info** - Dark gray with subtle border
- **warning** - Dark gray with orange left border (for remote URL warnings)

Persistent toasts (duration=0) show a close button in the top-right corner.

### Component Communication
Components communicate via custom events that bubble through Shadow DOM:
```typescript
this.dispatchEvent(new CustomEvent('save', {
  bubbles: true,
  composed: true,  // Crosses shadow boundaries
  detail: { ... }
}));
```

### Server Logging
Request boundaries are logged for debugging:
```
[Batch] ===== Request started =====
[Batch] Prompt preview: Change the background color to blue...
[Batch] Image count: 2
... processing logs ...
[Batch] ===== Request completed =====
```

This makes it easy to track multiple concurrent requests and debug issues.

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

**Note**: Icons use SVG (not emoticons) for professional appearance and better rendering across platforms. The local/remote badge uses inline SVG icons with `currentColor` for theming.

## Testing

### Demo Site
The main demo site (`client/index.html`) showcases ZingIt with:
- Hero section with features
- Installation instructions
- Toolbar icon reference table
- Try it with demo section
- Try it with your website section

### Test Pages
Additional test pages are available:
- `http://localhost:5200/products.html` - Product cards
- `http://localhost:5200/about.html` - About page with stats/timeline
- `http://localhost:5200/contact.html` - Contact form and FAQ

Add `?zingit` to any URL to activate the marker tool.

## Build Output

The Vite build produces:
- `dist/zingit-client.js` - Bundled client code

Published to npm as `@codewithdan/zingit` and available via CDN:
```html
<script src="https://cdn.jsdelivr.net/npm/@codewithdan/zingit@latest/dist/zingit-client.js"></script>
```

Users activate ZingIt by adding `?zingit` to any URL: `http://localhost:5200/?zingit`

## GitHub Actions Workflow

Automated release and deployment on commits starting with "release:":
1. Runs `npm run release` - versions, builds, and publishes to npm
2. Runs `npm run deploy` - deploys demo site to GitHub Pages

**Setup Requirements:**
- `NPM_TOKEN` secret in repository settings (for npm publishing)
- `GITHUB_TOKEN` is automatically provided by GitHub Actions (for gh-pages deployment)

**Authentication:**
The workflow configures git with an authenticated remote URL before deploying:
```bash
git remote set-url origin https://x-access-token:$GITHUB_TOKEN@github.com/${{ github.repository }}.git
```

This allows `gh-pages` to push to the repository without prompting for credentials.

**Workflow File:** `.github/workflows/release.yml`
