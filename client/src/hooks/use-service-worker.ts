"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on mount.
 * Safe to call on server — it's guarded by `navigator` check.
 */
export function useServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[SW] registration failed:", err);
      });
    }
  }, []);
}
