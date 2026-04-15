"use client";

/**
 * Tenant Context
 *
 * Provides tenant configuration throughout the application.
 */

import * as React from "react";
import type {
  TenantConfig,
  TenantBranding,
  TenantFeatureToggles,
  FeatureToggleKey,
  TenantConfigSection,
} from "./types";
import { DEFAULT_TENANT_CONFIG, DEFAULT_FEATURE_TOGGLES } from "./types";

// ============================================================================
// Context Types
// ============================================================================

interface TenantContextValue {
  /** Current tenant configuration */
  config: TenantConfig | null;
  /** Whether the config is loading */
  isLoading: boolean;
  /** Error if config failed to load */
  error: Error | null;

  // Quick accessors
  /** Get branding config */
  branding: TenantBranding;
  /** Get feature toggles */
  features: TenantFeatureToggles;
  /** Check if a feature is enabled */
  isFeatureEnabled: (feature: FeatureToggleKey) => boolean;
  /** Get tenant name */
  tenantName: string;
  /** Get tenant slug */
  tenantSlug: string;

  // Actions
  /** Refresh tenant config from server */
  refreshConfig: () => Promise<void>;
  /** Update a section of the config (admin only) */
  updateConfig: (section: TenantConfigSection, data: unknown) => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const TenantContext = React.createContext<TenantContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface TenantProviderProps {
  children: React.ReactNode;
  /** Initial config (from server-side rendering) */
  initialConfig?: TenantConfig;
  /** Tenant slug to load */
  tenantSlug?: string;
}

export function TenantProvider({
  children,
  initialConfig,
  tenantSlug,
}: TenantProviderProps) {
  const [config, setConfig] = React.useState<TenantConfig | null>(
    initialConfig || null,
  );
  const [isLoading, setIsLoading] = React.useState(!initialConfig);
  const [error, setError] = React.useState<Error | null>(null);

  // Load tenant config
  const loadConfig = React.useCallback(async () => {
    if (!tenantSlug && !initialConfig) {
      // Use default config for development
      const defaultConfig: TenantConfig = {
        ...DEFAULT_TENANT_CONFIG,
        id: "default",
        slug: "default",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setConfig(defaultConfig);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // In production, this would fetch from the API
      // const response = await fetch(`/api/v1/tenants/${tenantSlug}/config`);
      // const data = await response.json();
      // setConfig(data);

      // For now, use default config
      const defaultConfig: TenantConfig = {
        ...DEFAULT_TENANT_CONFIG,
        id: tenantSlug || "default",
        slug: tenantSlug || "default",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setConfig(defaultConfig);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to load tenant config"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [tenantSlug, initialConfig]);

  React.useEffect(() => {
    if (!initialConfig) {
      loadConfig();
    }
  }, [initialConfig, loadConfig]);

  // Refresh config
  const refreshConfig = React.useCallback(async () => {
    await loadConfig();
  }, [loadConfig]);

  // Update config section
  const updateConfig = React.useCallback(
    async (section: TenantConfigSection, data: unknown) => {
      if (!config) return;

      try {
        // In production, this would call the API
        // await fetch(`/api/v1/tenants/${config.slug}/config/${section}`, {
        //   method: 'PATCH',
        //   body: JSON.stringify(data),
        // });

        // Optimistic update
        setConfig((prev) =>
          prev
            ? {
                ...prev,
                [section]: { ...prev[section], ...(data as object) },
                updatedAt: new Date().toISOString(),
              }
            : prev,
        );
      } catch (err) {
        console.error("Impossible de mettre à jour tenant config:", err);
        throw err;
      }
    },
    [config],
  );

  // Quick accessors
  const branding = config?.branding || DEFAULT_TENANT_CONFIG.branding;
  const features = config?.features || DEFAULT_FEATURE_TOGGLES;

  const isFeatureEnabled = React.useCallback(
    (feature: FeatureToggleKey) => {
      return features[feature] ?? DEFAULT_FEATURE_TOGGLES[feature];
    },
    [features],
  );

  const tenantName = config?.branding.name || "SignApps";
  const tenantSlugValue = config?.slug || "default";

  const value: TenantContextValue = {
    config,
    isLoading,
    error,
    branding,
    features,
    isFeatureEnabled,
    tenantName,
    tenantSlug: tenantSlugValue,
    refreshConfig,
    updateConfig,
  };

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useTenant() {
  const context = React.useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

export function useTenantConfig() {
  const { config, isLoading, error } = useTenant();
  return { config, isLoading, error };
}

export function useTenantBranding() {
  const { branding } = useTenant();
  return branding;
}

export function useTenantFeatures() {
  const { features, isFeatureEnabled } = useTenant();
  return { features, isFeatureEnabled };
}

export function useFeatureEnabled(feature: FeatureToggleKey) {
  const { isFeatureEnabled } = useTenant();
  return isFeatureEnabled(feature);
}

// ============================================================================
// Conditional Components
// ============================================================================

interface FeatureGateProps {
  feature: FeatureToggleKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({
  feature,
  children,
  fallback = null,
}: FeatureGateProps) {
  const enabled = useFeatureEnabled(feature);
  return enabled ? <>{children}</> : <>{fallback}</>;
}

interface MultiFeatureGateProps {
  features: FeatureToggleKey[];
  mode?: "all" | "any";
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function MultiFeatureGate({
  features,
  mode = "all",
  children,
  fallback = null,
}: MultiFeatureGateProps) {
  const { isFeatureEnabled } = useTenant();

  const enabled =
    mode === "all"
      ? features.every((f) => isFeatureEnabled(f))
      : features.some((f) => isFeatureEnabled(f));

  return enabled ? <>{children}</> : <>{fallback}</>;
}
