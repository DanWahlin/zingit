// client/src/index.ts
// Entry point for ZingIt - Public API

import './components/zing-ui.js';
import './components/site-header.js';
import './components/site-footer.js';
import type { ZingSettings } from './types/index.js';
import { saveSettings, loadSettings } from './services/storage.js';

interface ZingItAPI {
  init(options?: Partial<ZingSettings>): void;
  connect(wsUrl: string): void;
  destroy(): void;
  isActive(): boolean;
}

// Internal state
let zingUIElement: HTMLElement | null = null;

/**
 * Initialize ZingIt with optional settings
 */
function init(options?: Partial<ZingSettings>): void {
  // Remove existing instance if present
  if (zingUIElement) {
    zingUIElement.remove();
    zingUIElement = null;
  }

  // Update settings if provided
  if (options) {
    const currentSettings = loadSettings();
    const newSettings = { ...currentSettings, ...options };
    saveSettings(newSettings);
  }

  // Create and append ZingIt
  zingUIElement = document.createElement('zing-ui');
  document.body.appendChild(zingUIElement);
}

/**
 * Connect to a specific WebSocket URL
 */
function connect(wsUrl: string): void {
  init({ wsUrl });
}

/**
 * Destroy the ZingIt instance
 */
function destroy(): void {
  if (zingUIElement) {
    zingUIElement.remove();
    zingUIElement = null;
  }
}

/**
 * Check if ZingIt is currently active
 */
function isActive(): boolean {
  return zingUIElement !== null && document.body.contains(zingUIElement);
}

// Create the global ZingIt API
const ZingItAPI: ZingItAPI = {
  init,
  connect,
  destroy,
  isActive
};

// Export as global for IIFE bundle
if (typeof window !== 'undefined') {
  (window as any).ZingIt = ZingItAPI;
}

// Auto-inject when script loads (for demo pages)
// Only auto-inject if explicitly requested via data attribute or query param
const shouldAutoInject =
  document.currentScript?.getAttribute('data-auto-init') === 'true' ||
  new URLSearchParams(window.location.search).has('zingit');

if (shouldAutoInject) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
}

// Export for ES module usage
export default ZingItAPI;
export { init, connect, destroy, isActive };
