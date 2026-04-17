"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Move, Copy, Tag, X, CheckSquare } from "lucide-react";
import { FileItem } from "./types";

interface BulkActionToolbarProps {
  selectedItems: FileItem[];
  onClearSelection: () => void;
  onSelectAll: () => void;
  onBulkDelete: (items: FileItem[]) => void;
  onBulkMove: (items: FileItem[]) => void;
  onBulkCopy: (items: FileItem[]) => void;
  onBulkTag: (items: FileItem[]) => void;
  totalCount: number;
}

export function BulkActionToolbar({
  selectedItems,
  onClearSelection,
  onSelectAll,
  onBulkDelete,
  onBulkMove,
  onBulkCopy,
  onBulkTag,
  totalCount,
}: BulkActionToolbarProps) {
  const count = selectedItems.length;
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Badge variant="secondary" className="shrink-0">
          {count} selected
        </Badge>
        {count < totalCount && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onSelectAll}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Select all {totalCount}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => onBulkMove(selectedItems)}
          title="Move selected"
        >
          <Move className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Move</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => onBulkCopy(selectedItems)}
          title="Copy selected"
        >
          <Copy className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Copy</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => onBulkTag(selectedItems)}
          title="Tag selected"
        >
          <Tag className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Tag</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
          onClick={() => onBulkDelete(selectedItems)}
          title="Delete selected"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Supprimer</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClearSelection}
          title="Clear selection"
          aria-label="Clear selection"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
