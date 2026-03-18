'use client';

/**
 * DateNavigator Component
 *
 * Navigation entre dates avec titre contextualisé et mini calendar.
 * Raccourcis: T=today, G=go to date, H/L=prev/next
 */

import * as React from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  isSameYear,
  isToday,
  addDays,
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
import { useSchedulingNavigation } from '@/stores/scheduling-store';
import type { ViewType } from '@/lib/scheduling/types/scheduling';

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
function getDateTitle(view: ViewType, date: Date): string {
  const locale = { locale: fr };

  switch (view) {
    case 'day':
      if (isToday(date)) {
        return "Aujourd'hui";
      }
      return format(date, 'EEEE d MMMM yyyy', locale);

    case '3-day': {
      const endDate = addDays(date, 2);
      if (isSameMonth(date, endDate)) {
        return `${format(date, 'd', locale)} - ${format(endDate, 'd MMMM yyyy', locale)}`;
      }
      if (isSameYear(date, endDate)) {
        return `${format(date, 'd MMM', locale)} - ${format(endDate, 'd MMM yyyy', locale)}`;
      }
      return `${format(date, 'd MMM yyyy', locale)} - ${format(endDate, 'd MMM yyyy', locale)}`;
    }

    case 'week': {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      if (isSameMonth(weekStart, weekEnd)) {
        return format(weekStart, 'MMMM yyyy', locale);
      }
      if (isSameYear(weekStart, weekEnd)) {
        return `${format(weekStart, 'MMM', locale)} - ${format(weekEnd, 'MMM yyyy', locale)}`;
      }
      return `${format(weekStart, 'MMM yyyy', locale)} - ${format(weekEnd, 'MMM yyyy', locale)}`;
    }

    case 'month':
      return format(date, 'MMMM yyyy', locale);

    case 'agenda':
    default:
      return format(date, 'MMMM yyyy', locale);
  }
}

/**
 * Get week number
 */
function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDays = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  );
  return Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);
}

// ============================================================================
// Component
// ============================================================================

export function DateNavigator({
  className,
  showMiniCalendar = true,
}: DateNavigatorProps) {
  const {
    activeView,
    currentDate,
    setCurrentDate,
    goToToday,
    navigatePrev,
    navigateNext,
  } = useSchedulingNavigation();

  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

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

  const title = getDateTitle(activeView, currentDate);
  const weekNumber = getWeekNumber(currentDate);

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
              {activeView === 'week' && (
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
          {activeView === 'week' && (
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
  const { currentDate, goToToday, navigatePrev, navigateNext } =
    useSchedulingNavigation();

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={navigatePrev}
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
        {format(currentDate, 'MMM d', { locale: fr })}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={navigateNext}
        className="h-7 w-7"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default DateNavigator;
