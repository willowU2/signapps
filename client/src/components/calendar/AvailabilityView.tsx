"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  addDays,
  format,
  startOfDay,
  endOfDay,
  parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  Users,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Calendar,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCalendarStore } from "@/stores/calendar-store";
import { calendarApi } from "@/lib/api/calendar";
import { Event } from "@/types/calendar";

// ============================================================================
// Constants
// ============================================================================

const HOUR_START = 8;
const HOUR_END = 20;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const SLOT_HEIGHT_PX = 48;
const COLUMN_WIDTH_PX = 160;
const TIME_AXIS_WIDTH = 64;

const ENTITY_COLORS = [
  "#4285F4",
  "#EA4335",
  "#34A853",
  "#FBBC04",
  "#FF6D01",
  "#46BDC6",
  "#7B1FA2",
  "#C2185B",
  "#00897B",
  "#6D4C41",
  "#1A73E8",
  "#E53935",
  "#43A047",
];

// ============================================================================
// Types
// ============================================================================

interface EntityInfo {
  id: string;
  label: string;
  type: "colleague" | "resource";
  color: string;
  initials: string;
}

interface BusySlot {
  entityId: string;
  startMinutes: number;
  endMinutes: number;
  title: string;
  color: string;
}

interface FreeSlot {
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
}

interface ConflictSlot {
  startMinutes: number;
  endMinutes: number;
  entityCount: number;
  entityIds: string[];
}

// ============================================================================
// Utilities
// ============================================================================

