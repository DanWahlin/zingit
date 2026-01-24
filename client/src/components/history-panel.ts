// client/src/components/history-panel.ts
// History panel for viewing and managing change checkpoints

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CheckpointInfo } from '../types/index.js';

@customElement('zing-history-panel')
export class ZingHistoryPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .panel {
      position: fixed;
      right: 0;
      top: 0;
      width: 320px;
      height: 100vh;
      background: #1f2937;
      border-left: 1px solid #374151;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      z-index: 2147483645;
      display: flex;
      flex-direction: column;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
    }

    .panel.open {
      transform: translateX(0);
    }

    .header {
      padding: 16px;
      border-bottom: 1px solid #374151;
      display: flex;
      justify-content: space-between;
      align-items: center;
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

    .checkpoints {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .checkpoint {
      background: #111827;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      cursor: pointer;
      border: 2px solid transparent;
      transition: all 0.15s ease;
    }

    .checkpoint:hover {
      border-color: #3b82f6;
    }

    .checkpoint.current {
      border-color: #22c55e;
      background: #0f1f13;
    }

    .checkpoint.reverted {
      opacity: 0.5;
    }

    .checkpoint.reverted:hover {
      opacity: 0.7;
    }

    .checkpoint-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }

    .checkpoint-time {
      color: #9ca3af;
      font-size: 11px;
    }

    .checkpoint-status {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }

    .checkpoint-status.pending {
      background: #fbbf24;
      color: #1f2937;
    }

    .checkpoint-status.applied {
      background: #22c55e;
      color: #fff;
    }

    .checkpoint-status.reverted {
      background: #6b7280;
      color: #fff;
    }

    .checkpoint-annotations {
      color: #f3f4f6;
      font-size: 13px;
      margin-bottom: 8px;
      line-height: 1.4;
    }

    .checkpoint-stats {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: #9ca3af;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .stat-icon {
      width: 12px;
      height: 12px;
    }

    .stat.added {
      color: #22c55e;
    }

    .stat.removed {
      color: #ef4444;
    }

    .actions {
      padding: 16px;
      border-top: 1px solid #374151;
      background: #111827;
    }

    .undo-btn {
      width: 100%;
      padding: 10px 16px;
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.15s ease;
    }

    .undo-btn:hover:not(:disabled) {
      background: #dc2626;
    }

    .undo-btn:disabled {
      background: #4b5563;
      cursor: not-allowed;
    }

    .empty-state {
      text-align: center;
      color: #6b7280;
      padding: 40px 20px;
      font-size: 13px;
    }

    .empty-state-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 16px;
      color: #4b5563;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: #9ca3af;
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #374151;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .clear-btn {
      width: 100%;
      padding: 8px 16px;
      background: transparent;
      color: #9ca3af;
      border: 1px solid #374151;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      margin-top: 8px;
      transition: all 0.15s ease;
    }

    .clear-btn:hover {
      background: #374151;
      color: #f3f4f6;
    }
  `;

  @property({ type: Array }) checkpoints: CheckpointInfo[] = [];
  @property({ type: Boolean }) isOpen = false;
  @property({ type: Boolean }) isLoading = false;
  @state() private isUndoing = false;

  render() {
    const canUndo = this.checkpoints.some(cp => cp.canUndo);

    return html`
      <div class="panel ${this.isOpen ? 'open' : ''}">
        <div class="header">
          <h3>
            <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Change History
          </h3>
          <button class="close-btn" @click=${this._handleClose} title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="checkpoints">
          ${this.isLoading
            ? html`<div class="loading"><div class="spinner"></div></div>`
            : this.checkpoints.length === 0
              ? this._renderEmptyState()
              : this.checkpoints.slice().reverse().map((cp) => this._renderCheckpoint(cp))
          }
        </div>

        <div class="actions">
          <button
            class="undo-btn"
            ?disabled=${!canUndo || this.isUndoing}
            @click=${this._handleUndo}
          >
            ${this.isUndoing
              ? html`<div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>`
              : html`
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 7v6h6"/>
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 13"/>
                  </svg>
                `
            }
            ${this.isUndoing ? 'Undoing...' : 'Undo Last Change'}
          </button>
          ${this.checkpoints.length > 0
            ? html`
                <button class="clear-btn" @click=${this._handleClearHistory}>
                  Clear History
                </button>
              `
            : ''
          }
        </div>
      </div>
    `;
  }

  private _renderEmptyState() {
    return html`
      <div class="empty-state">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <div>No changes recorded yet</div>
        <div style="margin-top: 8px; font-size: 12px;">
          Changes made by AI agents will appear here
        </div>
      </div>
    `;
  }

  private _renderCheckpoint(checkpoint: CheckpointInfo) {
    const isCurrent = checkpoint.canUndo;
    const isReverted = checkpoint.status === 'reverted';

    return html`
      <div
        class="checkpoint ${isCurrent ? 'current' : ''} ${isReverted ? 'reverted' : ''}"
        @click=${() => this._handleRevertTo(checkpoint)}
        title="${isReverted ? 'This change was reverted' : isCurrent ? 'Current state' : 'Click to revert to this point'}"
      >
        <div class="checkpoint-header">
          <span class="checkpoint-time">
            ${this._formatTime(checkpoint.timestamp)}
          </span>
          <span class="checkpoint-status ${checkpoint.status}">
            ${checkpoint.status === 'applied' && isCurrent ? 'current' : checkpoint.status}
          </span>
        </div>
        <div class="checkpoint-annotations">
          ${checkpoint.annotations.map(a => a.identifier).join(', ') || 'No annotations'}
        </div>
        <div class="checkpoint-stats">
          <span class="stat">
            <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            ${checkpoint.filesModified} files
          </span>
          <span class="stat">
            <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20V10"/>
              <path d="M18 20V4"/>
              <path d="M6 20v-4"/>
            </svg>
            ${checkpoint.linesChanged} lines
          </span>
          <span class="stat">
            <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M9 9h6v6H9z"/>
            </svg>
            ${checkpoint.agentName}
          </span>
        </div>
      </div>
    `;
  }

  private _formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  private _handleClose() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private _handleUndo() {
    this.isUndoing = true;
    this.dispatchEvent(new CustomEvent('undo', { bubbles: true, composed: true }));
    // Reset after a delay in case the event doesn't come back
    setTimeout(() => {
      this.isUndoing = false;
    }, 5000);
  }

  private _handleRevertTo(checkpoint: CheckpointInfo) {
    if (checkpoint.status === 'reverted' || checkpoint.canUndo) {
      return; // Can't revert to already reverted or current checkpoint
    }

    if (confirm(`Revert to this checkpoint?\n\nAll changes after "${checkpoint.annotations.map(a => a.identifier).join(', ')}" will be undone.`)) {
      this.dispatchEvent(
        new CustomEvent('revert-to', {
          detail: { checkpointId: checkpoint.id },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private _handleClearHistory() {
    if (confirm('Clear all history?\n\nThis will remove all checkpoint records but will not undo any changes.')) {
      this.dispatchEvent(new CustomEvent('clear-history', { bubbles: true, composed: true }));
    }
  }

  // Called when undo completes to reset state
  undoComplete() {
    this.isUndoing = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-history-panel': ZingHistoryPanel;
  }
}
