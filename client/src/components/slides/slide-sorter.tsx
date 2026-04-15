"use client";

import { useState, useCallback } from "react";
import { X, GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SlideLayout } from "./use-slides";

interface SlideData {
  id: string;
  title: string;
  layout?: SlideLayout;
}

interface SlideSorterProps {
  slides: SlideData[];
  activeSlideId: string | null;
  onSelectSlide: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemoveSlide: (id: string) => void;
  onAddSlide: (layout?: SlideLayout) => void;
  onClose: () => void;
}

export function SlideSorter({
  slides,
  activeSlideId,
  onSelectSlide,
  onReorder,
  onRemoveSlide,
  onAddSlide,
  onClose,
}: SlideSorterProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIdx !== null && dragIdx !== idx) {
      onReorder(dragIdx, idx);
      toast.success(`Diapositive déplacée en position ${idx + 1}`);
    }
    setDragIdx(null);
    setOverIdx(null);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      <div
        className="bg-background dark:bg-[#1f1f1f] rounded-xl shadow-2xl w-[80vw] max-w-[1000px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm">Trieuse de diapositives</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onAddSlide("title_and_content");
                toast.success("Diapositive ajoutée");
              }}
              className="flex items-center gap-1.5 px-3 h-7 bg-[#1a73e8] text-white rounded text-[12px] font-medium hover:bg-[#1557b0]"
            >
              <Plus className="w-3.5 h-3.5" />
              Nouvelle
            </button>
            <button onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Slides grid */}
        <div className="flex-1 overflow-auto p-4">
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            }}
          >
            {slides.map((slide, idx) => (
              <div
                key={slide.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  onSelectSlide(slide.id);
                  onClose();
                }}
                className={cn(
                  "group relative cursor-pointer select-none",
                  dragIdx === idx && "opacity-40",
                  overIdx === idx &&
                    dragIdx !== idx &&
                    "ring-2 ring-[#1a73e8] rounded-lg",
                )}
              >
                {/* Thumbnail */}
                <div
                  className={cn(
                    "aspect-[16/10] bg-card dark:bg-gray-800 rounded-lg border-2 transition-all flex flex-col items-center justify-center overflow-hidden shadow-sm",
                    slide.id === activeSlideId
                      ? "border-[#1a73e8] shadow-md"
                      : "border-border hover:border-[#4a86e8]",
                  )}
                >
                  {/* Simulated slide content */}
                  <div className="w-full h-full p-2 relative">
                    <div
                      className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded mb-1.5"
                      style={{ width: "70%" }}
                    />
                    <div className="w-full h-1.5 bg-muted dark:bg-gray-700 rounded mb-1" />
                    <div
                      className="w-full h-1.5 bg-muted dark:bg-gray-700 rounded mb-1"
                      style={{ width: "80%" }}
                    />
                    <div
                      className="w-full h-1.5 bg-muted dark:bg-gray-700 rounded"
                      style={{ width: "60%" }}
                    />
                  </div>
                  {/* Drag handle */}
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-gray-400">
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                  {/* Delete */}
                  {slides.length > 1 && (
                    <button
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 bg-red-500 text-white rounded hover:bg-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSlide(slide.id);
                        toast.success("Diapositive supprimée");
                      }}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                {/* Slide number + title */}
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-[11px] font-medium truncate flex-1">
                    {slide.title || `Diapositive ${idx + 1}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
          {slides.length} diapositive{slides.length > 1 ? "s" : ""} — Glissez
          pour réordonner, cliquez pour sélectionner
        </div>
      </div>
    </div>
  );
}
