"use client";

/**
 * Quick Filters Component
 *
 * Chip-based quick filter toggles for common filter presets.
 */

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { QuickFilter } from "./types";
import { getQuickFilters } from "./registry";
import { useActiveQuickFilters, useViewActions } from "@/stores/views-store";

// ============================================================================
// Types
// ============================================================================

interface QuickFiltersProps {
  entityType: string;
  className?: string;
}

interface QuickFilterChipProps {
  filter: QuickFilter;
  isActive: boolean;
  onToggle: () => void;
}

// ============================================================================
// Quick Filter Chip
// ============================================================================

function QuickFilterChip({ filter, isActive, onToggle }: QuickFilterChipProps) {
  const Icon = filter.icon;

  return (
    <Button
      variant={isActive ? "default" : "outline"}
      size="sm"
      className={cn("h-8 rounded-full transition-all", isActive && "pl-2 pr-3")}
      onClick={onToggle}
    >
      {Icon && <Icon className="h-3.5 w-3.5 mr-1.5" />}
      <span className="text-xs">{filter.label}</span>
      {isActive && <X className="h-3 w-3 ml-1.5 hover:text-destructive" />}
    </Button>
  );
}

// ============================================================================
// Quick Filters Component
// ============================================================================

export function QuickFilters({ entityType, className }: QuickFiltersProps) {
  const preset = getQuickFilters(entityType);
  const activeFilters = useActiveQuickFilters(entityType);
  const { toggleQuickFilter, clearQuickFilters } = useViewActions();

  if (!preset || preset.filters.length === 0) {
    return null;
  }

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {preset.filters.map((filter) => (
        <QuickFilterChip
          key={filter.id}
          filter={filter}
          isActive={activeFilters.includes(filter.id)}
          onToggle={() => toggleQuickFilter(entityType, filter.id)}
        />
      ))}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => clearQuickFilters(entityType)}
        >
          Effacer tout
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Active Filters Summary
// ============================================================================

interface ActiveFiltersSummaryProps {
  entityType: string;
  className?: string;
}

export function ActiveFiltersSummary({
  entityType,
  className,
}: ActiveFiltersSummaryProps) {
  const preset = getQuickFilters(entityType);
  const activeFilters = useActiveQuickFilters(entityType);
  const { toggleQuickFilter, clearQuickFilters } = useViewActions();

  if (!preset || activeFilters.length === 0) {
    return null;
  }

  const activeFilterObjects = preset.filters.filter((f) =>
    activeFilters.includes(f.id),
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground">Filtres actifs:</span>
      {activeFilterObjects.map((filter) => (
        <Badge
          key={filter.id}
          variant="secondary"
          className="gap-1 pr-1 cursor-pointer hover:bg-destructive/10"
          onClick={() => toggleQuickFilter(entityType, filter.id)}
        >
          {filter.label}
          <X className="h-3 w-3" />
        </Badge>
      ))}
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        onClick={() => clearQuickFilters(entityType)}
      >
        Effacer tout
      </Button>
    </div>
  );
}

// ============================================================================
// Compact Quick Filters (for toolbar)
// ============================================================================

interface CompactQuickFiltersProps {
  entityType: string;
  maxVisible?: number;
  className?: string;
}

export function CompactQuickFilters({
  entityType,
  maxVisible = 3,
  className,
}: CompactQuickFiltersProps) {
  const preset = getQuickFilters(entityType);
  const activeFilters = useActiveQuickFilters(entityType);
  const { toggleQuickFilter } = useViewActions();

  if (!preset) return null;

  const visibleFilters = preset.filters.slice(0, maxVisible);
  const hiddenCount = preset.filters.length - maxVisible;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {visibleFilters.map((filter) => {
        const Icon = filter.icon;
        const isActive = activeFilters.includes(filter.id);
        return (
          <Button
            key={filter.id}
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => toggleQuickFilter(entityType, filter.id)}
            title={filter.label}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
          </Button>
        );
      })}
      {hiddenCount > 0 && (
        <Badge variant="outline" className="text-[10px]">
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
}
