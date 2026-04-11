import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { preferencesApi } from "@/lib/api/identity";
import { dashboardApi, type WidgetPlacement } from "@/lib/api/dashboard";

// Debounced sync function to avoid spamming the backend
// Persists to both preferences and dashboard layout APIs
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
const syncDashboardLayoutToBackend = (widgets: WidgetConfig[]) => {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    // Sync to preferences API (existing)
    preferencesApi.patch("dashboard", { widgets }).catch(console.error);
    // Sync to dashboard layout API (new)
    const placements: WidgetPlacement[] = widgets.map((w) => ({
      widget_type: w.type,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      config: w.config,
    }));
    dashboardApi.saveLayout(placements).catch(console.error);
  }, 2000);
};

export type WidgetType =
  | "stat-cards"
  | "installed-apps"
  | "system-health"
  | "quick-actions"
  | "network-traffic"
  | "bookmarks"
  | "proxy-status"
  | "recent-tasks"
  | "upcoming-events"
  | "recent-files"
  | "recent-emails"
  | "today-calendar"
  | "tasks-summary"
  | "team-activity"
  | "recent-activity"
  | "notifications"
  | "storage-usage"
  | "performance-chart"
  | "unread-emails"
  | "active-tasks"
  // Unified dashboard widgets (previously hardcoded sections)
  | "ai-daily-brief"
  | "unified-stats"
  | "today-view"
  | "activity-feed"
  | "all-apps"
  | "kpi-cards"
  // IDEA-122: Extended widget library
  | "weather"
  | "rss-feed"
  | "quick-notes"
  // Dashboard customization: extended widgets
  | "activity-heatmap"
  | "favorites"
  | "calendar-preview"
  // AgentIQ widgets
  | "agentiq-agents"
  | "agentiq-subagents"
  | "agentiq-reviewers"
  | "agentiq-ideas"
  | "agentiq-pipeline"
  | "agentiq-timeline"
  | "agentiq-guidelines"
  | "agentiq-health";

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
  // IDEA-124: Per-widget refresh interval in seconds (0 = no auto-refresh)
  refreshInterval?: number;
}

export interface BookmarkItem {
  id: string;
  label: string;
  url: string;
  icon?: string;
}

// ============================================================================
// Role-based default layouts
// ============================================================================

/** Admin layout: system monitoring focus */
const LAYOUT_ADMIN: WidgetConfig[] = [
  { id: "stat-cards", type: "stat-cards", x: 0, y: 0, w: 12, h: 2 },
  { id: "system-health", type: "system-health", x: 0, y: 2, w: 8, h: 5 },
  { id: "quick-actions", type: "quick-actions", x: 8, y: 2, w: 4, h: 5 },
  { id: "installed-apps", type: "installed-apps", x: 0, y: 7, w: 12, h: 3 },
  { id: "network-traffic", type: "network-traffic", x: 0, y: 10, w: 12, h: 2 },
  { id: "proxy-status", type: "proxy-status", x: 0, y: 12, w: 4, h: 4 },
  { id: "recent-activity", type: "recent-activity", x: 4, y: 12, w: 8, h: 4 },
];

/** User layout: productivity focus */
const LAYOUT_USER: WidgetConfig[] = [
  { id: "ai-daily-brief", type: "ai-daily-brief", x: 0, y: 0, w: 12, h: 3 },
  { id: "unified-stats", type: "unified-stats", x: 0, y: 3, w: 12, h: 2 },
  { id: "recent-tasks", type: "recent-tasks", x: 0, y: 5, w: 6, h: 4 },
  { id: "today-calendar", type: "today-calendar", x: 6, y: 5, w: 6, h: 4 },
  { id: "recent-emails", type: "recent-emails", x: 0, y: 9, w: 6, h: 4 },
  { id: "recent-files", type: "recent-files", x: 6, y: 9, w: 6, h: 4 },
  { id: "favorites", type: "favorites", x: 0, y: 13, w: 4, h: 3 },
  { id: "quick-notes", type: "quick-notes", x: 4, y: 13, w: 4, h: 3 },
  { id: "quick-actions", type: "quick-actions", x: 8, y: 13, w: 4, h: 5 },
];

