"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type {
  Design,
  DesignMeta,
  DesignFormat,
  DesignPage,
  DesignObject,
  BrandKit,
  ExportOptions,
} from "@/components/design/types";
import { DESIGN_FORMATS } from "@/components/design/types";
import { getClient, ServiceName } from "@/lib/api/factory";

const docsClient = getClient(ServiceName.DOCS);

/**
 * Raw shape returned by signapps-docs for GET /designs and /designs/:id.
 * All fields are optional because the backend progressively rolled out
 * snake_case and some older records still use camelCase.
 */
interface ApiDesign {
  id: string;
  name?: string;
  title?: string;
  /**
   * Design format — typed as `DesignFormat` to match what the rest of the
   * codebase uses. The backend may return a partial shape or the full
   * `DesignFormat` object; `loadDesign` falls back to a default if any
   * required field is missing.
   */
  format?: DesignFormat;
  pages?: DesignPage[];
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

interface DesignState {
  // Dashboard
  designs: DesignMeta[];
  // Current editor
  currentDesign: Design | null;
  currentPageIndex: number;
  selectedObjectIds: string[];
  zoom: number;
  showGrid: boolean;
  snapToGrid: boolean;
  brandKit: BrandKit | null;
  // Undo/Redo
  undoStack: string[]; // serialized page states
  redoStack: string[];
  // UI
  leftPanel: "layers" | "pages" | null;
  rightPanel: boolean;

  // Dashboard actions
  loadDesigns: () => Promise<void>;
  createDesign: (name: string, format: DesignFormat) => string;
  deleteDesign: (id: string) => void;
  duplicateDesign: (id: string) => string;
  renameDesign: (id: string, name: string) => void;

  // Editor actions
  loadDesign: (id: string) => void;
  saveDesign: () => void;
  closeDesign: () => void;

  // Page actions
  setCurrentPage: (index: number) => void;
  addPage: () => void;
  duplicatePage: (index: number) => void;
  deletePage: (index: number) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  updatePageBackground: (pageIndex: number, bg: string) => void;

  // Object actions
  addObject: (obj: DesignObject) => void;
  updateObject: (id: string, updates: Partial<DesignObject>) => void;
  removeObject: (id: string) => void;
  setSelectedObjects: (ids: string[]) => void;
  reorderObjects: (fromIndex: number, toIndex: number) => void;
  toggleObjectLock: (id: string) => void;
  toggleObjectVisibility: (id: string) => void;
  renameObject: (id: string, name: string) => void;

