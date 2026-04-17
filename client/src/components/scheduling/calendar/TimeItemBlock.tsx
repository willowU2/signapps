"use client";

/**
 * TimeItemBlock Component
 * Story 1.2.4: TimeItem Display Component
 *
 * Visual representation of a TimeItem (task, event, booking, etc.) in calendar views.
 * Supports different display modes, types, colors, and interactions.
 */

import * as React from "react";
import { format, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import {
  MapPin,
  Users,
  Video,
  Clock,
  CheckCircle2,
  AlertCircle,
  Repeat,
  CheckSquare,
  Calendar,
  Clock3,
  Flag,
  Bell,
  Ban,
  Target,
  Zap,
  Battery,
  BatteryLow,
  BatteryMedium,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSchedulingStore } from "@/stores/scheduling/scheduling-store";
import type {
  TimeItem,
  TimeItemType,
  Priority,
  Status,
  EnergyRequired,
  FocusLevel,
} from "@/lib/scheduling/types";
import { PRIORITY_COLORS, TIME_ITEM_TYPE_ICONS } from "@/lib/scheduling/types";

// ============================================================================
// Types
// ============================================================================

interface TimeItemBlockProps {
  item: TimeItem;
  top?: number;
  height?: number;
  left?: number;
  width?: number;
  className?: string;
  compact?: boolean;
  onClick?: (item: TimeItem) => void;
  onDoubleClick?: (item: TimeItem) => void;
  onContextMenu?: (item: TimeItem, e: React.MouseEvent) => void;
}

type DisplayMode = "full" | "compact" | "minimal" | "dot";

// ============================================================================
// Helpers
// ============================================================================

function getDisplayMode(height: number): DisplayMode {
  if (height < 20) return "dot";
  if (height < 32) return "minimal";
  if (height < 56) return "compact";
  return "full";
}

function getTypeIcon(type: TimeItemType): React.ElementType {
  const iconMap: Record<TimeItemType, React.ElementType> = {
    task: CheckSquare,
    event: Calendar,
    booking: Clock3,
    shift: Users,
    milestone: Flag,
    reminder: Bell,
    blocker: Ban,
  };
  return iconMap[type] || Calendar;
}

function getItemColor(item: TimeItem): {
  bg: string;
  border: string;
  text: string;
} {
  // Use custom color if provided
  if (item.color) {
    return {
      bg: `${item.color}15`,
      border: item.color,
      text: item.color,
    };
  }

  // Type-based colors
  const typeColors: Record<TimeItemType, string> = {
    task: "#3b82f6", // blue
    event: "#8b5cf6", // purple
    booking: "#06b6d4", // cyan
    shift: "#f59e0b", // amber
    milestone: "#10b981", // emerald
    reminder: "#f97316", // orange
    blocker: "#ef4444", // red
  };

  const color = typeColors[item.type] || "#3b82f6";

  return {
    bg: `${color}15`,
    border: color,
    text: color,
  };
}

function getPriorityIndicator(priority: Priority): React.ReactNode {
  const colors: Record<Priority, string> = {
    low: "text-slate-400",
    medium: "text-blue-500",
    high: "text-orange-500",
    urgent: "text-red-500",
  };

  return <Flag className={cn("h-3 w-3", colors[priority])} />;
}

function getStatusIcon(status: Status): React.ReactNode {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case "in_progress":
      return <Clock className="h-3 w-3 text-blue-500" />;
    case "cancelled":
      return <Ban className="h-3 w-3 text-red-500" />;
    default:
      return null;
  }
}

function getEnergyIcon(energy: EnergyRequired): React.ReactNode {
  switch (energy) {
    case "high":
      return <Battery className="h-3 w-3 text-green-500" />;
    case "medium":
      return <BatteryMedium className="h-3 w-3 text-yellow-500" />;
    case "low":
      return <BatteryLow className="h-3 w-3 text-red-500" />;
    default:
      return null;
  }
}

function getFocusIcon(focus: FocusLevel): React.ReactNode {
  if (focus === "deep") {
    return <Target className="h-3 w-3 text-purple-500" />;
  }
  return null;
}

// ============================================================================
// Sub-components
// ============================================================================

