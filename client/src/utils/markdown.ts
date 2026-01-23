// client/src/utils/markdown.ts
// Format annotations for export

import type { Annotation } from '../types/index.js';

export function formatAnnotationsMarkdown(annotations: Annotation[], pageUrl: string, pageTitle: string): string {
  let md = `# UI Annotations\n\n`;
  md += `**Page:** ${pageTitle}\n`;
  md += `**URL:** ${pageUrl}\n`;
  md += `**Date:** ${new Date().toISOString()}\n\n`;
  md += `---\n\n`;

  annotations.forEach((ann, i) => {
    md += `## ${i + 1}. ${ann.identifier}\n\n`;
    md += `**Selector:** \`${ann.selector}\`\n\n`;
    md += `**Notes:** ${ann.notes}\n\n`;

    if (ann.selectedText) {
      md += `**Selected Text:** "${ann.selectedText}"\n\n`;
    }

    md += `**HTML:**\n\`\`\`html\n${ann.html}\n\`\`\`\n\n`;
    md += `---\n\n`;
  });

  return md;
}

export function formatAnnotationsJson(annotations: Annotation[], pageUrl: string, pageTitle: string): string {
  const data = {
    page: {
      url: pageUrl,
      title: pageTitle,
      timestamp: new Date().toISOString()
    },
    annotations: annotations.map(ann => ({
      id: ann.id,
      selector: ann.selector,
      identifier: ann.identifier,
      notes: ann.notes,
      selectedText: ann.selectedText || null,
      html: ann.html
    }))
  };

  return JSON.stringify(data, null, 2);
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }

  // Fallback for older browsers
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      resolve();
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(textarea);
    }
  });
}
