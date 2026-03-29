'use client';

// Feature 25: Search suggestions from browsing history
// Feature 7: Recent items across all modules

import { useState, useEffect, useCallback } from 'react';

export interface HistoryEntry {
  id: string;
  query?: string;
  title: string;
  url: string;
  module: string;
  visitedAt: string;
}

const HISTORY_KEY = 'search_browse_history';
const MAX_HISTORY = 100;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

export function useSearchHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const trackVisit = useCallback((title: string, url: string, module: string) => {
    const entry: HistoryEntry = {
      id: `h_${Date.now()}`,
      title,
      url,
      module,
      visitedAt: new Date().toISOString(),
    };
    const existing = loadHistory().filter(h => h.url !== url);
    const next = [entry, ...existing].slice(0, MAX_HISTORY);
    saveHistory(next);
    setHistory(next);
  }, []);

  const trackQuery = useCallback((query: string) => {
    if (!query.trim()) return;
    const entry: HistoryEntry = {
      id: `q_${Date.now()}`,
      query,
      title: query,
      url: '',
      module: 'search',
      visitedAt: new Date().toISOString(),
    };
    const existing = loadHistory().filter(h => h.query !== query);
    const next = [entry, ...existing].slice(0, MAX_HISTORY);
    saveHistory(next);
    setHistory(next);
  }, []);

  const getSuggestions = useCallback((input: string): HistoryEntry[] => {
    if (!input.trim()) return loadHistory().slice(0, 8);
    const lower = input.toLowerCase();
    return loadHistory()
      .filter(h => h.title.toLowerCase().includes(lower) || h.query?.toLowerCase().includes(lower))
      .slice(0, 8);
  }, []);

  const getRecentItems = useCallback((limit = 20): HistoryEntry[] => {
    return loadHistory()
      .filter(h => !h.query && h.url)
      .slice(0, limit);
  }, []);

  const clearHistory = useCallback(() => {
    saveHistory([]);
    setHistory([]);
  }, []);

  return { history, trackVisit, trackQuery, getSuggestions, getRecentItems, clearHistory };
}
