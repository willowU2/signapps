'use client';

/**
 * HeatmapView Component
 * Phase 4: Team & Booking
 *
 * Visualizes workload and availability as a color-coded heatmap.
 * Shows team members vs time slots with intensity indicating load.
 */

import * as React from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachHourOfInterval,
  addDays,
  isSameDay,
  isSameHour,
  parseISO,
  startOfDay,
  endOfDay,
  isWithinInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCalendarStore } from '@/stores/scheduling/calendar-store';
import { useSchedulingStore } from '@/stores/scheduling/scheduling-store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TimeItem } from '@/lib/scheduling/types';

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'week' | 'month';
type SlotMode = 'hours' | 'days';

interface HeatmapViewProps {
  className?: string;
  items?: TimeItem[];
  userIds?: string[];
  onSlotClick?: (userId: string, date: Date, hour?: number) => void;
}

interface HeatmapCell {
  userId: string;
  date: Date;
  hour?: number;
  count: number;
  items: TimeItem[];
  intensity: number; // 0-4 levels
}

// ============================================================================
// Constants
// ============================================================================

const INTENSITY_COLORS = [
  'bg-green-100 dark:bg-green-900/20', // 0 - free
  'bg-yellow-200 dark:bg-yellow-900/30', // 1 - light
  'bg-orange-300 dark:bg-orange-900/40', // 2 - moderate
  'bg-red-400 dark:bg-red-900/50', // 3 - busy
  'bg-red-600 dark:bg-red-900/70', // 4 - overloaded
];

const CELL_SIZE = 32;
const ROW_HEIGHT = 48;
const SIDEBAR_WIDTH = 180;
const HOUR_START = 8;
const HOUR_END = 18;

// ============================================================================
// Helpers
// ============================================================================

function calculateIntensity(count: number, maxPerSlot: number = 2): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 3) return 3;
  return 4;
}

function getItemsInSlot(
  items: TimeItem[],
  userId: string,
  date: Date,
  hour?: number
): TimeItem[] {
  return items.filter((item) => {
    // Check if item belongs to user
    const itemUserId = item.ownerId || item.users?.[0]?.userId;
    if (itemUserId !== userId) return false;

    // Get item time
    if (!item.startTime) return false;
    const itemStart =
      typeof item.startTime === 'string' ? parseISO(item.startTime) : item.startTime;
    const itemEnd = item.endTime
      ? typeof item.endTime === 'string'
        ? parseISO(item.endTime)
        : item.endTime
      : itemStart;

    // Check date
    if (!isSameDay(itemStart, date) && !isSameDay(itemEnd, date)) {
      // Check if spans multiple days
      if (
        !isWithinInterval(date, {
          start: startOfDay(itemStart),
          end: endOfDay(itemEnd),
        })
      ) {
        return false;
      }
    }

    // Check hour if specified
    if (hour !== undefined) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(date);
      slotEnd.setHours(hour + 1, 0, 0, 0);

      // Check if item overlaps with hour slot
      return (
        (itemStart <= slotEnd && itemEnd >= slotStart) ||
        (itemStart >= slotStart && itemStart < slotEnd)
      );
    }

    return true;
  });
}

// ============================================================================
// Component
// ============================================================================

