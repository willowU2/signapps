//! In-memory token bucket rate limiter middleware.
//!
//! Configurable per-route rate limits using a simple token bucket algorithm.

use axum::{extract::Request, http::StatusCode, middleware::Next, response::Response};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

#[derive(Clone)]
struct Bucket {
    tokens: f64,
    last_refill: Instant,
}

/// Rate limiter configuration.
#[derive(Clone)]
pub struct RateLimiterConfig {
    /// Maximum tokens (burst size).
    pub max_tokens: f64,
    /// Tokens refilled per second.
    pub refill_rate: f64,
}

impl Default for RateLimiterConfig {
    fn default() -> Self {
        Self {
            max_tokens: 60.0,
            refill_rate: 10.0, // 10 requests/sec sustained
        }
    }
}

/// Shared rate limiter state.
#[derive(Clone)]
pub struct RateLimiter {
    buckets: Arc<Mutex<HashMap<String, Bucket>>>,
    config: RateLimiterConfig,
}

impl RateLimiter {
    /// Create a new rate limiter with the given token-bucket configuration.
    pub fn new(config: RateLimiterConfig) -> Self {
        Self {
            buckets: Arc::new(Mutex::new(HashMap::new())),
            config,
        }
    }

    /// Check if a request from the given key is allowed.
    pub fn check(&self, key: &str) -> bool {
        let mut buckets = self.buckets.lock().expect("rate limiter mutex poisoned");
        let now = Instant::now();

        let bucket = buckets.entry(key.to_string()).or_insert(Bucket {
            tokens: self.config.max_tokens,
            last_refill: now,
        });

        // Refill tokens
        let elapsed = now.duration_since(bucket.last_refill).as_secs_f64();
        bucket.tokens =
            (bucket.tokens + elapsed * self.config.refill_rate).min(self.config.max_tokens);
        bucket.last_refill = now;

        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            true
        } else {
            false
        }
    }

    /// Remove stale entries (call periodically).
    pub fn cleanup(&self) {
        let mut buckets = self.buckets.lock().expect("rate limiter mutex poisoned");
        let now = Instant::now();
        buckets.retain(|_, b| now.duration_since(b.last_refill).as_secs() < 300);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_rate_limiter_allows_within_limit() {
        let config = RateLimiterConfig {
            max_tokens: 5.0,
            refill_rate: 1.0,
        };
        let limiter = RateLimiter::new(config);

        // First 5 requests should be allowed (max_tokens = 5)
        for _ in 0..5 {
            assert!(
                limiter.check("client1"),
                "Request within limit should be allowed"
            );
        }
    }

    #[test]
    fn test_rate_limiter_blocks_exceeding_limit() {
        let config = RateLimiterConfig {
            max_tokens: 3.0,
            refill_rate: 0.1, // very slow refill
        };
        let limiter = RateLimiter::new(config);

        // Exhaust the bucket
        for _ in 0..3 {
            limiter.check("client2");
        }

        // Next request should be blocked
        assert!(
            !limiter.check("client2"),
            "Request exceeding limit should be blocked"
        );
    }

    #[test]
    fn test_rate_limiter_resets_after_window() {
        let config = RateLimiterConfig {
            max_tokens: 2.0,
            refill_rate: 100.0, // fast refill
        };
        let limiter = RateLimiter::new(config);

        // Exhaust bucket
        limiter.check("client3");
        limiter.check("client3");
        assert!(
            !limiter.check("client3"),
            "Should be blocked after exhaustion"
        );

        // Wait for refill (100 tokens/sec × 0.1s = 10 tokens)
        thread::sleep(Duration::from_millis(100));

        // Should be allowed again after refill
        assert!(
            limiter.check("client3"),
            "Should be allowed after window reset"
        );
    }

    #[test]
    fn test_rate_limiter_isolates_keys() {
        let config = RateLimiterConfig {
            max_tokens: 1.0,
            refill_rate: 0.1,
        };
        let limiter = RateLimiter::new(config);

        // Exhaust client_a
        limiter.check("client_a");
        assert!(!limiter.check("client_a"), "client_a should be blocked");

        // client_b is independent
        assert!(limiter.check("client_b"), "client_b should not be affected");
    }
}

/// Axum middleware for rate limiting by client IP.
pub async fn rate_limit_middleware(
    limiter: RateLimiter,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let key = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .split(',')
        .next()
        .unwrap_or("unknown")
        .trim()
        .to_string();

    if limiter.check(&key) {
        Ok(next.run(req).await)
    } else {
        Err(StatusCode::TOO_MANY_REQUESTS)
    }
}
