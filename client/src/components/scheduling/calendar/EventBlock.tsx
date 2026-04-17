"use client";

/**
 * EventBlock Component
 *
 * Visual representation of a calendar event.
 * Supports different display modes, colors, and interactions.
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
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSchedulingSelection } from "@/stores/scheduling-store";
import type {
  ScheduleBlock,
  EventLayout,
} from "@/lib/scheduling/types/scheduling";

// ============================================================================
// Types
// ============================================================================

interface EventBlockProps {
  layout: EventLayout;
  className?: string;
  compact?: boolean;
  onClick?: (event: ScheduleBlock) => void;
  onDoubleClick?: (event: ScheduleBlock) => void;
  onContextMenu?: (event: ScheduleBlock, e: React.MouseEvent) => void;
}

type EventDisplayMode = "full" | "compact" | "minimal" | "dot";

// ============================================================================
// Helpers
// ============================================================================

function getDisplayMode(height: number): EventDisplayMode {
  if (height < 20) return "dot";
  if (height < 32) return "minimal";
  if (height < 56) return "compact";
  return "full";
}

function getEventColor(event: ScheduleBlock): {
  bg: string;
  border: string;
  text: string;
} {
  const color = event.color || "#3b82f6"; // Default blue

  return {
    bg: `${color}15`, // 15% opacity
    border: color,
    text: color,
  };
}

function getStatusIcon(status: ScheduleBlock["status"]) {
  switch (status) {
    case "confirmed":
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case "tentative":
      return <AlertCircle className="h-3 w-3 text-yellow-500" />;
    case "cancelled":
      return <AlertCircle className="h-3 w-3 text-red-500 line-through" />;
    default:
      return null;
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function EventTitle({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return <span className={cn("font-medium truncate", className)}>{title}</span>;
}

function EventTime({
  start,
  end,
  className,
}: {
  start: Date;
  end?: Date;
  className?: string;
}) {
  const startStr = format(start, "HH:mm", { locale: fr });
  const endStr = end ? format(end, "HH:mm", { locale: fr }) : null;

  return (
    <span className={cn("text-muted-foreground", className)}>
      {startStr}
      {endStr && ` - ${endStr}`}
    </span>
  );
}

function EventIndicators({
  event,
  className,
}: {
  event: ScheduleBlock;
  className?: string;
}) {
  const hasLocation = Boolean(event.metadata?.location);
  const hasVideo = Boolean(event.metadata?.videoConference);
  const hasAttendees = event.attendees && event.attendees.length > 0;
  const isRecurring = event.recurrence;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {isRecurring && <Repeat className="h-3 w-3" />}
      {hasLocation && <MapPin className="h-3 w-3" />}
      {hasVideo && <Video className="h-3 w-3" />}
      {hasAttendees && <Users className="h-3 w-3" />}
      {getStatusIcon(event.status)}
    </div>
  );
}

// ============================================================================
// Display Mode Components
// ============================================================================

function DotDisplay({ event }: { event: ScheduleBlock }) {
  const colors = getEventColor(event);

  return (
    <div
      className="w-2 h-2 rounded-full"
      style={{ backgroundColor: colors.border }}
      title={event.title}
    />
  );
}

function MinimalDisplay({ event }: { event: ScheduleBlock }) {
  return (
    <div className="flex items-center gap-1 overflow-hidden">
      <EventTitle title={event.title} className="text-xs" />
    </div>
  );
}

function CompactDisplay({ event }: { event: ScheduleBlock }) {
  return (
    <div className="flex flex-col overflow-hidden">
      <EventTitle title={event.title} className="text-xs" />
      <EventTime start={event.start} end={event.end} className="text-[10px]" />
    </div>
  );
}

function FullDisplay({ event }: { event: ScheduleBlock }) {
  const duration = event.end ? differenceInMinutes(event.end, event.start) : 60;

  return (
    <div className="flex flex-col gap-0.5 overflow-hidden">
      <div className="flex items-start justify-between gap-1">
        <EventTitle title={event.title} className="text-xs" />
        <EventIndicators event={event} className="shrink-0" />
      </div>
      <EventTime start={event.start} end={event.end} className="text-[10px]" />
      {Boolean(event.metadata?.location) && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
          <MapPin className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{String(event.metadata?.location)}</span>
        </div>
      )}
      {event.attendees && event.attendees.length > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Users className="h-2.5 w-2.5 shrink-0" />
          <span>
            {event.attendees.length} participant
            {event.attendees.length > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EventBlock({
  layout,
  className,
  compact = false,
  onClick,
  onDoubleClick,
  onContextMenu,
}: EventBlockProps) {
  const { selectedBlockId, selectBlock } = useSchedulingSelection();
  const { block: event, top, height, left, width } = layout;

  const colors = getEventColor(event);
  const displayMode = compact ? "compact" : getDisplayMode(height);
  const isSelected = selectedBlockId === event.id;
  const isCancelled = event.status === "cancelled";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectBlock(event.id);
    onClick?.(event);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(event);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(event, e);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(e as unknown as React.MouseEvent);
    }
  };

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
      aria-label={`${event.title} - ${format(event.start, "EEEE d MMMM à HH:mm", { locale: fr })}`}
      aria-pressed={isSelected}
    >
      <div
        className={cn(
          "h-full p-1.5",
          displayMode === "dot" && "flex items-center justify-center p-0",
          isCancelled && "line-through",
        )}
        style={{ color: colors.text }}
      >
        {displayMode === "dot" && <DotDisplay event={event} />}
        {displayMode === "minimal" && <MinimalDisplay event={event} />}
        {displayMode === "compact" && <CompactDisplay event={event} />}
        {displayMode === "full" && <FullDisplay event={event} />}
      </div>
    </motion.div>
  );
}

// ============================================================================
// All-Day Event Block
// ============================================================================

export function AllDayEventBlock({
  event,
  className,
  onClick,
}: {
  event: ScheduleBlock;
  className?: string;
  onClick?: (event: ScheduleBlock) => void;
}) {
  const { selectedBlockId, selectBlock } = useSchedulingSelection();
  const colors = getEventColor(event);
  const isSelected = selectedBlockId === event.id;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectBlock(event.id);
    onClick?.(event);
  };

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
        {event.recurrence && <Repeat className="h-3 w-3 shrink-0" />}
        <span className="truncate">{event.title}</span>
      </div>
    </button>
  );
}

// ============================================================================
// Event Preview (for hover/tooltip)
// ============================================================================

export function EventPreview({
  event,
  className,
}: {
  event: ScheduleBlock;
  className?: string;
}) {
  const colors = getEventColor(event);
  const duration = event.end ? differenceInMinutes(event.end, event.start) : 60;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 shadow-lg",
        "max-w-xs",
        className,
      )}
    >
      <div
        className="mb-2 h-1 w-12 rounded-full"
        style={{ backgroundColor: colors.border }}
      />

      <h4 className="font-semibold text-sm mb-2">{event.title}</h4>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          <span>
            {format(event.start, "EEEE d MMMM", { locale: fr })}
            {!event.allDay && (
              <>
                <br />
                {format(event.start, "HH:mm", { locale: fr })}
                {event.end &&
                  ` - ${format(event.end, "HH:mm", { locale: fr })}`}
                <span className="ml-1">({duration} min)</span>
              </>
            )}
          </span>
        </div>

        {Boolean(event.metadata?.location) && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" />
            <span>{String(event.metadata?.location)}</span>
          </div>
        )}

        {event.attendees && event.attendees.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            <span>{event.attendees.map((a) => a.name).join(", ")}</span>
          </div>
        )}

        {event.description && (
          <p className="mt-2 text-xs border-t pt-2">{event.description}</p>
        )}
      </div>
    </div>
  );
}

export default EventBlock;
