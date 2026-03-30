'use client';

import { useSyncExternalStore, useCallback } from 'react';
import { FEATURES } from './features';

const STORAGE_KEY = 'signapps-feature-overrides';

type FeatureKey = keyof typeof FEATURES;

// Runtime overrides stored in localStorage
let overrides: Record<string, boolean> = {};
const listeners = new Set<() => void>();

function loadOverrides() {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) overrides = JSON.parse(stored);
  } catch {}
}

function saveOverrides() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

function notify() {
  listeners.forEach(l => l());
}

loadOverrides();

/** Check if a feature is enabled (overrides take priority). */
export function isFeatureEnabled(key: FeatureKey): boolean {
  if (key in overrides) return overrides[key];
  return FEATURES[key] ?? false;
}

/** Override a feature flag at runtime. */
export function setFeatureOverride(key: FeatureKey, enabled: boolean) {
  overrides[key] = enabled;
  saveOverrides();
  notify();
}

/** Remove a runtime override (revert to default). */
export function clearFeatureOverride(key: FeatureKey) {
  delete overrides[key];
  saveOverrides();
  notify();
}

/** Clear all overrides. */
export function clearAllOverrides() {
  overrides = {};
  saveOverrides();
  notify();
}

/** Get all feature flags with their current effective values. */
export function getAllFeatures(): Record<string, { default: boolean; override?: boolean; effective: boolean }> {
  const result: Record<string, { default: boolean; override?: boolean; effective: boolean }> = {};
  for (const [key, defaultVal] of Object.entries(FEATURES)) {
    const override = overrides[key];
    result[key] = {
      default: defaultVal,
      override: override,
      effective: override !== undefined ? override : defaultVal,
    };
  }
  return result;
}

/** React hook for reactive feature flag access. */
export function useFeatureFlags() {
  const snapshot = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => JSON.stringify(overrides),
    () => '{}',
  );

  return {
    isEnabled: useCallback((key: FeatureKey) => isFeatureEnabled(key), []),
    setOverride: setFeatureOverride,
    clearOverride: clearFeatureOverride,
    clearAll: clearAllOverrides,
    getAll: getAllFeatures,
  };
}
