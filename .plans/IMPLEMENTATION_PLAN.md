# Implementation Plan: Undo/Redo & Visual Diff Features

This document provides a detailed implementation plan for two high-priority features:
1. **Undo/Redo & Change History with Git Integration**
2. **Visual Diff Preview & Approval Workflow**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Feature 1: Undo/Redo & Change History](#feature-1-undoredo--change-history)
4. [Feature 2: Visual Diff Preview & Approval](#feature-2-visual-diff-preview--approval)
5. [Shared Infrastructure](#shared-infrastructure)
6. [Implementation Phases](#implementation-phases)
7. [Testing Strategy](#testing-strategy)
8. [Risk Assessment](#risk-assessment)

---

## Executive Summary

These two features work together to give users confidence when using AI agents to modify their code:

- **Undo/Redo** provides a safety net after changes are made
- **Visual Diff Preview** prevents unwanted changes before they're applied

Together, they transform ZingIt from "fire and forget" to a controlled, reviewable workflow.

### Key Benefits
- Increased user trust in AI-powered modifications
- Reduced risk of unintended code changes
- Professional workflow suitable for production codebases
- Audit trail for compliance and review purposes

---

## Architecture Overview

### Current Flow
```
User Annotation → WebSocket → Agent → Direct File Changes → Response Display
```

### Proposed Flow
```
User Annotation → WebSocket → Git Checkpoint → Agent (Preview Mode)
    → Diff Generation → User Review → Approve/Reject → Apply Changes → History Update
```

### New Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ diff-viewer │  │   history   │  │  approval   │  │  undo-bar   │    │
│  │     .ts     │  │   panel.ts  │  │  dialog.ts  │  │     .ts     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    git-service.ts (new)                           │   │
│  │  - Checkpoint management                                          │   │
│  │  - History tracking                                               │   │
│  │  - Undo operations                                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                              SERVER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    git-manager.ts (new)                           │   │
│  │  - Git operations (commit, revert, diff)                          │   │
│  │  - Checkpoint creation                                            │   │
│  │  - File change tracking                                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    preview-manager.ts (new)                       │   │
│  │  - Intercept agent file writes                                    │   │
│  │  - Collect proposed changes                                       │   │
│  │  - Apply/reject changes                                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Modified: base.ts                              │   │
│  │  - Preview mode support in agents                                 │   │
│  │  - Diff generation hooks                                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: Undo/Redo & Change History

### 1.1 Requirements

#### Functional Requirements
- FR1.1: Create a Git commit checkpoint before any AI modification batch
- FR1.2: Track all modifications made by AI agents with metadata
- FR1.3: Display change history in a panel showing timestamp, annotations, files modified
- FR1.4: Allow one-click revert to any previous checkpoint
- FR1.5: Support undo of the most recent change set
- FR1.6: Persist history across browser sessions (via server)

#### Non-Functional Requirements
- NFR1.1: Checkpoint creation must complete in < 2 seconds
- NFR1.2: History panel must load in < 500ms
- NFR1.3: Revert operation must complete in < 3 seconds
- NFR1.4: Support projects up to 10,000 files

### 1.2 Data Models

#### Server-Side Types (`server/src/types.ts`)

```typescript
// Checkpoint represents a saved state before AI modifications
export interface Checkpoint {
  id: string;                    // UUID
  timestamp: Date;               // When checkpoint was created
  commitHash: string;            // Git commit SHA
  branchName: string;            // Git branch name
  annotations: Annotation[];     // Annotations that triggered this change
  pageUrl: string;               // Page where annotations were made
  pageTitle: string;             // Page title
  agentName: string;             // Which agent made the changes
  status: 'pending' | 'applied' | 'reverted';
}

// FileChange tracks individual file modifications
export interface FileChange {
  checkpointId: string;          // Parent checkpoint
  filePath: string;              // Relative path from project root
  changeType: 'created' | 'modified' | 'deleted';
  beforeContent?: string;        // Original content (null for created)
  afterContent?: string;         // New content (null for deleted)
  diff: string;                  // Unified diff format
  linesAdded: number;
  linesRemoved: number;
}

// ChangeHistory is the full history for a project
export interface ChangeHistory {
  projectDir: string;
  checkpoints: Checkpoint[];
  currentCheckpointId: string | null;  // Most recent applied checkpoint
}
```

#### Client-Side Types (`client/src/types/index.ts`)

```typescript
// Client-friendly checkpoint info (without full file contents)
export interface CheckpointInfo {
  id: string;
  timestamp: string;             // ISO string
  annotations: AnnotationSummary[];
  filesModified: number;
  linesChanged: number;
  agentName: string;
  pageUrl: string;
  canUndo: boolean;              // Only most recent can be undone easily
}

export interface AnnotationSummary {
  identifier: string;
  notes: string;
}

export interface HistoryState {
  checkpoints: CheckpointInfo[];
  currentIndex: number;          // Index of current state (-1 = original)
  isLoading: boolean;
  error: string | null;
}
```

### 1.3 WebSocket Protocol Extensions

#### New Message Types

```typescript
// Client → Server
export type WSIncomingType =
  | 'batch'           // existing
  | 'message'         // existing
  | 'reset'           // existing
  | 'stop'            // existing
  | 'get_agents'      // existing
  | 'select_agent'    // existing
  // New types:
  | 'get_history'     // Request change history
  | 'undo'            // Undo most recent change
  | 'revert_to'       // Revert to specific checkpoint
  | 'clear_history';  // Clear all history (dangerous)

// Server → Client
export type WSOutgoingType =
  | 'connected'       // existing
  | 'processing'      // existing
  | 'delta'           // existing
  | 'tool_start'      // existing
  | 'tool_end'        // existing
  | 'idle'            // existing
  | 'error'           // existing
  // New types:
  | 'checkpoint_created'  // Checkpoint was created
  | 'history'             // Response to get_history
  | 'undo_complete'       // Undo operation completed
  | 'revert_complete'     // Revert operation completed
  | 'files_changed';      // List of files that were modified
```

#### Message Payloads

```typescript
// get_history response
interface HistoryMessage {
  type: 'history';
  checkpoints: CheckpointInfo[];
  currentIndex: number;
}

// checkpoint_created notification
interface CheckpointCreatedMessage {
  type: 'checkpoint_created';
  checkpoint: CheckpointInfo;
}

// undo request
interface UndoMessage {
  type: 'undo';
}

// revert_to request
interface RevertToMessage {
  type: 'revert_to';
  checkpointId: string;
}

// undo_complete / revert_complete response
interface RevertCompleteMessage {
  type: 'undo_complete' | 'revert_complete';
  checkpointId: string;
  filesReverted: string[];
}
```

### 1.4 Server Implementation

#### Git Manager (`server/src/services/git-manager.ts`)

```typescript
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export class GitManager {
  private projectDir: string;
  private historyFile: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
    this.historyFile = path.join(projectDir, '.zingit', 'history.json');
  }

  /**
   * Initialize ZingIt tracking in the project
   */
  async initialize(): Promise<void> {
    // Ensure .zingit directory exists
    const zingitDir = path.join(this.projectDir, '.zingit');
    await fs.mkdir(zingitDir, { recursive: true });

    // Add .zingit to .gitignore if not present
    const gitignorePath = path.join(this.projectDir, '.gitignore');
    try {
      const gitignore = await fs.readFile(gitignorePath, 'utf-8');
      if (!gitignore.includes('.zingit')) {
        await fs.appendFile(gitignorePath, '\n# ZingIt history\n.zingit/\n');
      }
    } catch {
      // .gitignore doesn't exist, create it
      await fs.writeFile(gitignorePath, '# ZingIt history\n.zingit/\n');
    }

    // Initialize history file if it doesn't exist
    try {
      await fs.access(this.historyFile);
    } catch {
      await this.saveHistory({ projectDir: this.projectDir, checkpoints: [], currentCheckpointId: null });
    }
  }

  /**
   * Check if git repo exists and is clean
   */
  async checkGitStatus(): Promise<{ isRepo: boolean; isClean: boolean; branch: string }> {
    try {
      const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: this.projectDir });
      const { stdout: status } = await execAsync('git status --porcelain', { cwd: this.projectDir });
      return {
        isRepo: true,
        isClean: status.trim() === '',
        branch: branch.trim()
      };
    } catch {
      return { isRepo: false, isClean: false, branch: '' };
    }
  }

  /**
   * Create a checkpoint before AI modifications
   */
  async createCheckpoint(metadata: {
    annotations: Annotation[];
    pageUrl: string;
    pageTitle: string;
    agentName: string;
  }): Promise<Checkpoint> {
    const status = await this.checkGitStatus();

    if (!status.isRepo) {
      throw new Error('Project directory is not a git repository');
    }

    // If there are uncommitted changes, stash them or warn
    let stashed = false;
    if (!status.isClean) {
      // Auto-commit uncommitted changes with a marker
      await execAsync('git add -A', { cwd: this.projectDir });
      await execAsync('git commit -m "[ZingIt] Auto-save before AI modifications"', { cwd: this.projectDir });
    }

    // Get current commit hash
    const { stdout: commitHash } = await execAsync('git rev-parse HEAD', { cwd: this.projectDir });

    const checkpoint: Checkpoint = {
      id: uuidv4(),
      timestamp: new Date(),
      commitHash: commitHash.trim(),
      branchName: status.branch,
      annotations: metadata.annotations,
      pageUrl: metadata.pageUrl,
      pageTitle: metadata.pageTitle,
      agentName: metadata.agentName,
      status: 'pending'
    };

    // Save checkpoint to history
    const history = await this.loadHistory();
    history.checkpoints.push(checkpoint);
    await this.saveHistory(history);

    return checkpoint;
  }

  /**
   * Finalize checkpoint after AI modifications complete
   */
  async finalizeCheckpoint(checkpointId: string): Promise<FileChange[]> {
    const history = await this.loadHistory();
    const checkpoint = history.checkpoints.find(c => c.id === checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Get list of changed files
    const { stdout: diffStat } = await execAsync(
      `git diff --name-status ${checkpoint.commitHash}`,
      { cwd: this.projectDir }
    );

    const fileChanges: FileChange[] = [];
    const lines = diffStat.trim().split('\n').filter(l => l);

    for (const line of lines) {
      const [status, filePath] = line.split('\t');
      const changeType = status === 'A' ? 'created' : status === 'D' ? 'deleted' : 'modified';

      // Get diff for this file
      const { stdout: diff } = await execAsync(
        `git diff ${checkpoint.commitHash} -- "${filePath}"`,
        { cwd: this.projectDir }
      );

      // Count lines changed
      const linesAdded = (diff.match(/^\+[^+]/gm) || []).length;
      const linesRemoved = (diff.match(/^-[^-]/gm) || []).length;

      fileChanges.push({
        checkpointId,
        filePath,
        changeType,
        diff,
        linesAdded,
        linesRemoved
      });
    }

    // Commit the changes
    if (fileChanges.length > 0) {
      await execAsync('git add -A', { cwd: this.projectDir });
      const commitMsg = `[ZingIt] ${checkpoint.annotations.map(a => a.identifier).join(', ')}`;
      await execAsync(`git commit -m "${commitMsg}"`, { cwd: this.projectDir });
    }

    // Update checkpoint status
    checkpoint.status = 'applied';
    history.currentCheckpointId = checkpointId;
    await this.saveHistory(history);

    return fileChanges;
  }

  /**
   * Undo the most recent checkpoint
   */
  async undoLastCheckpoint(): Promise<{ checkpointId: string; filesReverted: string[] }> {
    const history = await this.loadHistory();

    if (!history.currentCheckpointId) {
      throw new Error('No changes to undo');
    }

    const checkpoint = history.checkpoints.find(c => c.id === history.currentCheckpointId);
    if (!checkpoint) {
      throw new Error('Current checkpoint not found');
    }

    // Revert to the checkpoint's commit
    await execAsync(`git revert --no-commit HEAD`, { cwd: this.projectDir });
    await execAsync(`git commit -m "[ZingIt] Undo: ${checkpoint.annotations.map(a => a.identifier).join(', ')}"`, { cwd: this.projectDir });

    // Get reverted files
    const { stdout: diffStat } = await execAsync('git diff --name-only HEAD~1', { cwd: this.projectDir });
    const filesReverted = diffStat.trim().split('\n').filter(f => f);

    // Update history
    checkpoint.status = 'reverted';
    const currentIndex = history.checkpoints.findIndex(c => c.id === history.currentCheckpointId);
    history.currentCheckpointId = currentIndex > 0 ? history.checkpoints[currentIndex - 1].id : null;
    await this.saveHistory(history);

    return { checkpointId: checkpoint.id, filesReverted };
  }

  /**
   * Revert to a specific checkpoint
   */
  async revertToCheckpoint(checkpointId: string): Promise<{ filesReverted: string[] }> {
    const history = await this.loadHistory();
    const checkpoint = history.checkpoints.find(c => c.id === checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Reset to that commit
    await execAsync(`git reset --hard ${checkpoint.commitHash}`, { cwd: this.projectDir });

    // Mark all checkpoints after this one as reverted
    const checkpointIndex = history.checkpoints.findIndex(c => c.id === checkpointId);
    for (let i = checkpointIndex + 1; i < history.checkpoints.length; i++) {
      history.checkpoints[i].status = 'reverted';
    }

    history.currentCheckpointId = checkpointId;
    await this.saveHistory(history);

    return { filesReverted: [] }; // Could compute actual files if needed
  }

  /**
   * Get change history
   */
  async getHistory(): Promise<ChangeHistory> {
    return this.loadHistory();
  }

  private async loadHistory(): Promise<ChangeHistory> {
    try {
      const data = await fs.readFile(this.historyFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return { projectDir: this.projectDir, checkpoints: [], currentCheckpointId: null };
    }
  }

  private async saveHistory(history: ChangeHistory): Promise<void> {
    await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2));
  }
}
```

### 1.5 Client Implementation

#### History Panel Component (`client/src/components/history-panel.ts`)

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CheckpointInfo } from '../types';

@customElement('zing-history-panel')
export class HistoryPanel extends LitElement {
  @property({ type: Array }) checkpoints: CheckpointInfo[] = [];
  @property({ type: Number }) currentIndex: number = -1;
  @property({ type: Boolean }) isOpen: boolean = false;
  @state() private isLoading: boolean = false;

  static styles = css`
    :host {
      display: block;
    }

    .panel {
      position: fixed;
      right: 0;
      top: 0;
      width: 350px;
      height: 100vh;
      background: #1e1e1e;
      border-left: 1px solid #333;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      z-index: 10001;
      display: flex;
      flex-direction: column;
    }

    .panel.open {
      transform: translateX(0);
    }

    .header {
      padding: 16px;
      border-bottom: 1px solid #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header h3 {
      margin: 0;
      color: #fff;
      font-size: 16px;
    }

    .close-btn {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 20px;
    }

    .checkpoints {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .checkpoint {
      background: #2d2d2d;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      cursor: pointer;
      border: 2px solid transparent;
      transition: border-color 0.2s;
    }

    .checkpoint:hover {
      border-color: #4a9eff;
    }

    .checkpoint.current {
      border-color: #4caf50;
    }

    .checkpoint.reverted {
      opacity: 0.5;
    }

    .checkpoint-time {
      color: #888;
      font-size: 12px;
      margin-bottom: 4px;
    }

    .checkpoint-annotations {
      color: #fff;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .checkpoint-stats {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #888;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .actions {
      padding: 16px;
      border-top: 1px solid #333;
    }

    .undo-btn {
      width: 100%;
      padding: 12px;
      background: #f44336;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }

    .undo-btn:hover {
      background: #d32f2f;
    }

    .undo-btn:disabled {
      background: #666;
      cursor: not-allowed;
    }

    .empty-state {
      text-align: center;
      color: #888;
      padding: 40px 20px;
    }
  `;

  render() {
    return html`
      <div class="panel ${this.isOpen ? 'open' : ''}">
        <div class="header">
          <h3>Change History</h3>
          <button class="close-btn" @click=${this._handleClose}>&times;</button>
        </div>

        <div class="checkpoints">
          ${this.checkpoints.length === 0
            ? html`<div class="empty-state">No changes recorded yet</div>`
            : this.checkpoints.map((cp, index) => this._renderCheckpoint(cp, index))
          }
        </div>

        <div class="actions">
          <button
            class="undo-btn"
            ?disabled=${this.checkpoints.length === 0 || this.isLoading}
            @click=${this._handleUndo}
          >
            ${this.isLoading ? 'Undoing...' : 'Undo Last Change'}
          </button>
        </div>
      </div>
    `;
  }

  private _renderCheckpoint(checkpoint: CheckpointInfo, index: number) {
    const isCurrent = index === this.currentIndex;
    const isReverted = checkpoint.status === 'reverted';

    return html`
      <div
        class="checkpoint ${isCurrent ? 'current' : ''} ${isReverted ? 'reverted' : ''}"
        @click=${() => this._handleRevertTo(checkpoint.id)}
      >
        <div class="checkpoint-time">
          ${this._formatTime(checkpoint.timestamp)}
          ${isCurrent ? html`<span style="color: #4caf50;"> (current)</span>` : ''}
        </div>
        <div class="checkpoint-annotations">
          ${checkpoint.annotations.map(a => a.identifier).join(', ')}
        </div>
        <div class="checkpoint-stats">
          <span class="stat">
            <span>📄</span> ${checkpoint.filesModified} files
          </span>
          <span class="stat">
            <span>±</span> ${checkpoint.linesChanged} lines
          </span>
          <span class="stat">
            <span>🤖</span> ${checkpoint.agentName}
          </span>
        </div>
      </div>
    `;
  }

  private _formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  private _handleClose() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private _handleUndo() {
    this.isLoading = true;
    this.dispatchEvent(new CustomEvent('undo'));
  }

  private _handleRevertTo(checkpointId: string) {
    if (confirm('Revert to this checkpoint? All changes after this point will be undone.')) {
      this.isLoading = true;
      this.dispatchEvent(new CustomEvent('revert-to', { detail: { checkpointId } }));
    }
  }
}
```

#### Undo Toast Bar (`client/src/components/undo-bar.ts`)

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('zing-undo-bar')
export class UndoBar extends LitElement {
  @property({ type: Boolean }) visible: boolean = false;
  @property({ type: String }) message: string = '';
  @property({ type: Number }) timeout: number = 10000;

  private _timeoutId?: number;

  static styles = css`
    :host {
      display: block;
    }

    .bar {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #323232;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: transform 0.3s ease;
      z-index: 10002;
    }

    .bar.visible {
      transform: translateX(-50%) translateY(0);
    }

    .message {
      font-size: 14px;
    }

    .undo-btn {
      background: #4a9eff;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    }

    .undo-btn:hover {
      background: #3a8eef;
    }

    .dismiss-btn {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 18px;
    }
  `;

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('visible') && this.visible) {
      this._startTimeout();
    }
  }

  private _startTimeout() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
    }
    this._timeoutId = window.setTimeout(() => {
      this._handleDismiss();
    }, this.timeout);
  }

  render() {
    return html`
      <div class="bar ${this.visible ? 'visible' : ''}">
        <span class="message">${this.message}</span>
        <button class="undo-btn" @click=${this._handleUndo}>Undo</button>
        <button class="dismiss-btn" @click=${this._handleDismiss}>&times;</button>
      </div>
    `;
  }

  private _handleUndo() {
    if (this._timeoutId) clearTimeout(this._timeoutId);
    this.dispatchEvent(new CustomEvent('undo'));
  }

  private _handleDismiss() {
    if (this._timeoutId) clearTimeout(this._timeoutId);
    this.dispatchEvent(new CustomEvent('dismiss'));
  }
}
```

---

## Feature 2: Visual Diff Preview & Approval

### 2.1 Requirements

#### Functional Requirements
- FR2.1: Add a "Preview Mode" toggle that collects changes without applying them
- FR2.2: Display proposed changes in a diff viewer with syntax highlighting
- FR2.3: Show side-by-side or unified diff view (user preference)
- FR2.4: Allow approval or rejection of individual file changes
- FR2.5: Support "Approve All" and "Reject All" bulk actions
- FR2.6: Highlight affected code regions in the diff
- FR2.7: Show summary of all proposed changes before approval

#### Non-Functional Requirements
- NFR2.1: Diff viewer must render in < 1 second for files up to 10,000 lines
- NFR2.2: Support all common programming language syntax highlighting
- NFR2.3: Preview mode must not leave temporary files in the project

### 2.2 Data Models

#### Server-Side Types

```typescript
// Proposed change from AI agent (not yet applied)
export interface ProposedChange {
  id: string;                    // UUID for this change
  filePath: string;              // Relative path from project root
  changeType: 'create' | 'modify' | 'delete';
  originalContent: string | null; // Original file content (null for create)
  proposedContent: string | null; // New content (null for delete)
  diff: string;                  // Unified diff
  language: string;              // Detected language for syntax highlighting
  linesAdded: number;
  linesRemoved: number;
}

// Batch of proposed changes awaiting approval
export interface ChangePreview {
  id: string;                    // Preview session ID
  timestamp: Date;
  annotations: Annotation[];     // Annotations that triggered these changes
  changes: ProposedChange[];     // All proposed file changes
  status: 'pending' | 'approved' | 'rejected' | 'partial';
}

// Preview mode settings
export interface PreviewSettings {
  enabled: boolean;              // Whether preview mode is active
  autoApprove: boolean;          // Skip preview for trusted patterns
  diffStyle: 'unified' | 'split'; // Diff display style
}
```

#### Client-Side Types

```typescript
export interface DiffViewState {
  previewId: string;
  changes: ProposedChange[];
  selectedChangeId: string | null;
  approvedIds: Set<string>;
  rejectedIds: Set<string>;
  diffStyle: 'unified' | 'split';
  isApplying: boolean;
}
```

### 2.3 WebSocket Protocol Extensions

```typescript
// Client → Server
export type WSIncomingType =
  // ... existing types ...
  | 'enable_preview'      // Enable preview mode
  | 'disable_preview'     // Disable preview mode (direct apply)
  | 'approve_changes'     // Approve specific changes
  | 'reject_changes'      // Reject specific changes
  | 'approve_all'         // Approve all pending changes
  | 'reject_all';         // Reject all pending changes

// Server → Client
export type WSOutgoingType =
  // ... existing types ...
  | 'preview_start'       // Preview collection starting
  | 'preview_change'      // Individual change proposed
  | 'preview_complete'    // All changes collected, awaiting approval
  | 'changes_applied'     // Approved changes have been applied
  | 'changes_rejected';   // Changes were rejected

// Message payloads
interface EnablePreviewMessage {
  type: 'enable_preview';
  settings?: PreviewSettings;
}

interface PreviewChangeMessage {
  type: 'preview_change';
  previewId: string;
  change: ProposedChange;
}

interface PreviewCompleteMessage {
  type: 'preview_complete';
  previewId: string;
  changes: ProposedChange[];
  summary: {
    totalFiles: number;
    linesAdded: number;
    linesRemoved: number;
  };
}

interface ApproveChangesMessage {
  type: 'approve_changes';
  previewId: string;
  changeIds: string[];  // Specific change IDs to approve
}

interface ChangesAppliedMessage {
  type: 'changes_applied';
  previewId: string;
  appliedChanges: string[];  // IDs of changes that were applied
  filesModified: string[];   // Paths of modified files
}
```

### 2.4 Server Implementation

#### Preview Manager (`server/src/services/preview-manager.ts`)

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { diff_match_patch } from 'diff-match-patch';

export class PreviewManager {
  private projectDir: string;
  private currentPreview: ChangePreview | null = null;
  private fileCache: Map<string, string> = new Map();

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  /**
   * Start a new preview session
   */
  startPreview(annotations: Annotation[]): string {
    const previewId = uuidv4();
    this.currentPreview = {
      id: previewId,
      timestamp: new Date(),
      annotations,
      changes: [],
      status: 'pending'
    };
    this.fileCache.clear();
    return previewId;
  }

  /**
   * Record a proposed file change (called when agent tries to write)
   */
  async recordChange(filePath: string, newContent: string): Promise<ProposedChange> {
    if (!this.currentPreview) {
      throw new Error('No active preview session');
    }

    const fullPath = path.join(this.projectDir, filePath);
    let originalContent: string | null = null;
    let changeType: 'create' | 'modify' | 'delete' = 'create';

    // Check if file exists and get original content
    try {
      originalContent = await fs.readFile(fullPath, 'utf-8');
      changeType = 'modify';
      this.fileCache.set(filePath, originalContent);
    } catch {
      // File doesn't exist, it's a create
      changeType = 'create';
    }

    // Generate diff
    const dmp = new diff_match_patch();
    const patches = dmp.patch_make(originalContent || '', newContent);
    const diff = dmp.patch_toText(patches);

    // Count lines changed
    const linesAdded = (newContent.match(/\n/g) || []).length + 1;
    const linesRemoved = originalContent ? (originalContent.match(/\n/g) || []).length + 1 : 0;

    // Detect language from file extension
    const ext = path.extname(filePath).slice(1);
    const languageMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      py: 'python', rb: 'ruby', java: 'java', go: 'go', rs: 'rust',
      css: 'css', scss: 'scss', html: 'html', json: 'json', md: 'markdown'
    };

    const change: ProposedChange = {
      id: uuidv4(),
      filePath,
      changeType,
      originalContent,
      proposedContent: newContent,
      diff: this.generateUnifiedDiff(filePath, originalContent, newContent),
      language: languageMap[ext] || 'plaintext',
      linesAdded: this.countAddedLines(originalContent, newContent),
      linesRemoved: this.countRemovedLines(originalContent, newContent)
    };

    this.currentPreview.changes.push(change);
    return change;
  }

  /**
   * Record a file deletion
   */
  async recordDeletion(filePath: string): Promise<ProposedChange> {
    if (!this.currentPreview) {
      throw new Error('No active preview session');
    }

    const fullPath = path.join(this.projectDir, filePath);
    const originalContent = await fs.readFile(fullPath, 'utf-8');
    this.fileCache.set(filePath, originalContent);

    const change: ProposedChange = {
      id: uuidv4(),
      filePath,
      changeType: 'delete',
      originalContent,
      proposedContent: null,
      diff: this.generateUnifiedDiff(filePath, originalContent, ''),
      language: 'plaintext',
      linesAdded: 0,
      linesRemoved: (originalContent.match(/\n/g) || []).length + 1
    };

    this.currentPreview.changes.push(change);
    return change;
  }

  /**
   * Get current preview state
   */
  getCurrentPreview(): ChangePreview | null {
    return this.currentPreview;
  }

  /**
   * Apply approved changes
   */
  async applyChanges(changeIds: string[]): Promise<string[]> {
    if (!this.currentPreview) {
      throw new Error('No active preview session');
    }

    const appliedFiles: string[] = [];

    for (const changeId of changeIds) {
      const change = this.currentPreview.changes.find(c => c.id === changeId);
      if (!change) continue;

      const fullPath = path.join(this.projectDir, change.filePath);

      switch (change.changeType) {
        case 'create':
        case 'modify':
          if (change.proposedContent !== null) {
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, change.proposedContent);
            appliedFiles.push(change.filePath);
          }
          break;
        case 'delete':
          await fs.unlink(fullPath);
          appliedFiles.push(change.filePath);
          break;
      }
    }

    return appliedFiles;
  }

  /**
   * Reject and discard preview
   */
  discardPreview(): void {
    this.currentPreview = null;
    this.fileCache.clear();
  }

  private generateUnifiedDiff(filePath: string, original: string | null, proposed: string): string {
    // Generate proper unified diff format
    const originalLines = (original || '').split('\n');
    const proposedLines = proposed.split('\n');

    let diff = `--- a/${filePath}\n+++ b/${filePath}\n`;

    // Simple line-by-line diff (in production, use a proper diff library)
    // This is a simplified version - real implementation would use diff-match-patch or similar

    return diff;
  }

  private countAddedLines(original: string | null, proposed: string): number {
    const originalLines = new Set((original || '').split('\n'));
    const proposedLines = proposed.split('\n');
    return proposedLines.filter(l => !originalLines.has(l)).length;
  }

  private countRemovedLines(original: string | null, proposed: string): number {
    if (!original) return 0;
    const proposedLines = new Set(proposed.split('\n'));
    const originalLines = original.split('\n');
    return originalLines.filter(l => !proposedLines.has(l)).length;
  }
}
```

### 2.5 Client Implementation

#### Diff Viewer Component (`client/src/components/diff-viewer.ts`)

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ProposedChange } from '../types';

@customElement('zing-diff-viewer')
export class DiffViewer extends LitElement {
  @property({ type: Array }) changes: ProposedChange[] = [];
  @property({ type: String }) previewId: string = '';
  @property({ type: Boolean }) isOpen: boolean = false;

  @state() private selectedChangeId: string | null = null;
  @state() private approvedIds: Set<string> = new Set();
  @state() private rejectedIds: Set<string> = new Set();
  @state() private diffStyle: 'unified' | 'split' = 'unified';
  @state() private isApplying: boolean = false;

  static styles = css`
    :host {
      display: block;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10003;
      display: none;
    }

    .overlay.open {
      display: flex;
    }

    .dialog {
      margin: 40px auto;
      width: 90vw;
      max-width: 1400px;
      height: calc(100vh - 80px);
      background: #1e1e1e;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .header {
      padding: 16px 24px;
      background: #252525;
      border-bottom: 1px solid #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header h2 {
      margin: 0;
      color: #fff;
      font-size: 18px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .file-list {
      width: 280px;
      border-right: 1px solid #333;
      overflow-y: auto;
      background: #252525;
    }

    .file-item {
      padding: 12px 16px;
      border-bottom: 1px solid #333;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .file-item:hover {
      background: #2d2d2d;
    }

    .file-item.selected {
      background: #0d47a1;
    }

    .file-item.approved {
      border-left: 3px solid #4caf50;
    }

    .file-item.rejected {
      border-left: 3px solid #f44336;
      opacity: 0.6;
    }

    .file-icon {
      font-size: 14px;
    }

    .file-name {
      flex: 1;
      color: #fff;
      font-size: 13px;
      word-break: break-all;
    }

    .file-stats {
      font-size: 11px;
      color: #888;
    }

    .file-stats .added { color: #4caf50; }
    .file-stats .removed { color: #f44336; }

    .diff-panel {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }

    .diff-content {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .diff-line {
      padding: 2px 8px;
    }

    .diff-line.added {
      background: rgba(76, 175, 80, 0.2);
      color: #81c784;
    }

    .diff-line.removed {
      background: rgba(244, 67, 54, 0.2);
      color: #e57373;
    }

    .diff-line.header {
      color: #64b5f6;
      font-weight: bold;
    }

    .file-actions {
      display: flex;
      gap: 8px;
    }

    .approve-btn, .reject-btn {
      padding: 4px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .approve-btn {
      background: #4caf50;
      color: white;
    }

    .reject-btn {
      background: #f44336;
      color: white;
    }

    .footer {
      padding: 16px 24px;
      background: #252525;
      border-top: 1px solid #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .summary {
      color: #888;
      font-size: 14px;
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
      font-size: 14px;
      font-weight: 500;
    }

    .btn-primary {
      background: #4caf50;
      color: white;
    }

    .btn-secondary {
      background: #666;
      color: white;
    }

    .btn-danger {
      background: #f44336;
      color: white;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .empty-state {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      color: #888;
    }
  `;

  render() {
    const selectedChange = this.changes.find(c => c.id === this.selectedChangeId);
    const approvedCount = this.approvedIds.size;
    const totalCount = this.changes.length;

    return html`
      <div class="overlay ${this.isOpen ? 'open' : ''}">
        <div class="dialog">
          <div class="header">
            <h2>Review Proposed Changes</h2>
            <div class="header-actions">
              <select @change=${this._handleStyleChange}>
                <option value="unified" ?selected=${this.diffStyle === 'unified'}>Unified</option>
                <option value="split" ?selected=${this.diffStyle === 'split'}>Split</option>
              </select>
              <button class="btn btn-secondary" @click=${this._handleClose}>Cancel</button>
            </div>
          </div>

          <div class="body">
            <div class="file-list">
              ${this.changes.map(change => this._renderFileItem(change))}
            </div>

            <div class="diff-panel">
              ${selectedChange
                ? this._renderDiff(selectedChange)
                : html`<div class="empty-state">Select a file to view changes</div>`
              }
            </div>
          </div>

          <div class="footer">
            <div class="summary">
              ${approvedCount} of ${totalCount} changes approved
              (${this._getTotalLines().added} additions, ${this._getTotalLines().removed} deletions)
            </div>
            <div class="footer-actions">
              <button
                class="btn btn-danger"
                @click=${this._handleRejectAll}
                ?disabled=${this.isApplying}
              >
                Reject All
              </button>
              <button
                class="btn btn-secondary"
                @click=${this._handleApproveAll}
                ?disabled=${this.isApplying}
              >
                Approve All
              </button>
              <button
                class="btn btn-primary"
                @click=${this._handleApplyApproved}
                ?disabled=${approvedCount === 0 || this.isApplying}
              >
                ${this.isApplying ? 'Applying...' : `Apply ${approvedCount} Changes`}
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

    const icon = change.changeType === 'create' ? '➕'
               : change.changeType === 'delete' ? '🗑️'
               : '📝';

    return html`
      <div
        class="file-item ${isSelected ? 'selected' : ''} ${isApproved ? 'approved' : ''} ${isRejected ? 'rejected' : ''}"
        @click=${() => this._selectChange(change.id)}
      >
        <span class="file-icon">${icon}</span>
        <span class="file-name">${change.filePath}</span>
        <div class="file-stats">
          <span class="added">+${change.linesAdded}</span>
          <span class="removed">-${change.linesRemoved}</span>
        </div>
        <div class="file-actions">
          <button
            class="approve-btn"
            @click=${(e: Event) => { e.stopPropagation(); this._approveChange(change.id); }}
            ?disabled=${isApproved}
          >✓</button>
          <button
            class="reject-btn"
            @click=${(e: Event) => { e.stopPropagation(); this._rejectChange(change.id); }}
            ?disabled=${isRejected}
          >✗</button>
        </div>
      </div>
    `;
  }

  private _renderDiff(change: ProposedChange) {
    const lines = change.diff.split('\n');

    return html`
      <div class="diff-content">
        ${lines.map(line => {
          let className = 'diff-line';
          if (line.startsWith('+') && !line.startsWith('+++')) {
            className += ' added';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            className += ' removed';
          } else if (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')) {
            className += ' header';
          }
          return html`<div class="${className}">${line}</div>`;
        })}
      </div>
    `;
  }

  private _selectChange(id: string) {
    this.selectedChangeId = id;
  }

  private _approveChange(id: string) {
    this.rejectedIds.delete(id);
    this.approvedIds.add(id);
    this.requestUpdate();
  }

  private _rejectChange(id: string) {
    this.approvedIds.delete(id);
    this.rejectedIds.add(id);
    this.requestUpdate();
  }

  private _handleApproveAll() {
    this.rejectedIds.clear();
    this.changes.forEach(c => this.approvedIds.add(c.id));
    this.requestUpdate();
  }

  private _handleRejectAll() {
    this.approvedIds.clear();
    this.changes.forEach(c => this.rejectedIds.add(c.id));
    this.requestUpdate();
  }

  private _handleApplyApproved() {
    this.isApplying = true;
    this.dispatchEvent(new CustomEvent('apply-changes', {
      detail: {
        previewId: this.previewId,
        changeIds: Array.from(this.approvedIds)
      }
    }));
  }

  private _handleStyleChange(e: Event) {
    this.diffStyle = (e.target as HTMLSelectElement).value as 'unified' | 'split';
  }

  private _handleClose() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private _getTotalLines() {
    return this.changes.reduce((acc, c) => ({
      added: acc.added + c.linesAdded,
      removed: acc.removed + c.linesRemoved
    }), { added: 0, removed: 0 });
  }
}
```

### 2.6 Agent Modifications for Preview Mode

#### Base Agent Updates (`server/src/agents/base.ts`)

```typescript
export abstract class BaseAgent implements Agent {
  // ... existing code ...

  /**
   * Override in subclass to enable preview mode
   * When true, file operations are intercepted instead of applied
   */
  protected previewMode: boolean = false;
  protected previewManager: PreviewManager | null = null;

  setPreviewMode(enabled: boolean, previewManager?: PreviewManager): void {
    this.previewMode = enabled;
    this.previewManager = previewManager || null;
  }

  /**
   * Intercept file write operations when in preview mode
   */
  protected async handleFileWrite(filePath: string, content: string): Promise<void> {
    if (this.previewMode && this.previewManager) {
      await this.previewManager.recordChange(filePath, content);
    } else {
      // Actual file write (handled by agent SDK)
    }
  }
}
```

---

## Shared Infrastructure

### 3.1 New Dependencies

Add to `server/package.json`:
```json
{
  "dependencies": {
    "uuid": "^9.0.0",
    "diff-match-patch": "^1.0.5"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0",
    "@types/diff-match-patch": "^1.0.5"
  }
}
```

### 3.2 Settings Updates

#### Client Settings (`client/src/types/index.ts`)

```typescript
export interface ZingSettings {
  // ... existing fields ...

  // New fields for these features
  previewMode: boolean;          // Enable preview before apply (default: true)
  diffStyle: 'unified' | 'split'; // Preferred diff view style
  showUndoBar: boolean;          // Show undo toast after changes (default: true)
  undoBarTimeout: number;        // Undo bar auto-dismiss timeout (default: 10000)
  autoCheckpoint: boolean;       // Auto-create checkpoints (default: true)
}
```

### 3.3 Error Handling

```typescript
// Common error types for these features
export class CheckpointError extends Error {
  constructor(message: string, public readonly code: 'NOT_GIT_REPO' | 'DIRTY_WORKING_TREE' | 'CHECKPOINT_NOT_FOUND') {
    super(message);
    this.name = 'CheckpointError';
  }
}

export class PreviewError extends Error {
  constructor(message: string, public readonly code: 'NO_ACTIVE_PREVIEW' | 'CHANGE_NOT_FOUND' | 'APPLY_FAILED') {
    super(message);
    this.name = 'PreviewError';
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (Infrastructure)
1. Add new dependencies
2. Implement `GitManager` class
3. Implement `PreviewManager` class
4. Add new WebSocket message types
5. Update server to handle new messages
6. Add settings fields

**Deliverables:**
- Working Git checkpoint creation/restoration
- Preview mode intercepts file writes
- New message types flow through WebSocket

### Phase 2: Undo/Redo Feature
1. Implement `history-panel.ts` component
2. Implement `undo-bar.ts` component
3. Integrate with `zing-ui.ts` main component
4. Add keyboard shortcuts (Ctrl+Z for undo)
5. Add History button to toolbar
6. Test checkpoint workflow

**Deliverables:**
- Functional history panel
- One-click undo capability
- Revert to any checkpoint

### Phase 3: Visual Diff Feature
1. Implement `diff-viewer.ts` component
2. Add syntax highlighting (consider Monaco Editor or Prism.js)
3. Implement split-view diff option
4. Add approval workflow UI
5. Connect to preview manager
6. Test with all agent types

**Deliverables:**
- Diff viewer with syntax highlighting
- Approve/reject workflow
- Preview mode toggle in settings

### Phase 4: Integration & Polish
1. Integration testing of both features together
2. Edge case handling (large files, binary files, etc.)
3. Performance optimization
4. Documentation updates
5. User onboarding tooltips

**Deliverables:**
- Fully integrated features
- Comprehensive test coverage
- Updated documentation

---

## Testing Strategy

### Unit Tests

```typescript
// Example test cases for GitManager
describe('GitManager', () => {
  it('should create checkpoint with correct metadata', async () => {
    const gm = new GitManager('/test/project');
    const checkpoint = await gm.createCheckpoint({
      annotations: [{ id: '1', identifier: '#test', notes: 'Test' }],
      pageUrl: 'http://localhost',
      pageTitle: 'Test Page',
      agentName: 'claude'
    });

    expect(checkpoint.id).toBeDefined();
    expect(checkpoint.commitHash).toMatch(/^[a-f0-9]{40}$/);
  });

  it('should undo last checkpoint', async () => {
    // Setup: create checkpoint and make changes
    // Action: undo
    // Assert: files restored to previous state
  });

  it('should handle dirty working tree', async () => {
    // Setup: make uncommitted changes
    // Action: create checkpoint
    // Assert: uncommitted changes are auto-committed
  });
});

describe('PreviewManager', () => {
  it('should record file creation', async () => {
    const pm = new PreviewManager('/test/project');
    pm.startPreview([]);

    const change = await pm.recordChange('new-file.ts', 'content');

    expect(change.changeType).toBe('create');
    expect(change.originalContent).toBeNull();
  });

  it('should generate correct diff for modifications', async () => {
    // Test diff generation
  });

  it('should apply only approved changes', async () => {
    // Test partial approval
  });
});
```

### Integration Tests

```typescript
describe('Undo/Redo Integration', () => {
  it('should create checkpoint → make changes → undo → verify files restored', async () => {
    // Full workflow test
  });
});

describe('Preview Mode Integration', () => {
  it('should intercept agent writes → show diff → approve → apply', async () => {
    // Full preview workflow test
  });
});
```

### E2E Tests

- Test checkpoint creation with real Git operations
- Test diff viewer with various file types
- Test undo across page refreshes
- Test with all three agents (Claude, Copilot, Codex)

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Git operations fail on non-Git projects | Medium | High | Detect and warn user, disable checkpoint features |
| Large diffs cause performance issues | Medium | Medium | Paginate diff view, limit preview size |
| Agent SDKs don't support write interception | Medium | High | Implement file system watcher as fallback |
| Concurrent modifications cause conflicts | Low | High | Lock files during preview, queue operations |

### UX Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Users find preview mode too slow | Medium | Medium | Make preview optional, add skip option |
| History panel becomes cluttered | Medium | Low | Add filtering, pagination, cleanup options |
| Undo bar is annoying | Low | Low | Make dismissable, add "don't show again" |

### Mitigation Strategies

1. **Graceful Degradation**: If Git is unavailable, disable checkpoint features but allow direct editing
2. **Progressive Enhancement**: Start with basic diff, add syntax highlighting as enhancement
3. **User Preferences**: Let users disable features they don't need
4. **Performance Budgets**: Set limits on file sizes and checkpoint history length

---

## Appendix: File Structure

```
server/
├── src/
│   ├── services/           # NEW directory
│   │   ├── git-manager.ts  # Git operations
│   │   └── preview-manager.ts # Preview mode
│   ├── agents/
│   │   └── base.ts         # Modified for preview support
│   ├── types.ts            # Extended with new types
│   └── index.ts            # Handle new message types
│
client/
├── src/
│   ├── components/
│   │   ├── history-panel.ts  # NEW
│   │   ├── undo-bar.ts       # NEW
│   │   ├── diff-viewer.ts    # NEW
│   │   └── zing-ui.ts        # Modified to integrate new components
│   ├── services/
│   │   └── websocket.ts      # Extended for new message types
│   └── types/
│       └── index.ts          # Extended with new types

docs/
└── IMPLEMENTATION_PLAN.md    # This document
```

---

## Conclusion

These two features will significantly enhance user trust and control when using ZingIt with AI agents. The implementation is designed to:

1. **Minimize risk** with Git-based checkpoints and preview mode
2. **Maximize visibility** with diff viewers and history panels
3. **Maintain flexibility** with optional features and user preferences
4. **Ensure reliability** with comprehensive error handling and testing

The phased approach allows for incremental delivery and validation at each step.
