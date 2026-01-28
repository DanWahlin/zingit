// client/tests/selector.test.ts
// Unit tests for querySelector function with Shadow DOM support

import { describe, it, expect, beforeEach } from 'vitest';
import { querySelector } from '../src/services/selector.js';

describe('querySelector', () => {
  beforeEach(() => {
    // Clear the document body before each test
    document.body.innerHTML = '';
  });

  describe('Regular selectors (without >>>)', () => {
    it('should handle regular class selectors', () => {
      document.body.innerHTML = '<div class="test-element">Hello</div>';
      const element = querySelector('.test-element');
      expect(element).not.toBeNull();
      expect(element?.textContent).toBe('Hello');
    });

    it('should handle regular ID selectors', () => {
      document.body.innerHTML = '<div id="test-id">World</div>';
      const element = querySelector('#test-id');
      expect(element).not.toBeNull();
      expect(element?.textContent).toBe('World');
    });

    it('should handle complex selectors', () => {
      document.body.innerHTML = `
        <div class="container">
          <section>
            <p class="target">Found it</p>
          </section>
        </div>
      `;
      const element = querySelector('.container section p.target');
      expect(element).not.toBeNull();
      expect(element?.textContent).toBe('Found it');
    });

    it('should return null for non-existent selectors', () => {
      document.body.innerHTML = '<div class="exists">Hello</div>';
      const element = querySelector('.does-not-exist');
      expect(element).toBeNull();
    });
  });

  describe('Shadow DOM traversal (with >>>)', () => {
    it('should traverse single shadow DOM boundary', () => {
      // Create a custom element with shadow DOM
      const host = document.createElement('div');
      host.id = 'shadow-host';
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<div class="inner-class">Shadow content</div>';
      document.body.appendChild(host);

      const element = querySelector('#shadow-host >>> .inner-class');
      expect(element).not.toBeNull();
      expect(element?.textContent).toBe('Shadow content');
    });

    it('should traverse multiple shadow DOM boundaries', () => {
      // Create nested shadow DOM structure
      const outerHost = document.createElement('div');
      outerHost.id = 'outer';
      const outerShadow = outerHost.attachShadow({ mode: 'open' });

      const middleHost = document.createElement('div');
      middleHost.id = 'middle';
      const middleShadow = middleHost.attachShadow({ mode: 'open' });

      middleShadow.innerHTML = '<div class="target">Nested content</div>';
      outerShadow.appendChild(middleHost);
      document.body.appendChild(outerHost);

      const element = querySelector('#outer >>> #middle >>> .target');
      expect(element).not.toBeNull();
      expect(element?.textContent).toBe('Nested content');
    });

    it('should return null when shadow root does not exist', () => {
      // Create element without shadow root
      document.body.innerHTML = '<div id="regular-element"></div>';

      const element = querySelector('#regular-element >>> .target');
      expect(element).toBeNull();
    });

    it('should return null when intermediate element does not exist', () => {
      const host = document.createElement('div');
      host.id = 'shadow-host';
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<div class="inner">Content</div>';
      document.body.appendChild(host);

      // Try to query non-existent path
      const element = querySelector('#shadow-host >>> .non-existent >>> .target');
      expect(element).toBeNull();
    });

    it('should handle whitespace around >>> separator', () => {
      const host = document.createElement('div');
      host.id = 'host';
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<span class="content">Spaced</span>';
      document.body.appendChild(host);

      // Extra whitespace should be handled
      const element = querySelector('#host   >>>   .content');
      expect(element).not.toBeNull();
      expect(element?.textContent).toBe('Spaced');
    });
  });

  describe('Edge cases and validation', () => {
    it('should return null for empty selector', () => {
      const element = querySelector('');
      expect(element).toBeNull();
    });

    it('should return null for whitespace-only selector', () => {
      const element = querySelector('   ');
      expect(element).toBeNull();
    });

    it('should handle selector with only >>>', () => {
      const element = querySelector('>>>');
      expect(element).toBeNull();
    });

    it('should trim leading and trailing whitespace', () => {
      document.body.innerHTML = '<div class="trimmed">Trim test</div>';
      const element = querySelector('  .trimmed  ');
      expect(element).not.toBeNull();
      expect(element?.textContent).toBe('Trim test');
    });

    it('should handle invalid CSS selectors gracefully', () => {
      // querySelector will throw for invalid CSS, we should handle it
      expect(() => querySelector('..invalid')).not.toThrow();
      const element = querySelector('..invalid');
      expect(element).toBeNull();
    });
  });

  describe('Real-world scenarios', () => {
    it('should query element in Web Component with shadow DOM', () => {
      // Simulate a real web component structure
      const component = document.createElement('div');
      component.id = 'web-component';
      const shadow = component.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          .toolbar { background: #333; }
        </style>
        <div class="toolbar">
          <button class="action-button">Click me</button>
        </div>
      `;
      document.body.appendChild(component);

      const button = querySelector('#web-component >>> .action-button');
      expect(button).not.toBeNull();
      expect(button?.tagName).toBe('BUTTON');
      expect(button?.textContent).toBe('Click me');
    });

    it('should return null when querying removed element', () => {
      document.body.innerHTML = '<div class="temporary">Temp</div>';
      const element = querySelector('.temporary');
      expect(element).not.toBeNull();

      // Remove the element
      document.body.innerHTML = '';

      // Query again - should return null
      const removedElement = querySelector('.temporary');
      expect(removedElement).toBeNull();
    });
  });
});
