// client/src/components/toast.ts
// Toast notifications for user feedback

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration: number;
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

  show(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) {
    const id = crypto.randomUUID();
    const toast: ToastMessage = { id, message, type, duration };
    this.toasts = [...this.toasts, toast];

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  success(message: string, duration = 3000) {
    this.show(message, 'success', duration);
  }

  error(message: string, duration = 5000) {
    this.show(message, 'error', duration);
  }

  info(message: string, duration = 3000) {
    this.show(message, 'info', duration);
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
            ${toast.message}
          </div>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-toast': ZingToast;
  }
}
