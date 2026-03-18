/**
 * Document Version History Types
 *
 * Type definitions for version history and document diff.
 */

// ============================================================================
// Version Types
// ============================================================================

export type VersionType = 'auto' | 'manual' | 'restore' | 'publish';

export interface DocumentVersion {
  /** Version unique identifier */
  id: string;
  /** Document ID */
  documentId: string;
  /** Version number (1, 2, 3...) */
  versionNumber: number;
  /** Version type */
  type: VersionType;
  /** Version label (for manual saves) */
  label?: string;
  /** Version description */
  description?: string;
  /** Author who created this version */
  authorId: string;
  /** Author name */
  authorName: string;
  /** Author avatar */
  authorAvatar?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Document size in bytes */
  sizeBytes: number;
  /** Word count */
  wordCount?: number;
  /** Character count */
  charCount?: number;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Whether this is the current version */
  isCurrent: boolean;
  /** Whether this version is starred/pinned */
  isStarred: boolean;
  /** Collaborators who contributed to this version */
  collaborators?: VersionCollaborator[];
}

export interface VersionCollaborator {
  userId: string;
  userName: string;
  userAvatar?: string;
  contributionType: 'edit' | 'comment' | 'review';
}

// ============================================================================
// Version Diff Types
// ============================================================================

export type DiffChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface DiffLine {
  /** Line number in the source version */
  sourceLineNumber?: number;
  /** Line number in the target version */
  targetLineNumber?: number;
  /** Change type */
  type: DiffChangeType;
  /** Content of the line */
  content: string;
  /** Inline changes within the line */
  inlineChanges?: InlineChange[];
}

export interface InlineChange {
  /** Start position in the line */
  start: number;
  /** End position in the line */
  end: number;
  /** Change type */
  type: 'added' | 'removed';
  /** Changed text */
  text: string;
}

export interface VersionDiff {
  /** Source version ID */
  sourceVersionId: string;
  /** Target version ID */
  targetVersionId: string;
  /** Source version number */
  sourceVersionNumber: number;
  /** Target version number */
  targetVersionNumber: number;
  /** Diff lines */
  lines: DiffLine[];
  /** Summary statistics */
  stats: DiffStats;
}

export interface DiffStats {
  /** Lines added */
  linesAdded: number;
  /** Lines removed */
  linesRemoved: number;
  /** Lines modified */
  linesModified: number;
  /** Words added */
  wordsAdded: number;
  /** Words removed */
  wordsRemoved: number;
  /** Characters added */
  charsAdded: number;
  /** Characters removed */
  charsRemoved: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GetVersionsParams {
  /** Document ID */
  documentId: string;
  /** Page number */
  page?: number;
  /** Items per page */
  pageSize?: number;
  /** Filter by version type */
  type?: VersionType | 'all';
  /** Include only starred versions */
  starredOnly?: boolean;
  /** Start date filter */
  fromDate?: string;
  /** End date filter */
  toDate?: string;
}

export interface VersionsResponse {
  versions: DocumentVersion[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CreateVersionRequest {
  /** Document ID */
  documentId: string;
  /** Version label */
  label?: string;
  /** Version description */
  description?: string;
}

export interface RestoreVersionRequest {
  /** Version ID to restore */
  versionId: string;
  /** Create a backup of current version before restoring */
  createBackup?: boolean;
}

export interface CompareVersionsRequest {
  /** Source (older) version ID */
  sourceVersionId: string;
  /** Target (newer) version ID */
  targetVersionId: string;
  /** Diff format */
  format?: 'unified' | 'sideBySide';
  /** Context lines around changes */
  contextLines?: number;
}

// ============================================================================
// Version History Settings
// ============================================================================

export interface VersionHistorySettings {
  /** Auto-save interval in minutes */
  autoSaveInterval: number;
  /** Maximum number of auto-save versions to keep */
  maxAutoSaveVersions: number;
  /** Keep all manual versions */
  keepAllManualVersions: boolean;
  /** Enable version comparison */
  enableComparison: boolean;
  /** Show word count changes */
  showWordCountChanges: boolean;
}

export const DEFAULT_VERSION_SETTINGS: VersionHistorySettings = {
  autoSaveInterval: 10,
  maxAutoSaveVersions: 50,
  keepAllManualVersions: true,
  enableComparison: true,
  showWordCountChanges: true,
};

// ============================================================================
// Version Labels
// ============================================================================

export const VERSION_TYPE_LABELS: Record<VersionType, string> = {
  auto: 'Sauvegarde automatique',
  manual: 'Version manuelle',
  restore: 'Restauration',
  publish: 'Publication',
};

export const VERSION_TYPE_COLORS: Record<VersionType, string> = {
  auto: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  manual: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  restore: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  publish: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};
