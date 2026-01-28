// client/src/components/help.ts
// Keyboard shortcuts help overlay

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('zing-help')
export class ZingHelp extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      pointer-events: auto;
    }

    .panel {
      background: #1f2937;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #f9fafb;
    }

    .close-btn {
      background: transparent;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .close-btn:hover {
      color: white;
    }

    .shortcuts {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .shortcut {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .shortcut-desc {
      color: #d1d5db;
      font-size: 14px;
    }

    .shortcut-keys {
      display: flex;
      gap: 4px;
    }

    kbd {
      background: #374151;
      color: #f9fafb;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: inherit;
      border: 1px solid #4b5563;
    }

    .divider {
      height: 1px;
      background: #374151;
      margin: 16px 0;
    }

    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
  `;

  @property({ type: Boolean }) open = false;

  render() {
    if (!this.open) return null;

    return html`
      <div class="overlay" @click=${this.handleOverlayClick}>
        <div class="panel" @click=${(e: Event) => e.stopPropagation()}>
          <div class="header">
            <h2>Keyboard Shortcuts</h2>
            <button class="close-btn" @click=${this.handleClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="section-title">Annotation Mode</div>
          <div class="shortcuts">
            <div class="shortcut">
              <span class="shortcut-desc">Toggle annotation mode</span>
              <div class="shortcut-keys"><kbd>Z</kbd></div>
            </div>
            <div class="shortcut">
              <span class="shortcut-desc">Undo last annotation</span>
              <div class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Z</kbd></div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="section-title">Panels</div>
          <div class="shortcuts">
            <div class="shortcut">
              <span class="shortcut-desc">Toggle ZingIt visibility</span>
              <div class="shortcut-keys"><kbd>\`</kbd></div>
            </div>
            <div class="shortcut">
              <span class="shortcut-desc">Close panel/modal</span>
              <div class="shortcut-keys"><kbd>Esc</kbd></div>
            </div>
            <div class="shortcut">
              <span class="shortcut-desc">Show this help</span>
              <div class="shortcut-keys"><kbd>?</kbd></div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="section-title">In Modal</div>
          <div class="shortcuts">
            <div class="shortcut">
              <span class="shortcut-desc">Save annotation</span>
              <div class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Enter</kbd></div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="section-title">📍 Local vs Remote Editing</div>
          <div style="color: #d1d5db; font-size: 13px; line-height: 1.6;">
            <div style="margin-bottom: 12px;">
              <strong style="color: #10b981;">💻 Local Development</strong><br/>
              <span style="font-size: 12px; color: #9ca3af;">
                (e.g., http://localhost:5200)<br/>
                ✅ Changes appear immediately on refresh<br/>
                ✅ Files served from your project directory
              </span>
            </div>
            <div>
              <strong style="color: #f59338;">🌐 Remote/Published Sites</strong><br/>
              <span style="font-size: 12px; color: #9ca3af;">
                (e.g., https://yoursite.com)<br/>
                ⚠️ Changes saved locally only<br/>
                ⚠️ To see changes: run locally or deploy<br/>
                💡 Use local development for best experience
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private handleOverlayClick() {
    this.handleClose();
  }

  private handleClose() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-help': ZingHelp;
  }
}
