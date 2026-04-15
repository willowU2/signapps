"use client";

// Feature 29: Drag-drop widget customization

import { useState, useRef, useCallback } from "react";
import { GripVertical, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useDashboardWidgets,
  type DashboardWidget,
  type WidgetSize,
} from "@/hooks/use-dashboard-widgets";

const SIZE_OPTIONS: { value: WidgetSize; label: string }[] = [
  { value: "1x1", label: "1×1" },
  { value: "2x1", label: "2×1" },
  { value: "1x2", label: "1×2" },
  { value: "2x2", label: "2×2" },
  { value: "3x1", label: "3×1" },
  { value: "3x2", label: "3×2" },
];

interface DraggableWidgetProps {
  widget: DashboardWidget;
  onDragStart: (id: string) => void;
  onDrop: (targetId: string) => void;
  onRemove: (id: string) => void;
  onResize: (id: string, size: WidgetSize) => void;
  children: React.ReactNode;
}

export function DraggableWidget({
  widget,
  onDragStart,
  onDrop,
  onRemove,
  onResize,
  children,
}: DraggableWidgetProps) {
  const [dragging, setDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    setDragging(true);
    onDragStart(widget.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onDrop(widget.id);
  };

  const sizeClass: Record<WidgetSize, string> = {
    "1x1": "col-span-1 row-span-1",
    "2x1": "col-span-2 row-span-1",
    "1x2": "col-span-1 row-span-2",
    "2x2": "col-span-2 row-span-2",
    "3x1": "col-span-3 row-span-1",
    "3x2": "col-span-3 row-span-2",
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setDragging(false)}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      className={cn(
        "relative group",
        sizeClass[widget.size],
        dragging && "opacity-40 ring-2 ring-primary/50",
        dragOver && "ring-2 ring-primary bg-primary/5 rounded-xl",
      )}
    >
      {/* Drag handle + controls */}
      <div
        className={cn(
          "absolute top-1.5 left-1.5 z-10 flex items-center gap-0.5 transition-opacity",
          showControls ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="cursor-grab active:cursor-grabbing p-0.5 rounded bg-background/80 shadow-sm">
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>

      <div
        className={cn(
          "absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 transition-opacity",
          showControls ? "opacity-100" : "opacity-0",
        )}
      >
        <select
          value={widget.size}
          onChange={(e) => onResize(widget.id, e.target.value as WidgetSize)}
          className="h-5 text-xs bg-background/90 border rounded px-1 shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {SIZE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 bg-background/80 shadow-sm"
          onClick={() => onRemove(widget.id)}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      {children}
    </div>
  );
}

export function DashboardWidgetCustomizer() {
  const {
    layout,
    visibleWidgets,
    moveWidget,
    resizeWidget,
    toggleWidget,
    addWidget,
    removeWidget,
  } = useDashboardWidgets();
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!draggedId || draggedId === targetId) return;
      const dragged = layout.widgets.find((w) => w.id === draggedId);
      const target = layout.widgets.find((w) => w.id === targetId);
      if (!dragged || !target) return;
      moveWidget(draggedId, target.position);
      moveWidget(targetId, dragged.position);
      setDraggedId(null);
    },
    [draggedId, layout.widgets, moveWidget],
  );

  return (
    <div
      className={`grid gap-3`}
      style={{
        gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
      }}
    >
      {visibleWidgets
        .sort((a, b) =>
          a.position.row !== b.position.row
            ? a.position.row - b.position.row
            : a.position.col - b.position.col,
        )
        .map((w) => (
          <DraggableWidget
            key={w.id}
            widget={w}
            onDragStart={setDraggedId}
            onDrop={handleDrop}
            onRemove={removeWidget}
            onResize={resizeWidget}
          >
            <div className="h-full w-full rounded-xl border bg-card p-2 text-xs text-muted-foreground flex items-center justify-center">
              {w.title}
            </div>
          </DraggableWidget>
        ))}
    </div>
  );
}
