/**
 * Views Store
 *
 * Zustand store for managing saved views with localStorage persistence.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type {
  ViewDefinition,
  FilterGroup,
  ViewShareConfig,
} from "@/lib/views/types";
import {
  createEmptyFilterGroup,
  getDefaultView,
  createViewFromTemplate,
} from "@/lib/views/registry";

// ============================================================================
// Store State
// ============================================================================

interface ViewsState {
  // Saved views organized by entity type
  views: Record<string, ViewDefinition[]>;

  // Currently active view per entity type
  activeViewIds: Record<string, string | null>;

  // Draft changes (unsaved modifications to current view)
  draftChanges: Record<string, Partial<ViewDefinition>>;

  // Active quick filters per entity type
  activeQuickFilters: Record<string, string[]>;

  // Recently used views (for quick access)
  recentViews: { entityType: string; viewId: string; usedAt: string }[];
}

interface ViewsActions {
  // View CRUD
  createView: (
    view: Omit<ViewDefinition, "id" | "createdAt" | "updatedAt">,
  ) => ViewDefinition;
  updateView: (
    entityType: string,
    viewId: string,
    updates: Partial<ViewDefinition>,
  ) => void;
  deleteView: (entityType: string, viewId: string) => void;
  duplicateView: (
    entityType: string,
    viewId: string,
    newName: string,
  ) => ViewDefinition | null;

  // Active view management
  setActiveView: (entityType: string, viewId: string | null) => void;
  getActiveView: (entityType: string) => ViewDefinition | null;

  // Draft changes
  setDraftChanges: (
    entityType: string,
    changes: Partial<ViewDefinition> | null,
  ) => void;
  applyDraftChanges: (entityType: string) => void;
  discardDraftChanges: (entityType: string) => void;
  hasDraftChanges: (entityType: string) => boolean;

  // Quick filters
  toggleQuickFilter: (entityType: string, filterId: string) => void;
  clearQuickFilters: (entityType: string) => void;
  getActiveQuickFilters: (entityType: string) => string[];

  // Sharing
  shareView: (
    entityType: string,
    viewId: string,
    config: ViewShareConfig,
  ) => void;
  unshareView: (
    entityType: string,
    viewId: string,
    targetType: string,
    targetId?: string,
  ) => void;

  // Import/Export
  exportView: (entityType: string, viewId: string) => ViewDefinition | null;
  importView: (view: ViewDefinition) => ViewDefinition;

  // Recent views
  addToRecent: (entityType: string, viewId: string) => void;
  getRecentViews: (
    limit?: number,
  ) => { entityType: string; viewId: string; usedAt: string }[];

  // Initialization
  initializeViews: (entityType: string, userId: string) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useViewsStore = create<ViewsState & ViewsActions>()(
  persist(
    (set, get) => ({
      // Initial state
      views: {},
      activeViewIds: {},
      draftChanges: {},
      activeQuickFilters: {},
      recentViews: [],

      // ========================================================================
      // View CRUD
      // ========================================================================

      createView: (viewData) => {
        const view: ViewDefinition = {
          ...viewData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          views: {
            ...state.views,
            [view.entityType]: [...(state.views[view.entityType] || []), view],
          },
        }));

        return view;
      },

      updateView: (entityType, viewId, updates) => {
        set((state) => ({
          views: {
            ...state.views,
            [entityType]: (state.views[entityType] || []).map((v) =>
              v.id === viewId
                ? { ...v, ...updates, updatedAt: new Date().toISOString() }
                : v,
            ),
          },
        }));
      },

      deleteView: (entityType, viewId) => {
        set((state) => {
          const newViews = (state.views[entityType] || []).filter(
            (v) => v.id !== viewId,
          );
          const newActiveViewIds = { ...state.activeViewIds };
          if (newActiveViewIds[entityType] === viewId) {
            newActiveViewIds[entityType] = newViews[0]?.id || null;
          }
          return {
            views: { ...state.views, [entityType]: newViews },
            activeViewIds: newActiveViewIds,
          };
        });
      },

      duplicateView: (entityType, viewId, newName) => {
        const state = get();
        const original = state.views[entityType]?.find((v) => v.id === viewId);
        if (!original) return null;

        const duplicate: ViewDefinition = {
          ...original,
          id: crypto.randomUUID(),
          name: newName,
          isDefault: false,
          isSystem: false,
          isShared: false,
          sharedWith: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          views: {
            ...state.views,
            [entityType]: [...(state.views[entityType] || []), duplicate],
          },
        }));

        return duplicate;
      },

      // ========================================================================
      // Active View Management
      // ========================================================================

      setActiveView: (entityType, viewId) => {
        set((state) => ({
          activeViewIds: {
            ...state.activeViewIds,
            [entityType]: viewId,
          },
        }));

        if (viewId) {
          get().addToRecent(entityType, viewId);
        }
      },

      getActiveView: (entityType) => {
        const state = get();
        const activeId = state.activeViewIds[entityType];
        if (!activeId) return null;
        return state.views[entityType]?.find((v) => v.id === activeId) || null;
      },

      // ========================================================================
      // Draft Changes
      // ========================================================================

      setDraftChanges: (entityType, changes) => {
        set((state) => ({
          draftChanges: {
            ...state.draftChanges,
            [entityType]: changes || {},
          },
        }));
      },

      applyDraftChanges: (entityType) => {
        const state = get();
        const activeId = state.activeViewIds[entityType];
        const draft = state.draftChanges[entityType];

        if (activeId && draft && Object.keys(draft).length > 0) {
          get().updateView(entityType, activeId, draft);
          set((state) => ({
            draftChanges: {
              ...state.draftChanges,
              [entityType]: {},
            },
          }));
        }
      },

      discardDraftChanges: (entityType) => {
        set((state) => ({
          draftChanges: {
            ...state.draftChanges,
            [entityType]: {},
          },
        }));
      },

      hasDraftChanges: (entityType) => {
        const draft = get().draftChanges[entityType];
        return draft != null && Object.keys(draft).length > 0;
      },

      // ========================================================================
      // Quick Filters
      // ========================================================================

      toggleQuickFilter: (entityType, filterId) => {
        set((state) => {
          const current = state.activeQuickFilters[entityType] || [];
          const isActive = current.includes(filterId);
          return {
            activeQuickFilters: {
              ...state.activeQuickFilters,
              [entityType]: isActive
                ? current.filter((id) => id !== filterId)
                : [...current, filterId],
            },
          };
        });
      },

      clearQuickFilters: (entityType) => {
        set((state) => ({
          activeQuickFilters: {
            ...state.activeQuickFilters,
            [entityType]: [],
          },
        }));
      },

      getActiveQuickFilters: (entityType) => {
        return get().activeQuickFilters[entityType] || [];
      },

      // ========================================================================
      // Sharing
      // ========================================================================

      shareView: (entityType, viewId, config) => {
        set((state) => ({
          views: {
            ...state.views,
            [entityType]: (state.views[entityType] || []).map((v) =>
              v.id === viewId
                ? {
                    ...v,
                    isShared: true,
                    sharedWith: [...(v.sharedWith || []), config],
                    updatedAt: new Date().toISOString(),
                  }
                : v,
            ),
          },
        }));
      },

      unshareView: (entityType, viewId, targetType, targetId) => {
        set((state) => ({
          views: {
            ...state.views,
            [entityType]: (state.views[entityType] || []).map((v) => {
              if (v.id !== viewId) return v;
              const newSharedWith = (v.sharedWith || []).filter(
                (s) =>
                  !(s.targetType === targetType && s.targetId === targetId),
              );
              return {
                ...v,
                isShared: newSharedWith.length > 0,
                sharedWith: newSharedWith,
                updatedAt: new Date().toISOString(),
              };
            }),
          },
        }));
      },

      // ========================================================================
      // Import/Export
      // ========================================================================

      exportView: (entityType, viewId) => {
        const state = get();
        return state.views[entityType]?.find((v) => v.id === viewId) || null;
      },

      importView: (view) => {
        const imported: ViewDefinition = {
          ...view,
          id: crypto.randomUUID(),
          isShared: false,
          sharedWith: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          views: {
            ...state.views,
            [view.entityType]: [
              ...(state.views[view.entityType] || []),
              imported,
            ],
          },
        }));

        return imported;
      },

      // ========================================================================
      // Recent Views
      // ========================================================================

      addToRecent: (entityType, viewId) => {
        set((state) => {
          const filtered = state.recentViews.filter(
            (r) => !(r.entityType === entityType && r.viewId === viewId),
          );
          return {
            recentViews: [
              { entityType, viewId, usedAt: new Date().toISOString() },
              ...filtered,
            ].slice(0, 10),
          };
        });
      },

      getRecentViews: (limit = 5) => {
        return get().recentViews.slice(0, limit);
      },

      // ========================================================================
      // Initialization
      // ========================================================================

      initializeViews: (entityType, userId) => {
        const state = get();
        if (state.views[entityType]?.length > 0) return;

        // Create default view from template
        const defaultTemplate = getDefaultView(entityType);
        if (defaultTemplate) {
          const defaultView = createViewFromTemplate(defaultTemplate, userId);
          set((state) => ({
            views: {
              ...state.views,
              [entityType]: [defaultView],
            },
            activeViewIds: {
              ...state.activeViewIds,
              [entityType]: defaultView.id,
            },
          }));
        }
      },
    }),
    {
      name: "views-storage",
      version: 1,
      partialize: (state) => ({
        views: state.views,
        activeViewIds: state.activeViewIds,
        activeQuickFilters: state.activeQuickFilters,
        recentViews: state.recentViews,
      }),
    },
  ),
);

// ============================================================================
// Selector Hooks
// ============================================================================

export function useViews(entityType: string) {
  return useViewsStore((state) => state.views[entityType] || []);
}

export function useActiveView(entityType: string) {
  return useViewsStore((state) => {
    const activeId = state.activeViewIds[entityType];
    if (!activeId) return null;
    return state.views[entityType]?.find((v) => v.id === activeId) || null;
  });
}

export function useActiveQuickFilters(entityType: string) {
  return useViewsStore((state) => state.activeQuickFilters[entityType] || []);
}

export function useViewActions() {
  return useViewsStore(
    useShallow((state) => ({
      createView: state.createView,
      updateView: state.updateView,
      deleteView: state.deleteView,
      duplicateView: state.duplicateView,
      setActiveView: state.setActiveView,
      setDraftChanges: state.setDraftChanges,
      applyDraftChanges: state.applyDraftChanges,
      discardDraftChanges: state.discardDraftChanges,
      toggleQuickFilter: state.toggleQuickFilter,
      clearQuickFilters: state.clearQuickFilters,
      shareView: state.shareView,
      exportView: state.exportView,
      importView: state.importView,
      initializeViews: state.initializeViews,
    })),
  );
}

export function useDraftChanges(entityType: string) {
  return useViewsStore((state) => ({
    draft: state.draftChanges[entityType] || {},
    hasDraft: state.hasDraftChanges(entityType),
  }));
}
