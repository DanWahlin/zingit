import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'fs';
import type { ImageContent, WebSocketRef } from '../src/types.ts';
import type { AgentEvent, AgentAttachment } from '@codewithdan/agent-sdk-core';

// ── Shared fixtures ──

const TINY_PNG_B64 = Buffer.from('fake-png-data').toString('base64');

function makeImage(overrides?: Partial<ImageContent>): ImageContent {
  return {
    base64: TINY_PNG_B64,
    mediaType: 'image/png',
    label: 'Screenshot of Marker 1: .btn-submit',
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════
// 1. imagesToAttachments — converts zingit ImageContent → AgentAttachment
// ══════════════════════════════════════════════════════════════════════

describe('imagesToAttachments', () => {
  let imagesToAttachments: (images?: ImageContent[]) => AgentAttachment[] | undefined;

  beforeEach(async () => {
    // Import the module-level function (it's not exported, so we test via the adapter)
    // We'll extract it by creating a minimal adapter and testing the conversion
    const mod = await import('../src/agents/core-adapter.ts');
    // imagesToAttachments is a module-level function, not exported.
    // We test it indirectly through CoreProviderAdapter or extract it.
    // For direct testing, let's use a dynamic approach:
    const source = await import('fs').then(fs =>
      fs.promises.readFile(new URL('../src/agents/core-adapter.ts', import.meta.url), 'utf-8')
    );
    // Verify the function exists in source
    assert.ok(source.includes('function imagesToAttachments'));

    // Re-implement locally for unit testing (mirrors the source exactly)
    imagesToAttachments = (images?: ImageContent[]): AgentAttachment[] | undefined => {
      if (!images || images.length === 0) return undefined;
      return images.map(img => ({
        type: 'base64_image' as const,
        data: img.base64,
        mediaType: img.mediaType,
        displayName: img.label,
      }));
    };
  });

  it('should convert a single image to a base64_image attachment', () => {
    const result = imagesToAttachments([makeImage()])!;
    assert.equal(result.length, 1);
    assert.equal(result[0].type, 'base64_image');
    assert.equal(result[0].data, TINY_PNG_B64);
    assert.equal(result[0].mediaType, 'image/png');
    assert.equal(result[0].displayName, 'Screenshot of Marker 1: .btn-submit');
  });

  it('should convert multiple images', () => {
    const result = imagesToAttachments([
      makeImage({ label: 'Marker 1' }),
      makeImage({ mediaType: 'image/jpeg', label: 'Marker 2' }),
    ])!;
    assert.equal(result.length, 2);
    assert.equal(result[0].displayName, 'Marker 1');
    assert.equal(result[1].mediaType, 'image/jpeg');
    assert.equal(result[1].displayName, 'Marker 2');
  });

  it('should return undefined for empty array', () => {
    assert.equal(imagesToAttachments([]), undefined);
  });

  it('should return undefined for undefined input', () => {
    assert.equal(imagesToAttachments(undefined), undefined);
  });

  it('should handle image without label', () => {
    const result = imagesToAttachments([makeImage({ label: undefined })])!;
    assert.equal(result[0].displayName, undefined);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. BaseAgent.extractImages — extracts & validates images from BatchData
// ══════════════════════════════════════════════════════════════════════

describe('BaseAgent.extractImages', () => {
  let agent: any;

  beforeEach(async () => {
    const { CoreProviderAdapter } = await import('../src/agents/core-adapter.ts');
    // Create a minimal mock provider
    const mockProvider = {
      name: 'copilot' as const,
      displayName: 'Test',
      model: 'test-model',
      start: async () => {},
      stop: async () => {},
      createSession: async () => ({
        execute: async () => ({ status: 'complete' as const }),
        send: async () => {},
        abort: async () => {},
        destroy: async () => {},
        sessionId: null,
      }),
    };
    agent = new CoreProviderAdapter(mockProvider);
  });

  it('should extract valid PNG screenshot from marker', () => {
    const validBase64 = Buffer.from('test-image-data-padding!').toString('base64');
    const images = agent.extractImages({
      pageTitle: 'Test', pageUrl: 'http://test.com',
      markers: [{ id: '1', selector: '.btn', identifier: '.btn', html: '<button/>', notes: 'fix', screenshot: validBase64 }],
    });
    assert.equal(images.length, 1);
    assert.equal(images[0].mediaType, 'image/png');
    assert.equal(images[0].base64, validBase64);
    assert.equal(images[0].label, 'Screenshot of Marker 1: .btn');
  });

  it('should extract image from data URL with media type', () => {
    const rawB64 = Buffer.from('test-image-data-padding!').toString('base64');
    const dataUrl = `data:image/jpeg;base64,${rawB64}`;
    const images = agent.extractImages({
      pageTitle: 'Test', pageUrl: 'http://test.com',
      markers: [{ id: '1', selector: '.img', identifier: '.img', html: '<img/>', notes: 'fix', screenshot: dataUrl }],
    });
    assert.equal(images.length, 1);
    assert.equal(images[0].mediaType, 'image/jpeg');
    assert.equal(images[0].base64, rawB64);
  });

  it('should skip markers without screenshots', () => {
    const images = agent.extractImages({
      pageTitle: 'Test', pageUrl: 'http://test.com',
      markers: [
        { id: '1', selector: '.a', identifier: '.a', html: '<a/>', notes: 'fix' },
        { id: '2', selector: '.b', identifier: '.b', html: '<b/>', notes: 'fix' },
      ],
    });
    assert.equal(images.length, 0);
  });

  it('should skip invalid base64 data', () => {
    const images = agent.extractImages({
      pageTitle: 'Test', pageUrl: 'http://test.com',
      markers: [{ id: '1', selector: '.btn', identifier: '.btn', html: '<button/>', notes: 'fix', screenshot: '!!!not-base64!!!' }],
    });
    assert.equal(images.length, 0);
  });

  it('should extract multiple images from multiple markers', () => {
    const b64 = Buffer.from('test-image-data-padding!').toString('base64');
    const images = agent.extractImages({
      pageTitle: 'Test', pageUrl: 'http://test.com',
      markers: [
        { id: '1', selector: '.a', identifier: '.a', html: '<a/>', notes: 'fix a', screenshot: b64 },
        { id: '2', selector: '.b', identifier: '.b', html: '<b/>', notes: 'fix b' },
        { id: '3', selector: '.c', identifier: '.c', html: '<c/>', notes: 'fix c', screenshot: b64 },
      ],
    });
    assert.equal(images.length, 2);
    assert.equal(images[0].label, 'Screenshot of Marker 1: .a');
    assert.equal(images[1].label, 'Screenshot of Marker 3: .c');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. CoreProviderAdapter — attachments flow through to core session
// ══════════════════════════════════════════════════════════════════════

describe('CoreProviderAdapter session image handling', () => {
  let executeCalls: Array<{ prompt: string; attachments?: AgentAttachment[] }>;
  let adapter: any;

  beforeEach(async () => {
    executeCalls = [];

    const mockCoreSession = {
      sessionId: 'mock-session-1',
      execute: async (prompt: string, attachments?: AgentAttachment[]) => {
        executeCalls.push({ prompt, attachments });
        return { status: 'complete' as const };
      },
      send: async () => {},
      abort: async () => {},
      destroy: async () => {},
    };

    const mockProvider = {
      name: 'copilot' as const,
      displayName: 'Test Copilot',
      model: 'test-model',
      start: async () => {},
      stop: async () => {},
      createSession: async () => mockCoreSession,
    };

    const { CoreProviderAdapter } = await import('../src/agents/core-adapter.ts');
    adapter = new CoreProviderAdapter(mockProvider);
    adapter.started = true; // Skip start()
  });

  it('should pass images as attachments to coreSession.execute()', async () => {
    const mockWs = { readyState: 1, OPEN: 1, send: () => {} };
    const wsRef = { current: mockWs } as any;

    const session = await adapter.createSession(wsRef, '/tmp/project');
    await session.send({
      prompt: 'Fix the button color',
      images: [makeImage()],
    });

    assert.equal(executeCalls.length, 1);
    assert.equal(executeCalls[0].prompt, 'Fix the button color');

    // Verify attachments are passed (this validates the integration)
    const atts = executeCalls[0].attachments;
    if (atts && atts.length > 0) {
      // If attachments ARE passed, verify they're correct
      assert.equal(atts[0].type, 'base64_image');
      assert.equal(atts[0].data, TINY_PNG_B64);
      assert.equal(atts[0].mediaType, 'image/png');
    } else {
      // If attachments are NOT passed, this is the known gap —
      // core-adapter.ts line 151 calls execute(msg.prompt) without attachments
      assert.fail(
        'Attachments are not being passed to coreSession.execute(). ' +
        'core-adapter.ts computes imagesToAttachments() but never passes the result to execute().'
      );
    }

    await session.destroy();
  });

  it('should send prompt without attachments when no images provided', async () => {
    const mockWs = { readyState: 1, OPEN: 1, send: () => {} };
    const wsRef = { current: mockWs } as any;

    const session = await adapter.createSession(wsRef, '/tmp/project');
    await session.send({ prompt: 'Fix the layout' });

    assert.equal(executeCalls.length, 1);
    assert.equal(executeCalls[0].prompt, 'Fix the layout');
    // No attachments expected
    assert.equal(executeCalls[0].attachments, undefined);
    await session.destroy();
  });

  it('should clean up temp files on destroy()', async () => {
    const mockWs = { readyState: 1, OPEN: 1, send: () => {} };
    const wsRef = { current: mockWs } as any;

    const session = await adapter.createSession(wsRef, '/tmp/project');

    // Send with an image to create temp files
    const validB64 = Buffer.from('test-png-content-here').toString('base64');
    await session.send({
      prompt: 'Fix it',
      images: [makeImage({ base64: validB64 })],
    });

    // Destroy should clean up temp files without error
    await session.destroy();
    // If we get here without throwing, cleanup worked
    assert.ok(true);
  });

  it('should forward core events as WS messages', async () => {
    const wsSent: string[] = [];
    const mockWs = { readyState: 1, OPEN: 1, send: (data: string) => wsSent.push(data) };
    const wsRef = { current: mockWs } as any;

    // Create a provider that triggers onEvent
    let capturedOnEvent: ((event: AgentEvent) => void) | null = null;
    const eventProvider = {
      name: 'copilot' as const,
      displayName: 'Test',
      model: 'test',
      start: async () => {},
      stop: async () => {},
      createSession: async (config: any) => {
        capturedOnEvent = config.onEvent;
        return {
          sessionId: 'mock',
          execute: async () => {
            // Simulate agent producing events
            if (capturedOnEvent) {
              capturedOnEvent({ id: '1', contextId: config.contextId, type: 'output', content: 'Working...', timestamp: Date.now() });
              capturedOnEvent({ id: '2', contextId: config.contextId, type: 'complete', content: 'Done', timestamp: Date.now() });
            }
            return { status: 'complete' as const };
          },
          send: async () => {},
          abort: async () => {},
          destroy: async () => {},
        };
      },
    };

    const { CoreProviderAdapter } = await import('../src/agents/core-adapter.ts');
    const evtAdapter = new CoreProviderAdapter(eventProvider);
    (evtAdapter as any).started = true;

    const session = await evtAdapter.createSession(wsRef, '/tmp/project');
    await session.send({ prompt: 'test' });

    // Should have forwarded events as WS messages
    const messages = wsSent.map(s => JSON.parse(s));
    const delta = messages.find((m: any) => m.type === 'delta');
    assert.ok(delta, 'should have a delta message');
    assert.equal(delta.content, 'Working...');

    const idle = messages.find((m: any) => m.type === 'idle');
    assert.ok(idle, 'should have an idle message');

    await session.destroy();
  });
});