function minutesFromDay(dateStr: string, dayDate: Date): number {
  const date = parseISO(dateStr);
  const dayStart = startOfDay(dayDate);
  const diffMs = date.getTime() - dayStart.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

function clampMinutes(minutes: number): number {
  const rangeStart = HOUR_START * 60;
  const rangeEnd = HOUR_END * 60;
  return Math.min(Math.max(minutes, rangeStart), rangeEnd);
}

function minutesToPixels(minutes: number): number {
  const offsetFromStart = minutes - HOUR_START * 60;
  return (offsetFromStart / 60) * SLOT_HEIGHT_PX;
}

function formatMinutesAsTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}h${mins > 0 ? String(mins).padStart(2, "0") : ""}`;
}

function getInitials(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ============================================================================
// Time Axis
// ============================================================================

function TimeAxis({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col shrink-0 select-none", className)}
      style={{ width: TIME_AXIS_WIDTH }}
    >
      <div className="h-14 border-b border-border" />
      {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => HOUR_START + i).map((hour) => (
        <div
          key={hour}
          className="relative shrink-0 flex items-start justify-end pr-2 text-xs text-muted-foreground"
          style={{ height: SLOT_HEIGHT_PX }}
        >
          <span className="-mt-2 font-medium">{`${String(hour).padStart(2, "0")}:00`}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Entity Column
// ============================================================================

interface EntityColumnProps {
  entity: EntityInfo;
  busySlots: BusySlot[];
  freeSlots: FreeSlot[];
  selectedDate: Date;
  onSlotClick?: (startMinutes: number) => void;
}

function EntityColumn({ entity, busySlots, freeSlots, onSlotClick }: EntityColumnProps) {
  return (
    <div
      className="flex flex-col shrink-0 border-r border-border"
      style={{ width: COLUMN_WIDTH_PX }}
    >
      {/* Column header */}
      <div className="h-14 flex flex-col items-center justify-center gap-0.5 border-b border-border bg-card px-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
          style={{ backgroundColor: entity.color }}
        >
          {entity.initials}
        </div>
        <span className="text-xs font-medium text-foreground truncate w-full text-center leading-tight">
          {entity.label}
        </span>
        <Badge
          variant="outline"
          className="text-[10px] h-4 px-1 border-0"
          style={{ color: entity.color }}
        >
          {entity.type === "colleague" ? "Collègue" : "Ressource"}
        </Badge>
      </div>

      {/* Time grid */}
      <div className="relative" style={{ height: TOTAL_HOURS * SLOT_HEIGHT_PX }}>
        {Array.from({ length: TOTAL_HOURS }, (_, i) => (
          <div
            key={i}
            className={cn(
              "absolute w-full border-b border-border/50",
              i % 2 === 0 ? "bg-background" : "bg-muted/20"
            )}
            style={{ top: i * SLOT_HEIGHT_PX, height: SLOT_HEIGHT_PX }}
          />
        ))}

        {/* Free slots */}
        {freeSlots.map((slot, i) => {
          const top = minutesToPixels(slot.startMinutes);
          const height = minutesToPixels(slot.endMinutes) - top;
          if (height < 4) return null;
          return (
            <TooltipProvider key={`free-${i}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="absolute left-0.5 right-0.5 rounded-sm cursor-pointer transition-opacity hover:opacity-80 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800"
                    style={{ top: top + 1, height: Math.max(height - 2, 4) }}
                    onClick={() => onSlotClick?.(slot.startMinutes)}
                  >
                    {height > 20 && (
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 px-1 font-medium leading-tight block truncate">
                        Libre
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  <p className="font-medium text-emerald-600">Créneau libre</p>
                  <p>
                    {formatMinutesAsTime(slot.startMinutes)} &ndash;{" "}
                    {formatMinutesAsTime(slot.endMinutes)}
                  </p>
                  <p className="text-muted-foreground">Durée : {slot.durationMinutes} min</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}

        {/* Busy slots */}
        {busySlots.map((slot, i) => {
          const startClamped = clampMinutes(slot.startMinutes);
          const endClamped = clampMinutes(slot.endMinutes);
          const top = minutesToPixels(startClamped);
          const height = minutesToPixels(endClamped) - top;
          if (height < 2) return null;
          return (
            <TooltipProvider key={`busy-${i}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="absolute left-0.5 right-0.5 rounded-sm opacity-85 overflow-hidden border border-black/10"
                    style={{
                      top: top + 1,
                      height: Math.max(height - 2, 4),
                      backgroundColor: slot.color,
                    }}
                  >
                    {height > 18 && (
                      <span className="text-[10px] text-white px-1 font-medium leading-tight block truncate drop-shadow-sm">
                        {slot.title}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  <p className="font-medium">{slot.title}</p>
                  <p className="text-muted-foreground">
                    {formatMinutesAsTime(slot.startMinutes)} &ndash;{" "}
                    {formatMinutesAsTime(slot.endMinutes)}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Conflict overlay
// ============================================================================

interface ConflictOverlayProps {
  conflictSlots: ConflictSlot[];
  entities: EntityInfo[];
}

function ConflictOverlay({ conflictSlots, entities }: ConflictOverlayProps) {
  return (
    <>
      {conflictSlots.map((slot, i) => {
        const top = minutesToPixels(slot.startMinutes);
        const height = minutesToPixels(slot.endMinutes) - top;
        if (height < 2) return null;
        const names = slot.entityIds
          .map((id) => entities.find((e) => e.id === id)?.label ?? id)
          .join(", ");
        return (
          <TooltipProvider key={`conflict-${i}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute left-0 right-0 bg-red-100 dark:bg-red-950/40 border-y border-red-300 dark:border-red-800 opacity-60 pointer-events-auto cursor-help"
                  style={{ top: top + 14, height: Math.max(height, 4) }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-48">
                <p className="font-medium text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Conflit ({slot.entityCount} personnes)
                </p>
                <p className="text-muted-foreground mt-0.5">{names}</p>
                <p>
                  {formatMinutesAsTime(slot.startMinutes)} &ndash;{" "}
                  {formatMinutesAsTime(slot.endMinutes)}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </>
  );
}

// ============================================================================
// Free slot computation algorithms
// ============================================================================

function computeFreeSlots(
  busySlots: BusySlot[],
  rangeStart: number,
  rangeEnd: number,
  minDuration = 30
): FreeSlot[] {
  if (busySlots.length === 0) {
    const duration = rangeEnd - rangeStart;
    if (duration >= minDuration) {
      return [{ startMinutes: rangeStart, endMinutes: rangeEnd, durationMinutes: duration }];
    }
    return [];
  }

  const sorted = [...busySlots].sort((a, b) => a.startMinutes - b.startMinutes);
  const merged: Array<[number, number]> = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.startMinutes < last[1]) {
      last[1] = Math.max(last[1], s.endMinutes);
    } else {
      merged.push([s.startMinutes, s.endMinutes]);
    }
  }

  const free: FreeSlot[] = [];
  let cursor = rangeStart;

  for (const [start, end] of merged) {
    if (start > cursor) {
      const dur = start - cursor;
      if (dur >= minDuration) {
        free.push({ startMinutes: cursor, endMinutes: start, durationMinutes: dur });
      }
    }
    cursor = Math.max(cursor, end);
  }

  if (cursor < rangeEnd) {
    const dur = rangeEnd - cursor;
    if (dur >= minDuration) {
      free.push({ startMinutes: cursor, endMinutes: rangeEnd, durationMinutes: dur });
    }
  }

  return free;
}

function computeCommonFreeSlots(
  entityBusy: Map<string, BusySlot[]>,
  rangeStart: number,
  rangeEnd: number,
  minDuration = 30
): FreeSlot[] {
  if (entityBusy.size === 0) return [];

  const allBusy: BusySlot[] = [];
  for (const slots of entityBusy.values()) {
    allBusy.push(...slots);
  }

  return computeFreeSlots(allBusy, rangeStart, rangeEnd, minDuration);
}

function computeConflicts(
  entityBusy: Map<string, BusySlot[]>,
  rangeStart: number,
  rangeEnd: number
): ConflictSlot[] {
  if (entityBusy.size < 2) return [];

  const events: Array<{ time: number; delta: 1 | -1; entityId: string }> = [];
  for (const [entityId, slots] of entityBusy.entries()) {
    for (const slot of slots) {
      const s = Math.max(clampMinutes(slot.startMinutes), rangeStart);
      const e = Math.min(clampMinutes(slot.endMinutes), rangeEnd);
      if (s < e) {
        events.push({ time: s, delta: 1, entityId });
        events.push({ time: e, delta: -1, entityId });
      }
    }
  }

  events.sort((a, b) => a.time - b.time || a.delta - b.delta);

  const conflicts: ConflictSlot[] = [];
  const active = new Set<string>();
  let prevTime = rangeStart;

  const times = [...new Set(events.map((e) => e.time))].sort((a, b) => a - b);

  for (const time of times) {
    const point = events.filter((e) => e.time === time);

    if (active.size >= 2 && time > prevTime) {
      conflicts.push({
        startMinutes: prevTime,
        endMinutes: time,
        entityCount: active.size,
        entityIds: [...active],
      });
    }

    for (const p of point) {
      if (p.delta === 1) active.add(p.entityId);
      else active.delete(p.entityId);
    }

    prevTime = time;
  }

  return conflicts;
}

// ============================================================================
// Common free slots panel
// ============================================================================

interface CommonFreeSlotsPanelProps {
  commonFreeSlots: FreeSlot[];
  minDuration: number;
  onMinDurationChange: (d: number) => void;
}

function CommonFreeSlotsPanel({
  commonFreeSlots,
  minDuration,
  onMinDurationChange,
}: CommonFreeSlotsPanelProps) {
  const filtered = commonFreeSlots.filter((s) => s.durationMinutes >= minDuration);

  return (
    <div className="border-t border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          Créneaux communs disponibles
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Durée min :</span>
          {[15, 30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => onMinDurationChange(d)}
              className={cn(
                "px-2 py-0.5 rounded border text-xs transition-colors",
                minDuration === d
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              )}
            >
              {d < 60 ? `${d}min` : `${d / 60}h`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Aucun créneau commun de {minDuration}min ou plus
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filtered.map((slot, i) => (
            <Badge
              key={i}
              variant="outline"
              className="text-xs border-emerald-300 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
            >
              <Clock className="w-3 h-3 mr-1" />
              {formatMinutesAsTime(slot.startMinutes)} &ndash;{" "}
              {formatMinutesAsTime(slot.endMinutes)}{" "}
              <span className="ml-1 text-muted-foreground">({slot.durationMinutes} min)</span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main AvailabilityView
// ============================================================================

export default function AvailabilityView() {
  const { selectedColleagues, selectedResources, currentDate, setCurrentDate } =
    useCalendarStore();

  const [entityEvents, setEntityEvents] = useState<Map<string, Event[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [minDuration, setMinDuration] = useState(30);
  const [showConflicts, setShowConflicts] = useState(true);

  const entities: EntityInfo[] = useMemo(() => {
    const list: EntityInfo[] = [];
    selectedColleagues.forEach((id, i) => {
      list.push({
        id,
        label: `Collègue ${id.slice(0, 6)}`,
        type: "colleague",
        color: ENTITY_COLORS[i % ENTITY_COLORS.length],
        initials: getInitials(`CL ${id.slice(0, 4)}`),
      });
    });
    selectedResources.forEach((id, i) => {
      const colorIdx = (selectedColleagues.length + i) % ENTITY_COLORS.length;
      list.push({
        id,
        label: `Ressource ${id.slice(0, 6)}`,
        type: "resource",
        color: ENTITY_COLORS[colorIdx],
        initials: getInitials(`RS ${id.slice(0, 4)}`),
      });
    });
    return list;
  }, [selectedColleagues, selectedResources]);

  const selectedDay = useMemo(() => startOfDay(currentDate), [currentDate]);

  const fetchEvents = useCallback(async () => {
    if (entities.length === 0) return;
    setLoading(true);

    const dayStart = startOfDay(selectedDay);
    const dayEnd = endOfDay(selectedDay);
    const newMap = new Map<string, Event[]>();

    await Promise.allSettled(
      entities.map(async (entity) => {
        try {
          const res = await calendarApi.listEvents(entity.id, dayStart, dayEnd);
          newMap.set(entity.id, res.data ?? []);
        } catch {
          newMap.set(entity.id, []);
        }
      })
    );

    setEntityEvents(new Map(newMap));
    setLoading(false);
  }, [entities, selectedDay]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const entityBusySlots = useMemo(() => {
    const map = new Map<string, BusySlot[]>();

    for (const entity of entities) {
      const events = entityEvents.get(entity.id) ?? [];
      const busy: BusySlot[] = [];

      for (const ev of events) {
        if (ev.is_all_day) continue;

        const evStart = parseISO(ev.start_time);
        const evEnd = parseISO(ev.end_time);
        const dayStart = startOfDay(selectedDay);
        const dayEnd = endOfDay(selectedDay);

        const overlaps =
          (evStart >= dayStart && evStart <= dayEnd) ||
          (evEnd >= dayStart && evEnd <= dayEnd) ||
          (evStart <= dayStart && evEnd >= dayEnd);

        if (!overlaps) continue;

        busy.push({
          entityId: entity.id,
          startMinutes: minutesFromDay(ev.start_time, selectedDay),
          endMinutes: minutesFromDay(ev.end_time, selectedDay),
          title: ev.title,
          color: entity.color,
        });
      }

      map.set(entity.id, busy);
    }

    return map;
  }, [entities, entityEvents, selectedDay]);

  const entityFreeSlots = useMemo(() => {
    const map = new Map<string, FreeSlot[]>();
    const rangeStart = HOUR_START * 60;
    const rangeEnd = HOUR_END * 60;

    for (const entity of entities) {
      const busy = entityBusySlots.get(entity.id) ?? [];
      map.set(entity.id, computeFreeSlots(busy, rangeStart, rangeEnd, minDuration));
    }

    return map;
  }, [entities, entityBusySlots, minDuration]);

  const commonFreeSlots = useMemo(() => {
    const rangeStart = HOUR_START * 60;
    const rangeEnd = HOUR_END * 60;
    return computeCommonFreeSlots(entityBusySlots, rangeStart, rangeEnd, minDuration);
  }, [entityBusySlots, minDuration]);

  const conflictSlots = useMemo(() => {
    if (!showConflicts || entityBusySlots.size < 2) return [];
    const rangeStart = HOUR_START * 60;
    const rangeEnd = HOUR_END * 60;
    return computeConflicts(entityBusySlots, rangeStart, rangeEnd);
  }, [entityBusySlots, showConflicts]);

  // Empty state
  if (entities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-96 gap-4 text-center px-6">
        <div className="p-4 rounded-full bg-muted">
          <Users className="w-10 h-10 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-1">Aucune entité sélectionnée</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Sélectionnez des collègues ou des ressources dans le panneau des layers
            pour visualiser leurs disponibilités.
          </p>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground border border-border rounded-lg p-3 max-w-sm">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
          <span>
            Les zones <span className="text-emerald-600 font-medium">vertes</span> indiquent
            les créneaux libres, les zones{" "}
            <span className="text-red-500 font-medium">rouges</span> les conflits.
          </span>
        </div>
      </div>
    );
  }

  const formattedDate = format(selectedDay, "EEEE d MMMM yyyy", { locale: fr });

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0 flex-wrap gap-2">
        <span className="text-sm font-medium capitalize">{formattedDate}</span>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900 border border-emerald-400" />
            Libre
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded-sm bg-red-200 dark:bg-red-900 border border-red-400" />
            Conflit
          </div>
          <Button
            variant={showConflicts ? "secondary" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setShowConflicts((v) => !v)}
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            Conflits {showConflicts ? "on" : "off"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={fetchEvents}
            disabled={loading}
          >
            <RefreshCw className={cn("w-3 h-3 mr-1", loading && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Entity summary bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-muted/30 shrink-0 overflow-x-auto">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        {entities.map((e) => (
          <Badge
            key={e.id}
            variant="outline"
            className="text-xs shrink-0"
            style={{ borderColor: e.color, color: e.color }}
          >
            {e.type === "colleague" ? (
              <Users className="w-3 h-3 mr-1" />
            ) : (
              <Package className="w-3 h-3 mr-1" />
            )}
            {e.label}
          </Badge>
        ))}
        {loading && (
          <span className="text-xs text-muted-foreground ml-2 italic">Chargement...</span>
        )}
      </div>

      {/* Grid */}
      <ScrollArea className="flex-1">
        <div className="flex min-w-max relative">
          <TimeAxis />

          <div className="relative flex">
            {showConflicts && conflictSlots.length > 0 && (
              <div
                className="absolute top-14 left-0 right-0 pointer-events-none z-10"
                style={{ height: TOTAL_HOURS * SLOT_HEIGHT_PX }}
              >
                <ConflictOverlay conflictSlots={conflictSlots} entities={entities} />
              </div>
            )}

            {entities.map((entity) => (
              <EntityColumn
                key={entity.id}
                entity={entity}
                busySlots={entityBusySlots.get(entity.id) ?? []}
                freeSlots={entityFreeSlots.get(entity.id) ?? []}
                selectedDate={selectedDay}
              />
            ))}
          </div>
        </div>
      </ScrollArea>

      {entities.length >= 2 && (
        <CommonFreeSlotsPanel
          commonFreeSlots={commonFreeSlots}
          minDuration={minDuration}
          onMinDurationChange={setMinDuration}
        />
      )}
    </div>
  );
}
