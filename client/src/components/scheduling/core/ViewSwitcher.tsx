'use client';

/**
 * ViewSwitcher Component
 *
 * Barre de sélection des vues temporelles avec animations.
 * Supporte: Agenda, Jour, 3-Jours, Semaine, Mois
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  List,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  Grid3X3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSchedulingNavigation } from '@/stores/scheduling-store';
import type { ViewType } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface ViewOption {
  id: ViewType;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  shortcut: string;
}

interface ViewSwitcherProps {
  className?: string;
  compact?: boolean;
}

// ============================================================================
// View Options
// ============================================================================

const viewOptions: ViewOption[] = [
  { id: 'agenda', label: 'Agenda', shortLabel: 'Agenda', icon: List, shortcut: '1' },
  { id: 'day', label: 'Jour', shortLabel: 'Jour', icon: CalendarIcon, shortcut: '2' },
  { id: '3-day', label: '3 Jours', shortLabel: '3J', icon: CalendarDays, shortcut: '3' },
  { id: 'week', label: 'Semaine', shortLabel: 'Sem', icon: CalendarRange, shortcut: '4' },
  { id: 'month', label: 'Mois', shortLabel: 'Mois', icon: Grid3X3, shortcut: '5' },
];

// ============================================================================
// Component
// ============================================================================

export function ViewSwitcher({ className, compact = false }: ViewSwitcherProps) {
  const { activeView, setActiveView } = useSchedulingNavigation();

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

      const option = viewOptions.find((opt) => opt.shortcut === e.key);
      if (option) {
        e.preventDefault();
        setActiveView(option.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveView]);

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg bg-muted p-1',
        className
      )}
      role="tablist"
      aria-label="Sélection de vue"
    >
      {viewOptions.map((option) => {
        const isActive = activeView === option.id;
        const Icon = option.icon;

        return (
          <button
            key={option.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`view-panel-${option.id}`}
            onClick={() => setActiveView(option.id)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={`${option.label} (${option.shortcut})`}
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

export function ViewSwitcherCompact({ className }: { className?: string }) {
  return <ViewSwitcher className={className} compact />;
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

export function ViewSwitcherDropdown({ className }: { className?: string }) {
  const { activeView, setActiveView } = useSchedulingNavigation();

  return (
    <Select value={activeView} onValueChange={(value) => setActiveView(value as ViewType)}>
      <SelectTrigger className={cn('w-[130px]', className)}>
        <SelectValue placeholder="Vue" />
      </SelectTrigger>
      <SelectContent>
        {viewOptions.map((option) => {
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

export default ViewSwitcher;
