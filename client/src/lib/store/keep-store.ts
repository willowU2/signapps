"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

// ============================================================================
// Types
// ============================================================================

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface KeepNote {
  id: string;
  title: string;
  content: string;
  color: string;
  labels: string[];
  isPinned: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  hasChecklist: boolean;
  checklistItems: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface KeepLabel {
  id: string;
  name: string;
}

// Google Keep dark mode colors
export const NOTE_COLORS = [
  { id: "default", value: "#202124", name: "Par défaut" },
  { id: "coral", value: "#77172e", name: "Corail" },
  { id: "peach", value: "#692b17", name: "Pêche" },
  { id: "sand", value: "#7c4a03", name: "Sable" },
  { id: "mint", value: "#264d3b", name: "Menthe" },
  { id: "sage", value: "#0d625d", name: "Sauge" },
  { id: "fog", value: "#256377", name: "Brume" },
  { id: "storm", value: "#284255", name: "Orage" },
  { id: "dusk", value: "#472e5b", name: "Crépuscule" },
  { id: "blossom", value: "#6c394f", name: "Fleur" },
  { id: "clay", value: "#4b443a", name: "Argile" },
  { id: "chalk", value: "#232427", name: "Craie" },
] as const;

export type SidebarView = "notes" | "reminders" | "archive" | "trash";

// ============================================================================
// Store Interface
// ============================================================================

interface KeepState {
  // Data
  notes: KeepNote[];
  labels: KeepLabel[];

  // UI State
  searchQuery: string;
  isGridView: boolean;
  activeSidebarView: SidebarView;
  sidebarExpanded: boolean;
  selectedLabelFilter: string | null;

  // Note CRUD Actions
  addNote: (note: Partial<KeepNote>) => string;
  updateNote: (id: string, updates: Partial<KeepNote>) => void;
  deleteNote: (id: string) => void;
  duplicateNote: (id: string) => string | null;

  // Note State Actions
  togglePin: (id: string) => void;
  toggleArchive: (id: string) => void;
  moveToTrash: (id: string) => void;
  restoreFromTrash: (id: string) => void;
  permanentlyDeleteNote: (id: string) => void;
  emptyTrash: () => void;
  changeColor: (id: string, color: string) => void;

  // Legacy aliases for compatibility
  archiveNote: (id: string) => void;
  trashNote: (id: string) => void;
  restoreNote: (id: string) => void;
  setNoteColor: (id: string, color: string) => void;

  // Checklist Actions
  addChecklistItem: (noteId: string, text: string) => void;
  updateChecklistItem: (noteId: string, itemId: string, text: string) => void;
  toggleChecklistItem: (noteId: string, itemId: string) => void;
  removeChecklistItem: (noteId: string, itemId: string) => void;

  // Label Actions
  addLabel: (name: string) => string;
  updateLabel: (id: string, name: string) => void;
  deleteLabel: (id: string) => void;
  addLabelToNote: (noteId: string, labelName: string) => void;
  removeLabelFromNote: (noteId: string, labelName: string) => void;

  // UI Actions
  setSearchQuery: (query: string) => void;
  setGridView: (isGrid: boolean) => void;
  setActiveSidebarView: (view: SidebarView) => void;
  setSidebarExpanded: (expanded: boolean) => void;
  setSelectedLabelFilter: (labelId: string | null) => void;
}

// ============================================================================
// Default Data
// ============================================================================

const defaultNotes: KeepNote[] = [
  {
    id: "1",
    title: "Claude",
    content: "Projet IA assistant - Anthropic",
    color: "#202124",
    labels: ["ANTHROPIC"],
    isPinned: true,
    isArchived: false,
    isTrashed: false,
    hasChecklist: false,
    checklistItems: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    title: "Liste de courses",
    content: "",
    color: "#264d3b",
    labels: ["PERSONNEL"],
    isPinned: false,
    isArchived: false,
    isTrashed: false,
    hasChecklist: true,
    checklistItems: [
      { id: "c1", text: "Acheter du lait", checked: false },
      { id: "c2", text: "Répondre aux emails", checked: true },
      { id: "c3", text: "Préparer la réunion", checked: false },
      { id: "c4", text: "Appeler le médecin", checked: true },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    title: "Idées de projet",
    content:
      "1. Application de gestion de temps\n2. Plugin VSCode pour AI\n3. Dashboard analytics\n4. Automatisation CI/CD",
    color: "#256377",
    labels: ["TRAVAIL", "IDÉES"],
    isPinned: false,
    isArchived: false,
    isTrashed: false,
    hasChecklist: false,
    checklistItems: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "4",
    title: "Recette gâteau chocolat",
    content:
      "Ingrédients:\n- 200g de chocolat noir\n- 100g de beurre\n- 150g de sucre\n- 3 oeufs\n- 80g de farine\n\nPréchauffer le four à 180°C...",
    color: "#7c4a03",
    labels: ["CUISINE"],
    isPinned: false,
    isArchived: false,
    isTrashed: false,
    hasChecklist: false,
    checklistItems: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "5",
    title: "",
    content:
      "N'oublie pas d'appeler le médecin demain matin pour le rendez-vous.",
    color: "#202124",
    labels: [],
    isPinned: false,
    isArchived: false,
    isTrashed: false,
    hasChecklist: false,
    checklistItems: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "6",
    title: "Réunion équipe",
    content: "",
    color: "#472e5b",
    labels: ["TRAVAIL"],
    isPinned: true,
    isArchived: false,
    isTrashed: false,
    hasChecklist: true,
    checklistItems: [
      { id: "r1", text: "Préparer la présentation", checked: true },
      { id: "r2", text: "Envoyer l'ordre du jour", checked: true },
      { id: "r3", text: "Réserver la salle", checked: false },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const defaultLabels: KeepLabel[] = [
  { id: "l1", name: "ANTHROPIC" },
  { id: "l2", name: "TRAVAIL" },
  { id: "l3", name: "PERSONNEL" },
  { id: "l4", name: "IDÉES" },
  { id: "l5", name: "CUISINE" },
];

// ============================================================================
// Store Implementation
// ============================================================================

export const useKeepStore = create<KeepState>()(
  persist(
    (set, get) => ({
      // Initial state
      notes: defaultNotes,
      labels: defaultLabels,
      searchQuery: "",
      isGridView: true,
      activeSidebarView: "notes",
      sidebarExpanded: false,
      selectedLabelFilter: null,

      // ========================================
      // Note CRUD Actions
      // ========================================

      addNote: (noteData) => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const newNote: KeepNote = {
          id,
          title: noteData.title || "",
          content: noteData.content || "",
          color: noteData.color || "#202124",
          labels: noteData.labels || [],
          isPinned: noteData.isPinned || false,
          isArchived: false,
          isTrashed: false,
          hasChecklist: noteData.hasChecklist || false,
          checklistItems: noteData.checklistItems || [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          notes: [newNote, ...state.notes],
        }));
        return id;
      },

      updateNote: (id, updates) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? { ...note, ...updates, updatedAt: new Date().toISOString() }
              : note,
          ),
        }));
      },

      deleteNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
        }));
      },

      duplicateNote: (id) => {
        const state = get();
        const noteToDuplicate = state.notes.find((note) => note.id === id);
        if (!noteToDuplicate) return null;

        const newId = crypto.randomUUID();
        const now = new Date().toISOString();
        const duplicatedNote: KeepNote = {
          ...noteToDuplicate,
          id: newId,
          title: noteToDuplicate.title
            ? `${noteToDuplicate.title} (copie)`
            : "",
          isPinned: false,
          checklistItems: noteToDuplicate.checklistItems.map((item) => ({
            ...item,
            id: crypto.randomUUID(),
          })),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          notes: [duplicatedNote, ...state.notes],
        }));
        return newId;
      },

      // ========================================
      // Note State Actions
      // ========================================

      togglePin: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  isPinned: !note.isPinned,
                  updatedAt: new Date().toISOString(),
                }
              : note,
          ),
        }));
      },

      toggleArchive: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  isArchived: !note.isArchived,
                  isPinned: note.isArchived ? note.isPinned : false,
                  updatedAt: new Date().toISOString(),
                }
              : note,
          ),
        }));
      },

      moveToTrash: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  isTrashed: true,
                  isArchived: false,
                  isPinned: false,
                  updatedAt: new Date().toISOString(),
                }
              : note,
          ),
        }));
      },

      restoreFromTrash: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  isTrashed: false,
                  updatedAt: new Date().toISOString(),
                }
              : note,
          ),
        }));
      },

      permanentlyDeleteNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
        }));
      },

      emptyTrash: () => {
        set((state) => ({
          notes: state.notes.filter((note) => !note.isTrashed),
        }));
      },

      changeColor: (id, color) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? { ...note, color, updatedAt: new Date().toISOString() }
              : note,
          ),
        }));
      },

      // Legacy aliases for backward compatibility
      archiveNote: (id) => get().toggleArchive(id),
      trashNote: (id) => get().moveToTrash(id),
      restoreNote: (id) => {
        const state = get();
        const note = state.notes.find((n) => n.id === id);
        if (note?.isTrashed) {
          get().restoreFromTrash(id);
        } else if (note?.isArchived) {
          get().toggleArchive(id);
        }
      },
      setNoteColor: (id, color) => get().changeColor(id, color),

      // ========================================
      // Checklist Actions
      // ========================================

      addChecklistItem: (noteId, text) => {
        const itemId = crypto.randomUUID();
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  checklistItems: [
                    ...note.checklistItems,
                    { id: itemId, text, checked: false },
                  ],
                  hasChecklist: true,
                  updatedAt: new Date().toISOString(),
                }
              : note,
          ),
        }));
      },

      updateChecklistItem: (noteId, itemId, text) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  checklistItems: note.checklistItems.map((item) =>
                    item.id === itemId ? { ...item, text } : item,
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : note,
          ),
        }));
      },

      toggleChecklistItem: (noteId, itemId) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  checklistItems: note.checklistItems.map((item) =>
                    item.id === itemId
                      ? { ...item, checked: !item.checked }
                      : item,
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : note,
          ),
        }));
      },

      removeChecklistItem: (noteId, itemId) => {
        set((state) => ({
          notes: state.notes.map((note) => {
            if (note.id !== noteId) return note;
            const newItems = note.checklistItems.filter(
              (item) => item.id !== itemId,
            );
            return {
              ...note,
              checklistItems: newItems,
              hasChecklist: newItems.length > 0,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      // ========================================
      // Label Actions
      // ========================================

      addLabel: (name) => {
        const id = crypto.randomUUID();
        set((state) => ({
          labels: [...state.labels, { id, name: name.toUpperCase() }],
        }));
        return id;
      },

      updateLabel: (id, name) => {
        set((state) => {
          const oldLabel = state.labels.find((l) => l.id === id);
          const newName = name.toUpperCase();
          return {
            labels: state.labels.map((label) =>
              label.id === id ? { ...label, name: newName } : label,
            ),
            notes: oldLabel
              ? state.notes.map((note) => ({
                  ...note,
                  labels: note.labels.map((l) =>
                    l === oldLabel.name ? newName : l,
                  ),
                }))
              : state.notes,
          };
        });
      },

      deleteLabel: (id) => {
        set((state) => {
          const labelToDelete = state.labels.find((l) => l.id === id);
          return {
            labels: state.labels.filter((label) => label.id !== id),
            notes: labelToDelete
              ? state.notes.map((note) => ({
                  ...note,
                  labels: note.labels.filter((l) => l !== labelToDelete.name),
                }))
              : state.notes,
          };
        });
      },

      addLabelToNote: (noteId, labelName) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId && !note.labels.includes(labelName)
              ? {
                  ...note,
                  labels: [...note.labels, labelName],
                  updatedAt: new Date().toISOString(),
                }
              : note,
          ),
        }));
      },

      removeLabelFromNote: (noteId, labelName) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  labels: note.labels.filter((l) => l !== labelName),
                  updatedAt: new Date().toISOString(),
                }
              : note,
          ),
        }));
      },

      // ========================================
      // UI Actions
      // ========================================

      setSearchQuery: (query) => set({ searchQuery: query }),
      setGridView: (isGrid) => set({ isGridView: isGrid }),
      setActiveSidebarView: (view) => set({ activeSidebarView: view }),
      setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
      setSelectedLabelFilter: (labelId) =>
        set({ selectedLabelFilter: labelId }),
    }),
    {
      name: "keep-storage",
      partialize: (state) => ({
        notes: state.notes,
        labels: state.labels,
        isGridView: state.isGridView,
        sidebarExpanded: state.sidebarExpanded,
      }),
    },
  ),
);

