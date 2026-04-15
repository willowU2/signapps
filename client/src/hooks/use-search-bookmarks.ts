"use client";

// Feature 28: Bookmark search results

import { useState, useEffect, useCallback } from "react";

export interface SearchBookmark {
  id: string;
  title: string;
  url: string;
  excerpt?: string;
  entityType: string;
  query: string;
  savedAt: string;
}

const KEY = "search_bookmarks";

function load(): SearchBookmark[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function persist(items: SearchBookmark[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function useSearchBookmarks() {
  const [bookmarks, setBookmarks] = useState<SearchBookmark[]>([]);

  useEffect(() => {
    setBookmarks(load());
  }, []);

  const add = useCallback((item: Omit<SearchBookmark, "id" | "savedAt">) => {
    const next = load();
    if (next.some((b) => b.url === item.url)) return;
    const bookmark: SearchBookmark = {
      ...item,
      id: `sb_${Date.now()}`,
      savedAt: new Date().toISOString(),
    };
    const updated = [bookmark, ...next];
    persist(updated);
    setBookmarks(updated);
  }, []);

  const remove = useCallback((id: string) => {
    const updated = load().filter((b) => b.id !== id);
    persist(updated);
    setBookmarks(updated);
  }, []);

  const isBookmarked = useCallback((url: string) => {
    return load().some((b) => b.url === url);
  }, []);

  return { bookmarks, add, remove, isBookmarked };
}
