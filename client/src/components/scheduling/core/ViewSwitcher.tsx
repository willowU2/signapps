'use client';

/**
 * ViewSwitcher Component
 * Story 1.2.2: View Selector
 *
 * Barre de sélection des vues temporelles avec animations.
 * Supporte: Jour, Semaine, Mois, Agenda, Timeline, Kanban, Heatmap, Focus, Roster
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  List,
  Calendar as CalendarIcon,
  CalendarRange,
  Grid3X3,
  Clock,
  Columns3,
  Activity,
  Target,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCalendarStore } from '@/stores/scheduling/calendar-store';
import type { ViewType } from '@/lib/scheduling/types';

// ============================================================================
// Types
// ============================================================================

interface ViewOption {
  id: ViewType;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  shortcut: string;
  description?: string;
}

interface ViewSwitcherProps {
  className?: string;
  compact?: boolean;
  views?: ViewType[];
  showAll?: boolean;
}

// ============================================================================
// View Options
// ============================================================================

const allViewOptions: ViewOption[] = [
  { id: 'day', label: 'Jour', shortLabel: 'Jour', icon: CalendarIcon, shortcut: 'd', description: 'Vue journée' },
  { id: 'week', label: 'Semaine', shortLabel: 'Sem', icon: CalendarRange, shortcut: 'w', description: 'Vue semaine' },
  { id: 'month', label: 'Mois', shortLabel: 'Mois', icon: Grid3X3, shortcut: 'm', description: 'Vue mois' },
  { id: 'agenda', label: 'Agenda', shortLabel: 'Agenda', icon: List, shortcut: 'a', description: 'Liste chronologique' },
  { id: 'timeline', label: 'Timeline', shortLabel: 'TL', icon: Clock, shortcut: 't', description: 'Frise temporelle' },
  { id: 'kanban', label: 'Kanban', shortLabel: 'Kanban', icon: Columns3, shortcut: 'k', description: 'Vue Kanban' },
  { id: 'heatmap', label: 'Disponibilités', shortLabel: 'Dispo', icon: Activity, shortcut: 'h', description: 'Carte de chaleur' },
  { id: 'focus', label: 'Focus', shortLabel: 'Focus', icon: Target, shortcut: 'f', description: 'Mode concentration' },
  { id: 'roster', label: 'Planning', shortLabel: 'Planning', icon: Users, shortcut: 'r', description: 'Planning équipe' },
];

// Default views shown in the switcher
const defaultViews: ViewType[] = ['day', 'week', 'month', 'agenda'];

// ============================================================================
// Component
// ============================================================================

export function ViewSwitcher({
  className,
  compact = false,
  views,
  showAll = false,
}: ViewSwitcherProps) {
  const view = useCalendarStore((state) => state.view);
  const setView = useCalendarStore((state) => state.setView);

  // Determine which views to show
  const viewsToShow = showAll
    ? allViewOptions
    : views
    ? allViewOptions.filter((opt) => views.includes(opt.id))
    : allViewOptions.filter((opt) => defaultViews.includes(opt.id));

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }

      const option = viewsToShow.find((opt) => opt.shortcut === e.key.toLowerCase());
      if (option) {
        e.preventDefault();
        setView(option.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewsToShow, setView]);

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg bg-muted p-1',
        className
      )}
      role="tablist"
      aria-label="Sélection de vue"
    >
      {viewsToShow.map((option) => {
        const isActive = view === option.id;
        const Icon = option.icon;

        return (
          <button
            key={option.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`view-panel-${option.id}`}
            onClick={() => setView(option.id)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={`${option.description || option.label} (${option.shortcut.toUpperCase()})`}
          >
            {isActive && (
              <motion.div
                layoutId="view-switcher-indicator"
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 35,
                }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon className="h-4 w-4" />
              {!compact && (
                <span className="hidden sm:inline">{option.label}</span>
              )}
              {compact && (
                <span className="hidden sm:inline">{option.shortLabel}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Compact Version for Mobile
// ============================================================================

export function ViewSwitcherCompact({
  className,
  views,
  showAll = false,
}: Omit<ViewSwitcherProps, 'compact'>) {
  return <ViewSwitcher className={className} compact views={views} showAll={showAll} />;
}

// ============================================================================
// Icon-Only Version
// ============================================================================

export function ViewSwitcherIcons({
  className,
  views,
  showAll = false,
}: Omit<ViewSwitcherProps, 'compact'>) {
  const view = useCalendarStore((state) => state.view);
  const setView = useCalendarStore((state) => state.setView);

  const viewsToShow = showAll
    ? allViewOptions
    : views
    ? allViewOptions.filter((opt) => views.includes(opt.id))
    : allViewOptions.filter((opt) => defaultViews.includes(opt.id));

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg bg-muted p-1',
        className
      )}
      role="tablist"
      aria-label="Sélection de vue"
    >
      {viewsToShow.map((option) => {
        const isActive = view === option.id;
        const Icon = option.icon;

        return (
          <button
            key={option.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => setView(option.id)}
            className={cn(
              'relative inline-flex items-center justify-center rounded-md p-2 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={option.description || option.label}
          >
            {isActive && (
              <motion.div
                layoutId="view-switcher-icons-indicator"
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 35,
                }}
              />
            )}
            <Icon className="relative z-10 h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Dropdown Version (for very small screens)
// ============================================================================

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ViewSwitcherDropdown({
  className,
  views,
  showAll = false,
}: Omit<ViewSwitcherProps, 'compact'>) {
  const view = useCalendarStore((state) => state.view);
  const setView = useCalendarStore((state) => state.setView);

  const viewsToShow = showAll
    ? allViewOptions
    : views
    ? allViewOptions.filter((opt) => views.includes(opt.id))
    : allViewOptions.filter((opt) => defaultViews.includes(opt.id));

  return (
    <Select value={view} onValueChange={(value) => setView(value as ViewType)}>
      <SelectTrigger className={cn('w-[140px]', className)}>
        <SelectValue placeholder="Vue" />
      </SelectTrigger>
      <SelectContent>
        {viewsToShow.map((option) => {
          const Icon = option.icon;
          return (
            <SelectItem key={option.id} value={option.id}>
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {option.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// Utilities
// ============================================================================

export function getViewIcon(viewType: ViewType): React.ElementType {
  const option = allViewOptions.find((opt) => opt.id === viewType);
  return option?.icon || CalendarRange;
}

export function getViewLabel(viewType: ViewType): string {
  const option = allViewOptions.find((opt) => opt.id === viewType);
  return option?.label || viewType;
}

export { allViewOptions, defaultViews };

export default ViewSwitcher;