  // Canvas actions
  setZoom: (zoom: number) => void;
  setShowGrid: (show: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;

  // Undo/Redo
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;

  // UI actions
  setLeftPanel: (panel: "layers" | "pages" | null) => void;
  setRightPanel: (open: boolean) => void;

  // Brand kit
  setBrandKit: (kit: BrandKit | null) => void;

  // Resize
  resizeDesign: (format: DesignFormat) => void;
}

function createDefaultPage(): DesignPage {
  return {
    id: crypto.randomUUID(),
    objects: [],
    background: "#ffffff",
  };
}

export const useDesignStore = create<DesignState>()(
  persist(
    (set, get) => ({
      designs: [],
      currentDesign: null,
      currentPageIndex: 0,
      selectedObjectIds: [],
      zoom: 1,
      showGrid: false,
      snapToGrid: true,
      brandKit: null,
      undoStack: [],
      redoStack: [],
      leftPanel: "layers",
      rightPanel: true,

      // Dashboard actions
      loadDesigns: async () => {
        try {
          const res = await docsClient.get<ApiDesign[]>("/designs");
          const metas: DesignMeta[] = (res.data ?? []).map((d) => ({
            id: d.id,
            name: d.name ?? d.title ?? "Untitled",
            format: d.format ?? DESIGN_FORMATS[0],
            createdAt: d.created_at ?? d.createdAt ?? new Date().toISOString(),
            updatedAt: d.updated_at ?? d.updatedAt ?? new Date().toISOString(),
          }));
          if (metas.length > 0) {
            set({ designs: metas });
          }
        } catch {
          // keep local persist state
        }
      },

      createDesign: (name, format) => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const design: Design = {
          id,
          name,
          format,
          pages: [createDefaultPage()],
          createdAt: now,
          updatedAt: now,
        };
        const meta: DesignMeta = {
          id,
          name,
          format,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          designs: [meta, ...s.designs],
          currentDesign: design,
          currentPageIndex: 0,
          selectedObjectIds: [],
          undoStack: [],
          redoStack: [],
        }));
        // Also persist the full design
        if (typeof window !== "undefined") {
          localStorage.setItem(`design-${id}`, JSON.stringify(design));
        }
        // Sync to API
        docsClient
          .post("/designs", {
            id,
            name,
            format,
            pages: design.pages,
            created_at: now,
            updated_at: now,
          })
          .catch(() => {});
        return id;
      },

      deleteDesign: (id) => {
        set((s) => ({
          designs: s.designs.filter((d) => d.id !== id),
          currentDesign: s.currentDesign?.id === id ? null : s.currentDesign,
        }));
        if (typeof window !== "undefined") {
          localStorage.removeItem(`design-${id}`);
        }
        docsClient.delete(`/designs/${id}`).catch(() => {});
      },

      duplicateDesign: (id) => {
        const state = get();
        const meta = state.designs.find((d) => d.id === id);
        if (!meta) return "";

        let sourceDesign: Design | null = null;
        if (typeof window !== "undefined") {
          const raw = localStorage.getItem(`design-${id}`);
          if (raw) sourceDesign = JSON.parse(raw);
        }
        if (!sourceDesign) return "";

        const newId = crypto.randomUUID();
        const now = new Date().toISOString();
        const newDesign: Design = {
          ...sourceDesign,
          id: newId,
          name: `${sourceDesign.name} (copy)`,
          pages: sourceDesign.pages.map((p) => ({
            ...p,
            id: crypto.randomUUID(),
            objects: p.objects.map((o) => ({ ...o, id: crypto.randomUUID() })),
          })),
          createdAt: now,
          updatedAt: now,
        };
        const newMeta: DesignMeta = {
          id: newId,
          name: newDesign.name,
          format: newDesign.format,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ designs: [newMeta, ...s.designs] }));
        if (typeof window !== "undefined") {
          localStorage.setItem(`design-${newId}`, JSON.stringify(newDesign));
        }
        return newId;
      },

      renameDesign: (id, name) => {
        set((s) => ({
          designs: s.designs.map((d) =>
            d.id === id
              ? { ...d, name, updatedAt: new Date().toISOString() }
              : d,
          ),
          currentDesign:
            s.currentDesign?.id === id
              ? {
                  ...s.currentDesign,
                  name,
                  updatedAt: new Date().toISOString(),
                }
              : s.currentDesign,
        }));
        // Persist locally
        const state = get();
        if (state.currentDesign?.id === id && typeof window !== "undefined") {
          localStorage.setItem(
            `design-${id}`,
            JSON.stringify(state.currentDesign),
          );
        }
        docsClient.put(`/designs/${id}`, { name }).catch(() => {});
      },

      loadDesign: async (id) => {
        if (typeof window === "undefined") return;
        // DW1: Try Drive API first, fallback to localStorage
        try {
          const res = await docsClient.get<ApiDesign>(`/designs/${id}`);
          if (res.data) {
            const design: Design = {
              id: res.data.id,
              name: res.data.name ?? res.data.title ?? "Untitled",
              format: res.data.format ?? DESIGN_FORMATS[0],
              pages: res.data.pages ?? [createDefaultPage()],
              createdAt:
                res.data.created_at ??
                res.data.createdAt ??
                new Date().toISOString(),
              updatedAt:
                res.data.updated_at ??
                res.data.updatedAt ??
                new Date().toISOString(),
            };
            // Also cache locally
            localStorage.setItem(`design-${id}`, JSON.stringify(design));
            set({
              currentDesign: design,
              currentPageIndex: 0,
              selectedObjectIds: [],
              undoStack: [],
              redoStack: [],
            });
            return;
          }
        } catch {
          // Drive API unavailable — fall through to localStorage
        }
        // Fallback: localStorage
        const raw = localStorage.getItem(`design-${id}`);
        if (raw) {
          const design: Design = JSON.parse(raw);
          set({
            currentDesign: design,
            currentPageIndex: 0,
            selectedObjectIds: [],
            undoStack: [],
            redoStack: [],
          });
        }
      },

