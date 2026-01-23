// client/src/services/selector.ts
// Generate unique CSS selectors for DOM elements

export function generateSelector(element: Element): string {
  // Try ID first (most specific)
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Build path from element to root
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    // Add classes for specificity
    if (current.classList.length > 0) {
      const classes = Array.from(current.classList)
        .filter(c => !c.startsWith('poke-')) // Exclude our own classes
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

    // Check if current path is unique
    const fullSelector = path.join(' > ');
    try {
      const matches = document.querySelectorAll(fullSelector);
      if (matches.length === 1 && matches[0] === element) {
        return fullSelector;
      }
    } catch {
      // Invalid selector, continue building path
    }

    current = parent;
  }

  return path.join(' > ');
}

export function generateIdentifier(element: Element): string {
  const tag = element.tagName.toLowerCase();

  // Use ID if available
  if (element.id) {
    return `#${element.id}`;
  }

  // Use first meaningful class
  const meaningfulClass = Array.from(element.classList)
    .filter(c => !c.startsWith('poke-'))
    .find(c => c.length > 2 && !c.match(/^[a-z]{1,2}$/));

  if (meaningfulClass) {
    return `.${meaningfulClass}`;
  }

  // Use text content preview
  const text = element.textContent?.trim().slice(0, 20);
  if (text) {
    return `${tag}: "${text}${text.length >= 20 ? '...' : ''}"`;
  }

  return tag;
}

export function getParentContext(element: Element, levels = 2): string {
  const parents: string[] = [];
  let current = element.parentElement;

  for (let i = 0; i < levels && current && current !== document.body; i++) {
    const tag = current.tagName.toLowerCase();
    const id = current.id ? `#${current.id}` : '';
    const classes = Array.from(current.classList)
      .filter(c => !c.startsWith('poke-'))
      .slice(0, 2)
      .map(c => `.${c}`)
      .join('');
    parents.push(`${tag}${id}${classes}`);
    current = current.parentElement;
  }

  return parents.join(' > ');
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