/** Manager layout: hybrid productivity + team oversight */
const LAYOUT_MANAGER: WidgetConfig[] = [
  { id: "ai-daily-brief", type: "ai-daily-brief", x: 0, y: 0, w: 12, h: 3 },
  { id: "unified-stats", type: "unified-stats", x: 0, y: 3, w: 12, h: 2 },
  { id: "recent-tasks", type: "recent-tasks", x: 0, y: 5, w: 6, h: 4 },
  { id: "today-calendar", type: "today-calendar", x: 6, y: 5, w: 6, h: 4 },
  { id: "team-activity", type: "team-activity", x: 0, y: 9, w: 6, h: 4 },
  { id: "recent-emails", type: "recent-emails", x: 6, y: 9, w: 6, h: 4 },
  { id: "kpi-cards", type: "kpi-cards", x: 0, y: 13, w: 8, h: 3 },
  { id: "quick-actions", type: "quick-actions", x: 8, y: 13, w: 4, h: 5 },
  { id: "activity-heatmap", type: "activity-heatmap", x: 0, y: 16, w: 8, h: 3 },
  { id: "notifications", type: "notifications", x: 8, y: 18, w: 4, h: 3 },
];

/**
 * Returns the appropriate default layout based on user role.
 * Role values from backend (UserRole enum): 0=Guest, 1=User, 2=Admin, 3=SuperAdmin
 */
export function getDefaultLayout(role: number): WidgetConfig[] {
  if (role >= 2) return LAYOUT_ADMIN;
  if (role >= 1) return LAYOUT_MANAGER;
  return LAYOUT_USER;
}

// Fallback for backwards compat — uses user layout
const DEFAULT_WIDGETS: WidgetConfig[] = LAYOUT_USER;

