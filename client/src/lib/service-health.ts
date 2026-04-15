/**
 * Service health cache — prevents console error floods from offline services.
 *
 * When a service returns a connection error (ECONNREFUSED, Network Error),
 * it's marked as "down" for 60 seconds. Subsequent requests to that service
 * are silently rejected without hitting the network or logging to console.
 */

interface ServiceStatus {
  healthy: boolean;
  lastCheck: number;
  failCount: number;
}

const HEALTH_CACHE_TTL = 60_000; // 60 seconds
const MAX_SILENT_FAILS = 3; // After 3 fails, stop retrying silently

const serviceHealth = new Map<string, ServiceStatus>();

/**
 * Extract service base URL (host:port) from a full URL.
 */
function getServiceKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "80"}`;
  } catch {
    return url;
  }
}

/**
 * Check if a service is known to be down.
 * Returns true if the service was recently marked as unhealthy.
 */
export function isServiceDown(url: string): boolean {
  const key = getServiceKey(url);
  const status = serviceHealth.get(key);
  if (!status) return false;

  // Cache expired — allow retry
  if (Date.now() - status.lastCheck > HEALTH_CACHE_TTL) {
    serviceHealth.delete(key);
    return false;
  }

  return !status.healthy && status.failCount >= MAX_SILENT_FAILS;
}

/**
 * Mark a service as down after a connection error.
 */
export function markServiceDown(url: string): void {
  const key = getServiceKey(url);
  const existing = serviceHealth.get(key);
  serviceHealth.set(key, {
    healthy: false,
    lastCheck: Date.now(),
    failCount: (existing?.failCount ?? 0) + 1,
  });
}

/**
 * Mark a service as healthy after a successful response.
 */
export function markServiceUp(url: string): void {
  const key = getServiceKey(url);
  serviceHealth.set(key, {
    healthy: true,
    lastCheck: Date.now(),
    failCount: 0,
  });
}

/**
 * Get all known service statuses (for debug/status page).
 */
export function getServiceStatuses(): Record<string, ServiceStatus> {
  const result: Record<string, ServiceStatus> = {};
  serviceHealth.forEach((status, key) => {
    result[key] = { ...status };
  });
  return result;
}
