/**
 * useScheduleSearch Hook
 *
 * React hook for searching scheduling blocks with debouncing and caching.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedCallback } from "use-debounce";
import {
  SchedulingSearchService,
  getSearchService,
  initSearchService,
  type SearchQuery,
  type SearchResult,
  type SearchResultItem,
} from "../utils/search-service";
import type {
  ScheduleBlock,
  BlockType,
  BlockStatus,
  Priority,
} from "../types/scheduling";
import { timeItemsApi } from "../../api/scheduler";

// ============================================================================
// Types
// ============================================================================

export interface UseScheduleSearchOptions {
  /** Initial search query text */
  initialQuery?: string;
  /** Search filters */
  filters?: Omit<SearchQuery, "text">;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Whether search is enabled */
  enabled?: boolean;
  /** Results limit */
  limit?: number;
}

export interface UseScheduleSearchResult {
  /** Search results */
  results: SearchResultItem[];
  /** Total number of matches */
  total: number;
  /** Search facets */
  facets: SearchResult["facets"];
  /** Whether search is loading */
  isLoading: boolean;
  /** Search error */
  error: Error | null;
  /** Current search query */
  query: string;
  /** Update search query */
  setQuery: (query: string) => void;
  /** Clear search */
  clear: () => void;
  /** Search suggestions */
  suggestions: string[];
  /** Get suggestions for current query */
  getSuggestions: () => void;
  /** Search metadata */
  meta?: SearchResult["meta"];
}

// ============================================================================
// Real Data Fetching (Replacing localStorage MVP)
// ============================================================================

async function fetchRealBlocks(): Promise<ScheduleBlock[]> {
  try {
    // Fetch up to 500 items for the search index
    const res = await timeItemsApi.list({ limit: 500, scope: "nous" });
    return res.data.items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      start: new Date(
        item.start_time || item.deadline || new Date().toISOString(),
      ),
      end: item.end_time ? new Date(item.end_time) : undefined,
      allDay: item.all_day,
      type: item.item_type as BlockType,
      status: item.status as BlockStatus,
      priority: item.priority as Priority,
      tags: [], // Tags not yet exposed in TimeItem response model simply
      location: item.location_name
        ? { name: item.location_name, address: item.location_address || "" }
        : undefined,
      metadata: { organizerId: item.owner_id },
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    }));
  } catch (err) {
    console.error("Failed to fetch blocks for search:", err);
    return [];
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useScheduleSearch(
  options: UseScheduleSearchOptions = {},
): UseScheduleSearchResult {
  const {
    initialQuery = "",
    filters = {},
    debounceMs = 300,
    enabled = true,
    limit = 50,
  } = options;

  // Local state
  const [query, setQueryState] = React.useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = React.useState(initialQuery);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);

  // Initialize search service using an empty state at first, updated via query
  const searchService = React.useMemo(() => {
    return getSearchService();
  }, []);

  // Debounced query update
  const debouncedSetQuery = useDebouncedCallback((value: string) => {
    setDebouncedQuery(value);
  }, debounceMs);

  // Update query with debounce
  const setQuery = React.useCallback(
    (newQuery: string) => {
      setQueryState(newQuery);
      debouncedSetQuery(newQuery);
    },
    [debouncedSetQuery],
  );

  // Build search query
  const searchQuery: SearchQuery = React.useMemo(
    () => ({
      text: debouncedQuery,
      ...filters,
      limit,
      sortBy: debouncedQuery ? "relevance" : "start",
      sortDirection: debouncedQuery ? "desc" : "asc",
    }),
    [debouncedQuery, filters, limit],
  );

  // Execute search
  const {
    data: searchResult,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["schedule-search", searchQuery],
    queryFn: async () => {
      // Fetch fresh blocks from API
      // In a real optimized system, this would only be fetched occasionally, or rely on server-side search API directly
      const blocks = await fetchRealBlocks();
      searchService.updateIndex(blocks);
      return searchService.search(searchQuery);
    },
    enabled: enabled,
    staleTime: 10000, // 10 seconds
  });

  // Get suggestions
  const getSuggestions = React.useCallback(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    const newSuggestions = searchService.getSuggestions(query, 5);
    setSuggestions(newSuggestions);
  }, [query, searchService]);

  // Update suggestions when query changes
  React.useEffect(() => {
    getSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Clear search
  const clear = React.useCallback(() => {
    setQueryState("");
    setDebouncedQuery("");
    setSuggestions([]);
  }, []);

  return {
    results: searchResult?.items || [],
    total: searchResult?.total || 0,
    facets: searchResult?.facets || {
      types: [],
      statuses: [],
      priorities: [],
      calendars: [],
      tags: [],
    },
    isLoading,
    error: error as Error | null,
    query,
    setQuery,
    clear,
    suggestions,
    getSuggestions,
    meta: searchResult?.meta,
  };
}

// ============================================================================
// Quick Search Hook (simpler interface)
// ============================================================================

export interface UseQuickSearchOptions {
  debounceMs?: number;
  limit?: number;
}

export function useQuickSearch(options: UseQuickSearchOptions = {}): {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResultItem[];
  isLoading: boolean;
  clear: () => void;
} {
  const { debounceMs = 200, limit = 10 } = options;

  const [query, setQueryState] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  const debouncedSetQuery = useDebouncedCallback((value: string) => {
    setDebouncedQuery(value);
  }, debounceMs);

  const setQuery = React.useCallback(
    (newQuery: string) => {
      setQueryState(newQuery);
      debouncedSetQuery(newQuery);
    },
    [debouncedSetQuery],
  );

  const searchService = React.useMemo(() => {
    return getSearchService();
  }, []);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["quick-search", debouncedQuery, limit],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const blocks = await fetchRealBlocks();
      searchService.updateIndex(blocks);
      return searchService.quickSearch(debouncedQuery, limit);
    },
    enabled: debouncedQuery.length > 0,
    staleTime: 5000,
  });

  const clear = React.useCallback(() => {
    setQueryState("");
    setDebouncedQuery("");
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    clear,
  };
}
