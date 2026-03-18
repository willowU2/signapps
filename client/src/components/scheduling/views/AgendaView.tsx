'use client';

/**
 * AgendaView Component
 *
 * Chronological list view of events.
 * Groups events by day with expandable sections.
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSchedulingNavigation, useSchedulingUI, useSchedulingSelection } from '@/stores/scheduling-store';
import { useEvents } from '@/lib/scheduling/api/calendar';
import type { ScheduleBlock } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface AgendaViewProps {
  className?: string;
  daysToShow?: number;
  onEventClick?: (event: ScheduleBlock) => void;
}

interface DayGroupProps {
  date: Date;
  events: ScheduleBlock[];
  defaultExpanded?: boolean;
  onEventClick?: (event: ScheduleBlock) => void;
}

// ============================================================================
// Helpers
// ============================================================================

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

// ============================================================================
// Event Card Component
// ============================================================================

function EventCard({
  event,
  onClick,
}: {
  event: ScheduleBlock;
  onClick?: () => void;
}) {
  const { selectedBlockId, selectBlock } = useSchedulingSelection();
  const isSelected = selectedBlockId === event.id;
  const duration = event.end
    ? differenceInMinutes(event.end, event.start)
    : 60;

  const handleClick = () => {
    selectBlock(event.id);
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
        style={{ backgroundColor: event.color || 'hsl(var(--primary))' }}
      />

      <div className="pl-3">
        {/* Title and Time */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-medium text-sm leading-tight">
            {event.title}
          </h4>
          {event.status === 'tentative' && (
            <span className="shrink-0 text-[10px] text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">
              Provisoire
            </span>
          )}
          {event.status === 'cancelled' && (
            <span className="shrink-0 text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
              Annulé
            </span>
          )}
        </div>

        {/* Time info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Clock className="h-3 w-3" />
          {event.allDay ? (
            <span>Toute la journée</span>
          ) : (
            <span>
              {format(event.start, 'HH:mm', { locale: fr })}
              {event.end && ` - ${format(event.end, 'HH:mm', { locale: fr })}`}
              <span className="ml-1 text-muted-foreground/70">
                ({formatDuration(duration)})
              </span>
            </span>
          )}
        </div>

        {/* Additional info */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {event.metadata?.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>{event.metadata.location as string}</span>
            </div>
          )}

          {event.metadata?.videoConference && (
            <div className="flex items-center gap-1">
              <Video className="h-3 w-3" />
              <span>Visio</span>
            </div>
          )}

          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>
                {event.attendees.length} participant{event.attendees.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Description preview */}
        {event.description && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {event.description}
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
  events,
  defaultExpanded = true,
  onEventClick,
}: DayGroupProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const relativeLabel = getRelativeDayLabel(date);
  const today = isToday(date);

  // Sort events by time
  const sortedEvents = React.useMemo(() => {
    return [...events].sort((a, b) => {
      // All-day events first
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      // Then by start time
      return a.start.getTime() - b.start.getTime();
    });
  }, [events]);

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
          {events.length} événement{events.length > 1 ? 's' : ''}
        </span>
      </button>

      {/* Events */}
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
              {sortedEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={() => onEventClick?.(event)}
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
  onEventClick,
}: AgendaViewProps) {
  const { currentDate, getDateRange } = useSchedulingNavigation();

  // Calculate date range
  const dateRange = React.useMemo(
    () => ({
      start: startOfDay(currentDate),
      end: endOfDay(addDays(currentDate, daysToShow - 1)),
    }),
    [currentDate, daysToShow]
  );

  // Fetch events
  const { data: events = [], isLoading } = useEvents(dateRange);

  // Group events by day
  const eventsByDay = React.useMemo(() => {
    const days = eachDayOfInterval(dateRange);
    const grouped: { date: Date; events: ScheduleBlock[] }[] = [];

    for (const day of days) {
      const dayEvents = events.filter((e) => isSameDay(e.start, day));
      if (dayEvents.length > 0) {
        grouped.push({ date: day, events: dayEvents });
      }
    }

    return grouped;
  }, [events, dateRange]);

  if (isLoading) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (eventsByDay.length === 0) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="flex flex-col items-center gap-4 text-center p-8">
          <div className="rounded-full bg-muted p-4">
            <CalendarX className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Aucun événement</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Vous n'avez aucun événement prévu pour les {daysToShow} prochains jours
            </p>
          </div>
          <Button variant="outline" size="sm">
            Créer un événement
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('h-full overflow-auto p-4', className)}>
      {eventsByDay.map(({ date, events }, index) => (
        <DayGroup
          key={date.toISOString()}
          date={date}
          events={events}
          defaultExpanded={index < 7} // Expand first 7 days by default
          onEventClick={onEventClick}
        />
      ))}
    </div>
  );
}

export default AgendaView;
