"use client";

import { type ReactNode } from "react";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { FEATURES } from "@/lib/features";

interface FeatureGateProps {
  /** The feature flag key to check */
  feature: keyof typeof FEATURES;
  /** Content rendered when the feature is enabled */
  children: ReactNode;
  /** Optional fallback rendered when the feature is disabled */
  fallback?: ReactNode;
}

/**
 * FeatureGate — conditionally renders children based on a feature flag.
 *
 * Uses runtime overrides from localStorage (via feature-flags.ts), so
 * admin overrides take effect immediately without a page reload.
 *
 * @example
 * <FeatureGate feature="CHAT_PRESENCE">
 *   <PresenceIndicator />
 * </FeatureGate>
 *
 * @example
 * <FeatureGate feature="REMOTE" fallback={<ComingSoon />}>
 *   <RemoteDesktop />
 * </FeatureGate>
 */
export function FeatureGate({
  feature,
  children,
  fallback = null,
}: FeatureGateProps) {
  const enabled = isFeatureEnabled(feature);
  return enabled ? <>{children}</> : <>{fallback}</>;
}
