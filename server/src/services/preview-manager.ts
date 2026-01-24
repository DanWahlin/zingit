// server/src/services/preview-manager.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createTwoFilesPatch } from 'diff';
import type { Annotation } from '../types.js';

export interface ProposedChange {
  id: string;
  filePath: string;
  changeType: 'create' | 'modify' | 'delete';
  originalContent: string | null;
  proposedContent: string | null;
  diff: string;
  language: string;
  linesAdded: number;
  linesRemoved: number;
}

export interface ChangePreview {
  id: string;
  timestamp: string;
  annotations: Array<{ identifier: string; notes: string }>;
  changes: ProposedChange[];
  status: 'pending' | 'approved' | 'rejected' | 'partial';
}

export interface PreviewSummary {
  previewId: string;
  totalFiles: number;
  linesAdded: number;
  linesRemoved: number;
  changes: ProposedChange[];
}

// Map file extensions to language names for syntax highlighting
const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  rb: 'ruby',
  java: 'java',
  go: 'go',
  rs: 'rust',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'fish',
  ps1: 'powershell',
  vue: 'vue',
  svelte: 'svelte',
};

export class PreviewManager {
  private projectDir: string;
  private currentPreview: ChangePreview | null = null;
  private originalContentCache: Map<string, string> = new Map();

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
      timestamp: new Date().toISOString(),
      annotations: annotations.map((a) => ({
        identifier: a.identifier,
        notes: a.notes,
      })),
      changes: [],
      status: 'pending',
    };
    this.originalContentCache.clear();

    console.log(`[PreviewManager] Started preview session ${previewId.slice(0, 8)}`);
    return previewId;
  }

  /**
   * Record a proposed file change (called when agent tries to write a file)
   */
  async recordChange(filePath: string, newContent: string): Promise<ProposedChange> {
    if (!this.currentPreview) {
      throw new PreviewError('No active preview session', 'NO_ACTIVE_PREVIEW');
    }

    // Normalize the file path
    const normalizedPath = filePath.startsWith(this.projectDir)
      ? path.relative(this.projectDir, filePath)
      : filePath;

    const fullPath = path.join(this.projectDir, normalizedPath);

    let originalContent: string | null = null;
    let changeType: 'create' | 'modify' = 'create';

    // Check if we already have this file cached
    if (this.originalContentCache.has(normalizedPath)) {
      originalContent = this.originalContentCache.get(normalizedPath) || null;
      changeType = 'modify';
    } else {
      // Try to read the existing file
      try {
        originalContent = await fs.readFile(fullPath, 'utf-8');
        changeType = 'modify';
        this.originalContentCache.set(normalizedPath, originalContent);
      } catch {
        // File doesn't exist, it's a create
        changeType = 'create';
        this.originalContentCache.set(normalizedPath, '');
      }
    }

    // Generate unified diff
    const diff = createTwoFilesPatch(
      `a/${normalizedPath}`,
      `b/${normalizedPath}`,
      originalContent || '',
      newContent,
      '',
      ''
    );

    // Detect language from file extension
    const ext = path.extname(normalizedPath).slice(1).toLowerCase();
    const language = LANGUAGE_MAP[ext] || 'plaintext';

    // Count lines changed
    const { linesAdded, linesRemoved } = this.countChangedLines(originalContent, newContent);

    // Check if we already have a change for this file
    const existingChangeIndex = this.currentPreview.changes.findIndex(
      (c) => c.filePath === normalizedPath
    );

    const change: ProposedChange = {
      id: existingChangeIndex >= 0 ? this.currentPreview.changes[existingChangeIndex].id : uuidv4(),
      filePath: normalizedPath,
      changeType,
      originalContent,
      proposedContent: newContent,
      diff,
      language,
      linesAdded,
      linesRemoved,
    };

    if (existingChangeIndex >= 0) {
      // Update existing change
      this.currentPreview.changes[existingChangeIndex] = change;
    } else {
      // Add new change
      this.currentPreview.changes.push(change);
    }

    console.log(
      `[PreviewManager] Recorded ${changeType}: ${normalizedPath} (+${linesAdded}/-${linesRemoved})`
    );
    return change;
  }

  /**
   * Record a file deletion
   */
  async recordDeletion(filePath: string): Promise<ProposedChange> {
    if (!this.currentPreview) {
      throw new PreviewError('No active preview session', 'NO_ACTIVE_PREVIEW');
    }

    const normalizedPath = filePath.startsWith(this.projectDir)
      ? path.relative(this.projectDir, filePath)
      : filePath;

    const fullPath = path.join(this.projectDir, normalizedPath);

    let originalContent: string;
    try {
      originalContent = await fs.readFile(fullPath, 'utf-8');
    } catch {
      throw new PreviewError(`File not found: ${normalizedPath}`, 'FILE_NOT_FOUND');
    }

    this.originalContentCache.set(normalizedPath, originalContent);

    // Generate diff showing deletion
    const diff = createTwoFilesPatch(
      `a/${normalizedPath}`,
      `b/${normalizedPath}`,
      originalContent,
      '',
      '',
      ''
    );

    const ext = path.extname(normalizedPath).slice(1).toLowerCase();
    const linesRemoved = (originalContent.match(/\n/g) || []).length + 1;

    const change: ProposedChange = {
      id: uuidv4(),
      filePath: normalizedPath,
      changeType: 'delete',
      originalContent,
      proposedContent: null,
      diff,
      language: LANGUAGE_MAP[ext] || 'plaintext',
      linesAdded: 0,
      linesRemoved,
    };

    this.currentPreview.changes.push(change);

    console.log(`[PreviewManager] Recorded delete: ${normalizedPath} (-${linesRemoved})`);
    return change;
  }

  /**
   * Get current preview state
   */
  getCurrentPreview(): ChangePreview | null {
    return this.currentPreview;
  }

  /**
   * Get preview summary
   */
  getPreviewSummary(): PreviewSummary | null {
    if (!this.currentPreview) {
      return null;
    }

    const totalLinesAdded = this.currentPreview.changes.reduce((sum, c) => sum + c.linesAdded, 0);
    const totalLinesRemoved = this.currentPreview.changes.reduce(
      (sum, c) => sum + c.linesRemoved,
      0
    );

    return {
      previewId: this.currentPreview.id,
      totalFiles: this.currentPreview.changes.length,
      linesAdded: totalLinesAdded,
      linesRemoved: totalLinesRemoved,
      changes: this.currentPreview.changes,
    };
  }

  /**
   * Apply approved changes to the file system
   */
  async applyChanges(changeIds: string[]): Promise<string[]> {
    if (!this.currentPreview) {
      throw new PreviewError('No active preview session', 'NO_ACTIVE_PREVIEW');
    }

    const appliedFiles: string[] = [];

    for (const changeId of changeIds) {
      const change = this.currentPreview.changes.find((c) => c.id === changeId);
      if (!change) {
        console.warn(`[PreviewManager] Change not found: ${changeId}`);
        continue;
      }

      const fullPath = path.join(this.projectDir, change.filePath);

      try {
        switch (change.changeType) {
          case 'create':
          case 'modify':
            if (change.proposedContent !== null) {
              // Ensure directory exists
              await fs.mkdir(path.dirname(fullPath), { recursive: true });
              await fs.writeFile(fullPath, change.proposedContent, 'utf-8');
              appliedFiles.push(change.filePath);
              console.log(`[PreviewManager] Applied ${change.changeType}: ${change.filePath}`);
            }
            break;

          case 'delete':
            await fs.unlink(fullPath);
            appliedFiles.push(change.filePath);
            console.log(`[PreviewManager] Applied delete: ${change.filePath}`);
            break;
        }
      } catch (err) {
        console.error(`[PreviewManager] Failed to apply ${change.filePath}:`, err);
        throw new PreviewError(
          `Failed to apply change to ${change.filePath}: ${(err as Error).message}`,
          'APPLY_FAILED'
        );
      }
    }

    // Update preview status
    const allApproved = changeIds.length === this.currentPreview.changes.length;
    this.currentPreview.status = allApproved ? 'approved' : 'partial';

    return appliedFiles;
  }

  /**
   * Apply all changes
   */
  async applyAllChanges(): Promise<string[]> {
    if (!this.currentPreview) {
      throw new PreviewError('No active preview session', 'NO_ACTIVE_PREVIEW');
    }

    const allChangeIds = this.currentPreview.changes.map((c) => c.id);
    return this.applyChanges(allChangeIds);
  }

  /**
   * Reject and discard preview
   */
  discardPreview(): void {
    if (this.currentPreview) {
      console.log(`[PreviewManager] Discarded preview ${this.currentPreview.id.slice(0, 8)}`);
      this.currentPreview.status = 'rejected';
    }
    this.currentPreview = null;
    this.originalContentCache.clear();
  }

  /**
   * Check if preview mode is active
   */
  isPreviewActive(): boolean {
    return this.currentPreview !== null;
  }

  /**
   * Get the preview ID if active
   */
  getPreviewId(): string | null {
    return this.currentPreview?.id || null;
  }

  private countChangedLines(
    original: string | null,
    proposed: string
  ): { linesAdded: number; linesRemoved: number } {
    const originalLines = (original || '').split('\n');
    const proposedLines = proposed.split('\n');

    // Simple line counting - a more accurate version would use a proper diff algorithm
    const originalSet = new Set(originalLines);
    const proposedSet = new Set(proposedLines);

    const linesAdded = proposedLines.filter((l) => !originalSet.has(l)).length;
    const linesRemoved = originalLines.filter((l) => !proposedSet.has(l)).length;

    return { linesAdded, linesRemoved };
  }
}

/**
 * Custom error class for PreviewManager errors
 */
export class PreviewError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NO_ACTIVE_PREVIEW'
      | 'CHANGE_NOT_FOUND'
      | 'APPLY_FAILED'
      | 'FILE_NOT_FOUND'
  ) {
    super(message);
    this.name = 'PreviewError';
  }
}