export const WIDGET_CATALOG: {
  type: WidgetType;
  label: string;
  description: string;
  defaultW: number;
  defaultH: number;
  category?: string;
}[] = [
  // Analytics
  {
    type: "stat-cards",
    label: "Statistiques",
    description: "Containers, Storage, Routes, Uptime",
    defaultW: 12,
    defaultH: 2,
    category: "analytics",
  },
  {
    type: "network-traffic",
    label: "Trafic réseau",
    description: "Statistiques RX/TX",
    defaultW: 12,
    defaultH: 2,
    category: "analytics",
  },
  {
    type: "storage-usage",
    label: "Utilisation Stockage",
    description: "Espace disque et quotas",
    defaultW: 4,
    defaultH: 3,
    category: "analytics",
  },
  {
    type: "performance-chart",
    label: "Performance",
    description: "Graphique CPU/RAM/Disque",
    defaultW: 6,
    defaultH: 4,
    category: "analytics",
  },
  // Productivity
  {
    type: "recent-tasks",
    label: "Tâches Récentes",
    description: "Vos tâches en cours et à venir",
    defaultW: 6,
    defaultH: 4,
    category: "productivity",
  },
  {
    type: "upcoming-events",
    label: "Événements à Venir",
    description: "Calendrier des prochains événements",
    defaultW: 6,
    defaultH: 4,
    category: "productivity",
  },
  {
    type: "quick-actions",
    label: "Actions rapides",
    description: "Boutons raccourcis",
    defaultW: 4,
    defaultH: 5,
    category: "productivity",
  },
  {
    type: "bookmarks",
    label: "Favoris",
    description: "Liens rapides personnalisés",
    defaultW: 6,
    defaultH: 3,
    category: "productivity",
  },
  {
    type: "today-calendar",
    label: "Agenda d'Aujourd'hui",
    description: "Événements du jour",
    defaultW: 6,
    defaultH: 4,
    category: "productivity",
  },
  {
    type: "tasks-summary",
    label: "Résumé des Tâches",
    description: "Statistiques et compteurs de tâches",
    defaultW: 4,
    defaultH: 3,
    category: "productivity",
  },
  {
    type: "recent-emails",
    label: "Emails Récents",
    description: "Derniers emails reçus",
    defaultW: 6,
    defaultH: 4,
    category: "productivity",
  },
  {
    type: "unread-emails",
    label: "Emails Non Lus",
    description: "Compteur d'emails non lus avec lien direct",
    defaultW: 4,
    defaultH: 2,
    category: "productivity",
  },
  {
    type: "active-tasks",
    label: "Tâches Actives",
    description: "Nombre de tâches en cours",
    defaultW: 4,
    defaultH: 2,
    category: "productivity",
  },
  // Unified dashboard widgets (previously hardcoded)
  {
    type: "ai-daily-brief",
    label: "Résumé du jour (IA)",
    description: "Résumé IA: tâches, emails, événements",
    defaultW: 12,
    defaultH: 3,
    category: "productivity",
  },
  {
    type: "unified-stats",
    label: "Statistiques unifiées",
    description: "Documents, emails, événements en un coup d'oeil",
    defaultW: 12,
    defaultH: 2,
    category: "analytics",
  },
  {
    type: "today-view",
    label: "Vue Aujourd'hui",
    description: "Emails + tâches + événements du jour combinés",
    defaultW: 12,
    defaultH: 5,
    category: "productivity",
  },
  {
    type: "activity-feed",
    label: "Fil d'activité",
    description: "Activité globale avec filtres",
    defaultW: 6,
    defaultH: 4,
    category: "content",
  },
  {
    type: "all-apps",
    label: "Toutes les applications",
    description: "Catalogue complet des applications",
    defaultW: 12,
    defaultH: 5,
    category: "system",
  },
  {
    type: "kpi-cards",
    label: "KPIs clés",
    description: "Indicateurs de performance multi-services",
    defaultW: 8,
    defaultH: 3,
    category: "analytics",
  },
  // Content
  {
    type: "recent-files",
    label: "Fichiers Récents",
    description: "Derniers fichiers consultés",
    defaultW: 6,
    defaultH: 4,
    category: "content",
  },
  {
    type: "recent-activity",
    label: "Activité Récente",
    description: "Votre activité récente",
    defaultW: 4,
    defaultH: 4,
    category: "content",
  },
  // System
  {
    type: "installed-apps",
    label: "Applications",
    description: "Grille des applications en cours",
    defaultW: 12,
    defaultH: 3,
    category: "system",
  },
  {
    type: "system-health",
    label: "Santé système",
    description: "CPU, RAM, Disk et status des services",
    defaultW: 8,
    defaultH: 5,
    category: "system",
  },
  {
    type: "proxy-status",
    label: "Reverse Proxy",
    description: "Status proxy, routes, certificats",
    defaultW: 4,
    defaultH: 4,
    category: "system",
  },
  // Social
  {
    type: "team-activity",
    label: "Activité Équipe",
    description: "Activité récente de l'équipe",
    defaultW: 6,
    defaultH: 4,
    category: "social",
  },
  {
    type: "notifications",
    label: "Notifications",
    description: "Dernières notifications",
    defaultW: 4,
    defaultH: 3,
    category: "social",
  },
  // IDEA-122: Extended widget library
  {
    type: "weather",
    label: "Météo",
    description: "Météo locale en temps réel",
    defaultW: 4,
    defaultH: 3,
    category: "productivity",
  },
  {
    type: "rss-feed",
    label: "RSS Feed",
    description: "Flux RSS personnalisé",
    defaultW: 4,
    defaultH: 4,
    category: "content",
  },
  {
    type: "quick-notes",
    label: "Notes rapides",
    description: "Bloc-notes personnel",
    defaultW: 4,
    defaultH: 3,
    category: "productivity",
  },
  // Dashboard customization: extended widgets
  {
    type: "activity-heatmap",
    label: "Heatmap d'activité",
    description: "Carte de chaleur de l'activité sur les 12 dernières semaines",
    defaultW: 8,
    defaultH: 3,
    category: "analytics",
  },
  {
    type: "favorites",
    label: "Favoris",
    description: "Accès rapide à vos éléments épinglés",
    defaultW: 4,
    defaultH: 3,
    category: "productivity",
  },
  {
    type: "calendar-preview",
    label: "Aperçu calendrier",
    description: "Mini-calendrier avec événements de la semaine",
    defaultW: 4,
    defaultH: 4,
    category: "productivity",
  },
  // AgentIQ widgets
  {
    type: "agentiq-agents",
    label: "AI Agents",
    description: "Les 3 agents principaux: Antigravity, Claude, OpenClaw",
    defaultW: 6,
    defaultH: 4,
    category: "agentiq",
  },
  {
    type: "agentiq-subagents",
    label: "Sous-Agents",
    description: "Sous-agents dispatchés par les agents principaux",
    defaultW: 4,
    defaultH: 3,
    category: "agentiq",
  },
  {
    type: "agentiq-reviewers",
    label: "Code Reviewers",
    description: "Agents de revue de code par domaine",
    defaultW: 4,
    defaultH: 3,
    category: "agentiq",
  },
  {
    type: "agentiq-ideas",
    label: "Ideas Kanban",
    description: "Kanban des idées: Quick Win / Moyen Terme / Long Terme",
    defaultW: 6,
    defaultH: 5,
    category: "agentiq",
  },
  {
    type: "agentiq-pipeline",
    label: "Pipeline",
    description: "Funnel du cycle de vie des idées",
    defaultW: 6,
    defaultH: 2,
    category: "agentiq",
  },
  {
    type: "agentiq-timeline",
    label: "Timeline",
    description: "Journal d'actions des agents",
    defaultW: 4,
    defaultH: 4,
    category: "agentiq",
  },
  {
    type: "agentiq-guidelines",
    label: "Guidelines",
    description: "Guidelines actives du projet",
    defaultW: 6,
    defaultH: 2,
    category: "agentiq",
  },
  {
    type: "agentiq-health",
    label: "AgentIQ Health",
    description: "Santé du système AgentIQ: uptime, crashes, règles",
    defaultW: 4,
    defaultH: 3,
    category: "agentiq",
  },
];

