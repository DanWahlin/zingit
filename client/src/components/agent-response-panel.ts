// client/src/components/agent-response-panel.ts
// Slide-in panel for agent responses with streaming display

import { LitElement, html, css } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

interface ContentSegment {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

@customElement('zing-agent-response-panel')
export class ZingAgentResponsePanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: auto;
    }

    .panel {
      position: fixed;
      right: 0;
      top: 0;
      width: min(400px, 100vw);
      max-width: 100vw;
      height: 100vh;
      background: #1f2937;
      border-left: 1px solid #374151;
      transform: translateX(100%);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      z-index: 2147483645;
      display: flex;
      flex-direction: column;
      pointer-events: auto;
    }

    .panel.open {
      transform: translateX(0);
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
    }

    @media (max-width: 480px) {
      .panel {
        width: 100vw;
        border-left: none;
      }
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid #374151;
      background: #111827;
    }

    .header h3 {
      margin: 0;
      color: #f3f4f6;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-icon {
      width: 18px;
      height: 18px;
      color: #9ca3af;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .close-btn {
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.15s ease;
    }

    .close-btn:hover {
      background: #374151;
      color: #f3f4f6;
    }

    .stop-btn {
      background: #ef4444;
      border: none;
      padding: 4px 10px;
      cursor: pointer;
      color: white;
      font-size: 12px;
      font-weight: 500;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
    }

    .stop-btn:hover {
      background: #dc2626;
    }

    .refresh-btn {
      background: #22c55e;
      border: none;
      padding: 4px 10px;
      cursor: pointer;
      color: white;
      font-size: 12px;
      font-weight: 500;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
    }

    .refresh-btn:hover {
      background: #16a34a;
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      font-size: 14px;
      line-height: 1.6;
      color: #d1d5db;
    }

    .content::-webkit-scrollbar {
      width: 6px;
    }

    .content::-webkit-scrollbar-track {
      background: transparent;
    }

    .content::-webkit-scrollbar-thumb {
      background: #4b5563;
      border-radius: 3px;
    }

    .tool-status {
      padding: 8px 12px;
      background: #111827;
      border-radius: 6px;
      font-size: 12px;
      color: #9ca3af;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .tool-status .spinner {
      width: 12px;
      height: 12px;
      border: 2px solid #374151;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .code-block {
      background: #111827;
      border-radius: 6px;
      padding: 12px;
      margin: 8px 0;
      overflow-x: auto;
      max-width: 100%;
      font-family: 'SF Mono', Monaco, 'Consolas', monospace;
      font-size: 13px;
      color: #e5e7eb;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    .text-block {
      margin: 8px 0;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    @media (max-width: 480px) {
      .code-block {
        font-size: 11px;
        padding: 10px;
        border-radius: 4px;
      }
    }

    .loading-container {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 8px 0;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #374151;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .action-step {
      padding: 10px 12px;
      background: rgba(59, 130, 246, 0.1);
      border-left: 3px solid #3b82f6;
      border-radius: 0 6px 6px 0;
      margin: 8px 0;
      font-size: 13px;
      line-height: 1.5;
    }

    .action-step strong {
      font-weight: 600;
      color: #f3f4f6;
    }

    .action-step em {
      font-style: italic;
      color: #e5e7eb;
    }

    .action-step.check {
      background: rgba(251, 191, 36, 0.1);
      border-left-color: #fbbf24;
    }

    .action-step.result {
      background: rgba(34, 197, 94, 0.1);
      border-left-color: #22c55e;
    }

    .action-step.observation {
      background: rgba(156, 163, 175, 0.1);
      border-left-color: #9ca3af;
    }

    .error {
      color: #f87171;
      background: rgba(248, 113, 113, 0.1);
      padding: 8px 12px;
      border-radius: 6px;
      border-left: 3px solid #f87171;
    }

    .footer {
      padding: 12px 16px;
      border-top: 1px solid #374151;
      background: #111827;
    }

    .input-row {
      display: flex;
      gap: 8px;
    }

    input {
      flex: 1;
      padding: 8px 12px;
      font-size: 14px;
      font-family: inherit;
      background: #111827;
      border: 1px solid #374151;
      border-radius: 6px;
      color: white;
    }

    input:focus {
      outline: none;
      border-color: #3b82f6;
    }

    input::placeholder {
      color: #6b7280;
    }

    .send-btn {
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      background: #3b82f6;
      color: white;
      transition: all 0.15s ease;
    }

    .send-btn:hover {
      background: #2563eb;
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .screenshot-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 6px;
      font-size: 12px;
      color: #60a5fa;
      margin-bottom: 12px;
    }

    .screenshot-badge svg {
      flex-shrink: 0;
    }

    /* Mobile responsive styles */
    @media (max-width: 480px) {
      .header {
        padding: 12px;
      }

      .header h3 {
        font-size: 13px;
      }

      .content {
        padding: 12px;
        font-size: 13px;
      }

      .footer {
        padding: 10px 12px;
      }

      input {
        padding: 10px 12px;
        font-size: 16px; /* Prevent iOS zoom */
      }

      .send-btn {
        padding: 10px 14px;
        font-size: 13px;
      }

      .action-step {
        padding: 8px 10px;
        font-size: 12px;
      }

      .tool-status {
        font-size: 11px;
        padding: 6px 10px;
      }

      .screenshot-badge {
        font-size: 11px;
        padding: 5px 8px;
      }
    }

    @media (max-width: 375px) {
      .header h3 {
        font-size: 12px;
        gap: 6px;
      }

      .header-icon {
        width: 16px;
        height: 16px;
      }

      .stop-btn,
      .refresh-btn {
        padding: 3px 8px;
        font-size: 11px;
      }

      .close-btn svg {
        width: 16px;
        height: 16px;
      }
    }
  `;

  @property({ type: Boolean }) isOpen = false;
  @property({ type: Boolean }) processing = false;
  @property({ type: Boolean }) autoRefresh = false;
  @property({ type: String }) content = '';
  @property({ type: String }) toolStatus = '';
  @property({ type: String }) error = '';
  @property({ type: Number }) screenshotCount = 0;
  @property({ type: String }) agentName = '';

  @state() private followUpMessage = '';
  @query('.content') private contentEl!: HTMLElement;

  updated(changedProperties: Map<string, unknown>) {
    // Auto-scroll when content changes
    if (changedProperties.has('content') && this.contentEl) {
      this.contentEl.scrollTop = this.contentEl.scrollHeight;
    }
  }

  render() {
    return html`
      <div class="panel ${this.isOpen ? 'open' : ''}" @click=${this._stopPropagation} @mousedown=${this._stopPropagation} @pointerdown=${this._stopPropagation}>
        <div class="header">
          <h3>
            <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Agent Response
          </h3>
          <div class="header-actions">
            ${this.processing ? html`
              <button class="stop-btn" @click=${this._handleStop}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
                Stop
              </button>
            ` : this.content && !this.autoRefresh ? html`
              <button class="refresh-btn" @click=${this._handleRefresh}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M23 4v6h-6"/>
                  <path d="M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Refresh
              </button>
            ` : ''}
            <button class="close-btn" @click=${this._handleClose} title="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="content">
          ${this.screenshotCount > 0 ? html`
            <div class="screenshot-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>${this.screenshotCount} screenshot${this.screenshotCount > 1 ? 's' : ''} included</span>
            </div>
          ` : ''}

          ${this.toolStatus ? html`
            <div class="tool-status">
              <div class="spinner"></div>
              <span>${this.toolStatus}</span>
            </div>
          ` : ''}

          ${this.error ? html`
            <div class="error">${this.error}</div>
          ` : ''}

          ${this._renderContent()}
        </div>

        <div class="footer">
          <div class="input-row">
            <input
              type="text"
              placeholder="Send agent message..."
              .value=${this.followUpMessage}
              @input=${this._handleInputChange}
              @keydown=${this._handleInputKeydown}
              ?disabled=${this.processing}
            />
            <button
              class="send-btn"
              @click=${this._handleSendFollowUp}
              ?disabled=${this.processing || !this.followUpMessage.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private _parseContent(content: string): ContentSegment[] {
    const segments: ContentSegment[] = [];
    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;

    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Text before code block
      if (match.index > lastIndex) {
        const text = content.slice(lastIndex, match.index);
        if (text.trim()) {
          segments.push({ type: 'text', content: text });
        }
      }

      // Code block
      segments.push({
        type: 'code',
        language: match[1] || undefined,
        content: match[2]
      });

      lastIndex = match.index + match[0].length;
    }

    // Remaining text
    if (lastIndex < content.length) {
      const text = content.slice(lastIndex);
      if (text.trim()) {
        segments.push({ type: 'text', content: text });
      }
    }

    return segments;
  }

  private _renderContent() {
    if (!this.content) {
      if (this.processing) {
        const agentDisplay = this.agentName ? ` from ${this.agentName}` : '';
        return html`
          <div class="loading-container">
            <div class="spinner"></div>
            <div>Waiting for response${agentDisplay}...</div>
          </div>
        `;
      }
      return html`<div class="text-block" style="color: #6b7280;">Add markers or type a message below to get started.</div>`;
    }

    const segments = this._parseContent(this.content);

    return segments.map(segment => {
      if (segment.type === 'code') {
        return html`<div class="code-block">${segment.content}</div>`;
      }
      // Parse text into action steps for better readability
      return this._renderTextAsSteps(segment.content);
    });
  }

  private _renderTextAsSteps(text: string) {
    // Split on clear sentence boundaries or markdown headers
    // Look for: period/newline followed by space and capital letter, or markdown ## headers
    const steps = text
      .split(/(?<=\.)\s+(?=[A-Z][a-z])|(?=\n##\s)/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (steps.length === 0) {
      return html``;
    }

    // Always render as styled action steps for consistency (preserve Image #3 blockquote styling)
    return steps.map(step => {
      const stepClass = this._classifyStep(step);
      // Parse markdown and return safe Lit template
      return html`<div class="action-step ${stepClass}">${this._parseMarkdownToTemplate(step)}</div>`;
    });
  }

  private _parseMarkdownToTemplate(text: string) {
    // Parse markdown into safe Lit template parts
    const parts: any[] = [];
    let currentIndex = 0;

    // Regex to find markdown patterns (bold, italic, code)
    const markdownRegex = /(\*\*(.+?)\*\*)|(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|`([^`]+)`/g;
    let match;

    while ((match = markdownRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        parts.push(this._textWithLineBreaks(text.slice(currentIndex, match.index)));
      }

      // Add the formatted match
      if (match[2]) {
        // Bold: **text**
        parts.push(html`<strong>${match[2]}</strong>`);
      } else if (match[3]) {
        // Italic: *text*
        parts.push(html`<em>${match[3]}</em>`);
      } else if (match[4]) {
        // Inline code: `text`
        parts.push(html`<code style="background: rgba(59, 130, 246, 0.15); padding: 2px 6px; border-radius: 3px; font-family: monospace;">${match[4]}</code>`);
      }

      currentIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(this._textWithLineBreaks(text.slice(currentIndex)));
    }

    return parts;
  }

  private _textWithLineBreaks(text: string) {
    // Split by newlines and join with <br> elements
    const lines = text.split('\n');
    const result: any[] = [];

    lines.forEach((line, index) => {
      result.push(line);
      if (index < lines.length - 1) {
        result.push(html`<br>`);
      }
    });

    return result;
  }

  private _classifyStep(step: string): string {
    const lower = step.toLowerCase();

    // Check/investigation actions (yellow)
    if (lower.startsWith('let me check') ||
        lower.startsWith('let me look') ||
        lower.startsWith('let me run') ||
        lower.startsWith('let me also') ||
        lower.startsWith('looking at') ||
        lower.startsWith('checking')) {
      return 'check';
    }

    // Results/conclusions (green)
    if (lower.startsWith('added') ||
        lower.startsWith('updated') ||
        lower.startsWith('created') ||
        lower.startsWith('removed') ||
        lower.startsWith('fixed') ||
        lower.startsWith('changed')) {
      return 'result';
    }

    // Observations/notes (gray)
    if (lower.startsWith('i don\'t see') ||
        lower.startsWith('i can see') ||
        lower.startsWith('there\'s no') ||
        lower.startsWith('there is no') ||
        lower.startsWith('the ') ||
        lower.startsWith('it\'s possible') ||
        lower.startsWith('perhaps') ||
        lower.startsWith('however')) {
      return 'observation';
    }

    // Default action (blue)
    return '';
  }

  private _stopPropagation(e: Event) {
    e.stopPropagation();
  }

  private _handleClose(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private _handleStop(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('stop', { bubbles: true, composed: true }));
  }

  private _handleRefresh() {
    window.location.reload();
  }

  private _handleInputChange(e: Event) {
    this.followUpMessage = (e.target as HTMLInputElement).value;
  }

  private _handleInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this._handleSendFollowUp();
    }
  }

  private _handleSendFollowUp() {
    if (!this.followUpMessage.trim() || this.processing) return;

    this.dispatchEvent(new CustomEvent('followup', {
      bubbles: true,
      composed: true,
      detail: { message: this.followUpMessage }
    }));
    this.followUpMessage = '';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-agent-response-panel': ZingAgentResponsePanel;
  }
}
