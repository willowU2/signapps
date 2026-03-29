'use client';
import { SpinnerInfinity } from 'spinners-react';


/**
 * RosterView Component
 * Phase 7: HR & Roster
 *
 * Staff scheduling view for managing shifts and work schedules.
 * Shows employees vs days with shift blocks.
 */

import * as React from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  addWeeks,
  isSameDay,
  parseISO,
  differenceInMinutes,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCalendarStore } from '@/stores/calendar-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  MoreHorizontal,
  Clock,
  Sun,
  Moon,
  Sunset,
  Coffee,
} from 'lucide-react';
import type { TimeItem } from '@/lib/scheduling/types';

// ============================================================================
// Types
// ============================================================================

interface RosterViewProps {
  className?: string;
  items?: TimeItem[];
  employeeIds?: string[];
  onShiftClick?: (shift: TimeItem) => void;
  onCreateShift?: (employeeId: string, date: Date) => void;
  onCopyWeek?: (fromWeek: Date) => void;
}

interface ShiftType {
  id: string;
  name: string;
  startHour: number;
  endHour: number;
  color: string;
  icon: React.ReactNode;
}

interface RosterRow {
  employeeId: string;
  employeeName: string;
  shifts: Map<string, TimeItem[]>; // dateKey -> shifts
  totalHours: number;
}

// ============================================================================
// Constants
// ============================================================================

const SHIFT_TYPES: ShiftType[] = [
  {
    id: 'morning',
    name: 'Matin',
    startHour: 6,
    endHour: 14,
    color: 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    icon: <Sun className="h-3 w-3" />,
  },
  {
    id: 'afternoon',
    name: 'Après-midi',
    startHour: 14,
    endHour: 22,
    color: 'bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    icon: <Sunset className="h-3 w-3" />,
  },
  {
    id: 'night',
    name: 'Nuit',
    startHour: 22,
    endHour: 6,
    color: 'bg-indigo-200 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    icon: <Moon className="h-3 w-3" />,
  },
  {
    id: 'full',
    name: 'Journée',
    startHour: 9,
    endHour: 17,
    color: 'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    icon: <Clock className="h-3 w-3" />,
  },
  {
    id: 'break',
    name: 'Repos',
    startHour: 0,
    endHour: 0,
    color: 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    icon: <Coffee className="h-3 w-3" />,
  },
];

const ROW_HEIGHT = 64;
const CELL_WIDTH = 120;
const SIDEBAR_WIDTH = 200;

// ============================================================================
// Helpers
// ============================================================================

function getShiftType(item: TimeItem): ShiftType | undefined {
  if (!item.startTime) return undefined;

  const start =
    typeof item.startTime === 'string' ? parseISO(item.startTime) : item.startTime;
  const hour = start.getHours();

  // Match by tags or time (shift type stored in tags)
  const shiftTypeTag = item.tags?.find((t) =>
    SHIFT_TYPES.some((s) => s.id === t)
  );
  if (shiftTypeTag) {
    return SHIFT_TYPES.find((s) => s.id === shiftTypeTag);
  }

  // Infer from time
  if (hour >= 6 && hour < 14) return SHIFT_TYPES[0]; // morning
  if (hour >= 14 && hour < 22) return SHIFT_TYPES[1]; // afternoon
  if (hour >= 22 || hour < 6) return SHIFT_TYPES[2]; // night
  return SHIFT_TYPES[3]; // full day
}

function formatShiftTime(item: TimeItem): string {
  if (!item.startTime) return '';

  const start =
    typeof item.startTime === 'string' ? parseISO(item.startTime) : item.startTime;
  const end = item.endTime
    ? typeof item.endTime === 'string'
      ? parseISO(item.endTime)
      : item.endTime
    : null;

  if (end) {
    return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
  }
  return format(start, 'HH:mm');
}

function calculateShiftHours(item: TimeItem): number {
  if (!item.startTime || !item.endTime) return 0;

  const start =
    typeof item.startTime === 'string' ? parseISO(item.startTime) : item.startTime;
  const end =
    typeof item.endTime === 'string' ? parseISO(item.endTime) : item.endTime;

  return Math.round(differenceInMinutes(end, start) / 60 * 10) / 10;
}

// ============================================================================
// Component
// ============================================================================

