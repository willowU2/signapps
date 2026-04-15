"use client";

/**
 * Availability Calendar Component
 *
 * Visual calendar showing availability of multiple participants.
 * Displays busy/free times with color-coded overlays.
 */

import * as React from "react";
import {
  format,
  addDays,
  startOfWeek,
  isSameDay,
  isToday,
  setHours,
  setMinutes,
  differenceInMinutes,
  areIntervalsOverlapping,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type {
  AvailabilityResult,
  ParticipantAvailability,
  CommonSlot,
  BusySlot,
} from "@/lib/scheduling/utils/availability-finder";

// ============================================================================
// Types
// ============================================================================

interface AvailabilityCalendarProps {
  /** Availability data to display */
  availability: AvailabilityResult;
  /** Currently selected slot */
  selectedSlot?: CommonSlot;
  /** Callback when a slot is selected */
  onSlotSelect: (slot: CommonSlot) => void;
  /** Working hours to display */
  workingHours?: { start: number; end: number };
  /** Starting date for the calendar */
  startDate?: Date;
  /** Number of days to show */
  daysToShow?: number;
  /** Whether to show participant breakdown */
  showParticipants?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const HOUR_HEIGHT = 48; // pixels per hour
const DEFAULT_WORKING_HOURS = { start: 8, end: 19 };
const DEFAULT_DAYS_TO_SHOW = 5;

const AVAILABILITY_COLORS = {
  allAvailable: "bg-green-100 border-green-300 hover:bg-green-200",
  partiallyAvailable: "bg-yellow-100 border-yellow-300 hover:bg-yellow-200",
  busy: "bg-red-100/50 border-red-200",
};

// Participant colors for visual distinction
const PARTICIPANT_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-emerald-500",
];

// ============================================================================
// Component
// ============================================================================

export function AvailabilityCalendar({
  availability,
  selectedSlot,
  onSlotSelect,
  workingHours = DEFAULT_WORKING_HOURS,
  startDate = new Date(),
  daysToShow = DEFAULT_DAYS_TO_SHOW,
  showParticipants = true,
  className,
}: AvailabilityCalendarProps) {
  const [currentStartDate, setCurrentStartDate] = React.useState(() =>
    startOfWeek(startDate, { weekStartsOn: 1 }),
  );

  // Generate days array
  const days = React.useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < daysToShow; i++) {
      result.push(addDays(currentStartDate, i));
    }
    return result;
  }, [currentStartDate, daysToShow]);

  // Generate hours array
  const hours = React.useMemo(() => {
    const result: number[] = [];
    for (let h = workingHours.start; h <= workingHours.end; h++) {
      result.push(h);
    }
    return result;
  }, [workingHours]);

  // Navigation
  const goToPreviousWeek = () => {
    setCurrentStartDate(addDays(currentStartDate, -7));
  };

  const goToNextWeek = () => {
    setCurrentStartDate(addDays(currentStartDate, 7));
  };

  const goToToday = () => {
    setCurrentStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  // Get slots for a specific day
  const getSlotsForDay = (day: Date): CommonSlot[] => {
    return availability.slots.filter((slot) => isSameDay(slot.start, day));
  };

  // Get busy slots for a participant on a day
  const getBusySlotsForDay = (
    participant: ParticipantAvailability,
    day: Date,
  ): BusySlot[] => {
    return participant.busySlots.filter((slot) => isSameDay(slot.start, day));
  };

  // Calculate position for a time block
  const getBlockStyle = (
    start: Date,
    end: Date,
  ): { top: string; height: string } => {
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;

    const topOffset = (startHour - workingHours.start) * HOUR_HEIGHT;
    const height = (endHour - startHour) * HOUR_HEIGHT;

    return {
      top: `${topOffset}px`,
      height: `${Math.max(height, 20)}px`,
    };
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Aujourd'hui
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-sm font-medium">
          {format(currentStartDate, "MMMM yyyy", { locale: fr })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
            <span>Tous disponibles</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />
            <span>Partiellement</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-100/50 border border-red-200" />
            <span>Occupé</span>
          </div>
        </div>
      </div>

      {/* Participants legend */}
      {showParticipants && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Users className="h-4 w-4 text-muted-foreground" />
          {availability.participantAvailability.map((p, idx) => (
            <Badge
              key={p.participantId}
              variant="outline"
              className={cn("text-xs", "border-l-4")}
              style={{
                borderLeftColor: `var(--color-${
                  ["blue", "purple", "orange", "pink", "cyan", "emerald"][
                    idx % 6
                  ]
                }-500)`,
              }}
            >
              {p.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <ScrollArea className="flex-1">
        <div className="flex">
          {/* Time gutter */}
          <div className="flex-none w-16 border-r">
            <div className="h-12" /> {/* Header spacer */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="flex items-start justify-end pr-2 text-xs text-muted-foreground"
                style={{ height: HOUR_HEIGHT }}
              >
                {format(setHours(new Date(), hour), "HH:mm")}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex flex-1">
            {days.map((day) => (
              <DayColumn
                key={day.toISOString()}
                day={day}
                hours={hours}
                workingHours={workingHours}
                slots={getSlotsForDay(day)}
                participants={availability.participantAvailability}
                selectedSlot={selectedSlot}
                onSlotSelect={onSlotSelect}
                getBusySlotsForDay={getBusySlotsForDay}
                getBlockStyle={getBlockStyle}
              />
            ))}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Stats footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          <span>{availability.stats.totalSlots} créneaux trouvés</span>
        </div>
        {availability.stats.slotsWithAllAvailable > 0 && (
          <div className="flex items-center gap-1 text-green-600">
            <Check className="h-4 w-4" />
            <span>
              {availability.stats.slotsWithAllAvailable} où tous sont
              disponibles
            </span>
          </div>
        )}
        {availability.stats.slotsWithAllAvailable === 0 && (
          <div className="flex items-center gap-1 text-yellow-600">
            <AlertCircle className="h-4 w-4" />
            <span>Aucun créneau commun parfait</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DayColumn Component
// ============================================================================

interface DayColumnProps {
  day: Date;
  hours: number[];
  workingHours: { start: number; end: number };
  slots: CommonSlot[];
  participants: ParticipantAvailability[];
  selectedSlot?: CommonSlot;
  onSlotSelect: (slot: CommonSlot) => void;
  getBusySlotsForDay: (
    participant: ParticipantAvailability,
    day: Date,
  ) => BusySlot[];
  getBlockStyle: (start: Date, end: Date) => { top: string; height: string };
}

function DayColumn({
  day,
  hours,
  workingHours,
  slots,
  participants,
  selectedSlot,
  onSlotSelect,
  getBusySlotsForDay,
  getBlockStyle,
}: DayColumnProps) {
  const isCurrentDay = isToday(day);

  return (
    <div className="flex-1 min-w-[120px] border-r last:border-r-0">
      {/* Day header */}
      <div
        className={cn(
          "h-12 flex flex-col items-center justify-center border-b sticky top-0 bg-background z-10",
          isCurrentDay && "bg-primary/5",
        )}
      >
        <span className="text-xs text-muted-foreground capitalize">
          {format(day, "EEE", { locale: fr })}
        </span>
        <span
          className={cn(
            "text-sm font-medium",
            isCurrentDay &&
              "w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center",
          )}
        >
          {format(day, "d")}
        </span>
      </div>

      {/* Time slots */}
      <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
        {/* Hour grid lines */}
        {hours.map((hour) => (
          <div
            key={hour}
            className="absolute left-0 right-0 border-b border-dashed border-muted"
            style={{ top: (hour - workingHours.start) * HOUR_HEIGHT }}
          />
        ))}

        {/* Busy slots for each participant */}
        {participants.map((participant, pIdx) => {
          const busySlots = getBusySlotsForDay(participant, day);
          const width = 100 / participants.length;
          const left = pIdx * width;

          return busySlots.map((busy, bIdx) => {
            const style = getBlockStyle(busy.start, busy.end);
            return (
              <TooltipProvider key={`${participant.participantId}-${bIdx}`}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "absolute rounded-sm opacity-60",
                        PARTICIPANT_COLORS[pIdx % PARTICIPANT_COLORS.length],
                      )}
                      style={{
                        ...style,
                        left: `${left}%`,
                        width: `${width}%`,
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <p className="font-medium">{participant.name}</p>
                      <p className="text-muted-foreground">
                        {busy.reason || "Occupé"}
                      </p>
                      <p>
                        {format(busy.start, "HH:mm")} -{" "}
                        {format(busy.end, "HH:mm")}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          });
        })}

        {/* Available slots */}
        {slots.map((slot, idx) => {
          const style = getBlockStyle(slot.start, slot.end);
          const isSelected =
            selectedSlot?.start.getTime() === slot.start.getTime();

          return (
            <TooltipProvider key={idx}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSlotSelect(slot)}
                    className={cn(
                      "absolute left-1 right-1 rounded border-2 transition-all cursor-pointer",
                      slot.allAvailable
                        ? AVAILABILITY_COLORS.allAvailable
                        : AVAILABILITY_COLORS.partiallyAvailable,
                      isSelected && "ring-2 ring-primary ring-offset-1",
                    )}
                    style={style}
                  >
                    <div className="p-1 text-xs truncate">
                      {format(slot.start, "HH:mm")}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs space-y-1">
                    <p className="font-medium">
                      {format(slot.start, "HH:mm")} -{" "}
                      {format(slot.end, "HH:mm")}
                    </p>
                    <p>
                      {slot.availableParticipants.length}/{participants.length}{" "}
                      disponibles
                    </p>
                    {slot.scoreReasons.length > 0 && (
                      <div className="text-muted-foreground">
                        {slot.scoreReasons.map((r, i) => (
                          <p key={i}>{r}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}

export default AvailabilityCalendar;
