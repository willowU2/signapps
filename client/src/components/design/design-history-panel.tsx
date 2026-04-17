/* eslint-disable @next/next/no-img-element */
"use client";

// IDEA-060: Visual undo/redo history panel — list of actions with thumbnails, click to jump to state

import { useState, useEffect, useCallback } from "react";
import { History, Undo2, Redo2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDesignStore } from "@/stores/design-store";
import { cn } from "@/lib/utils";

interface HistoryEntry {
  id: string;
  label: string;
  thumbnail: string | null;
  timestamp: Date;
  index: number; // position in undo stack
}

interface DesignHistoryPanelProps {
  fabricCanvasRef: React.MutableRefObject<any | null>;
}

const ACTION_LABELS: Record<string, string> = {
  add: "Add object",
  remove: "Remove object",
  move: "Move",
  scale: "Resize",
  rotate: "Rotate",
  style: "Style change",
  text: "Edit text",
  background: "Background",
  reorder: "Reorder layers",
};

function captureThumbnail(canvas: any): string | null {
  try {
    return canvas.toDataURL({ format: "png", multiplier: 0.12 });
  } catch {
    return null;
  }
}

export default function DesignHistoryPanel({
  fabricCanvasRef,
}: DesignHistoryPanelProps) {
  const { undoStack, redoStack, undo, redo } = useDesignStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Capture snapshot when undo stack changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const thumb = canvas ? captureThumbnail(canvas) : null;

    setHistory((prev) => {
      const newEntry: HistoryEntry = {
        id: crypto.randomUUID(),
        label: `Action ${prev.length + 1}`,
        thumbnail: thumb,
        timestamp: new Date(),
        index: undoStack.length,
      };

      // Keep only last 20 entries
      const updated = [...prev, newEntry].slice(-20);
      return updated;
    });
    setCurrentIndex(undoStack.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoStack.length]);

  const handleJumpTo = useCallback(
    (entry: HistoryEntry) => {
      const diff = entry.index - undoStack.length;
      if (diff < 0) {
        // Need to undo |diff| times
        for (let i = 0; i < Math.abs(diff); i++) undo();
      } else if (diff > 0) {
        for (let i = 0; i < diff; i++) redo();
      }
      setCurrentIndex(entry.index);
    },
    [undoStack.length, undo, redo],
  );

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            History
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={undo}
            disabled={undoStack.length === 0}
            title="Undo"
            aria-label="Undo"
          >
            <Undo2 className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={redo}
            disabled={redoStack.length === 0}
            title="Redo"
            aria-label="Redo"
          >
            <Redo2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {history.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            <RotateCcw className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
            No actions yet
          </div>
        ) : (
          <div className="space-y-0.5 px-2">
            {/* Current state indicator */}
            <div className="flex items-center gap-1 py-1 px-1 text-[10px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
              Current state
            </div>

            {[...history].reverse().map((entry, idx) => {
              const isCurrent = idx === 0;
              return (
                <button
                  key={entry.id}
                  onClick={() => handleJumpTo(entry)}
                  className={cn(
                    "w-full flex items-center gap-2 p-1.5 rounded text-xs transition-colors text-left",
                    isCurrent
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50 text-muted-foreground",
                  )}
                  title={`Jump to: ${entry.label}`}
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-7 rounded border bg-muted/40 shrink-0 overflow-hidden flex items-center justify-center">
                    {entry.thumbnail ? (
                      <img
                        src={entry.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <History className="w-3 h-3 opacity-30" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[11px]">{entry.label}</p>
                    <p className="text-[9px] opacity-60">
                      {formatTime(entry.timestamp)}
                    </p>
                  </div>

                  {isCurrent && (
                    <Badge
                      variant="default"
                      className="text-[9px] px-1 py-0 h-4 shrink-0"
                    >
                      Now
                    </Badge>
                  )}
                </button>
              );
            })}

            {/* Initial state */}
            <button
              className="w-full flex items-center gap-2 p-1.5 rounded text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
              onClick={() => {
                while (useDesignStore.getState().undoStack.length > 0) undo();
              }}
            >
              <div className="w-10 h-7 rounded border bg-muted/40 shrink-0 flex items-center justify-center">
                <RotateCcw className="w-3 h-3 opacity-30" />
              </div>
              <span className="text-[10px]">Initial state</span>
            </button>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t text-[10px] text-muted-foreground">
        {undoStack.length} undo{undoStack.length !== 1 ? "s" : ""} ·{" "}
        {redoStack.length} redo{redoStack.length !== 1 ? "s" : ""} available
      </div>
    </div>
  );
}
