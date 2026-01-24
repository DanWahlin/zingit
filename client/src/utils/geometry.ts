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

export function getHighlightStyles(rect: Rect): Record<string, string> {
  return {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  };
}
