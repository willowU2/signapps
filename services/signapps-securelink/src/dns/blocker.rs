#![allow(dead_code)]
//! Ad-blocking functionality via DNS blocklists.
//!
//! Loads and manages blocklists from various sources (hosts file format)
//! to block advertising, tracking, and malware domains.

use chrono::{DateTime, Utc};
use signapps_common::{Error, Result};
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::RwLock;
use uuid::Uuid;

/// Statistics for a blocked domain.
#[derive(Debug)]
pub struct BlockedDomainStats {
    /// Number of times this domain was blocked.
    pub count: AtomicU64,
    /// First time blocked.
    pub first_blocked: DateTime<Utc>,
    /// Last time blocked.
    pub last_blocked: RwLock<DateTime<Utc>>,
}

impl BlockedDomainStats {
    fn new() -> Self {
        let now = Utc::now();
        Self {
            count: AtomicU64::new(1),
            first_blocked: now,
            last_blocked: RwLock::new(now),
        }
    }

    fn increment(&self) {
        self.count.fetch_add(1, Ordering::Relaxed);
        *self.last_blocked.write().unwrap_or_else(|e| e.into_inner()) = Utc::now();
    }
}

/// Information about a loaded blocklist.
#[derive(Debug, Clone)]
pub struct LoadedBlocklist {
    /// Blocklist ID.
    pub id: Uuid,
    /// Name of the blocklist.
    pub name: String,
    /// Source URL.
    pub url: String,
    /// Number of domains loaded.
    pub domain_count: usize,
    /// When it was loaded.
    pub loaded_at: DateTime<Utc>,
}

/// Ad-blocker using domain blocklists.
pub struct AdBlocker {
    /// Set of blocked domains (normalized lowercase).
    blocked_domains: RwLock<HashSet<String>>,
    /// Statistics per blocked domain.
    domain_stats: RwLock<HashMap<String, BlockedDomainStats>>,
    /// Whitelist (domains that should never be blocked).
    whitelist: RwLock<HashSet<String>>,
    /// Loaded blocklists.
    loaded_lists: RwLock<Vec<LoadedBlocklist>>,
    /// Total block count.
    total_blocked: AtomicU64,
    /// HTTP client for fetching blocklists.
    http_client: reqwest::Client,
}

impl AdBlocker {
    /// Create a new ad-blocker.
    pub fn new() -> Self {
        Self {
            blocked_domains: RwLock::new(HashSet::new()),
            domain_stats: RwLock::new(HashMap::new()),
            whitelist: RwLock::new(HashSet::new()),
            loaded_lists: RwLock::new(Vec::new()),
            total_blocked: AtomicU64::new(0),
            http_client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .build()
                .unwrap_or_default(),
        }
    }

    /// Check if a domain is blocked.
    pub fn is_blocked(&self, domain: &str) -> bool {
        let normalized = Self::normalize_domain(domain);

        // Check whitelist first
        {
            let whitelist = self.whitelist.read().unwrap_or_else(|e| e.into_inner());
            if whitelist.contains(&normalized) {
                return false;
            }
        }

        // Check blocked domains (including parent domains)
        let domains = self.blocked_domains.read().unwrap_or_else(|e| e.into_inner());

        // Check exact match
        if domains.contains(&normalized) {
            self.record_block(&normalized);
            return true;
        }

        // Check parent domains (e.g., if "ads.example.com" is queried, check "example.com")
        let parts: Vec<&str> = normalized.split('.').collect();
        for i in 1..parts.len().saturating_sub(1) {
            let parent = parts[i..].join(".");
            if domains.contains(&parent) {
                self.record_block(&normalized);
                return true;
            }
        }

        false
    }

    /// Record a blocked domain for statistics.
    fn record_block(&self, domain: &str) {
        self.total_blocked.fetch_add(1, Ordering::Relaxed);

        let mut stats = self.domain_stats.write().unwrap_or_else(|e| e.into_inner());
        if let Some(existing) = stats.get(domain) {
            existing.increment();
        } else {
            stats.insert(domain.to_string(), BlockedDomainStats::new());
        }
    }

