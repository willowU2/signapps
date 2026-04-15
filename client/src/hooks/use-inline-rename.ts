"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseInlineRenameOptions {
  onRename: (id: string, newName: string) => Promise<void> | void;
}

export function useInlineRename({ onRename }: UseInlineRenameOptions) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const startRename = useCallback((id: string, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
  }, []);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditValue("");
  }, []);

  const confirmRename = useCallback(async () => {
    if (!editingId || !editValue.trim()) {
      cancelRename();
      return;
    }
    await onRename(editingId, editValue.trim());
    setEditingId(null);
    setEditValue("");
  }, [editingId, editValue, onRename, cancelRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmRename();
      } else if (e.key === "Escape") {
        cancelRename();
      }
    },
    [confirmRename, cancelRename],
  );

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  return {
    editingId,
    editValue,
    setEditValue,
    inputRef,
    startRename,
    cancelRename,
    confirmRename,
    handleKeyDown,
  };
}
