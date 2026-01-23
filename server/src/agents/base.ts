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

IMPORTANT: Search for the HTML content shown below within files in the project directory.
Look for the exact text content to find the right file to edit.

`;

    data.annotations.forEach((ann, i) => {
      prompt += `---

## Annotation ${i + 1}: ${ann.identifier}

**Selector:** \`${ann.selector}\`
${ann.parentContext ? `**Parent Elements:** \`${ann.parentContext}\`` : ''}
**Notes:** ${ann.notes}
${ann.selectedText ? `**Selected Text:** "${ann.selectedText}"` : ''}
${ann.textContent ? `**Text Content:** "${ann.textContent}"` : ''}

**HTML Context (search for this content in the project files):**
\`\`\`html
${ann.html}
\`\`\`

`;
    });

    prompt += `
INSTRUCTIONS:
1. Use the HTML content above to search for the source file containing this code
2. The HTML shows the actual rendered content - search for the text within it
3. Once found, make the requested changes from the notes
4. Only edit the specific elements mentioned, don't change unrelated code`;
    return prompt;
  }
}
