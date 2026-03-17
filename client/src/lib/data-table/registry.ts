/**
 * Entity Configuration Registry
 *
 * Centralise toutes les configurations d'entités pour les DataTables.
 * Permet de maintenir la cohérence et d'éviter la duplication.
 */

import {
  Users,
  FileText,
  CheckSquare,
  Calendar,
  Mail,
  FolderOpen,
  Shield,
  Webhook,
  Clock,
  Settings,
  Activity,
} from "lucide-react";
import type { EntityConfig } from "./types";

// ============================================================================
// User Entity
// ============================================================================

export interface UserEntity {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: number;
  avatar_url?: string;
  status: "active" | "inactive" | "pending";
  created_at: string;
  last_login?: string;
}

export const userConfig: EntityConfig<UserEntity> = {
  entityType: "users",
  singularName: "Utilisateur",
  pluralName: "Utilisateurs",
  icon: Users,
  columns: [
    {
      id: "username",
      label: "Identifiant",
      accessorKey: "username",
      sortable: true,
      filterable: true,
      cellType: "text",
    },
    {
      id: "full_name",
      label: "Nom complet",
      accessorKey: "full_name",
      sortable: true,
      filterable: true,
      cellType: "text",
    },
    {
      id: "email",
      label: "Email",
      accessorKey: "email",
      sortable: true,
      filterable: true,
      cellType: "text",
    },
    {
      id: "status",
      label: "Statut",
      accessorKey: "status",
      sortable: true,
      filterable: true,
      cellType: "badge",
      badgeVariants: {
        active: "default",
        inactive: "secondary",
        pending: "outline",
      },
    },
    {
      id: "created_at",
      label: "Créé le",
      accessorKey: "created_at",
      sortable: true,
      cellType: "date",
      defaultVisible: false,
    },
    {
      id: "last_login",
      label: "Dernière connexion",
      accessorKey: "last_login",
      sortable: true,
      cellType: "datetime",
    },
  ],
  filters: [
    {
      columnId: "status",
      label: "Statut",
      type: "select",
      options: [
        { value: "active", label: "Actif" },
        { value: "inactive", label: "Inactif" },
        { value: "pending", label: "En attente" },
      ],
    },
    {
      columnId: "created_at",
      label: "Date de création",
      type: "date",
    },
  ],
  viewModes: ["table", "cards"],
  defaultViewMode: "table",
  defaultSort: { id: "username", desc: false },
  primarySearchColumn: "username",
  searchableColumns: ["username", "email", "full_name"],
  enableRowSelection: true,
  pageSizeOptions: [10, 25, 50, 100],
  defaultPageSize: 25,
  getRowId: (row) => row.id,
};

// ============================================================================
// File Entity
// ============================================================================

export interface FileEntity {
  id: string;
  name: string;
  path: string;
  size: number;
  mime_type: string;
  created_at: string;
  modified_at: string;
  owner_id: string;
  owner_name?: string;
  is_shared: boolean;
}

export const fileConfig: EntityConfig<FileEntity> = {
  entityType: "files",
  singularName: "Fichier",
  pluralName: "Fichiers",
  icon: FolderOpen,
  columns: [
    {
      id: "name",
      label: "Nom",
      accessorKey: "name",
      sortable: true,
      filterable: true,
      cellType: "text",
    },
    {
      id: "size",
      label: "Taille",
      accessorKey: "size",
      sortable: true,
      cellType: "text",
      format: (value) => formatFileSize(value as number),
    },
    {
      id: "mime_type",
      label: "Type",
      accessorKey: "mime_type",
      sortable: true,
      filterable: true,
      cellType: "badge",
    },
    {
      id: "owner_name",
      label: "Propriétaire",
      accessorKey: "owner_name",
      sortable: true,
      cellType: "text",
    },
    {
      id: "modified_at",
      label: "Modifié le",
      accessorKey: "modified_at",
      sortable: true,
      cellType: "datetime",
    },
    {
      id: "is_shared",
      label: "Partagé",
      accessorKey: "is_shared",
      cellType: "badge",
      badgeVariants: {
        true: "default",
        false: "secondary",
      },
      format: (value) => (value ? "Oui" : "Non"),
    },
  ],
  filters: [
    {
      columnId: "mime_type",
      label: "Type de fichier",
      type: "select",
      options: [
        { value: "application/pdf", label: "PDF" },
        { value: "image/*", label: "Images" },
        { value: "text/*", label: "Texte" },
        { value: "application/zip", label: "Archives" },
      ],
    },
    {
      columnId: "modified_at",
      label: "Date de modification",
      type: "date",
    },
  ],
  viewModes: ["table", "cards"],
  defaultViewMode: "table",
  defaultSort: { id: "modified_at", desc: true },
  primarySearchColumn: "name",
  searchableColumns: ["name", "path"],
  enableRowSelection: true,
  pageSizeOptions: [25, 50, 100],
  defaultPageSize: 50,
  getRowId: (row) => row.id,
};

