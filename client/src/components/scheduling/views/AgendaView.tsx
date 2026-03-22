'use client';
import { SpinnerInfinity } from 'spinners-react';


/**
 * AgendaView Component
 * Story 1.3.6: AgendaView Component
 *
 * Chronological list view of TimeItems.
 * Groups items by day with expandable sections.
 */

import * as React from 'react';
import {
  format,
  isSameDay,
  isToday,
  isTomorrow,
  isYesterday,
  addDays,
  startOfDay,
  endOfDay,
  differenceInMinutes,
  eachDayOfInterval,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Clock,
  MapPin,
  Users,
  Video,
  ChevronDown,
  ChevronRight,
  CalendarX,
  CheckSquare,
  Calendar,
  CalendarCheck,
  UserCog,
  Flag,
  Bell,
  XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCalendarStore } from '@/stores/scheduling/calendar-store';
import { useSchedulingStore } from '@/stores/scheduling/scheduling-store';
import type { TimeItem, TimeItemType } from '@/lib/scheduling/types';

// ============================================================================
// Types
// ============================================================================

interface AgendaViewProps {
  className?: string;
  daysToShow?: number;
  items?: TimeItem[];
  onItemClick?: (item: TimeItem) => void;
}

interface DayGroupProps {
  date: Date;
  items: TimeItem[];
  defaultExpanded?: boolean;
  onItemClick?: (item: TimeItem) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function getItemDate(item: TimeItem): Date | null {
  if (!item.startTime) return null;
  return typeof item.startTime === 'string' ? parseISO(item.startTime) : item.startTime;
}

function getItemEndDate(item: TimeItem): Date | null {
  if (!item.endTime) return null;
  return typeof item.endTime === 'string' ? parseISO(item.endTime) : item.endTime;
}

function getRelativeDayLabel(date: Date): string | null {
  if (isToday(date)) return "Aujourd'hui";
  if (isTomorrow(date)) return 'Demain';
  if (isYesterday(date)) return 'Hier';
  return null;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

function getTypeIcon(type: TimeItemType) {
  switch (type) {
    case 'task':
      return CheckSquare;
    case 'event':
      return Calendar;
    case 'booking':
      return CalendarCheck;
    case 'shift':
      return UserCog;
    case 'milestone':
      return Flag;
    case 'reminder':
      return Bell;
    case 'blocker':
      return XCircle;
    default:
      return Calendar;
  }
}

function getTypeLabel(type: TimeItemType): string {
  switch (type) {
    case 'task':
      return 'Tâche';
    case 'event':
      return 'Événement';
    case 'booking':
      return 'Réservation';
    case 'shift':
      return 'Shift';
    case 'milestone':
      return 'Jalon';
    case 'reminder':
      return 'Rappel';
    case 'blocker':
      return 'Blocage';
    default:
      return 'Élément';
  }
}

// ============================================================================
// Item Card Component
// ============================================================================

function ItemCard({
  item,
  onClick,
}: {
  item: TimeItem;
  onClick?: () => void;
}) {
  const selectedItem = useSchedulingStore((state) => state.selectedItem);
  const selectItem = useSchedulingStore((state) => state.selectItem);
  const isSelected = selectedItem?.id === item.id;

  const startTime = getItemDate(item);
  const endTime = getItemEndDate(item);
  const duration = startTime && endTime
    ? differenceInMinutes(endTime, startTime)
    : 60;

  const TypeIcon = getTypeIcon(item.type);

  const handleClick = () => {
    selectItem(item);
    onClick?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative rounded-lg border bg-card p-3 transition-all',
        'hover:shadow-md hover:border-primary/30 cursor-pointer',
        isSelected && 'ring-2 ring-primary border-primary'
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Color indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
        style={{ backgroundColor: item.color || 'hsl(var(--primary))' }}
      />

      <div className="pl-3">
        {/* Title and Type */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <h4 className="font-medium text-sm leading-tight">
              {item.title}
            </h4>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {item.status === 'in_progress' && (
              <span className="text-[10px] text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">
                En cours
              </span>
            )}
            {item.status === 'cancelled' && (
              <span className="text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                Annulé
              </span>
            )}
            {item.status === 'done' && (
              <span className="text-[10px] text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                Terminé
              </span>
            )}
          </div>
        </div>

        {/* Time info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Clock className="h-3 w-3" />
          {item.allDay ? (
            <span>Toute la journée</span>
          ) : startTime ? (
            <span>
              {format(startTime, 'HH:mm', { locale: fr })}
              {endTime && ` - ${format(endTime, 'HH:mm', { locale: fr })}`}
              <span className="ml-1 text-muted-foreground/70">
                ({formatDuration(duration)})
              </span>
            </span>
          ) : (
            <span>Non planifié</span>
          )}
        </div>

        {/* Additional info */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {item.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>{typeof item.location === 'string' ? item.location : item.location.value}</span>
            </div>
          )}

          {typeof item.location === 'object' && item.location?.url && (
            <div className="flex items-center gap-1">
              <Video className="h-3 w-3" />
              <span>Visio</span>
            </div>
          )}

          {item.users && item.users.length > 0 && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>
                {item.users.length} participant{item.users.length > 1 ? 's' : ''}
              </span>
            </div>
          )}

          {item.priority && item.priority !== 'medium' && (
            <div className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded',
              item.priority === 'urgent' && 'bg-red-100 text-red-700',
              item.priority === 'high' && 'bg-orange-100 text-orange-700',
              item.priority === 'low' && 'bg-gray-100 text-gray-600'
            )}>
              <Flag className="h-3 w-3" />
              <span className="capitalize">{item.priority}</span>
            </div>
          )}
        </div>

        {/* Description preview */}
        {item.description && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {item.description}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Day Group Component
// ============================================================================

function DayGroup({
  date,
  items,
  defaultExpanded = true,
  onItemClick,
}: DayGroupProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const relativeLabel = getRelativeDayLabel(date);
  const today = isToday(date);

  // Sort items by time
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      // All-day items first
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      // Then by start time
      const aDate = getItemDate(a);
      const bDate = getItemDate(b);
      if (!aDate || !bDate) return 0;
      return aDate.getTime() - bDate.getTime();
    });
  }, [items]);

  return (
    <div className="mb-4">
      {/* Day Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 w-full text-left mb-2 py-2 px-1 rounded-lg',
          'hover:bg-accent/50 transition-colors',
          today && 'bg-primary/5'
        )}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}

        <div className="flex items-baseline gap-2">
          {relativeLabel && (
            <span className={cn('font-semibold', today && 'text-primary')}>
              {relativeLabel}
            </span>
          )}
          <span
            className={cn(
              'text-sm',
              relativeLabel ? 'text-muted-foreground' : 'font-semibold'
            )}
          >
            {format(date, 'EEEE d MMMM', { locale: fr })}
          </span>
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {items.length} élément{items.length > 1 ? 's' : ''}
        </span>
      </button>

      {/* Items */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pl-6">
              {sortedItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onClick={() => onItemClick?.(item)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgendaView({
  className,
  daysToShow = 30,
  items: propItems,
  onItemClick,
}: AgendaViewProps) {
  const currentDate = useCalendarStore((state) => state.currentDate);

  // Get items from store if not provided
  const storeItems = useSchedulingStore((state) => state.timeItems);
  const isLoading = useSchedulingStore((state) => state.isLoading);
  const fetchTimeItems = useSchedulingStore((state) => state.fetchTimeItems);

  const items = propItems || storeItems;

  // Calculate date range
  const dateRange = React.useMemo(
    () => ({
      start: startOfDay(currentDate),
      end: endOfDay(addDays(currentDate, daysToShow - 1)),
    }),
    [currentDate, daysToShow]
  );

  // Use ISO strings for effect dependencies to prevent infinite loops
  const rangeStartISO = dateRange.start.toISOString();
  const rangeEndISO = dateRange.end.toISOString();

  // Fetch items on mount
  React.useEffect(() => {
    if (!propItems) {
      fetchTimeItems(dateRange);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propItems, rangeStartISO, rangeEndISO]);

  // Group items by day
  const itemsByDay = React.useMemo(() => {
    const days = eachDayOfInterval(dateRange);
    const grouped: { date: Date; items: TimeItem[] }[] = [];

    for (const day of days) {
      const dayItems = items.filter((item) => {
        const itemDate = getItemDate(item);
        return itemDate && isSameDay(itemDate, day);
      });
      if (dayItems.length > 0) {
        grouped.push({ date: day, items: dayItems });
      }
    }

    return grouped;
  }, [items, dateRange]);

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

  if (itemsByDay.length === 0) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="flex flex-col items-center gap-4 text-center p-8">
          <div className="rounded-full bg-muted p-4">
            <CalendarX className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Aucun élément</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Vous n'avez aucun élément prévu pour les {daysToShow} prochains jours
            </p>
          </div>
          <Button variant="outline" size="sm">
            Créer un élément
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('h-full overflow-auto p-4', className)}>
      {itemsByDay.map(({ date, items: dayItems }, index) => (
        <DayGroup
          key={date.toISOString()}
          date={date}
          items={dayItems}
          defaultExpanded={index < 7} // Expand first 7 days by default
          onItemClick={onItemClick}
        />
      ))}
    </div>
  );
}

export default AgendaView;
