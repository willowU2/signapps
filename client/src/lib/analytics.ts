/**
 * Analytics event tracker
 *
 * Lightweight client-side event tracker that posts to the metrics service.
 * Usage:
 *   import { track } from '@/lib/analytics';
 *   track('page_view', { page: '/dashboard' });
 *   track('button_click', { button: 'compose_email', location: 'toolbar' });
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface TrackEventPayload {
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

const METRICS_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_METRICS_URL) ||
  "http://localhost:3008/api/v1";

const TRACK_ENDPOINT = `${METRICS_URL}/metrics/track`;

// ── Event queue (fire-and-forget, batched) ────────────────────────────────────

let queue: TrackEventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 3000;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushQueue();
  }, FLUSH_INTERVAL_MS);
}

async function flushQueue() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, BATCH_SIZE);
  try {
    await fetch(TRACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      // Credentials for session-based auth on the metrics service
      credentials: "include",
    });
  } catch {
    // Silently fail — analytics must never break the app
    // Re-queue at most once to avoid memory leaks
    if (queue.length < 100) {
      queue.unshift(...batch);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Track a user analytics event.
 *
 * @param event   - Event name, e.g. 'page_view', 'button_click', 'task_created'
 * @param props   - Arbitrary key/value properties attached to the event
 */
export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return; // SSR guard

  const payload: TrackEventPayload = {
    event,
    properties: props,
    timestamp: new Date().toISOString(),
  };

  queue.push(payload);

  if (queue.length >= BATCH_SIZE) {
    // Flush immediately when batch is full
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flushQueue();
  } else {
    scheduleFlush();
  }
}

/**
 * Track a page view — convenience wrapper.
 */
export function trackPageView(
  page: string,
  props?: Record<string, unknown>,
): void {
  track("page_view", { page, ...props });
}

/**
 * Force-flush the event queue immediately (e.g. before page unload).
 */
export function flushAnalytics(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushQueue();
}

// Flush on page unload to avoid losing events
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushAnalytics);
  // Modern alternative (Chrome/Edge)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAnalytics();
  });
}
