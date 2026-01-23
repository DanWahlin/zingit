// client/src/components/modal.ts
// Modal for adding annotation notes

import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

@customElement('zing-modal')
export class ZingModal extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      pointer-events: auto;
    }

    .modal {
      background: #1f2937;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      width: 100%;
      max-width: 480px;
      margin: 16px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #374151;
    }

    .title {
      font-size: 16px;
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

    .body {
      padding: 20px;
    }

    .field {
      margin-bottom: 16px;
    }

    label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #d1d5db;
      margin-bottom: 6px;
    }

    .selector-display {
      font-size: 12px;
      color: #9ca3af;
      background: #111827;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: 'SF Mono', Monaco, monospace;
      word-break: break-all;
    }

    .selected-text {
      font-size: 13px;
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.1);
      padding: 8px 12px;
      border-radius: 6px;
      border-left: 3px solid #fbbf24;
    }

    textarea {
      width: 100%;
      min-height: 100px;
      padding: 12px;
      font-size: 14px;
      font-family: inherit;
      background: #111827;
      border: 1px solid #374151;
      border-radius: 6px;
      color: white;
      resize: vertical;
      box-sizing: border-box;
    }

    textarea:focus {
      outline: none;
      border-color: #3b82f6;
    }

    textarea::placeholder {
      color: #6b7280;
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 20px;
      border-top: 1px solid #374151;
    }

    button {
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-cancel {
      background: #374151;
      color: #d1d5db;
    }

    .btn-cancel:hover {
      background: #4b5563;
    }

    .btn-save {
      background: #3b82f6;
      color: white;
    }

    .btn-save:hover {
      background: #2563eb;
    }
  `;

  @property({ type: Boolean }) open = false;
  @property({ type: Boolean }) editMode = false;
  @property({ type: String }) annotationId = '';
  @property({ type: String }) selector = '';
  @property({ type: String }) identifier = '';
  @property({ type: String }) selectedText = '';
  @property({ type: String }) notes = '';

  @query('textarea') private textarea!: HTMLTextAreaElement;

  private handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.handleCancel();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      this.handleSave();
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeydown);
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('open') && this.open) {
      // Only clear notes for new annotations, not edits
      if (!this.editMode) {
        this.notes = '';
      }
      requestAnimationFrame(() => {
        this.textarea?.focus();
      });
    }
  }

  render() {
    if (!this.open) {
      return html``;
    }

    return html`
      <div class="overlay" @click=${this.handleOverlayClick}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="header">
            <h2 class="title">${this.editMode ? 'Edit Annotation' : 'Add Annotation'}</h2>
            <button class="close-btn" @click=${this.handleCancel}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="body">
            <div class="field">
              <label>Element</label>
              <div class="selector-display">${this.identifier}</div>
            </div>

            ${this.selectedText ? html`
              <div class="field">
                <label>Selected Text</label>
                <div class="selected-text">"${this.selectedText}"</div>
              </div>
            ` : ''}

            <div class="field">
              <label for="notes">Notes</label>
              <textarea
                id="notes"
                .value=${this.notes}
                @input=${this.handleNotesInput}
                placeholder="Describe the issue or change you want to make..."
              ></textarea>
            </div>
          </div>

          <div class="footer">
            <button class="btn-cancel" @click=${this.handleCancel}>
              Cancel
            </button>
            <button class="btn-save" @click=${this.handleSave}>
              ${this.editMode ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private handleOverlayClick() {
    this.handleCancel();
  }

  private handleNotesInput(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    this.notes = textarea.value;
  }

  private handleCancel() {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  private handleSave() {
    this.dispatchEvent(new CustomEvent('save', {
      bubbles: true,
      composed: true,
      detail: {
        notes: this.notes,
        editMode: this.editMode,
        annotationId: this.annotationId
      }
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-modal': ZingModal;
  }
}
