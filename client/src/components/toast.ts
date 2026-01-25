// client/src/components/toast.ts
// Toast notifications for user feedback

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
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
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.2s ease-out;
      pointer-events: auto;
      max-width: 300px;
      text-align: center;
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

  show(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000, action?: { label: string; callback: () => void }) {
    const id = crypto.randomUUID();
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
            <div class="toast-content">
              <span>${toast.message}</span>
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