// ============================================================================
// Task Entity
// ============================================================================

export interface TaskEntity {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  assignee_id?: string;
  assignee_name?: string;
  due_date?: string;
  created_at: string;
  completed_at?: string;
  tags?: string[];
}

export const taskConfig: EntityConfig<TaskEntity> = {
  entityType: "tasks",
  singularName: "Tâche",
  pluralName: "Tâches",
  icon: CheckSquare,
  columns: [
    {
      id: "title",
      label: "Titre",
      accessorKey: "title",
      sortable: true,
      filterable: true,
      cellType: "text",
    },
    {
      id: "status",
      label: "Statut",
      accessorKey: "status",
      sortable: true,
      filterable: true,
      cellType: "badge",
      badgeVariants: {
        todo: "outline",
        in_progress: "default",
        done: "secondary",
        cancelled: "destructive",
      },
    },
    {
      id: "priority",
      label: "Priorité",
      accessorKey: "priority",
      sortable: true,
      filterable: true,
      cellType: "badge",
      badgeVariants: {
        low: "secondary",
        medium: "outline",
        high: "default",
        urgent: "destructive",
      },
    },
    {
      id: "assignee_name",
      label: "Assigné à",
      accessorKey: "assignee_name",
      sortable: true,
      cellType: "text",
    },
    {
      id: "due_date",
      label: "Échéance",
      accessorKey: "due_date",
      sortable: true,
      cellType: "date",
    },
    {
      id: "created_at",
      label: "Créé le",
      accessorKey: "created_at",
      sortable: true,
      cellType: "datetime",
      defaultVisible: false,
    },
  ],
  filters: [
    {
      columnId: "status",
      label: "Statut",
      type: "select",
      options: [
        { value: "todo", label: "À faire" },
        { value: "in_progress", label: "En cours" },
        { value: "done", label: "Terminé" },
        { value: "cancelled", label: "Annulé" },
      ],
    },
    {
      columnId: "priority",
      label: "Priorité",
      type: "select",
      options: [
        { value: "low", label: "Basse" },
        { value: "medium", label: "Moyenne" },
        { value: "high", label: "Haute" },
        { value: "urgent", label: "Urgente" },
      ],
    },
    {
      columnId: "due_date",
      label: "Échéance",
      type: "date",
    },
  ],
  viewModes: ["table", "cards", "kanban"],
  defaultViewMode: "table",
  defaultSort: { id: "due_date", desc: false },
  primarySearchColumn: "title",
  searchableColumns: ["title", "description"],
  enableRowSelection: true,
  pageSizeOptions: [10, 25, 50],
  defaultPageSize: 25,
  getRowId: (row) => row.id,
};

// ============================================================================
// Role Entity
// ============================================================================

export interface RoleEntity {
  id: string;
  name: string;
  description?: string;
  permissions: Record<string, string[]>;
  is_system: boolean;
  created_at?: string;
}

/** Compte le nombre de ressources dans un rôle */
function getResourceCount(role: RoleEntity): number {
  if (!role.permissions) return 0;
  return Object.keys(role.permissions).length;
}

/** Compte le nombre total de permissions dans un rôle */
function getPermissionCount(role: RoleEntity): number {
  if (!role.permissions) return 0;
  return Object.values(role.permissions).reduce(
    (acc, actions) => acc + (Array.isArray(actions) ? actions.length : 0),
    0
  );
}

export const roleConfig: EntityConfig<RoleEntity> = {
  entityType: "roles",
  singularName: "Rôle",
  pluralName: "Rôles",
  icon: Shield,
  columns: [
    {
      id: "name",
      label: "Rôle",
      accessorKey: "name",
      sortable: true,
      filterable: true,
      cellType: "text",
    },
    {
      id: "description",
      label: "Description",
      accessorKey: "description",
      cellType: "text",
    },
    {
      id: "resources",
      label: "Ressources",
      accessorFn: (row) => getResourceCount(row),
      sortable: true,
      cellType: "badge",
      badgeVariants: {},
    },
    {
      id: "permissions",
      label: "Permissions",
      accessorFn: (row) => getPermissionCount(row),
      sortable: true,
      cellType: "badge",
      badgeVariants: {},
    },
    {
      id: "is_system",
      label: "Système",
      accessorKey: "is_system",
      sortable: true,
      cellType: "badge",
      badgeVariants: {
        true: "secondary",
        false: "outline",
      },
      format: (value) => (value ? "Oui" : "Non"),
    },
  ],
  viewModes: ["table"],
  defaultViewMode: "table",
  defaultSort: { id: "name", desc: false },
  primarySearchColumn: "name",
  searchableColumns: ["name", "description"],
  enableRowSelection: false,
  pageSizeOptions: [10, 25, 50],
  defaultPageSize: 25,
  getRowId: (row) => row.id,
};

