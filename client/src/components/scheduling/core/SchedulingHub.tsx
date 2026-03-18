'use client';

/**
 * SchedulingHub Component
 *
 * Main container for the Unified Scheduling UI.
 * Manages tabs, sidebar, and routes between views.
 * Keyboard shortcut: Cmd/Ctrl+K for command palette
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  CheckSquare,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
  Command,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchedulingStore, useSchedulingNavigation, useSchedulingUI } from '@/stores/scheduling-store';
import { ViewSwitcher, ViewSwitcherDropdown } from './ViewSwitcher';
import { DateNavigator, DateNavigatorCompact } from './DateNavigator';
import type { TabType } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface SchedulingHubProps {
  children?: React.ReactNode;
  className?: string;
}

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ElementType;
  shortcut: string;
}

// ============================================================================
// Tab Configuration
// ============================================================================

const tabs: TabConfig[] = [
  { id: 'my-day', label: 'Ma Journée', icon: CalendarDays, shortcut: 'D' },
  { id: 'tasks', label: 'Tâches', icon: CheckSquare, shortcut: 'T' },
  { id: 'resources', label: 'Ressources', icon: Building2, shortcut: 'R' },
  { id: 'team', label: 'Équipe', icon: Users, shortcut: 'E' },
];

// ============================================================================
// Sidebar Component
// ============================================================================

function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { activeTab, setActiveTab } = useSchedulingNavigation();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'flex h-full flex-col border-r bg-card',
        'relative z-10'
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-3">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-lg font-semibold"
            >
              Planning
            </motion.h1>
          )}
        </AnimatePresence>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8"
          title={collapsed ? 'Développer' : 'Réduire'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <Tooltip key={tab.id} delayDuration={collapsed ? 100 : 700}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive && 'bg-accent text-accent-foreground',
                    collapsed && 'justify-center px-0'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <AnimatePresence mode="wait">
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        {tab.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {!collapsed && (
                    <kbd className="ml-auto hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                      {tab.shortcut}
                    </kbd>
                  )}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">
                  <p>
                    {tab.label}{' '}
                    <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">
                      {tab.shortcut}
                    </kbd>
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="border-t p-2">
        <Tooltip delayDuration={collapsed ? 100 : 700}>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start gap-2',
                collapsed && 'justify-center px-0'
              )}
            >
              <Command className="h-4 w-4" />
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    Commandes
                  </motion.span>
                )}
              </AnimatePresence>
              {!collapsed && (
                <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              )}
            </Button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right">
              <p>
                Commandes <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">⌘K</kbd>
              </p>
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </motion.aside>
  );
}

// ============================================================================
// Header Component
// ============================================================================

function Header() {
  const { activeTab } = useSchedulingNavigation();
  const currentTab = tabs.find((t) => t.id === activeTab);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      {/* Left: Tab title (mobile) + Date Navigator */}
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold sm:hidden">
          {currentTab?.label}
        </h2>
        <DateNavigator className="hidden sm:flex" />
        <DateNavigatorCompact className="flex sm:hidden" />
      </div>

      {/* Right: View Switcher + Actions */}
      <div className="flex items-center gap-2">
        <ViewSwitcher className="hidden md:inline-flex" />
        <ViewSwitcherDropdown className="inline-flex md:hidden" />

        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nouveau</span>
        </Button>
      </div>
    </header>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SchedulingHub({ children, className }: SchedulingHubProps) {
  const { isSidebarCollapsed, toggleSidebar, toggleCommandPalette } = useSchedulingUI();
  const { setActiveTab } = useSchedulingNavigation();

  // Global keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Don't trigger with modifiers (except for Cmd+K above)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      // Tab shortcuts
      switch (e.key.toLowerCase()) {
        case 'd':
          e.preventDefault();
          setActiveTab('my-day');
          break;
        case 'r':
          e.preventDefault();
          setActiveTab('resources');
          break;
        case 'e':
          e.preventDefault();
          setActiveTab('team');
          break;
        // Note: 't' is reserved for "today" in DateNavigator
        // Tasks tab uses Shift+T
        case 't':
          if (e.shiftKey) {
            e.preventDefault();
            setActiveTab('tasks');
          }
          break;
        case '[':
          e.preventDefault();
          toggleSidebar();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, toggleSidebar, toggleCommandPalette]);

  return (
    <div className={cn('flex h-full bg-background', className)}>
      {/* Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar collapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          {children || (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <p>Sélectionnez une vue pour commencer</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// Content Wrapper for Views
// ============================================================================

export function SchedulingContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('h-full', className)}>
      {children}
    </div>
  );
}

export default SchedulingHub;
