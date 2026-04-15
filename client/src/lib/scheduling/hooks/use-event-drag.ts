"use client";

/**
 * Event Drag & Drop Hooks
 *
 * Provides drag and drop functionality for calendar events.
 * Supports both moving and resizing events.
 */

import * as React from "react";
import {
  addMinutes,
  differenceInMinutes,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";
import type { ScheduleBlock } from "../types/scheduling";

// ============================================================================
// Types
// ============================================================================

export interface DragState {
  isDragging: boolean;
  eventId: string | null;
  type: "move" | "resize-top" | "resize-bottom" | null;
  startY: number;
  startX: number;
  initialEvent: ScheduleBlock | null;
  previewStart: Date | null;
  previewEnd: Date | null;
  targetDate: Date | null;
}

export interface DragHandlers {
  onDragStart: (
    event: ScheduleBlock,
    type: "move" | "resize-top" | "resize-bottom",
    e: React.MouseEvent | React.TouchEvent,
  ) => void;
  onDragMove: (e: MouseEvent | TouchEvent) => void;
  onDragEnd: () => void;
}

export interface UseEventDragOptions {
  slotHeight: number;
  slotDuration: number;
  workingHoursStart: number;
  workingHoursEnd: number;
  onEventMove?: (eventId: string, start: Date, end: Date) => void;
  snapToGrid?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getClientY(
  e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent,
): number {
  if ("touches" in e) {
    return e.touches[0]?.clientY ?? 0;
  }
  return e.clientY;
}

function getClientX(
  e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent,
): number {
  if ("touches" in e) {
    return e.touches[0]?.clientX ?? 0;
  }
  return e.clientX;
}

function snapToSlot(minutes: number, slotDuration: number): number {
  return Math.round(minutes / slotDuration) * slotDuration;
}

function minutesToDate(date: Date, minutes: number): Date {
  const result = startOfDay(date);
  result.setMinutes(minutes);
  return result;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useEventDrag(options: UseEventDragOptions) {
  const {
    slotHeight,
    slotDuration,
    workingHoursStart,
    workingHoursEnd,
    onEventMove,
    snapToGrid = true,
  } = options;

  const [dragState, setDragState] = React.useState<DragState>({
    isDragging: false,
    eventId: null,
    type: null,
    startY: 0,
    startX: 0,
    initialEvent: null,
    previewStart: null,
    previewEnd: null,
    targetDate: null,
  });

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Calculate pixels per minute based on slot height
  const pixelsPerMinute = slotHeight / slotDuration;

  // Convert Y position to minutes from start of day
  const yToMinutes = React.useCallback(
    (y: number): number => {
      if (!containerRef.current) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = y - rect.top + containerRef.current.scrollTop;
      const minutes = workingHoursStart * 60 + relativeY / pixelsPerMinute;
      return Math.max(
        workingHoursStart * 60,
        Math.min(workingHoursEnd * 60, minutes),
      );
    },
    [pixelsPerMinute, workingHoursStart, workingHoursEnd],
  );

  // Start dragging
  const onDragStart = React.useCallback(
    (
      event: ScheduleBlock,
      type: "move" | "resize-top" | "resize-bottom",
      e: React.MouseEvent | React.TouchEvent,
    ) => {
      e.preventDefault();
      e.stopPropagation();

      setDragState({
        isDragging: true,
        eventId: event.id,
        type,
        startY: getClientY(e),
        startX: getClientX(e),
        initialEvent: event,
        previewStart: event.start,
        previewEnd: event.end ?? addMinutes(event.start, 60),
        targetDate: event.start,
      });
    },
    [],
  );

  // Handle drag movement
  const onDragMove = React.useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!dragState.isDragging || !dragState.initialEvent) return;

      const currentY = getClientY(e);
      const deltaY = currentY - dragState.startY;
      const deltaMinutes = deltaY / pixelsPerMinute;

      const initialStart = dragState.initialEvent.start;
      const initialEnd =
        dragState.initialEvent.end ?? addMinutes(initialStart, 60);
      const duration = differenceInMinutes(initialEnd, initialStart);

      let newStart: Date;
      let newEnd: Date;

      switch (dragState.type) {
        case "move": {
          // Move the entire event
          let newStartMinutes =
            initialStart.getHours() * 60 +
            initialStart.getMinutes() +
            deltaMinutes;

          if (snapToGrid) {
            newStartMinutes = snapToSlot(newStartMinutes, slotDuration);
          }

          // Clamp to working hours
          newStartMinutes = Math.max(
            workingHoursStart * 60,
            Math.min(workingHoursEnd * 60 - duration, newStartMinutes),
          );

          newStart = new Date(initialStart);
          newStart.setHours(0, 0, 0, 0);
          newStart.setMinutes(newStartMinutes);
          newEnd = addMinutes(newStart, duration);
          break;
        }

        case "resize-top": {
          // Resize from the top (change start time)
          let newStartMinutes =
            initialStart.getHours() * 60 +
            initialStart.getMinutes() +
            deltaMinutes;

          if (snapToGrid) {
            newStartMinutes = snapToSlot(newStartMinutes, slotDuration);
          }

          // Ensure minimum duration and clamp to working hours
          const maxStartMinutes =
            initialEnd.getHours() * 60 + initialEnd.getMinutes() - slotDuration;
          newStartMinutes = Math.max(
            workingHoursStart * 60,
            Math.min(maxStartMinutes, newStartMinutes),
          );

          newStart = new Date(initialStart);
          newStart.setHours(0, 0, 0, 0);
          newStart.setMinutes(newStartMinutes);
          newEnd = initialEnd;
          break;
        }

        case "resize-bottom": {
          // Resize from the bottom (change end time)
          let newEndMinutes =
            initialEnd.getHours() * 60 + initialEnd.getMinutes() + deltaMinutes;

          if (snapToGrid) {
            newEndMinutes = snapToSlot(newEndMinutes, slotDuration);
          }

          // Ensure minimum duration and clamp to working hours
          const minEndMinutes =
            initialStart.getHours() * 60 +
            initialStart.getMinutes() +
            slotDuration;
          newEndMinutes = Math.max(
            minEndMinutes,
            Math.min(workingHoursEnd * 60, newEndMinutes),
          );

          newStart = initialStart;
          newEnd = new Date(initialEnd);
          newEnd.setHours(0, 0, 0, 0);
          newEnd.setMinutes(newEndMinutes);
          break;
        }

        default:
          return;
      }

      setDragState((prev) => ({
        ...prev,
        previewStart: newStart,
        previewEnd: newEnd,
      }));
    },
    [
      dragState.isDragging,
      dragState.initialEvent,
      dragState.startY,
      dragState.type,
      pixelsPerMinute,
      slotDuration,
      snapToGrid,
      workingHoursStart,
      workingHoursEnd,
    ],
  );

  // End dragging
  const onDragEnd = React.useCallback(() => {
    if (
      dragState.isDragging &&
      dragState.eventId &&
      dragState.previewStart &&
      dragState.previewEnd
    ) {
      // Only trigger if position changed
      const initialStart = dragState.initialEvent?.start;
      const initialEnd = dragState.initialEvent?.end;

      const startChanged =
        initialStart?.getTime() !== dragState.previewStart.getTime();
      const endChanged =
        initialEnd?.getTime() !== dragState.previewEnd.getTime();

      if (startChanged || endChanged) {
        onEventMove?.(
          dragState.eventId,
          dragState.previewStart,
          dragState.previewEnd,
        );
      }
    }

    setDragState({
      isDragging: false,
      eventId: null,
      type: null,
      startY: 0,
      startX: 0,
      initialEvent: null,
      previewStart: null,
      previewEnd: null,
      targetDate: null,
    });
  }, [dragState, onEventMove]);

  // Set up global event listeners
  React.useEffect(() => {
    if (dragState.isDragging) {
      const handleMove = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        onDragMove(e);
      };

      const handleEnd = () => {
        onDragEnd();
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleMove, { passive: false });
      window.addEventListener("touchend", handleEnd);

      // Prevent text selection during drag
      document.body.style.userSelect = "none";
      document.body.style.cursor =
        dragState.type === "move" ? "grabbing" : "ns-resize";

      return () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleEnd);
        window.removeEventListener("touchmove", handleMove);
        window.removeEventListener("touchend", handleEnd);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
    }
  }, [dragState.isDragging, dragState.type, onDragMove, onDragEnd]);

  return {
    dragState,
    containerRef,
    handlers: {
      onDragStart,
      onDragMove,
      onDragEnd,
    },
  };
}

// ============================================================================
// Preview Hook
// ============================================================================

export function useDragPreview(
  dragState: DragState,
  slotHeight: number,
  slotDuration: number,
  workingHoursStart: number,
) {
  return React.useMemo(() => {
    if (
      !dragState.isDragging ||
      !dragState.previewStart ||
      !dragState.previewEnd
    ) {
      return null;
    }

    const startMinutes =
      dragState.previewStart.getHours() * 60 +
      dragState.previewStart.getMinutes();
    const endMinutes =
      dragState.previewEnd.getHours() * 60 + dragState.previewEnd.getMinutes();

    const pixelsPerMinute = slotHeight / slotDuration;
    const top = (startMinutes - workingHoursStart * 60) * pixelsPerMinute;
    const height = (endMinutes - startMinutes) * pixelsPerMinute;

    return {
      top,
      height,
      start: dragState.previewStart,
      end: dragState.previewEnd,
    };
  }, [
    dragState.isDragging,
    dragState.previewStart,
    dragState.previewEnd,
    slotHeight,
    slotDuration,
    workingHoursStart,
  ]);
}
