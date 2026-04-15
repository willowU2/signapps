"use client";

/**
 * Quick Filters Component
 *
 * Pre-defined filter buttons for common scheduling queries.
 */

import * as React from "react";
import {
  addDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isToday,
  isTomorrow,
  isThisWeek,
  isThisMonth,
} from "date-fns";
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  User,
  MapPin,
  Tag,
  Filter,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type {
  SchedulingFilters,
  BlockType,
  BlockStatus,
  Priority,
} from "@/lib/scheduling/types/scheduling";

// ============================================================================
// Types
// ============================================================================

interface QuickFiltersProps {
  /** Current active filters */
  filters: SchedulingFilters;
  /** Callback when filters change */
  onFiltersChange: (filters: SchedulingFilters) => void;
  /** Available calendars */
  calendars?: Array<{ id: string; name: string; color: string }>;
  /** Available tags */
  availableTags?: string[];
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

interface QuickFilterPreset {
  id: string;
  label: string;
  icon: React.ElementType;
  filters: Partial<SchedulingFilters>;
  color?: string;
}

// ============================================================================
// Presets
// ============================================================================

const QUICK_FILTER_PRESETS: QuickFilterPreset[] = [
  {
    id: "all",
    label: "Tout",
    icon: Sparkles,
    filters: {},
  },
  {
    id: "today",
    label: "Aujourd'hui",
    icon: Calendar,
    filters: {}, // Will be computed dynamically
    color: "blue",
  },
  {
    id: "this-week",
    label: "Cette semaine",
    icon: Calendar,
    filters: {},
    color: "purple",
  },
  {
    id: "urgent",
    label: "Urgent",
    icon: AlertTriangle,
    filters: {
      priorities: ["urgent", "high"],
    },
    color: "red",
  },
  {
    id: "my-events",
    label: "Mes événements",
    icon: User,
    filters: {}, // Will filter by current user
    color: "green",
  },
];

const TYPE_OPTIONS: Array<{ type: BlockType; label: string }> = [
  { type: "event", label: "Événements" },
  { type: "task", label: "Tâches" },
  { type: "booking", label: "Réservations" },
];

const STATUS_OPTIONS: Array<{ status: BlockStatus; label: string }> = [
  { status: "confirmed", label: "Confirmé" },
  { status: "tentative", label: "Provisoire" },
  { status: "cancelled", label: "Annulé" },
  { status: "completed", label: "Terminé" },
];

const PRIORITY_OPTIONS: Array<{
  priority: Priority;
  label: string;
  color: string;
}> = [
  { priority: "urgent", label: "Urgent", color: "text-red-600" },
  { priority: "high", label: "Haute", color: "text-orange-600" },
  { priority: "medium", label: "Moyenne", color: "text-blue-600" },
  { priority: "low", label: "Basse", color: "text-muted-foreground" },
];

// ============================================================================
// Component
// ============================================================================

export function QuickFilters({
  filters,
  onFiltersChange,
  calendars = [],
  availableTags = [],
  compact = false,
  className,
}: QuickFiltersProps) {
  // Get the currently active preset
  const activePreset = React.useMemo(() => {
    // Check if any preset matches the current filters
    if (
      !filters.types?.length &&
      !filters.statuses?.length &&
      !filters.priorities?.length &&
      !filters.tags?.length
    ) {
      return "all";
    }
    if (
      filters.priorities?.includes("urgent") ||
      filters.priorities?.includes("high")
    ) {
      return "urgent";
    }
    return null;
  }, [filters]);

  // Apply a preset
  const applyPreset = (preset: QuickFilterPreset) => {
    if (preset.id === "all") {
      onFiltersChange({
        showWeekends: filters.showWeekends,
        showAllDay: filters.showAllDay,
      });
    } else {
      onFiltersChange({
        ...filters,
        ...preset.filters,
      });
    }
  };

  // Toggle type filter
  const toggleType = (type: BlockType) => {
    const types = filters.types || [];
    onFiltersChange({
      ...filters,
      types: types.includes(type)
        ? types.filter((t) => t !== type)
        : [...types, type],
    });
  };

  // Toggle status filter
  const toggleStatus = (status: BlockStatus) => {
    const statuses = filters.statuses || [];
    onFiltersChange({
      ...filters,
      statuses: statuses.includes(status)
        ? statuses.filter((s) => s !== status)
        : [...statuses, status],
    });
  };

  // Toggle priority filter
  const togglePriority = (priority: Priority) => {
    const priorities = filters.priorities || [];
    onFiltersChange({
      ...filters,
      priorities: priorities.includes(priority)
        ? priorities.filter((p) => p !== priority)
        : [...priorities, priority],
    });
  };

  // Toggle tag filter
  const toggleTag = (tag: string) => {
    const tags = filters.tags || [];
    onFiltersChange({
      ...filters,
      tags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
    });
  };

  // Toggle calendar filter
  const toggleCalendar = (calendarId: string) => {
    const calendarIds = filters.calendarIds || [];
    onFiltersChange({
      ...filters,
      calendarIds: calendarIds.includes(calendarId)
        ? calendarIds.filter((c) => c !== calendarId)
        : [...calendarIds, calendarId],
    });
  };

  // Clear all filters
  const clearFilters = () => {
    onFiltersChange({
      showWeekends: filters.showWeekends,
      showAllDay: filters.showAllDay,
    });
  };

  // Count active filters
  const activeFilterCount =
    (filters.types?.length || 0) +
    (filters.statuses?.length || 0) +
    (filters.priorities?.length || 0) +
    (filters.tags?.length || 0) +
    (filters.calendarIds?.length || 0);

  if (compact) {
    return (
      <CompactFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
        calendars={calendars}
        availableTags={availableTags}
        className={className}
      />
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Quick preset buttons */}
      <ScrollArea className="w-full">
        <div className="flex items-center gap-2 pb-2">
          {QUICK_FILTER_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              variant={activePreset === preset.id ? "default" : "outline"}
              size="sm"
              onClick={() => applyPreset(preset)}
              className={cn(
                "shrink-0",
                activePreset === preset.id &&
                  preset.color === "red" &&
                  "bg-red-600 hover:bg-red-700",
                activePreset === preset.id &&
                  preset.color === "blue" &&
                  "bg-blue-600 hover:bg-blue-700",
                activePreset === preset.id &&
                  preset.color === "purple" &&
                  "bg-purple-600 hover:bg-purple-700",
                activePreset === preset.id &&
                  preset.color === "green" &&
                  "bg-green-600 hover:bg-green-700",
              )}
            >
              <preset.icon className="h-3 w-3 mr-1.5" />
              {preset.label}
            </Button>
          ))}

