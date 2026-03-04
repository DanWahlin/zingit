// client/src/services/storage.ts
// Persist markers in localStorage

import type { Marker, ZingSettings } from '../types/index.js';

const STORAGE_KEY = 'zingit_marks';
const SETTINGS_KEY = 'zingit_settings';
const ACTIVE_KEY = 'zingit_active';
const TOOLBAR_POS_KEY = 'zingit_toolbar_position';
const RESPONSE_STATE_KEY = 'zingit_response_state';

export interface ResponseState {
  open: boolean;
  content: string;
  error: string;
  screenshotCount: number;
}

export interface ToolbarPosition {
  x: number;
  y: number;
}

// --- Storage helpers to reduce repetitive try-catch blocks ---

function safeSet(storage: Storage, key: string, value: unknown, label: string): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`ZingIt: Failed to save ${label}`, err);
  }
}

function safeGet<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeRemove(storage: Storage, key: string, label: string): void {
  try {
    storage.removeItem(key);
  } catch (err) {
    console.warn(`ZingIt: Failed to clear ${label}`, err);
  }
}

// --- Markers ---

export function saveMarkers(markers: Marker[]): void {
  safeSet(localStorage, STORAGE_KEY, {
    url: window.location.href,
    markers,
    timestamp: Date.now()
  }, 'markers');
}

export function loadMarkers(): Marker[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const data = JSON.parse(raw);

    // Only load if same URL
    if (data.url !== window.location.href) {
      return [];
    }

    // Validate structure
    if (!Array.isArray(data.markers)) {
      return [];
    }

    return data.markers;
  } catch {
    return [];
  }
}

export function clearMarkers(): void {
  safeRemove(localStorage, STORAGE_KEY, 'markers');
}

// --- Settings ---

const defaultSettings: ZingSettings = {
  wsUrl: `ws://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3000`,
  highlightColor: '#fbbf24',
  markerColor: '#3b82f6',       // Pending (blue)
  processingColor: '#ef4444',   // Processing (red)
  completedColor: '#22c55e',    // Completed (green)
  projectDir: '',               // Empty = use server default
  playSoundOnComplete: true,    // Play ding when agent completes
  selectedAgent: '',            // Empty = show agent picker on first connect
  autoRefresh: false,           // Auto refresh page when agent completes (disabled by default)
  // Undo/Redo features
  showUndoBar: true,            // Show undo toast after changes (default: true)
  undoBarTimeout: 10000,        // Undo bar auto-dismiss timeout ms (default: 10000)
};

export function saveSettings(settings: ZingSettings): void {
  safeSet(localStorage, SETTINGS_KEY, settings, 'settings');
}

export function loadSettings(): ZingSettings {
  const saved = safeGet<Partial<ZingSettings>>(localStorage, SETTINGS_KEY);
  return saved ? { ...defaultSettings, ...saved } : defaultSettings;
}

// --- Active state ---

export function saveMarkActive(active: boolean): void {
  safeSet(localStorage, ACTIVE_KEY, active, 'active state');
}

export function loadMarkActive(): boolean {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (raw === null) return true; // Default to active
    return JSON.parse(raw);
  } catch {
    return true;
  }
}

// --- Toolbar position ---

export function saveToolbarPosition(position: ToolbarPosition): void {
  safeSet(localStorage, TOOLBAR_POS_KEY, position, 'toolbar position');
}

export function loadToolbarPosition(): ToolbarPosition | null {
  return safeGet<ToolbarPosition>(localStorage, TOOLBAR_POS_KEY);
}

export function clearToolbarPosition(): void {
  safeRemove(localStorage, TOOLBAR_POS_KEY, 'toolbar position');
}

// --- Response state (sessionStorage — persists across auto-refresh only) ---

/**
 * Save response dialog state to sessionStorage (persists across auto-refresh)
 */
export function saveResponseState(state: ResponseState): void {
  safeSet(sessionStorage, RESPONSE_STATE_KEY, state, 'response state');
}

/**
 * Load response dialog state from sessionStorage
 */
export function loadResponseState(): ResponseState | null {
  return safeGet<ResponseState>(sessionStorage, RESPONSE_STATE_KEY);
}

/**
 * Clear response dialog state from sessionStorage
 */
export function clearResponseState(): void {
  safeRemove(sessionStorage, RESPONSE_STATE_KEY, 'response state');
}
