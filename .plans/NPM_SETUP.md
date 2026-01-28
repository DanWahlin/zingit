# ZingIt NPM Package Setup Guide

This guide explains how to build, test, and publish the `@codewithdan/zingit` package to npm.

## Package Structure

```
@codewithdan/zingit/
├── package.json          # Root package with npm configuration
├── bin/
│   └── cli.js           # NPX entry point
├── server/
│   ├── src/             # TypeScript source
│   └── dist/            # Compiled JavaScript (gitignored, built before publish)
├── client/
│   ├── src/             # TypeScript/Lit source
│   └── dist/            # Bundled client for CDN (gitignored, built before publish)
└── README.md
```

## Development Workflow

### 1. Local Development

```bash
# Install dependencies for all workspaces
npm install
cd server && npm install
cd ../client && npm install

# Run both client and server in dev mode
npm run dev
```

This will start:
- **Client dev server** on `http://localhost:5200` (Vite with HMR)
- **Server WebSocket** on `ws://localhost:3000`

### 2. Building for Production

```bash
# Build both client and server
npm run build

# Or build individually
npm run build:client  # Creates client/dist/zingit-client.js
npm run build:server  # Creates server/dist/**/*.js
```

**What gets built:**
- `client/dist/zingit-client.js` - Single-file IIFE bundle for CDN
- `server/dist/` - Compiled TypeScript for the WebSocket server

### 3. Test the Built Package Locally

Before publishing, test that the NPX command works:

```bash
# Build first
npm run build

# Test the CLI locally (simulates npx @codewithdan/zingit)
node bin/cli.js
```

You should see the ZingIt banner and server starting on port 3000.

### 4. Test with npm link

To test the package as if it were installed from npm:

```bash
# In the zingit directory
npm link

# In another directory
npx zingit
# Or
npm link @codewithdan/zingit
zingit
```

## Publishing to npm

### First Time Setup

1. **Login to npm** (if you haven't already):
   ```bash
   npm login
   ```

2. **Verify you have access to @codewithdan org**:
   ```bash
   npm org ls @codewithdan
   ```

### Publishing Updates

1. **Update the version** in `package.json`:
   ```bash
   npm version patch  # 1.0.0 -> 1.0.1
   npm version minor  # 1.0.1 -> 1.1.0
   npm version major  # 1.1.0 -> 2.0.0
   ```

2. **Build the package**:
   ```bash
   npm run build
   ```

3. **Publish to npm**:
   ```bash
   npm publish --access public
   ```

   The `prepublishOnly` script will automatically run `npm run build` before publishing.

4. **Push the version tag to git**:
   ```bash
   git push && git push --tags
   ```

## Using the Published Package

### For Developers

Once published, users can run:

```bash
npx @codewithdan/zingit
```

This will:
1. Download the package (if not cached)
2. Start the WebSocket server on port 3000
3. Print instructions for how to use it

### For Webpages

Users add the CDN script to their HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/@codewithdan/zingit@latest/dist/zingit-client.js"></script>
<script>
  ZingIt.connect('ws://localhost:3000');
</script>
```

Or with query parameter auto-init:

```html
<!-- Just add ?zingit to the URL to activate -->
<script src="https://cdn.jsdelivr.net/npm/@codewithdan/zingit@latest/dist/zingit-client.js"></script>
```

Then visit: `http://yoursite.com?zingit`

## CDN URLs

After publishing, the client bundle is automatically available via:

- **jsDelivr** (recommended):
  ```
  https://cdn.jsdelivr.net/npm/@codewithdan/zingit@latest/dist/zingit-client.js
  https://cdn.jsdelivr.net/npm/@codewithdan/zingit@1.0.0/dist/zingit-client.js
  ```

- **unpkg**:
  ```
  https://unpkg.com/@codewithdan/zingit@latest/dist/zingit-client.js
  https://unpkg.com/@codewithdan/zingit@1.0.0/dist/zingit-client.js
  ```

## Files Included in Package

The `files` field in package.json specifies what gets published:

```json
"files": [
  "bin",
  "server/dist",
  "client/dist",
  "README.md",
  "AGENTS.md"
]
```

Source files (`src/`) are NOT included - only the built artifacts.

## Troubleshooting

### "Module not found" errors

Make sure you've run `npm run build` before publishing/testing.

### Server doesn't start

1. Check that `server/dist/index.js` exists
2. Verify the path in `bin/cli.js` is correct
3. Make sure Node.js >= 18 is installed

### Client script 404s on CDN

1. Verify the file exists in `client/dist/zingit-client.js` after build
2. Check that it's listed in the `files` array in package.json
3. Wait a few minutes after publishing (CDN cache)
4. Try clearing the CDN cache or using a specific version

### Port conflicts

The server runs on port 3000 by default. Change it via environment variable:

```bash
PORT=8080 npx @codewithdan/zingit
```

## Version History

- **1.0.0** - Initial release
  - NPX command to start server
  - CDN-ready client bundle
  - Auto-init via query param or data attribute

## Next Steps

After successful publish:

1. Update the main README.md with CDN installation instructions
2. Create a GitHub release with the version tag
3. Announce on Twitter/socials
4. Update documentation site
