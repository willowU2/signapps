/**
 * Hook for managing track changes in a Tiptap editor
 *
 * Connects the editor's track changes extension with the Zustand store
 * for persistent state management and UI integration.
 */

import { useCallback, useEffect, useMemo } from "react";
import { Editor } from "@tiptap/react";
import { useTrackChangesStore } from "@/stores/track-changes-store";
import { useAuthStore } from "@/lib/store";
import type {
  TrackChange,
  ChangeType,
} from "@/components/docs/extensions/track-changes";

export interface UseTrackChangesOptions {
  editor: Editor | null;
  documentId: string;
}

export interface UseTrackChangesReturn {
  // State
  enabled: boolean;
  showChanges: boolean;
  pendingChanges: TrackChange[];
  allChanges: TrackChange[];
  activeChangeId: string | null;

  // Actions
  toggleEnabled: () => void;
  setEnabled: (enabled: boolean) => void;
  toggleShowChanges: () => void;
  setShowChanges: (show: boolean) => void;

  // Change actions
  acceptChange: (changeId: string) => void;
  rejectChange: (changeId: string) => void;
  acceptAllChanges: () => void;
  rejectAllChanges: () => void;

  // Recording changes
  recordChange: (
    type: ChangeType,
    originalContent?: string,
    newContent?: string,
  ) => string | null;

  // Navigation
  setActiveChange: (changeId: string | null) => void;
  goToChange: (changeId: string) => void;

  // Stats
  insertionCount: number;
  deletionCount: number;
}

