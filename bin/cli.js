#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function printBanner() {
  console.log('');
  console.log(`${colors.cyan}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║                                                               ║${colors.reset}`);
  console.log(`${colors.cyan}║${colors.reset}  ${colors.bright}⚡ ZingIt${colors.reset} - AI-Powered UI Marker Tool               ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}║                                                               ║${colors.reset}`);
  console.log(`${colors.cyan}╚═══════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');
}

function printInstructions(port = 3000) {
  console.log(`${colors.green}✓${colors.reset} Server running at ${colors.bright}http://localhost:${port}${colors.reset}`);
  console.log('');
  console.log(`${colors.yellow}📝 How to use ZingIt:${colors.reset}`);
  console.log('');
  console.log(`   ${colors.bright}1.${colors.reset} Add to your webpage:`);
  console.log(`      ${colors.cyan}<script src="https://cdn.jsdelivr.net/npm/@codewithdan/zingit@latest/dist/zingit-client.js"></script>${colors.reset}`);
  console.log(`      ${colors.cyan}<script>ZingIt.connect('ws://localhost:${port}');</script>${colors.reset}`);
  console.log('');
  console.log(`   ${colors.bright}2.${colors.reset} Or visit the demo page:`);
  console.log(`      ${colors.blue}http://localhost:${port}${colors.reset}`);
  console.log('');
  console.log(`   ${colors.bright}3.${colors.reset} Press ${colors.bright}Z${colors.reset} to toggle marker mode`);
  console.log('');
  console.log(`${colors.yellow}💡 Tip:${colors.reset} Make sure you have an AI agent running (Claude Code, GitHub Copilot CLI, or OpenAI Codex)`);
  console.log('');
  console.log(`Press ${colors.bright}Ctrl+C${colors.reset} to stop the server`);
  console.log('');
}

async function startServer() {
  printBanner();
  console.log(`${colors.cyan}🚀 Starting ZingIt server...${colors.reset}`);
  console.log('');

  // Path to the compiled server
  const serverPath = join(__dirname, '..', 'server', 'dist', 'index.js');

  // Start the server as a child process
  const serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });

  serverProcess.on('error', (err) => {
    console.error(`${colors.red}✗ Failed to start server:${colors.reset}`, err);
    process.exit(1);
  });

  // Wait a moment for server to start, then print instructions
  setTimeout(() => {
    printInstructions();
  }, 1000);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('');
    console.log(`${colors.yellow}⚡ Shutting down ZingIt server...${colors.reset}`);
    serverProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM');
    process.exit(0);
  });
}

startServer().catch((err) => {
  console.error(`${colors.red}✗ Error:${colors.reset}`, err);
  process.exit(1);
});
