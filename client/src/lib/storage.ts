/**
 * Safe localStorage wrapper — SignApps Platform
 *
 * Handles:
 * - SSR (returns the default value when `window` is undefined)
 * - JSON parse/stringify errors gracefully (falls back to raw string)
 * - Storage exceptions (quota exceeded, disabled storage) — silent no-op
 *
 * Usage:
 *   import { storage } from "@/lib/storage";
 *
 *   const token = storage.get<string>("access_token");
 *   const prefs = storage.get<UserPrefs>("user-prefs", DEFAULT_PREFS);
 *
 *   storage.set("access_token", "abc");
 *   storage.set("user-prefs", { theme: "dark" });
 *
 *   storage.remove("access_token");
 *   storage.clear();
 *
 * Existing `localStorage.*` calls are intentionally NOT migrated — callers can
 * opt in progressively when they touch related code.
 */

export const storage = {
  /**
   * Read a typed value from localStorage.
   *
   * Returns `defaultValue` when:
   * - running on the server (SSR)
   * - the key is absent
   * - localStorage throws (SecurityError, disabled, etc.)
   *
   * Values are parsed as JSON when possible, otherwise returned as the raw
   * string — this makes the wrapper interoperable with plain-string keys
   * already written to localStorage by legacy code.
   */
  get<T = string>(key: string, defaultValue: T | null = null): T | null {
    if (typeof window === "undefined") return defaultValue;
    try {
      const value = window.localStorage.getItem(key);
      if (value === null) return defaultValue;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch {
      return defaultValue;
    }
  },

  /**
   * Write a value to localStorage. Objects are JSON-stringified; strings are
   * stored as-is to stay compatible with existing readers that expect raw
   * strings (e.g. `access_token`, `refresh_token`).
   *
   * Fails silently on SSR or when storage is unavailable (private mode, quota
   * exceeded, disabled by policy).
   */
  set(key: string, value: unknown): void {
    if (typeof window === "undefined") return;
    try {
      const str = typeof value === "string" ? value : JSON.stringify(value);
      window.localStorage.setItem(key, str);
    } catch {
      // Storage quota exceeded or disabled — silent fail by design.
    }
  },

  /**
   * Remove a single key. No-op on SSR or when storage throws.
   */
  remove(key: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // no-op
    }
  },

  /**
   * Clear the entire localStorage. No-op on SSR or when storage throws.
   */
  clear(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.clear();
    } catch {
      // no-op
    }
  },
};