// ============================================================================
// Selectors
// ============================================================================

// Cache for memoizing filtered notes
const activeNotesCache = new WeakMap<
  KeepState["notes"],
  Map<string, KeepNote[]>
>();

export const selectActiveNotes = (state: KeepState): KeepNote[] => {
  const { notes, activeSidebarView, searchQuery, selectedLabelFilter, labels } =
    state;

  // Create a cache key from the filter parameters
  const cacheKey = `${activeSidebarView}|${searchQuery}|${selectedLabelFilter}`;

  // Check cache
  let notesCache = activeNotesCache.get(notes);
  if (!notesCache) {
    notesCache = new Map();
    activeNotesCache.set(notes, notesCache);
  }

  const cached = notesCache.get(cacheKey);
  if (cached) return cached;

  let filtered = notes;

  // Filter by view
  switch (activeSidebarView) {
    case "archive":
      filtered = filtered.filter((n) => n.isArchived && !n.isTrashed);
      break;
    case "trash":
      filtered = filtered.filter((n) => n.isTrashed);
      break;
    default:
      filtered = filtered.filter((n) => !n.isArchived && !n.isTrashed);
  }

  // Filter by search
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query) ||
        n.labels.some((l) => l.toLowerCase().includes(query)) ||
        n.checklistItems.some((item) =>
          item.text.toLowerCase().includes(query),
        ),
    );
  }

  // Filter by label
  if (selectedLabelFilter) {
    const label = labels.find((l) => l.id === selectedLabelFilter);
    if (label) {
      filtered = filtered.filter((n) => n.labels.includes(label.name));
    }
  }

  // Cache the result
  notesCache.set(cacheKey, filtered);

  return filtered;
};