      saveDesign: () => {
        const state = get();
        if (!state.currentDesign || typeof window === "undefined") return;
        const now = new Date().toISOString();
        const updated = { ...state.currentDesign, updatedAt: now };
        // DW1: Save to localStorage AND Drive API
        localStorage.setItem(`design-${updated.id}`, JSON.stringify(updated));
        set((s) => ({
          currentDesign: updated,
          designs: s.designs.map((d) =>
            d.id === updated.id ? { ...d, updatedAt: now } : d,
          ),
        }));
        docsClient
          .put(`/designs/${updated.id}`, {
            name: updated.name,
            format: updated.format,
            pages: updated.pages,
            updated_at: now,
          })
          .catch(() => {});
      },

      closeDesign: () => {
        get().saveDesign();
        set({
          currentDesign: null,
          currentPageIndex: 0,
          selectedObjectIds: [],
          undoStack: [],
          redoStack: [],
        });
      },

      // Page actions
      setCurrentPage: (index) => {
        set({ currentPageIndex: index, selectedObjectIds: [] });
      },

      addPage: () => {
        set((s) => {
          if (!s.currentDesign) return s;
          const newPages = [...s.currentDesign.pages, createDefaultPage()];
          return {
            currentDesign: { ...s.currentDesign, pages: newPages },
            currentPageIndex: newPages.length - 1,
          };
        });
      },

      duplicatePage: (index) => {
        set((s) => {
          if (!s.currentDesign) return s;
          const page = s.currentDesign.pages[index];
          if (!page) return s;
          const cloned: DesignPage = {
            ...page,
            id: crypto.randomUUID(),
            objects: page.objects.map((o) => ({
              ...o,
              id: crypto.randomUUID(),
            })),
          };
          const newPages = [...s.currentDesign.pages];
          newPages.splice(index + 1, 0, cloned);
          return {
            currentDesign: { ...s.currentDesign, pages: newPages },
            currentPageIndex: index + 1,
          };
        });
      },

      deletePage: (index) => {
        set((s) => {
          if (!s.currentDesign || s.currentDesign.pages.length <= 1) return s;
          const newPages = s.currentDesign.pages.filter((_, i) => i !== index);
          const newIndex = Math.min(s.currentPageIndex, newPages.length - 1);
          return {
            currentDesign: { ...s.currentDesign, pages: newPages },
            currentPageIndex: newIndex,
            selectedObjectIds: [],
          };
        });
      },

      reorderPages: (fromIndex, toIndex) => {
        set((s) => {
          if (!s.currentDesign) return s;
          const pages = [...s.currentDesign.pages];
          const [moved] = pages.splice(fromIndex, 1);
          pages.splice(toIndex, 0, moved);
          return {
            currentDesign: { ...s.currentDesign, pages },
            currentPageIndex: toIndex,
          };
        });
      },

      updatePageBackground: (pageIndex, bg) => {
        set((s) => {
          if (!s.currentDesign) return s;
          const pages = s.currentDesign.pages.map((p, i) =>
            i === pageIndex ? { ...p, background: bg } : p,
          );
          return { currentDesign: { ...s.currentDesign, pages } };
        });
      },

      // Object actions
      addObject: (obj) => {
        const state = get();
        state.pushUndo();
        set((s) => {
          if (!s.currentDesign) return s;
          const pages = s.currentDesign.pages.map((p, i) =>
            i === s.currentPageIndex
              ? { ...p, objects: [...p.objects, obj] }
              : p,
          );
          return {
            currentDesign: { ...s.currentDesign, pages },
            selectedObjectIds: [obj.id],
          };
        });
      },

