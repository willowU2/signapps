"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  keepApi,
  type KeepNote,
  type KeepLabel,
  type KeepData,
} from "@/lib/api/keep";

// Re-export types for consumers
export type { KeepNote, KeepLabel, KeepData };

// Query keys
export const keepKeys = {
  all: ["keep"] as const,
  notes: () => [...keepKeys.all, "notes"] as const,
  labels: () => [...keepKeys.all, "labels"] as const,
};

// Default data for optimistic updates when no data exists
const defaultData: KeepData = { notes: [], labels: [] };

// Hook for fetching all keep data (notes + labels)
export function useKeepData() {
  return useQuery({
    queryKey: keepKeys.all,
    queryFn: () => keepApi.fetchAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for creating a note with optimistic update
export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (note: Omit<KeepNote, "id" | "createdAt" | "updatedAt">) =>
      keepApi.createNote(note),

    onMutate: async (newNoteData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: keepKeys.all });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<KeepData>(keepKeys.all);

      // Create optimistic note with temporary ID
      const optimisticNote: KeepNote = {
        ...newNoteData,
        id: `temp-${crypto.randomUUID()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Optimistically update to the new value
      queryClient.setQueryData<KeepData>(keepKeys.all, (old) => ({
        notes: [optimisticNote, ...(old?.notes || [])],
        labels: old?.labels || [],
      }));

      // Return a context object with the snapshotted value
      return { previousData };
    },

    onError: (_err, _newNote, context) => {
      // If the mutation fails, use the context returned from onMutate to rollback
      if (context?.previousData) {
        queryClient.setQueryData(keepKeys.all, context.previousData);
      }
      toast.error("Erreur lors de la création de la note");
    },

    onSuccess: (createdNote) => {
      // Replace temporary note with the real one from server
      queryClient.setQueryData<KeepData>(keepKeys.all, (old) => {
        if (!old) return { notes: [createdNote], labels: [] };
        return {
          ...old,
          notes: old.notes.map((n) =>
            n.id.startsWith("temp-") ? createdNote : n,
          ),
        };
      });
    },
  });
}

// Hook for updating a note with optimistic update
export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<KeepNote> }) =>
      keepApi.updateNote(id, updates),

    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: keepKeys.all });

      const previousData = queryClient.getQueryData<KeepData>(keepKeys.all);

      // Optimistically update
      queryClient.setQueryData<KeepData>(keepKeys.all, (old) => {
        if (!old) return defaultData;
        return {
          ...old,
          notes: old.notes.map((note) =>
            note.id === id
              ? { ...note, ...updates, updatedAt: new Date().toISOString() }
              : note,
          ),
        };
      });

      return { previousData };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(keepKeys.all, context.previousData);
      }
      toast.error("Erreur lors de la mise à jour de la note");
    },
  });
}

// Hook for toggling pin status with optimistic update
export function useTogglePin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (note: KeepNote) =>
      keepApi.updateNote(note.id, { isPinned: !note.isPinned }),

    onMutate: async (note) => {
      await queryClient.cancelQueries({ queryKey: keepKeys.all });
      const previousData = queryClient.getQueryData<KeepData>(keepKeys.all);

      queryClient.setQueryData<KeepData>(keepKeys.all, (old) => {
        if (!old) return defaultData;
        return {
          ...old,
          notes: old.notes.map((n) =>
            n.id === note.id
              ? {
                  ...n,
                  isPinned: !n.isPinned,
                  updatedAt: new Date().toISOString(),
                }
              : n,
          ),
        };
      });

      return { previousData };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(keepKeys.all, context.previousData);
      }
    },
  });
}

// Hook for archiving/unarchiving a note with optimistic update and toast undo
export function useToggleArchive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (note: KeepNote) =>
      keepApi.updateNote(note.id, {
        isArchived: !note.isArchived,
        isPinned: note.isArchived ? note.isPinned : false,
      }),

    onMutate: async (note) => {
      await queryClient.cancelQueries({ queryKey: keepKeys.all });
      const previousData = queryClient.getQueryData<KeepData>(keepKeys.all);

      queryClient.setQueryData<KeepData>(keepKeys.all, (old) => {
        if (!old) return defaultData;
        return {
          ...old,
          notes: old.notes.map((n) =>
            n.id === note.id
              ? {
                  ...n,
                  isArchived: !n.isArchived,
                  isPinned: n.isArchived ? n.isPinned : false,
                  updatedAt: new Date().toISOString(),
                }
              : n,
          ),
        };
      });

      return { previousData, wasArchived: note.isArchived };
    },

    onSuccess: (_result, note, context) => {
      const message = context?.wasArchived
        ? "Note desarchivee"
        : "Note archivee";
      toast(message, {
        duration: 5000,
        action: {
          label: "Annuler",
          onClick: () => {
            // Undo: revert the archive toggle
            keepApi
              .updateNote(note.id, {
                isArchived: context?.wasArchived ?? false,
                isPinned: note.isPinned,
              })
              .then(() => {
                queryClient.invalidateQueries({ queryKey: keepKeys.all });
              });
            // Optimistically revert
            if (context?.previousData) {
              queryClient.setQueryData(keepKeys.all, context.previousData);
            }
          },
        },
      });
    },

    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(keepKeys.all, context.previousData);
      }
      toast.error("Erreur lors de l'archivage");
    },
  });
}

// Hook for moving to trash with optimistic update and toast undo
export function useMoveToTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (note: KeepNote) =>
      keepApi.updateNote(note.id, {
        isTrashed: true,
        isArchived: false,
        isPinned: false,
      }),

    onMutate: async (note) => {
      await queryClient.cancelQueries({ queryKey: keepKeys.all });
      const previousData = queryClient.getQueryData<KeepData>(keepKeys.all);

      queryClient.setQueryData<KeepData>(keepKeys.all, (old) => {
        if (!old) return defaultData;
        return {
          ...old,
          notes: old.notes.map((n) =>
            n.id === note.id
              ? {
                  ...n,
                  isTrashed: true,
                  isArchived: false,
                  isPinned: false,
                  updatedAt: new Date().toISOString(),
                }
              : n,
          ),
        };
      });

      return { previousData };
    },

    onSuccess: (_result, note, context) => {
      toast("Note mise a la corbeille", {
        duration: 5000,
        action: {
          label: "Annuler",
          onClick: () => {
            // Undo: restore from trash
            keepApi.updateNote(note.id, { isTrashed: false }).then(() => {
              queryClient.invalidateQueries({ queryKey: keepKeys.all });
            });
            // Optimistically revert
            if (context?.previousData) {
              queryClient.setQueryData(keepKeys.all, context.previousData);
            }
          },
        },
      });
    },

    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(keepKeys.all, context.previousData);
      }
      toast.error("Erreur lors de la suppression");
    },
  });
}

// Hook for restoring from trash with optimistic update
export function useRestoreFromTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (note: KeepNote) =>
      keepApi.updateNote(note.id, { isTrashed: false }),

    onMutate: async (note) => {
      await queryClient.cancelQueries({ queryKey: keepKeys.all });
      const previousData = queryClient.getQueryData<KeepData>(keepKeys.all);

      queryClient.setQueryData<KeepData>(keepKeys.all, (old) => {
        if (!old) return defaultData;
        return {
          ...old,
          notes: old.notes.map((n) =>
            n.id === note.id
              ? { ...n, isTrashed: false, updatedAt: new Date().toISOString() }
              : n,
          ),
        };
      });

      return { previousData };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(keepKeys.all, context.previousData);
      }
      toast.error("Erreur lors de la restauration");
    },
  });
}

// Hook for permanently deleting a note with optimistic update
export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => keepApi.deleteNote(noteId),

    onMutate: async (noteId) => {
      await queryClient.cancelQueries({ queryKey: keepKeys.all });
      const previousData = queryClient.getQueryData<KeepData>(keepKeys.all);

      queryClient.setQueryData<KeepData>(keepKeys.all, (old) => {
        if (!old) return defaultData;
        return {
          ...old,
          notes: old.notes.filter((n) => n.id !== noteId),
        };
      });

      return { previousData };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(keepKeys.all, context.previousData);
      }
      toast.error("Erreur lors de la suppression définitive");
    },
  });
}

// Hook for emptying trash with optimistic update
export function useEmptyTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trashedNoteIds: string[]) =>
      keepApi.deleteNotes(trashedNoteIds),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: keepKeys.all });
      const previousData = queryClient.getQueryData<KeepData>(keepKeys.all);

      queryClient.setQueryData<KeepData>(keepKeys.all, (old) => {
        if (!old) return defaultData;
        return {
          ...old,
          notes: old.notes.filter((n) => !n.isTrashed),
        };
      });

      return { previousData };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(keepKeys.all, context.previousData);
      }
      toast.error("Erreur lors du vidage de la corbeille");
    },
  });
}

// Hook for changing note color with optimistic update
export function useChangeColor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, color }: { noteId: string; color: string }) =>
      keepApi.updateNote(noteId, { color }),

    onMutate: async ({ noteId, color }) => {
      await queryClient.cancelQueries({ queryKey: keepKeys.all });
      const previousData = queryClient.getQueryData<KeepData>(keepKeys.all);

      queryClient.setQueryData<KeepData>(keepKeys.all, (old) => {
        if (!old) return defaultData;
        return {
          ...old,
          notes: old.notes.map((n) =>
            n.id === noteId
              ? { ...n, color, updatedAt: new Date().toISOString() }
              : n,
          ),
        };
      });

      return { previousData };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(keepKeys.all, context.previousData);
      }
    },
  });
}

// Hook for toggling checklist item with optimistic update
export function useToggleChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ note, itemId }: { note: KeepNote; itemId: string }) => {
      const updatedItems = note.checklistItems.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item,
      );
      return keepApi.updateNote(note.id, { checklistItems: updatedItems });
    },

    onMutate: async ({ note, itemId }) => {
      await queryClient.cancelQueries({ queryKey: keepKeys.all });
      const previousData = queryClient.getQueryData<KeepData>(keepKeys.all);

      queryClient.setQueryData<KeepData>(keepKeys.all, (old) => {
        if (!old) return defaultData;
        return {
          ...old,
          notes: old.notes.map((n) =>
            n.id === note.id
              ? {
                  ...n,
                  checklistItems: n.checklistItems.map((item) =>
                    item.id === itemId
                      ? { ...item, checked: !item.checked }
                      : item,
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : n,
          ),
        };
      });

      return { previousData };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(keepKeys.all, context.previousData);
      }
    },
  });
}

// Label mutations
export function useCreateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => keepApi.createLabel(name),

    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: keepKeys.all });
      const previousData = queryClient.getQueryData<KeepData>(keepKeys.all);

      const optimisticLabel: KeepLabel = {
        id: `temp-${crypto.randomUUID()}`,
        name: name.toUpperCase(),
      };

      queryClient.setQueryData<KeepData>(keepKeys.all, (old) => ({
        notes: old?.notes || [],
        labels: [...(old?.labels || []), optimisticLabel],
      }));

      return { previousData };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(keepKeys.all, context.previousData);
      }
      toast.error("Erreur lors de la création du libellé");
    },

    onSuccess: (createdLabel) => {
      queryClient.setQueryData<KeepData>(keepKeys.all, (old) => {
        if (!old) return { notes: [], labels: [createdLabel] };
        return {
          ...old,
          labels: old.labels.map((l) =>
            l.id.startsWith("temp-") ? createdLabel : l,
          ),
        };
      });
    },
  });
}

export function useDeleteLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (labelId: string) => keepApi.deleteLabel(labelId),

    onMutate: async (labelId) => {
      await queryClient.cancelQueries({ queryKey: keepKeys.all });
      const previousData = queryClient.getQueryData<KeepData>(keepKeys.all);

      const labelToDelete = previousData?.labels.find((l) => l.id === labelId);

      queryClient.setQueryData<KeepData>(keepKeys.all, (old) => {
        if (!old) return defaultData;
        return {
          notes: labelToDelete
            ? old.notes.map((note) => ({
                ...note,
                labels: note.labels.filter((l) => l !== labelToDelete.name),
              }))
            : old.notes,
          labels: old.labels.filter((l) => l.id !== labelId),
        };
      });

      return { previousData };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(keepKeys.all, context.previousData);
      }
      toast.error("Erreur lors de la suppression du libellé");
    },
  });
}

// Selector helpers for components
export function selectNotesByView(
  data: KeepData | undefined,
  view: "notes" | "reminders" | "archive" | "trash",
  searchQuery: string = "",
  labelFilter: string | null = null,
): KeepNote[] {
  if (!data) return [];

  let filtered = data.notes;

  // Filter by view
  switch (view) {
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
  if (labelFilter) {
    const label = data.labels.find((l) => l.id === labelFilter);
    if (label) {
      filtered = filtered.filter((n) => n.labels.includes(label.name));
    }
  }

  return filtered;
}

export function selectPinnedNotes(notes: KeepNote[]): KeepNote[] {
  return notes.filter((n) => n.isPinned);
}

export function selectUnpinnedNotes(notes: KeepNote[]): KeepNote[] {
  return notes.filter((n) => !n.isPinned);
}
