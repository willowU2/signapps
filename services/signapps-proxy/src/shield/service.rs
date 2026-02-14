//! SmartShield rate limiting service using in-process cache.

use signapps_cache::CacheService;
use signapps_common::Result;
use signapps_db::models::{ShieldConfig, ShieldStats};
use std::net::IpAddr;
use std::time::Duration;

/// SmartShield service for rate limiting.
#[derive(Clone)]
pub struct ShieldService {
    cache: CacheService,
    key_prefix: String,
}

impl ShieldService {
    /// Create a new shield service with in-process cache.
    pub fn new() -> Self {
        // Rate-limit windows are 2s, blocked IPs up to ~5min.
        // 100k entries is more than enough for rate-limit keys.
        let cache = CacheService::new(100_000, Duration::from_secs(10));

        Self {
            cache,
            key_prefix: "shield".to_string(),
        }
    }

    /// Check if a request should be allowed.
    pub async fn check_rate_limit(
        &self,
        route_id: &str,
        client_ip: &str,
        requests_per_second: i32,
        burst_size: i32,
    ) -> Result<RateLimitResult> {
        let block_key = format!("{}:block:{}:{}", self.key_prefix, route_id, client_ip);

        // Check if IP is blocked
        if self.cache.exists(&block_key).await {
            return Ok(RateLimitResult::Blocked);
        }

        // Sliding window rate limiting using atomic counters
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let window_key = format!(
            "{}:rate:{}:{}:{}",
            self.key_prefix, route_id, client_ip, now
        );
        let prev_key = format!(
            "{}:rate:{}:{}:{}",
            self.key_prefix,
            route_id,
            client_ip,
            now - 1
        );

        // Increment current second counter
        let count = self.cache.incr(&window_key) as i32;

        // Mark current window key for expiry (2 seconds)
        self.cache
            .set(&format!("{}:ttl", window_key), "1", Duration::from_secs(2))
            .await;

        // Get previous second count
        let prev_count = self.cache.get_counter(&prev_key) as i32;

        let total = count + prev_count;

        // Check against burst limit
        if total > burst_size {
            self.cache
                .incr(&format!("{}:stats:blocked", self.key_prefix));
            return Ok(RateLimitResult::RateLimited {
                current: total,
                limit: requests_per_second,
            });
        }

        // Increment total requests counter
        self.cache.incr(&format!("{}:stats:total", self.key_prefix));

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

        self.cache
            .set(
                &block_key,
                "blocked",
                Duration::from_secs(duration_seconds as u64),
            )
            .await;

        self.cache
            .incr(&format!("{}:stats:active_blocks", self.key_prefix));

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

        if self.cache.exists(&block_key).await {
            self.cache.del(&block_key).await;
            self.cache
                .decr(&format!("{}:stats:active_blocks", self.key_prefix));
        }

        Ok(())
    }

    /// Check if an IP is blocked.
    pub async fn is_blocked(&self, route_id: &str, client_ip: &str) -> Result<bool> {
        let block_key = format!("{}:block:{}:{}", self.key_prefix, route_id, client_ip);
        Ok(self.cache.exists(&block_key).await)
    }

    /// Get shield statistics.
    pub async fn get_stats(&self) -> Result<ShieldStats> {
        let total = self
            .cache
            .get_counter(&format!("{}:stats:total", self.key_prefix)) as u64;
        let blocked =
            self.cache
                .get_counter(&format!("{}:stats:blocked", self.key_prefix)) as u64;
        let rate_limited =
            self.cache
                .get_counter(&format!("{}:stats:rate_limited", self.key_prefix)) as u64;
        let active_blocks = self
            .cache
            .get_counter(&format!("{}:stats:active_blocks", self.key_prefix))
            as u32;

        Ok(ShieldStats {
            total_requests: total,
            blocked_requests: blocked,
            rate_limited,
            active_blocks,
        })
    }

    /// Reset statistics.
    pub async fn reset_stats(&self) -> Result<()> {
        self.cache
            .reset_counter(&format!("{}:stats:total", self.key_prefix));
        self.cache
            .reset_counter(&format!("{}:stats:blocked", self.key_prefix));
        self.cache
            .reset_counter(&format!("{}:stats:rate_limited", self.key_prefix));

        Ok(())
    }

