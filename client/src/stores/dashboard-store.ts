import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WidgetType =
  | 'stat-cards'
  | 'installed-apps'
  | 'system-health'
  | 'quick-actions'
  | 'network-traffic'
  | 'bookmarks';

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

export const WIDGET_CATALOG: { type: WidgetType; label: string; description: string; defaultW: number; defaultH: number }[] = [
  { type: 'stat-cards', label: 'Statistiques', description: 'Containers, Storage, Routes, Uptime', defaultW: 12, defaultH: 2 },
  { type: 'installed-apps', label: 'Apps installees', description: 'Grille des applications en cours', defaultW: 12, defaultH: 3 },
  { type: 'system-health', label: 'Sante systeme', description: 'CPU, RAM, Disk et status des services', defaultW: 8, defaultH: 5 },
  { type: 'quick-actions', label: 'Actions rapides', description: 'Boutons raccourcis', defaultW: 4, defaultH: 5 },
  { type: 'network-traffic', label: 'Trafic reseau', description: 'Statistiques RX/TX', defaultW: 12, defaultH: 2 },
  { type: 'bookmarks', label: 'Bookmarks', description: 'Liens rapides personnalises', defaultW: 6, defaultH: 3 },
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

      setWidgets: (widgets) => set({ widgets }),

      addWidget: (type) =>
        set((state) => {
          const catalog = WIDGET_CATALOG.find((c) => c.type === type);
          if (!catalog) return state;
          const id = `${type}-${Date.now()}`;
          const maxY = state.widgets.reduce(
            (max, w) => Math.max(max, w.y + w.h),
            0,
          );
          return {
            widgets: [
              ...state.widgets,
              {
                id,
                type,
                x: 0,
                y: maxY,
                w: catalog.defaultW,
                h: catalog.defaultH,
              },
            ],
          };
        }),

      removeWidget: (id) =>
        set((state) => ({
          widgets: state.widgets.filter((w) => w.id !== id),
        })),

      updateLayout: (layouts) =>
        set((state) => ({
          widgets: state.widgets.map((w) => {
            const layout = layouts.find((l) => l.i === w.id);
            if (!layout) return w;
            return { ...w, x: layout.x, y: layout.y, w: layout.w, h: layout.h };
          }),
        })),

      setEditMode: (editMode) => set({ editMode }),

      resetLayout: () => set({ widgets: DEFAULT_WIDGETS }),

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
