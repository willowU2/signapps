/**
 * Views Registry
 *
 * Provides view templates and quick filter presets for different entity types.
 */

import {
  CheckSquare,
  Clock,
  Calendar,
  FileText,
  Users,
  AlertCircle,
  Star,
  Archive,
  Inbox,
  Send,
  Trash2,
  FolderOpen,
  Image,
  Video,
  Music,
  File,
  Container,
  Activity,
  Shield,
} from "lucide-react";
import type {
  ViewTemplate,
  QuickFilterPreset,
  ViewDefinition,
  FilterGroup,
} from "./types";

// ============================================================================
// Default Filter Group (empty)
// ============================================================================

export const createEmptyFilterGroup = (): FilterGroup => ({
  id: crypto.randomUUID(),
  logic: "and",
  conditions: [],
});

// ============================================================================
// View Templates
// ============================================================================

export const viewTemplates: ViewTemplate[] = [
  // Tasks Templates
  {
    id: "tasks-my-tasks",
    name: "Mes Tâches",
    description: "Tâches qui me sont assignées",
    icon: CheckSquare,
    entityType: "tasks",
    category: "personal",
    view: {
      name: "Mes Tâches",
      entityType: "tasks",
      viewType: "table",
      columns: [
        { field: "title", visible: true, order: 0 },
        { field: "status", visible: true, order: 1 },
        { field: "priority", visible: true, order: 2 },
        { field: "due_date", visible: true, order: 3 },
        { field: "project", visible: true, order: 4 },
      ],
      sort: [{ field: "due_date", direction: "asc" }],
      filters: {
        id: "filter-my-tasks",
        logic: "and",
        conditions: [
          {
            id: "assignee-me",
            field: "assignee_id",
            operator: "equals",
            value: "{{current_user}}",
            valueType: "string",
          },
        ],
      },
      pageSize: 25,
      isDefault: true,
    },
  },
  {
    id: "tasks-overdue",
    name: "Tâches en Retard",
    description: "Tâches dont la date d'échéance est passée",
    icon: AlertCircle,
    entityType: "tasks",
    category: "urgency",
    view: {
      name: "Tâches en Retard",
      entityType: "tasks",
      viewType: "table",
      columns: [
        { field: "title", visible: true, order: 0 },
        { field: "assignee", visible: true, order: 1 },
        { field: "due_date", visible: true, order: 2 },
        { field: "priority", visible: true, order: 3 },
      ],
      sort: [{ field: "due_date", direction: "asc" }],
      filters: {
        id: "filter-overdue",
        logic: "and",
        conditions: [
          {
            id: "overdue",
            field: "due_date",
            operator: "before",
            value: "{{today}}",
            valueType: "date",
          },
          {
            id: "not-done",
            field: "status",
            operator: "not_equals",
            value: "done",
            valueType: "select",
          },
        ],
      },
      pageSize: 25,
    },
  },
  {
    id: "tasks-kanban",
    name: "Kanban",
    description: "Vue Kanban par statut",
    icon: Activity,
    entityType: "tasks",
    category: "visualization",
    view: {
      name: "Kanban",
      entityType: "tasks",
      viewType: "kanban",
      columns: [
        { field: "title", visible: true, order: 0 },
        { field: "assignee", visible: true, order: 1 },
        { field: "priority", visible: true, order: 2 },
      ],
      sort: [{ field: "priority", direction: "desc" }],
      filters: createEmptyFilterGroup(),
      groupBy: "status",
      pageSize: 50,
    },
  },

  // Files Templates
  {
    id: "files-recent",
    name: "Fichiers Récents",
    description: "Fichiers modifiés récemment",
    icon: Clock,
    entityType: "files",
    category: "time",
    view: {
      name: "Fichiers Récents",
      entityType: "files",
      viewType: "table",
      columns: [
        { field: "name", visible: true, order: 0 },
        { field: "type", visible: true, order: 1 },
        { field: "size", visible: true, order: 2 },
        { field: "modified_at", visible: true, order: 3 },
        { field: "modified_by", visible: true, order: 4 },
      ],
      sort: [{ field: "modified_at", direction: "desc" }],
      filters: createEmptyFilterGroup(),
      pageSize: 25,
      isDefault: true,
    },
  },
  {
    id: "files-images",
    name: "Images",
    description: "Tous les fichiers images",
    icon: Image,
    entityType: "files",
    category: "type",
    view: {
      name: "Images",
      entityType: "files",
      viewType: "cards",
      columns: [
        { field: "name", visible: true, order: 0 },
        { field: "size", visible: true, order: 1 },
        { field: "dimensions", visible: true, order: 2 },
      ],
      sort: [{ field: "created_at", direction: "desc" }],
      filters: {
        id: "filter-images",
        logic: "or",
        conditions: [
          { id: "jpg", field: "mime_type", operator: "equals", value: "image/jpeg", valueType: "string" },
          { id: "png", field: "mime_type", operator: "equals", value: "image/png", valueType: "string" },
          { id: "gif", field: "mime_type", operator: "equals", value: "image/gif", valueType: "string" },
          { id: "webp", field: "mime_type", operator: "equals", value: "image/webp", valueType: "string" },
        ],
      },
      pageSize: 50,
    },
  },
  {
    id: "files-documents",
    name: "Documents",
    description: "Documents bureautiques",
    icon: FileText,
    entityType: "files",
    category: "type",
    view: {
      name: "Documents",
      entityType: "files",
      viewType: "table",
      columns: [
        { field: "name", visible: true, order: 0 },
        { field: "type", visible: true, order: 1 },
        { field: "size", visible: true, order: 2 },
        { field: "modified_at", visible: true, order: 3 },
      ],
      sort: [{ field: "modified_at", direction: "desc" }],
      filters: {
        id: "filter-docs",
        logic: "or",
        conditions: [
          { id: "pdf", field: "mime_type", operator: "equals", value: "application/pdf", valueType: "string" },
          { id: "docx", field: "mime_type", operator: "contains", value: "wordprocessingml", valueType: "string" },
          { id: "xlsx", field: "mime_type", operator: "contains", value: "spreadsheetml", valueType: "string" },
          { id: "pptx", field: "mime_type", operator: "contains", value: "presentationml", valueType: "string" },
        ],
      },
      pageSize: 25,
    },
  },

  // Events Templates
  {
    id: "events-upcoming",
    name: "Événements à Venir",
    description: "Événements des 7 prochains jours",
    icon: Calendar,
    entityType: "events",
    category: "time",
    view: {
      name: "Événements à Venir",
      entityType: "events",
      viewType: "table",
      columns: [
        { field: "title", visible: true, order: 0 },
        { field: "start_time", visible: true, order: 1 },
        { field: "end_time", visible: true, order: 2 },
        { field: "location", visible: true, order: 3 },
        { field: "attendees", visible: true, order: 4 },
      ],
      sort: [{ field: "start_time", direction: "asc" }],
      filters: {
        id: "filter-upcoming",
        logic: "and",
        conditions: [
          {
            id: "next-week",
            field: "start_time",
            operator: "next_n_days",
            value: 7,
            valueType: "date",
          },
        ],
      },
      pageSize: 25,
      isDefault: true,
    },
  },
  {
    id: "events-calendar",
    name: "Vue Calendrier",
    description: "Affichage calendrier mensuel",
    icon: Calendar,
    entityType: "events",
    category: "visualization",
    view: {
      name: "Vue Calendrier",
      entityType: "events",
      viewType: "calendar",
      columns: [
        { field: "title", visible: true, order: 0 },
        { field: "start_time", visible: true, order: 1 },
        { field: "color", visible: true, order: 2 },
      ],
      sort: [{ field: "start_time", direction: "asc" }],
      filters: createEmptyFilterGroup(),
      pageSize: 100,
    },
  },

  // Users Templates
  {
    id: "users-active",
    name: "Utilisateurs Actifs",
    description: "Utilisateurs avec compte actif",
    icon: Users,
    entityType: "users",
    category: "status",
    view: {
      name: "Utilisateurs Actifs",
      entityType: "users",
      viewType: "table",
      columns: [
        { field: "avatar", visible: true, order: 0 },
        { field: "username", visible: true, order: 1 },
        { field: "email", visible: true, order: 2 },
        { field: "role", visible: true, order: 3 },
        { field: "last_login", visible: true, order: 4 },
      ],
      sort: [{ field: "last_login", direction: "desc" }],
      filters: {
        id: "filter-active",
        logic: "and",
        conditions: [
          {
            id: "active",
            field: "is_active",
            operator: "is_true",
            value: true,
            valueType: "boolean",
          },
        ],
      },
      pageSize: 25,
      isDefault: true,
    },
  },
  {
    id: "users-admins",
    name: "Administrateurs",
    description: "Utilisateurs avec droits admin",
    icon: Shield,
    entityType: "users",
    category: "role",
    view: {
      name: "Administrateurs",
      entityType: "users",
      viewType: "table",
      columns: [
        { field: "avatar", visible: true, order: 0 },
        { field: "username", visible: true, order: 1 },
        { field: "email", visible: true, order: 2 },
        { field: "role", visible: true, order: 3 },
        { field: "created_at", visible: true, order: 4 },
      ],
      sort: [{ field: "username", direction: "asc" }],
      filters: {
        id: "filter-admins",
        logic: "and",
        conditions: [
          {
            id: "admin-role",
            field: "role",
            operator: "in",
            value: ["admin", "super_admin"],
            valueType: "multi_select",
          },
        ],
      },
      pageSize: 25,
    },
  },

  // Containers Templates
  {
    id: "containers-running",
    name: "Containers Actifs",
    description: "Containers en cours d'exécution",
    icon: Container,
    entityType: "containers",
    category: "status",
    view: {
      name: "Containers Actifs",
      entityType: "containers",
      viewType: "table",
      columns: [
        { field: "name", visible: true, order: 0 },
        { field: "image", visible: true, order: 1 },
        { field: "status", visible: true, order: 2 },
        { field: "ports", visible: true, order: 3 },
        { field: "created", visible: true, order: 4 },
      ],
      sort: [{ field: "name", direction: "asc" }],
      filters: {
        id: "filter-running",
        logic: "and",
        conditions: [
          {
            id: "running",
            field: "state",
            operator: "equals",
            value: "running",
            valueType: "select",
          },
        ],
      },
      pageSize: 25,
      isDefault: true,
    },
  },
];

