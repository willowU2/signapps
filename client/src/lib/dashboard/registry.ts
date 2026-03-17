/**
 * Dashboard System - Widget Registry
 *
 * Registry centralisé pour les widgets de dashboard.
 */

import {
  BarChart3,
  Grid3X3,
  Activity,
  Zap,
  Network,
  Bookmark,
  Shield,
  CheckSquare,
  Calendar,
  FileText,
  Users,
  Clock,
  Bell,
  TrendingUp,
  HardDrive,
  type LucideIcon,
} from "lucide-react";

import type { WidgetDefinition, WidgetCategory, DashboardPreset } from "./types";

// ============================================================================
// Widget Registry
// ============================================================================

const widgetRegistry = new Map<string, WidgetDefinition>();

// ============================================================================
// Built-in Widgets
// ============================================================================

// System widgets
widgetRegistry.set("stat-cards", {
  type: "stat-cards",
  name: "Statistiques",
  description: "Containers, Storage, Routes, Uptime",
  category: "analytics",
  icon: BarChart3,
  size: { minW: 6, minH: 2, defaultW: 12, defaultH: 2 },
  isPublic: true,
});

widgetRegistry.set("installed-apps", {
  type: "installed-apps",
  name: "Applications",
  description: "Grille des applications en cours",
  category: "system",
  icon: Grid3X3,
  size: { minW: 4, minH: 2, defaultW: 12, defaultH: 3 },
  isPublic: true,
});

widgetRegistry.set("system-health", {
  type: "system-health",
  name: "Santé Système",
  description: "CPU, RAM, Disk et status des services",
  category: "system",
  icon: Activity,
  size: { minW: 4, minH: 3, defaultW: 8, defaultH: 5 },
  requiredPermission: "metrics:read",
});

widgetRegistry.set("quick-actions", {
  type: "quick-actions",
  name: "Actions Rapides",
  description: "Boutons raccourcis",
  category: "productivity",
  icon: Zap,
  size: { minW: 2, minH: 2, defaultW: 4, defaultH: 5 },
  isPublic: true,
  configSchema: {
    type: "object",
    properties: {
      showLabels: {
        type: "boolean",
        title: "Afficher les labels",
        default: true,
      },
      columns: {
        type: "number",
        title: "Colonnes",
        default: 2,
        minimum: 1,
        maximum: 4,
      },
    },
  },
});

widgetRegistry.set("network-traffic", {
  type: "network-traffic",
  name: "Trafic Réseau",
  description: "Statistiques RX/TX",
  category: "analytics",
  icon: Network,
  size: { minW: 4, minH: 2, defaultW: 12, defaultH: 2 },
  requiredPermission: "metrics:read",
});

widgetRegistry.set("bookmarks", {
  type: "bookmarks",
  name: "Favoris",
  description: "Liens rapides personnalisés",
  category: "productivity",
  icon: Bookmark,
  size: { minW: 3, minH: 2, defaultW: 6, defaultH: 3 },
  isPublic: true,
});

widgetRegistry.set("proxy-status", {
  type: "proxy-status",
  name: "Reverse Proxy",
  description: "Status proxy, routes, certificats",
  category: "system",
  icon: Shield,
  size: { minW: 3, minH: 3, defaultW: 4, defaultH: 4 },
  requiredPermission: "proxy:read",
});

// Productivity widgets (new)
widgetRegistry.set("recent-tasks", {
  type: "recent-tasks",
  name: "Tâches Récentes",
  description: "Vos tâches en cours et à venir",
  category: "productivity",
  icon: CheckSquare,
  size: { minW: 3, minH: 3, defaultW: 6, defaultH: 4 },
  isPublic: true,
  defaultConfig: { limit: 5, showCompleted: false },
  configSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        title: "Nombre de tâches",
        default: 5,
        minimum: 3,
        maximum: 15,
      },
      showCompleted: {
        type: "boolean",
        title: "Afficher les tâches terminées",
        default: false,
      },
      filterStatus: {
        type: "string",
        title: "Filtrer par statut",
        enum: ["all", "todo", "in_progress", "done"],
        enumLabels: {
          all: "Tous",
          todo: "À faire",
          in_progress: "En cours",
          done: "Terminé",
        },
        default: "all",
      },
    },
  },
});

