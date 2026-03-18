'use client';

/**
 * FAB Component (Floating Action Button)
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSchedulingNavigation } from '@/stores/scheduling-store';
import type { TabType } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface FABProps {
  className?: string;
  onCreateEvent?: () => void;
  onCreateTask?: () => void;
  onCreateBooking?: () => void;
  onQuickCreate?: () => void;
}

interface FABAction {
  id: string;
  icon: React.ElementType;
  label: string;
  color: string;
  onClick: () => void;
}

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
  onCreateEvent,
  onCreateTask,
  onCreateBooking,
  onQuickCreate,
}: FABProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { activeTab } = useSchedulingNavigation();

  // Define actions based on current tab
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

    // Event (for my-day tab)
    if (activeTab === 'my-day' && onCreateEvent) {
      result.push({
        id: 'event',
        icon: Calendar,
        label: 'Événement',
        color: 'bg-blue-500 hover:bg-blue-600',
        onClick: () => {
          onCreateEvent();
          setIsExpanded(false);
        },
      });
    }

    // Task (for tasks tab)
    if (activeTab === 'tasks' && onCreateTask) {
      result.push({
        id: 'task',
        icon: CheckSquare,
        label: 'Tâche',
        color: 'bg-green-500 hover:bg-green-600',
        onClick: () => {
          onCreateTask();
          setIsExpanded(false);
        },
      });
    }

    // Booking (for resources tab)
    if (activeTab === 'resources' && onCreateBooking) {
      result.push({
        id: 'booking',
        icon: Building2,
        label: 'Réservation',
        color: 'bg-orange-500 hover:bg-orange-600',
        onClick: () => {
          onCreateBooking();
          setIsExpanded(false);
        },
      });
    }

    // Default event creation for any tab
    if (!result.some((a) => a.id === 'event') && onCreateEvent) {
      result.push({
        id: 'event',
        icon: Calendar,
        label: 'Événement',
        color: 'bg-blue-500 hover:bg-blue-600',
        onClick: () => {
          onCreateEvent();
          setIsExpanded(false);
        },
      });
    }

    return result;
  }, [activeTab, onCreateEvent, onCreateTask, onCreateBooking, onQuickCreate]);

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