export const selectPinnedNotes = (state: KeepState): KeepNote[] =>
  selectActiveNotes(state).filter((n) => n.isPinned);

export const selectUnpinnedNotes = (state: KeepState): KeepNote[] =>
  selectActiveNotes(state).filter((n) => !n.isPinned);

// ============================================================================
// Granular Selector Hooks (optimized for minimal re-renders)
// ============================================================================

export const useKeepUIState = () =>
  useKeepStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      isGridView: state.isGridView,
      activeSidebarView: state.activeSidebarView,
      sidebarExpanded: state.sidebarExpanded,
    })),
  );

export const useKeepUIActions = () =>
  useKeepStore(
    useShallow((state) => ({
      setSearchQuery: state.setSearchQuery,
      setGridView: state.setGridView,
      setActiveSidebarView: state.setActiveSidebarView,
      setSidebarExpanded: state.setSidebarExpanded,
    })),
  );

export const useKeepNoteActions = () =>
  useKeepStore(
    useShallow((state) => ({
      addNote: state.addNote,
      updateNote: state.updateNote,
      deleteNote: state.deleteNote,
      duplicateNote: state.duplicateNote,
      togglePin: state.togglePin,
      toggleArchive: state.toggleArchive,
      moveToTrash: state.moveToTrash,
      restoreFromTrash: state.restoreFromTrash,
      permanentlyDeleteNote: state.permanentlyDeleteNote,
      emptyTrash: state.emptyTrash,
      changeColor: state.changeColor,
      // Legacy aliases
      archiveNote: state.archiveNote,
      trashNote: state.trashNote,
      restoreNote: state.restoreNote,
      setNoteColor: state.setNoteColor,
      // Checklist
      addChecklistItem: state.addChecklistItem,
      updateChecklistItem: state.updateChecklistItem,
      toggleChecklistItem: state.toggleChecklistItem,
      removeChecklistItem: state.removeChecklistItem,
    })),
  );

export const useKeepLabelActions = () =>
  useKeepStore(
    useShallow((state) => ({
      addLabel: state.addLabel,
      updateLabel: state.updateLabel,
      deleteLabel: state.deleteLabel,
      addLabelToNote: state.addLabelToNote,
      removeLabelFromNote: state.removeLabelFromNote,
    })),
  );

export const useKeepLabels = () => useKeepStore((state) => state.labels);
