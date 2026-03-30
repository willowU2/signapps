'use client';

/**
 * ScopeSwitch Component
 * Story 1.2.1: Scope Switcher
 *
 * Toggle entre les trois scopes: MOI (I) / EUX (They) / NOUS (We)
 * Avec option ALL optionnelle.
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import { User, Users, UsersRound, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSchedulingStore } from '@/stores/scheduling/scheduling-store';
import type { Scope } from '@/lib/scheduling/types';

// ============================================================================
// Types
// ============================================================================

interface ScopeOption {
  id: Scope | 'all';
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ElementType;
  shortcut: string;
}

interface ScopeSwitchProps {
  className?: string;
  showAll?: boolean;
  compact?: boolean;
  showLabels?: boolean;
}

// ============================================================================
// Scope Options
// ============================================================================

const scopeOptions: ScopeOption[] = [
  {
    id: 'moi',
    label: 'Moi',
    shortLabel: 'Moi',
    description: 'Mes tâches et événements personnels',
    icon: User,
    shortcut: 'm',
  },
  {
    id: 'eux',
    label: 'Eux',
    shortLabel: 'Eux',
    description: 'Visibilité sur les autres',
    icon: Users,
    shortcut: 'e',
  },
  {
    id: 'nous',
    label: 'Nous',
    shortLabel: 'Nous',
    description: 'Collaboratif et partagé',
    icon: UsersRound,
    shortcut: 'n',
  },
];

const allOption: ScopeOption = {
  id: 'all',
  label: 'Tout',
  shortLabel: 'All',
  description: 'Afficher tout',
  icon: Globe,
  shortcut: 'a',
};

// ============================================================================
// Component
// ============================================================================

export function ScopeSwitch({
  className,
  showAll = false,
  compact = false,
  showLabels = true,
}: ScopeSwitchProps) {
  const scope = useSchedulingStore((state) => state.scope);
  const setScope = useSchedulingStore((state) => state.setScope);

  const options = React.useMemo(
    () => (showAll ? [...scopeOptions, allOption] : scopeOptions),
    [showAll]
  );

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

      const option = options.find((opt) => opt.shortcut === e.key.toLowerCase());
      if (option) {
        e.preventDefault();
        setScope(option.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, setScope]);

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg bg-muted p-1',
        className
      )}
      role="tablist"
      aria-label="Filtre de scope"
    >
      {options.map((option) => {
        const isActive = scope === option.id;
        const Icon = option.icon;

        return (
          <button
            key={option.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`scope-panel-${option.id}`}
            onClick={() => setScope(option.id)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={`${option.description} (${option.shortcut.toUpperCase()})`}
          >
            {isActive && (
              <motion.div
                layoutId="scope-switch-indicator"
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
              {showLabels && !compact && (
                <span className="hidden sm:inline">{option.label}</span>
              )}
              {showLabels && compact && (
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
// Icon-Only Variant
// ============================================================================

export function ScopeSwitchIcons({ className, showAll = false }: Omit<ScopeSwitchProps, 'compact' | 'showLabels'>) {
  return <ScopeSwitch className={className} showAll={showAll} showLabels={false} />;
}

// ============================================================================
// Compact Mobile Variant
// ============================================================================

export function ScopeSwitchCompact({ className, showAll = false }: Omit<ScopeSwitchProps, 'compact' | 'showLabels'>) {
  return <ScopeSwitch className={className} showAll={showAll} compact />;
}

// ============================================================================
// Dropdown Variant (for very small screens)
// ============================================================================

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ScopeSwitchDropdown({
  className,
  showAll = false,
}: Omit<ScopeSwitchProps, 'compact' | 'showLabels'>) {
  const scope = useSchedulingStore((state) => state.scope);
  const setScope = useSchedulingStore((state) => state.setScope);

  const options = showAll ? [...scopeOptions, allOption] : scopeOptions;

  return (
    <Select
      value={scope}
      onValueChange={(value) => setScope(value as Scope | 'all')}
    >
      <SelectTrigger className={cn('w-[120px]', className)}>
        <SelectValue placeholder="Scope" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => {
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
// Badge Indicator (shows current scope)
// ============================================================================

export function ScopeBadge({ className }: { className?: string }) {
  const scope = useSchedulingStore((state) => state.scope);
  const option = [...scopeOptions, allOption].find((opt) => opt.id === scope);

  if (!option) return null;

  const Icon = option.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground',
        className
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{option.label}</span>
    </div>
  );
}

// ============================================================================
// Scope Colors (for visual differentiation)
// ============================================================================

export const scopeColors: Record<Scope | 'all', { bg: string; text: string; border: string }> = {
  moi: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  eux: {
    bg: 'bg-purple-50 dark:bg-purple-950',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
  },
  nous: {
    bg: 'bg-green-50 dark:bg-green-950',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  all: {
    bg: 'bg-muted dark:bg-gray-950',
    text: 'text-muted-foreground dark:text-gray-400',
    border: 'border-border dark:border-gray-800',
  },
};

export function getScopeColor(scope: Scope | 'all') {
  return scopeColors[scope] || scopeColors.all;
}

export default ScopeSwitch;
