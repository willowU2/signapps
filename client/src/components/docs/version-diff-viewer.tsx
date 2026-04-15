"use client";

/**
 * VersionDiffViewer
 *
 * Inline visual diff between two document versions.
 * Uses a pure LCS-based line-by-line diff — no external library.
 */

import React, { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Equal } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

type DiffKind = "equal" | "add" | "remove";

interface DiffLine {
  kind: DiffKind;
  text: string;
  oldLineNo: number | null;
  newLineNo: number | null;
}

export interface VersionDiffViewerProps {
  oldContent: string;
  newContent: string;
  oldLabel: string;
  newLabel: string;
  className?: string;
}

// ============================================================================
// LCS diff algorithm (line-level)
// ============================================================================

function lcs(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  // Use a flat Uint32Array for memory efficiency on large docs
  const dp = new Uint32Array((m + 1) * (n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i * (n + 1) + j] = dp[(i + 1) * (n + 1) + (j + 1)] + 1;
      } else {
        dp[i * (n + 1) + j] = Math.max(
          dp[(i + 1) * (n + 1) + j],
          dp[i * (n + 1) + (j + 1)],
        );
      }
    }
  }
  // Recover the table as a 2D array (only the first row is needed externally,
  // but we keep full 2D to walk the back-trace)
  const table: number[][] = [];
  for (let i = 0; i <= m; i++) {
    table[i] = [];
    for (let j = 0; j <= n; j++) {
      table[i][j] = dp[i * (n + 1) + j];
    }
  }
  return table;
}

function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const table = lcs(oldLines, newLines);
  const result: DiffLine[] = [];
  let oldLineNo = 1;
  let newLineNo = 1;
  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (
      i < oldLines.length &&
      j < newLines.length &&
      oldLines[i] === newLines[j]
    ) {
      result.push({ kind: "equal", text: oldLines[i], oldLineNo, newLineNo });
      oldLineNo++;
      newLineNo++;
      i++;
      j++;
    } else if (
      j < newLines.length &&
      (i >= oldLines.length || table[i + 1][j] >= table[i][j + 1])
    ) {
      result.push({
        kind: "add",
        text: newLines[j],
        oldLineNo: null,
        newLineNo,
      });
      newLineNo++;
      j++;
    } else {
      result.push({
        kind: "remove",
        text: oldLines[i],
        oldLineNo,
        newLineNo: null,
      });
      oldLineNo++;
      i++;
    }
  }

  return result;
}

// ============================================================================
// Sub-components
// ============================================================================

interface DiffRowProps {
  line: DiffLine;
}

function DiffRow({ line }: DiffRowProps) {
  const isAdd = line.kind === "add";
  const isRemove = line.kind === "remove";

  return (
    <tr
      className={cn(
        "group font-mono text-xs leading-5",
        isAdd && "bg-green-950/40",
        isRemove && "bg-red-950/40",
      )}
    >
      {/* Old line number */}
      <td
        className={cn(
          "select-none w-10 px-2 text-right text-muted-foreground/50 border-r border-border/40",
          isAdd && "text-transparent",
        )}
      >
        {line.oldLineNo ?? ""}
      </td>

      {/* New line number */}
      <td
        className={cn(
          "select-none w-10 px-2 text-right text-muted-foreground/50 border-r border-border/40",
          isRemove && "text-transparent",
        )}
      >
        {line.newLineNo ?? ""}
      </td>

      {/* Diff marker */}
      <td
        className={cn(
          "select-none w-6 text-center border-r border-border/40",
          isAdd && "text-green-400",
          isRemove && "text-red-400",
          !isAdd && !isRemove && "text-muted-foreground/30",
        )}
      >
        {isAdd ? "+" : isRemove ? "-" : " "}
      </td>

      {/* Content */}
      <td
        className={cn(
          "px-3 py-0 whitespace-pre-wrap break-all",
          isAdd && "text-green-300",
          isRemove && "text-red-300",
          !isAdd && !isRemove && "text-muted-foreground",
        )}
      >
        {line.text || "\u00A0"}
      </td>
    </tr>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VersionDiffViewer({
  oldContent,
  newContent,
  oldLabel,
  newLabel,
  className,
}: VersionDiffViewerProps) {
  const { diffLines, addCount, removeCount } = useMemo(() => {
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");
    const lines = computeDiff(oldLines, newLines);
    const addCount = lines.filter((l) => l.kind === "add").length;
    const removeCount = lines.filter((l) => l.kind === "remove").length;
    return { diffLines: lines, addCount, removeCount };
  }, [oldContent, newContent]);

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-background border rounded-lg overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-3 text-sm">
          <span
            className="text-muted-foreground font-medium truncate max-w-[180px]"
            title={oldLabel}
          >
            {oldLabel}
          </span>
          <span className="text-muted-foreground/40">→</span>
          <span className="font-medium truncate max-w-[180px]" title={newLabel}>
            {newLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {addCount > 0 && (
            <Badge
              variant="secondary"
              className="bg-green-950 text-green-400 gap-1 text-xs"
            >
              <Plus className="h-3 w-3" />
              {addCount}
            </Badge>
          )}
          {removeCount > 0 && (
            <Badge
              variant="secondary"
              className="bg-red-950 text-red-400 gap-1 text-xs"
            >
              <Minus className="h-3 w-3" />
              {removeCount}
            </Badge>
          )}
          {addCount === 0 && removeCount === 0 && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs text-muted-foreground"
            >
              <Equal className="h-3 w-3" />
              Identiques
            </Badge>
          )}
        </div>
      </div>

      {/* Diff table */}
      <ScrollArea className="flex-1">
        <table className="w-full border-collapse">
          <tbody>
            {diffLines.map((line, idx) => (
              <DiffRow key={idx} line={line} />
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}

export default VersionDiffViewer;