          {/* More filters popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0">
                <Filter className="h-3 w-3 mr-1.5" />
                Plus de filtres
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-4">
                {/* Types */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Type
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {TYPE_OPTIONS.map(({ type, label }) => (
                      <Button
                        key={type}
                        variant={
                          filters.types?.includes(type) ? "default" : "outline"
                        }
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => toggleType(type)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Statut
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map(({ status, label }) => (
                      <Button
                        key={status}
                        variant={
                          filters.statuses?.includes(status)
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => toggleStatus(status)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Priorité
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRIORITY_OPTIONS.map(({ priority, label, color }) => (
                      <Button
                        key={priority}
                        variant={
                          filters.priorities?.includes(priority)
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        className={cn(
                          "h-7 text-xs",
                          !filters.priorities?.includes(priority) && color,
                        )}
                        onClick={() => togglePriority(priority)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Calendars */}
                {calendars.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Calendriers
                    </Label>
                    <div className="space-y-1.5">
                      {calendars.map((cal) => (
                        <div key={cal.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`cal-${cal.id}`}
                            checked={
                              !filters.calendarIds?.length ||
                              filters.calendarIds.includes(cal.id)
                            }
                            onCheckedChange={() => toggleCalendar(cal.id)}
                          />
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: cal.color }}
                          />
                          <Label htmlFor={`cal-${cal.id}`} className="text-sm">
                            {cal.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {availableTags.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Tags
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {availableTags.slice(0, 10).map((tag) => (
                        <Badge
                          key={tag}
                          variant={
                            filters.tags?.includes(tag) ? "default" : "outline"
                          }
                          className="cursor-pointer"
                          onClick={() => toggleTag(tag)}
                        >
                          <Tag className="h-2.5 w-2.5 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clear */}
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={clearFilters}
                  >
                    <X className="h-3 w-3 mr-1.5" />
                    Effacer tous les filtres
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Active filters badges */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground">Filtres actifs:</span>
          {filters.types?.map((type) => (
            <Badge key={type} variant="secondary" className="gap-1">
              {TYPE_OPTIONS.find((t) => t.type === type)?.label}
              <button
                type="button"
                onClick={() => toggleType(type)}
                className="hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          {filters.priorities?.map((priority) => (
            <Badge key={priority} variant="secondary" className="gap-1">
              {PRIORITY_OPTIONS.find((p) => p.priority === priority)?.label}
              <button
                type="button"
                onClick={() => togglePriority(priority)}
                className="hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          {filters.tags?.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              #{tag}
              <button
                type="button"
                onClick={() => toggleTag(tag)}
                className="hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact Filters (for mobile/small screens)
// ============================================================================

interface CompactFiltersProps {
  filters: SchedulingFilters;
  onFiltersChange: (filters: SchedulingFilters) => void;
  calendars: Array<{ id: string; name: string; color: string }>;
  availableTags: string[];
  className?: string;
}

function CompactFilters({
  filters,
  onFiltersChange,
  className,
}: CompactFiltersProps) {
  const activeFilterCount =
    (filters.types?.length || 0) +
    (filters.statuses?.length || 0) +
    (filters.priorities?.length || 0) +
    (filters.tags?.length || 0);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filtrer
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-3">
            {/* Type toggles */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <div className="flex flex-wrap gap-1">
                {TYPE_OPTIONS.map(({ type, label }) => (
                  <Badge
                    key={type}
                    variant={
                      filters.types?.includes(type) ? "default" : "outline"
                    }
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      const types = filters.types || [];
                      onFiltersChange({
                        ...filters,
                        types: types.includes(type)
                          ? types.filter((t) => t !== type)
                          : [...types, type],
                      });
                    }}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Priority toggles */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Priorité</Label>
              <div className="flex flex-wrap gap-1">
                {PRIORITY_OPTIONS.map(({ priority, label }) => (
                  <Badge
                    key={priority}
                    variant={
                      filters.priorities?.includes(priority)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      const priorities = filters.priorities || [];
                      onFiltersChange({
                        ...filters,
                        priorities: priorities.includes(priority)
                          ? priorities.filter((p) => p !== priority)
                          : [...priorities, priority],
                      });
                    }}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Clear button */}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() =>
                  onFiltersChange({
                    showWeekends: filters.showWeekends,
                    showAllDay: filters.showAllDay,
                  })
                }
              >
                <X className="h-3 w-3 mr-1" />
                Effacer
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default QuickFilters;
