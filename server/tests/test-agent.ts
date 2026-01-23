#!/usr/bin/env npx tsx
// server/tests/test-agent.ts
// Test script to validate agent WebSocket communication
//
// Usage:
//   # First, start the server with desired agent:
//   PROJECT_DIR=$(pwd)/tests/test-project AGENT=claude npm run dev
//
//   # Then in another terminal, run the test:
//   npx tsx tests/test-agent.ts
//
//   # Or test a specific scenario:
//   npx tsx tests/test-agent.ts --scenario=simple
//   npx tsx tests/test-agent.ts --scenario=multi
//   npx tsx tests/test-agent.ts --scenario=followup

import WebSocket from 'ws';
import { setTimeout } from 'timers/promises';

// Configuration
const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TIMEOUT_MS = 120000; // 2 minutes for agent to respond

// Test scenarios
interface TestScenario {
  name: string;
  description: string;
  annotations: Array<{
    id: string;
    selector: string;
    identifier: string;
    html: string;
    notes: string;
    status: 'pending';
  }>;
  followUp?: string;
}

const scenarios: Record<string, TestScenario> = {
  simple: {
    name: 'Simple Button Change',
    description: 'Change a single button text',
    annotations: [
      {
        id: 'test-1',
        selector: 'button.login-btn',
        identifier: 'button.login-btn',
        html: '<button class="login-btn">Login</button>',
        notes: 'Change the button text from "Login" to "Sign In"',
        status: 'pending'
      }
    ]
  },
  multi: {
    name: 'Multiple Changes',
    description: 'Make multiple UI changes',
    annotations: [
      {
        id: 'test-1',
        selector: 'h1',
        identifier: 'h1 (header)',
        html: '<h1>Welcome to My App</h1>',
        notes: 'Change the heading to "Welcome to ZingIt Test"',
        status: 'pending'
      },
      {
        id: 'test-2',
        selector: 'button.cta-btn',
        identifier: 'button.cta-btn',
        html: '<button class="cta-btn">Sign Up Now</button>',
        notes: 'Change the button text to "Get Started Free"',
        status: 'pending'
      }
    ]
  },
  followup: {
    name: 'With Follow-up',
    description: 'Initial change with follow-up message',
    annotations: [
      {
        id: 'test-1',
        selector: 'footer p',
        identifier: 'footer > p',
        html: '<p>Copyright 2024 My App</p>',
        notes: 'Update the copyright year to 2025',
        status: 'pending'
      }
    ],
    followUp: 'Also add "All rights reserved" after the copyright notice'
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logEvent(type: string, data?: string) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  const typeColor = {
    'connected': colors.green,
    'processing': colors.yellow,
    'delta': colors.cyan,
    'tool_start': colors.blue,
    'tool_end': colors.blue,
    'idle': colors.green,
    'error': colors.red,
    'reset_complete': colors.dim
  }[type] || colors.reset;

  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${typeColor}${type}${colors.reset}${data ? `: ${data.slice(0, 100)}${data.length > 100 ? '...' : ''}` : ''}`);
}

async function runTest(scenarioKey: string): Promise<boolean> {
  const scenario = scenarios[scenarioKey];
  if (!scenario) {
    log(`Unknown scenario: ${scenarioKey}`, colors.red);
    log(`Available scenarios: ${Object.keys(scenarios).join(', ')}`, colors.dim);
    return false;
  }

  log(`\n${'='.repeat(60)}`, colors.bright);
  log(`Test: ${scenario.name}`, colors.bright);
  log(`Description: ${scenario.description}`, colors.dim);
  log(`${'='.repeat(60)}\n`, colors.bright);

  return new Promise((resolve) => {
    let agentInfo = { agent: '', model: '', projectDir: '' };
    let responseContent = '';
    let completed = false;
    let timeoutId: NodeJS.Timeout;

    const ws = new WebSocket(WS_URL);

    const cleanup = (success: boolean) => {
      if (completed) return;
      completed = true;
      clearTimeout(timeoutId);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      resolve(success);
    };

    // Timeout handler
    timeoutId = global.setTimeout(() => {
      log('\nTest timed out!', colors.red);
      cleanup(false);
    }, TIMEOUT_MS);

    ws.on('open', () => {
      log('Connected to WebSocket server', colors.green);
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case 'connected':
            agentInfo = {
              agent: msg.agent || 'unknown',
              model: msg.model || 'unknown',
              projectDir: msg.projectDir || 'unknown'
            };
            logEvent('connected', `Agent: ${agentInfo.agent}, Model: ${agentInfo.model}`);
            log(`Project directory: ${agentInfo.projectDir}`, colors.dim);

            // Send the batch after connection
            log('\nSending annotations...', colors.yellow);
            const batch = {
              type: 'batch',
              data: {
                pageUrl: 'http://localhost:3000/test',
                pageTitle: 'ZingIt Test Page',
                annotations: scenario.annotations
              }
            };
            ws.send(JSON.stringify(batch));
            break;

          case 'processing':
            logEvent('processing');
            break;

          case 'delta':
            responseContent += msg.content || '';
            // Only log first part of delta to avoid spam
            if (responseContent.length <= (msg.content?.length || 0) + 50) {
              logEvent('delta', msg.content);
            } else {
              process.stdout.write('.');
            }
            break;

          case 'tool_start':
            logEvent('tool_start', msg.tool);
            break;

          case 'tool_end':
            logEvent('tool_end', msg.tool);
            break;

          case 'idle':
            console.log(); // New line after dots
            logEvent('idle');

            // If there's a follow-up, send it
            if (scenario.followUp && !completed) {
              log('\nSending follow-up message...', colors.yellow);
              ws.send(JSON.stringify({
                type: 'message',
                content: scenario.followUp
              }));
              // Clear follow-up so we don't send it again
              scenario.followUp = undefined;
            } else {
              log('\n' + '-'.repeat(40), colors.dim);
              log('Agent Response Summary:', colors.bright);
              log('-'.repeat(40), colors.dim);
              log(responseContent.slice(0, 500) + (responseContent.length > 500 ? '\n...(truncated)' : ''), colors.cyan);
              log('-'.repeat(40), colors.dim);

              log('\nTest completed successfully!', colors.green);
              cleanup(true);
            }
            break;

          case 'error':
            logEvent('error', msg.message);
            log('\nTest failed with error!', colors.red);
            cleanup(false);
            break;

          case 'reset_complete':
            logEvent('reset_complete');
            break;
        }
      } catch (err) {
        log(`Failed to parse message: ${err}`, colors.red);
      }
    });

    ws.on('error', (err) => {
      log(`WebSocket error: ${err.message}`, colors.red);
      cleanup(false);
    });

    ws.on('close', () => {
      if (!completed) {
        log('WebSocket closed unexpectedly', colors.red);
        cleanup(false);
      }
    });
  });
}

async function main() {
  log('\n' + '='.repeat(60), colors.bright);
  log('  ZingIt Agent Test Suite', colors.bright);
  log('='.repeat(60) + '\n', colors.bright);

  // Parse command line args
  const args = process.argv.slice(2);
  let scenarioKey = 'simple'; // default

  for (const arg of args) {
    if (arg.startsWith('--scenario=')) {
      scenarioKey = arg.split('=')[1];
    }
    if (arg === '--help' || arg === '-h') {
      log('Usage: npx tsx tests/test-agent.ts [options]\n');
      log('Options:');
      log('  --scenario=<name>  Run a specific test scenario');
      log('  --help, -h         Show this help message\n');
      log('Available scenarios:');
      for (const [key, scenario] of Object.entries(scenarios)) {
        log(`  ${key.padEnd(12)} - ${scenario.description}`);
      }
      log('\nBefore running tests, start the server:');
      log('  PROJECT_DIR=$(pwd)/tests/test-project AGENT=claude npm run dev\n');
      process.exit(0);
    }
  }

  log(`WebSocket URL: ${WS_URL}`, colors.dim);
  log(`Timeout: ${TIMEOUT_MS / 1000}s`, colors.dim);

  // Check if server is running
  try {
    const testWs = new WebSocket(WS_URL);
    await new Promise<void>((resolve, reject) => {
      testWs.on('open', () => {
        testWs.close();
        resolve();
      });
      testWs.on('error', reject);
    });
  } catch {
    log('\nError: Cannot connect to WebSocket server', colors.red);
    log('Make sure the server is running with:', colors.yellow);
    log('  PROJECT_DIR=$(pwd)/tests/test-project AGENT=<agent> npm run dev\n', colors.dim);
    process.exit(1);
  }

  // Run the test
  const success = await runTest(scenarioKey);

  log('\n' + '='.repeat(60), colors.bright);
  if (success) {
    log('  TEST PASSED', colors.green);
  } else {
    log('  TEST FAILED', colors.red);
  }
  log('='.repeat(60) + '\n', colors.bright);

  process.exit(success ? 0 : 1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
