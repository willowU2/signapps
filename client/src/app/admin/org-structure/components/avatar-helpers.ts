/**
 * Shared helpers for rendering person avatars inside the org-structure UI.
 *
 * Both the tree view (`tree-node-item.tsx`) and the orgchart view
 * (`org-chart-card.tsx`) display person avatars on nodes — these utilities
 * guarantee consistent colours, initials, and title resolution across
 * the two surfaces.
 *
 * Kept in a dedicated module (instead of re-exporting from
 * `tree-node-item.tsx`) so consumers don't pull in the heavy tree-item
 * component + shadcn/ui context-menu dependency just to format a badge.
 */
import type { Person } from "@/types/org";

/**
 * Deterministic avatar colour for a person, derived from a hash of
 * their id. The same person always gets the same tint across renders
 * and across tree/orgchart/panel surfaces.
 */
export function avatarTint(personId: string): string {
  const palette = [
    "bg-blue-500/20 text-blue-700 dark:text-blue-300",
    "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    "bg-purple-500/20 text-purple-700 dark:text-purple-300",
    "bg-orange-500/20 text-orange-700 dark:text-orange-300",
    "bg-pink-500/20 text-pink-700 dark:text-pink-300",
    "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
    "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  ];
  let h = 0;
  for (let i = 0; i < personId.length; i++) {
    h = (h * 31 + personId.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(h) % palette.length];
}

/** Two-letter initials for a person, with `"?"` fallback on missing data. */
export function personInitials(p: Person | undefined): string {
  if (!p) return "?";
  const a = p.first_name?.[0] ?? "";
  const b = p.last_name?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

/**
 * Read a person's title from either `attributes.title` (signapps-org raw
 * response) or `metadata.title` (legacy workforce shape).
 *
 * The TypeScript type says `metadata` but the running backend serialises
 * `attributes` — both shapes coexist, so we index defensively.
 */
export function personTitle(p: Person | undefined): string | undefined {
  if (!p) return undefined;
  const raw = p as unknown as {
    attributes?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
  const src = raw.attributes ?? raw.metadata ?? {};
  const t = src.title;
  return typeof t === "string" && t.length > 0 ? t : undefined;
}

/** Full display name `"First Last"`, with `"?"` fallback on missing data. */
export function personFullName(p: Person | undefined): string {
  if (!p) return "?";
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "?";
}
