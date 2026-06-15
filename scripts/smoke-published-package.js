#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const packageJson = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf8'));
const packageSpec = process.env.ZINGIT_SMOKE_PACKAGE_SPEC || `${packageJson.name}@${packageJson.version}`;
const timeoutMs = Number.parseInt(process.env.ZINGIT_SMOKE_TIMEOUT_MS || '60000', 10);

async function getFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
  });
  if (!address || typeof address === 'string') {
    throw new Error('Unable to allocate a free local port.');
  }
  return address.port;
}

function connectOnce(port, attemptTimeoutMs) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`Timed out waiting for WebSocket connection on port ${port}.`));
    }, attemptTimeoutMs);

    ws.once('message', (data) => {
      clearTimeout(timer);
      ws.close();
      const payload = data.toString();
      let message;
      try {
        message = JSON.parse(payload);
      } catch {
        reject(new Error(`Expected JSON connected message, received: ${payload}`));
        return;
      }
      if (message.type !== 'connected') {
        reject(new Error(`Expected connected message, received: ${payload}`));
        return;
      }
      resolve(message);
    });

    ws.once('error', (err) => {
      clearTimeout(timer);
      ws.close();
      reject(err);
    });
  });
}

async function waitForConnectedMessage(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      return await connectOnce(port, 1000);
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`Timed out waiting for published package server on port ${port}: ${lastError?.message || 'unknown error'}`);
}

async function main() {
  const port = await getFreePort();
  const projectDir = await mkdtemp(join(tmpdir(), 'zingit-smoke-'));

  const child = spawn('npx', ['-y', packageSpec], {
    cwd: projectDir,
    env: {
      ...process.env,
      PORT: String(port),
      PROJECT_DIR: projectDir,
      npm_config_yes: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (data) => {
    output += data.toString();
  });
  child.stderr.on('data', (data) => {
    output += data.toString();
  });

  try {
    await Promise.race([
      waitForConnectedMessage(port, timeoutMs),
      new Promise((_, reject) => {
        child.once('exit', (code, signal) => {
          reject(new Error(`Published package process exited early with code ${code ?? 'null'} and signal ${signal ?? 'null'}.\n${output}`));
        });
      }),
    ]);
    console.log(`Published package smoke test passed for ${packageSpec}.`);
  } finally {
    child.kill('SIGTERM');
    await rm(projectDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`Published package smoke test failed: ${err.message}`);
  process.exit(1);
});
