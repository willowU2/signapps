/**
 * useScheduleSearch Hook
 *
 * React hook for searching scheduling blocks with debouncing and caching.
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedCallback } from 'use-debounce';
import {
  SchedulingSearchService,
  getSearchService,
  initSearchService,
  type SearchQuery,
  type SearchResult,
  type SearchResultItem,
} from '../utils/search-service';
import type { ScheduleBlock } from '../types/scheduling';

// ============================================================================
// Types
// ============================================================================

export interface UseScheduleSearchOptions {
  /** Initial search query text */
  initialQuery?: string;
  /** Search filters */
  filters?: Omit<SearchQuery, 'text'>;
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
  facets: SearchResult['facets'];
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
  meta?: SearchResult['meta'];
}

// ============================================================================
// Mock Data (MVP - localStorage)
// ============================================================================

function getStoredBlocks(): ScheduleBlock[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem('scheduling_events');
    if (!data) return [];
    const events = JSON.parse(data);
    return events.map((e: ScheduleBlock) => ({
      ...e,
      start: new Date(e.start),
      end: e.end ? new Date(e.end) : undefined,
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
    }));
  } catch {
    return [];
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useScheduleSearch(
  options: UseScheduleSearchOptions = {}
): UseScheduleSearchResult {
  const {
    initialQuery = '',
    filters = {},
    debounceMs = 300,
    enabled = true,
    limit = 50,
  } = options;

  // Local state
  const [query, setQueryState] = React.useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = React.useState(initialQuery);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);

  // Initialize search service
  const searchService = React.useMemo(() => {
    const blocks = getStoredBlocks();
    return initSearchService(blocks);
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
    [debouncedSetQuery]
  );

  // Build search query
  const searchQuery: SearchQuery = React.useMemo(
    () => ({
      text: debouncedQuery,
      ...filters,
      limit,
      sortBy: debouncedQuery ? 'relevance' : 'start',
      sortDirection: debouncedQuery ? 'desc' : 'asc',
    }),
    [debouncedQuery, filters, limit]
  );

  // Execute search
  const {
    data: searchResult,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['schedule-search', searchQuery],
    queryFn: () => {
      // Refresh blocks from storage
      const blocks = getStoredBlocks();
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
  }, [query]);

  // Clear search
  const clear = React.useCallback(() => {
    setQueryState('');
    setDebouncedQuery('');
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

export function useQuickSearch(
  options: UseQuickSearchOptions = {}
): {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResultItem[];
  isLoading: boolean;
  clear: () => void;
} {
  const { debounceMs = 200, limit = 10 } = options;

  const [query, setQueryState] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');

  const debouncedSetQuery = useDebouncedCallback((value: string) => {
    setDebouncedQuery(value);
  }, debounceMs);

  const setQuery = React.useCallback(
    (newQuery: string) => {
      setQueryState(newQuery);
      debouncedSetQuery(newQuery);
    },
    [debouncedSetQuery]
  );

  const searchService = React.useMemo(() => {
    const blocks = getStoredBlocks();
    return initSearchService(blocks);
  }, []);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['quick-search', debouncedQuery, limit],
    queryFn: () => {
      if (!debouncedQuery.trim()) return [];
      const blocks = getStoredBlocks();
      searchService.updateIndex(blocks);
      return searchService.quickSearch(debouncedQuery, limit);
    },
    enabled: debouncedQuery.length > 0,
    staleTime: 5000,
  });

  const clear = React.useCallback(() => {
    setQueryState('');
    setDebouncedQuery('');
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    clear,
  };
}
