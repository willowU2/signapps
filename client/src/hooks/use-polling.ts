"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/lib/store";

export interface UsePollingOptions {
  /** Polling interval in milliseconds */
  interval: number;
  /** Only poll when authenticated (default: true) */
  requireAuth?: boolean;
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
  /** Pause polling when the tab is hidden (default: true) */
  pauseOnHidden?: boolean;
}

/**
 * usePolling
 *
 * Generic polling hook that calls a callback at a fixed interval.
 * Automatically pauses when the browser tab is hidden (to save resources)
 * and when the user is not authenticated.
 *
 * @example
 * ```ts
 * usePolling(() => fetchNewEmails(), { interval: 60_000 });
 * usePolling(() => fetchChatMessages(), { interval: 30_000 });
 * ```
 */
export function usePolling(
  callback: () => void | Promise<void>,
  options: UsePollingOptions,
) {
  const {
    interval,
    requireAuth = true,
    enabled = true,
    pauseOnHidden = true,
  } = options;

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const callbackRef = useRef(callback);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep callback ref current to avoid stale closures
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      callbackRef.current();
    }, interval);
  }, [interval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const shouldPoll = enabled && (!requireAuth || isAuthenticated);
    if (!shouldPoll) {
      stopPolling();
      return;
    }

    // Run immediately on mount, then start interval
    callbackRef.current();
    startPolling();

    // Visibility change handler
    const handleVisibility = () => {
      if (!pauseOnHidden) return;
      if (document.hidden) {
        stopPolling();
      } else {
        // Run immediately when tab becomes visible again
        callbackRef.current();
        startPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [
    enabled,
    requireAuth,
    isAuthenticated,
    startPolling,
    stopPolling,
    pauseOnHidden,
  ]);
}
