"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface UseTableKeyboardOptions {
  /** Total number of rows in the table */
  rowCount: number;
  /** Called when Enter is pressed on a focused row */
  onOpen: (index: number) => void;
  /** Called when Delete is pressed on a focused row (shows confirmation first) */
  onDelete: (index: number) => void;
  /** Called when Space is pressed to toggle selection */
  onSelect?: (index: number) => void;
  /** Whether keyboard navigation is enabled (disable when modals are open) */
  enabled?: boolean;
}

export interface UseTableKeyboardResult {
  /** Currently focused row index (-1 = none) */
  focusedRow: number;
  /** Set focused row manually */
  setFocusedRow: (index: number) => void;
  /** Whether a row is selected via Space */
  selectedRows: Set<number>;
  /** Ref to attach to the table container for scoping keyboard events */
  tableRef: React.RefObject<HTMLElement | null>;
  /** Get row props to spread on each TableRow */
  getRowProps: (index: number) => {
    tabIndex: number;
    "data-focused": boolean;
    className: string;
    onMouseEnter: () => void;
    onClick: () => void;
  };
}

function isInputFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.isContentEditable ||
    el.tagName === "SELECT"
  );
}

export function useTableKeyboard({
  rowCount,
  onOpen,
  onDelete,
  onSelect,
  enabled = true,
}: UseTableKeyboardOptions): UseTableKeyboardResult {
  const [focusedRow, setFocusedRow] = useState(-1);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const tableRef = useRef<HTMLElement | null>(null);

  // Reset focus when row count changes
  useEffect(() => {
    if (focusedRow >= rowCount) {
      setFocusedRow(rowCount > 0 ? rowCount - 1 : -1);
    }
  }, [rowCount, focusedRow]);

  // Reset selection when row count changes significantly
  useEffect(() => {
    setSelectedRows(new Set());
  }, [rowCount]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || isInputFocused()) return;

      // Check if the event target is within our table or if nothing specific is focused
      if (
        tableRef.current &&
        !tableRef.current.contains(e.target as Node) &&
        document.activeElement !== document.body
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setFocusedRow((prev) => {
            const next = prev < rowCount - 1 ? prev + 1 : prev;
            return next;
          });
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setFocusedRow((prev) => {
            const next = prev > 0 ? prev - 1 : 0;
            return next;
          });
          break;
        }
        case "Enter": {
          if (focusedRow >= 0 && focusedRow < rowCount) {
            e.preventDefault();
            onOpen(focusedRow);
          }
          break;
        }
        case "Delete": {
          if (focusedRow >= 0 && focusedRow < rowCount) {
            e.preventDefault();
            onDelete(focusedRow);
          }
          break;
        }
        case " ": {
          if (focusedRow >= 0 && focusedRow < rowCount) {
            e.preventDefault();
            if (onSelect) {
              onSelect(focusedRow);
            }
            setSelectedRows((prev) => {
              const next = new Set(prev);
              if (next.has(focusedRow)) {
                next.delete(focusedRow);
              } else {
                next.add(focusedRow);
              }
              return next;
            });
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          setFocusedRow(-1);
          setSelectedRows(new Set());
          break;
        }
        case "Home": {
          if (rowCount > 0) {
            e.preventDefault();
            setFocusedRow(0);
          }
          break;
        }
        case "End": {
          if (rowCount > 0) {
            e.preventDefault();
            setFocusedRow(rowCount - 1);
          }
          break;
        }
      }
    },
    [enabled, focusedRow, rowCount, onOpen, onDelete, onSelect]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Scroll focused row into view
  useEffect(() => {
    if (focusedRow < 0 || !tableRef.current) return;
    const rows = tableRef.current.querySelectorAll("tbody tr");
    const row = rows[focusedRow] as HTMLElement | undefined;
    if (row) {
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focusedRow]);

  const getRowProps = useCallback(
    (index: number) => ({
      tabIndex: index === focusedRow ? 0 : -1,
      "data-focused": index === focusedRow,
      className: [
        "transition-colors cursor-pointer",
        index === focusedRow
          ? "bg-primary/10 ring-1 ring-primary/30 ring-inset"
          : "hover:bg-muted/50",
        selectedRows.has(index) ? "bg-primary/5" : "",
      ]
        .filter(Boolean)
        .join(" "),
      onMouseEnter: () => setFocusedRow(index),
      onClick: () => {
        setFocusedRow(index);
        onOpen(index);
      },
    }),
    [focusedRow, selectedRows, onOpen]
  );

  return {
    focusedRow,
    setFocusedRow,
    selectedRows,
    tableRef: tableRef as React.RefObject<HTMLElement | null>,
    getRowProps,
  };
}