function ItemTitle({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return <span className={cn("font-medium truncate", className)}>{title}</span>;
}

function ItemTime({
  start,
  end,
  className,
}: {
  start?: string;
  end?: string;
  className?: string;
}) {
  if (!start) return null;

  const startDate = new Date(start);
  const startStr = format(startDate, "HH:mm", { locale: fr });
  const endStr = end ? format(new Date(end), "HH:mm", { locale: fr }) : null;

  return (
    <span className={cn("text-muted-foreground", className)}>
      {startStr}
      {endStr && ` - ${endStr}`}
    </span>
  );
}

function ItemIndicators({
  item,
  className,
}: {
  item: TimeItem;
  className?: string;
}) {
  const hasLocation = item.location;
  const isRecurring = item.recurrence;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {item.focusLevel && getFocusIcon(item.focusLevel)}
      {item.energyRequired && getEnergyIcon(item.energyRequired)}
      {isRecurring && <Repeat className="h-3 w-3" />}
      {hasLocation && <MapPin className="h-3 w-3" />}
      {item.users.length > 0 && <Users className="h-3 w-3" />}
      {item.priority !== "medium" && getPriorityIndicator(item.priority)}
      {getStatusIcon(item.status)}
    </div>
  );
}

// ============================================================================
// Display Mode Components
// ============================================================================

function DotDisplay({ item }: { item: TimeItem }) {
  const colors = getItemColor(item);

  return (
    <div
      className="w-2 h-2 rounded-full"
      style={{ backgroundColor: colors.border }}
      title={item.title}
    />
  );
}

function MinimalDisplay({ item }: { item: TimeItem }) {
  const TypeIcon = getTypeIcon(item.type);

  return (
    <div className="flex items-center gap-1 overflow-hidden">
      <TypeIcon className="h-3 w-3 shrink-0" />
      <ItemTitle title={item.title} className="text-xs" />
    </div>
  );
}

function CompactDisplay({ item }: { item: TimeItem }) {
  const TypeIcon = getTypeIcon(item.type);

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex items-center gap-1">
        <TypeIcon className="h-3 w-3 shrink-0" />
        <ItemTitle title={item.title} className="text-xs" />
      </div>
      <ItemTime
        start={item.startTime}
        end={item.endTime}
        className="text-[10px]"
      />
    </div>
  );
}

