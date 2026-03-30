'use client';

/**
 * WL3: Per-tenant feature flag hook.
 *
 * Returns whether a named module/feature is enabled for the current tenant.
 *
 * Resolution order (highest priority first):
 *  1. Admin runtime override (localStorage via useFeatureFlags)
 *  2. Tenant-level feature config fetched from `/api/v1/workspaces/:id/features`
 *  3. Global default from FEATURES map (features.ts)
 *
 * Usage:
 *   const mailEnabled = useFeatureFlag('MAIL');
 *   if (!mailEnabled) return null;
 */

import { useCallback, useEffect, useState } from 'react';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { FEATURES } from '@/lib/features';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Feature key — must match a key in FEATURES map. */
export type FeatureKey = keyof typeof FEATURES;

/** Tenant feature config fetched from the backend. */
interface TenantFeatureConfig {
  [key: string]: boolean;
}

// ---------------------------------------------------------------------------
// In-memory tenant feature cache (per page load)
// ---------------------------------------------------------------------------

let tenantFeaturesCache: TenantFeatureConfig | null = null;
let tenantFeaturesFetching = false;
const tenantFeaturesListeners = new Set<() => void>();

/** Fetch tenant feature config from the identity service. */
async function fetchTenantFeatures(): Promise<TenantFeatureConfig> {
  if (tenantFeaturesCache) return tenantFeaturesCache;
  if (tenantFeaturesFetching) {
    // Wait for the in-flight request
    return new Promise((resolve) => {
      const listener = () => {
        resolve(tenantFeaturesCache ?? {});
        tenantFeaturesListeners.delete(listener);
      };
      tenantFeaturesListeners.add(listener);
    });
  }

  tenantFeaturesFetching = true;

  try {
    const res = await fetch('/api/v1/workspace/features', {
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      // The backend returns { features: { mail: true, billing: false, ... } }
      tenantFeaturesCache = data.features ?? data ?? {};
    } else {
      tenantFeaturesCache = {};
    }
  } catch {
    tenantFeaturesCache = {};
  } finally {
    tenantFeaturesFetching = false;
    tenantFeaturesListeners.forEach((l) => l());
    tenantFeaturesListeners.clear();
  }

  return tenantFeaturesCache!;
}

/** Invalidate the tenant features cache (e.g. after admin toggle). */
export function invalidateTenantFeatureCache(): void {
  tenantFeaturesCache = null;
}

// ---------------------------------------------------------------------------
// Hook: useFeatureFlag
// ---------------------------------------------------------------------------

/**
 * Check if a single feature is enabled for the current tenant.
 *
 * @param feature - Feature key from FEATURES map
 * @returns boolean — true if enabled
 */
export function useFeatureFlag(feature: FeatureKey): boolean {
  const [tenantFeatures, setTenantFeatures] = useState<TenantFeatureConfig>(
    tenantFeaturesCache ?? {}
  );

  useEffect(() => {
    fetchTenantFeatures().then((features) => {
      setTenantFeatures(features);
    });
  }, []);

  // Resolution order: admin override → tenant config → global default
  const key = feature.toLowerCase();

  // 1. Admin runtime override (localStorage)
  if (isFeatureEnabled(feature) !== Boolean(FEATURES[feature])) {
    // There's an active override in localStorage
    return isFeatureEnabled(feature);
  }

  // 2. Tenant-level config (from backend)
  if (key in tenantFeatures) {
    return Boolean(tenantFeatures[key]);
  }

  // 3. Global default
  return isFeatureEnabled(feature);
}

// ---------------------------------------------------------------------------
// Hook: useFeatureFlags (batch)
// ---------------------------------------------------------------------------

/**
 * Check multiple feature flags at once.
 *
 * @param features - Array of feature keys
 * @returns Record<FeatureKey, boolean>
 */
export function useFeatureFlags(
  features: FeatureKey[]
): Record<string, boolean> {
  const [tenantFeatures, setTenantFeatures] = useState<TenantFeatureConfig>(
    tenantFeaturesCache ?? {}
  );

  useEffect(() => {
    fetchTenantFeatures().then((f) => setTenantFeatures(f));
  }, []);

  return Object.fromEntries(
    features.map((feature) => {
      const key = feature.toLowerCase();
      const globalDefault = isFeatureEnabled(feature);

      const value =
        key in tenantFeatures ? Boolean(tenantFeatures[key]) : globalDefault;

      return [feature, value];
    })
  );
}

// ---------------------------------------------------------------------------
// Hook: useIsFeatureEnabled (simpler alias)
// ---------------------------------------------------------------------------

/**
 * Simpler alias for useFeatureFlag — useful for inline conditionals.
 *
 * @example
 *   const { enabled } = useIsFeatureEnabled('BILLING');
 *   if (!enabled) return <UpgradePrompt />;
 */
export function useIsFeatureEnabled(feature: FeatureKey): { enabled: boolean; loading: boolean } {
  const [loading, setLoading] = useState(!tenantFeaturesCache);
  const [enabled, setEnabled] = useState(() => isFeatureEnabled(feature));

  useEffect(() => {
    fetchTenantFeatures().then((tenantFeatures) => {
      const key = feature.toLowerCase();
      if (key in tenantFeatures) {
        setEnabled(Boolean(tenantFeatures[key]));
      } else {
        setEnabled(isFeatureEnabled(feature));
      }
      setLoading(false);
    });
  }, [feature]);

  return { enabled, loading };
}