export function RosterView({
  className,
  items: propItems,
  employeeIds: propEmployeeIds,
  onShiftClick,
  onCreateShift,
  onCopyWeek,
}: RosterViewProps) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const setCurrentDate = useCalendarStore((state) => state.setCurrentDate);
  const weekStartsOn = useCalendarStore((state) => state.weekStartsOn);

  const storeItems = useCalendarStore((state) => state.timeItems);
  const isLoading = useCalendarStore((state) => state.isLoading);
  const fetchTimeItems = useCalendarStore((state) => state.fetchTimeItems);

  const items = propItems || storeItems;

  // Filter to only shifts
  const shifts = React.useMemo(
    () => items.filter((item) => item.type === 'shift'),
    [items]
  );

  // Calculate date range (1 week)
  const dateRange = React.useMemo(() => {
    return {
      start: startOfWeek(currentDate, { weekStartsOn }),
      end: endOfWeek(currentDate, { weekStartsOn }),
    };
  }, [currentDate, weekStartsOn]);

  // Fetch items (use ISO strings as deps to prevent infinite loops)
  const rangeStartISO = dateRange.start.toISOString();
  const rangeEndISO = dateRange.end.toISOString();
  React.useEffect(() => {
    if (!propItems) {
      fetchTimeItems(dateRange);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propItems, rangeStartISO, rangeEndISO]);

  // Generate days of week
  const days = React.useMemo(() => {
    return eachDayOfInterval(dateRange);
  }, [dateRange]);

  // Get unique employees from shifts
  const employeeIds = React.useMemo(() => {
    if (propEmployeeIds) return propEmployeeIds;
    const ids = new Set<string>();
    shifts.forEach((shift) => {
      if (shift.ownerId) ids.add(shift.ownerId);
      shift.users?.forEach((u) => ids.add(u.userId));
    });
    return Array.from(ids);
  }, [shifts, propEmployeeIds]);

  // Build roster rows
  const rows = React.useMemo((): RosterRow[] => {
    return employeeIds.map((employeeId) => {
      const employeeShifts = new Map<string, TimeItem[]>();
      let totalHours = 0;

      days.forEach((day) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayShifts = shifts.filter((shift) => {
          const shiftOwnerId = shift.ownerId || shift.users?.[0]?.userId;
          if (shiftOwnerId !== employeeId) return false;

          if (!shift.startTime) return false;
          const shiftDate =
            typeof shift.startTime === 'string'
              ? parseISO(shift.startTime)
              : shift.startTime;

          return isSameDay(shiftDate, day);
        });

        employeeShifts.set(dateKey, dayShifts);
        totalHours += dayShifts.reduce((sum, s) => sum + calculateShiftHours(s), 0);
      });

      return {
        employeeId,
        employeeName: employeeId, // Would normally come from user lookup
        shifts: employeeShifts,
        totalHours,
      };
    });
  }, [employeeIds, days, shifts]);

  // Navigation
  const handlePrevWeek = () => setCurrentDate(addWeeks(currentDate, -1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

  if (isLoading && shifts.length === 0) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="flex flex-col items-center gap-2">
          <SpinnerInfinity size={32} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} />
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
          <Button variant="outline" size="icon" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            Semaine du {format(dateRange.start, 'd MMMM yyyy', { locale: fr })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCopyWeek?.(dateRange.start)}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copier semaine
          </Button>
        </div>
      </div>

      {/* Shift type legend */}
      <div className="flex items-center gap-4 border-b p-2 text-xs">
        {SHIFT_TYPES.map((type) => (
          <div key={type.id} className="flex items-center gap-1">
            <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded', type.color)}>
              {type.icon}
              <span>{type.name}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Roster grid */}
      <div className="flex flex-1 overflow-auto">
        {/* Sidebar */}
        <div
          className="flex-shrink-0 border-r bg-muted/30"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between border-b px-3 font-medium"
            style={{ height: 48 }}
          >
            <span>Employé</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>

          {/* Employee rows */}
          {rows.map((row) => (
            <div
              key={row.employeeId}
              className="flex items-center justify-between border-b px-3"
              style={{ height: ROW_HEIGHT }}
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {row.employeeName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm">{row.employeeName}</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {row.totalHours}h
              </Badge>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto">
          <div style={{ minWidth: days.length * CELL_WIDTH }}>
            {/* Day headers */}
            <div className="sticky top-0 z-10 flex border-b bg-background">
              {days.map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col items-center justify-center border-r text-sm',
                    isSameDay(day, new Date()) && 'bg-primary/10'
                  )}
                  style={{ width: CELL_WIDTH, height: 48 }}
                >
                  <span className="font-medium">
                    {format(day, 'EEEE', { locale: fr })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(day, 'd MMM', { locale: fr })}
                  </span>
                </div>
              ))}
            </div>

            {/* Data rows */}
            {rows.map((row) => (
              <div
                key={row.employeeId}
                className="flex border-b"
                style={{ height: ROW_HEIGHT }}
              >
                {days.map((day, dayIdx) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayShifts = row.shifts.get(dateKey) || [];

                  return (
                    <div
                      key={dayIdx}
                      className={cn(
                        'relative border-r p-1',
                        isSameDay(day, new Date()) && 'bg-primary/5'
                      )}
                      style={{ width: CELL_WIDTH }}
                    >
                      {dayShifts.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {dayShifts.map((shift) => {
                            const shiftType = getShiftType(shift);

                            return (
                              <Tooltip key={shift.id}>
                                <TooltipTrigger asChild>
                                  <button
                                    className={cn(
                                      'flex items-center gap-1 w-full px-2 py-1 rounded text-xs',
                                      'hover:ring-1 hover:ring-primary transition-all',
                                      shiftType?.color || 'bg-gray-200'
                                    )}
                                    onClick={() => onShiftClick?.(shift)}
                                  >
                                    {shiftType?.icon}
                                    <span className="truncate">
                                      {formatShiftTime(shift)}
                                    </span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm">
                                    <p className="font-medium">{shift.title}</p>
                                    <p className="text-muted-foreground">
                                      {formatShiftTime(shift)}
                                    </p>
                                    <p className="text-muted-foreground">
                                      {calculateShiftHours(shift)}h
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      ) : (
                        <button
                          className="flex h-full w-full items-center justify-center rounded border-2 border-dashed border-transparent hover:border-primary/50 transition-colors"
                          onClick={() => onCreateShift?.(row.employeeId, day)}
                        >
                          <Plus className="h-4 w-4 text-muted-foreground opacity-0 hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-sm">
        <span>
          {rows.length} employés • {shifts.length} shifts planifiés
        </span>
        <span className="font-medium">
          Total: {rows.reduce((sum, r) => sum + r.totalHours, 0)}h
        </span>
      </div>

      {/* Empty state */}
      {employeeIds.length === 0 && !isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Aucun shift planifié</p>
            <p className="text-sm text-muted-foreground">
              Créez des shifts pour vos employés
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default RosterView;
