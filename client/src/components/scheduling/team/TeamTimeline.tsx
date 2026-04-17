"use client";

/**
 * TeamTimeline Component
 *
 * Displays team member availability in a horizontal timeline view.
 * Great for finding common free slots.
 */

import * as React from "react";
import {
  format,
  startOfDay,
  addHours,
  eachHourOfInterval,
  isSameHour,
  isWithinInterval,
  differenceInMinutes,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  TeamMember,
  AvailabilitySlot,
  ScheduleBlock,
} from "@/lib/scheduling/types/scheduling";

// ============================================================================
// Types
// ============================================================================

interface TeamTimelineProps {
  members: TeamMember[];
  slots: AvailabilitySlot[];
  events: ScheduleBlock[];
  date: Date;
  onDateChange: (date: Date) => void;
  onSlotClick?: (member: TeamMember, time: Date) => void;
  startHour?: number;
  endHour?: number;
  className?: string;
}

// ============================================================================
// Status Colors
// ============================================================================

const statusColors: Record<AvailabilitySlot["status"], string> = {
  available: "bg-green-200",
  busy: "bg-red-200",
  tentative: "bg-amber-200",
  "out-of-office": "bg-slate-200",
};

// ============================================================================
// Get Initials
// ============================================================================

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// Time Slot Component
// ============================================================================

function TimeSlot({
  member,
  hour,
  slot,
  event,
  onClick,
}: {
  member: TeamMember;
  hour: Date;
  slot?: AvailabilitySlot;
  event?: ScheduleBlock;
  onClick?: () => void;
}) {
  const status = slot?.status ?? "available";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "h-10 min-w-[60px] border-r border-border/50 cursor-pointer transition-colors",
              "hover:brightness-95",
              event ? "bg-primary/20" : statusColors[status],
            )}
            onClick={onClick}
          >
            {event && (
              <div className="h-full px-1 flex items-center">
                <span className="text-[10px] text-primary font-medium truncate">
                  {event.title}
                </span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p className="font-medium">{member.name}</p>
            <p className="text-muted-foreground">
              {format(hour, "HH:mm", { locale: fr })}
            </p>
            {event && <p className="text-primary mt-1">{event.title}</p>}
            {!event && (
              <p
                className={cn(
                  "mt-1",
                  status === "available" ? "text-green-600" : "text-red-600",
                )}
              >
                {status === "available"
                  ? "Disponible"
                  : status === "busy"
                    ? "Occupé"
                    : status === "tentative"
                      ? "Peut-être"
                      : "Absent"}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TeamTimeline({
  members,
  slots,
  events,
  date,
  onDateChange,
  onSlotClick,
  startHour = 8,
  endHour = 19,
  className,
}: TeamTimelineProps) {
  const dayStart = startOfDay(date);
  const hours = eachHourOfInterval({
    start: addHours(dayStart, startHour),
    end: addHours(dayStart, endHour),
  });

  const goToPreviousDay = () => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  // Get slot for a member at a specific hour
  const getSlotForMemberAtHour = (
    memberId: string,
    hour: Date,
  ): AvailabilitySlot | undefined => {
    return slots.find(
      (s) =>
        s.memberId === memberId &&
        isWithinInterval(hour, {
          start: new Date(s.start),
          end: new Date(s.end),
        }),
    );
  };

  // Get event for a member at a specific hour
  const getEventForMemberAtHour = (
    memberId: string,
    hour: Date,
  ): ScheduleBlock | undefined => {
    return events.find((e) => {
      const attendeeIds = e.attendees?.map((a) => a.id) ?? [];
      if (!attendeeIds.includes(memberId)) return false;
      const eventStart = new Date(e.start);
      const eventEnd = e.end ? new Date(e.end) : addHours(eventStart, 1);
      return isWithinInterval(hour, { start: eventStart, end: eventEnd });
    });
  };

  // Find common available slots
  const commonAvailableHours = React.useMemo(() => {
    return hours.filter((hour) => {
      return members.every((member) => {
        const slot = getSlotForMemberAtHour(member.id, hour);
        const event = getEventForMemberAtHour(member.id, hour);
        return !event && (!slot || slot.status === "available");
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, members, slots, events]);

  return (
    <div
      className={cn(
        "flex flex-col border rounded-lg overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPreviousDay}
            aria-label="Précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Aujourd'hui
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextDay}
            aria-label="Suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="font-medium">
          {format(date, "EEEE d MMMM yyyy", { locale: fr })}
        </span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {members.length} membres
        </div>
      </div>

      {/* Common Available Slots Indicator */}
      {commonAvailableHours.length > 0 && (
        <div className="px-3 py-2 bg-green-50 border-b text-sm">
          <span className="text-green-700 font-medium">
            {commonAvailableHours.length} créneaux communs disponibles
          </span>
          <span className="text-green-600 ml-2">
            {commonAvailableHours
              .slice(0, 3)
              .map((h) => format(h, "HH:mm"))
              .join(", ")}
            {commonAvailableHours.length > 3 && "..."}
          </span>
        </div>
      )}

      {/* Timeline */}
      <ScrollArea className="flex-1">
        <div className="min-w-max">
          {/* Time Header */}
          <div className="flex sticky top-0 bg-background z-10 border-b">
            <div className="w-48 shrink-0 p-2 font-medium text-sm border-r">
              Membre
            </div>
            {hours.map((hour) => (
              <div
                key={hour.toISOString()}
                className={cn(
                  "min-w-[60px] p-2 text-center text-xs font-medium border-r",
                  commonAvailableHours.some((h) => isSameHour(h, hour)) &&
                    "bg-green-50",
                )}
              >
                {format(hour, "HH:mm")}
              </div>
            ))}
          </div>

          {/* Member Rows */}
          {members.map((member) => (
            <div key={member.id} className="flex border-b hover:bg-muted/30">
              <div className="w-48 shrink-0 p-2 flex items-center gap-2 border-r">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.avatarUrl} alt={member.name} />
                  <AvatarFallback className="text-xs">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.role}
                  </p>
                </div>
              </div>
              {hours.map((hour) => (
                <TimeSlot
                  key={hour.toISOString()}
                  member={member}
                  hour={hour}
                  slot={getSlotForMemberAtHour(member.id, hour)}
                  event={getEventForMemberAtHour(member.id, hour)}
                  onClick={() => onSlotClick?.(member, hour)}
                />
              ))}
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Legend */}
      <div className="flex items-center gap-4 p-2 border-t bg-muted/30 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-200" />
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-200" />
          <span>Occupé</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-200" />
          <span>Peut-être</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary/20" />
          <span>Événement</span>
        </div>
      </div>
    </div>
  );
}

export default TeamTimeline;
