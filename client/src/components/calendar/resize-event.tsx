"use client";

// IDEA-044: Resize event duration — drag bottom edge of event block to change end time

import { useRef, useCallback } from "react";
import { addMinutes, differenceInMinutes } from "date-fns";
import { GripHorizontal } from "lucide-react";
import { Event } from "@/types/calendar";

export interface ResizeResult {
  event: Event;
  newEndTime: Date;
}

interface ResizeHandleProps {
  event: Event;
  hourHeight?: number; // px per hour
  onResizeCommit: (result: ResizeResult) => void;
  containerRef: React.RefObject<HTMLElement>;
}

export function ResizeHandle({
  event,
  hourHeight = 60,
  onResizeCommit,
  containerRef,
}: ResizeHandleProps) {
  // Keep the latest handler/deps in refs so the drag-scoped closures we
  // create inside `handleMouseDown` always see up-to-date values even if
  // the parent re-renders during a drag (e.g. because of an `events`
  // refetch triggered by creating this very event).
  const eventRef = useRef(event);
  eventRef.current = event;
  const hourHeightRef = useRef(hourHeight);
  hourHeightRef.current = hourHeight;
  const onResizeCommitRef = useRef(onResizeCommit);
  onResizeCommitRef.current = onResizeCommit;
  const containerEl = containerRef;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // All drag state lives in closure variables — refs would work too but
      // locals make it unambiguous that they belong to this drag session only.
      const startY = e.clientY;
      const originalEnd = new Date(eventRef.current.end_time);
      let dragged = false;

      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        dragged = true;
        const deltaY = ev.clientY - startY;
        const pxPerMin = hourHeightRef.current / 60;
        const deltaMin = Math.round(deltaY / pxPerMin / 15) * 15; // snap 15min
        const newEnd = addMinutes(originalEnd, deltaMin);
        const startTime = new Date(eventRef.current.start_time);
        const minEnd = addMinutes(startTime, 15);
        const clampedEnd = newEnd < minEnd ? minEnd : newEnd;

        // Visual feedback: update the parent card height directly.
        if (containerEl.current) {
          const durationMin = differenceInMinutes(clampedEnd, startTime);
          const newHeight = (durationMin / 60) * hourHeightRef.current;
          containerEl.current.style.height = `${Math.max(newHeight, hourHeightRef.current / 4)}px`;
        }
      };

      const onUp = (ev: MouseEvent) => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        if (!dragged) return;

        const deltaY = ev.clientY - startY;
        const pxPerMin = hourHeightRef.current / 60;
        const deltaMin = Math.round(deltaY / pxPerMin / 15) * 15;
        const newEnd = addMinutes(originalEnd, deltaMin);
        const startTime = new Date(eventRef.current.start_time);
        const minEnd = addMinutes(startTime, 15);
        const clampedEnd = newEnd < minEnd ? minEnd : newEnd;

        onResizeCommitRef.current({
          event: eventRef.current,
          newEndTime: clampedEnd,
        });
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [containerEl],
  );

  return (
    <div
      data-testid="event-resize-handle"
      className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize group/resize z-30 rounded-b"
      onMouseDown={handleMouseDown}
      // Stop the pointer event from bubbling to the parent
      // DraggableEventCard, whose @dnd-kit listeners would otherwise
      // interpret this as the start of a drag-and-drop.
      onPointerDown={(e) => e.stopPropagation()}
      title="Drag to resize"
    >
      <div className="w-8 h-1.5 rounded-full bg-card/50 group-hover/resize:bg-card/90 transition-colors">
        <GripHorizontal className="h-1.5 w-1.5 text-inherit opacity-0 group-hover/resize:opacity-60" />
      </div>
    </div>
  );
}

// Wrapper hook to use with useEvents
export function useEventResize(
  updateEvent: (id: string, data: { end_time: string }) => Promise<Event>,
) {
  const handleResizeCommit = useCallback(
    async ({ event, newEndTime }: ResizeResult) => {
      try {
        await updateEvent(event.id, { end_time: newEndTime.toISOString() });
      } catch {
        // Revert handled by parent re-render
      }
    },
    [updateEvent],
  );

  return { handleResizeCommit };
}
