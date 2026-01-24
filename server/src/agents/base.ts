// server/src/agents/base.ts

import type { WebSocket } from 'ws';
import type { Agent, AgentSession, BatchData, ImageContent } from '../types.js';

// Maximum image size: 10MB (base64 encoded)
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export abstract class BaseAgent implements Agent {
  abstract name: string;
  abstract model: string;

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract createSession(ws: WebSocket, projectDir: string): Promise<AgentSession>;

  /**
   * Format a prompt with image metadata for agents that don't support native multimodal.
   * This adds text descriptions of the images to the prompt.
   */
  protected formatPromptWithImageMetadata(prompt: string, images?: ImageContent[]): string {
    if (!images || images.length === 0) {
      return prompt;
    }

    let header = `The following screenshots are provided for visual context:\n\n`;
    for (const img of images) {
      const sizeKB = Math.round(img.base64.length / 1024);
      header += `${img.label || 'Screenshot'}:\n[Image data: ${img.mediaType}, ${sizeKB}KB]\n\n`;
    }
    return `${header}---\n\n${prompt}`;
  }

  /**
   * Extract images from batch data annotations
   * Returns an array of ImageContent objects for annotations that have screenshots
   */
  extractImages(data: BatchData): ImageContent[] {
    const images: ImageContent[] = [];

    data.annotations.forEach((ann, i) => {
      if (ann.screenshot) {
        let base64Data = ann.screenshot;
        let mediaType = 'image/png'; // Default

        // Extract media type and base64 data from data URL if present
        if (base64Data.startsWith('data:')) {
          const prefixMatch = base64Data.match(/^data:(image\/[a-z+]+);base64,/i);
          if (prefixMatch) {
            mediaType = prefixMatch[1];
            base64Data = base64Data.slice(prefixMatch[0].length);
          } else {
            // Fallback: just find the comma and extract data
            const commaIndex = base64Data.indexOf(',');
            if (commaIndex > 0) {
              base64Data = base64Data.slice(commaIndex + 1);
            }
          }
        }

        // Validate base64 format:
        // 1. Check for valid characters
        // 2. Check length is divisible by 4 (required for valid base64)
        // 3. Check padding is correct
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Data || !base64Regex.test(base64Data) || base64Data.length % 4 !== 0) {
          console.warn(`ZingIt: Invalid base64 data in annotation ${i + 1}, skipping screenshot`);
          return; // Skip this annotation's screenshot
        }

        // Check image size limit (base64 is ~33% larger than binary)
        const estimatedBinarySize = Math.ceil(base64Data.length * 0.75);
        if (estimatedBinarySize > MAX_IMAGE_SIZE_BYTES) {
          console.warn(`ZingIt: Image in annotation ${i + 1} exceeds ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB limit, skipping`);
          return; // Skip oversized image
        }

        // Validate that base64 can be decoded (catches corrupted data)
        try {
          Buffer.from(base64Data, 'base64');
        } catch (err) {
          console.warn(`ZingIt: Failed to decode base64 in annotation ${i + 1}, skipping screenshot:`, err);
          return; // Skip this annotation's screenshot
        }

        images.push({
          base64: base64Data,
          mediaType,
          label: `Screenshot of Annotation ${i + 1}: ${ann.identifier}`
        });
      }
    });

    return images;
  }

  formatPrompt(data: BatchData, projectDir: string): string {
    let prompt = `You are fixing UI issues on a webpage. The project is located at: ${projectDir}

Page: ${data.pageTitle}
URL: ${data.pageUrl}

`;

    data.annotations.forEach((ann, i) => {
      prompt += `---

## Annotation ${i + 1}: ${ann.identifier}

**Requested Change:** ${ann.notes}

**Target Element HTML:**
\`\`\`html
${ann.html}
\`\`\`

${ann.siblingContext ? `**Position in DOM:**
${ann.siblingContext}

` : ''}${ann.parentHtml ? `**Parent Context (target marked with data-zingit-target="true"):**
\`\`\`html
${ann.parentHtml}
\`\`\`

` : ''}${ann.textContent ? `**Text Content:** "${ann.textContent}"` : ''}
${ann.selectedText ? `**Selected Text:** "${ann.selectedText}"` : ''}
${ann.parentContext ? `**Parent Path:** \`${ann.parentContext}\`` : ''}
**CSS Selector:** \`${ann.selector}\`

`;
    });

    // Check if any annotations have screenshots
    const hasScreenshots = data.annotations.some(ann => ann.screenshot);

    prompt += `
CRITICAL INSTRUCTIONS:
1. CAREFULLY identify the CORRECT element to modify:
   - The "Position in DOM" shows which element among siblings is the target (marked with "← THIS ONE")
   - The "Parent Context" HTML shows the element with data-zingit-target="true" attribute - THAT is the one to change
     (Note: data-zingit-target is the marker attribute - keep in sync with client/src/services/selector.ts)
   - Do NOT change other similar elements that happen to have matching text

2. Search for the parent context HTML in source files to find the exact location

3. Make ONLY the requested change to the specific marked element

4. If there are multiple similar elements (e.g., multiple <button> tags), use the positional context to identify the correct one`;

    if (hasScreenshots) {
      prompt += `

5. Screenshots have been provided showing the current visual state of the annotated elements. Use these images to:
   - Better understand the visual context and styling of the elements
   - Identify the exact appearance that needs to be changed
   - Verify you're targeting the correct element based on its visual representation`;
    }

    return prompt;
  }
}
