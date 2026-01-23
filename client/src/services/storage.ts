// client/src/services/storage.ts
// Persist annotations in localStorage

import type { Annotation, ZingSettings } from '../types/index.js';

const STORAGE_KEY = 'zingit_annotations';
const SETTINGS_KEY = 'zingit_settings';
const ACTIVE_KEY = 'zingit_active';

export function saveAnnotations(annotations: Annotation[]): void {
  try {
    const data = {
      url: window.location.href,
      annotations,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('ZingIt: Failed to save annotations', err);
  }
}

export function loadAnnotations(): Annotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const data = JSON.parse(raw);

    // Only load if same URL
    if (data.url !== window.location.href) {
      return [];
    }

    // Validate structure
    if (!Array.isArray(data.annotations)) {
      return [];
    }

    return data.annotations;
  } catch {
    return [];
  }
}

export function clearAnnotations(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('ZingIt: Failed to clear annotations', err);
  }
}

const defaultSettings: ZingSettings = {
  wsUrl: 'ws://localhost:8765',
  highlightColor: '#fbbf24',
  markerColor: '#3b82f6',       // Pending (blue)
  processingColor: '#ef4444',   // Processing (red)
  completedColor: '#22c55e',    // Completed (green)
  autoConnect: true,
  projectDir: '',               // Empty = use server default
  playSoundOnComplete: true,    // Play ding when agent completes
  selectedAgent: '',            // Empty = show agent picker on first connect
  autoRefresh: false            // Auto refresh page when agent completes (disabled by default)
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

export function saveAnnotationActive(active: boolean): void {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
  } catch (err) {
    console.warn('ZingIt: Failed to save active state', err);
  }
}

export function loadAnnotationActive(): boolean {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (raw === null) return true; // Default to active
    return JSON.parse(raw);
  } catch {
    return true;
  }
}
