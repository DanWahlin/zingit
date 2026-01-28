// client/src/components/modal.ts
// Modal for adding annotation notes

import { LitElement, html, css } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

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

    .checkbox-field {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }

    .checkbox-field input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: #3b82f6;
      cursor: pointer;
    }

    .checkbox-field label {
      display: inline;
      margin-bottom: 0;
      cursor: pointer;
      user-select: none;
    }

    .screenshot-preview {
      margin-top: 12px;
      padding: 12px;
      background: #111827;
      border-radius: 6px;
      border: 1px solid #374151;
    }

    .screenshot-preview label {
      display: block;
      font-size: 12px;
      color: #9ca3af;
      margin-bottom: 8px;
    }

    .screenshot-preview img {
      max-width: 100%;
      max-height: 200px;
      border-radius: 4px;
      display: block;
    }

    .screenshot-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #9ca3af;
      font-size: 12px;
    }

    .screenshot-loading .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #374151;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
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

    .confirmation-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      z-index: 10;
    }

    .confirmation-dialog {
      background: #1f2937;
      border: 2px solid #fbbf24;
      border-radius: 8px;
      padding: 20px;
      max-width: 320px;
      margin: 16px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      text-align: center;
    }

    .confirmation-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 16px;
      color: #fbbf24;
      display: block;
    }

    .confirmation-title {
      font-size: 16px;
      font-weight: 600;
      color: white;
      margin: 0 0 8px 0;
      text-align: center;
    }

    .confirmation-message {
      font-size: 14px;
      color: #d1d5db;
      margin: 0 0 20px 0;
      text-align: center;
      line-height: 1.5;
    }

    .confirmation-actions {
      display: flex;
      gap: 8px;
      justify-content: center;
    }
  `;

  @property({ type: Boolean }) open = false;
  @property({ type: Boolean }) editMode = false;
  @property({ type: String }) annotationId = '';
  @property({ type: String }) selector = '';
  @property({ type: String }) identifier = '';
  @property({ type: String }) selectedText = '';
  @property({ type: String }) notes = '';
  @property({ type: Boolean }) captureScreenshot = false;
  @property({ type: String }) screenshotPreview = '';  // Base64 preview image
  @property({ type: Boolean }) screenshotLoading = false;

  @state() private showConfirmation = false;
  @state() private localNotes = '';  // Internal state for textarea
  @state() private isSelecting = false;  // Track if user is actively selecting text

  @query('textarea') private textarea!: HTMLTextAreaElement;

  private handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.handleCancel();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      this.handleSave();
    }
  };

  private handleGlobalMouseUp = () => {
    // Reset selection flag when mouse is released anywhere
    // This ensures the flag is cleared even if mouseup happens outside the textarea
    setTimeout(() => {
      this.isSelecting = false;
    }, 50);
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeydown);
    document.addEventListener('mouseup', this.handleGlobalMouseUp);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeydown);
    document.removeEventListener('mouseup', this.handleGlobalMouseUp);
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('open') && this.open) {
      // Reset confirmation state when modal opens
      this.showConfirmation = false;
      // Initialize local state from parent's notes property
      this.localNotes = this.notes;
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
                .value=${this.localNotes}
                @input=${this.handleNotesInput}
                @mousedown=${this.handleTextareaMouseDown}
                @mouseup=${this.handleTextareaMouseUp}
                placeholder="Describe the issue or change you want to make..."
              ></textarea>
            </div>

            <div class="checkbox-field">
              <input
                type="checkbox"
                id="captureScreenshot"
                .checked=${this.captureScreenshot}
                @change=${this.handleScreenshotChange}
              />
              <label for="captureScreenshot">Capture screenshot of element</label>
            </div>

            ${this.captureScreenshot ? html`
              <div class="screenshot-preview">
                <label>Screenshot Preview</label>
                ${this.screenshotLoading ? html`
                  <div class="screenshot-loading">
                    <div class="spinner"></div>
                    <span>Capturing...</span>
                  </div>
                ` : this.screenshotPreview ? html`
                  <img src="${this.screenshotPreview}" alt="Element screenshot" />
                ` : html`
                  <div class="screenshot-loading">
                    <span>No preview available</span>
                  </div>
                `}
              </div>
            ` : ''}
          </div>

          <div class="footer">
            <button class="btn-cancel" @click=${this.handleCancel}>
              Cancel
            </button>
            <button class="btn-save" @click=${this.handleSave}>
              ${this.editMode ? 'Update' : 'Save'}
            </button>
          </div>

          ${this.showConfirmation ? html`
            <div class="confirmation-overlay" @click=${(e: Event) => e.stopPropagation()}>
              <div class="confirmation-dialog">
                <svg class="confirmation-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L1 21h22L12 2zm0 3.83L19.53 19H4.47L12 5.83zM11 16h2v2h-2v-2zm0-6h2v4h-2v-4z"/>
                </svg>
                <h3 class="confirmation-title">Empty Annotation?</h3>
                <p class="confirmation-message">
                  You haven't added any notes. The AI agent won't have instructions on what to change. Are you sure you want to continue?
                </p>
                <div class="confirmation-actions">
                  <button class="btn-cancel" @click=${this.handleConfirmCancel}>
                    Cancel
                  </button>
                  <button class="btn-save" @click=${this.handleConfirmProceed}>
                    Continue Anyway
                  </button>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private handleOverlayClick() {
    // Don't close if user is actively selecting text (prevents accidental close during text selection)
    if (this.isSelecting) {
      return;
    }

    // Don't close if there's an active text selection (user may have finished selecting)
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }

    this.handleCancel();
  }

  private handleNotesInput(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    this.localNotes = textarea.value;
  }

  private handleTextareaMouseDown() {
    // User started a potential text selection
    this.isSelecting = true;
  }

  private handleTextareaMouseUp() {
    // User finished the mouse action - delay reset to allow overlay click to check the flag
    setTimeout(() => {
      this.isSelecting = false;
    }, 50);
  }

  private handleScreenshotChange(e: Event) {
    const checkbox = e.target as HTMLInputElement;
    this.captureScreenshot = checkbox.checked;

    // Emit event so parent can capture/clear the screenshot preview
    this.dispatchEvent(new CustomEvent('screenshot-toggle', {
      bubbles: true,
      composed: true,
      detail: { enabled: this.captureScreenshot }
    }));
  }

  private handleCancel() {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  private handleSave() {
    // Check if notes is empty and not already showing confirmation
    if (!this.localNotes.trim() && !this.showConfirmation) {
      this.showConfirmation = true;
      return;
    }

    // Proceed with save
    this.proceedWithSave();
  }

  private handleConfirmCancel() {
    this.showConfirmation = false;
    // Refocus textarea
    requestAnimationFrame(() => {
      this.textarea?.focus();
    });
  }

  private handleConfirmProceed() {
    this.showConfirmation = false;
    this.proceedWithSave();
  }

  private proceedWithSave() {
    this.dispatchEvent(new CustomEvent('save', {
      bubbles: true,
      composed: true,
      detail: {
        notes: this.localNotes,
        editMode: this.editMode,
        annotationId: this.annotationId,
        captureScreenshot: this.captureScreenshot
      }
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-modal': ZingModal;
  }
}
