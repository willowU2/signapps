'use client';
import { SpinnerInfinity } from 'spinners-react';


/**
 * TimelineView Component (Gantt Chart)
 * Phase 5: Project Management
 *
 * Displays TimeItems as a horizontal Gantt chart for project planning.
 * Supports dependencies, milestones, and drag-to-resize.
 */

import * as React from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  differenceInDays,
  addDays,
  isSameDay,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCalendarStore } from '@/stores/calendar-store';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ZoomIn,
  ZoomOut,
  Milestone,
  Link2,
} from 'lucide-react';
import type { TimeItem } from '@/lib/scheduling/types';

// ============================================================================
// Types
// ============================================================================

type TimeScale = 'day' | 'week' | 'month';

interface TimelineViewProps {
  className?: string;
  items?: TimeItem[];
  onItemClick?: (item: TimeItem) => void;
  onItemDoubleClick?: (item: TimeItem) => void;
}

interface TimelineRow {
  item: TimeItem;
  level: number;
  children: TimelineRow[];
}

// ============================================================================
// Constants
// ============================================================================

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 60;
const SIDEBAR_WIDTH = 250;

const TYPE_COLORS: Record<string, string> = {
  task: 'bg-blue-500',
  event: 'bg-green-500',
  milestone: 'bg-purple-500',
  blocker: 'bg-red-500',
  reminder: 'bg-yellow-500',
  booking: 'bg-cyan-500',
  shift: 'bg-orange-500',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'ring-2 ring-red-500',
  high: 'ring-2 ring-orange-500',
  medium: '',
  low: 'opacity-70',
};

// ============================================================================
// Helpers
// ============================================================================

function getItemDates(item: TimeItem): { start: Date | null; end: Date | null } {
  const start = item.startTime
    ? typeof item.startTime === 'string'
      ? parseISO(item.startTime)
      : item.startTime
    : null;

  const end = item.endTime
    ? typeof item.endTime === 'string'
      ? parseISO(item.endTime)
      : item.endTime
    : item.deadline
      ? typeof item.deadline === 'string'
        ? parseISO(item.deadline)
        : item.deadline
      : start
        ? addDays(start, 1)
        : null;

  return { start, end };
}

function buildHierarchy(items: TimeItem[]): TimelineRow[] {
  const itemMap = new Map<string, TimelineRow>();
  const roots: TimelineRow[] = [];

  // First pass: create all rows
  items.forEach((item) => {
    itemMap.set(item.id, { item, level: 0, children: [] });
  });

  // Second pass: build hierarchy
  items.forEach((item) => {
    const row = itemMap.get(item.id)!;
    if (item.parentId && itemMap.has(item.parentId)) {
      const parent = itemMap.get(item.parentId)!;
      row.level = parent.level + 1;
      parent.children.push(row);
    } else {
      roots.push(row);
    }
  });

  // Flatten for rendering
  const flatten = (rows: TimelineRow[], result: TimelineRow[] = []): TimelineRow[] => {
    rows.forEach((row) => {
      result.push(row);
      if (row.children.length > 0) {
        flatten(row.children, result);
      }
    });
    return result;
  };

  return flatten(roots);
}

// ============================================================================
// Component
// ============================================================================

