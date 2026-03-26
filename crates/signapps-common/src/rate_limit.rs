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
    pub fn new(config: RateLimiterConfig) -> Self {
        Self {
            buckets: Arc::new(Mutex::new(HashMap::new())),
            config,
        }
    }

    /// Check if a request from the given key is allowed.
    pub fn check(&self, key: &str) -> bool {
        let mut buckets = self.buckets.lock().unwrap();
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
        let mut buckets = self.buckets.lock().unwrap();
        let now = Instant::now();
        buckets.retain(|_, b| now.duration_since(b.last_refill).as_secs() < 300);
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