export function useTrackChanges({
  editor,
  documentId,
}: UseTrackChangesOptions): UseTrackChangesReturn {
  const { user } = useAuthStore();

  // Store selectors
  const isEnabled = useTrackChangesStore((s) => s.isEnabled);
  const isShowingChanges = useTrackChangesStore((s) => s.isShowingChanges);
  const getPendingChanges = useTrackChangesStore((s) => s.getPendingChanges);
  const getChanges = useTrackChangesStore((s) => s.getChanges);
  const activeChangeId = useTrackChangesStore((s) => s.activeChangeId);

  // Store actions
  const storeSetEnabled = useTrackChangesStore((s) => s.setEnabled);
  const storeSetShowChanges = useTrackChangesStore((s) => s.setShowChanges);
  const storeAddChange = useTrackChangesStore((s) => s.addChange);
  const storeAcceptChange = useTrackChangesStore((s) => s.acceptChange);
  const storeRejectChange = useTrackChangesStore((s) => s.rejectChange);
  const storeAcceptAllChanges = useTrackChangesStore((s) => s.acceptAllChanges);
  const storeRejectAllChanges = useTrackChangesStore((s) => s.rejectAllChanges);
  const storeSetActiveChange = useTrackChangesStore((s) => s.setActiveChange);

  // Computed state
  const enabled = isEnabled(documentId);
  const showChanges = isShowingChanges(documentId);
  const pendingChanges = useMemo(
    () => getPendingChanges(documentId),
    [getPendingChanges, documentId],
  );
  const allChanges = useMemo(
    () => getChanges(documentId),
    [getChanges, documentId],
  );

  // Stats
  const insertionCount = useMemo(
    () => pendingChanges.filter((c) => c.type === "insertion").length,
    [pendingChanges],
  );
  const deletionCount = useMemo(
    () => pendingChanges.filter((c) => c.type === "deletion").length,
    [pendingChanges],
  );

  // Sync editor storage with store
  useEffect(() => {
    if (!editor) return;

    const storage = editor.storage as Record<string, any>;
    if (storage.trackChanges) {
      storage.trackChanges.enabled = enabled;
    }
  }, [editor, enabled]);

  // Toggle enabled
  const toggleEnabled = useCallback(() => {
    const newValue = !enabled;
    storeSetEnabled(documentId, newValue);

    if (editor) {
      if (newValue) {
        editor.commands.enableTrackChanges();
      } else {
        editor.commands.disableTrackChanges();
      }
    }
  }, [editor, documentId, enabled, storeSetEnabled]);

  // Set enabled
  const setEnabled = useCallback(
    (value: boolean) => {
      storeSetEnabled(documentId, value);

      if (editor) {
        if (value) {
          editor.commands.enableTrackChanges();
        } else {
          editor.commands.disableTrackChanges();
        }
      }
    },
    [editor, documentId, storeSetEnabled],
  );

  // Toggle show changes
  const toggleShowChanges = useCallback(() => {
    storeSetShowChanges(documentId, !showChanges);
  }, [documentId, showChanges, storeSetShowChanges]);

  // Set show changes
  const setShowChanges = useCallback(
    (show: boolean) => {
      storeSetShowChanges(documentId, show);
    },
    [documentId, storeSetShowChanges],
  );

  // Record a change (used by the plugin)
  const recordChange = useCallback(
    (
      type: ChangeType,
      originalContent?: string,
      newContent?: string,
    ): string | null => {
      if (!user) return null;

      const changeId = storeAddChange(
        documentId,
        type,
        user.username || "Anonyme",
        user.id,
        originalContent,
        newContent,
      );

      return changeId;
    },
    [documentId, user, storeAddChange],
  );

  // Accept a change
  const acceptChange = useCallback(
    (changeId: string) => {
      // Update store
      storeAcceptChange(documentId, changeId);

      // Update document
      if (editor) {
        editor.commands.acceptChange(changeId);
      }
    },
    [editor, documentId, storeAcceptChange],
  );

  // Reject a change
  const rejectChange = useCallback(
    (changeId: string) => {
      // Update store
      storeRejectChange(documentId, changeId);

      // Update document
      if (editor) {
        editor.commands.rejectChange(changeId);
      }
    },
    [editor, documentId, storeRejectChange],
  );

  // Accept all changes
  const acceptAllChanges = useCallback(() => {
    // Update store
    storeAcceptAllChanges(documentId);

    // Update document
    if (editor) {
      editor.commands.acceptAllChanges();
    }
  }, [editor, documentId, storeAcceptAllChanges]);

  // Reject all changes
  const rejectAllChanges = useCallback(() => {
    // Update store
    storeRejectAllChanges(documentId);

    // Update document
    if (editor) {
      editor.commands.rejectAllChanges();
    }
  }, [editor, documentId, storeRejectAllChanges]);

  // Set active change
  const setActiveChange = useCallback(
    (changeId: string | null) => {
      storeSetActiveChange(changeId);
    },
    [storeSetActiveChange],
  );

  // Navigate to a change in the document
  const goToChange = useCallback(
    (changeId: string) => {
      if (!editor) return;

      // Find the change mark in the document
      const { doc } = editor.state;
      let found = false;

      doc.descendants((node, pos) => {
        if (found || !node.isText) return;

        const mark = node.marks.find(
          (m) =>
            (m.type.name === "insertion" || m.type.name === "deletion") &&
            m.attrs.changeId === changeId,
        );

        if (mark) {
          // Set selection at the start of the marked text
          editor.commands.setTextSelection(pos);
          editor.commands.focus();
          found = true;
        }
      });

      // Set as active change
      setActiveChange(changeId);
    },
    [editor, setActiveChange],
  );

  return {
    // State
    enabled,
    showChanges,
    pendingChanges,
    allChanges,
    activeChangeId,

    // Actions
    toggleEnabled,
    setEnabled,
    toggleShowChanges,
    setShowChanges,

    // Change actions
    acceptChange,
    rejectChange,
    acceptAllChanges,
    rejectAllChanges,

    // Recording
    recordChange,

    // Navigation
    setActiveChange,
    goToChange,

    // Stats
    insertionCount,
    deletionCount,
  };
}

export default useTrackChanges;