    /// Check if a request should be allowed, considering whitelist,
    /// blacklist, and rate limits from the full shield configuration.
    pub async fn check_request(
        &self,
        route_id: &str,
        client_ip: &str,
        config: &ShieldConfig,
    ) -> Result<RateLimitResult> {
        // Whitelist: always allow
        if !config.whitelist.is_empty() && ip_matches_list(client_ip, &config.whitelist) {
            return Ok(RateLimitResult::Allowed {
                remaining: config.burst_size,
            });
        }

        // Blacklist: always block
        if !config.blacklist.is_empty() && ip_matches_list(client_ip, &config.blacklist) {
            tracing::info!(
                route_id = %route_id,
                ip = %client_ip,
                "Request blocked by IP blacklist"
            );
            return Ok(RateLimitResult::Blocked);
        }

        // Delegate to rate limiting
        self.check_rate_limit(
            route_id,
            client_ip,
            config.requests_per_second,
            config.burst_size,
        )
        .await
    }

    /// Check if the service is healthy.
    pub fn health_check(&self) -> bool {
        self.cache.health_check()
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

/// Check if an IP address matches any entry in a list (exact or CIDR).
fn ip_matches_list(client_ip: &str, list: &[String]) -> bool {
    let ip: IpAddr = match client_ip.parse() {
        Ok(ip) => ip,
        Err(_) => return false,
    };

    for entry in list {
        if entry.contains('/') {
            if cidr_contains(entry, &ip) {
                return true;
            }
        } else if let Ok(list_ip) = entry.parse::<IpAddr>() {
            if ip == list_ip {
                return true;
            }
        }
    }
    false
}

/// Check if an IP address falls within a CIDR range.
fn cidr_contains(cidr: &str, ip: &IpAddr) -> bool {
    let parts: Vec<&str> = cidr.splitn(2, '/').collect();
    if parts.len() != 2 {
        return false;
    }
    let network_ip: IpAddr = match parts[0].parse() {
        Ok(ip) => ip,
        Err(_) => return false,
    };
    let prefix_len: u32 = match parts[1].parse() {
        Ok(len) => len,
        Err(_) => return false,
    };

    match (network_ip, ip) {
        (IpAddr::V4(net), IpAddr::V4(addr)) => {
            if prefix_len > 32 {
                return false;
            }
            if prefix_len == 0 {
                return true;
            }
            let mask = !0u32 << (32 - prefix_len);
            (u32::from(*addr) & mask) == (u32::from(net) & mask)
        },
        (IpAddr::V6(net), IpAddr::V6(addr)) => {
            if prefix_len > 128 {
                return false;
            }
            if prefix_len == 0 {
                return true;
            }
            let net_bytes = net.octets();
            let addr_bytes = addr.octets();
            let full_bytes = (prefix_len / 8) as usize;
            let remaining_bits = prefix_len % 8;

            for i in 0..full_bytes {
                if net_bytes[i] != addr_bytes[i] {
                    return false;
                }
            }
            if remaining_bits > 0 && full_bytes < 16 {
                let mask = !0u8 << (8 - remaining_bits);
                if (net_bytes[full_bytes] & mask) != (addr_bytes[full_bytes] & mask) {
                    return false;
                }
            }
            true
        },
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ip_exact_match() {
        let list = vec!["192.168.1.1".to_string(), "10.0.0.1".to_string()];
        assert!(ip_matches_list("192.168.1.1", &list));
        assert!(ip_matches_list("10.0.0.1", &list));
        assert!(!ip_matches_list("192.168.1.2", &list));
    }

    #[test]
    fn test_ip_cidr_match() {
        let list = vec!["192.168.1.0/24".to_string()];
        assert!(ip_matches_list("192.168.1.1", &list));
        assert!(ip_matches_list("192.168.1.254", &list));
        assert!(!ip_matches_list("192.168.2.1", &list));
    }

    #[test]
    fn test_ip_cidr_16() {
        let list = vec!["10.0.0.0/16".to_string()];
        assert!(ip_matches_list("10.0.0.1", &list));
        assert!(ip_matches_list("10.0.255.255", &list));
        assert!(!ip_matches_list("10.1.0.1", &list));
    }

    #[test]
    fn test_invalid_ip() {
        let list = vec!["192.168.1.0/24".to_string()];
        assert!(!ip_matches_list("not-an-ip", &list));
    }
}
