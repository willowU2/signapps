/**
 * Filter Chip Component
 *
 * Affiche un filtre actif avec possibilité de le modifier ou supprimer.
 */

"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ActiveFilter, FilterConfig, FilterOperator } from "./types";

// ============================================================================
// Operator Labels
// ============================================================================

export const operatorLabels: Record<FilterOperator, string> = {
  // Text
  equals: "=",
  contains: "contient",
  starts_with: "commence par",
  ends_with: "termine par",
  is_empty: "est vide",
  // Number
  gt: ">",
  lt: "<",
  gte: ">=",
  lte: "<=",
  between: "entre",
  // Date
  before: "avant",
  after: "après",
  last_n_days: "derniers jours",
  this_week: "cette semaine",
  this_month: "ce mois",
  // Select
  in: "dans",
  not_in: "pas dans",
  // Boolean
  is_true: "oui",
  is_false: "non",
};

// ============================================================================
// Filter Chip
// ============================================================================

interface FilterChipProps {
  /** Active filter data */
  filter: ActiveFilter;
  /** Filter configuration */
  config: FilterConfig;
  /** Remove handler */
  onRemove: () => void;
  /** Edit handler */
  onEdit?: () => void;
  /** Custom class name */
  className?: string;
}

export function FilterChip({
  filter,
  config,
  onRemove,
  onEdit,
  className,
}: FilterChipProps) {
  // Format the display value
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";

    // Boolean operators don't need a value displayed
    if (filter.operator === "is_true" || filter.operator === "is_false") {
      return "";
    }

    // Handle arrays (for "in" / "not_in" operators)
    if (Array.isArray(value)) {
      if (config.options) {
        const labels = value
          .map((v) => config.options?.find((o) => o.value === v)?.label ?? v)
          .slice(0, 2);
        const suffix = value.length > 2 ? ` +${value.length - 2}` : "";
        return labels.join(", ") + suffix;
      }
      return (
        value.slice(0, 2).join(", ") +
        (value.length > 2 ? ` +${value.length - 2}` : "")
      );
    }

    // Handle select options
    if (config.options) {
      const option = config.options.find((o) => o.value === String(value));
      if (option) return option.label;
    }

    // Handle dates
    if (config.type === "date" && value instanceof Date) {
      return value.toLocaleDateString("fr-FR");
    }

    // Handle between operator (expects {min, max})
    if (filter.operator === "between" && typeof value === "object") {
      const { min, max } = value as { min?: unknown; max?: unknown };
      return `${min ?? ""} - ${max ?? ""}`;
    }

    return String(value);
  };

  const operatorLabel = operatorLabels[filter.operator];
  const valueDisplay = formatValue(filter.value);

  return (
    <Badge
      variant="secondary"
      className={cn(
        "flex items-center gap-1.5 pl-2 pr-1 py-1 cursor-pointer hover:bg-muted",
        className,
      )}
      onClick={onEdit}
    >
      <span className="font-medium">{config.label}</span>
      <span className="text-muted-foreground">{operatorLabel}</span>
      {valueDisplay && <span className="font-medium">{valueDisplay}</span>}
      <Button
        variant="ghost"
        size="icon"
        className="h-4 w-4 p-0 ml-1 hover:bg-background/50 rounded-full"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <X className="h-3 w-3" />
      </Button>
    </Badge>
  );
}

// ============================================================================
// Filter Chips Container
// ============================================================================

interface FilterChipsProps {
  /** Active filters */
  filters: ActiveFilter[];
  /** Filter configurations */
  configs: FilterConfig[];
  /** Remove handler */
  onRemove: (index: number) => void;
  /** Edit handler */
  onEdit?: (index: number) => void;
  /** Clear all handler */
  onClearAll?: () => void;
  /** Custom class name */
  className?: string;
}

export function FilterChips({
  filters,
  configs,
  onRemove,
  onEdit,
  onClearAll,
  className,
}: FilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {filters.map((filter, index) => {
        const config = configs.find((c) => c.columnId === filter.columnId);
        if (!config) return null;

        return (
          <FilterChip
            key={`${filter.columnId}-${index}`}
            filter={filter}
            config={config}
            onRemove={() => onRemove(index)}
            onEdit={onEdit ? () => onEdit(index) : undefined}
          />
        );
      })}

      {filters.length > 1 && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground hover:text-destructive"
          onClick={onClearAll}
        >
          Tout effacer
        </Button>
      )}
    </div>
  );
}
