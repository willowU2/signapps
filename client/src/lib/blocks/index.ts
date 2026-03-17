/**
 * Universal Blocks System
 *
 * Export centralisé pour le système de blocs universels.
 */

// Types
export type {
  BlockType,
  BlockDisplayMode,
  BlockPermissions,
  BlockMetadata,
  UniversalBlock,
  LinkedBlock,
  LinkType,
  BlockAdapter,
  BlockRendererProps,
  BlockAction,
  BlockSearchResult,
  BlockRegistryEntry,
} from "./types";

// Adapters & Entity Types
export {
  userAdapter,
  fileAdapter,
  taskAdapter,
  eventAdapter,
  documentAdapter,
  containerAdapter,
  type UserEntity,
  type FileEntity,
  type TaskEntity,
  type EventEntity,
  type DocumentEntity,
  type ContainerEntity,
} from "./adapters";

// Registry
export {
  registerBlockAdapter,
  getBlockRegistry,
  getRegisteredBlockTypes,
  getAllBlockRegistries,
  toBlock,
  toBlocks,
  getSearchableText,
  getSortValue,
  getBlockTypeInfo,
  getSearchWeight,
  type EntityTypeMap,
} from "./registry";

// Renderers
export {
  BlockInline,
  BlockCard,
  BlockRow,
  BlockRenderer,
  BlockList,
  type BlockInlineProps,
  type BlockCardProps,
  type BlockRowProps,
  type BlockListProps,
} from "./renderers";

// Linking
export {
  LinkedBlocksList,
  InlineLinkInserter,
  LinkBadge,
  type LinkedBlocksListProps,
  type InlineLinkInserterProps,
  type LinkBadgeProps,
} from "./linking";

// Search
export {
  useBlockSearch,
  BlockSearchInput,
  BlockTypeFilter,
  BlockSearchResults,
  UniversalBlockSearch,
  CommandPaletteSearch,
  type UseBlockSearchOptions,
  type BlockSearchInputProps,
  type BlockTypeFilterProps,
  type BlockSearchResultsProps,
  type UniversalBlockSearchProps,
  type CommandPaletteSearchProps,
} from "./search";