function FullDisplay({ item }: { item: TimeItem }) {
  const TypeIcon = getTypeIcon(item.type);
  const duration =
    item.duration ||
    (item.startTime && item.endTime
      ? differenceInMinutes(new Date(item.endTime), new Date(item.startTime))
      : 60);

  const locationText =
    typeof item.location === "string" ? item.location : item.location?.value;

  return (
    <div className="flex flex-col gap-0.5 overflow-hidden">
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <TypeIcon className="h-3 w-3 shrink-0" />
          <ItemTitle title={item.title} className="text-xs" />
        </div>
        <ItemIndicators item={item} className="shrink-0" />
      </div>
      <ItemTime
        start={item.startTime}
        end={item.endTime}
        className="text-[10px]"
      />
      {locationText && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
          <MapPin className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{locationText}</span>
        </div>
      )}
      {item.estimatedPomodoros && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Zap className="h-2.5 w-2.5 shrink-0" />
          <span>
            {item.estimatedPomodoros} pomodoro
            {item.estimatedPomodoros > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TimeItemBlock({
  item,
  top = 0,
  height = 60,
  left = 0,
  width = 100,
  className,
  compact = false,
  onClick,
  onDoubleClick,
  onContextMenu,
}: TimeItemBlockProps) {
  const selectedItem = useSchedulingStore((state) => state.selectedItem);
  const selectItem = useSchedulingStore((state) => state.selectItem);

  const colors = getItemColor(item);
  const displayMode = compact ? "compact" : getDisplayMode(height);
  const isSelected = selectedItem?.id === item.id;
  const isCancelled = item.status === "cancelled";
  const isDone = item.status === "done";

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      selectItem(item);
      onClick?.(item);
    },
    [item, selectItem, onClick],
  );

  const handleDoubleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDoubleClick?.(item);
    },
    [item, onDoubleClick],
  );

  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu?.(item, e);
    },
    [item, onContextMenu],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectItem(item);
        onClick?.(item);
      }
    },
    [item, selectItem, onClick],
  );

  const startTimeFormatted = item.startTime
    ? format(new Date(item.startTime), "EEEE d MMMM à HH:mm", { locale: fr })
    : "Non planifié";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "absolute cursor-pointer overflow-hidden rounded-md",
        "transition-shadow duration-150",
        "hover:shadow-md hover:z-10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        isSelected && "ring-2 ring-primary ring-offset-1 z-20",
        isCancelled && "opacity-50",
        isDone && "opacity-75",
        className,
      )}
      style={{
        top,
        height,
        left: `${left}%`,
        width: `${width}%`,
        backgroundColor: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${item.title} - ${startTimeFormatted}`}
      aria-pressed={isSelected}
    >
      <div
        className={cn(
          "h-full p-1.5",
          displayMode === "dot" && "flex items-center justify-center p-0",
          isCancelled && "line-through",
          isDone && "line-through opacity-75",
        )}
        style={{ color: colors.text }}
      >
        {displayMode === "dot" && <DotDisplay item={item} />}
        {displayMode === "minimal" && <MinimalDisplay item={item} />}
        {displayMode === "compact" && <CompactDisplay item={item} />}
        {displayMode === "full" && <FullDisplay item={item} />}
      </div>
    </motion.div>
  );
}

// ============================================================================
// All-Day Item Block
// ============================================================================

export function AllDayItemBlock({
  item,
  className,
  onClick,
}: {
  item: TimeItem;
  className?: string;
  onClick?: (item: TimeItem) => void;
}) {
  const selectedItem = useSchedulingStore((state) => state.selectedItem);
  const selectItem = useSchedulingStore((state) => state.selectItem);

  const colors = getItemColor(item);
  const isSelected = selectedItem?.id === item.id;
  const TypeIcon = getTypeIcon(item.type);

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      selectItem(item);
      onClick?.(item);
    },
    [item, selectItem, onClick],
  );

  return (
    <button
      className={cn(
        "w-full text-left text-xs px-2 py-1 rounded truncate",
        "transition-all duration-150",
        "hover:opacity-90 hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected && "ring-2 ring-primary ring-offset-1",
        className,
      )}
      style={{
        backgroundColor: colors.border,
        color: "white",
      }}
      onClick={handleClick}
    >
      <div className="flex items-center gap-1">
        <TypeIcon className="h-3 w-3 shrink-0" />
        {item.recurrence && <Repeat className="h-3 w-3 shrink-0" />}
        <span className="truncate">{item.title}</span>
      </div>
    </button>
  );
}

// ============================================================================
// Item Preview (for hover/tooltip)
// ============================================================================

export function TimeItemPreview({
  item,
  className,
}: {
  item: TimeItem;
  className?: string;
}) {
  const colors = getItemColor(item);
  const TypeIcon = getTypeIcon(item.type);
  const duration =
    item.duration ||
    (item.startTime && item.endTime
      ? differenceInMinutes(new Date(item.endTime), new Date(item.startTime))
      : null);

  const locationText =
    typeof item.location === "string" ? item.location : item.location?.value;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 shadow-lg",
        "max-w-xs",
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="h-1 w-12 rounded-full"
          style={{ backgroundColor: colors.border }}
        />
        <TypeIcon className="h-4 w-4" style={{ color: colors.border }} />
      </div>

      <h4 className="font-semibold text-sm mb-2">{item.title}</h4>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        {item.startTime && (
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {format(new Date(item.startTime), "EEEE d MMMM", { locale: fr })}
              {!item.allDay && (
                <>
                  <br />
                  {format(new Date(item.startTime), "HH:mm", { locale: fr })}
                  {item.endTime &&
                    ` - ${format(new Date(item.endTime), "HH:mm", { locale: fr })}`}
                  {duration && <span className="ml-1">({duration} min)</span>}
                </>
              )}
            </span>
          </div>
        )}

        {locationText && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" />
            <span>{locationText}</span>
          </div>
        )}

        {item.users.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            <span>
              {item.users.length} participant{item.users.length > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {item.estimatedPomodoros && (
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" />
            <span>
              {item.estimatedPomodoros} pomodoro
              {item.estimatedPomodoros > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {item.description && (
          <p className="mt-2 text-xs border-t pt-2">{item.description}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Unscheduled Task Card (for sidebar/kanban)
// ============================================================================

export function UnscheduledTaskCard({
  item,
  className,
  onClick,
  onDragStart,
}: {
  item: TimeItem;
  className?: string;
  onClick?: (item: TimeItem) => void;
  onDragStart?: (item: TimeItem) => void;
}) {
  const colors = getItemColor(item);
  const TypeIcon = getTypeIcon(item.type);

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(item);
    },
    [item, onClick],
  );

  const handleDragStart = React.useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({
          type: "unscheduled-task",
          item,
        }),
      );
      e.dataTransfer.effectAllowed = "move";
      onDragStart?.(item);
    },
    [item, onDragStart],
  );

  return (
    <div
      draggable
      className={cn(
        "p-3 rounded-lg border bg-card cursor-grab",
        "transition-all duration-150",
        "hover:shadow-md hover:border-primary/50",
        "active:cursor-grabbing",
        className,
      )}
      style={{ borderLeftColor: colors.border, borderLeftWidth: "3px" }}
      onClick={handleClick}
      onDragStart={handleDragStart}
    >
      <div className="flex items-start gap-2">
        <TypeIcon
          className="h-4 w-4 shrink-0 mt-0.5"
          style={{ color: colors.border }}
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{item.title}</h4>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            {item.estimatedPomodoros && (
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {item.estimatedPomodoros}
              </span>
            )}
            {item.deadline && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(item.deadline), "d MMM", { locale: fr })}
              </span>
            )}
            {getPriorityIndicator(item.priority)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimeItemBlock;