      updateObject: (id, updates) => {
        set((s) => {
          if (!s.currentDesign) return s;
          const pages = s.currentDesign.pages.map((p, i) =>
            i === s.currentPageIndex
              ? {
                  ...p,
                  objects: p.objects.map((o) =>
                    o.id === id ? { ...o, ...updates } : o,
                  ),
                }
              : p,
          );
          return { currentDesign: { ...s.currentDesign, pages } };
        });
      },

      removeObject: (id) => {
        const state = get();
        state.pushUndo();
        set((s) => {
          if (!s.currentDesign) return s;
          const pages = s.currentDesign.pages.map((p, i) =>
            i === s.currentPageIndex
              ? { ...p, objects: p.objects.filter((o) => o.id !== id) }
              : p,
          );
          return {
            currentDesign: { ...s.currentDesign, pages },
            selectedObjectIds: s.selectedObjectIds.filter((sid) => sid !== id),
          };
        });
      },

      setSelectedObjects: (ids) => set({ selectedObjectIds: ids }),

      reorderObjects: (fromIndex, toIndex) => {
        set((s) => {
          if (!s.currentDesign) return s;
          const page = s.currentDesign.pages[s.currentPageIndex];
          if (!page) return s;
          const objects = [...page.objects];
          const [moved] = objects.splice(fromIndex, 1);
          objects.splice(toIndex, 0, moved);
          const pages = s.currentDesign.pages.map((p, i) =>
            i === s.currentPageIndex ? { ...p, objects } : p,
          );
          return { currentDesign: { ...s.currentDesign, pages } };
        });
      },

      toggleObjectLock: (id) => {
        set((s) => {
          if (!s.currentDesign) return s;
          const pages = s.currentDesign.pages.map((p, i) =>
            i === s.currentPageIndex
              ? {
                  ...p,
                  objects: p.objects.map((o) =>
                    o.id === id ? { ...o, locked: !o.locked } : o,
                  ),
                }
              : p,
          );
          return { currentDesign: { ...s.currentDesign, pages } };
        });
      },

      toggleObjectVisibility: (id) => {
        set((s) => {
          if (!s.currentDesign) return s;
          const pages = s.currentDesign.pages.map((p, i) =>
            i === s.currentPageIndex
              ? {
                  ...p,
                  objects: p.objects.map((o) =>
                    o.id === id ? { ...o, visible: !o.visible } : o,
                  ),
                }
              : p,
          );
          return { currentDesign: { ...s.currentDesign, pages } };
        });
      },

      renameObject: (id, name) => {
        set((s) => {
          if (!s.currentDesign) return s;
          const pages = s.currentDesign.pages.map((p, i) =>
            i === s.currentPageIndex
              ? {
                  ...p,
                  objects: p.objects.map((o) =>
                    o.id === id ? { ...o, name } : o,
                  ),
                }
              : p,
          );
          return { currentDesign: { ...s.currentDesign, pages } };
        });
      },

