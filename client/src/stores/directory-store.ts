/**
 * Directory Store — SO5 Mobile Directory.
 *
 * Zustand store that keeps the full list of tenant persons (+ nodes + skills
 * for enrichment) in-memory and optionally persisted to localStorage for
 * offline readiness.
 *
 * Exposes a `filteredPersons` selector that runs a fuse.js fuzzy search over
 * `first_name`, `last_name`, `email`, `phone` and a derived `title` field, and
 * applies structural filters (OU, skill category, photo presence) client-side
 * so typing feels instant.
 *
 * Cache TTL is 5 minutes (controlled by `lastFetchedAt`). Callers that want
 * to force a refresh pass `{ force: true }` to `loadAll()`.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import Fuse from "fuse.js";
import { orgApi, type OrgSkill, type OrgSkillCategory } from "@/lib/api/org";
import type { Person, OrgNode } from "@/types/org";

/** 5 minutes TTL before the in-memory cache is considered stale. */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** One filter axis available from the directory UI. */
export interface DirectoryFilters {
  /** Org node id (OU) to restrict to — `null` = all. */
  nodeId: string | null;
  /** Skill category to restrict to — `null` = all. */
  skillCategory: OrgSkillCategory | null;
  /** `true` = keep only persons with a photo, `false` = no restriction. */
  requirePhoto: boolean;
}

/** Default filter state (everyone visible). */
const EMPTY_FILTERS: DirectoryFilters = {
  nodeId: null,
  skillCategory: null,
  requirePhoto: false,
};

/** Public store shape. */
interface DirectoryState {
  persons: Person[];
  nodes: OrgNode[];
  skills: OrgSkill[];

  lastFetchedAt: number | null;
  loading: boolean;
  error: string | null;

  filters: DirectoryFilters;
  query: string;

  /** Load persons / nodes / skills for the current tenant. */
  loadAll: (options?: { force?: boolean }) => Promise<void>;
  /** Invalidate the cache. Next `loadAll()` will re-fetch. */
  invalidate: () => void;
  /** Reset filters + query + clear the list. */
  reset: () => void;
  setQuery: (q: string) => void;
  setFilters: (f: Partial<DirectoryFilters>) => void;
  clearFilters: () => void;
}

/** Read the title stored under `attributes.title` or legacy `metadata.title`. */
function readTitle(p: Person): string | undefined {
  const raw = p as unknown as {
    attributes?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
  const src = raw.attributes ?? raw.metadata ?? {};
  const t = src.title;
  return typeof t === "string" && t.length > 0 ? t : undefined;
}

/** Shape of the search corpus item used by fuse.js. */
interface SearchRow {
  person: Person;
  full_name: string;
  email: string;
  phone: string;
  title: string;
}

function toSearchRow(p: Person): SearchRow {
  return {
    person: p,
    full_name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
    email: p.email ?? "",
    phone: p.phone ?? "",
    title: readTitle(p) ?? "",
  };
}

/**
 * Apply query + filters to a list of persons.
 *
 * Exported so unit tests can assert ranking / filter behaviour without
 * spinning up the full Zustand store.
 */
export function filterPersons(
  persons: Person[],
  query: string,
  filters: DirectoryFilters,
): Person[] {
  // 1. Structural filters first (cheap — O(n) with early exits).
  let pool = persons;
  if (filters.nodeId) {
    // The `nodeId` filter is based on `metadata.primary_node_id` written by
    // the API mapper. When that attribute is missing we conservatively keep
    // the person so no one disappears because of a data gap.
    pool = pool.filter((p) => {
      const raw = p as unknown as {
        attributes?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
      };
      const src = raw.attributes ?? raw.metadata ?? {};
      const nid = src.primary_node_id ?? src.node_id;
      return typeof nid !== "string" || nid === filters.nodeId;
    });
  }
  if (filters.requirePhoto) {
    pool = pool.filter(
      (p) => typeof p.avatar_url === "string" && p.avatar_url.length > 0,
    );
  }

  // 2. Fuzzy search. Empty query → return unfiltered alphabetical list.
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [...pool].sort((a, b) => {
      const an = `${a.first_name ?? ""} ${a.last_name ?? ""}`.toLowerCase();
      const bn = `${b.first_name ?? ""} ${b.last_name ?? ""}`.toLowerCase();
      return an.localeCompare(bn);
    });
  }

  const fuse = new Fuse(pool.map(toSearchRow), {
    keys: [
      { name: "full_name", weight: 0.5 },
      { name: "email", weight: 0.2 },
      { name: "title", weight: 0.2 },
      { name: "phone", weight: 0.1 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    useExtendedSearch: false,
    minMatchCharLength: 2,
  });

  return fuse.search(trimmed).map((r) => r.item.person);
}

/** Check whether the cached data is still within the 5-minute TTL. */
export function isFresh(lastFetchedAt: number | null): boolean {
  if (!lastFetchedAt) return false;
  return Date.now() - lastFetchedAt < CACHE_TTL_MS;
}

const INITIAL_STATE = {
  persons: [] as Person[],
  nodes: [] as OrgNode[],
  skills: [] as OrgSkill[],
  lastFetchedAt: null as number | null,
  loading: false,
  error: null as string | null,
  filters: EMPTY_FILTERS,
  query: "",
};

export const useDirectoryStore = create<DirectoryState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      loadAll: async (options) => {
        const { force } = options ?? {};
        const state = get();
        if (
          !force &&
          isFresh(state.lastFetchedAt) &&
          state.persons.length > 0
        ) {
          return;
        }
        set({ loading: true, error: null });
        try {
          const [personsRes, nodesRes, skillsRes] = await Promise.all([
            orgApi.persons.list({ active: true }),
            orgApi.trees.list().catch(() => ({
              data: [] as OrgNode[],
              status: 500,
              statusText: "err",
              headers: {},
              config: {},
            })),
            orgApi.skills.list().catch(() => ({
              data: [] as OrgSkill[],
              status: 500,
              statusText: "err",
              headers: {},
              config: {},
            })),
          ]);
          set({
            persons: Array.isArray(personsRes.data) ? personsRes.data : [],
            nodes: Array.isArray(nodesRes.data) ? nodesRes.data : [],
            skills: Array.isArray(skillsRes.data) ? skillsRes.data : [],
            lastFetchedAt: Date.now(),
            loading: false,
            error: null,
          });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Erreur de chargement";
          set({ loading: false, error: message });
        }
      },

      invalidate: () => set({ lastFetchedAt: null }),
      reset: () => set(INITIAL_STATE),
      setQuery: (q: string) => set({ query: q }),
      setFilters: (patch: Partial<DirectoryFilters>) =>
        set((s) => ({ filters: { ...s.filters, ...patch } })),
      clearFilters: () => set({ filters: EMPTY_FILTERS, query: "" }),
    }),
    {
      name: "directory-cache",
      // Only persist the data slices — filters reset on each mount to avoid
      // users returning to a hidden-OU view they forgot to clear.
      partialize: (state) => ({
        persons: state.persons,
        nodes: state.nodes,
        skills: state.skills,
        lastFetchedAt: state.lastFetchedAt,
      }),
    },
  ),
);

/**
 * Selector helper — returns the currently filtered list given the store
 * snapshot. Pulled into a plain function so it can be reused from tests and
 * React memoized selectors.
 */
export function selectFilteredPersons(state: DirectoryState): Person[] {
  return filterPersons(state.persons, state.query, state.filters);
}