widgetRegistry.set("upcoming-events", {
  type: "upcoming-events",
  name: "Événements à Venir",
  description: "Calendrier des prochains événements",
  category: "productivity",
  icon: Calendar,
  size: { minW: 3, minH: 3, defaultW: 6, defaultH: 4 },
  isPublic: true,
  defaultConfig: { limit: 5, daysAhead: 7 },
  configSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        title: "Nombre d'événements",
        default: 5,
        minimum: 3,
        maximum: 10,
      },
      daysAhead: {
        type: "number",
        title: "Jours à l'avance",
        default: 7,
        minimum: 1,
        maximum: 30,
      },
    },
  },
});

widgetRegistry.set("recent-files", {
  type: "recent-files",
  name: "Fichiers Récents",
  description: "Derniers fichiers consultés",
  category: "content",
  icon: FileText,
  size: { minW: 3, minH: 3, defaultW: 6, defaultH: 4 },
  isPublic: true,
  defaultConfig: { limit: 8 },
  configSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        title: "Nombre de fichiers",
        default: 8,
        minimum: 4,
        maximum: 20,
      },
      showThumbnails: {
        type: "boolean",
        title: "Afficher les miniatures",
        default: true,
      },
    },
  },
});

widgetRegistry.set("team-activity", {
  type: "team-activity",
  name: "Activité Équipe",
  description: "Activité récente de l'équipe",
  category: "social",
  icon: Users,
  size: { minW: 3, minH: 3, defaultW: 6, defaultH: 4 },
  isPublic: true,
  defaultConfig: { limit: 10 },
});

widgetRegistry.set("recent-activity", {
  type: "recent-activity",
  name: "Activité Récente",
  description: "Votre activité récente",
  category: "productivity",
  icon: Clock,
  size: { minW: 3, minH: 3, defaultW: 4, defaultH: 4 },
  isPublic: true,
  defaultConfig: { limit: 10 },
});

widgetRegistry.set("notifications", {
  type: "notifications",
  name: "Notifications",
  description: "Dernières notifications",
  category: "social",
  icon: Bell,
  size: { minW: 3, minH: 2, defaultW: 4, defaultH: 3 },
  isPublic: true,
  defaultConfig: { limit: 5 },
});

widgetRegistry.set("storage-usage", {
  type: "storage-usage",
  name: "Utilisation Stockage",
  description: "Espace disque et quotas",
  category: "analytics",
  icon: HardDrive,
  size: { minW: 3, minH: 2, defaultW: 4, defaultH: 3 },
  isPublic: true,
});

widgetRegistry.set("performance-chart", {
  type: "performance-chart",
  name: "Performance",
  description: "Graphique de performance système",
  category: "analytics",
  icon: TrendingUp,
  size: { minW: 4, minH: 3, defaultW: 6, defaultH: 4 },
  requiredPermission: "metrics:read",
  configSchema: {
    type: "object",
    properties: {
      metric: {
        type: "string",
        title: "Métrique",
        enum: ["cpu", "memory", "disk", "network"],
        enumLabels: {
          cpu: "CPU",
          memory: "Mémoire",
          disk: "Disque",
          network: "Réseau",
        },
        default: "cpu",
      },
      timeRange: {
        type: "string",
        title: "Période",
        enum: ["1h", "6h", "24h", "7d"],
        enumLabels: {
          "1h": "1 heure",
          "6h": "6 heures",
          "24h": "24 heures",
          "7d": "7 jours",
        },
        default: "1h",
      },
    },
  },
});

// ============================================================================
// Registry Functions
// ============================================================================

export function registerWidget(definition: WidgetDefinition): void {
  widgetRegistry.set(definition.type, definition);
}

export function getWidget(type: string): WidgetDefinition | undefined {
  return widgetRegistry.get(type);
}

export function getAllWidgets(): WidgetDefinition[] {
  return Array.from(widgetRegistry.values());
}

export function getWidgetsByCategory(
  category: WidgetCategory
): WidgetDefinition[] {
  return getAllWidgets().filter((w) => w.category === category);
}

export function getPublicWidgets(): WidgetDefinition[] {
  return getAllWidgets().filter((w) => w.isPublic);
}

export function getWidgetCategories(): {
  category: WidgetCategory;
  label: string;
  icon: LucideIcon;
}[] {
  return [
    { category: "analytics", label: "Analytique", icon: BarChart3 },
    { category: "productivity", label: "Productivité", icon: CheckSquare },
    { category: "system", label: "Système", icon: Activity },
    { category: "content", label: "Contenu", icon: FileText },
    { category: "social", label: "Social", icon: Users },
    { category: "custom", label: "Personnalisé", icon: Grid3X3 },
  ];
}

