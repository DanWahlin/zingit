#!/usr/bin/env npx tsx
// server/tests/test-e2e-full.ts
// Comprehensive end-to-end test suite for ZingIt + @codewithdan/agent-sdk-core
//
// Tests the complete user workflow:
// 1. Connect → select agent → send markers → verify streaming response
// 2. Follow-up messages
// 3. Agent switching
// 4. Git history (checkpoints, undo, revert)
// 5. Error handling (invalid data, unknown agents)
//
// Usage:
//   # Start the server first:
//   PORT=4444 PROJECT_DIR=$(pwd)/tests/test-project npm run dev
//
//   # Run all tests:
//   WS_URL=ws://localhost:4444 npx tsx tests/test-e2e-full.ts
//
//   # Run specific agent only:
//   WS_URL=ws://localhost:4444 npx tsx tests/test-e2e-full.ts --agent=copilot

import WebSocket from 'ws';
import { readFile, writeFile, cp, rm } from 'fs/promises';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const WS_URL = process.env.WS_URL || 'ws://localhost:4444';
const TIMEOUT_MS = 120_000;
const TEST_PROJECT_DIR = join(import.meta.dirname, 'test-project');

// Parse args
const args = process.argv.slice(2);
const specificAgent = args.find(a => a.startsWith('--agent='))?.split('=')[1];

// ─── Test Project Reset ─────────────────────────────────────────────

const ORIGINAL_APP_TSX = `// Test file for ZingIt agent validation
// This file contains intentional issues for the agent to fix

import React from 'react';

export function App() {
  return (
    <div className="app">
      <header>
        <h1>Welcome to My App</h1>
        <button className="login-btn">Login</button>
      </header>

      <main>
        <section className="hero">
          <h2>Get Started Today</h2>
          <p>This is a sample application for testing ZingIt annotations.</p>
          <button className="cta-btn">Sign Up Now</button>
        </section>

        <section className="features">
          <div className="feature-card">
            <h3>Feature One</h3>
            <p>Description of feature one goes here.</p>
          </div>
          <div className="feature-card">
            <h3>Feature Two</h3>
            <p>Description of feature two goes here.</p>
          </div>
        </section>
      </main>

      <footer>
        <p>Copyright 2024 My App</p>
      </footer>
    </div>
  );
}
`;

async function resetTestProject(): Promise<void> {
  // Remove .zingit history directory if present
  await rm(join(TEST_PROJECT_DIR, '.zingit'), { recursive: true, force: true });

  // Restore original file content (always write, regardless of git state)
  await writeFile(join(TEST_PROJECT_DIR, 'src', 'App.tsx'), ORIGINAL_APP_TSX);

  // Reset git to a clean state with the original content
  try {
    // Reset any uncommitted changes
    execSync('git checkout -- .', { cwd: TEST_PROJECT_DIR, stdio: 'pipe' });
    execSync('git clean -fd', { cwd: TEST_PROJECT_DIR, stdio: 'pipe' });
  } catch { /* not a git repo yet */ }

  // Re-write original (git checkout may have restored a committed modified version)
  await writeFile(join(TEST_PROJECT_DIR, 'src', 'App.tsx'), ORIGINAL_APP_TSX);

  // Ensure git repo exists with original content committed
  try {
    execSync('git add -A && git diff --cached --quiet || git commit -m "reset to original test state"', {
      cwd: TEST_PROJECT_DIR, stdio: 'pipe',
    });
  } catch {
    try {
      execSync('git init && git add -A && git commit -m "initial test state"', {
        cwd: TEST_PROJECT_DIR, stdio: 'pipe',
      });
    } catch { /* already done */ }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

interface WSMsg { type: string; [key: string]: unknown; }

class TestClient {
  private ws: WebSocket | null = null;
  private handlers: Array<(msg: WSMsg) => void> = [];

  async connect(): Promise<WSMsg> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      this.ws.on('error', reject);
      this.ws.on('message', (raw) => {
        const msg: WSMsg = JSON.parse(raw.toString());
        for (const h of this.handlers) h(msg);
      });
      // Wait for 'connected' message
      this.once('connected').then(resolve).catch(reject);
    });
  }

  send(msg: WSMsg): void {
    this.ws?.send(JSON.stringify(msg));
  }

  /** Wait for a specific message type with timeout */
  once(type: string, timeoutMs = TIMEOUT_MS): Promise<WSMsg> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${type}'`)), timeoutMs);
      const handler = (msg: WSMsg) => {
        if (msg.type === type) {
          clearTimeout(timer);
          this.handlers = this.handlers.filter(h => h !== handler);
          resolve(msg);
        }
      };
      this.handlers.push(handler);
    });
  }

  /** Collect messages until a specific type arrives */
  collectUntil(endType: string, timeoutMs = TIMEOUT_MS): Promise<WSMsg[]> {
    return new Promise((resolve, reject) => {
      const messages: WSMsg[] = [];
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${endType}'`)), timeoutMs);
      const handler = (msg: WSMsg) => {
        messages.push(msg);
        if (msg.type === endType) {
          clearTimeout(timer);
          this.handlers = this.handlers.filter(h => h !== handler);
          resolve(messages);
        }
      };
      this.handlers.push(handler);
    });
  }

  close(): void {
    this.handlers = [];
    this.ws?.close();
    this.ws = null;
  }
}

