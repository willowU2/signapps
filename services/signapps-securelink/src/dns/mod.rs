#![allow(dead_code)]
//! DNS and Ad-blocking module for SecureLink tunnel system.
//!
//! This module provides:
//! - DNS resolution with upstream forwarding
//! - DNS caching with TTL support
//! - Ad-blocking via blocklists
//! - Optional DNS-over-HTTPS (DoH) support
//! - Local DNS server capability

pub mod blocker;
pub mod resolver;
pub mod server;

pub use blocker::AdBlocker;
pub use resolver::DnsResolver;

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

// Re-export types from tunnel module for backward compatibility
// The existing handlers use these types
pub use crate::tunnel::types::{
    BlockedDomainStat, DnsBlocklist as Blocklist, DnsRecord as CustomDnsRecord,
    DnsServiceConfig as DnsConfig, DnsStats,
};

/// Extended DNS configuration for the service with additional fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtendedDnsConfig {
    /// Base configuration (compatible with DnsServiceConfig).
    #[serde(flatten)]
    pub base: DnsConfig,
    /// Enable DNS-over-HTTPS.
    #[serde(default)]
    pub doh_enabled: bool,
    /// DoH upstream URL (e.g., "https://cloudflare-dns.com/dns-query").
    #[serde(default)]
    pub doh_url: Option<String>,
    /// List of blocklists for ad-blocking.
    #[serde(default)]
    pub blocklists: Vec<Blocklist>,
}

impl Default for ExtendedDnsConfig {
    fn default() -> Self {
        Self {
            base: DnsConfig::default(),
            doh_enabled: false,
            doh_url: None,
            blocklists: default_blocklists(),
        }
    }
}

/// Default blocklists for ad-blocking.
fn default_blocklists() -> Vec<Blocklist> {
    vec![
        Blocklist {
            id: uuid::Uuid::new_v4(),
            name: "Steven Black Hosts".to_string(),
            url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts".to_string(),
            enabled: true,
            domain_count: 0,
            last_updated: None,
        },
        Blocklist {
            id: uuid::Uuid::new_v4(),
            name: "AdAway".to_string(),
            url: "https://adaway.org/hosts.txt".to_string(),
            enabled: true,
            domain_count: 0,
            last_updated: None,
        },
    ]
}

/// Thread-safe statistics counter.
#[derive(Debug, Default)]
pub struct StatsCounter {
    pub total_queries: AtomicU64,
    pub blocked_queries: AtomicU64,
    pub cache_hits: AtomicU64,
    pub upstream_queries: AtomicU64,
    total_response_time_ms: AtomicU64,
}

impl StatsCounter {
    /// Create a new stats counter.
    pub fn new() -> Self {
        Self::default()
    }

