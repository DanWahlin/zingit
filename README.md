# ZingIt

Streamline how you share UI changes with your AI assistant. Select elements, annotate them, and send directly to AI agents for automated fixes.

**[Try the Live Demo →](https://danwahlin.github.io/zingit)**

## Features

- **Visual Annotations** - Click any element to describe changes you want
- **Multi-Agent Support** - Works with Claude Code, GitHub Copilot CLI, and OpenAI Codex
- **Real-time Streaming** - Watch the AI work in real-time
- **Smart Selectors** - Auto-generates CSS selectors for precise targeting
- **Screenshot Capture** - Automatically capture annotated elements to provide visual context to agents

## Quick Start

### Option 1: Try the Live Demo

Visit **[danwahlin.github.io/zingit](https://danwahlin.github.io/zingit)** and follow the setup steps.

### Option 2: Clone the Repo and Run Locally

1. Clone the repo.

2. Install an AI agent (Claude Code, GitHub Copilot CLI, or OpenAI Codex).

- [Claude Code](https://github.com/anthropics/claude-code)
- [GitHub Copilot CLI](https://github.com/github/copilot-cli)
- [OpenAI Codex](https://github.com/openai/codex)

3. Start the server:

```bash
PROJECT_DIR=/path/to/your/project npx @codewithdan/zingit
```

Server runs on `ws://localhost:3000`

4. Open your web app in a browser.

```bash
cd client
npm run dev
```

5. Visit [http://localhost:5200/index.html?zingit](http://localhost:5200/index.html?zingit) to load ZingIt.

6. Select the agent to use and start annotating!

### Option 3: Add to Your Page

```html
<script src="https://cdn.jsdelivr.net/npm/@codewithdan/zingit@latest/client/dist/zingit-client.js"></script>
<script>ZingIt.connect('ws://localhost:3000');</script>
```

## Usage

1. **Press `Z`** to toggle annotation mode
2. **Click elements** to annotate them
3. **Click the sparkle icon** (✨) to send to your AI agent
4. **Watch the agent work** in the response panel

## Configuration

Click the **gear icon** for settings:

| Setting | Default | Description |
|---------|---------|-------------|
| WebSocket URL | `ws://localhost:3000` | Server connection |
| Project Directory | *(server default)* | Override project path |
| Highlight Color | `#fbbf24` | Element highlight color |
| Marker Color | `#3b82f6` | Annotation marker color |

## Architecture

```
zingit/
├── client/          # Lit web components (browser UI)
│   ├── src/components/  # UI components
│   ├── src/services/    # WebSocket, storage
│   └── dist/            # Built bundle
└── server/          # WebSocket server + AI agents
    └── src/agents/  # Claude, Copilot, Codex integrations
```

## Troubleshooting

**WebSocket not connected**
- Ensure server is running: `PROJECT_DIR=/path npx @codewithdan/zingit`
- Check WebSocket URL in settings (default: `ws://localhost:3000`)

**Agent not responding**
- Verify AI agent is installed and authenticated
- Check server logs for error messages

**Annotations not persisting**
- Annotations are URL-specific and stored in localStorage
- Changing pages clears annotations

## License

MIT

---

**Made by [Dan Wahlin](https://github.com/danwahlin)** | [Issues](https://github.com/danwahlin/zingit/issues) | [Contributing](CONTRIBUTING.md)