export function HeatmapView({
  className,
  items: propItems,
  userIds: propUserIds,
  onSlotClick,
}: HeatmapViewProps) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const setCurrentDate = useCalendarStore((state) => state.setCurrentDate);
  const weekStartsOn = useCalendarStore((state) => state.weekStartsOn);

  const storeItems = useSchedulingStore((state) => state.timeItems);
  const isLoading = useSchedulingStore((state) => state.isLoading);
  const fetchTimeItems = useSchedulingStore((state) => state.fetchTimeItems);

  const items = propItems || storeItems;

  const [viewMode, setViewMode] = React.useState<ViewMode>('week');
  const [slotMode, setSlotMode] = React.useState<SlotMode>('hours');

  // Get unique users from items
  const userIds = React.useMemo(() => {
    if (propUserIds) return propUserIds;
    const ids = new Set<string>();
    items.forEach((item) => {
      if (item.ownerId) ids.add(item.ownerId);
      item.users?.forEach((u) => ids.add(u.userId));
    });
    return Array.from(ids);
  }, [items, propUserIds]);

  // Calculate date range
  const dateRange = React.useMemo(() => {
    if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn }),
        end: endOfWeek(currentDate, { weekStartsOn }),
      };
    }
    // Month view shows 4 weeks
    return {
      start: startOfWeek(currentDate, { weekStartsOn }),
      end: endOfWeek(addDays(currentDate, 21), { weekStartsOn }),
    };
  }, [currentDate, viewMode, weekStartsOn]);

  // Fetch items (use ISO strings as deps to prevent infinite loops)
  const rangeStartISO = dateRange.start.toISOString();
  const rangeEndISO = dateRange.end.toISOString();
  React.useEffect(() => {
    if (!propItems) {
      fetchTimeItems(dateRange);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propItems, rangeStartISO, rangeEndISO]);

  // Generate days
  const days = React.useMemo(() => {
    return eachDayOfInterval(dateRange);
  }, [dateRange]);

  // Generate hours
  const hours = React.useMemo(() => {
    if (slotMode === 'days') return [];
    return Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  }, [slotMode]);

  // Build heatmap cells
  const cells = React.useMemo((): HeatmapCell[][] => {
    return userIds.map((userId) => {
      if (slotMode === 'hours') {
        // Hour-by-hour for each day
        return days.flatMap((day) =>
          hours.map((hour) => {
            const slotItems = getItemsInSlot(items, userId, day, hour);
            return {
              userId,
              date: day,
              hour,
              count: slotItems.length,
              items: slotItems,
              intensity: calculateIntensity(slotItems.length),
            };
          })
        );
      } else {
        // Day-by-day
        return days.map((day) => {
          const dayItems = getItemsInSlot(items, userId, day);
          return {
            userId,
            date: day,
            count: dayItems.length,
            items: dayItems,
            intensity: calculateIntensity(dayItems.length, 5),
          };
        });
      }
    });
  }, [userIds, days, hours, items, slotMode]);

  // Navigation
  const handlePrev = () => {
    const offset = viewMode === 'week' ? -7 : -28;
    setCurrentDate(addDays(currentDate, offset));
  };

  const handleNext = () => {
    const offset = viewMode === 'week' ? 7 : 28;
    setCurrentDate(addDays(currentDate, offset));
  };

  if (isLoading && items.length === 0) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {format(dateRange.start, 'd MMM', { locale: fr })} -{' '}
            {format(dateRange.end, 'd MMM yyyy', { locale: fr })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semaine</SelectItem>
              <SelectItem value="month">Mois</SelectItem>
            </SelectContent>
          </Select>

          <Select value={slotMode} onValueChange={(v) => setSlotMode(v as SlotMode)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">Par heure</SelectItem>
              <SelectItem value="days">Par jour</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 border-b p-2 text-xs">
        <span className="text-muted-foreground">Charge:</span>
        {['Libre', 'Léger', 'Modéré', 'Chargé', 'Surchargé'].map((label, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={cn('h-4 w-4 rounded', INTENSITY_COLORS[i])} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="flex flex-1 overflow-auto">
        {/* Sidebar - User list */}
        <div
          className="flex-shrink-0 border-r bg-muted/30"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* Header spacer */}
          <div
            className="border-b"
            style={{ height: slotMode === 'hours' ? 64 : 48 }}
          />

          {/* User rows */}
          {userIds.map((userId) => (
            <div
              key={userId}
              className="flex items-center gap-2 border-b px-3"
              style={{ height: ROW_HEIGHT }}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback>{userId.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">{userId}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto">
          <div
            className="relative"
            style={{
              minWidth:
                slotMode === 'hours'
                  ? days.length * hours.length * CELL_SIZE
                  : days.length * (CELL_SIZE * 2),
            }}
          >
            {/* Date headers */}
            <div className="sticky top-0 z-10 bg-background">
              {/* Day row */}
              <div className="flex border-b">
                {days.map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center justify-center border-r text-xs font-medium',
                      isSameDay(day, new Date()) && 'bg-primary/10'
                    )}
                    style={{
                      width: slotMode === 'hours' ? hours.length * CELL_SIZE : CELL_SIZE * 2,
                      height: 32,
                    }}
                  >
                    {format(day, 'EEE d', { locale: fr })}
                  </div>
                ))}
              </div>

              {/* Hour row (only in hours mode) */}
              {slotMode === 'hours' && (
                <div className="flex border-b">
                  {days.flatMap((day, dayIdx) =>
                    hours.map((hour, hourIdx) => (
                      <div
                        key={`${dayIdx}-${hourIdx}`}
                        className={cn(
                          'flex items-center justify-center border-r text-[10px] text-muted-foreground',
                          isSameDay(day, new Date()) &&
                            isSameHour(new Date(), new Date(day.setHours(hour))) &&
                            'bg-primary/10'
                        )}
                        style={{ width: CELL_SIZE, height: 32 }}
                      >
                        {hour}h
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Data rows */}
            {cells.map((userCells, userIdx) => (
              <div
                key={userIds[userIdx]}
                className="flex border-b"
                style={{ height: ROW_HEIGHT }}
              >
                {userCells.map((cell, cellIdx) => (
                  <Tooltip key={cellIdx}>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          'border-r flex items-center justify-center transition-colors hover:ring-1 hover:ring-primary',
                          INTENSITY_COLORS[cell.intensity]
                        )}
                        style={{
                          width: slotMode === 'hours' ? CELL_SIZE : CELL_SIZE * 2,
                          height: ROW_HEIGHT,
                        }}
                        onClick={() => onSlotClick?.(cell.userId, cell.date, cell.hour)}
                      >
                        {cell.count > 0 && (
                          <span className="text-xs font-medium">{cell.count}</span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="text-sm">
                        <p className="font-medium">
                          {format(cell.date, 'EEEE d MMMM', { locale: fr })}
                          {cell.hour !== undefined && ` à ${cell.hour}h`}
                        </p>
                        {cell.items.length > 0 ? (
                          <ul className="mt-1 space-y-1">
                            {cell.items.slice(0, 5).map((item) => (
                              <li key={item.id} className="text-muted-foreground">
                                • {item.title}
                              </li>
                            ))}
                            {cell.items.length > 5 && (
                              <li className="text-muted-foreground">
                                +{cell.items.length - 5} autres
                              </li>
                            )}
                          </ul>
                        ) : (
                          <p className="text-muted-foreground">Disponible</p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {userIds.length === 0 && !isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Aucun utilisateur à afficher</p>
            <p className="text-sm text-muted-foreground">
              Assignez des tâches à des utilisateurs pour voir leur charge
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default HeatmapView;
