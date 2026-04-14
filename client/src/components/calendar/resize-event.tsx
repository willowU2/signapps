"use client";

// IDEA-044: Resize event duration — drag top or bottom edge of event block
// to change start/end time. Pro-grade interaction matching Google Calendar:
//  - Handle hit area: 8px at the bottom/top edge
//  - Visual feedback: subtle hover ring on the whole card + handle reveal
//  - Stops all pointer/drag propagation so @dnd-kit doesn't pick up the resize
//  - Escape key cancels an in-progress resize without committing

import { useRef, useCallback } from "react";
import { addMinutes, differenceInMinutes } from "date-fns";
import { Event } from "@/types/calendar";

export interface ResizeResult {
  event: Event;
  newStartTime?: Date;
  newEndTime?: Date;
}

type ResizeEdge = "top" | "bottom";

interface ResizeHandleProps {
  event: Event;
  hourHeight?: number; // px per hour
  onResizeCommit: (result: ResizeResult) => void;
  containerRef: React.RefObject<HTMLElement>;
  edge?: ResizeEdge;
}

/**
 * ResizeHandle — a thin (8 px) drag zone pinned to the top or bottom edge
 * of an event card. Clicks and pointer events are swallowed so @dnd-kit's
 * PointerSensor (distance: 8) does not steal the gesture.
 */
export function ResizeHandle({
  event,
  hourHeight = 60,
  onResizeCommit,
  containerRef,
  edge = "bottom",
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

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      // Stop everything — including @dnd-kit listeners on the same node and
      // ancestor drag-create layer. Without the native immediate-stop, the
      // dnd-kit PointerSensor would still activate after the 8 px threshold.
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation?.();

      const startY = e.clientY;
      const originalStart = new Date(eventRef.current.start_time);
      const originalEnd = new Date(eventRef.current.end_time);
      // Capture the initial CSS values so Escape can rollback the preview.
      const initialTop = containerEl.current?.style.top ?? "";
      const initialHeight = containerEl.current?.style.height ?? "";
      let dragged = false;
      let cancelled = false;

      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        if (cancelled) return;
        dragged = true;
        const deltaY = ev.clientY - startY;
        const pxPerMin = hourHeightRef.current / 60;
        const deltaMin = Math.round(deltaY / pxPerMin / 15) * 15;

        if (edge === "bottom") {
          const newEnd = addMinutes(originalEnd, deltaMin);
          const minEnd = addMinutes(originalStart, 15);
          const clampedEnd = newEnd < minEnd ? minEnd : newEnd;
          if (containerEl.current) {
            const durationMin = differenceInMinutes(clampedEnd, originalStart);
            const newHeight = (durationMin / 60) * hourHeightRef.current;
            containerEl.current.style.height = `${Math.max(newHeight, hourHeightRef.current / 4)}px`;
          }
        } else {
          // Top edge: move start_time but clamp to at least 15 min before end.
          const newStart = addMinutes(originalStart, deltaMin);
          const maxStart = addMinutes(originalEnd, -15);
          const clampedStart = newStart > maxStart ? maxStart : newStart;
          if (containerEl.current) {
            const durationMin = differenceInMinutes(originalEnd, clampedStart);
            const newHeight = (durationMin / 60) * hourHeightRef.current;
            // Shift top by the delta in px (relative to original position).
            const shiftMin = differenceInMinutes(clampedStart, originalStart);
            const shiftPx = (shiftMin / 60) * hourHeightRef.current;
            containerEl.current.style.height = `${Math.max(newHeight, hourHeightRef.current / 4)}px`;
            containerEl.current.style.transform = `translateY(${shiftPx}px)`;
          }
        }
      };

      const cleanup = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("keydown", onKey);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      const rollbackPreview = () => {
        if (!containerEl.current) return;
        containerEl.current.style.top = initialTop;
        containerEl.current.style.height = initialHeight;
        containerEl.current.style.transform = "";
      };

      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          cancelled = true;
          rollbackPreview();
          cleanup();
        }
      };

      const onUp = (ev: PointerEvent) => {
        cleanup();
        if (cancelled) return;
        if (!dragged) {
          rollbackPreview();
          return;
        }

        const deltaY = ev.clientY - startY;
        const pxPerMin = hourHeightRef.current / 60;
        const deltaMin = Math.round(deltaY / pxPerMin / 15) * 15;

        if (edge === "bottom") {
          const newEnd = addMinutes(originalEnd, deltaMin);
          const minEnd = addMinutes(originalStart, 15);
          const clampedEnd = newEnd < minEnd ? minEnd : newEnd;
          onResizeCommitRef.current({
            event: eventRef.current,
            newEndTime: clampedEnd,
          });
        } else {
          const newStart = addMinutes(originalStart, deltaMin);
          const maxStart = addMinutes(originalEnd, -15);
          const clampedStart = newStart > maxStart ? maxStart : newStart;
          // Clear transform so the parent re-render positions the card
          // correctly via its style.top.
          if (containerEl.current) containerEl.current.style.transform = "";
          onResizeCommitRef.current({
            event: eventRef.current,
            newStartTime: clampedStart,
          });
        }
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("keydown", onKey);
    },
    [containerEl, edge],
  );

  const position = edge === "bottom" ? "bottom-0" : "top-0";
  const rounded = edge === "bottom" ? "rounded-b" : "rounded-t";

  return (
    <div
      data-testid={edge === "bottom" ? "event-resize-handle" : "event-resize-handle-top"}
      data-no-dnd="true"
      className={`absolute ${position} left-0 right-0 h-2 cursor-ns-resize z-30 ${rounded} group/resize`}
      onPointerDown={handlePointerDown}
      // Click on the thin zone should never select/open the event.
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      title={edge === "bottom" ? "Glisser pour redimensionner" : "Glisser pour changer l'heure de début"}
    >
      {/* Subtle visual affordance — line brightens on hover */}
      <div
        className={`absolute left-0 right-0 ${edge === "bottom" ? "bottom-0" : "top-0"} h-[3px] bg-primary/0 group-hover/resize:bg-primary/60 transition-colors`}
      />
    </div>
  );
}

/**
 * Hook that wires a ResizeResult into the `updateEvent` repo call,
 * preserving `start_time` when resizing from the bottom and `end_time`
 * when resizing from the top so the backend PATCH stays consistent.
 */
export function useEventResize(
  updateEvent: (
    id: string,
    data: { start_time?: string; end_time?: string },
  ) => Promise<Event>,
) {
  const handleResizeCommit = useCallback(
    async ({ event, newStartTime, newEndTime }: ResizeResult) => {
      try {
        if (newEndTime && !newStartTime) {
          await updateEvent(event.id, {
            start_time: event.start_time,
            end_time: newEndTime.toISOString(),
          });
        } else if (newStartTime && !newEndTime) {
          await updateEvent(event.id, {
            start_time: newStartTime.toISOString(),
            end_time: event.end_time,
          });
        }
      } catch {
        // Revert handled by parent re-render on next refetch.
      }
    },
    [updateEvent],
  );

  return { handleResizeCommit };
}
