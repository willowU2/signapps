"use client";

/**
 * DayColumn Component
 * Story 1.3.2: DayColumn Component
 *
 * Single day column for the calendar grid.
 * Handles TimeItem placement, drag/drop zones, and click interactions.
 */

import * as React from "react";
import {
  format,
  isToday,
  isSameDay,
  setHours,
  setMinutes,
  parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCalendarStore } from "@/stores/scheduling/calendar-store";
import { useSchedulingStore } from "@/stores/scheduling/scheduling-store";
import { TimeItemBlock } from "./TimeItemBlock";
import type { TimeItem, PositionedItem } from "@/lib/scheduling/types";
import { calculateItemPositions } from "@/lib/scheduling/utils/overlap-calculator";

// ============================================================================
// Types
// ============================================================================

interface DayColumnProps {
  date: Date;
  items: TimeItem[];
  positions?: PositionedItem[];
  slotHeight?: number;
  className?: string;
  onSlotClick?: (date: Date, hour: number, minute: number) => void;
  onItemClick?: (item: TimeItem) => void;
  onItemDoubleClick?: (item: TimeItem) => void;
  renderItem?: (item: TimeItem, position: PositionedItem) => React.ReactNode;
}

interface TimeSlotProps {
  date: Date;
  hour: number;
  minute: number;
  height: number;
  isWorkingHour: boolean;
  onClick?: () => void;
}

// ============================================================================
// TimeSlot Component
// ============================================================================

function TimeSlot({
  date,
  hour,
  minute,
  height,
  isWorkingHour,
  onClick,
}: TimeSlotProps) {
  const isCurrentHour = new Date().getHours() === hour && isToday(date);
  const isHalfHour = minute === 30;

  return (
    <div
      className={cn(
        "relative border-b border-border/50 transition-colors",
        isWorkingHour ? "bg-background" : "bg-muted/30",
        isHalfHour && "border-dashed",
        "hover:bg-accent/30 cursor-pointer",
        isCurrentHour && "bg-primary/5",
      )}
      style={{ height }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${format(setMinutes(setHours(date, hour), minute), "EEEE d MMMM, HH:mm", { locale: fr })}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    />
  );
}

// ============================================================================
// CurrentTimeIndicator Component
// ============================================================================

function CurrentTimeIndicator({
  slotHeight,
  slotDuration,
  workingHoursStart,
}: {
  slotHeight: number;
  slotDuration: number;
  workingHoursStart: number;
}) {
  const [position, setPosition] = React.useState<number | null>(null);

  React.useEffect(() => {
    const updatePosition = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Calculate position relative to working hours start
      const minutesFromStart =
        (currentHour - workingHoursStart) * 60 + currentMinute;
      const pixelsPerMinute = slotHeight / slotDuration;

      setPosition(minutesFromStart * pixelsPerMinute);
    };

    updatePosition();
    const interval = setInterval(updatePosition, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [slotHeight, slotDuration, workingHoursStart]);

  if (position === null || position < 0) return null;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: position }}
    >
      <div className="relative flex items-center">
        <div className="h-3 w-3 rounded-full bg-red-500 -ml-1.5" />
        <div className="flex-1 h-0.5 bg-red-500" />
      </div>
    </div>
  );
}

// ============================================================================
// DayHeader Component
// ============================================================================

export function DayHeader({
  date,
  className,
  compact = false,
}: {
  date: Date;
  className?: string;
  compact?: boolean;
}) {
  const today = isToday(date);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-2 border-b",
        today && "bg-primary/5",
        className,
      )}
    >
      <span
        className={cn(
          "text-xs uppercase tracking-wider",
          today ? "text-primary font-medium" : "text-muted-foreground",
        )}
      >
        {format(date, compact ? "EEE" : "EEEE", { locale: fr })}
      </span>
      <span
        className={cn(
          "text-2xl font-bold",
          today
            ? "bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center"
            : "text-foreground",
        )}
      >
        {format(date, "d")}
      </span>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getItemDate(item: TimeItem): Date | null {
  if (!item.startTime) return null;
  return typeof item.startTime === "string"
    ? parseISO(item.startTime)
    : item.startTime;
}

