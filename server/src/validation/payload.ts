// server/src/validation/payload.ts

import type { BatchData, Marker } from '../types.js';

// ============================================
// Payload Validation
// ============================================

export const MAX_MARKERS = 50;
export const MAX_HTML_LENGTH = 50000;
export const MAX_NOTES_LENGTH = 5000;
export const MAX_SELECTOR_LENGTH = 1000;
export const MAX_SCREENSHOT_SIZE = 5000000; // ~5MB base64 (matches Claude API limit)

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedData?: BatchData;
}

const VALID_STATUSES = ['pending', 'processing', 'completed'];

function validateMarker(marker: Marker, index: number): { valid: boolean; error?: string } {
  if (!marker.id || typeof marker.id !== 'string') {
    return { valid: false, error: `Marker ${index}: missing or invalid id` };
  }
  if (!marker.identifier || typeof marker.identifier !== 'string') {
    return { valid: false, error: `Marker ${index}: missing or invalid identifier` };
  }
  if (marker.status && !VALID_STATUSES.includes(marker.status)) {
    return { valid: false, error: `Marker ${index}: invalid status '${marker.status}'` };
  }
  if (marker.selector && marker.selector.length > MAX_SELECTOR_LENGTH) {
    return { valid: false, error: `Marker ${index}: selector too long (max ${MAX_SELECTOR_LENGTH})` };
  }
  if (marker.html && marker.html.length > MAX_HTML_LENGTH) {
    return { valid: false, error: `Marker ${index}: html too long (max ${MAX_HTML_LENGTH})` };
  }
  if (marker.notes && marker.notes.length > MAX_NOTES_LENGTH) {
    return { valid: false, error: `Marker ${index}: notes too long (max ${MAX_NOTES_LENGTH})` };
  }
  if (marker.screenshot && marker.screenshot.length > MAX_SCREENSHOT_SIZE) {
    return { valid: false, error: `Marker ${index}: screenshot too large (max ${MAX_SCREENSHOT_SIZE / 1000}KB)` };
  }
  return { valid: true };
}

export function validateBatchData(data: BatchData): ValidationResult {
  if (!data) {
    return { valid: false, error: 'Missing batch data' };
  }

  if (!data.markers || !Array.isArray(data.markers)) {
    return { valid: false, error: 'Missing or invalid markers array' };
  }

  if (data.markers.length === 0) {
    return { valid: false, error: 'No markers provided' };
  }

  if (data.markers.length > MAX_MARKERS) {
    return { valid: false, error: `Too many markers (max ${MAX_MARKERS})` };
  }

  // Validate each marker
  for (let i = 0; i < data.markers.length; i++) {
    const result = validateMarker(data.markers[i], i);
    if (!result.valid) {
      return { valid: false, error: result.error };
    }
  }

  // Sanitize and return
  return {
    valid: true,
    sanitizedData: {
      ...data,
      pageUrl: data.pageUrl ? data.pageUrl.slice(0, 2000) : data.pageUrl,
      pageTitle: data.pageTitle ? data.pageTitle.slice(0, 500) : data.pageTitle,
    }
  };
}