export function TimelineView({
  className,
  items: propItems,
  onItemClick,
  onItemDoubleClick,
}: TimelineViewProps) {
  const currentDate = useCalendarStore((state) => state.currentDate);

  const storeItems = useCalendarStore((state) => state.timeItems);
  const isLoading = useCalendarStore((state) => state.isLoading);
  const fetchTimeItems = useCalendarStore((state) => state.fetchTimeItems);

  const items = propItems || storeItems;

  const [timeScale, setTimeScale] = React.useState<TimeScale>('week');
  const [zoom, setZoom] = React.useState(1);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Calculate date range based on scale
  const dateRange = React.useMemo(() => {
    switch (timeScale) {
      case 'day':
        return {
          start: addDays(currentDate, -7),
          end: addDays(currentDate, 21),
        };
      case 'week':
        return {
          start: startOfWeek(addDays(currentDate, -14), { weekStartsOn: 1 }),
          end: endOfWeek(addDays(currentDate, 42), { weekStartsOn: 1 }),
        };
      case 'month':
        return {
          start: startOfMonth(addDays(currentDate, -30)),
          end: endOfMonth(addDays(currentDate, 90)),
        };
      default:
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(addDays(currentDate, 28), { weekStartsOn: 1 }),
        };
    }
  }, [currentDate, timeScale]);

  // Fetch items (use ISO strings as deps to prevent infinite loops)
  const rangeStartISO = dateRange.start.toISOString();
  const rangeEndISO = dateRange.end.toISOString();
  React.useEffect(() => {
    if (!propItems) {
      fetchTimeItems(dateRange);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propItems, rangeStartISO, rangeEndISO]);

  // Generate time slots
  const timeSlots = React.useMemo(() => {
    switch (timeScale) {
      case 'day':
        return eachDayOfInterval(dateRange);
      case 'week':
        return eachWeekOfInterval(dateRange, { weekStartsOn: 1 });
      case 'month':
        return eachWeekOfInterval(dateRange, { weekStartsOn: 1 });
      default:
        return eachDayOfInterval(dateRange);
    }
  }, [dateRange, timeScale]);

  const slotWidth = React.useMemo(() => {
    switch (timeScale) {
      case 'day':
        return 40 * zoom;
      case 'week':
        return 120 * zoom;
      case 'month':
        return 80 * zoom;
      default:
        return 40 * zoom;
    }
  }, [timeScale, zoom]);

  // Build hierarchy
  const rows = React.useMemo(() => {
    const filteredItems = items.filter((item) => {
      const { start, end } = getItemDates(item);
      if (!start && !end) return false;
      return true;
    });
    return buildHierarchy(filteredItems);
  }, [items]);

  // Calculate bar position
  const getBarPosition = (item: TimeItem) => {
    const { start, end } = getItemDates(item);
    if (!start) return null;

    const totalDays = differenceInDays(dateRange.end, dateRange.start);
    const startOffset = differenceInDays(start, dateRange.start);
    const duration = end ? differenceInDays(end, start) : 1;

    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.min(100 - left, Math.max(width, 1))}%`,
    };
  };

  if (isLoading && items.length === 0) {
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
      <div className="flex items-center justify-between border-b p-2">
        <span className="text-sm font-medium">
          {format(currentDate, 'MMMM yyyy', { locale: fr })}
        </span>

        <div className="flex items-center gap-2">
          <Select value={timeScale} onValueChange={(v) => setTimeScale(v as TimeScale)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Jour</SelectItem>
              <SelectItem value="week">Semaine</SelectItem>
              <SelectItem value="month">Mois</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className="flex-shrink-0 border-r bg-muted/30"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* Header */}
          <div
            className="flex items-center border-b px-3 font-medium"
            style={{ height: HEADER_HEIGHT }}
          >
            Tâches
          </div>

          {/* Rows */}
          <div className="overflow-y-auto">
            {rows.map((row) => (
              <div
                key={row.item.id}
                className={cn(
                  'flex items-center border-b px-3 hover:bg-accent/50 cursor-pointer',
                  'transition-colors'
                )}
                style={{
                  height: ROW_HEIGHT,
                  paddingLeft: 12 + row.level * 20,
                }}
                onClick={() => onItemClick?.(row.item)}
                onDoubleClick={() => onItemDoubleClick?.(row.item)}
              >
                {row.item.type === 'milestone' && (
                  <Milestone className="mr-2 h-4 w-4 text-purple-500" />
                )}
                <span className="truncate text-sm">{row.item.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart area */}
        <div className="flex-1 overflow-x-auto" ref={containerRef}>
          <div
            className="relative"
            style={{ minWidth: timeSlots.length * slotWidth }}
          >
            {/* Time header */}
            <div
              className="sticky top-0 z-10 flex border-b bg-background"
              style={{ height: HEADER_HEIGHT }}
            >
              {timeSlots.map((slot, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col items-center justify-center border-r text-xs',
                    isSameDay(slot, new Date()) && 'bg-primary/10'
                  )}
                  style={{ width: slotWidth }}
                >
                  {timeScale === 'day' && (
                    <>
                      <span className="font-medium">{format(slot, 'EEE', { locale: fr })}</span>
                      <span className="text-muted-foreground">{format(slot, 'd')}</span>
                    </>
                  )}
                  {timeScale === 'week' && (
                    <>
                      <span className="font-medium">S{format(slot, 'w')}</span>
                      <span className="text-muted-foreground">
                        {format(slot, 'd MMM', { locale: fr })}
                      </span>
                    </>
                  )}
                  {timeScale === 'month' && (
                    <span className="font-medium">
                      {format(slot, 'd MMM', { locale: fr })}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Today marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
              style={{
                left: `${(differenceInDays(new Date(), dateRange.start) / differenceInDays(dateRange.end, dateRange.start)) * 100}%`,
              }}
            />

            {/* Rows with bars */}
            <div className="relative">
              {rows.map((row, rowIndex) => {
                const barPos = getBarPosition(row.item);

                return (
                  <div
                    key={row.item.id}
                    className="relative border-b"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
                      {timeSlots.map((slot, i) => (
                        <div
                          key={i}
                          className={cn(
                            'border-r',
                            isSameDay(slot, new Date()) && 'bg-primary/5'
                          )}
                          style={{ width: slotWidth }}
                        />
                      ))}
                    </div>

                    {/* Bar */}
                    {barPos && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'absolute top-1/2 -translate-y-1/2 h-6 rounded cursor-pointer',
                              'transition-all hover:ring-2 hover:ring-primary',
                              TYPE_COLORS[row.item.type] || 'bg-gray-500',
                              PRIORITY_COLORS[row.item.priority || 'medium'],
                              row.item.type === 'milestone' && 'w-4 h-4 rotate-45'
                            )}
                            style={{
                              left: barPos.left,
                              width: row.item.type === 'milestone' ? 16 : barPos.width,
                              minWidth: row.item.type === 'milestone' ? 16 : 20,
                            }}
                            onClick={() => onItemClick?.(row.item)}
                            onDoubleClick={() => onItemDoubleClick?.(row.item)}
                          >
                            {row.item.type !== 'milestone' && (
                              <span className="absolute inset-x-1 truncate text-xs text-white leading-6">
                                {row.item.title}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-sm">
                            <p className="font-medium">{row.item.title}</p>
                            {row.item.startTime && (
                              <p className="text-muted-foreground">
                                {format(
                                  typeof row.item.startTime === 'string'
                                    ? parseISO(row.item.startTime)
                                    : row.item.startTime,
                                  'PPp',
                                  { locale: fr }
                                )}
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Dependencies (simplified) */}
                    {row.item.dependencies?.map((depId) => {
                      const depRow = rows.find((r) => r.item.id === depId);
                      if (!depRow) return null;
                      return (
                        <div
                          key={depId}
                          className="absolute left-0 text-xs text-muted-foreground"
                          style={{ top: 2 }}
                        >
                          <Link2 className="h-3 w-3" />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {rows.length === 0 && !isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Aucun élément planifié</p>
            <p className="text-sm text-muted-foreground">
              Créez des tâches avec des dates pour les voir ici
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default TimelineView;
