/**
 * Universal Blocks System - Types
 *
 * Types et interfaces pour le système de blocs universels.
 * Chaque entité (User, File, Task, Event, Document) peut être
 * convertie en UniversalBlock pour un affichage uniforme.
 */

// ============================================================================
// Block Types
// ============================================================================

export type BlockType =
  | "user"
  | "file"
  | "folder"
  | "task"
  | "event"
  | "document"
  | "group"
  | "role"
  | "container"
  | "custom";

export type BlockDisplayMode = "inline" | "card" | "row" | "preview" | "full";

// ============================================================================
// Block Permissions
// ============================================================================

export interface BlockPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canLink: boolean;
}

// ============================================================================
// Block Metadata
// ============================================================================

export interface BlockMetadata {
  /** Creation timestamp */
  createdAt?: string;
  /** Last update timestamp */
  updatedAt?: string;
  /** Owner/creator ID */
  ownerId?: string;
  /** Owner display name */
  ownerName?: string;
  /** Size in bytes (for files) */
  size?: number;
  /** MIME type (for files) */
  mimeType?: string;
  /** Status (for tasks, containers) */
  status?: string;
  /** Priority (for tasks) */
  priority?: string;
  /** Due date (for tasks, events) */
  dueDate?: string;
  /** Start date (for events) */
  startDate?: string;
  /** End date (for events) */
  endDate?: string;
  /** Location (for events) */
  location?: string;
  /** Tags */
  tags?: string[];
  /** Custom metadata */
  [key: string]: unknown;
}

// ============================================================================
// Universal Block Interface
// ============================================================================

export interface UniversalBlock {
  /** Unique block ID */
  id: string;

  /** Block type */
  type: BlockType;

  /** Primary display title */
  title: string;

  /** Secondary subtitle/description */
  subtitle?: string;

  /** Full description */
  description?: string;

  /** Icon name (lucide-react) */
  icon?: string;

  /** Avatar URL (for users) */
  avatarUrl?: string;

  /** Thumbnail URL (for files, documents) */
  thumbnailUrl?: string;

  /** Color for visual identification */
  color?: string;

  /** Permissions for this block */
  permissions: BlockPermissions;

  /** Related blocks */
  linkedBlocks?: LinkedBlock[];

  /** Block metadata */
  metadata: BlockMetadata;

  /** Original entity data */
  original?: unknown;
}

// ============================================================================
// Linked Block
// ============================================================================

export type LinkType =
  | "reference"    // Generic reference
  | "parent"       // Parent-child relationship
  | "child"
  | "assignee"     // Task assignment
  | "owner"        // Ownership
  | "attachment"   // File attachment
  | "mention"      // @mention in text
  | "related";     // Generic relation

export interface LinkedBlock {
  /** Linked block ID */
  blockId: string;

  /** Linked block type */
  blockType: BlockType;

  /** Type of relationship */
  linkType: LinkType;

  /** Link metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Block Adapter Interface
// ============================================================================

export interface BlockAdapter<T> {
  /** Convert entity to UniversalBlock */
  toBlock(entity: T): UniversalBlock;

  /** Convert UniversalBlock back to entity (partial) */
  fromBlock?(block: UniversalBlock): Partial<T>;

  /** Get searchable text from entity */
  getSearchableText(entity: T): string;

  /** Get sortable value for a field */
  getSortValue(entity: T, field: string): unknown;
}

// ============================================================================
// Block Renderer Props
// ============================================================================

export interface BlockRendererProps {
  /** Block to render */
  block: UniversalBlock;

  /** Display mode */
  mode: BlockDisplayMode;

  /** Click handler */
  onClick?: (block: UniversalBlock) => void;

  /** Double-click handler */
  onDoubleClick?: (block: UniversalBlock) => void;

  /** Context menu handler */
  onContextMenu?: (block: UniversalBlock, event: React.MouseEvent) => void;

  /** Selection state */
  selected?: boolean;

  /** Selection handler */
  onSelect?: (block: UniversalBlock, selected: boolean) => void;

  /** Draggable state */
  draggable?: boolean;

  /** Custom class name */
  className?: string;

  /** Show actions on hover */
  showActions?: boolean;

  /** Custom actions */
  actions?: BlockAction[];
}

// ============================================================================
// Block Actions
// ============================================================================

export interface BlockAction {
  id: string;
  label: string;
  icon?: string;
  onClick: (block: UniversalBlock) => void;
  requiredPermission?: keyof BlockPermissions;
  variant?: "default" | "destructive";
}

// ============================================================================
// Block Search Result
// ============================================================================

export interface BlockSearchResult {
  block: UniversalBlock;
  score: number;
  highlights?: {
    field: string;
    matches: string[];
  }[];
}

// ============================================================================
// Block Registry Entry
// ============================================================================

export interface BlockRegistryEntry<T = unknown> {
  type: BlockType;
  adapter: BlockAdapter<T>;
  defaultIcon: string;
  defaultColor: string;
  displayName: string;
  pluralName: string;
  searchWeight: number;
}
