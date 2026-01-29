// client/src/services/selector.ts
// Generate unique CSS selectors for DOM elements

/**
 * Get the parent element, crossing Shadow DOM boundaries if needed
 */
function getParentElementCrossShadow(element: Element): Element | null {
  // First try normal parentElement
  if (element.parentElement) {
    return element.parentElement;
  }

  // If no parentElement, check if we're at a shadow root boundary
  const root = element.getRootNode();
  if (root instanceof ShadowRoot) {
    // Return the shadow host (the custom element)
    return root.host;
  }

  return null;
}

/**
 * Get the shadow host element if the element is inside Shadow DOM
 */
function getShadowHost(element: Element): Element | null {
  const root = element.getRootNode();
  if (root instanceof ShadowRoot) {
    return root.host;
  }
  return null;
}

/**
 * Generate a unique CSS selector for a DOM element, including Shadow DOM support.
 *
 * For elements inside Shadow DOM, the selector uses a special notation:
 * `host-selector >>> shadow-selector`
 *
 * The `>>>` separator indicates Shadow DOM piercing. For example:
 * - `zing-ui >>> .toolbar` - selects .toolbar inside zing-ui's shadow root
 * - `my-app >>> nested-component >>> .button` - traverses multiple shadow boundaries
 *
 * Important: This notation is specific to ZingIt and must be parsed by the
 * querySelector() function in this module. It is NOT valid CSS. The `>>>` syntax
 * was used in older Shadow DOM specs but was deprecated. We use it here as a
 * convenient notation for our marker system.
 *
 * The selector prioritizes:
 * 1. Element ID (most specific)
 * 2. Combination of tag name, classes, and nth-child position
 *
 * @param element - The DOM element to generate a selector for
 * @returns A CSS selector string, potentially with >>> for shadow DOM piercing
 */
export function generateSelector(element: Element): string {
  // Check if element is inside Shadow DOM
  const shadowHost = getShadowHost(element);

  // For elements inside Shadow DOM, we need a different approach:
  // Generate a selector relative to the shadow host, prefixed with the host selector
  if (shadowHost) {
    const hostSelector = generateSelector(shadowHost);
    const internalSelector = generateSelectorWithinRoot(element, shadowHost.shadowRoot!);
    // Use a special notation to indicate shadow DOM piercing
    return `${hostSelector} >>> ${internalSelector}`;
  }

  // Try ID first (most specific)
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  return generateSelectorWithinRoot(element, document);
}

/**
 * Generate a selector for an element within a specific root (document or shadow root)
 */
function generateSelectorWithinRoot(element: Element, root: Document | ShadowRoot): string {
  // Try ID first (most specific)
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Build path from element to root
  const path: string[] = [];
  let current: Element | null = element;
  const rootNode = root instanceof Document ? document.documentElement : root.host;

  while (current && current !== rootNode) {
    let selector = current.tagName.toLowerCase();

    // Add classes for specificity
    if (current.classList.length > 0) {
      const classes = Array.from(current.classList)
        .filter(c => !c.startsWith('zing-')) // Exclude our own classes
        .slice(0, 2) // Limit to 2 classes
        .map(c => `.${CSS.escape(c)}`)
        .join('');
      selector += classes;
    }

    // Add nth-child if needed for uniqueness
    const parent: Element | null = current.parentElement;
    if (parent) {
      const currentTag = current.tagName;
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === currentTag
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);

    // Check if current path is unique within this root
    const fullSelector = path.join(' > ');
    try {
      const matches = root.querySelectorAll(fullSelector);
      if (matches.length === 1 && matches[0] === element) {
        return fullSelector;
      }
    } catch {
      // Invalid selector, continue building path
    }

    // Move to parent, but stop at shadow root boundary
    current = current.parentElement;
  }

  return path.join(' > ');
}

export function generateIdentifier(element: Element): string {
  const tag = element.tagName.toLowerCase();

  // Check if inside Shadow DOM and get host info
  const shadowHost = getShadowHost(element);
  const hostPrefix = shadowHost ? `${shadowHost.tagName.toLowerCase()} > ` : '';

  // Use ID if available
  if (element.id) {
    return `${hostPrefix}#${element.id}`;
  }

  // Use first meaningful class
  const meaningfulClass = Array.from(element.classList)
    .filter(c => !c.startsWith('zing-'))
    .find(c => c.length > 2 && !c.match(/^[a-z]{1,2}$/));

  if (meaningfulClass) {
    return `${hostPrefix}.${meaningfulClass}`;
  }

  // Use text content preview
  const text = element.textContent?.trim().slice(0, 20);
  if (text) {
    return `${hostPrefix}${tag}: "${text}${text.length >= 20 ? '...' : ''}"`;
  }

  return `${hostPrefix}${tag}`;
}

export function getParentContext(element: Element, levels = 2): string {
  const parents: string[] = [];
  let current = getParentElementCrossShadow(element);

  for (let i = 0; i < levels && current && current !== document.body; i++) {
    const tag = current.tagName.toLowerCase();
    const id = current.id ? `#${current.id}` : '';
    const classes = Array.from(current.classList)
      .filter(c => !c.startsWith('zing-'))
      .slice(0, 2)
      .map(c => `.${c}`)
      .join('');

    // Mark if this is a shadow host boundary
    const isShadowHost = current.shadowRoot !== null;
    const marker = isShadowHost ? ' (shadow-host)' : '';

    parents.push(`${tag}${id}${classes}${marker}`);
    current = getParentElementCrossShadow(current);
  }

  return parents.join(' > ');
}

