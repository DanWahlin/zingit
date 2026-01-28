# ZingIt NPM Package - Setup Summary

## What's Been Configured

### 1. Root Package Configuration
- **File**: `package.json`
- **Package name**: `@codewithdan/zingit`
- **NPX command**: `npx @codewithdan/zingit`
- **CDN main file**: `client/dist/zingit-client.js`

### 2. CLI Entry Point
- **File**: `bin/cli.js`
- **What it does**:
  - Shows a welcome banner
  - Starts the WebSocket server on port 3000
  - Prints usage instructions
  - Handles graceful shutdown

### 3. Port Updates
Changed default ports from 8765 → 3000:
- `server/src/index.ts` - Server WebSocket port
- `client/src/services/storage.ts` - Client default URL
- `client/src/components/settings.ts` - Settings UI default

### 4. Client Build Configuration
- **File**: `client/vite.config.ts`
- **Output**: `client/dist/zingit-client.js` (IIFE bundle)
- Configured for CDN distribution with global `window.ZingIt` API

### 5. Public Client API
- **File**: `client/src/index.ts`
- **New API methods**:
  ```javascript
  ZingIt.connect('ws://localhost:3000')  // Connect to specific server
  ZingIt.init({ wsUrl: '...' })          // Initialize with options
  ZingIt.destroy()                        // Remove from page
  ZingIt.isActive()                       // Check if running
  ```
- **Auto-init options**:
  - Add `data-auto-init="true"` to script tag
  - Or add `?zingit` query parameter to URL

### 6. Demo Pages Updated
- `client/index.html` - Added `data-auto-init="true"`
- `client/demo.html` - Added `data-auto-init="true"`

## Usage Scenarios

### Scenario 1: Developer Using NPX (Primary)

```bash
# Terminal
npx @codewithdan/zingit
```

```html
<!-- Webpage -->
<script src="https://cdn.jsdelivr.net/npm/@codewithdan/zingit@latest/dist/zingit-client.js"></script>
<script>
  ZingIt.connect('ws://localhost:3000');
</script>
```

### Scenario 2: Quick Try via Query Param

```html
<script src="https://cdn.jsdelivr.net/npm/@codewithdan/zingit@latest/dist/zingit-client.js"></script>
```

Visit: `http://yoursite.com?zingit` (auto-initializes)

### Scenario 3: Custom Configuration

```html
<script src="https://cdn.jsdelivr.net/npm/@codewithdan/zingit@latest/dist/zingit-client.js"></script>
<script>
  ZingIt.init({
    wsUrl: 'ws://localhost:3000',
    highlightColor: '#ff0000',
    selectedAgent: 'copilot'
  });
</script>
```

## Before Publishing Checklist

- [ ] Run `npm install` in root, server/, and client/
- [ ] Test local dev: `npm run dev`
- [ ] Build: `npm run build`
- [ ] Test CLI: `node bin/cli.js`
- [ ] Verify client bundle exists: `client/dist/zingit-client.js`
- [ ] Verify server bundle exists: `server/dist/index.js`
- [ ] Test with npm link
- [ ] Update version: `npm version patch/minor/major`
- [ ] Publish: `npm publish --access public`
- [ ] Push tags: `git push && git push --tags`
- [ ] Verify CDN URL works (wait 5-10 min after publish)
- [ ] Update main README with new instructions

## Testing Locally

```bash
# 1. Build everything
npm run build

# 2. Test the NPX command
node bin/cli.js

# 3. In another terminal, serve a test HTML file
cd client
npx serve .

# 4. Visit http://localhost:3000 (or the serve port)
# 5. Open browser console and test:
#    - Visit page with ?zingit parameter
#    - Or manually call ZingIt.connect('ws://localhost:3000')
```

## File Structure After Build

```
@codewithdan/zingit/
├── package.json
├── bin/
│   └── cli.js ✅
├── server/
│   ├── src/
│   └── dist/
│       └── index.js ✅  (and other compiled files)
├── client/
│   ├── src/
│   └── dist/
│       └── zingit-client.js ✅
├── README.md
├── AGENTS.md
└── NPM_SETUP.md
```

## What Gets Published to npm

Only these files/directories (defined in package.json `files` field):
- `bin/`
- `server/dist/`
- `client/dist/`
- `README.md`
- `AGENTS.md`

Source code (`src/`) is NOT included - only compiled bundles.

## CDN URLs After Publishing

```
https://cdn.jsdelivr.net/npm/@codewithdan/zingit@latest/dist/zingit-client.js
https://cdn.jsdelivr.net/npm/@codewithdan/zingit@1.0.0/dist/zingit-client.js
https://unpkg.com/@codewithdan/zingit@latest/dist/zingit-client.js
```

## Next Actions

1. **Test the full workflow locally** (see "Testing Locally" above)
2. **Update main README.md** with the new installation instructions
3. **Create initial git tag**: `git tag v1.0.0`
4. **Publish to npm**: `npm publish --access public`
5. **Test the published package**: `npx @codewithdan/zingit`
6. **Verify CDN URLs** work (may take 5-10 minutes)
7. **Update homepage** with working CDN links
