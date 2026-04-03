"use client";

import { useEffect, useState } from "react";
import {
  APP_REGISTRY,
  APP_CATEGORIES,
  fetchAppRegistry,
  type AppEntry,
} from "@/lib/app-registry";

/**
 * React hook that returns the dynamic app registry.
 *
 * On mount it fetches the live registry from the gateway's discovery endpoint.
 * While loading (or if the gateway is unreachable), it returns the static
 * APP_REGISTRY as a fallback.
 *
 * Results are cached in localStorage with a 5-minute TTL via fetchAppRegistry().
 */
export function useAppRegistry(): {
  apps: AppEntry[];
  categories: readonly string[];
  loading: boolean;
} {
  const [apps, setApps] = useState<AppEntry[]>(APP_REGISTRY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchAppRegistry()
      .then((result) => {
        if (!cancelled) {
          setApps(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { apps, categories: APP_CATEGORIES, loading };
}