// ============================================================================
// Job Entity (Scheduler)
// ============================================================================

export interface JobEntity {
  id: string;
  name: string;
  description?: string;
  cron_expression: string;
  command: string;
  target_type: "container" | "host";
  target_id?: string;
  enabled: boolean;
  last_run?: string;
  last_status?: "success" | "failed" | "running";
  created_at: string;
}

export const jobConfig: EntityConfig<JobEntity> = {
  entityType: "jobs",
  singularName: "Tâche Planifiée",
  pluralName: "Tâches Planifiées",
  icon: Clock,
  columns: [
    {
      id: "name",
      label: "Nom",
      accessorKey: "name",
      sortable: true,
      filterable: true,
      cellType: "text",
    },
    {
      id: "cron_expression",
      label: "Planification",
      accessorKey: "cron_expression",
      cellType: "text",
    },
    {
      id: "target_type",
      label: "Cible",
      accessorKey: "target_type",
      sortable: true,
      cellType: "badge",
      badgeVariants: {
        container: "default",
        host: "secondary",
      },
    },
    {
      id: "enabled",
      label: "Actif",
      accessorKey: "enabled",
      sortable: true,
      cellType: "badge",
      badgeVariants: {
        true: "default",
        false: "secondary",
      },
    },
    {
      id: "last_status",
      label: "Dernier Statut",
      accessorKey: "last_status",
      sortable: true,
      cellType: "badge",
      badgeVariants: {
        success: "default",
        failed: "destructive",
        running: "outline",
      },
    },
    {
      id: "last_run",
      label: "Dernière Exécution",
      accessorKey: "last_run",
      sortable: true,
      cellType: "datetime",
    },
  ],
  filters: [
    {
      columnId: "enabled",
      label: "État",
      type: "boolean",
    },
    {
      columnId: "last_status",
      label: "Dernier Statut",
      type: "select",
      options: [
        { value: "success", label: "Succès" },
        { value: "failed", label: "Échec" },
        { value: "running", label: "En cours" },
      ],
    },
  ],
  viewModes: ["table"],
  defaultViewMode: "table",
  defaultSort: { id: "name", desc: false },
  primarySearchColumn: "name",
  searchableColumns: ["name", "description", "command"],
  enableRowSelection: true,
  pageSizeOptions: [10, 25, 50],
  defaultPageSize: 25,
  getRowId: (row) => row.id,
};

// ============================================================================
// Registry
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const entityRegistry = new Map<string, EntityConfig<any>>();

// Register default configs
entityRegistry.set("users", userConfig);
entityRegistry.set("files", fileConfig);
entityRegistry.set("tasks", taskConfig);
entityRegistry.set("roles", roleConfig);
entityRegistry.set("jobs", jobConfig);

/**
 * Get entity configuration by type
 */
export function getEntityConfig<TData>(
  entityType: string
): EntityConfig<TData> | undefined {
  return entityRegistry.get(entityType);
}

/**
 * Register a new entity configuration
 */
export function registerEntityConfig<TData>(
  entityType: string,
  config: EntityConfig<TData>
): void {
  entityRegistry.set(entityType, config);
}

/**
 * Extend an existing entity configuration
 */
export function extendEntityConfig<TData>(
  entityType: string,
  overrides: Partial<EntityConfig<TData>>
): EntityConfig<TData> {
  const base = entityRegistry.get(entityType);
  if (!base) {
    throw new Error(`Entity config not found: ${entityType}`);
  }
  return { ...base, ...overrides } as EntityConfig<TData>;
}

/**
 * Get all registered entity types
 */
export function getRegisteredEntityTypes(): string[] {
  return Array.from(entityRegistry.keys());
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Re-export types
export type {
  EntityConfig,
  ColumnConfig,
  FilterConfig,
  ActionConfig,
  BulkActionConfig,
  ViewMode,
} from "./types";
