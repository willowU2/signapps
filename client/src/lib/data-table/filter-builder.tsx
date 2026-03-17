/**
 * Filter Builder Component
 *
 * UI de construction de filtres avancés pour le DataTable.
 */

"use client";

import * as React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Filter, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { ActiveFilter, FilterConfig, FilterOperator } from "./types";
import { operatorLabels } from "./filter-chip";

// ============================================================================
// Operators by Type
// ============================================================================

const operatorsByType: Record<FilterConfig["type"], FilterOperator[]> = {
  text: ["equals", "contains", "starts_with", "ends_with", "is_empty"],
  number: ["equals", "gt", "lt", "gte", "lte", "between"],
  date: ["equals", "before", "after", "between", "last_n_days", "this_week", "this_month"],
  select: ["in", "not_in"],
  boolean: ["is_true", "is_false"],
};

// ============================================================================
// Value Input Components
// ============================================================================

interface ValueInputProps {
  config: FilterConfig;
  operator: FilterOperator;
  value: unknown;
  onChange: (value: unknown) => void;
}

function TextValueInput({ value, onChange, operator }: ValueInputProps) {
  if (operator === "is_empty") return null;

  return (
    <Input
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Valeur..."
      className="h-8"
    />
  );
}

function NumberValueInput({ value, onChange, operator }: ValueInputProps) {
  if (operator === "between") {
    const range = (value as { min?: number; max?: number }) ?? {};
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={range.min ?? ""}
          onChange={(e) => onChange({ ...range, min: e.target.valueAsNumber })}
          placeholder="Min"
          className="h-8 w-20"
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="number"
          value={range.max ?? ""}
          onChange={(e) => onChange({ ...range, max: e.target.valueAsNumber })}
          placeholder="Max"
          className="h-8 w-20"
        />
      </div>
    );
  }

  return (
    <Input
      type="number"
      value={(value as number) ?? ""}
      onChange={(e) => onChange(e.target.valueAsNumber)}
      placeholder="Valeur..."
      className="h-8 w-24"
    />
  );
}

function DateValueInput({ value, onChange, operator }: ValueInputProps) {
  // Format date for input[type="date"]
  const formatDateForInput = (dateStr: string | undefined): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toISOString().split("T")[0];
  };

  // Relative date operators
  if (operator === "last_n_days") {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={(value as number) ?? 7}
          onChange={(e) => onChange(e.target.valueAsNumber)}
          placeholder="Jours"
          className="h-8 w-20"
          min={1}
        />
        <span className="text-sm text-muted-foreground">jours</span>
      </div>
    );
  }

  if (operator === "this_week" || operator === "this_month") {
    return null; // No value needed
  }

  if (operator === "between") {
    const range = (value as { start?: string; end?: string }) ?? {};

    return (
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={formatDateForInput(range.start)}
          onChange={(e) =>
            onChange({ ...range, start: e.target.value ? new Date(e.target.value).toISOString() : undefined })
          }
          className="h-8 w-32"
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="date"
          value={formatDateForInput(range.end)}
          onChange={(e) =>
            onChange({ ...range, end: e.target.value ? new Date(e.target.value).toISOString() : undefined })
          }
          className="h-8 w-32"
        />
      </div>
    );
  }

  return (
    <Input
      type="date"
      value={formatDateForInput(value as string)}
      onChange={(e) =>
        onChange(e.target.value ? new Date(e.target.value).toISOString() : undefined)
      }
      className="h-8 w-36"
    />
  );
}