/**
 * Get siblings of the element to provide positional context
 * This helps the agent identify which element among similar ones
 */
export function getSiblingContext(element: Element): string {
  const parent = element.parentElement;
  if (!parent) return '';

  const siblings = Array.from(parent.children);
  const index = siblings.indexOf(element);
  const total = siblings.length;

  if (total === 1) {
    return 'Only child element';
  }

  // Get preview of siblings for context
  const siblingPreviews = siblings.map((sib, i) => {
    const tag = sib.tagName.toLowerCase();
    const rawText = sib.textContent?.trim() || '';
    const text = rawText.slice(0, 30);
    const ellipsis = rawText.length > 30 ? '...' : '';
    const marker = i === index ? ' ← THIS ONE' : '';
    return `  ${i + 1}. <${tag}>${text}${ellipsis}</${tag}>${marker}`;
  }).join('\n');

  return `Position ${index + 1} of ${total} in parent:\n${siblingPreviews}`;
}

/**
 * Marker attribute used to identify the target element in parent HTML context.
 * IMPORTANT: Keep in sync with server/src/agents/base.ts formatPrompt()
 */
export const TARGET_MARKER_ATTR = 'data-zingit-target';

/**
 * Get the parent element's HTML with the target element marked
 * This provides crucial context for finding the right element in source files
 */
export function getParentHtml(element: Element, maxLength = 1000): string {
  try {
    const parent = element.parentElement;
    if (!parent || parent === document.body) {
      return '';
    }

    // Clone parent and mark the target element
    const clone = parent.cloneNode(true) as Element;

    // Find the corresponding element in the clone by index
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);
    const cloneChildren = Array.from(clone.children);

    if (index >= 0 && index < cloneChildren.length) {
      // Add a marker attribute to identify the target element
      const target = cloneChildren[index];
      target.setAttribute(TARGET_MARKER_ATTR, 'true');
    }

    // Remove script tags for safety
    clone.querySelectorAll('script').forEach(s => s.remove());

    let html = clone.outerHTML;

    // Truncate if too long while preserving structure
    if (html.length > maxLength) {
      html = html.slice(0, maxLength) + '\n<!-- ... truncated ... -->';
    }

    return html;
  } catch {
    // Handle edge cases like detached elements or exotic DOM nodes
    return '';
  }
}

export function getTextContent(element: Element, maxLength = 200): string {
  const text = element.textContent?.trim() || '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function getElementHtml(element: Element, maxLength = 500): string {
  const clone = element.cloneNode(true) as Element;

  // Remove script tags for safety
  clone.querySelectorAll('script').forEach(s => s.remove());

  let html = clone.outerHTML;

  // Truncate if too long
  if (html.length > maxLength) {
    // Try to get a meaningful snippet
    const openTag = html.match(/^<[^>]+>/)?.[0] || '';
    const closeTag = html.match(/<\/[^>]+>$/)?.[0] || '';
    const content = html.slice(openTag.length, html.length - closeTag.length);

    if (content.length > maxLength - openTag.length - closeTag.length - 10) {
      html = openTag + content.slice(0, maxLength - openTag.length - closeTag.length - 10) + '...' + closeTag;
    }
  }

  return html;
}

/**
 * Query an element using a selector that may contain shadow DOM piercing (>>>)
 *
 * For elements inside Shadow DOM, the selector uses a special notation:
 * `host-selector >>> shadow-selector`
 *
 * The `>>>` separator indicates Shadow DOM piercing. For example:
 * - `zing-ui >>> .toolbar` - selects .toolbar inside zing-ui's shadow root
 * - `my-app >>> nested-component >>> .button` - traverses multiple shadow boundaries
 *
 * Important: This notation is specific to ZingIt and must be parsed by this function.
 * It is NOT valid CSS. The `>>>` syntax was used in older Shadow DOM specs but was
 * deprecated. We use it here as a convenient notation for our marker system.
 *
 * @param selector - CSS selector, potentially with >>> for shadow DOM piercing
 * @returns The matching element or null
 */
export function querySelector(selector: string): Element | null {
  // Validate input
  if (!selector || typeof selector !== 'string') {
    console.warn('querySelector: Invalid selector provided');
    return null;
  }

  // Trim whitespace to prevent parsing issues
  selector = selector.trim();
  if (selector.length === 0) {
    return null;
  }

  // Check if selector contains shadow DOM piercing
  if (!selector.includes('>>>')) {
    // Regular selector - use standard querySelector
    return document.querySelector(selector);
  }

  // Split on >>> and traverse shadow DOM
  const parts = selector.split('>>>').map(s => s.trim());

  // Validate that all parts are non-empty
  if (parts.some(part => part.length === 0)) {
    console.warn('querySelector: Selector contains empty parts after splitting on >>>');
    return null;
  }

  let current: Document | ShadowRoot = document;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Query within current root (document or shadow root)
    const element: Element | null = current.querySelector(part);

    if (!element) {
      return null;
    }

    // If this is the last part, return the element
    if (i === parts.length - 1) {
      return element;
    }

    // Otherwise, descend into shadow root for next part
    if (!element.shadowRoot) {
      // Expected shadow DOM but element doesn't have shadowRoot
      console.warn(`Element ${part} expected to have shadowRoot but doesn't`);
      return null;
    }

    current = element.shadowRoot;
  }

  return null;
}