interface DashboardStore {
  widgets: WidgetConfig[];
  editMode: boolean;
  bookmarks: BookmarkItem[];

  setWidgets: (widgets: WidgetConfig[]) => void;
  /** Hydrate layout from backend WidgetPlacement data without triggering sync back. */
  hydrateFromBackend: (placements: WidgetPlacement[]) => void;
  addWidget: (type: WidgetType) => void;
  removeWidget: (id: string) => void;
  updateLayout: (
    layouts: { i: string; x: number; y: number; w: number; h: number }[],
  ) => void;
  setEditMode: (editing: boolean) => void;
  resetLayout: (role?: number) => void;
  // IDEA-124: Update per-widget config (including refreshInterval)
  updateWidgetConfig: (
    id: string,
    config: Partial<WidgetConfig["config"] & { refreshInterval?: number }>,
  ) => void;

  addBookmark: (bookmark: Omit<BookmarkItem, "id">) => void;
  removeBookmark: (id: string) => void;
  updateBookmark: (id: string, updates: Partial<BookmarkItem>) => void;
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,
      editMode: false,
      bookmarks: [],

      setWidgets: (widgets) => {
        set({ widgets });
        syncDashboardLayoutToBackend(widgets);
      },

      hydrateFromBackend: (placements) => {
        // Convert WidgetPlacement (snake_case backend) to WidgetConfig (frontend)
        const widgets: WidgetConfig[] = placements.map((p, i) => ({
          id: `${p.widget_type}-${i}`,
          type: p.widget_type as WidgetType,
          x: p.x,
          y: p.y,
          w: p.w,
          h: p.h,
          config: p.config,
        }));
        // Set without syncing back to backend (avoiding loop)
        set({ widgets });
      },

