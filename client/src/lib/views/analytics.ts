/**
 * View Analytics
 *
 * Track view usage for insights and recommendations.
 */

import { useCallback, useEffect } from "react";
import { useViewsStore } from "@/stores/views-store";

// ============================================================================
// Types
// ============================================================================

export interface ViewUsageEvent {
  viewId: string;
  entityType: string;
  action: "view" | "filter" | "sort" | "export" | "share";
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ViewAnalytics {
  viewId: string;
  entityType: string;
  viewCount: number;
  lastUsed: string;
  filterCount: number;
  exportCount: number;
  shareCount: number;
}

// ============================================================================
// Analytics Store Extension
// ============================================================================

interface AnalyticsState {
  events: ViewUsageEvent[];
  analytics: Record<string, ViewAnalytics>;
}

// Store analytics in sessionStorage for privacy
const STORAGE_KEY = "view-analytics";

function getStoredAnalytics(): AnalyticsState {
  if (typeof window === "undefined") {
    return { events: [], analytics: {} };
  }
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { events: [], analytics: {} };
  } catch {
    return { events: [], analytics: {} };
  }
}

function setStoredAnalytics(state: AnalyticsState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Track View Event
// ============================================================================

export function trackViewEvent(
  viewId: string,
  entityType: string,
  action: ViewUsageEvent["action"],
  metadata?: Record<string, unknown>
) {
  const state = getStoredAnalytics();

  // Add event
  const event: ViewUsageEvent = {
    viewId,
    entityType,
    action,
    timestamp: new Date().toISOString(),
    metadata,
  };
  state.events = [...state.events.slice(-99), event]; // Keep last 100 events

  // Update analytics
  const key = `${entityType}:${viewId}`;
  const existing = state.analytics[key] || {
    viewId,
    entityType,
    viewCount: 0,
    lastUsed: "",
    filterCount: 0,
    exportCount: 0,
    shareCount: 0,
  };

  switch (action) {
    case "view":
      existing.viewCount++;
      break;
    case "filter":
      existing.filterCount++;
      break;
    case "export":
      existing.exportCount++;
      break;
    case "share":
      existing.shareCount++;
      break;
  }
  existing.lastUsed = event.timestamp;

  state.analytics[key] = existing;
  setStoredAnalytics(state);
}

// ============================================================================
// Analytics Hooks
// ============================================================================

export function useViewAnalytics(entityType: string) {
  const state = getStoredAnalytics();

  const getViewStats = useCallback(
    (viewId: string): ViewAnalytics | null => {
      const key = `${entityType}:${viewId}`;
      return state.analytics[key] || null;
    },
    [entityType, state.analytics]
  );

  const getMostUsedViews = useCallback(
    (limit = 5): ViewAnalytics[] => {
      return Object.values(state.analytics)
        .filter((a) => a.entityType === entityType)
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, limit);
    },
    [entityType, state.analytics]
  );

  const getRecentlyUsedViews = useCallback(
    (limit = 5): ViewAnalytics[] => {
      return Object.values(state.analytics)
        .filter((a) => a.entityType === entityType)
        .sort((a, b) => b.lastUsed.localeCompare(a.lastUsed))
        .slice(0, limit);
    },
    [entityType, state.analytics]
  );

  const getRecentEvents = useCallback(
    (limit = 10): ViewUsageEvent[] => {
      return state.events
        .filter((e) => e.entityType === entityType)
        .slice(-limit)
        .reverse();
    },
    [entityType, state.events]
  );

  return {
    getViewStats,
    getMostUsedViews,
    getRecentlyUsedViews,
    getRecentEvents,
  };
}

// ============================================================================
// Auto-tracking Hook
// ============================================================================

export function useTrackViewUsage(
  entityType: string,
  viewId: string | null
) {
  useEffect(() => {
    if (viewId) {
      trackViewEvent(viewId, entityType, "view");
    }
  }, [viewId, entityType]);
}

// ============================================================================
// Recommendations
// ============================================================================

export interface ViewRecommendation {
  viewId: string;
  reason: "popular" | "recent" | "similar";
  score: number;
}

export function useViewRecommendations(
  entityType: string,
  currentViewId: string | null,
  limit = 3
): ViewRecommendation[] {
  const { getMostUsedViews, getRecentlyUsedViews } = useViewAnalytics(entityType);

  const popular = getMostUsedViews(limit);
  const recent = getRecentlyUsedViews(limit);

  const recommendations: ViewRecommendation[] = [];

  // Add popular views
  popular.forEach((v, i) => {
    if (v.viewId !== currentViewId) {
      recommendations.push({
        viewId: v.viewId,
        reason: "popular",
        score: (limit - i) * 2,
      });
    }
  });

  // Add recent views
  recent.forEach((v, i) => {
    if (v.viewId !== currentViewId) {
      const existing = recommendations.find((r) => r.viewId === v.viewId);
      if (existing) {
        existing.score += limit - i;
      } else {
        recommendations.push({
          viewId: v.viewId,
          reason: "recent",
          score: limit - i,
        });
      }
    }
  });

  // Sort by score and return top N
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ============================================================================
// Export Analytics Data
// ============================================================================

export function exportAnalyticsData(): AnalyticsState {
  return getStoredAnalytics();
}

export function clearAnalyticsData() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