    /// Load a blocklist from a URL (hosts file format).
    pub async fn load_from_url(&self, url: &str) -> Result<usize> {
        tracing::info!("Fetching blocklist from: {}", url);

        let response = self.http_client.get(url).send().await.map_err(|e| {
            Error::Internal(format!("Failed to fetch blocklist from {}: {}", url, e))
        })?;

        if !response.status().is_success() {
            return Err(Error::Internal(format!(
                "Failed to fetch blocklist, status: {}",
                response.status()
            )));
        }

        let content = response
            .text()
            .await
            .map_err(|e| Error::Internal(format!("Failed to read blocklist content: {}", e)))?;

        let count = self.parse_hosts_content(&content);

        // Record loaded blocklist
        {
            let mut lists = self.loaded_lists.write().unwrap_or_else(|e| e.into_inner());
            lists.push(LoadedBlocklist {
                id: Uuid::new_v4(),
                name: url.split('/').next_back().unwrap_or("unknown").to_string(),
                url: url.to_string(),
                domain_count: count,
                loaded_at: Utc::now(),
            });
        }

        tracing::info!("Loaded {} domains from blocklist: {}", count, url);
        Ok(count)
    }

    /// Load a blocklist from local file content.
    pub fn load_from_content(&self, content: &str) -> usize {
        self.parse_hosts_content(content)
    }

    /// Parse hosts file format and add domains.
    fn parse_hosts_content(&self, content: &str) -> usize {
        let mut count = 0;
        let mut domains = self.blocked_domains.write().unwrap_or_else(|e| e.into_inner());

        for line in content.lines() {
            // Skip comments and empty lines
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            // Parse hosts file format: "0.0.0.0 domain.com" or "127.0.0.1 domain.com"
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let ip = parts[0];
                // Only process lines with blocking IPs
                if ip == "0.0.0.0" || ip == "127.0.0.1" {
                    let domain = Self::normalize_domain(parts[1]);
                    // Skip localhost entries and local domains
                    if !domain.is_empty()
                        && domain != "localhost"
                        && domain != "localhost.localdomain"
                        && domain != "local"
                        && !domain.ends_with(".local")
                        && !domain.ends_with(".localhost")
                        && domains.insert(domain)
                    {
                        count += 1;
                    }
                }
            }
        }

        count
    }

    /// Add a domain to the blocklist.
    pub fn add_blocked_domain(&self, domain: &str) {
        let normalized = Self::normalize_domain(domain);
        let mut domains = self.blocked_domains.write().unwrap_or_else(|e| e.into_inner());
        domains.insert(normalized);
    }

    /// Remove a domain from the blocklist.
    pub fn remove_blocked_domain(&self, domain: &str) {
        let normalized = Self::normalize_domain(domain);
        let mut domains = self.blocked_domains.write().unwrap_or_else(|e| e.into_inner());
        domains.remove(&normalized);
    }

    /// Add a domain to the whitelist.
    pub fn add_whitelist(&self, domain: &str) {
        let normalized = Self::normalize_domain(domain);
        let mut whitelist = self.whitelist.write().unwrap_or_else(|e| e.into_inner());
        whitelist.insert(normalized);
    }

    /// Remove a domain from the whitelist.
    pub fn remove_whitelist(&self, domain: &str) {
        let normalized = Self::normalize_domain(domain);
        let mut whitelist = self.whitelist.write().unwrap_or_else(|e| e.into_inner());
        whitelist.remove(&normalized);
    }

    /// Get the number of blocked domains.
    pub fn domain_count(&self) -> usize {
        self.blocked_domains.read().unwrap_or_else(|e| e.into_inner()).len()
    }

    /// Get the total number of blocked queries.
    pub fn blocked_count(&self) -> u64 {
        self.total_blocked.load(Ordering::Relaxed)
    }

    /// Get top blocked domains by count.
    pub fn top_blocked(&self, limit: usize) -> Vec<(String, u64)> {
        let stats = self.domain_stats.read().unwrap_or_else(|e| e.into_inner());
        let mut sorted: Vec<(String, u64)> = stats
            .iter()
            .map(|(k, v)| (k.clone(), v.count.load(Ordering::Relaxed)))
            .collect();
        sorted.sort_by(|a, b| b.1.cmp(&a.1));
        sorted.truncate(limit);
        sorted
    }

    /// Get loaded blocklists.
    pub fn loaded_blocklists(&self) -> Vec<LoadedBlocklist> {
        self.loaded_lists.read().unwrap_or_else(|e| e.into_inner()).clone()
    }

    /// Clear all blocked domains.
    pub fn clear(&self) {
        self.blocked_domains.write().unwrap_or_else(|e| e.into_inner()).clear();
        self.domain_stats.write().unwrap_or_else(|e| e.into_inner()).clear();
        self.loaded_lists.write().unwrap_or_else(|e| e.into_inner()).clear();
        self.total_blocked.store(0, Ordering::Relaxed);
    }

    /// Reset statistics only (keep domains).
    pub fn reset_stats(&self) {
        self.domain_stats.write().unwrap_or_else(|e| e.into_inner()).clear();
        self.total_blocked.store(0, Ordering::Relaxed);
    }

    /// Normalize a domain name.
    fn normalize_domain(domain: &str) -> String {
        domain
            .to_lowercase()
            .trim()
            .trim_end_matches('.')
            .to_string()
    }
}