      // Canvas
      setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),
      setShowGrid: (show) => set({ showGrid: show }),
      setSnapToGrid: (snap) => set({ snapToGrid: snap }),

      // Undo/Redo
      pushUndo: () => {
        const state = get();
        if (!state.currentDesign) return;
        const page = state.currentDesign.pages[state.currentPageIndex];
        if (!page) return;
        set((s) => ({
          undoStack: [...s.undoStack.slice(-49), JSON.stringify(page)],
          redoStack: [],
        }));
      },

      undo: () => {
        const state = get();
        if (state.undoStack.length === 0 || !state.currentDesign) return;
        const currentPage = state.currentDesign.pages[state.currentPageIndex];
        const prevState = state.undoStack[state.undoStack.length - 1];
        const restored: DesignPage = JSON.parse(prevState);
        set((s) => {
          if (!s.currentDesign) return s;
          const pages = s.currentDesign.pages.map((p, i) =>
            i === s.currentPageIndex ? restored : p,
          );
          return {
            currentDesign: { ...s.currentDesign, pages },
            undoStack: s.undoStack.slice(0, -1),
            redoStack: [...s.redoStack, JSON.stringify(currentPage)],
            selectedObjectIds: [],
          };
        });
      },

      redo: () => {
        const state = get();
        if (state.redoStack.length === 0 || !state.currentDesign) return;
        const currentPage = state.currentDesign.pages[state.currentPageIndex];
        const nextState = state.redoStack[state.redoStack.length - 1];
        const restored: DesignPage = JSON.parse(nextState);
        set((s) => {
          if (!s.currentDesign) return s;
          const pages = s.currentDesign.pages.map((p, i) =>
            i === s.currentPageIndex ? restored : p,
          );
          return {
            currentDesign: { ...s.currentDesign, pages },
            redoStack: s.redoStack.slice(0, -1),
            undoStack: [...s.undoStack, JSON.stringify(currentPage)],
            selectedObjectIds: [],
          };
        });
      },

      // UI
      setLeftPanel: (panel) => set({ leftPanel: panel }),
      setRightPanel: (open) => set({ rightPanel: open }),

      // Brand kit
      setBrandKit: (kit) => set({ brandKit: kit }),

      // Resize
      resizeDesign: (format) => {
        set((s) => {
          if (!s.currentDesign) return s;
          const oldW = s.currentDesign.format.width;
          const oldH = s.currentDesign.format.height;
          const scaleX = format.width / oldW;
          const scaleY = format.height / oldH;
          const scale = Math.min(scaleX, scaleY);

          const pages = s.currentDesign.pages.map((page) => ({
            ...page,
            objects: page.objects.map((obj) => ({
              ...obj,
              fabricData: {
                ...obj.fabricData,
                left: (obj.fabricData.left || 0) * scaleX,
                top: (obj.fabricData.top || 0) * scaleY,
                scaleX: (obj.fabricData.scaleX || 1) * scale,
                scaleY: (obj.fabricData.scaleY || 1) * scale,
              },
            })),
          }));

          return {
            currentDesign: {
              ...s.currentDesign,
              format,
              pages,
              updatedAt: new Date().toISOString(),
            },
            designs: s.designs.map((d) =>
              d.id === s.currentDesign!.id
                ? { ...d, format, updatedAt: new Date().toISOString() }
                : d,
            ),
          };
        });
      },
    }),
    {
      name: "design-storage",
      partialize: (state) => ({
        designs: state.designs,
        brandKit: state.brandKit,
      }),
    },
  ),
);

// Selectors
export const useDesignEditor = () =>
  useDesignStore(
    useShallow((s) => ({
      currentDesign: s.currentDesign,
      currentPageIndex: s.currentPageIndex,
      selectedObjectIds: s.selectedObjectIds,
      zoom: s.zoom,
      showGrid: s.showGrid,
      snapToGrid: s.snapToGrid,
    })),
  );

export const useDesignPages = () =>
  useDesignStore(
    useShallow((s) => ({
      pages: s.currentDesign?.pages || [],
      currentPageIndex: s.currentPageIndex,
      setCurrentPage: s.setCurrentPage,
      addPage: s.addPage,
      duplicatePage: s.duplicatePage,
      deletePage: s.deletePage,
      reorderPages: s.reorderPages,
    })),
  );

export const useDesignObjects = () => {
  const store = useDesignStore();
  const page = store.currentDesign?.pages[store.currentPageIndex];
  return page?.objects || [];
};

export const useDesignActions = () =>
  useDesignStore(
    useShallow((s) => ({
      addObject: s.addObject,
      updateObject: s.updateObject,
      removeObject: s.removeObject,
      setSelectedObjects: s.setSelectedObjects,
      reorderObjects: s.reorderObjects,
      toggleObjectLock: s.toggleObjectLock,
      toggleObjectVisibility: s.toggleObjectVisibility,
      renameObject: s.renameObject,
      pushUndo: s.pushUndo,
      undo: s.undo,
      redo: s.redo,
      saveDesign: s.saveDesign,
    })),
  );