// ============================================================================
// Quick Filter Presets
// ============================================================================

export const quickFilterPresets: QuickFilterPreset[] = [
  // Tasks Quick Filters
  {
    id: "tasks-quick",
    entityType: "tasks",
    filters: [
      {
        id: "qf-my-tasks",
        label: "Mes tâches",
        icon: CheckSquare,
        filter: {
          id: "qf-assignee",
          field: "assignee_id",
          operator: "equals",
          value: "{{current_user}}",
          valueType: "string",
        },
      },
      {
        id: "qf-high-priority",
        label: "Priorité haute",
        icon: AlertCircle,
        filter: {
          id: "qf-priority",
          field: "priority",
          operator: "equals",
          value: "high",
          valueType: "select",
        },
      },
      {
        id: "qf-due-today",
        label: "Échéance aujourd'hui",
        icon: Clock,
        filter: {
          id: "qf-due",
          field: "due_date",
          operator: "on_date",
          value: "{{today}}",
          valueType: "date",
        },
      },
      {
        id: "qf-overdue",
        label: "En retard",
        icon: AlertCircle,
        filter: {
          id: "qf-overdue",
          logic: "and",
          conditions: [
            { id: "past", field: "due_date", operator: "before", value: "{{today}}", valueType: "date" },
            { id: "not-done", field: "status", operator: "not_equals", value: "done", valueType: "select" },
          ],
        },
      },
      {
        id: "qf-starred",
        label: "Favoris",
        icon: Star,
        filter: {
          id: "qf-starred",
          field: "is_starred",
          operator: "is_true",
          value: true,
          valueType: "boolean",
        },
      },
    ],
  },

  // Files Quick Filters
  {
    id: "files-quick",
    entityType: "files",
    filters: [
      {
        id: "qf-recent",
        label: "Récents",
        icon: Clock,
        filter: {
          id: "qf-recent",
          field: "modified_at",
          operator: "last_n_days",
          value: 7,
          valueType: "date",
        },
      },
      {
        id: "qf-images",
        label: "Images",
        icon: Image,
        filter: {
          id: "qf-images",
          field: "mime_type",
          operator: "starts_with",
          value: "image/",
          valueType: "string",
        },
      },
      {
        id: "qf-videos",
        label: "Vidéos",
        icon: Video,
        filter: {
          id: "qf-videos",
          field: "mime_type",
          operator: "starts_with",
          value: "video/",
          valueType: "string",
        },
      },
      {
        id: "qf-documents",
        label: "Documents",
        icon: FileText,
        filter: {
          id: "qf-docs",
          logic: "or",
          conditions: [
            { id: "pdf", field: "mime_type", operator: "equals", value: "application/pdf", valueType: "string" },
            { id: "doc", field: "mime_type", operator: "contains", value: "document", valueType: "string" },
          ],
        },
      },
      {
        id: "qf-shared",
        label: "Partagés",
        icon: Users,
        filter: {
          id: "qf-shared",
          field: "is_shared",
          operator: "is_true",
          value: true,
          valueType: "boolean",
        },
      },
    ],
  },

  // Events Quick Filters
  {
    id: "events-quick",
    entityType: "events",
    filters: [
      {
        id: "qf-today",
        label: "Aujourd'hui",
        icon: Calendar,
        filter: {
          id: "qf-today",
          field: "start_time",
          operator: "on_date",
          value: "{{today}}",
          valueType: "date",
        },
      },
      {
        id: "qf-this-week",
        label: "Cette semaine",
        icon: Calendar,
        filter: {
          id: "qf-week",
          field: "start_time",
          operator: "this_week",
          value: null,
          valueType: "date",
        },
      },
      {
        id: "qf-my-events",
        label: "Mes événements",
        icon: Users,
        filter: {
          id: "qf-mine",
          field: "organizer_id",
          operator: "equals",
          value: "{{current_user}}",
          valueType: "string",
        },
      },
    ],
  },

  // Users Quick Filters
  {
    id: "users-quick",
    entityType: "users",
    filters: [
      {
        id: "qf-active",
        label: "Actifs",
        icon: Activity,
        filter: {
          id: "qf-active",
          field: "is_active",
          operator: "is_true",
          value: true,
          valueType: "boolean",
        },
      },
      {
        id: "qf-admins",
        label: "Admins",
        icon: Shield,
        filter: {
          id: "qf-admin",
          field: "role",
          operator: "in",
          value: ["admin", "super_admin"],
          valueType: "multi_select",
        },
      },
      {
        id: "qf-recent-login",
        label: "Connectés récemment",
        icon: Clock,
        filter: {
          id: "qf-login",
          field: "last_login",
          operator: "last_n_days",
          value: 7,
          valueType: "date",
        },
      },
    ],
  },
];

