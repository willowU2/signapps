/**
 * Client-side Circuit Breaker
 *
 * Prevents cascading failures when backend services are down.
 * After `threshold` consecutive failures the circuit opens and
 * immediately rejects requests for `resetTimeoutMs` before allowing
 * a single probe request through (half-open state).
 *
 * Usage:
 *   const breaker = getBreaker('identity');
 *   await breaker.call(() => fetch('/api/v1/users'));
 */

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  threshold?: number;
  /** Milliseconds to wait before allowing a probe request */
  resetTimeoutMs?: number;
}

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly resetTimeoutMs: number;

  constructor(
    public readonly name: string,
    opts?: CircuitBreakerOptions,
  ) {
    this.threshold = opts?.threshold ?? 3;
    this.resetTimeoutMs = opts?.resetTimeoutMs ?? 30_000; // 30 seconds
  }

  /**
   * Execute `fn` through the circuit breaker.
   * Throws a `CircuitOpenError` when the circuit is open.
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        // Allow a single probe request
        this.state = 'half-open';
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
    this.state = 'closed';
  }

  private onFailure() {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }
  }

  /** Current circuit state — useful for diagnostics */
  get currentState(): CircuitState {
    return this.state;
  }

  /** Reset the breaker (e.g. on manual refresh) */
  reset() {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

export class CircuitOpenError extends Error {
  constructor(serviceName: string) {
    super(`Circuit breaker open for service "${serviceName}"`);
    this.name = 'CircuitOpenError';
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
