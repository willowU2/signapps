'use client';

import { useCallback, useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrackedActivity {
  id: string;
  action: string;
  target: string;
  details?: string;
  timestamp: string;
}

const STORAGE_KEY = 'user_activities';
const MAX_ITEMS = 100;

// ---------------------------------------------------------------------------
// External-store plumbing so React re-renders on changes
// ---------------------------------------------------------------------------

let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

let cachedSnapshot: TrackedActivity[] = [];
let cachedRaw: string | null = null;

function getSnapshot(): TrackedActivity[] {
  if (typeof window === 'undefined') return cachedSnapshot;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedSnapshot = raw ? JSON.parse(raw) : [];
    }
    return cachedSnapshot;
  } catch {
    return cachedSnapshot;
  }
}

function getServerSnapshot(): TrackedActivity[] {
  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log a user action to localStorage-backed activity feed.
 * Can be called from anywhere (does not require React context).
 */
export function logActivity(action: string, target: string, details?: string) {
  if (typeof window === 'undefined') return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const activities: TrackedActivity[] = raw ? JSON.parse(raw) : [];

    activities.unshift({
      id: Date.now().toString(),
      action,
      target,
      details,
      timestamp: new Date().toISOString(),
    });

    // Keep last MAX_ITEMS
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(activities.slice(0, MAX_ITEMS))
    );

    emitChange();
  } catch {
    // localStorage not available
  }
}

/**
 * Clear all tracked activities.
 */
export function clearActivities() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  emitChange();
}

/**
 * React hook that returns the current list of tracked activities.
 * Automatically re-renders when `logActivity()` is called.
 */
export function useActivityTracker() {
  const activities = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const log = useCallback(
    (action: string, target: string, details?: string) => {
      logActivity(action, target, details);
    },
    []
  );

  return { activities, log, clear: clearActivities };
}
