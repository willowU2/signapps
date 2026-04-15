/**
 * Office Versions Components
 *
 * Components for document version history management.
 */

// Components
export { VersionHistoryPanel } from "./version-history-panel";
export { VersionDiffViewer } from "./version-diff-viewer";

// Types
export type {
  DocumentVersion,
  VersionDiff,
  DiffLine,
  DiffStats,
  VersionType,
  DiffChangeType,
  VersionCollaborator,
  VersionHistorySettings,
} from "@/lib/office/versions/types";

// Constants
export {
  VERSION_TYPE_LABELS,
  VERSION_TYPE_COLORS,
  DEFAULT_VERSION_SETTINGS,
} from "@/lib/office/versions/types";

// API
export { versionsApi } from "@/lib/office/versions/api";

// Store
export { useVersionsStore } from "@/stores/versions-store";
