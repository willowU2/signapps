'use client';

/**
 * DateNavigator Component
 * Story 1.2.3: Date Navigator
 *
 * Navigation entre dates avec titre contextualisé et mini calendar.
 * Raccourcis: T=today, G=go to date, H/L=prev/next
 */

import * as React from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameYear,
  isToday,
  addDays,
  getISOWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useCalendarStore } from '@/stores/scheduling/calendar-store';
import type { ViewType } from '@/lib/scheduling/types';

// ============================================================================
// Types
// ============================================================================

interface DateNavigatorProps {
  className?: string;
  showMiniCalendar?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the display title based on view and date
 */
function getDateTitle(view: ViewType, date: Date, weekStartsOn: 0 | 1 = 1): string {
  const locale = { locale: fr };

  switch (view) {
    case 'day':
    case 'focus':
      if (isToday(date)) {
        return "Aujourd'hui";
      }
      return format(date, 'EEEE d MMMM yyyy', locale);

    case 'week':
    case 'roster': {
      const weekStart = startOfWeek(date, { weekStartsOn });
      const weekEnd = endOfWeek(date, { weekStartsOn });
      if (isSameMonth(weekStart, weekEnd)) {
        return format(weekStart, 'MMMM yyyy', locale);
      }
      if (isSameYear(weekStart, weekEnd)) {
        return `${format(weekStart, 'MMM', locale)} - ${format(weekEnd, 'MMM yyyy', locale)}`;
      }
      return `${format(weekStart, 'MMM yyyy', locale)} - ${format(weekEnd, 'MMM yyyy', locale)}`;
    }

    case 'month':
    case 'heatmap':
      return format(date, 'MMMM yyyy', locale);

    case 'agenda':
    case 'timeline':
    case 'kanban':
    default:
      return format(date, 'MMMM yyyy', locale);
  }
}

/**
 * Get ISO week number
 */
function getWeekNumber(date: Date): number {
  return getISOWeek(date);
}

// ============================================================================
// Component
// ============================================================================

export function DateNavigator({
  className,
  showMiniCalendar = true,
}: DateNavigatorProps) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const view = useCalendarStore((state) => state.view);
  const weekStartsOn = useCalendarStore((state) => state.weekStartsOn);
  const setCurrentDate = useCalendarStore((state) => state.setCurrentDate);
  const goToToday = useCalendarStore((state) => state.goToToday);
  const navigateRelative = useCalendarStore((state) => state.navigateRelative);

  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  const navigatePrev = React.useCallback(() => navigateRelative('prev'), [navigateRelative]);
  const navigateNext = React.useCallback(() => navigateRelative('next'), [navigateRelative]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Don't trigger if command palette modifiers are held
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault();
          goToToday();
          break;
        case 'g':
          e.preventDefault();
          setIsCalendarOpen(true);
          break;
        case 'h':
        case 'arrowleft':
          if (!e.shiftKey) {
            e.preventDefault();
            navigatePrev();
          }
          break;
        case 'l':
        case 'arrowright':
          if (!e.shiftKey) {
            e.preventDefault();
            navigateNext();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToToday, navigatePrev, navigateNext]);

  const title = getDateTitle(view, currentDate, weekStartsOn);
  const weekNumber = getWeekNumber(currentDate);
  const showWeekNumber = view === 'week' || view === 'roster';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Navigation Buttons */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={navigatePrev}
          title="Précédent (H ou ←)"
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Précédent</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={navigateNext}
          title="Suivant (L ou →)"
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Suivant</span>
        </Button>
      </div>

      {/* Today Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={goToToday}
        title="Aujourd'hui (T)"
        className="hidden sm:inline-flex"
      >
        Aujourd&apos;hui
      </Button>

      {/* Date Title */}
      {showMiniCalendar ? (
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'justify-start text-left font-semibold',
                'hover:bg-accent hover:text-accent-foreground'
              )}
              title="Aller à une date (G)"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span className="capitalize">{title}</span>
              {showWeekNumber && (
                <span className="ml-2 text-xs text-muted-foreground">
                  S{weekNumber}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={(date) => {
                if (date) {
                  setCurrentDate(date);
                  setIsCalendarOpen(false);
                }
              }}
              initialFocus
              locale={fr}
            />
          </PopoverContent>
        </Popover>
      ) : (
        <h2 className="text-lg font-semibold capitalize">
          {title}
          {showWeekNumber && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              Semaine {weekNumber}
            </span>
          )}
        </h2>
      )}
    </div>
  );
}

// ============================================================================
// Compact Version
// ============================================================================

export function DateNavigatorCompact({ className }: { className?: string }) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const goToToday = useCalendarStore((state) => state.goToToday);
  const navigateRelative = useCalendarStore((state) => state.navigateRelative);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigateRelative('prev')}
        className="h-7 w-7"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={goToToday}
        className="h-7 px-2 text-xs"
      >
        {format(currentDate, 'd MMM', { locale: fr })}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigateRelative('next')}
        className="h-7 w-7"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================================
// Mini Calendar (standalone)
// ============================================================================

export function MiniCalendar({ className }: { className?: string }) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const setCurrentDate = useCalendarStore((state) => state.setCurrentDate);

  return (
    <Calendar
      mode="single"
      selected={currentDate}
      onSelect={(date) => date && setCurrentDate(date)}
      locale={fr}
      className={className}
    />
  );
}

export default DateNavigator;