// ============================================================================
// Main Component
// ============================================================================

export function DayColumn({
  date,
  items,
  positions = [],
  slotHeight = 48,
  className,
  onSlotClick,
  onItemClick,
  onItemDoubleClick,
  renderItem,
}: DayColumnProps) {
  const hourStart = useCalendarStore((state) => state.hourStart);
  const hourEnd = useCalendarStore((state) => state.hourEnd);
  const slotDuration = useCalendarStore((state) => state.slotDuration);
  const selectedItem = useSchedulingStore((state) => state.selectedItem);
  const selectItem = useSchedulingStore((state) => state.selectItem);

  // Generate time slots
  const slots = React.useMemo(() => {
    const result: { hour: number; minute: number }[] = [];
    const slotsPerHour = 60 / slotDuration;

    for (let hour = hourStart; hour <= hourEnd; hour++) {
      for (let slotIndex = 0; slotIndex < slotsPerHour; slotIndex++) {
        const minute = slotIndex * slotDuration;
        result.push({ hour, minute });
      }
    }

    return result;
  }, [hourStart, hourEnd, slotDuration]);

  // Filter items for this day (excluding all-day items)
  const dayItems = React.useMemo(() => {
    return items.filter((item) => {
      if (item.allDay) return false;
      const itemDate = getItemDate(item);
      return itemDate && isSameDay(itemDate, date);
    });
  }, [items, date]);

  // Calculate positions using overlap calculator
  const itemPositions = React.useMemo(() => {
    if (positions.length > 0) {
      // Filter provided positions for this day
      return positions.filter((pos) => {
        const itemDate = getItemDate(pos.item);
        return itemDate && isSameDay(itemDate, date);
      });
    }

    // Calculate positions with overlap handling
    const calculatedPositions = calculateItemPositions(
      dayItems,
      hourStart,
      hourEnd,
    );

    // Convert percentage-based positions to pixel-based
    const totalHeight = slots.length * slotHeight;
    return calculatedPositions.map((pos) => ({
      ...pos,
      top: (pos.top / 100) * totalHeight,
      height: Math.max((pos.height / 100) * totalHeight, 20),
    }));
  }, [positions, dayItems, date, hourStart, hourEnd, slots.length, slotHeight]);

  const handleSlotClick = React.useCallback(
    (hour: number, minute: number) => {
      onSlotClick?.(date, hour, minute);
    },
    [date, onSlotClick],
  );

  const handleItemClick = React.useCallback(
    (item: TimeItem) => {
      selectItem(item);
      onItemClick?.(item);
    },
    [selectItem, onItemClick],
  );

  const handleItemDoubleClick = React.useCallback(
    (item: TimeItem) => {
      onItemDoubleClick?.(item);
    },
    [onItemDoubleClick],
  );

  return (
    <div className={cn("relative flex-1 border-r last:border-r-0", className)}>
      {/* Time Slots */}
      <div className="relative">
        {slots.map((slot) => (
          <TimeSlot
            key={`${slot.hour}-${slot.minute}`}
            date={date}
            hour={slot.hour}
            minute={slot.minute}
            height={slotHeight}
            isWorkingHour={slot.hour >= hourStart && slot.hour < hourEnd}
            onClick={() => handleSlotClick(slot.hour, slot.minute)}
          />
        ))}

        {/* Current Time Indicator moved to TimeGrid */}

        {/* TimeItems */}
        {itemPositions.map((position) => {
          if (renderItem) {
            return (
              <div key={position.item.id}>
                {renderItem(position.item, position)}
              </div>
            );
          }

          return (
            <TimeItemBlock
              key={position.item.id}
              item={position.item}
              top={position.top}
              height={position.height}
              left={position.left}
              width={position.width}
              onClick={handleItemClick}
              onDoubleClick={handleItemDoubleClick}
            />
          );
        })}
      </div>
    </div>
  );
}

export default DayColumn;
