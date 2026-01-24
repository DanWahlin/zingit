// client/src/components/diff-viewer.ts
// Visual diff viewer with approve/reject workflow

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ProposedChange, PreviewSummary } from '../types/index.js';

@customElement('zing-diff-viewer')
export class ZingDiffViewer extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 2147483647;
      display: none;
      overflow: hidden;
    }

    .overlay.open {
      display: flex;
    }

    .dialog {
      margin: 24px auto;
      width: calc(100vw - 48px);
      max-width: 1400px;
      height: calc(100vh - 48px);
      background: #1f2937;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }

    .header {
      padding: 16px 20px;
      background: #111827;
      border-bottom: 1px solid #374151;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header h2 {
      margin: 0;
      color: #f3f4f6;
      font-size: 16px;
      font-weight: 600;
    }

    .header-badge {
      background: #3b82f6;
      color: white;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .style-toggle {
      display: flex;
      background: #374151;
      border-radius: 6px;
      overflow: hidden;
    }

    .style-btn {
      padding: 6px 12px;
      background: transparent;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.15s ease;
    }

    .style-btn.active {
      background: #3b82f6;
      color: white;
    }

    .style-btn:hover:not(.active) {
      color: #f3f4f6;
    }

    .close-btn {
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 6px;
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

    .body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .file-list {
      width: 280px;
      min-width: 280px;
      border-right: 1px solid #374151;
      overflow-y: auto;
      background: #111827;
    }

    .file-item {
      padding: 12px 16px;
      border-bottom: 1px solid #1f2937;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .file-item:hover {
      background: #1f2937;
    }

    .file-item.selected {
      background: #1e3a5f;
      border-left: 3px solid #3b82f6;
    }

    .file-item.approved {
      border-left: 3px solid #22c55e;
    }

    .file-item.rejected {
      border-left: 3px solid #ef4444;
      opacity: 0.6;
    }

    .file-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .file-info {
      flex: 1;
      min-width: 0;
    }

    .file-name {
      color: #f3f4f6;
      font-size: 13px;
      font-weight: 500;
      word-break: break-all;
      line-height: 1.3;
    }

    .file-path {
      color: #6b7280;
      font-size: 11px;
      margin-top: 2px;
    }

    .file-type {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
      flex-shrink: 0;
      margin-left: 8px;
    }

    .file-type.create {
      background: #22c55e;
      color: white;
    }

    .file-type.modify {
      background: #f59e0b;
      color: white;
    }

    .file-type.delete {
      background: #ef4444;
      color: white;
    }

    .file-stats {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 8px;
    }

    .stat {
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .stat.added {
      color: #22c55e;
    }

    .stat.removed {
      color: #ef4444;
    }

    .file-actions {
      display: flex;
      gap: 4px;
      margin-top: 8px;
    }

    .file-action-btn {
      padding: 4px 8px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
      transition: all 0.15s ease;
    }

    .file-action-btn.approve {
      background: #166534;
      color: #4ade80;
    }

    .file-action-btn.approve:hover {
      background: #22c55e;
      color: white;
    }

    .file-action-btn.approve.active {
      background: #22c55e;
      color: white;
    }

    .file-action-btn.reject {
      background: #7f1d1d;
      color: #f87171;
    }

    .file-action-btn.reject:hover {
      background: #ef4444;
      color: white;
    }

    .file-action-btn.reject.active {
      background: #ef4444;
      color: white;
    }

    .diff-panel {
      flex: 1;
      overflow: auto;
      background: #0d1117;
    }

    .diff-header {
      padding: 12px 16px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .diff-file-name {
      color: #f3f4f6;
      font-size: 13px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    }

    .diff-content {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 12px;
      line-height: 1.5;
    }

    .diff-line {
      display: flex;
      min-height: 20px;
    }

    .line-number {
      width: 50px;
      min-width: 50px;
      padding: 0 8px;
      text-align: right;
      color: #484f58;
      background: #161b22;
      user-select: none;
      border-right: 1px solid #30363d;
    }

    .line-content {
      flex: 1;
      padding: 0 12px;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .diff-line.added {
      background: rgba(46, 160, 67, 0.15);
    }

    .diff-line.added .line-number {
      background: rgba(46, 160, 67, 0.2);
      color: #3fb950;
    }

    .diff-line.added .line-content {
      color: #aff5b4;
    }

    .diff-line.removed {
      background: rgba(248, 81, 73, 0.15);
    }

    .diff-line.removed .line-number {
      background: rgba(248, 81, 73, 0.2);
      color: #f85149;
    }

    .diff-line.removed .line-content {
      color: #ffa198;
    }

    .diff-line.context .line-content {
      color: #8b949e;
    }

    .diff-line.header {
      background: rgba(56, 139, 253, 0.15);
    }

    .diff-line.header .line-content {
      color: #58a6ff;
      font-weight: 500;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #6b7280;
      font-size: 14px;
    }

    .empty-state-icon {
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      color: #4b5563;
    }

    .footer {
      padding: 16px 20px;
      background: #111827;
      border-top: 1px solid #374151;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .summary {
      color: #9ca3af;
      font-size: 13px;
    }

    .summary strong {
      color: #f3f4f6;
    }

    .summary .added {
      color: #22c55e;
    }

    .summary .removed {
      color: #ef4444;
    }

    .footer-actions {
      display: flex;
      gap: 12px;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #22c55e;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #16a34a;
    }

    .btn-secondary {
      background: #374151;
      color: #d1d5db;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #4b5563;
    }

    .btn-danger {
      background: #ef4444;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #dc2626;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;

  @property({ type: Boolean }) isOpen = false;
  @property({ type: Object }) summary: PreviewSummary | null = null;
  @property({ type: String }) diffStyle: 'unified' | 'split' = 'unified';

  @state() private selectedChangeId: string | null = null;
  @state() private approvedIds: Set<string> = new Set();
  @state() private rejectedIds: Set<string> = new Set();
  @state() private isApplying = false;

  updated(changedProperties: Map<string, unknown>) {
    // Auto-select first change when summary changes
    if (changedProperties.has('summary') && this.summary?.changes.length) {
      if (!this.selectedChangeId || !this.summary.changes.find(c => c.id === this.selectedChangeId)) {
        this.selectedChangeId = this.summary.changes[0].id;
      }
    }

    // Reset state when dialog opens
    if (changedProperties.has('isOpen') && this.isOpen) {
      this.approvedIds = new Set();
      this.rejectedIds = new Set();
      this.isApplying = false;
    }
  }

  render() {
    if (!this.summary) return html``;

    const selectedChange = this.summary.changes.find(c => c.id === this.selectedChangeId);
    const approvedCount = this.approvedIds.size;
    const totalCount = this.summary.changes.length;
    const allApproved = approvedCount === totalCount;

    return html`
      <div class="overlay ${this.isOpen ? 'open' : ''}" @click=${this._handleOverlayClick}>
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
          <div class="header">
            <div class="header-left">
              <h2>Review Proposed Changes</h2>
              <span class="header-badge">${totalCount} file${totalCount !== 1 ? 's' : ''}</span>
            </div>
            <div class="header-actions">
              <div class="style-toggle">
                <button
                  class="style-btn ${this.diffStyle === 'unified' ? 'active' : ''}"
                  @click=${() => this._setDiffStyle('unified')}
                >
                  Unified
                </button>
                <button
                  class="style-btn ${this.diffStyle === 'split' ? 'active' : ''}"
                  @click=${() => this._setDiffStyle('split')}
                >
                  Split
                </button>
              </div>
              <button class="close-btn" @click=${this._handleClose} title="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="body">
            <div class="file-list">
              ${this.summary.changes.map(change => this._renderFileItem(change))}
            </div>

            <div class="diff-panel">
              ${selectedChange
                ? this._renderDiff(selectedChange)
                : this._renderEmptyState()
              }
            </div>
          </div>

          <div class="footer">
            <div class="summary">
              <strong>${approvedCount}</strong> of <strong>${totalCount}</strong> approved
              &nbsp;•&nbsp;
              <span class="added">+${this.summary.linesAdded}</span>
              &nbsp;
              <span class="removed">-${this.summary.linesRemoved}</span>
            </div>
            <div class="footer-actions">
              <button class="btn btn-danger" @click=${this._handleRejectAll} ?disabled=${this.isApplying}>
                Reject All
              </button>
              <button class="btn btn-secondary" @click=${this._handleApproveAll} ?disabled=${this.isApplying}>
                ${allApproved ? 'All Approved' : 'Approve All'}
              </button>
              <button
                class="btn btn-primary"
                @click=${this._handleApply}
                ?disabled=${approvedCount === 0 || this.isApplying}
              >
                ${this.isApplying
                  ? html`<span class="spinner"></span> Applying...`
                  : `Apply ${approvedCount} Change${approvedCount !== 1 ? 's' : ''}`
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderFileItem(change: ProposedChange) {
    const isSelected = change.id === this.selectedChangeId;
    const isApproved = this.approvedIds.has(change.id);
    const isRejected = this.rejectedIds.has(change.id);

    // Extract filename and directory
    const parts = change.filePath.split('/');
    const fileName = parts.pop() || change.filePath;
    const directory = parts.join('/');

    return html`
      <div
        class="file-item ${isSelected ? 'selected' : ''} ${isApproved ? 'approved' : ''} ${isRejected ? 'rejected' : ''}"
        @click=${() => this._selectChange(change.id)}
      >
        <div class="file-header">
          <div class="file-info">
            <div class="file-name">${fileName}</div>
            ${directory ? html`<div class="file-path">${directory}/</div>` : ''}
          </div>
          <span class="file-type ${change.changeType}">${change.changeType}</span>
        </div>
        <div class="file-stats">
          <span class="stat added">+${change.linesAdded}</span>
          <span class="stat removed">-${change.linesRemoved}</span>
          <span class="stat" style="color: #6b7280">${change.language}</span>
        </div>
        <div class="file-actions">
          <button
            class="file-action-btn approve ${isApproved ? 'active' : ''}"
            @click=${(e: Event) => { e.stopPropagation(); this._approveChange(change.id); }}
          >
            ${isApproved ? '✓ Approved' : 'Approve'}
          </button>
          <button
            class="file-action-btn reject ${isRejected ? 'active' : ''}"
            @click=${(e: Event) => { e.stopPropagation(); this._rejectChange(change.id); }}
          >
            ${isRejected ? '✗ Rejected' : 'Reject'}
          </button>
        </div>
      </div>
    `;
  }

  private _renderDiff(change: ProposedChange) {
    const lines = this._parseDiff(change.diff);

    return html`
      <div class="diff-header">
        <span class="diff-file-name">${change.filePath}</span>
      </div>
      <div class="diff-content">
        ${lines.map(line => this._renderDiffLine(line))}
      </div>
    `;
  }

  private _renderDiffLine(line: { type: string; lineNum: string; content: string }) {
    return html`
      <div class="diff-line ${line.type}">
        <span class="line-number">${line.lineNum}</span>
        <span class="line-content">${line.content}</span>
      </div>
    `;
  }

  private _parseDiff(diff: string): Array<{ type: string; lineNum: string; content: string }> {
    const lines = diff.split('\n');
    const result: Array<{ type: string; lineNum: string; content: string }> = [];

    let oldLine = 0;
    let newLine = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        // Parse hunk header
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLine = parseInt(match[1]) - 1;
          newLine = parseInt(match[2]) - 1;
        }
        result.push({ type: 'header', lineNum: '', content: line });
      } else if (line.startsWith('---') || line.startsWith('+++')) {
        result.push({ type: 'header', lineNum: '', content: line });
      } else if (line.startsWith('+')) {
        newLine++;
        result.push({ type: 'added', lineNum: String(newLine), content: line.slice(1) });
      } else if (line.startsWith('-')) {
        oldLine++;
        result.push({ type: 'removed', lineNum: String(oldLine), content: line.slice(1) });
      } else if (line.startsWith(' ') || line === '') {
        oldLine++;
        newLine++;
        result.push({ type: 'context', lineNum: String(newLine), content: line.slice(1) || '' });
      }
    }

    return result;
  }

  private _renderEmptyState() {
    return html`
      <div class="empty-state">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <div>Select a file to view changes</div>
      </div>
    `;
  }

  private _selectChange(id: string) {
    this.selectedChangeId = id;
  }

  private _approveChange(id: string) {
    // Create new Sets to trigger Lit reactivity
    const newRejected = new Set(this.rejectedIds);
    newRejected.delete(id);
    this.rejectedIds = newRejected;
    this.approvedIds = new Set([...this.approvedIds, id]);
  }

  private _rejectChange(id: string) {
    // Create new Sets to trigger Lit reactivity
    const newApproved = new Set(this.approvedIds);
    newApproved.delete(id);
    this.approvedIds = newApproved;
    this.rejectedIds = new Set([...this.rejectedIds, id]);
  }

  private _handleApproveAll() {
    this.rejectedIds = new Set();
    this.approvedIds = new Set(this.summary?.changes.map(c => c.id) || []);
  }

  private _handleRejectAll() {
    this._handleClose();
    this.dispatchEvent(new CustomEvent('reject-all', { bubbles: true, composed: true }));
  }

  private _handleApply() {
    if (this.approvedIds.size === 0) return;

    this.isApplying = true;

    // Build arrays of approved and rejected IDs
    const approvedIds = Array.from(this.approvedIds);
    const rejectedIds = Array.from(this.rejectedIds);

    this.dispatchEvent(new CustomEvent('apply', {
      detail: {
        approvedIds,
        rejectedIds
      },
      bubbles: true,
      composed: true
    }));
  }

  private _setDiffStyle(style: 'unified' | 'split') {
    this.diffStyle = style;
    this.dispatchEvent(new CustomEvent('style-change', {
      detail: { style },
      bubbles: true,
      composed: true
    }));
  }

  private _handleOverlayClick() {
    // Don't close on overlay click when applying
    if (!this.isApplying) {
      this._handleClose();
    }
  }

  private _handleClose() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  // Public method to reset applying state (called after apply completes)
  applyComplete() {
    this.isApplying = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-diff-viewer': ZingDiffViewer;
  }
}