    /// Increment total queries.
    pub fn inc_total(&self) {
        self.total_queries.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment blocked queries.
    pub fn inc_blocked(&self) {
        self.blocked_queries.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment cache hits.
    pub fn inc_cache_hit(&self) {
        self.cache_hits.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment upstream queries.
    pub fn inc_upstream(&self) {
        self.upstream_queries.fetch_add(1, Ordering::Relaxed);
    }

    /// Add response time.
    pub fn add_response_time(&self, ms: u64) {
        self.total_response_time_ms.fetch_add(ms, Ordering::Relaxed);
    }

    /// Get current stats snapshot.
    pub fn snapshot(&self) -> DnsStats {
        let total = self.total_queries.load(Ordering::Relaxed);
        let total_time = self.total_response_time_ms.load(Ordering::Relaxed);
        let avg_ms = if total > 0 {
            total_time as f64 / total as f64
        } else {
            0.0
        };

        DnsStats {
            total_queries: total,
            blocked_queries: self.blocked_queries.load(Ordering::Relaxed),
            cache_hits: self.cache_hits.load(Ordering::Relaxed),
            cache_misses: self.upstream_queries.load(Ordering::Relaxed),
            avg_response_ms: avg_ms,
            top_blocked: Vec::new(),
            queries_per_hour: Vec::new(),
        }
    }

    /// Reset all counters.
    pub fn reset(&self) {
        self.total_queries.store(0, Ordering::Relaxed);
        self.blocked_queries.store(0, Ordering::Relaxed);
        self.cache_hits.store(0, Ordering::Relaxed);
        self.upstream_queries.store(0, Ordering::Relaxed);
        self.total_response_time_ms.store(0, Ordering::Relaxed);
    }
}

/// Shared DNS service state.
#[derive(Clone)]
pub struct DnsService {
    pub resolver: Arc<DnsResolver>,
    pub blocker: Arc<AdBlocker>,
    pub stats: Arc<StatsCounter>,
    pub config: ExtendedDnsConfig,
}

impl DnsService {
    /// Create a new DNS service from base configuration.
    pub fn new(config: DnsConfig) -> signapps_common::Result<Self> {
        Self::with_extended_config(ExtendedDnsConfig {
            base: config,
            ..Default::default()
        })
    }

    /// Create a new DNS service with extended configuration.
    pub fn with_extended_config(config: ExtendedDnsConfig) -> signapps_common::Result<Self> {
        // Convert upstream addresses (add :53 if needed)
        let upstream_servers: Vec<String> = config
            .base
            .upstream
            .iter()
            .map(|s| {
                if s.contains(':') {
                    s.clone()
                } else {
                    format!("{}:53", s)
                }
            })
            .collect();

        let resolver = DnsResolver::new(
            upstream_servers,
            config.base.cache_ttl,
            config.doh_enabled,
            config.doh_url.clone(),
        )?;

        let blocker = AdBlocker::new();

        Ok(Self {
            resolver: Arc::new(resolver),
            blocker: Arc::new(blocker),
            stats: Arc::new(StatsCounter::new()),
            config,
        })
    }

    /// Initialize the service (load blocklists, etc.).
    pub async fn initialize(&self) -> signapps_common::Result<()> {
        if self.config.base.adblock_enabled {
            for blocklist in &self.config.blocklists {
                if blocklist.enabled {
                    tracing::info!("Loading blocklist: {}", blocklist.name);
                    if let Err(e) = self.blocker.load_from_url(&blocklist.url).await {
                        tracing::warn!("Failed to load blocklist {}: {}", blocklist.name, e);
                    }
                }
            }
            tracing::info!(
                "Ad-blocker initialized with {} blocked domains",
                self.blocker.domain_count()
            );
        }

        // Add custom records to resolver
        for record in &self.config.base.custom_records {
            self.resolver.add_custom_record(
                &record.name,
                &record.record_type,
                &record.value,
                record.ttl,
            );
        }

        Ok(())
    }

    /// Get current statistics.
    pub fn stats(&self) -> DnsStats {
        let mut stats = self.stats.snapshot();
        // Add top blocked domains
        stats.top_blocked = self
            .blocker
            .top_blocked(10)
            .into_iter()
            .map(|(domain, count)| BlockedDomainStat { domain, count })
            .collect();
        stats
    }

    /// Check if a domain should be blocked.
    pub fn is_blocked(&self, domain: &str) -> bool {
        self.config.base.adblock_enabled && self.blocker.is_blocked(domain)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = DnsConfig::default();
        assert!(!config.enabled);
        assert_eq!(config.upstream.len(), 2);
        assert_eq!(config.cache_ttl, 300);
    }

    #[test]
    fn test_extended_config() {
        let config = ExtendedDnsConfig::default();
        assert!(!config.base.enabled);
        assert!(!config.doh_enabled);
        assert_eq!(config.blocklists.len(), 2);
    }

    #[test]
    fn test_stats_counter() {
        let counter = StatsCounter::new();
        counter.inc_total();
        counter.inc_total();
        counter.inc_blocked();
        counter.inc_cache_hit();
        counter.inc_upstream();
        counter.add_response_time(50);
        counter.add_response_time(100);

        let stats = counter.snapshot();
        assert_eq!(stats.total_queries, 2);
        assert_eq!(stats.blocked_queries, 1);
        assert_eq!(stats.cache_hits, 1);
        assert_eq!(stats.cache_misses, 1);
        assert_eq!(stats.avg_response_ms, 75.0);
    }
}
