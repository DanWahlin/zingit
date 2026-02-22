// client/src/components/toast.ts
// Toast notifications for user feedback

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration: number;
  action?: {
    label: string;
    callback: () => void;
  };
}

@customElement('zing-toast')
export class ZingToast extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .toast-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
    }

    .toast {
      position: relative;
      padding: 12px 36px 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.2s ease-out;
      pointer-events: auto;
      max-width: 400px;
      text-align: left;
      line-height: 1.5;
    }

    .toast.success {
      background: #059669;
      color: white;
    }

    .toast.error {
      background: #dc2626;
      color: white;
    }

    .toast.info {
      background: #1f2937;
      color: white;
      border: 1px solid #374151;
    }

    .toast.warning {
      background: #1f2937;
      color: white;
      border-left: 4px solid #f59e0b;
    }

    .toast.exiting {
      animation: slideDown 0.2s ease-in forwards;
    }

    .toast-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .toast-action {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      padding: 4px 10px;
      border-radius: 4px;
      color: white;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .toast-action:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .toast-close {
      position: absolute;
      top: 8px;
      right: 8px;
      background: transparent;
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      opacity: 0.6;
      transition: opacity 0.15s ease;
    }

    .toast-close:hover {
      opacity: 1;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideDown {
      from {
        opacity: 1;
        transform: translateY(0);
      }
      to {
        opacity: 0;
        transform: translateY(10px);
      }
    }
  `;

  @state() private toasts: ToastMessage[] = [];
  private exitingIds = new Set<string>();

  show(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration = 3000, action?: { label: string; callback: () => void }) {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const toast: ToastMessage = { id, message, type, duration, action };
    this.toasts = [...this.toasts, toast];

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;  // Return ID so caller can dismiss early if needed
  }

  success(message: string, duration = 3000) {
    return this.show(message, 'success', duration);
  }

  error(message: string, duration = 5000) {
    return this.show(message, 'error', duration);
  }

  info(message: string, duration = 3000, action?: { label: string; callback: () => void }) {
    return this.show(message, 'info', duration, action);
  }

  private dismiss(id: string) {
    this.exitingIds.add(id);
    this.requestUpdate();

    setTimeout(() => {
      this.exitingIds.delete(id);
      this.toasts = this.toasts.filter(t => t.id !== id);
    }, 200);
  }

  render() {
    if (this.toasts.length === 0) {
      return html``;
    }

    return html`
      <div class="toast-container">
        ${this.toasts.map(toast => html`
          <div class="toast ${toast.type} ${this.exitingIds.has(toast.id) ? 'exiting' : ''}">
            ${toast.duration === 0 ? html`
              <button class="toast-close" @click=${() => this.dismiss(toast.id)} title="Dismiss">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            ` : ''}
            <div class="toast-content">
              <span style="white-space: pre-line;">${toast.message}</span>
              ${toast.action ? html`
                <button class="toast-action" @click=${() => this.handleAction(toast)}>
                  ${toast.action.label}
                </button>
              ` : ''}
            </div>
          </div>
        `)}
      </div>
    `;
  }

  private handleAction(toast: ToastMessage) {
    if (toast.action) {
      toast.action.callback();
      this.dismiss(toast.id);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-toast': ZingToast;
  }
}
