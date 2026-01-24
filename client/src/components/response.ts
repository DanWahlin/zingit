// client/src/components/response.ts
// Response panel with safe streaming display

import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

interface ContentSegment {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

@customElement('zing-response')
export class ZingResponse extends LitElement {
  static styles = css`
    :host {
      display: none;
    }

    :host([open]) {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.5);
      z-index: 2147483646;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: auto;
    }

    .panel {
      width: 500px;
      max-height: 60vh;
      background: #1f2937;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #374151;
    }

    .title {
      font-size: 14px;
      font-weight: 600;
      color: white;
      margin: 0;
    }

    .close-btn {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: #9ca3af;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .close-btn:hover {
      background: #374151;
      color: white;
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
      font-family: 'SF Mono', Monaco, 'Consolas', monospace;
      font-size: 13px;
      color: #e5e7eb;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .text-block {
      margin: 8px 0;
      white-space: pre-wrap;
      word-break: break-word;
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

    button {
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      background: #3b82f6;
      color: white;
    }

    button:hover {
      background: #2563eb;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean }) processing = false;
  @property({ type: String }) content = '';
  @property({ type: String }) toolStatus = '';
  @property({ type: String }) error = '';

  @state() private followUpMessage = '';
  @query('.content') private contentEl!: HTMLElement;

  updated(changedProperties: Map<string, unknown>) {
    // Auto-scroll when content changes
    if (changedProperties.has('content') && this.contentEl) {
      this.contentEl.scrollTop = this.contentEl.scrollHeight;
    }
  }

  render() {
    if (!this.open) {
      return nothing;
    }

    return html`
      <div class="panel">
        <div class="header">
          <h3 class="title">Agent Response</h3>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${this.processing ? html`
              <button class="stop-btn" @click=${this.handleStop}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
                Stop
              </button>
            ` : this.content ? html`
              <button class="refresh-btn" @click=${this.handleRefresh}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M23 4v6h-6"/>
                  <path d="M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Refresh
              </button>
            ` : ''}
            <button class="close-btn" @click=${this.handleClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="content">
          ${this.toolStatus ? html`
            <div class="tool-status">
              <div class="spinner"></div>
              <span>${this.toolStatus}</span>
            </div>
          ` : ''}

          ${this.error ? html`
            <div class="error">${this.error}</div>
          ` : ''}

          ${this.renderContent()}
        </div>

        <div class="footer">
          <div class="input-row">
            <input
              type="text"
              placeholder="Follow-up message..."
              .value=${this.followUpMessage}
              @input=${this.handleInputChange}
              @keydown=${this.handleInputKeydown}
              ?disabled=${this.processing}
            />
            <button
              @click=${this.handleSendFollowUp}
              ?disabled=${this.processing || !this.followUpMessage.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private parseContent(content: string): ContentSegment[] {
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

  private renderContent() {
    if (!this.content) {
      return html`<div class="text-block">Waiting for response...</div>`;
    }

    const segments = this.parseContent(this.content);

    return segments.map(segment => {
      if (segment.type === 'code') {
        return html`<div class="code-block">${segment.content}</div>`;
      }
      // Parse text into action steps for better readability
      return this.renderTextAsSteps(segment.content);
    });
  }

  private renderTextAsSteps(text: string) {
    // Split on sentence boundaries that typically indicate new actions
    // Look for: period/colon followed by capital letter (with optional space)
    const steps = text
      .split(/(?<=[.:])\s*(?=[A-Z][a-z])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (steps.length <= 1) {
      // If we can't split meaningfully, render as plain text
      return html`<div class="text-block">${text}</div>`;
    }

    return steps.map(step => {
      const stepClass = this.classifyStep(step);
      return html`<div class="action-step ${stepClass}">${step}</div>`;
    });
  }

  private classifyStep(step: string): string {
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

  private handleClose() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private handleStop() {
    this.dispatchEvent(new CustomEvent('stop', { bubbles: true, composed: true }));
  }

  private handleRefresh() {
    window.location.reload();
  }

  private handleInputChange(e: Event) {
    this.followUpMessage = (e.target as HTMLInputElement).value;
  }

  private handleInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.handleSendFollowUp();
    }
  }

  private handleSendFollowUp() {
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
    'zing-response': ZingResponse;
  }
}
