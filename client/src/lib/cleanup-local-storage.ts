/**
 * localStorage cleanup — runs once on app boot.
 *
 * Trims entries that are too old (> 30 days) or too large, preventing
 * unbounded growth in localStorage. Entries that use a known timestamp
 * field (created_at, timestamp, updatedAt) are checked against the
 * 30-day threshold. Notification entries are capped at 200 items.
 */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_NOTIFICATIONS = 200;
const CLEANUP_FLAG_KEY = 'signapps:last-cleanup';
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // run at most once per day

/** Keys that are safe to prune when stale */
const STALE_PREFIXES = [
  'notification',
  'activity-log',
  'recent-',
  'draft-',
  'cache:',
  'signapps:temp:',
];

/** Keys that should never be removed */
const PROTECTED_KEYS = new Set([
  'auth-storage',
  'ui-store',
  'labels-store',
  'pinned-apps',
  'preferences',
  'theme',
  'onboarding-complete',
  'react-query-cache',
  CLEANUP_FLAG_KEY,
]);

function isProtected(key: string): boolean {
  return PROTECTED_KEYS.has(key);
}

function hasStalePrefix(key: string): boolean {
  return STALE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function extractTimestamp(value: string): number | null {
  try {
    const parsed = JSON.parse(value);
    // Check common timestamp fields
    for (const field of ['timestamp', 'created_at', 'createdAt', 'updatedAt', 'updated_at', 'date']) {
      if (parsed && typeof parsed[field] === 'string') {
        const ts = new Date(parsed[field]).getTime();
        if (!isNaN(ts)) return ts;
      }
      if (parsed && typeof parsed[field] === 'number') {
        return parsed[field];
      }
    }
    // Check if it's an array — look at the first element
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
      for (const field of ['timestamp', 'created_at', 'createdAt', 'date']) {
        if (typeof parsed[0][field] === 'string') {
          const ts = new Date(parsed[0][field]).getTime();
          if (!isNaN(ts)) return ts;
        }
      }
    }
  } catch {
    // Not JSON — skip
  }
  return null;
}

function trimNotifications(): void {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.toLowerCase().includes('notification')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > MAX_NOTIFICATIONS) {
          // Keep only the most recent entries
          const trimmed = parsed.slice(-MAX_NOTIFICATIONS);
          localStorage.setItem(key, JSON.stringify(trimmed));
        }
      } catch {
        // Not an array — skip
      }
    }
  } catch {
    // localStorage not available
  }
}

function removeStaleEntries(): void {
  const now = Date.now();
  const cutoff = now - THIRTY_DAYS_MS;
  const keysToRemove: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || isProtected(key)) continue;

      if (!hasStalePrefix(key)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const ts = extractTimestamp(raw);
      if (ts !== null && ts < cutoff) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage not available
  }
}

/**
 * Run localStorage cleanup. Safe to call on every app boot —
 * internally debounced to run at most once per day.
 */
export function cleanupLocalStorage(): void {
  if (typeof window === 'undefined') return;

  try {
    const lastCleanup = localStorage.getItem(CLEANUP_FLAG_KEY);
    if (lastCleanup) {
      const lastTime = parseInt(lastCleanup, 10);
      if (!isNaN(lastTime) && Date.now() - lastTime < CLEANUP_INTERVAL_MS) {
        return; // Already cleaned up recently
      }
    }

    removeStaleEntries();
    trimNotifications();

    localStorage.setItem(CLEANUP_FLAG_KEY, String(Date.now()));
  } catch {
    // localStorage not available — nothing to do
  }
}
