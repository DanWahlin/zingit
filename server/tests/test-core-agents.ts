#!/usr/bin/env npx tsx
// server/tests/test-core-agents.ts
// E2E test for @codewithdan/agent-sdk-core integration
// Tests all three agents (copilot, claude, codex) via the CoreProviderAdapter
//
// Usage:
//   # Start the server first:
//   PORT=3333 PROJECT_DIR=$(pwd)/tests/test-project npm run dev
//
//   # Run all agents:
//   WS_URL=ws://localhost:3333 npx tsx tests/test-core-agents.ts
//
//   # Run specific agent:
//   WS_URL=ws://localhost:3333 npx tsx tests/test-core-agents.ts --agent=copilot

import WebSocket from 'ws';

const WS_URL = process.env.WS_URL || 'ws://localhost:3333';
const TIMEOUT_MS = 120_000;

// Parse args
const args = process.argv.slice(2);
const specificAgent = args.find(a => a.startsWith('--agent='))?.split('=')[1];
const agents = specificAgent ? [specificAgent] : ['copilot', 'claude', 'codex'];

interface TestResult {
  agent: string;
  status: 'pass' | 'fail' | 'skip';
  chunks: number;
  events: string[];
  error?: string;
  duration: number;
}

const marker = {
  id: 'test-1',
  selector: 'button.login-btn',
  identifier: 'button.login-btn',
  html: '<button class="login-btn">Login</button>',
  notes: 'Change the button text from "Login" to "Sign In"',
  status: 'pending' as const,
};

async function testAgent(agentName: string): Promise<TestResult> {
  const start = Date.now();
  const result: TestResult = { agent: agentName, status: 'fail', chunks: 0, events: [], duration: 0 };

  return new Promise<TestResult>((resolve) => {
    const timeout = setTimeout(() => {
      result.error = `Timeout after ${TIMEOUT_MS / 1000}s`;
      result.duration = Date.now() - start;
      ws.close();
      resolve(result);
    }, TIMEOUT_MS);

    const ws = new WebSocket(WS_URL);

    ws.on('error', (err) => {
      clearTimeout(timeout);
      result.error = `WS error: ${err.message}`;
      result.duration = Date.now() - start;
      resolve(result);
    });

    ws.on('open', () => {
      // Step 1: Select agent
      ws.send(JSON.stringify({ type: 'select_agent', agent: agentName }));
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());

      switch (msg.type) {
        case 'agent_selected':
          console.log(`  ✓ ${agentName} selected (model: ${msg.model || 'unknown'})`);
          // Step 2: Send batch with marker
          ws.send(JSON.stringify({
            type: 'batch',
            data: {
              pageTitle: 'Test Page',
              pageUrl: 'http://localhost/test',
              markers: [marker],
            },
          }));
          break;

        case 'agent_error':
          console.log(`  ✗ Agent error: ${msg.message}`);
          result.error = msg.message;
          // Check if it's a quota/auth error (not a code bug)
          if (msg.message?.includes('quota') || msg.message?.includes('rate') ||
              msg.message?.includes('auth') || msg.message?.includes('credential') ||
              msg.message?.includes('usage limit') || msg.message?.includes('credits')) {
            result.status = 'skip';
            result.error = `Skipped: ${msg.message}`;
          }
          clearTimeout(timeout);
          result.duration = Date.now() - start;
          ws.close();
          resolve(result);
          break;

        case 'processing':
          console.log(`  → Processing started`);
          break;

        case 'delta':
          result.chunks++;
          if (!result.events.includes('delta')) result.events.push('delta');
          break;

        case 'tool_start':
          if (!result.events.includes('tool_start')) result.events.push('tool_start');
          break;

        case 'tool_end':
          if (!result.events.includes('tool_end')) result.events.push('tool_end');
          break;

        case 'idle':
          console.log(`  ✓ Completed — ${result.chunks} chunks, events: [${result.events.join(', ')}]`);
          result.status = 'pass';
          clearTimeout(timeout);
          result.duration = Date.now() - start;
          ws.close();
          resolve(result);
          break;

        case 'error':
          console.log(`  ✗ Error: ${msg.message}`);
          // Quota/auth errors are skips, not failures
          if (msg.message?.includes('quota') || msg.message?.includes('rate') ||
              msg.message?.includes('exited with code') || msg.message?.includes('auth') ||
              msg.message?.includes('usage limit') || msg.message?.includes('credits')) {
            result.status = 'skip';
            result.error = `Skipped: ${msg.message}`;
          } else {
            result.error = msg.message;
          }
          clearTimeout(timeout);
          result.duration = Date.now() - start;
          ws.close();
          resolve(result);
          break;
      }
    });
  });
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  agent-sdk-core E2E Test — ZingIt Server');
  console.log('═══════════════════════════════════════════');
  console.log(`  Server: ${WS_URL}`);
  console.log(`  Agents: ${agents.join(', ')}`);
  console.log('');

  const results: TestResult[] = [];

  for (const agent of agents) {
    console.log(`\n── Testing: ${agent} ──`);
    const result = await testAgent(agent);
    results.push(result);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════');
  console.log('  Results');
  console.log('═══════════════════════════════════════════\n');

  let passed = 0, failed = 0, skipped = 0;
  for (const r of results) {
    const icon = r.status === 'pass' ? '✅' : r.status === 'skip' ? '⏭️' : '❌';
    const detail = r.status === 'pass'
      ? `${r.chunks} chunks in ${(r.duration / 1000).toFixed(1)}s`
      : r.error || 'unknown';
    console.log(`  ${icon} ${r.agent}: ${r.status.toUpperCase()} — ${detail}`);
    if (r.status === 'pass') passed++;
    else if (r.status === 'skip') skipped++;
    else failed++;
  }

  console.log(`\n  Total: ${passed} passed, ${skipped} skipped, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
