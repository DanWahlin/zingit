// server/src/validation/payload.ts

import type { BatchData, Annotation } from '../types.js';

// ============================================
// Payload Validation
// ============================================

export const MAX_ANNOTATIONS = 50;
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

function validateAnnotation(annotation: Annotation, index: number): { valid: boolean; error?: string } {
  if (!annotation.id || typeof annotation.id !== 'string') {
    return { valid: false, error: `Annotation ${index}: missing or invalid id` };
  }
  if (!annotation.identifier || typeof annotation.identifier !== 'string') {
    return { valid: false, error: `Annotation ${index}: missing or invalid identifier` };
  }
  if (annotation.status && !VALID_STATUSES.includes(annotation.status)) {
    return { valid: false, error: `Annotation ${index}: invalid status '${annotation.status}'` };
  }
  if (annotation.selector && annotation.selector.length > MAX_SELECTOR_LENGTH) {
    return { valid: false, error: `Annotation ${index}: selector too long (max ${MAX_SELECTOR_LENGTH})` };
  }
  if (annotation.html && annotation.html.length > MAX_HTML_LENGTH) {
    return { valid: false, error: `Annotation ${index}: html too long (max ${MAX_HTML_LENGTH})` };
  }
  if (annotation.notes && annotation.notes.length > MAX_NOTES_LENGTH) {
    return { valid: false, error: `Annotation ${index}: notes too long (max ${MAX_NOTES_LENGTH})` };
  }
  if (annotation.screenshot && annotation.screenshot.length > MAX_SCREENSHOT_SIZE) {
    return { valid: false, error: `Annotation ${index}: screenshot too large (max ${MAX_SCREENSHOT_SIZE / 1000}KB)` };
  }
  return { valid: true };
}

export function validateBatchData(data: BatchData): ValidationResult {
  if (!data) {
    return { valid: false, error: 'Missing batch data' };
  }

  if (!data.annotations || !Array.isArray(data.annotations)) {
    return { valid: false, error: 'Missing or invalid annotations array' };
  }

  if (data.annotations.length === 0) {
    return { valid: false, error: 'No annotations provided' };
  }

  if (data.annotations.length > MAX_ANNOTATIONS) {
    return { valid: false, error: `Too many annotations (max ${MAX_ANNOTATIONS})` };
  }

  // Validate each annotation
  for (let i = 0; i < data.annotations.length; i++) {
    const result = validateAnnotation(data.annotations[i], i);
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
