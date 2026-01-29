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

export function saveMarkers(markers: Marker[]): void {
  try {
    const data = {
      url: window.location.href,
      markers,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('ZingIt: Failed to save markers', err);
  }
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
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('ZingIt: Failed to clear markers', err);
  }
}

const defaultSettings: ZingSettings = {
  wsUrl: 'ws://localhost:3000',
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
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('ZingIt: Failed to save settings', err);
  }
}

export function loadSettings(): ZingSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;

    const saved = JSON.parse(raw);
    return { ...defaultSettings, ...saved };
  } catch {
    return defaultSettings;
  }
}

export function saveMarkActive(active: boolean): void {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
  } catch (err) {
    console.warn('ZingIt: Failed to save active state', err);
  }
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

export function saveToolbarPosition(position: ToolbarPosition): void {
  try {
    localStorage.setItem(TOOLBAR_POS_KEY, JSON.stringify(position));
  } catch (err) {
    console.warn('ZingIt: Failed to save toolbar position', err);
  }
}

export function loadToolbarPosition(): ToolbarPosition | null {
  try {
    const raw = localStorage.getItem(TOOLBAR_POS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearToolbarPosition(): void {
  try {
    localStorage.removeItem(TOOLBAR_POS_KEY);
  } catch (err) {
    console.warn('ZingIt: Failed to clear toolbar position', err);
  }
}

/**
 * Save response dialog state to sessionStorage (persists across auto-refresh)
 */
export function saveResponseState(state: ResponseState): void {
  try {
    sessionStorage.setItem(RESPONSE_STATE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('ZingIt: Failed to save response state', err);
  }
}

/**
 * Load response dialog state from sessionStorage
 */
export function loadResponseState(): ResponseState | null {
  try {
    const raw = sessionStorage.getItem(RESPONSE_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clear response dialog state from sessionStorage
 */
export function clearResponseState(): void {
  try {
    sessionStorage.removeItem(RESPONSE_STATE_KEY);
  } catch (err) {
    console.warn('ZingIt: Failed to clear response state', err);
  }
}