// ============================================================================
// Dashboard Presets
// ============================================================================

export const dashboardPresets: DashboardPreset[] = [
  {
    id: "default",
    name: "Standard",
    description: "Dashboard par défaut avec vue d'ensemble",
    targetRole: "all",
    icon: Grid3X3,
    widgets: [
      { type: "stat-cards", x: 0, y: 0, w: 12, h: 2, config: {} },
      { type: "recent-tasks", x: 0, y: 2, w: 6, h: 4, config: { limit: 5 } },
      { type: "upcoming-events", x: 6, y: 2, w: 6, h: 4, config: { limit: 5 } },
      { type: "quick-actions", x: 0, y: 6, w: 4, h: 4, config: {} },
      { type: "recent-files", x: 4, y: 6, w: 4, h: 4, config: { limit: 8 } },
      { type: "notifications", x: 8, y: 6, w: 4, h: 4, config: { limit: 5 } },
    ],
  },
  {
    id: "developer",
    name: "Développeur",
    description: "Focus sur le système et les containers",
    targetRole: "developer",
    icon: Activity,
    widgets: [
      { type: "stat-cards", x: 0, y: 0, w: 12, h: 2, config: {} },
      { type: "installed-apps", x: 0, y: 2, w: 8, h: 3, config: {} },
      { type: "quick-actions", x: 8, y: 2, w: 4, h: 3, config: {} },
      { type: "system-health", x: 0, y: 5, w: 8, h: 5, config: {} },
      { type: "proxy-status", x: 8, y: 5, w: 4, h: 5, config: {} },
      { type: "network-traffic", x: 0, y: 10, w: 12, h: 2, config: {} },
    ],
  },
  {
    id: "manager",
    name: "Manager",
    description: "Focus sur les tâches et l'équipe",
    targetRole: "manager",
    icon: Users,
    widgets: [
      { type: "stat-cards", x: 0, y: 0, w: 12, h: 2, config: {} },
      {
        type: "recent-tasks",
        x: 0,
        y: 2,
        w: 6,
        h: 5,
        config: { limit: 10, showCompleted: true },
      },
      { type: "team-activity", x: 6, y: 2, w: 6, h: 5, config: { limit: 15 } },
      { type: "upcoming-events", x: 0, y: 7, w: 6, h: 4, config: { limit: 8 } },
      {
        type: "performance-chart",
        x: 6,
        y: 7,
        w: 6,
        h: 4,
        config: { metric: "cpu" },
      },
    ],
  },
  {
    id: "minimal",
    name: "Minimaliste",
    description: "Essentiel seulement",
    targetRole: "all",
    icon: Zap,
    widgets: [
      { type: "stat-cards", x: 0, y: 0, w: 12, h: 2, config: {} },
      { type: "recent-tasks", x: 0, y: 2, w: 6, h: 4, config: { limit: 5 } },
      { type: "quick-actions", x: 6, y: 2, w: 6, h: 4, config: {} },
    ],
  },
  {
    id: "admin",
    name: "Administrateur",
    description: "Vue complète du système",
    targetRole: "admin",
    icon: Shield,
    widgets: [
      { type: "stat-cards", x: 0, y: 0, w: 12, h: 2, config: {} },
      { type: "system-health", x: 0, y: 2, w: 6, h: 5, config: {} },
      { type: "installed-apps", x: 6, y: 2, w: 6, h: 5, config: {} },
      { type: "proxy-status", x: 0, y: 7, w: 4, h: 4, config: {} },
      { type: "storage-usage", x: 4, y: 7, w: 4, h: 4, config: {} },
      { type: "network-traffic", x: 8, y: 7, w: 4, h: 4, config: {} },
      {
        type: "performance-chart",
        x: 0,
        y: 11,
        w: 12,
        h: 4,
        config: { metric: "cpu", timeRange: "24h" },
      },
    ],
  },
];

export function getPreset(id: string): DashboardPreset | undefined {
  return dashboardPresets.find((p) => p.id === id);
}

export function getPresetsForRole(
  role?: string
): DashboardPreset[] {
  if (!role) return dashboardPresets.filter((p) => p.targetRole === "all");
  return dashboardPresets.filter(
    (p) => p.targetRole === "all" || p.targetRole === role
  );
}
