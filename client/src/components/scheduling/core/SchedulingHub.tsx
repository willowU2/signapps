'use client';

/**
 * SchedulingHub Component
 * Story 1.1.3: Scheduling Hub Container
 *
 * Main container for the Unified Scheduling UI.
 * Manages views, sidebar, scope selection, and keyboard shortcuts.
 * Keyboard shortcut: Cmd/Ctrl+K for command palette
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Command,
  Plus,
  User,
  Users,
  HandshakeIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCalendarStore } from '@/stores/scheduling/calendar-store';
import { useSchedulingStore } from '@/stores/scheduling/scheduling-store';
import { usePreferencesStore } from '@/stores/scheduling/preferences-store';
import { ViewSwitcher, ViewSwitcherDropdown } from './ViewSwitcher';
import { DateNavigator, DateNavigatorCompact } from './DateNavigator';
import { BottomTabs, BottomTabsSpacer, MobileScopeSwitcher } from '../mobile/BottomTabs';
import { FAB } from '../quick-actions/FAB';
import { MiniMonthView } from '../views/MonthView';
import type { ScopeType, ViewType } from '@/lib/scheduling/types';

// ============================================================================
// Types
// ============================================================================

interface SchedulingHubProps {
  children?: React.ReactNode;
  className?: string;
  onCreateItem?: (type: string) => void;
  onQuickCreate?: () => void;
}

interface ScopeConfig {
  id: ScopeType;
  label: string;
  icon: React.ElementType;
  shortcut: string;
  description: string;
}

// ============================================================================
// Scope Configuration (MOI / EUX / NOUS)
// ============================================================================

const scopes: ScopeConfig[] = [
  { id: 'moi', label: 'Moi', icon: User, shortcut: 'M', description: 'Mes événements personnels' },
  { id: 'eux', label: 'Équipe', icon: Users, shortcut: 'E', description: 'Événements de l\'équipe' },
  { id: 'nous', label: 'Nous', icon: HandshakeIcon, shortcut: 'N', description: 'Collaboration' },
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
  const scope = useSchedulingStore((state) => state.scope);
  const setScope = useSchedulingStore((state) => state.setScope);
  const openCommandPalette = usePreferencesStore((state) => state.openCommandPalette);

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

      {/* Mini Calendar */}
      <AnimatePresence mode="wait">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-3 border-b overflow-hidden"
          >
            <MiniMonthView />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scope Selection (MOI / EUX / NOUS) */}
      <nav className="flex-1 space-y-1 p-2">
        <div className="mb-3 px-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {collapsed ? '' : 'Portée'}
          </span>
        </div>
        {scopes.map((scopeItem) => {
          const Icon = scopeItem.icon;
          const isActive = scope === scopeItem.id;

          return (
            <Tooltip key={scopeItem.id} delayDuration={collapsed ? 100 : 700}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setScope(scopeItem.id)}
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
                        {scopeItem.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {!collapsed && (
                    <kbd className="ml-auto hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                      {scopeItem.shortcut}
                    </kbd>
                  )}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">
                  <p>
                    {scopeItem.label}{' '}
                    <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">
                      {scopeItem.shortcut}
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
              onClick={openCommandPalette}
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

function Header({ onCreateItem }: { onCreateItem?: (type: string) => void }) {
  const scope = useSchedulingStore((state) => state.scope);
  const currentScope = scopes.find((s) => s.id === scope);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      {/* Left: Scope indicator (mobile) + Date Navigator */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 md:hidden">
          {currentScope && (
            <>
              <currentScope.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{currentScope.label}</span>
            </>
          )}
        </div>
        <DateNavigator className="hidden sm:flex" />
        <DateNavigatorCompact className="flex sm:hidden" />
      </div>

      {/* Right: View Switcher + Actions */}
      <div className="flex items-center gap-2">
        <ViewSwitcher className="hidden md:inline-flex" />
        <ViewSwitcherDropdown className="inline-flex md:hidden" />

        <Button
          size="sm"
          className="gap-1.5 hidden sm:flex"
          onClick={() => onCreateItem?.('event')}
        >
          <Plus className="h-4 w-4" />
          <span>Nouveau</span>
        </Button>
      </div>
    </header>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SchedulingHub({
  children,
  className,
  onCreateItem,
  onQuickCreate,
}: SchedulingHubProps) {
  const isSidebarOpen = usePreferencesStore((state) => state.isSidebarOpen);
  const toggleSidebar = usePreferencesStore((state) => state.toggleSidebar);
  const toggleCommandPalette = usePreferencesStore((state) => state.toggleCommandPalette);
  const setScope = useSchedulingStore((state) => state.setScope);
  const setView = useCalendarStore((state) => state.setView);

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

      // Scope shortcuts (MOI / EUX / NOUS)
      switch (e.key.toLowerCase()) {
        case 'm':
          e.preventDefault();
          setScope('moi');
          break;
        case 'e':
          e.preventDefault();
          setScope('eux');
          break;
        case 'n':
          e.preventDefault();
          setScope('nous');
          break;
        case '[':
          e.preventDefault();
          toggleSidebar();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setScope, toggleSidebar, toggleCommandPalette, setView]);

  return (
    <div className={cn('flex h-full bg-background', className)}>
      {/* Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar collapsed={!isSidebarOpen} onToggle={toggleSidebar} />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onCreateItem={onCreateItem} />

        {/* Mobile Scope Switcher */}
        <div className="p-2 md:hidden border-b">
          <MobileScopeSwitcher />
        </div>

        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          {children || (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <p>Sélectionnez une vue pour commencer</p>
            </div>
          )}
        </main>

        {/* Mobile Bottom Tabs */}
        <BottomTabs />

        {/* Floating Action Button */}
        <FAB
          onCreateItem={onCreateItem as (type: any) => void}
          onQuickCreate={onQuickCreate}
        />
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
    <div className={cn('h-full overflow-hidden', className)}>
      {children}
    </div>
  );
}

export default SchedulingHub;
