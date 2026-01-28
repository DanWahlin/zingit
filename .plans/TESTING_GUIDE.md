# ZingIt - Local Testing Guide

This guide walks you through testing the complete NPX + CDN workflow locally before publishing to npm.

## Prerequisites

- Node.js >= 18
- npm >= 9

## Step-by-Step Testing

### 1. Install Dependencies

```bash
# Root
npm install

# Server
cd server
npm install
cd ..

# Client
cd client
npm install
cd ..
```

### 2. Build Everything

```bash
# From root directory
npm run build
```

**Verify the build**:
```bash
# Should exist:
ls -la client/dist/zingit-client.js
ls -la server/dist/index.js
```

### 3. Test the CLI Locally

```bash
# Run the CLI (simulates: npx @codewithdan/zingit)
node bin/cli.js
```

**Expected output**:
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  ⚡ ZingIt - AI-Powered UI Annotation Tool                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

🚀 Starting ZingIt server...

✓ Server running at http://localhost:3000

📝 How to use ZingIt:

   1. Add to your webpage:
      <script src="https://cdn.jsdelivr.net/npm/@codewithdan/zingit@latest/dist/zingit-client.js"></script>
      <script>ZingIt.connect('ws://localhost:3000');</script>

   2. Or visit the demo page:
      http://localhost:3000

   3. Press Z to toggle annotation mode

💡 Tip: Make sure you have an AI agent running

Press Ctrl+C to stop the server
```

Keep this terminal open (server is running).

### 4. Test the Client Bundle Locally

In a **new terminal**, serve the client bundle:

```bash
cd client/dist
npx serve -p 5500 .
```

This serves the built client on `http://localhost:5500`.

### 5. Create a Test HTML File

Create `test.html` anywhere on your machine:

```html
<!DOCTYPE html>
<html>
<head>
  <title>ZingIt Test Page</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
    }
    h1 { color: #3b82f6; }
    button {
      background: #3b82f6;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin: 10px 5px;
    }
  </style>
</head>
<body>
  <h1>ZingIt Local Test Page</h1>
  <p>This page tests the ZingIt CDN bundle locally.</p>

  <div>
    <h2>Test Buttons</h2>
    <button onclick="alert('Button 1 clicked!')">Button 1</button>
    <button onclick="alert('Button 2 clicked!')">Button 2</button>
  </div>

  <div>
    <h2>Test Form</h2>
    <input type="text" placeholder="Enter your name">
    <input type="email" placeholder="Enter your email">
    <button type="submit">Submit</button>
  </div>

  <!-- Load ZingIt from local build (simulates CDN) -->
  <script src="http://localhost:5500/zingit-client.js"></script>
  <script>
    // Connect to local server
    ZingIt.connect('ws://localhost:3000');

    // Log that it loaded
    console.log('ZingIt loaded:', ZingIt);
    console.log('ZingIt active:', ZingIt.isActive());
  </script>
</body>
</html>
```

### 6. Serve and Test the HTML

```bash
# In another terminal
npx serve -p 8080 .
```

Open: `http://localhost:8080/test.html`

### 7. Verify Everything Works

**In the browser:**

1. **Check the console** - You should see:
   ```
   ZingIt loaded: {connect: ƒ, init: ƒ, destroy: ƒ, isActive: ƒ}
   ZingIt active: true
   ```

2. **Check for the toolbar** - You should see the ZingIt toolbar appear on the page

3. **Press Z** - Toggle annotation mode on/off

4. **Click an element** - When annotation mode is active, click any button or input
   - An annotation dialog should appear
   - Add some notes and save

5. **Check WebSocket connection** - In the first terminal (where the server is running), you should see connection messages

6. **Test with query parameter**:
   - Edit test.html and remove the `ZingIt.connect()` call
   - Visit: `http://localhost:8080/test.html?zingit`
   - ZingIt should auto-initialize

### 8. Test npm link (Optional)

This tests the package as if it were installed from npm:

```bash
# In the zingit root directory
npm link

# In another directory or terminal
npx zingit
```

You should see the same banner and server start.

### 9. Test with a Real AI Agent

Make sure you have one of these installed and available:
- Claude Code CLI
- GitHub Copilot CLI
- OpenAI Codex

Then:
1. Start the ZingIt server: `node bin/cli.js`
2. Create an annotation with instructions like "Change button color to red"
3. Send to the AI agent
4. Verify the agent processes the request

## Troubleshooting

### Issue: "Cannot find module"

**Solution**: Make sure you ran `npm run build` and the dist files exist.

### Issue: CORS errors in browser

**Solution**: This is expected when using `file://` protocol. Use `npx serve` to serve files over HTTP.

### Issue: WebSocket connection fails

**Solution**:
1. Check the server is running (`node bin/cli.js`)
2. Verify it's on port 3000
3. Check browser console for connection errors
4. Make sure no firewall is blocking port 3000

### Issue: ZingIt is not defined

**Solution**:
1. Check that the script loaded: View source and click the script URL
2. Check browser console for errors
3. Make sure you're using the IIFE bundle (not ES module)
4. Verify the Vite config has `formats: ['iife']`

### Issue: Toolbar doesn't appear

**Solution**:
1. Open browser DevTools > Elements
2. Look for `<zing-ui>` element in the body
3. If missing, check console for errors
4. Try calling `ZingIt.init()` manually in console

## Next Steps After Successful Testing

1. ✅ Everything works locally
2. Update main README.md with installation instructions
3. Commit all changes (except dist/)
4. Create version tag: `git tag v1.0.0`
5. Publish: `npm publish --access public`
6. Wait 5-10 minutes for CDN to sync
7. Test with real CDN URL
8. Announce the release!

## Quick Command Reference

```bash
# Build
npm run build

# Test CLI
node bin/cli.js

# Test client locally
cd client/dist && npx serve -p 5500 .

# Serve test HTML
npx serve -p 8080 .

# Link for testing
npm link

# Clean build
rm -rf client/dist server/dist && npm run build
```