// ============================================================================
// Registry Functions
// ============================================================================

export function getTemplatesForEntity(entityType: string): ViewTemplate[] {
  return viewTemplates.filter((t) => t.entityType === entityType);
}

export function getTemplatesByCategory(
  entityType: string,
  category: string
): ViewTemplate[] {
  return viewTemplates.filter(
    (t) => t.entityType === entityType && t.category === category
  );
}

export function getTemplate(templateId: string): ViewTemplate | undefined {
  return viewTemplates.find((t) => t.id === templateId);
}

export function getQuickFilters(entityType: string): QuickFilterPreset | undefined {
  return quickFilterPresets.find((p) => p.entityType === entityType);
}

export function createViewFromTemplate(
  template: ViewTemplate,
  userId: string
): ViewDefinition {
  return {
    ...template.view,
    id: crypto.randomUUID(),
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getDefaultView(entityType: string): ViewTemplate | undefined {
  return viewTemplates.find(
    (t) => t.entityType === entityType && t.view.isDefault
  );
}

// ============================================================================
// Template Categories
// ============================================================================

export const templateCategories = [
  { id: "personal", label: "Personnel", icon: Users },
  { id: "time", label: "Temporel", icon: Clock },
  { id: "status", label: "Statut", icon: Activity },
  { id: "type", label: "Type", icon: FolderOpen },
  { id: "role", label: "Rôle", icon: Shield },
  { id: "urgency", label: "Urgence", icon: AlertCircle },
  { id: "visualization", label: "Visualisation", icon: Activity },
];
