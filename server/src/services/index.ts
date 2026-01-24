// server/src/services/index.ts

export { GitManager, GitManagerError } from './git-manager.js';
export type { Checkpoint, CheckpointInfo, ChangeHistory, FileChange, AnnotationSummary } from './git-manager.js';

export { PreviewManager, PreviewError } from './preview-manager.js';
export type { ProposedChange, ChangePreview, PreviewSummary } from './preview-manager.js';
