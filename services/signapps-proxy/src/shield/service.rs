//! SmartShield rate limiting service using Redis.

use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use signapps_common::{Error, Result};
use signapps_db::models::ShieldStats;
use std::sync::Arc;

/// SmartShield service for rate limiting.
#[derive(Clone)]
pub struct ShieldService {
    redis: Arc<ConnectionManager>,
    key_prefix: String,
}

impl ShieldService {
    /// Create a new shield service.
    pub async fn new(redis_url: &str) -> Result<Self> {
        let client = redis::Client::open(redis_url)
            .map_err(|e| Error::Internal(format!("Failed to create Redis client: {}", e)))?;

        let manager = ConnectionManager::new(client)
            .await
            .map_err(|e| Error::Internal(format!("Failed to connect to Redis: {}", e)))?;

        Ok(Self {
            redis: Arc::new(manager),
            key_prefix: "shield".to_string(),
        })
    }

    /// Check if a request should be allowed.
    pub async fn check_rate_limit(
        &self,
        route_id: &str,
        client_ip: &str,
        requests_per_second: i32,
        burst_size: i32,
    ) -> Result<RateLimitResult> {
        let key = format!("{}:rate:{}:{}", self.key_prefix, route_id, client_ip);
        let block_key = format!("{}:block:{}:{}", self.key_prefix, route_id, client_ip);

        let mut conn = (*self.redis).clone();

        // Check if IP is blocked
        let blocked: Option<String> = conn
            .get(&block_key)
            .await
            .map_err(|e| Error::Internal(format!("Redis error: {}", e)))?;

        if blocked.is_some() {
            return Ok(RateLimitResult::Blocked);
        }

        // Increment counter with sliding window
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let window_key = format!("{}:{}", key, now);

        // Increment current second counter
        let count: i32 = redis::pipe()
            .atomic()
            .incr(&window_key, 1)
            .expire(&window_key, 2)
            .query_async(&mut conn)
            .await
            .map_err(|e| Error::Internal(format!("Redis error: {}", e)))
            .map(|v: (i32, ())| v.0)?;

        // Get previous second count
        let prev_key = format!("{}:{}", key, now - 1);
        let prev_count: i32 = conn.get(&prev_key).await.unwrap_or(0);

        let total = count + prev_count;

        // Check against burst limit
        if total > burst_size {
            // Increment blocked counter
            let _: () = conn
                .incr(format!("{}:stats:blocked", self.key_prefix), 1)
                .await
                .unwrap_or(());

            return Ok(RateLimitResult::RateLimited {
                current: total,
                limit: requests_per_second,
            });
        }

        // Increment total requests counter
        let _: () = conn
            .incr(format!("{}:stats:total", self.key_prefix), 1)
            .await
            .unwrap_or(());

        Ok(RateLimitResult::Allowed {
            remaining: burst_size - total,
        })
    }

    /// Block an IP address.
    pub async fn block_ip(
        &self,
        route_id: &str,
        client_ip: &str,
        duration_seconds: i32,
    ) -> Result<()> {
        let block_key = format!("{}:block:{}:{}", self.key_prefix, route_id, client_ip);

        let mut conn = (*self.redis).clone();

        conn.set_ex::<_, _, ()>(&block_key, "blocked", duration_seconds as u64)
            .await
            .map_err(|e| Error::Internal(format!("Redis error: {}", e)))?;

        // Track active blocks
        conn.incr::<_, _, i32>(format!("{}:stats:active_blocks", self.key_prefix), 1)
            .await
            .unwrap_or(0);

        tracing::warn!(
            route_id = %route_id,
            ip = %client_ip,
            duration = duration_seconds,
            "IP blocked"
        );

        Ok(())
    }

    /// Unblock an IP address.
    pub async fn unblock_ip(&self, route_id: &str, client_ip: &str) -> Result<()> {
        let block_key = format!("{}:block:{}:{}", self.key_prefix, route_id, client_ip);

        let mut conn = (*self.redis).clone();

        let deleted: i32 = conn
            .del(&block_key)
            .await
            .map_err(|e| Error::Internal(format!("Redis error: {}", e)))?;

        if deleted > 0 {
            conn.decr::<_, _, i32>(format!("{}:stats:active_blocks", self.key_prefix), 1)
                .await
                .unwrap_or(0);
        }

        Ok(())
    }

    /// Check if an IP is blocked.
    pub async fn is_blocked(&self, route_id: &str, client_ip: &str) -> Result<bool> {
        let block_key = format!("{}:block:{}:{}", self.key_prefix, route_id, client_ip);

        let mut conn = (*self.redis).clone();

        let exists: bool = conn
            .exists(&block_key)
            .await
            .map_err(|e| Error::Internal(format!("Redis error: {}", e)))?;

        Ok(exists)
    }

    /// Get shield statistics.
    pub async fn get_stats(&self) -> Result<ShieldStats> {
        let mut conn = (*self.redis).clone();

        let total: u64 = conn
            .get(format!("{}:stats:total", self.key_prefix))
            .await
            .unwrap_or(0);

        let blocked: u64 = conn
            .get(format!("{}:stats:blocked", self.key_prefix))
            .await
            .unwrap_or(0);

        let rate_limited: u64 = conn
            .get(format!("{}:stats:rate_limited", self.key_prefix))
            .await
            .unwrap_or(0);

        let active_blocks: u32 = conn
            .get(format!("{}:stats:active_blocks", self.key_prefix))
            .await
            .unwrap_or(0);

        Ok(ShieldStats {
            total_requests: total,
            blocked_requests: blocked,
            rate_limited,
            active_blocks,
        })
    }

    /// Reset statistics.
    pub async fn reset_stats(&self) -> Result<()> {
        let mut conn = (*self.redis).clone();

        let keys = vec![
            format!("{}:stats:total", self.key_prefix),
            format!("{}:stats:blocked", self.key_prefix),
            format!("{}:stats:rate_limited", self.key_prefix),
        ];

        for key in keys {
            let _: () = conn
                .del(&key)
                .await
                .map_err(|e| Error::Internal(format!("Redis error: {}", e)))?;
        }

        Ok(())
    }

    /// Check if the service is healthy.
    pub async fn health_check(&self) -> Result<bool> {
        let mut conn = (*self.redis).clone();

        let pong: String = redis::cmd("PING")
            .query_async(&mut conn)
            .await
            .map_err(|e| Error::Internal(format!("Redis ping failed: {}", e)))?;

        Ok(pong == "PONG")
    }
}

/// Result of a rate limit check.
#[derive(Debug, Clone)]
pub enum RateLimitResult {
    /// Request is allowed.
    Allowed {
        /// Remaining requests in the window.
        remaining: i32,
    },
    /// Request is rate limited.
    RateLimited {
        /// Current request count.
        current: i32,
        /// Limit per second.
        limit: i32,
    },
    /// IP is blocked.
    Blocked,
}

impl RateLimitResult {
    /// Check if the request is allowed.
    pub fn is_allowed(&self) -> bool {
        matches!(self, Self::Allowed { .. })
    }
}
