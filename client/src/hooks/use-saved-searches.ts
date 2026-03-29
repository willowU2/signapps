'use client';

// Feature 10: Saved searches with notifications

import { useState, useEffect, useCallback } from 'react';

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, string>;
  notify: boolean;
  createdAt: string;
  lastRun?: string;
  resultCount?: number;
}

const STORAGE_KEY = 'saved_searches';

function load(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(searches: SavedSearch[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
}

export function useSavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);

  useEffect(() => { setSearches(load()); }, []);

  const add = useCallback((name: string, query: string, filters: Record<string, string> = {}, notify = false) => {
    const s: SavedSearch = {
      id: `ss_${Date.now()}`,
      name,
      query,
      filters,
      notify,
      createdAt: new Date().toISOString(),
    };
    const next = [...load(), s];
    save(next);
    setSearches(next);
    return s.id;
  }, []);

  const remove = useCallback((id: string) => {
    const next = load().filter(s => s.id !== id);
    save(next);
    setSearches(next);
  }, []);

  const toggle = useCallback((id: string) => {
    const next = load().map(s => s.id === id ? { ...s, notify: !s.notify } : s);
    save(next);
    setSearches(next);
  }, []);

  const markRun = useCallback((id: string, count: number) => {
    const next = load().map(s => s.id === id ? { ...s, lastRun: new Date().toISOString(), resultCount: count } : s);
    save(next);
    setSearches(next);
  }, []);

  return { searches, add, remove, toggle, markRun };
}
