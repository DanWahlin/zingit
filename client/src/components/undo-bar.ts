// client/src/components/undo-bar.ts
// Undo toast bar that appears after changes are applied

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('zing-undo-bar')
export class ZingUndoBar extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .bar {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #1f2937;
      color: #f3f4f6;
      padding: 12px 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      transition: transform 0.3s ease;
      z-index: 2147483646;
      border: 1px solid #374151;
    }

    .bar.visible {
      transform: translateX(-50%) translateY(0);
    }

    .content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .icon {
      width: 20px;
      height: 20px;
      color: #22c55e;
    }

    .message {
      font-size: 13px;
      max-width: 300px;
    }

    .message strong {
      color: #fff;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .undo-btn {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .undo-btn:hover {
      background: #2563eb;
    }

    .dismiss-btn {
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

    .dismiss-btn:hover {
      background: #374151;
      color: #f3f4f6;
    }

    .progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: #3b82f6;
      border-radius: 0 0 8px 8px;
      transition: width linear;
    }

    .keyboard-hint {
      font-size: 11px;
      color: #6b7280;
      margin-left: 4px;
    }

    kbd {
      background: #374151;
      border-radius: 3px;
      padding: 2px 5px;
      font-size: 10px;
      font-family: inherit;
      border: 1px solid #4b5563;
    }
  `;

  @property({ type: Boolean }) visible = false;
  @property({ type: String }) message = 'Changes applied';
  @property({ type: Number }) filesModified = 0;
  @property({ type: Number }) timeout = 10000;

  @state() private remainingTime = 0;
  private _timeoutId?: number;
  private _intervalId?: number;
  private _startTime = 0;

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('visible')) {
      if (this.visible) {
        this._startTimeout();
      } else {
        this._clearTimers();
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._clearTimers();
  }

  private _startTimeout() {
    this._clearTimers();
    this._startTime = Date.now();
    this.remainingTime = this.timeout;

    // Update progress bar
    this._intervalId = window.setInterval(() => {
      this.remainingTime = Math.max(0, this.timeout - (Date.now() - this._startTime));
      if (this.remainingTime <= 0) {
        this._handleDismiss();
      }
    }, 50);

    // Backup timeout
    this._timeoutId = window.setTimeout(() => {
      this._handleDismiss();
    }, this.timeout + 100);
  }

  private _clearTimers() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = undefined;
    }
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = undefined;
    }
  }

  render() {
    const progressWidth = (this.remainingTime / this.timeout) * 100;

    return html`
      <div class="bar ${this.visible ? 'visible' : ''}">
        <div class="content">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span class="message">
            <strong>${this.filesModified} file${this.filesModified !== 1 ? 's' : ''}</strong> modified
          </span>
        </div>

        <div class="actions">
          <button class="undo-btn" @click=${this._handleUndo}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7v6h6"/>
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 13"/>
            </svg>
            Undo
          </button>
          <span class="keyboard-hint">
            <kbd>Ctrl</kbd>+<kbd>Z</kbd>
          </span>
          <button class="dismiss-btn" @click=${this._handleDismiss} title="Dismiss">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="progress" style="width: ${progressWidth}%"></div>
      </div>
    `;
  }

  private _handleUndo() {
    this._clearTimers();
    this.dispatchEvent(new CustomEvent('undo', { bubbles: true, composed: true }));
  }

  private _handleDismiss() {
    this._clearTimers();
    this.dispatchEvent(new CustomEvent('dismiss', { bubbles: true, composed: true }));
  }

  // Public method to programmatically dismiss
  dismiss() {
    this._handleDismiss();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-undo-bar': ZingUndoBar;
  }
}
