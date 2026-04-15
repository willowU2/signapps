"use client";

/**
 * BottomTabs Component
 * Story 1.5.1: Mobile Bottom Tabs
 *
 * Mobile bottom navigation tabs for the Scheduling UI.
 * Replaces sidebar on small screens.
 */

import * as React from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckSquare,
  Building2,
  Users,
  Search,
  User,
  HandshakeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCalendarStore } from "@/stores/scheduling/calendar-store";
import { useSchedulingStore } from "@/stores/scheduling/scheduling-store";
import { usePreferencesStore } from "@/stores/scheduling/preferences-store";
import type { ViewType, ScopeType } from "@/lib/scheduling/types";

// ============================================================================
// Types
// ============================================================================

interface BottomTabsProps {
  className?: string;
  variant?: "views" | "scopes";
}

interface TabConfig {
  id: string;
  label: string;
  icon: React.ElementType;
}

// ============================================================================
// Tab Configuration
// ============================================================================

const viewTabs: TabConfig[] = [
  { id: "day", label: "Jour", icon: CalendarDays },
  { id: "week", label: "Semaine", icon: CalendarDays },
  { id: "agenda", label: "Agenda", icon: CheckSquare },
  { id: "search", label: "Recherche", icon: Search },
];

const scopeTabs: TabConfig[] = [
  { id: "moi", label: "Moi", icon: User },
  { id: "eux", label: "Équipe", icon: Users },
  { id: "nous", label: "Nous", icon: HandshakeIcon },
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
        "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2",
        "transition-colors duration-200",
        isActive ? "text-primary" : "text-muted-foreground",
      )}
    >
      {/* Active Indicator */}
      {isActive && (
        <motion.div
          layoutId="bottom-tab-indicator"
          className="absolute -top-0.5 h-0.5 w-8 rounded-full bg-primary"
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 35,
          }}
        />
      )}

      <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
      <span
        className={cn("text-[10px] font-medium", isActive && "text-primary")}
      >
        {tab.label}
      </span>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BottomTabs({ className, variant = "views" }: BottomTabsProps) {
  const view = useCalendarStore((state) => state.view);
  const setView = useCalendarStore((state) => state.setView);
  const scope = useSchedulingStore((state) => state.scope);
  const setScope = useSchedulingStore((state) => state.setScope);
  const openCommandPalette = usePreferencesStore(
    (state) => state.openCommandPalette,
  );

  const tabs = variant === "views" ? viewTabs : scopeTabs;
  const activeId = variant === "views" ? view : scope;

  const handleTabClick = (tabId: string) => {
    if (tabId === "search") {
      openCommandPalette();
    } else if (variant === "views") {
      setView(tabId as ViewType);
    } else {
      setScope(tabId as ScopeType);
    }
  };

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40",
        "flex items-stretch border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        "safe-bottom", // For iOS safe area
        "md:hidden", // Hide on desktop
        className,
      )}
      role="navigation"
      aria-label="Navigation principale"
    >
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id !== "search" && activeId === tab.id}
          onClick={() => handleTabClick(tab.id)}
        />
      ))}
    </nav>
  );
}

/**
 * Scope Switcher for mobile - horizontal pills at top
 */
export function MobileScopeSwitcher({ className }: { className?: string }) {
  const scope = useSchedulingStore((state) => state.scope);
  const setScope = useSchedulingStore((state) => state.setScope);

  return (
    <div
      className={cn(
        "flex items-center gap-1 p-1 rounded-lg bg-muted md:hidden",
        className,
      )}
    >
      {scopeTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = scope === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setScope(tab.id as ScopeType)}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors",
              isActive ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {isActive && (
              <motion.div
                layoutId="mobile-scope-indicator"
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1">
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// With Safe Area Spacer
// ============================================================================

export function BottomTabsSpacer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-16 md:hidden", // Match bottom tabs height + safe area
        className,
      )}
    />
  );
}

export default BottomTabs;
