// client/src/utils/geometry.ts
// Geometry utilities for positioning overlays

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

/**
 * Get element rect in page coordinates (for absolute positioning)
 */
export function getElementRect(element: Element): Rect {
  const domRect = element.getBoundingClientRect();
  return {
    top: domRect.top + window.scrollY,
    left: domRect.left + window.scrollX,
    width: domRect.width,
    height: domRect.height,
    bottom: domRect.bottom + window.scrollY,
    right: domRect.right + window.scrollX
  };
}

/**
 * Get element rect in viewport coordinates (for fixed positioning)
 */
export function getElementViewportRect(element: Element): Rect {
  const domRect = element.getBoundingClientRect();
  return {
    top: domRect.top,
    left: domRect.left,
    width: domRect.width,
    height: domRect.height,
    bottom: domRect.bottom,
    right: domRect.right
  };
}

export function getViewportRect(): Rect {
  return {
    top: window.scrollY,
    left: window.scrollX,
    width: window.innerWidth,
    height: window.innerHeight,
    bottom: window.scrollY + window.innerHeight,
    right: window.scrollX + window.innerWidth
  };
}

export function isInViewport(rect: Rect, viewport: Rect): boolean {
  return (
    rect.bottom > viewport.top &&
    rect.top < viewport.bottom &&
    rect.right > viewport.left &&
    rect.left < viewport.right
  );
}

export function getMarkerPosition(elementRect: Rect, viewport?: { width: number; height: number }): { top: number; left: number } {
  const markerSize = 24;
  const padding = 4; // Minimum distance from viewport edge

  // Position marker at top-left corner of element
  let top = elementRect.top - 12;
  let left = elementRect.left - 12;

  // Clamp to viewport bounds if viewport is provided
  if (viewport) {
    // Keep marker within horizontal bounds
    if (left < padding) {
      left = padding;
    } else if (left + markerSize > viewport.width - padding) {
      left = viewport.width - markerSize - padding;
    }

    // Keep marker within vertical bounds
    if (top < padding) {
      top = padding;
    } else if (top + markerSize > viewport.height - padding) {
      top = viewport.height - markerSize - padding;
    }
  }

  return { top, left };
}

/**
 * Add padding around a rect (for highlight breathing room)
 */
export function addPadding(rect: Rect, padding: number): Rect {
  return {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + (padding * 2),
    height: rect.height + (padding * 2),
    bottom: rect.bottom + padding,
    right: rect.right + padding
  };
}

/**
 * Clip a rect to viewport boundaries (for highlighting large elements like body)
 * Only clips edges that extend beyond the viewport, preserving the element's actual size otherwise
 */
export function clipToViewport(rect: Rect): Rect {
  // Add inset to ensure borders are visible
  // Use larger inset for bottom/right to account for browser chrome and scrollbars
  const topInset = 4;
  const leftInset = 4;
  const bottomInset = 8;   // Small inset to keep bottom border visible but close to edge
  const rightInset = 20;   // Larger inset for scrollbar

  const viewport = {
    top: topInset,
    left: leftInset,
    bottom: window.innerHeight - bottomInset,
    right: window.innerWidth - rightInset
  };

  // Clip edges that extend beyond viewport OR come very close to edges
  // Force clipping if element is within 30px of viewport edge to ensure borders stay visible
  const forceClipThreshold = 30;

  const top = rect.top < viewport.top ? viewport.top : rect.top;
  const left = rect.left < viewport.left ? viewport.left : rect.left;

  // Force clip bottom if element extends close to or beyond viewport bottom
  const bottom = rect.bottom > viewport.bottom - forceClipThreshold ? viewport.bottom : rect.bottom;

  // Force clip right if element extends close to or beyond viewport right
  const right = rect.right > viewport.right - forceClipThreshold ? viewport.right : rect.right;

  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    bottom,
    right
  };
}

export function getHighlightStyles(rect: Rect): Record<string, string> {
  return {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  };
}