function SelectValueInput({ config, value, onChange, operator }: ValueInputProps) {
  const selectedValues = (value as string[]) ?? [];
  const isMulti = operator === "in" || operator === "not_in";

  if (!isMulti) {
    return (
      <Select value={(value as string) ?? ""} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-32">
          <SelectValue placeholder="Valeur..." />
        </SelectTrigger>
        <SelectContent>
          {config.options?.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 min-w-32 justify-between">
          {selectedValues.length > 0 ? (
            <span className="flex gap-1">
              {selectedValues.length} sélectionné(s)
            </span>
          ) : (
            <span className="text-muted-foreground">Valeurs...</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1">
          {config.options?.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
            >
              <Checkbox
                checked={selectedValues.includes(option.value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...selectedValues, option.value]);
                  } else {
                    onChange(selectedValues.filter((v) => v !== option.value));
                  }
                }}
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BooleanValueInput({ operator }: ValueInputProps) {
  // Boolean operators don't need value input
  return null;
}

function ValueInput(props: ValueInputProps) {
  const { config, operator } = props;

  switch (config.type) {
    case "text":
      return <TextValueInput {...props} />;
    case "number":
      return <NumberValueInput {...props} />;
    case "date":
      return <DateValueInput {...props} />;
    case "select":
      return <SelectValueInput {...props} />;
    case "boolean":
      return <BooleanValueInput {...props} />;
    default:
      return <TextValueInput {...props} />;
  }
}

// ============================================================================
// Filter Row
// ============================================================================

interface FilterRowProps {
  configs: FilterConfig[];
  filter: Partial<ActiveFilter>;
  onChange: (filter: Partial<ActiveFilter>) => void;
  onRemove: () => void;
  index: number;
}

function FilterRow({ configs, filter, onChange, onRemove, index }: FilterRowProps) {
  const selectedConfig = configs.find((c) => c.columnId === filter.columnId);
  const availableOperators = selectedConfig
    ? operatorsByType[selectedConfig.type]
    : [];

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-muted-foreground w-6">
        {index === 0 ? "Où" : "Et"}
      </span>

      {/* Column selector */}
      <Select
        value={filter.columnId ?? ""}
        onValueChange={(value) => {
          const config = configs.find((c) => c.columnId === value);
          onChange({
            columnId: value,
            operator: config?.defaultOperator ?? operatorsByType[config?.type ?? "text"][0],
            value: undefined,
          });
        }}
      >
        <SelectTrigger className="h-8 w-32">
          <SelectValue placeholder="Colonne" />
        </SelectTrigger>
        <SelectContent>
          {configs.map((config) => (
            <SelectItem key={config.columnId} value={config.columnId}>
              {config.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator selector */}
      <Select
        value={filter.operator ?? ""}
        onValueChange={(value) =>
          onChange({ ...filter, operator: value as FilterOperator, value: undefined })
        }
        disabled={!selectedConfig}
      >
        <SelectTrigger className="h-8 w-32">
          <SelectValue placeholder="Opérateur" />
        </SelectTrigger>
        <SelectContent>
          {availableOperators.map((op) => (
            <SelectItem key={op} value={op}>
              {operatorLabels[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      {selectedConfig && filter.operator && (
        <ValueInput
          config={selectedConfig}
          operator={filter.operator}
          value={filter.value}
          onChange={(value) => onChange({ ...filter, value })}
        />
      )}

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================================
// Filter Builder
// ============================================================================

export interface FilterBuilderProps {
  /** Available filter configurations */
  configs: FilterConfig[];
  /** Current active filters */
  filters: ActiveFilter[];
  /** Change handler */
  onFiltersChange: (filters: ActiveFilter[]) => void;
  /** Custom class name */
  className?: string;
}

export function FilterBuilder({
  configs,
  filters,
  onFiltersChange,
  className,
}: FilterBuilderProps) {
  const [open, setOpen] = React.useState(false);
  const [pendingFilters, setPendingFilters] = React.useState<Partial<ActiveFilter>[]>([]);

  // Initialize pending filters from active filters
  React.useEffect(() => {
    if (open) {
      setPendingFilters(
        filters.length > 0
          ? filters.map((f) => ({ ...f }))
          : [{}]
      );
    }
  }, [open, filters]);

  // Add new filter row
  const addFilter = () => {
    setPendingFilters([...pendingFilters, {}]);
  };

  // Remove filter row
  const removeFilter = (index: number) => {
    const newFilters = [...pendingFilters];
    newFilters.splice(index, 1);
    setPendingFilters(newFilters.length > 0 ? newFilters : [{}]);
  };

  // Update filter row
  const updateFilter = (index: number, filter: Partial<ActiveFilter>) => {
    const newFilters = [...pendingFilters];
    newFilters[index] = filter;
    setPendingFilters(newFilters);
  };

  // Apply filters
  const applyFilters = () => {
    const validFilters = pendingFilters.filter(
      (f): f is ActiveFilter =>
        !!f.columnId &&
        !!f.operator &&
        (f.value !== undefined ||
          f.operator === "is_empty" ||
          f.operator === "is_true" ||
          f.operator === "is_false" ||
          f.operator === "this_week" ||
          f.operator === "this_month")
    );
    onFiltersChange(validFilters);
    setOpen(false);
  };

  // Clear all filters
  const clearFilters = () => {
    onFiltersChange([]);
    setPendingFilters([{}]);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "bg-background/50",
            filters.length > 0 && "border-primary text-primary",
            className
          )}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filtres
          {filters.length > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
              {filters.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[400px] p-4" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Filtres avancés</h4>
            {filters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground hover:text-destructive"
                onClick={clearFilters}
              >
                Tout effacer
              </Button>
            )}
          </div>

          <div className="space-y-1">
            {pendingFilters.map((filter, index) => (
              <FilterRow
                key={index}
                configs={configs}
                filter={filter}
                onChange={(f) => updateFilter(index, f)}
                onRemove={() => removeFilter(index)}
                index={index}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={addFilter}
            >
              <Plus className="mr-1 h-3 w-3" />
              Ajouter un filtre
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={applyFilters}>
                Appliquer
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