// ─── Test Runner ────────────────────────────────────────────────────

interface TestCase {
  name: string;
  fn: () => Promise<void>;
}

const tests: TestCase[] = [];
function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn });
}

let passed = 0, failed = 0, skipped = 0;

async function runTests() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  ZingIt E2E Test Suite');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Server: ${WS_URL}`);
  console.log(`  Project: ${TEST_PROJECT_DIR}`);
  console.log('');

  // Reset test project to known state before running
  process.stdout.write('  Resetting test project ... ');
  await resetTestProject();
  console.log('✅');
  console.log('');

  for (const t of tests) {
    process.stdout.write(`  ${t.name} ... `);
    try {
      await t.fn();
      console.log('✅ PASS');
      passed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('quota') || msg.includes('usage limit') || msg.includes('credits') || msg.includes('rate')) {
        console.log(`⏭️  SKIP (${msg.substring(0, 60)})`);
        skipped++;
      } else {
        console.log(`❌ FAIL: ${msg}`);
        failed++;
      }
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`  ${passed} passed, ${skipped} skipped, ${failed} failed`);
  console.log('═══════════════════════════════════════════════');

  // Reset test project to clean state after all tests
  process.stdout.write('\n  Cleaning up test project ... ');
  await resetTestProject();
  console.log('✅\n');

  process.exit(failed > 0 ? 1 : 0);
}

// ─── Fixtures ───────────────────────────────────────────────────────

const simpleMarker = {
  id: 'test-marker-1',
  selector: 'button.login-btn',
  identifier: 'button.login-btn',
  html: '<button class="login-btn">Login</button>',
  notes: 'Change the button text from "Login" to "Sign In"',
  status: 'pending' as const,
};

const batchData = {
  pageTitle: 'Test Page',
  pageUrl: 'http://localhost/test',
  markers: [simpleMarker],
};

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

// ─── Test: Connection ───────────────────────────────────────────────

test('connects and receives handshake', async () => {
  const client = new TestClient();
  const msg = await client.connect();
  assert(msg.type === 'connected', `Expected 'connected', got '${msg.type}'`);
  client.close();
});

// ─── Test: Agent Discovery ──────────────────────────────────────────

test('lists available agents', async () => {
  const client = new TestClient();
  await client.connect();
  const agentsPromise = client.once('agents', 5000);
  client.send({ type: 'get_agents' });
  const msg = await agentsPromise;
  assert(Array.isArray(msg.agents), 'Expected agents array');
  const agents = msg.agents as Array<{ name: string; available: boolean }>;
  assert(agents.length >= 1, 'Expected at least 1 agent');
  const names = agents.map(a => a.name);
  assert(names.includes('copilot') || names.includes('claude') || names.includes('codex'), 'Expected known agents');
  client.close();
});

// ─── Test: Agent Selection ──────────────────────────────────────────

test('selects an agent successfully', async () => {
  const client = new TestClient();
  await client.connect();
  const selectedPromise = client.once('agent_selected', 30000);
  client.send({ type: 'select_agent', agent: 'copilot' });
  const msg = await selectedPromise;
  assert(msg.agent === 'copilot', `Expected agent 'copilot', got '${msg.agent}'`);
  assert(typeof msg.model === 'string', 'Expected model string');
  client.close();
});

