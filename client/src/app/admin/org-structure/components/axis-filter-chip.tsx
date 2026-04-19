"use client";

import React from "react";
import type { OrgAxis } from "@/types/org";
import { cn } from "@/lib/utils";

/** Axe + couleur — cohérent avec les liserés d'avatars. */
export const AXIS_DEFINITIONS: Record<
  "all" | OrgAxis,
  { label: string; color: string; hex: string }
> = {
  all: {
    label: "Tous",
    color: "bg-muted text-foreground",
    hex: "#64748b",
  },
  structure: {
    label: "Structure",
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    hex: "#3b82f6",
  },
  focus: {
    label: "Focus",
    color: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    hex: "#8b5cf6",
  },
  group: {
    label: "Comités",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    hex: "#f59e0b",
  },
};

type AxisOption = keyof typeof AXIS_DEFINITIONS;

export interface AxisFilterChipProps {
  value: AxisOption;
  onChange: (axis: AxisOption) => void;
}

/** Toolbar chip exposing a filter over org_assignments.axis. */
export function AxisFilterChip({ value, onChange }: AxisFilterChipProps) {
  const OPTIONS: AxisOption[] = ["all", "structure", "focus", "group"];

  return (
    <div
      className="flex items-center bg-muted rounded-lg p-0.5"
      role="group"
      aria-label="Filtre par axe"
    >
      {OPTIONS.map((key) => {
        const def = AXIS_DEFINITIONS[key];
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            data-axis={key}
            aria-pressed={active}
          >
            <span
              aria-hidden="true"
              className="inline-block size-2 rounded-full mr-1.5 align-middle"
              style={{ backgroundColor: def.hex }}
            />
            {def.label}
          </button>
        );
      })}
    </div>
  );
}
