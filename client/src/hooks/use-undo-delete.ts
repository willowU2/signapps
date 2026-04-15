"use client";

import { useRef, useCallback } from "react";
import { toast } from "sonner";

interface UseUndoDeleteOptions<T> {
  onDelete: (item: T) => Promise<void> | void;
  onRestore: (item: T) => Promise<void> | void;
  getLabel: (item: T) => string;
  delay?: number;
}

export function useUndoDelete<T>({
  onDelete,
  onRestore,
  getLabel,
  delay = 5000,
}: UseUndoDeleteOptions<T>) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deleteWithUndo = useCallback(
    (item: T) => {
      const label = getLabel(item);

      // Optimistically delete
      onDelete(item);

      // Show undo toast
      toast(`"${label}" supprimé`, {
        duration: delay,
        action: {
          label: "Annuler",
          onClick: () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            onRestore(item);
            toast.success(`"${label}" restauré`);
          },
        },
      });
    },
    [onDelete, onRestore, getLabel, delay],
  );

  return { deleteWithUndo };
}
