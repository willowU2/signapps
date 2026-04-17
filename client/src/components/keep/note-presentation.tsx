"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  Pause,
  Maximize2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PresentationNote {
  id: string;
  title: string;
  content: string;
  color: string;
  labels: string[];
  hasChecklist: boolean;
  checklistItems: { id: string; text: string; checked: boolean }[];
}

interface NotePresentationProps {
  notes: PresentationNote[];
  startIndex?: number;
  onClose: () => void;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function NotePresentation({
  notes,
  startIndex = 0,
  onClose,
}: NotePresentationProps) {
  const [current, setCurrent] = useState(startIndex);
  const [autoPlay, setAutoPlay] = useState(false);
  const [intervalMs, setIntervalMs] = useState(5000);

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);
  const next = useCallback(
    () => setCurrent((c) => Math.min(notes.length - 1, c + 1)),
    [notes.length],
  );

  // Auto-advance
  useEffect(() => {
    if (!autoPlay) return;
    const id = setInterval(() => {
      setCurrent((c) => {
        if (c >= notes.length - 1) {
          setAutoPlay(false);
          return c;
        }
        return c + 1;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [autoPlay, intervalMs, notes.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        next();
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        prev();
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, onClose]);

  if (notes.length === 0) return null;

  const note = notes[current];
  const bg = note.color && note.color !== "#202124" ? note.color : undefined;
  const unchecked = note.checklistItems.filter((i) => !i.checked);
  const checked = note.checklistItems.filter((i) => i.checked);
  const checkPct =
    note.checklistItems.length > 0
      ? Math.round((checked.length / note.checklistItems.length) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Top controls */}
      <div
        className="flex items-center justify-between px-6 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-white/60 text-sm">
            {current + 1} / {notes.length}
          </span>
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {notes.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={cn(
                  "size-2 rounded-full transition-all",
                  i === current ? "bg-card" : "bg-card/30 hover:bg-card/60",
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-white/60 text-xs">Intervalle:</span>
            <select
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
              className="h-7 rounded text-xs px-1 bg-card/10 text-white border-0"
            >
              <option value={3000}>3s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={20000}>20s</option>
            </select>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-card/10 gap-1"
            onClick={() => setAutoPlay(!autoPlay)}
          >
            {autoPlay ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
            {autoPlay ? "Pause" : "Auto"}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-card/10"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="size-5" />
          </Button>
        </div>
      </div>

      {/* Main slide */}
      <div
        className="flex-1 flex items-center justify-center px-16"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-full max-w-3xl rounded-2xl p-12 shadow-2xl transition-all duration-300 min-h-[300px] flex flex-col justify-center"
          style={{
            backgroundColor: bg ?? "#303134",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {note.title && (
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6 leading-tight">
              {note.title}
            </h1>
          )}

          {note.hasChecklist && note.checklistItems.length > 0 ? (
            <div className="space-y-3">
              {/* Progress bar */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-2 bg-card/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-400 rounded-full transition-all"
                    style={{ width: `${checkPct}%` }}
                  />
                </div>
                <span className="text-white/70 text-sm">{checkPct}%</span>
              </div>

              {unchecked.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 text-white text-lg"
                >
                  <div className="size-5 rounded-sm border-2 border-white/50 shrink-0" />
                  <span>{item.text}</span>
                </div>
              ))}
              {checked.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 text-white/40 text-lg line-through"
                >
                  <div className="size-5 rounded-sm bg-green-400/50 border-2 border-green-400/50 flex items-center justify-center shrink-0">
                    <Check className="size-3 text-white" />
                  </div>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          ) : (
            note.content && (
              <p className="text-xl text-white/90 whitespace-pre-wrap leading-relaxed">
                {note.content}
              </p>
            )
          )}

          {note.labels.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-6">
              {note.labels.map((l) => (
                <Badge
                  key={l}
                  className="bg-card/10 text-white border-white/20 text-sm"
                >
                  {l}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Nav arrows */}
      <div
        className="flex items-center justify-center gap-8 py-6"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-card/10 size-12"
          disabled={current === 0}
          onClick={prev}
          aria-label="Précédent"
        >
          <ChevronLeft className="size-7" />
        </Button>
        <div className="text-white/40 text-sm">← → ou espace</div>
        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-card/10 size-12"
          disabled={current === notes.length - 1}
          onClick={next}
          aria-label="Suivant"
        >
          <ChevronRight className="size-7" />
        </Button>
      </div>
    </div>
  );
}
