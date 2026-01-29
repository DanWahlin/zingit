// client/src/utils/markdown.ts
// Format markers for export

import type { Marker } from '../types/index.js';

export function formatMarkersMarkdown(markers: Marker[], pageUrl: string, pageTitle: string): string {
  let md = `# UI Markers\n\n`;
  md += `**Page:** ${pageTitle}\n`;
  md += `**URL:** ${pageUrl}\n`;
  md += `**Date:** ${new Date().toISOString()}\n\n`;
  md += `---\n\n`;

  markers.forEach((marker, i) => {
    md += `## ${i + 1}. ${marker.identifier}\n\n`;
    md += `**Selector:** \`${marker.selector}\`\n\n`;
    md += `**Notes:** ${marker.notes}\n\n`;

    if (marker.selectedText) {
      md += `**Selected Text:** "${marker.selectedText}"\n\n`;
    }

    md += `**HTML:**\n\`\`\`html\n${marker.html}\n\`\`\`\n\n`;
    md += `---\n\n`;
  });

  return md;
}

export function formatMarkersJson(markers: Marker[], pageUrl: string, pageTitle: string): string {
  const data = {
    page: {
      url: pageUrl,
      title: pageTitle,
      timestamp: new Date().toISOString()
    },
    markers: markers.map(marker => ({
      id: marker.id,
      selector: marker.selector,
      identifier: marker.identifier,
      notes: marker.notes,
      selectedText: marker.selectedText || null,
      html: marker.html
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
