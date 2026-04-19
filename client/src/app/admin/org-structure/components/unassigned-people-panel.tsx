"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  avatarTint,
  personFullName,
  personInitials,
  personTitle,
} from "./avatar-helpers";
import { PERSON_ASSIGN_MIME } from "./tree-node-item";
import type { Person } from "@/types/org";

// =============================================================================
// Derived selector — exposed for testing
// =============================================================================

/**
 * Computes the subset of `persons` that has zero active assignments.
 *
 * `assignedPersonIds` is the union of every `person_id` that currently
 * appears in `assignmentsByNode`. A person is considered unassigned
 * when their id is absent from that set and they are still `is_active`.
 *
 * Exported pure so the vitest suite can hit it without rendering the
 * panel (see `unassigned-people-panel.test.tsx`).
 */
export function computeUnassignedPersons(
  persons: Person[],
  assignedPersonIds: ReadonlySet<string>,
): Person[] {
  return persons.filter(
    (p) => p.is_active !== false && !assignedPersonIds.has(p.id),
  );
}

/**
 * Given the page's `assignmentsByNode` map, returns the flat set of
 * person ids that have at least one assignment anywhere in the tree.
 */
export function collectAssignedPersonIds(
  assignmentsByNode: Record<string, ReadonlyArray<{ personId: string }>>,
): Set<string> {
  const set = new Set<string>();
  for (const rows of Object.values(assignmentsByNode)) {
    for (const row of rows) set.add(row.personId);
  }
  return set;
}

// =============================================================================
// Props
// =============================================================================

export interface UnassignedPeoplePanelProps {
  persons: Person[];
  assignmentsByNode: Record<string, ReadonlyArray<{ personId: string }>>;
  /** Controlled open/closed state (the page owns the chevron toggle). */
  collapsed?: boolean;
  onToggleCollapsed?: (next: boolean) => void;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Collapsible side panel listing every person in the tenant who has
 * zero active assignments.
 *
 * Each row is an HTML5 drag source that writes its personId to
 * `application/x-signapps-person` — tree items and orgchart cards
 * read that MIME type on drop to materialise a new assignment.
 */
export function UnassignedPeoplePanel({
  persons,
  assignmentsByNode,
  collapsed,
  onToggleCollapsed,
  className,
}: UnassignedPeoplePanelProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = collapsed ?? internalCollapsed;
  const [query, setQuery] = useState("");

  const assignedIds = useMemo(
    () => collectAssignedPersonIds(assignmentsByNode),
    [assignmentsByNode],
  );
  const unassigned = useMemo(
    () => computeUnassignedPersons(persons, assignedIds),
    [persons, assignedIds],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return unassigned;
    return unassigned.filter((p) => {
      const full = personFullName(p).toLowerCase();
      const title = (personTitle(p) ?? "").toLowerCase();
      const email = (p.email ?? "").toLowerCase();
      return full.includes(q) || title.includes(q) || email.includes(q);
    });
  }, [unassigned, query]);

  const toggle = () => {
    if (onToggleCollapsed) onToggleCollapsed(!isCollapsed);
    else setInternalCollapsed((v) => !v);
  };

  if (isCollapsed) {
    return (
      <div
        className={cn(
          "shrink-0 border-r border-border bg-card flex flex-col items-center py-2 gap-2",
          "w-10",
          className,
        )}
        data-testid="unassigned-panel-collapsed"
      >
        <button
          type="button"
          onClick={toggle}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={`Ouvrir le panneau (${unassigned.length} non assigne${unassigned.length > 1 ? "s" : ""})`}
          aria-label="Ouvrir le panneau des personnes non assignees"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center gap-1">
          <UserX className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
            {unassigned.length}
          </span>
        </div>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "shrink-0 border-r border-border bg-card flex flex-col",
        "w-[260px] min-w-[220px]",
        className,
      )}
      data-testid="unassigned-panel"
    >
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <UserX className="h-4 w-4 text-muted-foreground shrink-0" />
        <h3 className="text-sm font-semibold text-foreground truncate flex-1">
          Non assignes
        </h3>
        <Badge
          variant="secondary"
          className="text-[10px] tabular-nums"
          title={`${unassigned.length} personne${unassigned.length > 1 ? "s" : ""} sans affectation`}
        >
          {unassigned.length}
        </Badge>
        <button
          type="button"
          onClick={toggle}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Reduire le panneau"
          title="Reduire"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </header>

      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer..."
            className="h-8 pl-7 text-xs"
            aria-label="Filtrer les personnes non assignees"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center text-muted-foreground text-xs">
            <UserX className="h-6 w-6 opacity-40" />
            {unassigned.length === 0 ? (
              <p>Toutes les personnes sont assignees</p>
            ) : (
              <p>Aucun resultat pour la recherche</p>
            )}
          </div>
        ) : (
          <ul className="py-1">
            {filtered.map((p) => {
              const title = personTitle(p);
              return (
                <li key={p.id}>
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "copyMove";
                      e.dataTransfer.setData(
                        PERSON_ASSIGN_MIME,
                        JSON.stringify({ personId: p.id }),
                      );
                      e.currentTarget.classList.add("opacity-40");
                    }}
                    onDragEnd={(e) => {
                      e.currentTarget.classList.remove("opacity-40");
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing",
                      "hover:bg-muted/60 transition-colors select-none",
                    )}
                    title={
                      title
                        ? `${personFullName(p)} — ${title}`
                        : personFullName(p)
                    }
                  >
                    <span
                      className={cn(
                        "text-[10px] rounded-full w-7 h-7 flex items-center justify-center font-semibold shrink-0",
                        avatarTint(p.id),
                      )}
                    >
                      {personInitials(p)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-foreground truncate">
                        {personFullName(p)}
                      </div>
                      {title && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          {title}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