      addWidget: (type) =>
        set((state) => {
          // Check if widget type is already in dashboard
          if (state.widgets.some((w) => w.type === type)) {
            return state;
          }

          const catalog = WIDGET_CATALOG.find((c) => c.type === type);
          if (!catalog) return state;

          const id = `${type}-${Date.now()}`;
          const maxY = state.widgets.reduce(
            (max, w) => Math.max(max, w.y + w.h),
            0,
          );
          const newWidgets = [
            ...state.widgets,
            {
              id,
              type,
              x: 0,
              y: maxY,
              w: catalog.defaultW,
              h: catalog.defaultH,
            },
          ];
          syncDashboardLayoutToBackend(newWidgets);
          return {
            widgets: newWidgets,
          };
        }),

      removeWidget: (id) =>
        set((state) => {
          const newWidgets = state.widgets.filter((w) => w.id !== id);
          syncDashboardLayoutToBackend(newWidgets);
          return { widgets: newWidgets };
        }),

      updateLayout: (layouts) =>
        set((state) => {
          const newWidgets = state.widgets.map((w) => {
            const layout = layouts.find((l) => l.i === w.id);
            if (!layout) return w;
            return { ...w, x: layout.x, y: layout.y, w: layout.w, h: layout.h };
          });
          syncDashboardLayoutToBackend(newWidgets);
          return { widgets: newWidgets };
        }),

      setEditMode: (editMode) => set({ editMode }),

      resetLayout: (role?: number) => {
        const layout =
          role !== undefined ? getDefaultLayout(role) : DEFAULT_WIDGETS;
        set({ widgets: layout });
        syncDashboardLayoutToBackend(layout);
      },

      updateWidgetConfig: (id, updates) =>
        set((state) => {
          const newWidgets = state.widgets.map((w) => {
            if (w.id !== id) return w;
            const { refreshInterval, ...configUpdates } = updates as Record<
              string,
              unknown
            >;
            return {
              ...w,
              config: { ...(w.config ?? {}), ...configUpdates },
              ...(refreshInterval !== undefined
                ? { refreshInterval: refreshInterval as number }
                : {}),
            };
          });
          syncDashboardLayoutToBackend(newWidgets);
          return { widgets: newWidgets };
        }),

      addBookmark: (bookmark) =>
        set((state) => ({
          bookmarks: [
            ...state.bookmarks,
            { ...bookmark, id: `bm-${Date.now()}` },
          ],
        })),

      removeBookmark: (id) =>
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.id !== id),
        })),

      updateBookmark: (id, updates) =>
        set((state) => ({
          bookmarks: state.bookmarks.map((b) =>
            b.id === id ? { ...b, ...updates } : b,
          ),
        })),
    }),
    {
      name: "dashboard-layout",
      version: 4,
      migrate: (persisted: unknown) => {
        const state = persisted as Record<string, unknown>;
        // On version upgrade, reset to new user layout (role-based init happens on page load)
        return { ...state, widgets: DEFAULT_WIDGETS };
      },
    },
  ),
);

// Granular selector hooks for optimized re-renders
export const useDashboardWidgets = () =>
  useDashboardStore((state) => state.widgets);

export const useDashboardEditMode = () =>
  useDashboardStore((state) => state.editMode);

export const useDashboardEditActions = () =>
  useDashboardStore(
    useShallow((state) => ({
      setEditMode: state.setEditMode,
      resetLayout: state.resetLayout,
    })),
  );

export const useDashboardWidgetActions = () =>
  useDashboardStore(
    useShallow((state) => ({
      addWidget: state.addWidget,
      removeWidget: state.removeWidget,
      updateLayout: state.updateLayout,
    })),
  );

export const useDashboardBookmarks = () =>
  useDashboardStore((state) => state.bookmarks);

export const useDashboardBookmarkActions = () =>
  useDashboardStore(
    useShallow((state) => ({
      addBookmark: state.addBookmark,
      removeBookmark: state.removeBookmark,
      updateBookmark: state.updateBookmark,
    })),
  );
