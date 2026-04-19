/**
 * SO3 — Debounced global search hook for the ⌘K omnibox.
 *
 * Wraps `orgApi.search(q, limit)` with a 150 ms debouncer so the backend
 * isn't flooded as the user types. Returns `{ data, isLoading, error }`.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { orgApi, type OrgSearchResponse } from "@/lib/api/org";

const DEFAULT_LIMIT = 20;
const DEBOUNCE_MS = 150;

interface UseGlobalSearchResult {
  data: OrgSearchResponse | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Debounced full-text query across persons / nodes / skills for the
 * active tenant.
 *
 * @param query the user's current input
 * @param limit optional per-bucket limit (default 20)
 */
export function useGlobalSearch(
  query: string,
  limit: number = DEFAULT_LIMIT,
): UseGlobalSearchResult {
  const [data, setData] = useState<OrgSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    const thisReq = ++reqId.current;

    timer.current = setTimeout(() => {
      orgApi
        .search(trimmed, limit)
        .then((res) => {
          // Ignore outdated responses that arrived out of order.
          if (thisReq !== reqId.current) return;
          setData(res.data);
          setError(null);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (thisReq !== reqId.current) return;
          const message =
            err instanceof Error ? err.message : "Recherche indisponible";
          setError(message);
          setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [query, limit]);

  return { data, isLoading, error };
}
