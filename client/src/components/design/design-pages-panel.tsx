"use client";

import { useDesignStore, useDesignPages } from "@/stores/design-store";
import { Button } from "@/components/ui/button";
import { Plus, Copy, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DesignPagesPanel() {
  const {
    pages,
    currentPageIndex,
    setCurrentPage,
    addPage,
    duplicatePage,
    deletePage,
  } = useDesignPages();

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Pages
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={addPage}
          title="Add page"
          aria-label="Add page"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {pages.map((page, idx) => (
          <div
            key={page.id}
            className={cn(
              "relative group rounded-lg border-2 cursor-pointer transition-all overflow-hidden",
              idx === currentPageIndex
                ? "border-primary shadow-sm"
                : "border-transparent hover:border-muted-foreground/30",
            )}
            onClick={() => setCurrentPage(idx)}
          >
            {/* Thumbnail preview */}
            <div
              className="w-full aspect-video flex items-center justify-center text-xs text-muted-foreground"
              style={{ backgroundColor: page.background || "#ffffff" }}
            >
              <div className="opacity-50">
                {page.objects.length > 0 ? (
                  <span className="text-[10px]">
                    {page.objects.length} elements
                  </span>
                ) : (
                  <span className="text-[10px]">Empty</span>
                )}
              </div>
            </div>

            {/* Page number label */}
            <div className="absolute bottom-1 left-1.5 text-[10px] font-medium bg-background/80 backdrop-blur-sm rounded px-1">
              {idx + 1}
            </div>

            {/* Actions */}
            <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  duplicatePage(idx);
                }}
                className="p-1 rounded bg-background/80 backdrop-blur-sm hover:bg-background shadow-sm"
                title="Duplicate page"
              >
                <Copy className="h-3 w-3" />
              </button>
              {pages.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePage(idx);
                  }}
                  className="p-1 rounded bg-background/80 backdrop-blur-sm hover:bg-destructive/10 shadow-sm"
                  title="Delete page"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
