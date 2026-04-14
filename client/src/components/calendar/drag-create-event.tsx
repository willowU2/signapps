"use client";

// IDEA-043: Click+drag to create event — mousedown+drag on calendar grid creates new event

import { useRef, useState, useCallback, useEffect } from "react";
import { format, addMinutes, startOfDay } from "date-fns";

export interface DragSelection {
  day: Date;
  startMinutes: number;
  endMinutes: number;
}

interface DragCreateLayerProps {
  day: Date;
  hourHeight?: number; // px per hour, default 60
  onCreateEvent: (selection: DragSelection) => void;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return format(date, "HH:mm");
}

export function DragCreateLayer({
  day,
  hourHeight = 60,
  onCreateEvent,
}: DragCreateLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const isDown = useRef(false);
  // Mirror `dragging` and `startY` in refs so the document-level mouseup
  // handler always reads the latest value. React state in the closure is
  // stale between rapid synthetic events (e.g. Playwright's drag sequence)
  // because deps don't propagate until the next render.
  const draggingRef = useRef(false);
  const startYRef = useRef(0);

  const yToMinutes = useCallback(
    (y: number) => {
      const pxPerMinute = hourHeight / 60;
      const raw = Math.round(y / pxPerMinute / 15) * 15; // snap to 15 min
      return Math.max(0, Math.min(1440, raw));
    },
    [hourHeight],
  );

  const getRect = () => containerRef.current?.getBoundingClientRect();

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = getRect();
    if (!rect) return;
    const relY = e.clientY - rect.top;
    isDown.current = true;
    setStartY(relY);
    setCurrentY(relY);
    setDragging(false);
    startYRef.current = relY;
    draggingRef.current = false;
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDown.current) return;
    const rect = getRect();
    if (!rect) return;
    const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    setCurrentY(relY);
    setDragging(true);
    draggingRef.current = true;
  }, []);

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!isDown.current) return;
      isDown.current = false;
      const rect = getRect();
      const wasDragging = draggingRef.current;
      draggingRef.current = false;
      if (!rect) {
        setDragging(false);
        return;
      }
      if (!wasDragging) {
        // Pure click — create default 1-hour event at clicked Y position
        const startMin = yToMinutes(startYRef.current);
        const endMin = Math.min(1440, startMin + 60);
        onCreateEvent({
          day,
          startMinutes: startMin,
          endMinutes: endMin,
        });
        setDragging(false);
        return;
      }
      const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      const startMin = yToMinutes(Math.min(startYRef.current, relY));
      const endMin = yToMinutes(Math.max(startYRef.current, relY));
      const duration = endMin - startMin;
      if (duration >= 15) {
        onCreateEvent({
          day,
          startMinutes: startMin,
          endMinutes: Math.max(startMin + 30, endMin),
        });
      }
      setDragging(false);
    },
    [day, yToMinutes, onCreateEvent],
  );

  // Escape cancels the in-progress drag-to-create: resets state without
  // calling onCreateEvent, mimicking Google Calendar behaviour.
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (!isDown.current && !draggingRef.current) return;
    isDown.current = false;
    draggingRef.current = false;
    setDragging(false);
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleMouseMove, handleMouseUp, handleKeyDown]);

  // Calculate selection box position
  const top = Math.min(startY, currentY);
  const height = Math.abs(currentY - startY);
  const startMin = yToMinutes(Math.min(startY, currentY));
  const endMin = yToMinutes(Math.max(startY, currentY));

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-0 select-none ${dragging ? "cursor-crosshair" : ""}`}
      onMouseDown={handleMouseDown}
    >
      {dragging && height > 8 && (
        <div
          className="absolute left-0.5 right-0.5 bg-blue-400/30 border-2 border-blue-500 rounded pointer-events-none"
          style={{ top, height }}
        >
          <div className="absolute top-0.5 left-1 text-[10px] font-bold text-blue-700 bg-card/90 rounded px-1">
            {minutesToTime(startMin)} – {minutesToTime(endMin)}
          </div>
        </div>
      )}
    </div>
  );
}

// Hook that converts DragSelection to EventForm props
export function useDragCreate(
  onOpenForm: (startTime: Date, endTime: Date) => void,
) {
  const handleCreate = useCallback(
    (selection: DragSelection) => {
      const base = startOfDay(selection.day);
      const startTime = addMinutes(base, selection.startMinutes);
      const endTime = addMinutes(base, selection.endMinutes);
      onOpenForm(startTime, endTime);
    },
    [onOpenForm],
  );

  return { handleCreate };
}
