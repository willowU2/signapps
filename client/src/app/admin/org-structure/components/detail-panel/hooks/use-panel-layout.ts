"use client";

/**
 * usePanelLayout — fetch + cache the effective panel layout for a
 * given (role, entity_type) combo.
 *
 * The cache lives in-memory only (no localStorage) and TTL-expires
 * after 2 minutes. Parallel calls for the same key share a single
 * in-flight promise so we never over-fetch.
 */
import { useCallback, useEffect, useState } from "react";
import { orgApi } from "@/lib/api/org";
import type {
  PanelEntitySlug,
  PanelLayoutConfig,
  PanelLayoutResponse,
  PanelRoleSlug,
} from "@/lib/api/org";

interface CacheEntry {
  data: PanelLayoutResponse;
  expiresAt: number;
}

const TTL_MS = 2 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PanelLayoutResponse>>();

function cacheKey(role: PanelRoleSlug, entityType: PanelEntitySlug): string {
  return `${role}:${entityType}`;
}

async function fetchLayout(
  role: PanelRoleSlug,
  entityType: PanelEntitySlug,
): Promise<PanelLayoutResponse> {
  const key = cacheKey(role, entityType);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.data;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = orgApi.panelLayouts
    .get(role, entityType)
    .then((res) => {
      const data = res.data;
      cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** Clear the cache entry for (role, entityType) — called after upsert/reset. */
export function invalidatePanelLayout(
  role: PanelRoleSlug,
  entityType: PanelEntitySlug,
): void {
  cache.delete(cacheKey(role, entityType));
}

/** Clear the entire cache. */
export function invalidateAllPanelLayouts(): void {
  cache.clear();
}

export interface UsePanelLayoutResult {
  loading: boolean;
  config: PanelLayoutConfig | null;
  isCustom: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Resolve the effective layout for a given user role + entity type.
 * Returns `null` config while loading (plus `loading: true`).
 */
export function usePanelLayout(
  role: PanelRoleSlug | null,
  entityType: PanelEntitySlug,
): UsePanelLayoutResult {
  const [state, setState] = useState<{
    loading: boolean;
    config: PanelLayoutConfig | null;
    isCustom: boolean;
    error: Error | null;
  }>({
    loading: true,
    config: null,
    isCustom: false,
    error: null,
  });

  const load = useCallback(() => {
    if (!role) {
      setState({ loading: false, config: null, isCustom: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    fetchLayout(role, entityType)
      .then((res) => {
        setState({
          loading: false,
          config: res.config,
          isCustom: res.is_custom,
          error: null,
        });
      })
      .catch((err) => {
        setState({
          loading: false,
          config: null,
          isCustom: false,
          error:
            err instanceof Error ? err : new Error("panel layout fetch failed"),
        });
      });
  }, [role, entityType]);

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => {
    if (!role) return;
    invalidatePanelLayout(role, entityType);
    load();
  }, [role, entityType, load]);

  return { ...state, reload };
}

/**
 * Map an identity role number (0..3) to a panel role slug.
 *
 * - 0 (guest) → viewer
 * - 1 (user / editor / manager) → manager
 * - 2 (admin) → admin
 * - 3 (superadmin) → admin
 * - undefined → viewer (safe default)
 */
export function mapUserRoleToPanelRole(
  role: number | undefined | null,
): PanelRoleSlug {
  if (role === undefined || role === null) return "viewer";
  if (role >= 2) return "admin";
  if (role >= 1) return "manager";
  return "viewer";
}
