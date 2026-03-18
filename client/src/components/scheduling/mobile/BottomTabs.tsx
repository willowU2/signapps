'use client';

/**
 * BottomTabs Component
 *
 * Mobile bottom navigation tabs for the Scheduling UI.
 * Replaces sidebar on small screens.
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  CheckSquare,
  Building2,
  Users,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSchedulingNavigation, useSchedulingUI } from '@/stores/scheduling-store';
import type { TabType } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface BottomTabsProps {
  className?: string;
}

interface TabConfig {
  id: TabType | 'search';
  label: string;
  icon: React.ElementType;
}

// ============================================================================
// Tab Configuration
// ============================================================================

const tabs: TabConfig[] = [
  { id: 'my-day', label: 'Ma journée', icon: CalendarDays },
  { id: 'tasks', label: 'Tâches', icon: CheckSquare },
  { id: 'search', label: 'Recherche', icon: Search },
  { id: 'resources', label: 'Ressources', icon: Building2 },
  { id: 'team', label: 'Équipe', icon: Users },
];

// ============================================================================
// Tab Item Component
// ============================================================================

function TabItem({
  tab,
  isActive,
  onClick,
}: {
  tab: TabConfig;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2',
        'transition-colors duration-200',
        isActive ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      {/* Active Indicator */}
      {isActive && (
        <motion.div
          layoutId="bottom-tab-indicator"
          className="absolute -top-0.5 h-0.5 w-8 rounded-full bg-primary"
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 35,
          }}
        />
      )}

      <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
      <span className={cn('text-[10px] font-medium', isActive && 'text-primary')}>
        {tab.label}
      </span>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BottomTabs({ className }: BottomTabsProps) {
  const { activeTab, setActiveTab } = useSchedulingNavigation();
  const { openCommandPalette } = useSchedulingUI();

  const handleTabClick = (tabId: TabConfig['id']) => {
    if (tabId === 'search') {
      openCommandPalette();
    } else {
      setActiveTab(tabId);
    }
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'flex items-stretch border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        'safe-bottom', // For iOS safe area
        'md:hidden', // Hide on desktop
        className
      )}
      role="navigation"
      aria-label="Navigation principale"
    >
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id !== 'search' && activeTab === tab.id}
          onClick={() => handleTabClick(tab.id)}
        />
      ))}
    </nav>
  );
}

// ============================================================================
// With Safe Area Spacer
// ============================================================================

export function BottomTabsSpacer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-16 md:hidden', // Match bottom tabs height + safe area
        className
      )}
    />
  );
}

export default BottomTabs;
