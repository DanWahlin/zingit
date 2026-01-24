// server/src/services/git-manager.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Annotation } from '../types.js';

const execAsync = promisify(exec);

export interface Checkpoint {
  id: string;
  timestamp: string;
  commitHash: string;
  branchName: string;
  annotations: AnnotationSummary[];
  pageUrl: string;
  pageTitle: string;
  agentName: string;
  status: 'pending' | 'applied' | 'reverted';
  filesModified: number;
  linesChanged: number;
}

export interface AnnotationSummary {
  identifier: string;
  notes: string;
}

export interface FileChange {
  checkpointId: string;
  filePath: string;
  changeType: 'created' | 'modified' | 'deleted';
  linesAdded: number;
  linesRemoved: number;
}

export interface ChangeHistory {
  projectDir: string;
  checkpoints: Checkpoint[];
  currentCheckpointId: string | null;
}

export interface CheckpointInfo {
  id: string;
  timestamp: string;
  annotations: AnnotationSummary[];
  filesModified: number;
  linesChanged: number;
  agentName: string;
  pageUrl: string;
  status: 'pending' | 'applied' | 'reverted';
  canUndo: boolean;
}

export class GitManager {
  private projectDir: string;
  private historyFile: string;
  private zingitDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
    this.zingitDir = path.join(projectDir, '.zingit');
    this.historyFile = path.join(this.zingitDir, 'history.json');
  }

  /**
   * Initialize ZingIt tracking in the project
   */
  async initialize(): Promise<void> {
    // Ensure .zingit directory exists
    await fs.mkdir(this.zingitDir, { recursive: true });

    // Add .zingit to .gitignore if not present
    const gitignorePath = path.join(this.projectDir, '.gitignore');
    try {
      const gitignore = await fs.readFile(gitignorePath, 'utf-8');
      if (!gitignore.includes('.zingit')) {
        await fs.appendFile(gitignorePath, '\n# ZingIt history\n.zingit/\n');
      }
    } catch {
      // .gitignore doesn't exist - that's okay, we'll create history anyway
    }

    // Initialize history file if it doesn't exist
    try {
      await fs.access(this.historyFile);
    } catch {
      await this.saveHistory({
        projectDir: this.projectDir,
        checkpoints: [],
        currentCheckpointId: null,
      });
    }
  }

  /**
   * Check if git repo exists and get status
   */
  async checkGitStatus(): Promise<{
    isRepo: boolean;
    isClean: boolean;
    branch: string;
    error?: string;
  }> {
    try {
      const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.projectDir,
      });
      const { stdout: status } = await execAsync('git status --porcelain', {
        cwd: this.projectDir,
      });
      return {
        isRepo: true,
        isClean: status.trim() === '',
        branch: branch.trim(),
      };
    } catch (err) {
      return {
        isRepo: false,
        isClean: false,
        branch: '',
        error: (err as Error).message,
      };
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
      throw new GitManagerError(
        'Project directory is not a git repository. Initialize git first with: git init',
        'NOT_GIT_REPO'
      );
    }

    // If there are uncommitted changes, auto-commit them
    if (!status.isClean) {
      try {
        await execAsync('git add -A', { cwd: this.projectDir });
        await execAsync('git commit -m "[ZingIt] Auto-save before AI modifications"', {
          cwd: this.projectDir,
        });
      } catch (err) {
        // Commit might fail if nothing to commit after add, that's okay
        console.log('Note: Auto-commit skipped -', (err as Error).message);
      }
    }

    // Get current commit hash
    const { stdout: commitHash } = await execAsync('git rev-parse HEAD', {
      cwd: this.projectDir,
    });

    const checkpoint: Checkpoint = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      commitHash: commitHash.trim(),
      branchName: status.branch,
      annotations: metadata.annotations.map((a) => ({
        identifier: a.identifier,
        notes: a.notes,
      })),
      pageUrl: metadata.pageUrl,
      pageTitle: metadata.pageTitle,
      agentName: metadata.agentName,
      status: 'pending',
      filesModified: 0,
      linesChanged: 0,
    };

    // Save checkpoint to history
    const history = await this.loadHistory();
    history.checkpoints.push(checkpoint);
    await this.saveHistory(history);

    console.log(`[GitManager] Created checkpoint ${checkpoint.id.slice(0, 8)}`);
    return checkpoint;
  }

  /**
   * Finalize checkpoint after AI modifications complete
   */
  async finalizeCheckpoint(checkpointId: string): Promise<FileChange[]> {
    const history = await this.loadHistory();
    const checkpoint = history.checkpoints.find((c) => c.id === checkpointId);

    if (!checkpoint) {
      throw new GitManagerError(`Checkpoint not found: ${checkpointId}`, 'CHECKPOINT_NOT_FOUND');
    }

    // Get list of changed files since checkpoint
    let diffStat = '';
    try {
      const result = await execAsync(`git diff --name-status ${checkpoint.commitHash}`, {
        cwd: this.projectDir,
      });
      diffStat = result.stdout;
    } catch {
      // No changes
      diffStat = '';
    }

    const fileChanges: FileChange[] = [];
    const lines = diffStat.trim().split('\n').filter((l) => l);

    let totalLinesAdded = 0;
    let totalLinesRemoved = 0;

    for (const line of lines) {
      const [statusChar, ...filePathParts] = line.split('\t');
      const filePath = filePathParts.join('\t'); // Handle filenames with tabs
      const changeType =
        statusChar === 'A' ? 'created' : statusChar === 'D' ? 'deleted' : 'modified';

      // Get line counts for this file
      let linesAdded = 0;
      let linesRemoved = 0;
      try {
        const { stdout: numstat } = await execAsync(
          `git diff --numstat ${checkpoint.commitHash} -- "${filePath}"`,
          { cwd: this.projectDir }
        );
        const parts = numstat.trim().split('\t');
        linesAdded = parseInt(parts[0]) || 0;
        linesRemoved = parseInt(parts[1]) || 0;
      } catch {
        // Ignore errors for individual files
      }

      totalLinesAdded += linesAdded;
      totalLinesRemoved += linesRemoved;

      fileChanges.push({
        checkpointId,
        filePath,
        changeType,
        linesAdded,
        linesRemoved,
      });
    }

    // Commit the changes if there are any
    if (fileChanges.length > 0) {
      try {
        await execAsync('git add -A', { cwd: this.projectDir });
        const identifiers = checkpoint.annotations.map((a) => a.identifier).join(', ');
        const commitMsg = `[ZingIt] ${identifiers}`;
        await execAsync(`git commit -m "${commitMsg}"`, { cwd: this.projectDir });
      } catch (err) {
        console.log('Note: Commit skipped -', (err as Error).message);
      }
    }

    // Update checkpoint status and stats
    checkpoint.status = 'applied';
    checkpoint.filesModified = fileChanges.length;
    checkpoint.linesChanged = totalLinesAdded + totalLinesRemoved;
    history.currentCheckpointId = checkpointId;
    await this.saveHistory(history);

    console.log(
      `[GitManager] Finalized checkpoint ${checkpointId.slice(0, 8)}: ${fileChanges.length} files, ${checkpoint.linesChanged} lines`
    );
    return fileChanges;
  }

  /**
   * Undo the most recent checkpoint
   */
  async undoLastCheckpoint(): Promise<{ checkpointId: string; filesReverted: string[] }> {
    const history = await this.loadHistory();

    if (!history.currentCheckpointId) {
      throw new GitManagerError('No changes to undo', 'NO_CHANGES_TO_UNDO');
    }

    const checkpoint = history.checkpoints.find((c) => c.id === history.currentCheckpointId);
    if (!checkpoint) {
      throw new GitManagerError('Current checkpoint not found', 'CHECKPOINT_NOT_FOUND');
    }

    if (checkpoint.status !== 'applied') {
      throw new GitManagerError('Checkpoint is not in applied state', 'INVALID_CHECKPOINT_STATE');
    }

    // Reset to the checkpoint's original commit
    await execAsync(`git reset --hard ${checkpoint.commitHash}`, { cwd: this.projectDir });

    // Get files that were reverted
    const filesReverted: string[] = [];
    // We could compute this but for now just return empty - the checkpoint has the info

    // Update history
    checkpoint.status = 'reverted';
    const currentIndex = history.checkpoints.findIndex(
      (c) => c.id === history.currentCheckpointId
    );
    history.currentCheckpointId =
      currentIndex > 0 ? history.checkpoints[currentIndex - 1].id : null;
    await this.saveHistory(history);

    console.log(`[GitManager] Undid checkpoint ${checkpoint.id.slice(0, 8)}`);
    return { checkpointId: checkpoint.id, filesReverted };
  }

  /**
   * Revert to a specific checkpoint
   */
  async revertToCheckpoint(checkpointId: string): Promise<{ filesReverted: string[] }> {
    const history = await this.loadHistory();
    const checkpoint = history.checkpoints.find((c) => c.id === checkpointId);

    if (!checkpoint) {
      throw new GitManagerError(`Checkpoint not found: ${checkpointId}`, 'CHECKPOINT_NOT_FOUND');
    }

    // Reset to that commit
    await execAsync(`git reset --hard ${checkpoint.commitHash}`, { cwd: this.projectDir });

    // Mark all checkpoints after this one as reverted
    const checkpointIndex = history.checkpoints.findIndex((c) => c.id === checkpointId);
    for (let i = checkpointIndex + 1; i < history.checkpoints.length; i++) {
      history.checkpoints[i].status = 'reverted';
    }

    // The target checkpoint itself should be marked as the current state
    // but it was the state BEFORE changes, so set currentCheckpointId to previous
    history.currentCheckpointId = checkpointIndex > 0 ? history.checkpoints[checkpointIndex - 1].id : null;
    await this.saveHistory(history);

    console.log(`[GitManager] Reverted to checkpoint ${checkpointId.slice(0, 8)}`);
    return { filesReverted: [] };
  }

  /**
   * Get change history formatted for client
   */
  async getHistory(): Promise<CheckpointInfo[]> {
    const history = await this.loadHistory();

    return history.checkpoints.map((cp, index) => ({
      id: cp.id,
      timestamp: cp.timestamp,
      annotations: cp.annotations,
      filesModified: cp.filesModified,
      linesChanged: cp.linesChanged,
      agentName: cp.agentName,
      pageUrl: cp.pageUrl,
      status: cp.status,
      canUndo: cp.id === history.currentCheckpointId && cp.status === 'applied',
    }));
  }

  /**
   * Clear all history (dangerous operation)
   */
  async clearHistory(): Promise<void> {
    await this.saveHistory({
      projectDir: this.projectDir,
      checkpoints: [],
      currentCheckpointId: null,
    });
    console.log('[GitManager] History cleared');
  }

  private async loadHistory(): Promise<ChangeHistory> {
    try {
      const data = await fs.readFile(this.historyFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {
        projectDir: this.projectDir,
        checkpoints: [],
        currentCheckpointId: null,
      };
    }
  }

  private async saveHistory(history: ChangeHistory): Promise<void> {
    await fs.mkdir(this.zingitDir, { recursive: true });
    await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2));
  }
}

/**
 * Custom error class for GitManager errors
 */
export class GitManagerError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_GIT_REPO'
      | 'DIRTY_WORKING_TREE'
      | 'CHECKPOINT_NOT_FOUND'
      | 'NO_CHANGES_TO_UNDO'
      | 'INVALID_CHECKPOINT_STATE'
  ) {
    super(message);
    this.name = 'GitManagerError';
  }
}
