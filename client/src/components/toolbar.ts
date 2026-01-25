// client/src/components/toolbar.ts
// Toolbar with status, actions, and controls

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('zing-toolbar')
export class ZingToolbar extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #1f2937;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #9ca3af;
    }

    .status.clickable {
      cursor: pointer;
      padding: 4px 8px;
      margin: -4px -8px;
      border-radius: 4px;
      transition: background 0.15s ease;
    }

    .status.clickable:hover {
      background: #374151;
      color: #d1d5db;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #6b7280;
    }

    .status-dot.connected {
      background: #22c55e;
    }

    .status-dot.processing {
      background: #fbbf24;
      animation: pulse 1s ease-in-out infinite;
    }

    .status-dot.error {
      background: #ef4444;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .divider {
      width: 1px;
      height: 20px;
      background: #374151;
    }

    .count {
      font-size: 12px;
      color: #d1d5db;
      min-width: 80px;
    }

    button {
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 500;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #2563eb;
    }

    .btn-secondary {
      background: #374151;
      color: #d1d5db;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #4b5563;
    }

    .btn-danger {
      background: #dc2626;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #b91c1c;
    }

    .btn-reconnect {
      background: #f59e0b;
      color: white;
    }

    .btn-reconnect:hover:not(:disabled) {
      background: #d97706;
    }

    .btn-icon {
      padding: 6px;
      background: transparent;
      color: #9ca3af;
    }

    .btn-icon:hover {
      color: white;
      background: #374151;
    }

    .btn-icon.active {
      color: #3b82f6;
      background: #1e3a5f;
    }

    .btn-toggle {
      padding: 6px 10px;
      background: #22c55e;
      color: white;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-toggle:hover {
      background: #16a34a;
    }

    .btn-toggle.inactive {
      background: #6b7280;
    }

    .btn-toggle.inactive:hover {
      background: #4b5563;
    }

    .drag-handle {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px 2px;
      cursor: grab;
      color: #6b7280;
      transition: color 0.15s ease;
    }

    .drag-handle:hover {
      color: #9ca3af;
    }

    .drag-handle:active {
      cursor: grabbing;
    }
  `;

  @property({ type: Boolean }) active = true;
  @property({ type: Boolean }) connected = false;
  @property({ type: Boolean }) processing = false;
  @property({ type: Boolean }) maxAttemptsReached = false;
  @property({ type: Number }) annotationCount = 0;
  @property({ type: Boolean }) canUndo = false;
  @property({ type: String }) agent = '';
  @property({ type: String }) model = '';
  @property({ type: Boolean }) responseOpen = false;  // Whether the response panel is open
  @property({ type: Boolean }) historyOpen = false;   // Whether the history panel is open

  render() {
    const statusClass = this.maxAttemptsReached
      ? 'error'
      : this.processing
        ? 'processing'
        : this.connected
          ? 'connected'
          : '';

    const statusText = this.maxAttemptsReached
      ? 'Disconnected'
      : this.processing
        ? 'Processing...'
        : this.connected
          ? `${this.agent || 'Agent'}`
          : 'Connecting...';

    return html`
      <div class="toolbar">
        <div class="drag-handle" title="Drag to move (double-click to reset)" @mousedown=${this.handleDragStart} @dblclick=${this.handleDragReset}>
          <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
            <circle cx="3" cy="3" r="1.5"/>
            <circle cx="9" cy="3" r="1.5"/>
            <circle cx="3" cy="8" r="1.5"/>
            <circle cx="9" cy="8" r="1.5"/>
            <circle cx="3" cy="13" r="1.5"/>
            <circle cx="9" cy="13" r="1.5"/>
          </svg>
        </div>

        <button
          class="btn-toggle ${this.active ? '' : 'inactive'}"
          title="${this.active ? 'Pause annotation mode' : 'Resume annotation mode'}"
          @click=${this.handleToggle}
        >
          ${this.active ? 'ON' : 'OFF'}
        </button>

        <div class="divider"></div>

        <div
          class="status ${this.connected && this.agent ? 'clickable' : ''}"
          title="${this.connected && this.agent ? 'Change AI agent' : ''}"
          @click=${this.handleAgentClick}
        >
          <span class="status-dot ${statusClass}"></span>
          <span>${statusText}</span>
        </div>

        <div class="divider"></div>

        <div class="count">
          ${this.annotationCount} annotation${this.annotationCount !== 1 ? 's' : ''}
        </div>

        <div class="divider"></div>

        ${this.maxAttemptsReached
          ? html`
              <button
                class="btn-reconnect"
                @click=${this.handleReconnect}
              >
                Reconnect
              </button>
            `
          : html`
              <button
                class="btn-icon"
                ?disabled=${!this.connected || this.processing || this.annotationCount === 0}
                title="Send to ${this.agent ? this.agent.charAt(0).toUpperCase() + this.agent.slice(1) : 'Agent'}"
                @click=${this.handleSend}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <!-- Robot head -->
                  <rect x="5" y="8" width="14" height="12" rx="2"/>
                  <!-- Eyes -->
                  <circle cx="9" cy="13" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="15" cy="13" r="1.5" fill="currentColor" stroke="none"/>
                  <!-- Antenna -->
                  <line x1="12" y1="8" x2="12" y2="4"/>
                  <circle cx="12" cy="3" r="1"/>
                  <!-- Mouth -->
                  <line x1="9" y1="17" x2="15" y2="17"/>
                </svg>
              </button>
            `
        }

        <button
          class="btn-icon ${this.responseOpen ? 'active' : ''}"
          title="${this.responseOpen ? 'Hide agent console' : 'Show agent console'}"
          @click=${this.handleToggleResponse}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4 17 10 11 4 5"/>
            <line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
        </button>

        <div class="divider"></div>

        <button
          class="btn-icon"
          ?disabled=${!this.canUndo}
          title="Undo (Ctrl+Z)"
          @click=${this.handleUndo}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7v6h6"/>
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 13"/>
          </svg>
        </button>

        <button
          class="btn-icon ${this.historyOpen ? 'active' : ''}"
          title="Change History"
          @click=${this.handleHistory}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>

        <button
          class="btn-icon"
          ?disabled=${this.annotationCount === 0}
          title="Copy annotations as Markdown"
          @click=${this.handleExport}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="8" y="8" width="12" height="14" rx="2"/>
            <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>
          </svg>
        </button>

        <button
          class="btn-icon"
          ?disabled=${this.annotationCount === 0}
          title="Clear all annotations"
          @click=${this.handleClear}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 21h14"/>
            <path d="M12 17V3"/>
            <path d="M8 21c0-4 1.5-7 4-7s4 3 4 7"/>
            <path d="M6 21c0-5 2-9 6-9s6 4 6 9"/>
          </svg>
        </button>

        <div class="divider"></div>

        <button
          class="btn-icon"
          title="Help"
          @click=${this.handleHelp}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.5 9a2.5 2.5 0 1 1 3 2.4 1.5 1.5 0 0 0-.5 1.1v.5"/>
            <circle cx="12" cy="17" r=".5" fill="currentColor"/>
          </svg>
        </button>

        <button
          class="btn-icon"
          title="Settings"
          @click=${this.handleSettings}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        <button
          class="btn-icon"
          title="Close ZingIt"
          @click=${this.handleClose}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;
  }

  private handleSend() {
    this.dispatchEvent(new CustomEvent('send', { bubbles: true, composed: true }));
  }

  private handleExport() {
    this.dispatchEvent(new CustomEvent('export', { bubbles: true, composed: true }));
  }

  private handleClear() {
    this.dispatchEvent(new CustomEvent('clear', { bubbles: true, composed: true }));
  }

  private handleHelp() {
    this.dispatchEvent(new CustomEvent('help', { bubbles: true, composed: true }));
  }

  private handleSettings() {
    this.dispatchEvent(new CustomEvent('settings', { bubbles: true, composed: true }));
  }

  private handleClose() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private handleReconnect() {
    this.dispatchEvent(new CustomEvent('reconnect', { bubbles: true, composed: true }));
  }

  private handleToggle() {
    this.dispatchEvent(new CustomEvent('toggle', { bubbles: true, composed: true }));
  }

  private handleUndo() {
    this.dispatchEvent(new CustomEvent('undo', { bubbles: true, composed: true }));
  }

  private handleToggleResponse() {
    this.dispatchEvent(new CustomEvent('toggle-response', { bubbles: true, composed: true }));
  }

  private handleHistory() {
    this.dispatchEvent(new CustomEvent('toggle-history', { bubbles: true, composed: true }));
  }

  private handleAgentClick() {
    if (this.connected && this.agent) {
      this.dispatchEvent(new CustomEvent('change-agent', { bubbles: true, composed: true }));
    }
  }

  private handleDragStart(e: MouseEvent) {
    e.preventDefault();
    this.dispatchEvent(new CustomEvent('drag-start', {
      bubbles: true,
      composed: true,
      detail: { clientX: e.clientX, clientY: e.clientY }
    }));
  }

  private handleDragReset(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('drag-reset', {
      bubbles: true,
      composed: true
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-toolbar': ZingToolbar;
  }
}
