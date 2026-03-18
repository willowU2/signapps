'use client';

/**
 * FAB Component (Floating Action Button)
 * Story 1.5.2: FAB Component
 *
 * Quick action button for creating new events.
 * Expands to show multiple action options.
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  X,
  Calendar,
  CheckSquare,
  Building2,
  Sparkles,
  Flag,
  Bell,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCalendarStore } from '@/stores/scheduling/calendar-store';
import { useSchedulingStore } from '@/stores/scheduling/scheduling-store';
import type { ViewType, TimeItemType } from '@/lib/scheduling/types';

// ============================================================================
// Types
// ============================================================================

interface FABProps {
  className?: string;
  onCreateItem?: (type: TimeItemType) => void;
  onQuickCreate?: () => void;
}

interface FABAction {
  id: TimeItemType | 'quick-create';
  icon: React.ElementType;
  label: string;
  color: string;
  onClick: () => void;
}

// ============================================================================
// Action Configs
// ============================================================================

const actionConfigs: Record<TimeItemType, { icon: React.ElementType; label: string; color: string }> = {
  event: { icon: Calendar, label: 'Événement', color: 'bg-blue-500 hover:bg-blue-600' },
  task: { icon: CheckSquare, label: 'Tâche', color: 'bg-green-500 hover:bg-green-600' },
  booking: { icon: Building2, label: 'Réservation', color: 'bg-orange-500 hover:bg-orange-600' },
  shift: { icon: Calendar, label: 'Shift', color: 'bg-cyan-500 hover:bg-cyan-600' },
  milestone: { icon: Flag, label: 'Jalon', color: 'bg-purple-500 hover:bg-purple-600' },
  reminder: { icon: Bell, label: 'Rappel', color: 'bg-yellow-500 hover:bg-yellow-600' },
  blocker: { icon: XCircle, label: 'Blocage', color: 'bg-red-500 hover:bg-red-600' },
};

// ============================================================================
// FAB Action Button
// ============================================================================

function FABActionButton({
  action,
  index,
  isVisible,
}: {
  action: FABAction;
  index: number;
  isVisible: boolean;
}) {
  const Icon = action.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0, y: 20 }}
      animate={
        isVisible
          ? {
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { delay: index * 0.05 },
            }
          : { opacity: 0, scale: 0, y: 20 }
      }
      className="flex items-center gap-2"
    >
      <span className="rounded-lg bg-background px-2 py-1 text-xs font-medium shadow-sm border">
        {action.label}
      </span>
      <Button
        size="icon"
        className={cn('h-10 w-10 rounded-full shadow-lg', action.color)}
        onClick={action.onClick}
      >
        <Icon className="h-5 w-5" />
      </Button>
    </motion.div>
  );
}

// ============================================================================
// Main FAB Component
// ============================================================================

export function FAB({
  className,
  onCreateItem,
  onQuickCreate,
}: FABProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const view = useCalendarStore((state) => state.view);
  const scope = useSchedulingStore((state) => state.scope);

  // Define actions based on current view and scope
  const actions: FABAction[] = React.useMemo(() => {
    const result: FABAction[] = [];

    // Quick create (AI-powered) is always first
    if (onQuickCreate) {
      result.push({
        id: 'quick-create',
        icon: Sparkles,
        label: 'Création rapide',
        color: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
        onClick: () => {
          onQuickCreate();
          setIsExpanded(false);
        },
      });
    }

    if (!onCreateItem) return result;

    // Context-aware actions based on view
    if (view === 'day' || view === 'week' || view === 'month') {
      result.push({
        id: 'event',
        ...actionConfigs.event,
        onClick: () => {
          onCreateItem('event');
          setIsExpanded(false);
        },
      });
    }

    if (view === 'kanban' || view === 'agenda') {
      result.push({
        id: 'task',
        ...actionConfigs.task,
        onClick: () => {
          onCreateItem('task');
          setIsExpanded(false);
        },
      });
    }

    // Show booking for EUX scope (team resources)
    if (scope === 'eux') {
      result.push({
        id: 'booking',
        ...actionConfigs.booking,
        onClick: () => {
          onCreateItem('booking');
          setIsExpanded(false);
        },
      });
    }

    // Show shift for roster view
    if (view === 'roster') {
      result.push({
        id: 'shift',
        ...actionConfigs.shift,
        onClick: () => {
          onCreateItem('shift');
          setIsExpanded(false);
        },
      });
    }

    // Add reminder as a common option
    result.push({
      id: 'reminder',
      ...actionConfigs.reminder,
      onClick: () => {
        onCreateItem('reminder');
        setIsExpanded(false);
      },
    });

    // Blocker for focus view
    if (view === 'focus') {
      result.push({
        id: 'blocker',
        ...actionConfigs.blocker,
        onClick: () => {
          onCreateItem('blocker');
          setIsExpanded(false);
        },
      });
    }

    return result;
  }, [view, scope, onCreateItem, onQuickCreate]);

  // Close on escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // Close when clicking outside
  const handleBackdropClick = () => {
    setIsExpanded(false);
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={handleBackdropClick}
          />
        )}
      </AnimatePresence>

      {/* FAB Container */}
      <div
        className={cn(
          'fixed z-50',
          'right-4 bottom-20 md:right-6 md:bottom-6', // Above bottom tabs on mobile
          className
        )}
      >
        {/* Action Buttons */}
        <AnimatePresence>
          {isExpanded && (
            <div className="absolute bottom-16 right-0 flex flex-col items-end gap-2 mb-2">
              {actions.map((action, index) => (
                <FABActionButton
                  key={action.id}
                  action={action}
                  index={index}
                  isVisible={isExpanded}
                />
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Main FAB */}
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button
            size="icon"
            className={cn(
              'h-14 w-14 rounded-full shadow-lg',
              isExpanded
                ? 'bg-destructive hover:bg-destructive/90'
                : 'bg-primary hover:bg-primary/90'
            )}
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Fermer' : 'Créer'}
            aria-expanded={isExpanded}
          >
            <motion.div
              animate={{ rotate: isExpanded ? 45 : 0 }}
              transition={{ duration: 0.2 }}
            >
              {isExpanded ? (
                <X className="h-6 w-6" />
              ) : (
                <Plus className="h-6 w-6" />
              )}
            </motion.div>
          </Button>
        </motion.div>
      </div>
    </>
  );
}

// ============================================================================
// Simple FAB (single action)
// ============================================================================

export function SimpleFAB({
  className,
  onClick,
  icon: Icon = Plus,
  label = 'Créer',
}: {
  className?: string;
  onClick: () => void;
  icon?: React.ElementType;
  label?: string;
}) {
  return (
    <Button
      size="icon"
      className={cn(
        'fixed z-50 h-14 w-14 rounded-full shadow-lg',
        'right-4 bottom-20 md:right-6 md:bottom-6',
        'bg-primary hover:bg-primary/90',
        className
      )}
      onClick={onClick}
      aria-label={label}
    >
      <Icon className="h-6 w-6" />
    </Button>
  );
}

export default FAB;
