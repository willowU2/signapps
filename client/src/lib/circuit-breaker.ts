/**
 * Client-side Circuit Breaker
 *
 * Prevents cascading failures when backend services are down.
 * After `threshold` consecutive failures the circuit opens and
 * immediately rejects requests for `resetTimeoutMs` before allowing
 * a single probe request through (half-open state).
 *
 * Auto-reconnect: A periodic health check probes open/half-open circuits
 * every `healthCheckIntervalMs` (default 60 s). When a previously-failed
 * service responds, the circuit is automatically reset so that subsequent
 * requests flow through without waiting for a user action.
 *
 * Usage:
 *   const breaker = getBreaker('identity');
 *   await breaker.call(() => fetch('/api/v1/users'));
 */

type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  threshold?: number;
  /** Milliseconds to wait before allowing a probe request */
  resetTimeoutMs?: number;
  /** Health-check URL used by auto-reconnect (absolute) */
  healthUrl?: string;
}

/** Callback signature for circuit state change events */
type StateChangeCallback = (
  serviceName: string,
  from: CircuitState,
  to: CircuitState,
) => void;

/** Global list of state-change listeners */
const stateChangeListeners: StateChangeCallback[] = [];

/**
 * Subscribe to circuit state changes (e.g. to show a toast on recovery).
 * Returns an unsubscribe function.
 */
export function onCircuitStateChange(cb: StateChangeCallback): () => void {
  stateChangeListeners.push(cb);
  return () => {
    const idx = stateChangeListeners.indexOf(cb);
    if (idx >= 0) stateChangeListeners.splice(idx, 1);
  };
}

class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly resetTimeoutMs: number;
  readonly healthUrl: string | undefined;

  constructor(
    public readonly name: string,
    opts?: CircuitBreakerOptions,
  ) {
    this.threshold = opts?.threshold ?? 3;
    this.resetTimeoutMs = opts?.resetTimeoutMs ?? 30_000; // 30 seconds
    this.healthUrl = opts?.healthUrl;
  }

  /**
   * Execute `fn` through the circuit breaker.
   * Throws a `CircuitOpenError` when the circuit is open.
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        // Allow a single probe request
        this.transitionTo("half-open");
      } else {
        throw new CircuitOpenError(this.name);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    if (this.state !== "closed") {
      this.transitionTo("closed");
    }
  }

  private onFailure() {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.threshold) {
      this.transitionTo("open");
    }
  }

  /** Transition to a new state and notify listeners */
  private transitionTo(newState: CircuitState) {
    const prev = this.state;
    if (prev === newState) return;
    this.state = newState;
    for (const cb of stateChangeListeners) {
      try {
        cb(this.name, prev, newState);
      } catch {
        // listener errors must not break the breaker
      }
    }
  }

  /** Current circuit state — useful for diagnostics */
  get currentState(): CircuitState {
    return this.state;
  }

  /** Whether this breaker is in an unhealthy state (open or half-open) */
  get isOpen(): boolean {
    return this.state === "open" || this.state === "half-open";
  }

  /** Reset the breaker (e.g. on manual refresh or auto-reconnect) */
  reset() {
    const prev = this.state;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    if (prev !== "closed") {
      this.transitionTo("closed");
    } else {
      this.state = "closed";
    }
  }
}

export class CircuitOpenError extends Error {
  constructor(serviceName: string) {
    super(`Circuit breaker open for service "${serviceName}"`);
    this.name = "CircuitOpenError";
  }
}

// ---------------------------------------------------------------------------
// Global registry — one breaker per service name
// ---------------------------------------------------------------------------

const breakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a service.
 */
export function getBreaker(
  serviceName: string,
  opts?: CircuitBreakerOptions,
): CircuitBreaker {
  let breaker = breakers.get(serviceName);
  if (!breaker) {
    breaker = new CircuitBreaker(serviceName, opts);
    breakers.set(serviceName, breaker);
  }
  return breaker;
}

/**
 * Reset all circuit breakers (e.g. on manual "Refresh" click).
 */
export function resetAllBreakers() {
  breakers.forEach((b) => b.reset());
}

// ---------------------------------------------------------------------------
// Auto-reconnect: periodic health-check for open circuits
// ---------------------------------------------------------------------------

const HEALTH_CHECK_INTERVAL_MS = 60_000; // 60 seconds

let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Probe every open/half-open breaker. If its health endpoint responds
 * successfully the breaker is reset so subsequent API calls succeed.
 */
async function probeOpenCircuits(): Promise<void> {
  const entries = Array.from(breakers.entries());
  for (const [, breaker] of entries) {
    if (!breaker.isOpen) continue;

    // Determine probe URL: prefer explicit healthUrl, fall back to name-based convention
    const probeUrl = breaker.healthUrl;
    if (!probeUrl) continue;

    try {
      const response = await fetch(probeUrl, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        breaker.reset();
      }
    } catch {
      // Still unreachable — leave breaker in its current state
    }
  }
}

/**
 * Start the auto-reconnect health-check loop.
 * Safe to call multiple times — only one timer will be active.
 */
export function startAutoReconnect(): void {
  if (healthCheckTimer !== null) return;
  healthCheckTimer = setInterval(probeOpenCircuits, HEALTH_CHECK_INTERVAL_MS);

  // Also run an immediate probe so we don't wait a full interval
  // after the first call (e.g. after initial page load).
  void probeOpenCircuits();
}

/**
 * Stop the auto-reconnect loop (e.g. during tests or unmount).
 */
export function stopAutoReconnect(): void {
  if (healthCheckTimer !== null) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Service-aware breaker helper (integrates with API factory)
// ---------------------------------------------------------------------------

/**
 * Get or create a circuit breaker for a known service.
 * Automatically configures the health URL for auto-reconnect probing
 * based on the service port convention (localhost:{port}/health).
 *
 * Import ServiceName from '@/lib/api/factory' to use this.
 */
export function getServiceBreaker(serviceName: string): CircuitBreaker {
  let breaker = breakers.get(serviceName);
  if (breaker) return breaker;

  // Lazy-import service config to avoid circular deps at module init time.
  // The health URL is only needed when the breaker actually opens, so we
  // resolve it once at creation time.
  let healthUrl: string | undefined;
  try {
    // Dynamic require-like: we import the well-known port map directly.
    // Service ports follow the convention: localhost:{port}/health
    const SERVICE_PORTS: Record<string, number> = {
      identity: 3001,
      containers: 3002,
      proxy: 3003,
      storage: 3004,
      ai: 3005,
      securelink: 3006,
      scheduler: 3007,
      metrics: 3008,
      media: 3009,
      docs: 3010,
      calendar: 3011,
      mail: 3012,
      collab: 3013,
      meet: 3014,
      "it-assets": 3015,
      pxe: 3016,
      remote: 3017,
      office: 3018,
      workforce: 3019,
      chat: 3020,
      contacts: 3021,
      social: 3019,
    };
    const port = SERVICE_PORTS[serviceName];
    if (port) {
      healthUrl = `http://localhost:${port}/health`;
    }
  } catch {
    // Fallback: no health URL, auto-reconnect won't probe this breaker
  }

  breaker = new CircuitBreaker(serviceName, { healthUrl });
  breakers.set(serviceName, breaker);
  return breaker;
}

// Auto-start in browser environments
if (typeof window !== "undefined") {
  startAutoReconnect();
}
