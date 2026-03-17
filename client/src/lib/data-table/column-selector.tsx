/**
 * Column Selector Component
 *
 * Permet aux utilisateurs de personnaliser les colonnes visibles et leur ordre
 * avec drag-and-drop et persistance localStorage.
 */

"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff, RotateCcw, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { ColumnConfig } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface ColumnPreference {
  id: string;
  visible: boolean;
  order: number;
}

export interface ColumnSelectorProps<TData> {
  /** All available columns */
  columns: ColumnConfig<TData>[];
  /** Current column preferences */
  preferences: ColumnPreference[];
  /** Callback when preferences change */
  onPreferencesChange: (preferences: ColumnPreference[]) => void;
  /** Entity type for storage key */
  entityType: string;
}

// ============================================================================
// Sortable Column Item
// ============================================================================

interface SortableColumnItemProps {
  column: { id: string; label: string; hideable: boolean };
  isVisible: boolean;
  onVisibilityChange: (visible: boolean) => void;
}

function SortableColumnItem({
  column,
  isVisible,
  onVisibilityChange,
}: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-background px-2 py-1.5",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Checkbox
        id={`col-${column.id}`}
        checked={isVisible}
        onCheckedChange={(checked) => onVisibilityChange(!!checked)}
        disabled={!column.hideable}
        className="data-[state=checked]:bg-primary"
      />

      <label
        htmlFor={`col-${column.id}`}
        className={cn(
          "flex-1 cursor-pointer text-sm",
          !isVisible && "text-muted-foreground"
        )}
      >
        {column.label}
      </label>

      {isVisible ? (
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
      ) : (
        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </div>
  );
}

// ============================================================================
// Column Selector
// ============================================================================

export function ColumnSelector<TData>({
  columns,
  preferences,
  onPreferencesChange,
  entityType,
}: ColumnSelectorProps<TData>) {
  const [open, setOpen] = React.useState(false);

  // Sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sort columns by preference order
  const sortedColumns = React.useMemo(() => {
    const prefMap = new Map(preferences.map((p) => [p.id, p]));

    return [...columns]
      .filter((col) => col.hideable !== false) // Only show hideable columns
      .sort((a, b) => {
        const orderA = prefMap.get(a.id)?.order ?? 999;
        const orderB = prefMap.get(b.id)?.order ?? 999;
        return orderA - orderB;
      });
  }, [columns, preferences]);

  // Get column IDs for sortable context
  const columnIds = sortedColumns.map((col) => col.id);

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columnIds.indexOf(active.id as string);
      const newIndex = columnIds.indexOf(over.id as string);

      const newOrder = arrayMove(columnIds, oldIndex, newIndex);

      // Update preferences with new order
      const newPreferences = newOrder.map((id, index) => {
        const existing = preferences.find((p) => p.id === id);
        return {
          id,
          visible: existing?.visible ?? true,
          order: index,
        };
      });

      onPreferencesChange(newPreferences);
    }
  };

  // Handle visibility change
  const handleVisibilityChange = (columnId: string, visible: boolean) => {
    const newPreferences = preferences.map((p) =>
      p.id === columnId ? { ...p, visible } : p
    );

    // If column not in preferences, add it
    if (!preferences.find((p) => p.id === columnId)) {
      newPreferences.push({
        id: columnId,
        visible,
        order: preferences.length,
      });
    }

    onPreferencesChange(newPreferences);
  };

  // Reset to defaults
  const handleReset = () => {
    const defaultPreferences = columns
      .filter((col) => col.hideable !== false)
      .map((col, index) => ({
        id: col.id,
        visible: col.defaultVisible !== false,
        order: index,
      }));

    onPreferencesChange(defaultPreferences);
  };

  // Count visible columns
  const visibleCount = preferences.filter((p) => p.visible).length;
  const totalCount = columns.filter((c) => c.hideable !== false).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="bg-background/50">
          <Settings2 className="mr-2 h-4 w-4" />
          Colonnes
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
            {visibleCount}/{totalCount}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Personnaliser les colonnes</h4>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Réinitialiser</TooltipContent>
            </Tooltip>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground">
            Glissez pour réordonner, cochez pour afficher/masquer.
          </p>

          {/* Sortable column list */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columnIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {sortedColumns.map((col) => {
                  const pref = preferences.find((p) => p.id === col.id);
                  const isVisible = pref?.visible ?? (col.defaultVisible !== false);

                  return (
                    <SortableColumnItem
                      key={col.id}
                      column={{
                        id: col.id,
                        label: col.label,
                        hideable: col.hideable !== false,
                      }}
                      isVisible={isVisible}
                      onVisibilityChange={(visible) =>
                        handleVisibilityChange(col.id, visible)
                      }
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

          {/* Quick actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                const allVisible = preferences.map((p) => ({ ...p, visible: true }));
                onPreferencesChange(allVisible);
              }}
            >
              <Eye className="mr-1 h-3 w-3" />
              Tout afficher
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                const allHidden = preferences.map((p) => ({ ...p, visible: false }));
                onPreferencesChange(allHidden);
              }}
            >
              <EyeOff className="mr-1 h-3 w-3" />
              Tout masquer
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Persistence Hooks
// ============================================================================

const STORAGE_KEY_PREFIX = "datatable_columns_";

/**
 * Hook pour gérer la persistance des préférences de colonnes.
 */
export function useColumnPreferences<TData>(
  entityType: string,
  columns: ColumnConfig<TData>[]
): [ColumnPreference[], (prefs: ColumnPreference[]) => void] {
  const storageKey = `${STORAGE_KEY_PREFIX}${entityType}`;

  // Initialize from localStorage or defaults
  const [preferences, setPreferencesState] = React.useState<ColumnPreference[]>(() => {
    if (typeof window === "undefined") {
      return getDefaultPreferences(columns);
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ColumnPreference[];
        // Validate and merge with current columns
        return mergePreferencesWithColumns(parsed, columns);
      }
    } catch (e) {
      console.warn("Failed to load column preferences:", e);
    }

    return getDefaultPreferences(columns);
  });

  // Save to localStorage when preferences change
  const setPreferences = React.useCallback(
    (newPrefs: ColumnPreference[]) => {
      setPreferencesState(newPrefs);

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, JSON.stringify(newPrefs));
        } catch (e) {
          console.warn("Failed to save column preferences:", e);
        }
      }
    },
    [storageKey]
  );

  return [preferences, setPreferences];
}

/**
 * Generate default preferences from column config.
 */
function getDefaultPreferences<TData>(
  columns: ColumnConfig<TData>[]
): ColumnPreference[] {
  return columns
    .filter((col) => col.hideable !== false)
    .map((col, index) => ({
      id: col.id,
      visible: col.defaultVisible !== false,
      order: index,
    }));
}

/**
 * Merge stored preferences with current columns.
 * Handles column additions/removals.
 */
function mergePreferencesWithColumns<TData>(
  stored: ColumnPreference[],
  columns: ColumnConfig<TData>[]
): ColumnPreference[] {
  const columnIds = new Set(columns.filter((c) => c.hideable !== false).map((c) => c.id));
  const storedMap = new Map(stored.map((p) => [p.id, p]));

  // Keep only preferences for existing columns
  const validPrefs = stored.filter((p) => columnIds.has(p.id));

  // Add new columns that aren't in preferences
  let maxOrder = Math.max(...validPrefs.map((p) => p.order), -1);

  for (const col of columns) {
    if (col.hideable !== false && !storedMap.has(col.id)) {
      validPrefs.push({
        id: col.id,
        visible: col.defaultVisible !== false,
        order: ++maxOrder,
      });
    }
  }

  // Sort by order
  return validPrefs.sort((a, b) => a.order - b.order);
}

// ============================================================================
// Utility to apply preferences to visibility state
// ============================================================================

export function applyPreferencesToVisibility(
  preferences: ColumnPreference[]
): Record<string, boolean> {
  const visibility: Record<string, boolean> = {};

  for (const pref of preferences) {
    visibility[pref.id] = pref.visible;
  }

  return visibility;
}

export function getOrderedColumnIds(
  preferences: ColumnPreference[]
): string[] {
  return preferences
    .sort((a, b) => a.order - b.order)
    .map((p) => p.id);
}
