/**
 * FilterChips — SO5 directory.
 *
 * Horizontal scrollable row of pills: "Tous", top 8 OU by name, "Avec photo"
 * toggle, and a "Reset" affordance when any filter is active.
 *
 * The node list is surfaced from the directory store (already loaded at page
 * mount); we intentionally keep the UI plain-HTML pills instead of fetching a
 * separate catalog.
 */
"use client";

import { useMemo } from "react";
import { RotateCcw, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrgNode } from "@/types/org";
import type { DirectoryFilters } from "@/stores/directory-store";

export interface FilterChipsProps {
  nodes: OrgNode[];
  filters: DirectoryFilters;
  onChange: (patch: Partial<DirectoryFilters>) => void;
  onReset?: () => void;
  /** Max number of OU chips displayed inline. Default 8. */
  maxNodes?: number;
}

export function FilterChips({
  nodes,
  filters,
  onChange,
  onReset,
  maxNodes = 8,
}: FilterChipsProps) {
  // Dedup + sort alphabetically, keep only direct units (non-root) to avoid
  // showing huge composite "trees".
  const topNodes = useMemo(() => {
    const unique = new Map<string, OrgNode>();
    for (const n of nodes) {
      if (!n?.id) continue;
      if (!unique.has(n.id)) unique.set(n.id, n);
    }
    const list = Array.from(unique.values());
    list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return list.slice(0, maxNodes);
  }, [nodes, maxNodes]);

  const hasFilters =
    filters.nodeId !== null ||
    filters.skillCategory !== null ||
    filters.requirePhoto;

  return (
    <div
      role="toolbar"
      aria-label="Filtres annuaire"
      className="flex items-center gap-1.5 overflow-x-auto pb-1"
      data-testid="directory-filters"
    >
      <Chip
        label="Tous"
        active={filters.nodeId === null && !filters.requirePhoto}
        onClick={() => {
          onChange({ nodeId: null, requirePhoto: false });
        }}
      />
      {topNodes.map((n) => (
        <Chip
          key={n.id}
          label={n.name}
          active={filters.nodeId === n.id}
          onClick={() =>
            onChange({ nodeId: filters.nodeId === n.id ? null : n.id })
          }
        />
      ))}
      <Chip
        icon={<Camera className="size-3" />}
        label="Photo"
        active={filters.requirePhoto}
        onClick={() => onChange({ requirePhoto: !filters.requirePhoto })}
      />
      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-7 shrink-0 text-xs"
          aria-label="Réinitialiser les filtres"
        >
          <RotateCcw className="mr-1 size-3" />
          Reset
        </Button>
      ) : null}
    </div>
  );
}

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
}

function Chip({ label, active, onClick, icon }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-3 text-xs transition-colors",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-accent",
      )}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