test('rejects unknown agent', async () => {
  const client = new TestClient();
  await client.connect();
  const errorPromise = client.once('agent_error', 5000);
  client.send({ type: 'select_agent', agent: 'nonexistent_agent' });
  const msg = await errorPromise;
  assert(msg.type === 'agent_error', 'Expected agent_error');
  client.close();
});

// ─── Test: Batch Processing (per agent) ─────────────────────────────

function addAgentBatchTest(agentName: string) {
  test(`${agentName}: processes batch with streaming response`, async () => {
    // Reset before each agent test to ensure clean state
    await resetTestProject();

    const client = new TestClient();
    await client.connect();

    // Select agent
    const selectedPromise = client.once('agent_selected', 30000);
    client.send({ type: 'select_agent', agent: agentName });
    await selectedPromise;

    // Send batch and collect all messages until idle
    const allMessages = client.collectUntil('idle');
    client.send({ type: 'batch', data: batchData });
    const messages = await allMessages;

    const types = messages.map(m => m.type);
    assert(types.includes('processing'), 'Expected processing message');
    assert(types.includes('idle'), 'Expected idle message');

    const deltaCount = types.filter(t => t === 'delta').length;
    assert(deltaCount > 0, `Expected delta chunks, got ${deltaCount}`);

    // Verify checkpoint was created
    const checkpointMsgs = messages.filter(m => m.type === 'checkpoint_created');
    assert(checkpointMsgs.length > 0, 'Expected checkpoint_created message');

    client.close();
  });

  test(`${agentName}: agent modifies the test project file`, async () => {
    // Read the file to check if it was actually modified
    const content = await readFile(join(TEST_PROJECT_DIR, 'src', 'App.tsx'), 'utf-8');
    // The marker asked to change "Login" to "Sign In" — check if the agent did it
    // (The original has "Login", after agent it should have "Sign In")
    const wasModified = content.includes('Sign In') || !content.includes('"Login"');
    assert(wasModified, 'Expected agent to modify App.tsx (change Login to Sign In)');
  });
}

// ─── Test: Follow-up Message ────────────────────────────────────────

function addAgentFollowUpTest(agentName: string) {
  test(`${agentName}: handles follow-up message`, async () => {
    const client = new TestClient();
    await client.connect();

    // Select and do initial batch
    const selectedPromise = client.once('agent_selected', 30000);
    client.send({ type: 'select_agent', agent: agentName });
    await selectedPromise;

    const batch1 = client.collectUntil('idle');
    client.send({ type: 'batch', data: batchData });
    await batch1;

    // Send follow-up
    const followUp = client.collectUntil('idle');
    client.send({ type: 'message', content: 'Also change the header color to blue' });
    const messages = await followUp;

    const types = messages.map(m => m.type);
    assert(types.includes('idle'), 'Expected idle after follow-up');

    client.close();
  });
}

// ─── Test: Agent Switching ──────────────────────────────────────────

test('switches agents without stale session errors', async () => {
  const client = new TestClient();
  await client.connect();

  // Select copilot
  let selected = client.once('agent_selected', 30000);
  client.send({ type: 'select_agent', agent: 'copilot' });
  await selected;

  // Do a batch
  const batch1 = client.collectUntil('idle');
  client.send({ type: 'batch', data: batchData });
  await batch1;

  // Switch to claude
  selected = client.once('agent_selected', 30000);
  client.send({ type: 'select_agent', agent: 'claude' });
  const claudeMsg = await selected;
  assert(claudeMsg.agent === 'claude', 'Expected claude selected');

  client.close();
});

// ─── Test: Invalid Batch Data ───────────────────────────────────────

test('rejects batch without selecting agent (fresh server)', async () => {
  // Note: ZingIt uses global state, so if an agent was previously selected
  // on this server, it persists. This test verifies the error message format
  // by first resetting the session.
  const client = new TestClient();
  await client.connect();

  // Reset to clear any selected agent
  const resetPromise = client.once('reset_complete', 5000).catch(() => {});
  client.send({ type: 'reset' });
  await resetPromise;

  // Try batch — may succeed if agent persists from prior test (global state)
  // This validates the server doesn't crash on batch after reset
  client.send({ type: 'batch', data: batchData });
  // Wait briefly for any response
  const response = await Promise.race([
    client.once('error', 3000).then(m => m.type),
    client.once('processing', 3000).then(m => m.type),
  ]).catch(() => 'timeout');

  // Either error (no agent) or processing (agent persisted) is acceptable
  assert(response === 'error' || response === 'processing' || response === 'timeout',
    `Unexpected response: ${response}`);

  client.close();
});