impl Default for AdBlocker {
    fn default() -> Self {
        Self::new()
    }
}

/// Utility for loading blocklists.
pub struct BlocklistLoader {
    http_client: reqwest::Client,
}

impl BlocklistLoader {
    /// Create a new blocklist loader.
    pub fn new() -> Self {
        Self {
            http_client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .unwrap_or_default(),
        }
    }

    /// Fetch blocklist content from URL.
    pub async fn fetch(&self, url: &str) -> Result<String> {
        let response = self
            .http_client
            .get(url)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Failed to fetch {}: {}", url, e)))?;

        if !response.status().is_success() {
            return Err(Error::Internal(format!(
                "HTTP error {}: {}",
                response.status(),
                url
            )));
        }

        response
            .text()
            .await
            .map_err(|e| Error::Internal(format!("Failed to read response: {}", e)))
    }

    /// Get default blocklist URLs.
    pub fn default_blocklists() -> Vec<(&'static str, &'static str)> {
        vec![
            (
                "Steven Black Hosts",
                "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
            ),
            ("AdAway", "https://adaway.org/hosts.txt"),
            (
                "Peter Lowe's Ad and Tracking",
                "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext",
            ),
            (
                "Malware Domain List",
                "https://www.malwaredomainlist.com/hostslist/hosts.txt",
            ),
        ]
    }
}

impl Default for BlocklistLoader {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_hosts_content() {
        let blocker = AdBlocker::new();
        let content = r#"
# Comment line
127.0.0.1 localhost
0.0.0.0 ads.example.com
0.0.0.0 tracking.example.com
127.0.0.1 malware.bad.com
# Another comment
0.0.0.0 duplicate.com
0.0.0.0 duplicate.com
"#;
        let count = blocker.load_from_content(content);
        assert_eq!(count, 4); // ads, tracking, malware, duplicate (only once)
        assert!(blocker.is_blocked("ads.example.com"));
        assert!(blocker.is_blocked("tracking.example.com"));
        assert!(blocker.is_blocked("malware.bad.com"));
        assert!(!blocker.is_blocked("safe.example.com"));
    }

    #[test]
    fn test_whitelist() {
        let blocker = AdBlocker::new();
        blocker.add_blocked_domain("blocked.com");
        blocker.add_whitelist("blocked.com");

        assert!(!blocker.is_blocked("blocked.com"));
    }

    #[test]
    fn test_subdomain_blocking() {
        let blocker = AdBlocker::new();
        blocker.add_blocked_domain("example.com");

        // Subdomain should also be blocked
        assert!(blocker.is_blocked("ads.example.com"));
        assert!(blocker.is_blocked("tracking.ads.example.com"));
    }

    #[test]
    fn test_normalize_domain() {
        assert_eq!(AdBlocker::normalize_domain("EXAMPLE.COM"), "example.com");
        assert_eq!(AdBlocker::normalize_domain("test.local."), "test.local");
        assert_eq!(AdBlocker::normalize_domain("  space.com  "), "space.com");
    }

    #[test]
    fn test_stats() {
        let blocker = AdBlocker::new();
        blocker.add_blocked_domain("test.com");

        // Block same domain multiple times
        assert!(blocker.is_blocked("test.com"));
        assert!(blocker.is_blocked("test.com"));
        assert!(blocker.is_blocked("test.com"));

        assert_eq!(blocker.blocked_count(), 3);

        let top = blocker.top_blocked(10);
        assert_eq!(top.len(), 1);
        assert_eq!(top[0].0, "test.com");
        assert_eq!(top[0].1, 3);
    }
}
