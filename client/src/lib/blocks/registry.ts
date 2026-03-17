/**
 * Universal Blocks System - Registry
 *
 * Registry centralisé pour gérer les adapters de blocs
 * et fournir des méthodes de conversion.
 */

import type {
  BlockType,
  BlockAdapter,
  BlockRegistryEntry,
  UniversalBlock,
} from "./types";

import {
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

// ============================================================================
// Block Registry
// ============================================================================

const registry = new Map<BlockType, BlockRegistryEntry>();

// ============================================================================
// Register Default Adapters
// ============================================================================

registry.set("user", {
  type: "user",
  adapter: userAdapter as BlockAdapter<unknown>,
  defaultIcon: "User",
  defaultColor: "#3b82f6",
  displayName: "Utilisateur",
  pluralName: "Utilisateurs",
  searchWeight: 1.0,
});

registry.set("file", {
  type: "file",
  adapter: fileAdapter as BlockAdapter<unknown>,
  defaultIcon: "File",
  defaultColor: "#6b7280",
  displayName: "Fichier",
  pluralName: "Fichiers",
  searchWeight: 0.9,
});

registry.set("folder", {
  type: "folder",
  adapter: fileAdapter as BlockAdapter<unknown>,
  defaultIcon: "Folder",
  defaultColor: "#eab308",
  displayName: "Dossier",
  pluralName: "Dossiers",
  searchWeight: 0.8,
});

registry.set("task", {
  type: "task",
  adapter: taskAdapter as BlockAdapter<unknown>,
  defaultIcon: "CheckSquare",
  defaultColor: "#8b5cf6",
  displayName: "Tâche",
  pluralName: "Tâches",
  searchWeight: 0.95,
});

registry.set("event", {
  type: "event",
  adapter: eventAdapter as BlockAdapter<unknown>,
  defaultIcon: "Calendar",
  defaultColor: "#3b82f6",
  displayName: "Événement",
  pluralName: "Événements",
  searchWeight: 0.85,
});

registry.set("document", {
  type: "document",
  adapter: documentAdapter as BlockAdapter<unknown>,
  defaultIcon: "FileText",
  defaultColor: "#3b82f6",
  displayName: "Document",
  pluralName: "Documents",
  searchWeight: 0.95,
});

registry.set("container", {
  type: "container",
  adapter: containerAdapter as BlockAdapter<unknown>,
  defaultIcon: "Box",
  defaultColor: "#06b6d4",
  displayName: "Conteneur",
  pluralName: "Conteneurs",
  searchWeight: 0.7,
});

// ============================================================================
// Registry Functions
// ============================================================================

/**
 * Register a custom block adapter
 */
export function registerBlockAdapter<T>(
  type: BlockType,
  entry: Omit<BlockRegistryEntry<T>, "type">
): void {
  registry.set(type, {
    ...entry,
    type,
    adapter: entry.adapter as BlockAdapter<unknown>,
  });
}

/**
 * Get registry entry for a block type
 */
export function getBlockRegistry(type: BlockType): BlockRegistryEntry | undefined {
  return registry.get(type);
}

/**
 * Get all registered block types
 */
export function getRegisteredBlockTypes(): BlockType[] {
  return Array.from(registry.keys());
}

/**
 * Get all registry entries
 */
export function getAllBlockRegistries(): BlockRegistryEntry[] {
  return Array.from(registry.values());
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert entity to UniversalBlock using type hint
 */
export function toBlock<T extends BlockType>(
  type: T,
  entity: EntityTypeMap[T]
): UniversalBlock {
  const entry = registry.get(type);
  if (!entry) {
    throw new Error(`No adapter registered for block type: ${type}`);
  }
  return entry.adapter.toBlock(entity);
}

/**
 * Convert multiple entities to blocks
 */
export function toBlocks<T extends BlockType>(
  type: T,
  entities: EntityTypeMap[T][]
): UniversalBlock[] {
  return entities.map((entity) => toBlock(type, entity));
}

/**
 * Get searchable text for entity
 */
export function getSearchableText<T extends BlockType>(
  type: T,
  entity: EntityTypeMap[T]
): string {
  const entry = registry.get(type);
  if (!entry) {
    throw new Error(`No adapter registered for block type: ${type}`);
  }
  return entry.adapter.getSearchableText(entity);
}

/**
 * Get sortable value for entity field
 */
export function getSortValue<T extends BlockType>(
  type: T,
  entity: EntityTypeMap[T],
  field: string
): unknown {
  const entry = registry.get(type);
  if (!entry) {
    throw new Error(`No adapter registered for block type: ${type}`);
  }
  return entry.adapter.getSortValue(entity, field);
}

// ============================================================================
// Type Mapping
// ============================================================================

export interface EntityTypeMap {
  user: UserEntity;
  file: FileEntity;
  folder: FileEntity;
  task: TaskEntity;
  event: EventEntity;
  document: DocumentEntity;
  container: ContainerEntity;
  group: unknown;
  role: unknown;
  custom: unknown;
}

// ============================================================================
// Block Info Helpers
// ============================================================================

/**
 * Get display info for a block type
 */
export function getBlockTypeInfo(type: BlockType): {
  displayName: string;
  pluralName: string;
  icon: string;
  color: string;
} {
  const entry = registry.get(type);
  if (!entry) {
    return {
      displayName: type,
      pluralName: type,
      icon: "Box",
      color: "#6b7280",
    };
  }
  return {
    displayName: entry.displayName,
    pluralName: entry.pluralName,
    icon: entry.defaultIcon,
    color: entry.defaultColor,
  };
}

/**
 * Get search weight for block type
 */
export function getSearchWeight(type: BlockType): number {
  const entry = registry.get(type);
  return entry?.searchWeight ?? 0.5;
}

// ============================================================================
// Re-export Entity Types
// ============================================================================

export type {
  UserEntity,
  FileEntity,
  TaskEntity,
  EventEntity,
  DocumentEntity,
  ContainerEntity,
} from "./adapters";