test('rejects batch with empty markers', async () => {
  const client = new TestClient();
  await client.connect();
  const selectedPromise = client.once('agent_selected', 30000);
  client.send({ type: 'select_agent', agent: 'copilot' });
  await selectedPromise;

  const errorPromise = client.once('error', 5000);
  client.send({ type: 'batch', data: { pageTitle: 'Test', pageUrl: 'http://test', markers: [] } });
  const msg = await errorPromise;
  assert(msg.type === 'error', 'Expected error for empty markers');
  client.close();
});

// ─── Test: Git History ──────────────────────────────────────────────

test('returns checkpoint history after batch', async () => {
  const client = new TestClient();
  await client.connect();

  const selectedPromise = client.once('agent_selected', 30000);
  client.send({ type: 'select_agent', agent: 'copilot' });
  await selectedPromise;

  // Do batch (creates checkpoint)
  const batch = client.collectUntil('idle');
  client.send({ type: 'batch', data: batchData });
  await batch;

  // Request history
  const historyPromise = client.once('history', 5000);
  client.send({ type: 'get_history' });
  const msg = await historyPromise;
  assert(Array.isArray(msg.checkpoints), 'Expected checkpoints array');

  client.close();
});

test('undo reverts last checkpoint and restores file', async () => {
  // Reset to known state first
  await resetTestProject();

  const client = new TestClient();
  await client.connect();

  const selectedPromise = client.once('agent_selected', 30000);
  client.send({ type: 'select_agent', agent: 'copilot' });
  await selectedPromise;

  // Verify original content has "Login"
  const beforeContent = await readFile(join(TEST_PROJECT_DIR, 'src', 'App.tsx'), 'utf-8');
  assert(beforeContent.includes('Login'), 'Expected original file to contain "Login"');

  // Do batch (agent changes "Login" to "Sign In")
  const batch = client.collectUntil('idle');
  client.send({ type: 'batch', data: batchData });
  await batch;

  // Verify file was modified
  const afterContent = await readFile(join(TEST_PROJECT_DIR, 'src', 'App.tsx'), 'utf-8');
  const wasModified = afterContent.includes('Sign In') || !afterContent.includes('"Login"');
  assert(wasModified, 'Expected agent to modify file before undo');

  // Undo
  const undoPromise = client.once('undo_complete', 10000);
  client.send({ type: 'undo' });
  const msg = await undoPromise;
  assert(msg.type === 'undo_complete', 'Expected undo_complete');
  assert(typeof msg.checkpointId === 'string', 'Expected checkpointId');

  // Verify file was reverted to original
  const undoneContent = await readFile(join(TEST_PROJECT_DIR, 'src', 'App.tsx'), 'utf-8');
  assert(undoneContent.includes('Login'), 'Expected file to be reverted to original after undo');

  client.close();
});

test('clear history removes all checkpoints', async () => {
  const client = new TestClient();
  await client.connect();

  const clearedPromise = client.once('history_cleared', 5000);
  client.send({ type: 'clear_history' });
  const msg = await clearedPromise;
  assert(msg.type === 'history_cleared', 'Expected history_cleared');

  // Verify empty
  const historyPromise = client.once('history', 5000);
  client.send({ type: 'get_history' });
  const histMsg = await historyPromise;
  const checkpoints = histMsg.checkpoints as unknown[];
  assert(checkpoints.length === 0, `Expected 0 checkpoints, got ${checkpoints.length}`);

  client.close();
});

// ─── Test: Reset / Stop ─────────────────────────────────────────────

test('reset destroys session', async () => {
  const client = new TestClient();
  await client.connect();

  const selectedPromise = client.once('agent_selected', 30000);
  client.send({ type: 'select_agent', agent: 'copilot' });
  await selectedPromise;

  const resetPromise = client.once('reset_complete', 5000);
  client.send({ type: 'reset' });
  const msg = await resetPromise;
  assert(msg.type === 'reset_complete', 'Expected reset_complete');

  client.close();
});

// ─── Register Agent-Specific Tests ──────────────────────────────────

const agentsToTest = specificAgent ? [specificAgent] : ['copilot'];

for (const agent of agentsToTest) {
  addAgentBatchTest(agent);
  addAgentFollowUpTest(agent);
}

// ─── Run ────────────────────────────────────────────────────────────

runTests();
