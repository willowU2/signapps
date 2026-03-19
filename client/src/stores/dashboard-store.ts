import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { preferencesApi } from '@/lib/api/identity';

// Debounced sync function to avoid spamming the backend
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
const syncDashboardLayoutToBackend = (widgets: WidgetConfig[]) => {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    preferencesApi.patch('dashboard', { widgets }).catch(console.error);
  }, 2000);
};

export type WidgetType =
  | 'stat-cards'
  | 'installed-apps'
  | 'system-health'
  | 'quick-actions'
  | 'network-traffic'
  | 'bookmarks'
  | 'proxy-status'
  | 'recent-tasks'
  | 'upcoming-events'
  | 'recent-files'
  | 'team-activity'
  | 'recent-activity'
  | 'notifications'
  | 'storage-usage'
  | 'performance-chart';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
}

export interface BookmarkItem {
  id: string;
  label: string;
  url: string;
  icon?: string;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'stat-cards', type: 'stat-cards', x: 0, y: 0, w: 12, h: 2 },
  { id: 'installed-apps', type: 'installed-apps', x: 0, y: 2, w: 12, h: 3 },
  { id: 'system-health', type: 'system-health', x: 0, y: 5, w: 8, h: 5 },
  { id: 'quick-actions', type: 'quick-actions', x: 8, y: 5, w: 4, h: 5 },
  { id: 'network-traffic', type: 'network-traffic', x: 0, y: 10, w: 12, h: 2 },
];

export const WIDGET_CATALOG: { type: WidgetType; label: string; description: string; defaultW: number; defaultH: number; category?: string }[] = [
  // Analytics
  { type: 'stat-cards', label: 'Statistiques', description: 'Containers, Storage, Routes, Uptime', defaultW: 12, defaultH: 2, category: 'analytics' },
  { type: 'network-traffic', label: 'Trafic réseau', description: 'Statistiques RX/TX', defaultW: 12, defaultH: 2, category: 'analytics' },
  { type: 'storage-usage', label: 'Utilisation Stockage', description: 'Espace disque et quotas', defaultW: 4, defaultH: 3, category: 'analytics' },
  { type: 'performance-chart', label: 'Performance', description: 'Graphique CPU/RAM/Disque', defaultW: 6, defaultH: 4, category: 'analytics' },
  // Productivity
  { type: 'recent-tasks', label: 'Tâches Récentes', description: 'Vos tâches en cours et à venir', defaultW: 6, defaultH: 4, category: 'productivity' },
  { type: 'upcoming-events', label: 'Événements à Venir', description: 'Calendrier des prochains événements', defaultW: 6, defaultH: 4, category: 'productivity' },
  { type: 'quick-actions', label: 'Actions rapides', description: 'Boutons raccourcis', defaultW: 4, defaultH: 5, category: 'productivity' },
  { type: 'bookmarks', label: 'Favoris', description: 'Liens rapides personnalisés', defaultW: 6, defaultH: 3, category: 'productivity' },
  // Content
  { type: 'recent-files', label: 'Fichiers Récents', description: 'Derniers fichiers consultés', defaultW: 6, defaultH: 4, category: 'content' },
  { type: 'recent-activity', label: 'Activité Récente', description: 'Votre activité récente', defaultW: 4, defaultH: 4, category: 'content' },
  // System
  { type: 'installed-apps', label: 'Applications', description: 'Grille des applications en cours', defaultW: 12, defaultH: 3, category: 'system' },
  { type: 'system-health', label: 'Santé système', description: 'CPU, RAM, Disk et status des services', defaultW: 8, defaultH: 5, category: 'system' },
  { type: 'proxy-status', label: 'Reverse Proxy', description: 'Status proxy, routes, certificats', defaultW: 4, defaultH: 4, category: 'system' },
  // Social
  { type: 'team-activity', label: 'Activité Équipe', description: 'Activité récente de l\'équipe', defaultW: 6, defaultH: 4, category: 'social' },
  { type: 'notifications', label: 'Notifications', description: 'Dernières notifications', defaultW: 4, defaultH: 3, category: 'social' },
];

interface DashboardStore {
  widgets: WidgetConfig[];
  editMode: boolean;
  bookmarks: BookmarkItem[];

  setWidgets: (widgets: WidgetConfig[]) => void;
  addWidget: (type: WidgetType) => void;
  removeWidget: (id: string) => void;
  updateLayout: (layouts: { i: string; x: number; y: number; w: number; h: number }[]) => void;
  setEditMode: (editing: boolean) => void;
  resetLayout: () => void;

  addBookmark: (bookmark: Omit<BookmarkItem, 'id'>) => void;
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

      addWidget: (type) =>
        set((state) => {
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

      resetLayout: () => {
        set({ widgets: DEFAULT_WIDGETS });
        syncDashboardLayoutToBackend(DEFAULT_WIDGETS);
      },

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
      name: 'dashboard-layout',
      version: 2,
      migrate: (persisted: unknown) => {
        const state = persisted as Record<string, unknown>;
        return { ...state, widgets: DEFAULT_WIDGETS };
      },
    },
  ),
);

// Granular selector hooks for optimized re-renders
export const useDashboardWidgets = () => useDashboardStore((state) => state.widgets);

export const useDashboardEditMode = () => useDashboardStore((state) => state.editMode);

export const useDashboardEditActions = () =>
  useDashboardStore(
    useShallow((state) => ({
      setEditMode: state.setEditMode,
      resetLayout: state.resetLayout,
    }))
  );

export const useDashboardWidgetActions = () =>
  useDashboardStore(
    useShallow((state) => ({
      addWidget: state.addWidget,
      removeWidget: state.removeWidget,
      updateLayout: state.updateLayout,
    }))
  );

export const useDashboardBookmarks = () => useDashboardStore((state) => state.bookmarks);

export const useDashboardBookmarkActions = () =>
  useDashboardStore(
    useShallow((state) => ({
      addBookmark: state.addBookmark,
      removeBookmark: state.removeBookmark,
      updateBookmark: state.updateBookmark,
    }))
  );
