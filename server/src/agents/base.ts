// server/src/agents/base.ts

import type { WebSocket } from 'ws';
import type { Agent, AgentSession, BatchData } from '../types.js';

export abstract class BaseAgent implements Agent {
  abstract name: string;
  abstract model: string;

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract createSession(ws: WebSocket, projectDir: string): Promise<AgentSession>;

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

` : ''}${ann.parentHtml ? `**Parent Context (target marked with data-pokeui-target="true"):**
\`\`\`html
${ann.parentHtml}
\`\`\`

` : ''}${ann.textContent ? `**Text Content:** "${ann.textContent}"` : ''}
${ann.selectedText ? `**Selected Text:** "${ann.selectedText}"` : ''}
${ann.parentContext ? `**Parent Path:** \`${ann.parentContext}\`` : ''}
**CSS Selector:** \`${ann.selector}\`

`;
    });

    prompt += `
CRITICAL INSTRUCTIONS:
1. CAREFULLY identify the CORRECT element to modify:
   - The "Position in DOM" shows which element among siblings is the target (marked with "← THIS ONE")
   - The "Parent Context" HTML shows the element with data-pokeui-target="true" attribute - THAT is the one to change
   - Do NOT change other similar elements that happen to have matching text

2. Search for the parent context HTML in source files to find the exact location

3. Make ONLY the requested change to the specific marked element

4. If there are multiple similar elements (e.g., multiple <button> tags), use the positional context to identify the correct one`;
    return prompt;
  }
}
