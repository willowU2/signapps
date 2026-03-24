#![allow(dead_code)]
//! DNS resolver with upstream forwarding and caching.
//!
//! Provides DNS resolution by forwarding queries to upstream servers
//! with a local cache for improved performance.

use chrono::{DateTime, Utc};
use hickory_resolver::config::{NameServerConfig, Protocol, ResolverConfig, ResolverOpts};
use hickory_resolver::TokioAsyncResolver;
use signapps_common::{Error, Result};
use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::sync::RwLock;
use std::time::Duration;

/// Cached DNS record with TTL.
#[derive(Debug, Clone)]
pub struct CachedRecord {
    /// Record type (A, AAAA, CNAME, TXT).
    pub record_type: String,
    /// Resolved addresses or values.
    pub values: Vec<String>,
    /// Time when the cache entry was created.
    pub created_at: DateTime<Utc>,
    /// TTL in seconds.
    pub ttl: u32,
}

impl CachedRecord {
    /// Check if the cache entry has expired.
    pub fn is_expired(&self) -> bool {
        let now = Utc::now();
        let expiry = self.created_at + chrono::Duration::seconds(self.ttl as i64);
        now > expiry
    }

    /// Get remaining TTL in seconds.
    pub fn remaining_ttl(&self) -> u32 {
        let now = Utc::now();
        let expiry = self.created_at + chrono::Duration::seconds(self.ttl as i64);
        let remaining = expiry - now;
        if remaining.num_seconds() > 0 {
            remaining.num_seconds() as u32
        } else {
            0
        }
    }
}

/// Custom DNS record for local resolution.
#[derive(Debug, Clone)]
pub struct CustomRecord {
    pub record_type: String,
    pub value: String,
    pub ttl: u32,
}

/// DNS resolver result.
#[derive(Debug, Clone)]
pub struct ResolveResult {
    /// Query name.
    pub name: String,
    /// Record type.
    pub record_type: String,
    /// Resolved values (IP addresses, CNAMEs, etc.).
    pub values: Vec<String>,
    /// TTL in seconds.
    pub ttl: u32,
    /// Whether this result came from cache.
    pub from_cache: bool,
}

/// DNS resolver with upstream forwarding and caching.
pub struct DnsResolver {
    /// Hickory DNS resolver.
    resolver: TokioAsyncResolver,
    /// DNS cache (domain -> CachedRecord).
    cache: RwLock<HashMap<String, CachedRecord>>,
    /// Custom local DNS records (domain -> record).
    custom_records: RwLock<HashMap<String, CustomRecord>>,
    /// Default cache TTL.
    default_ttl: u32,
    /// Whether DoH is enabled.
    doh_enabled: bool,
    /// DoH URL for HTTPS resolution.
    doh_url: Option<String>,
    /// HTTP client for DoH queries.
    http_client: reqwest::Client,
}

impl DnsResolver {
    /// Create a new DNS resolver with specified upstream servers.
    pub fn new(
        upstream_servers: Vec<String>,
        default_ttl: u32,
        doh_enabled: bool,
        doh_url: Option<String>,
    ) -> Result<Self> {
        let mut config = ResolverConfig::new();

        for server in upstream_servers {
            let addr: SocketAddr = server
                .parse()
                .or_else(|_| format!("{}:53", server).parse())
                .map_err(|e| {
                    Error::Internal(format!("Invalid upstream server '{}': {}", server, e))
                })?;

            config.add_name_server(NameServerConfig {
                socket_addr: addr,
                protocol: Protocol::Udp,
                tls_dns_name: None,
                trust_negative_responses: true,
                bind_addr: None,
            });
        }

        let mut opts = ResolverOpts::default();
        opts.timeout = Duration::from_secs(5);
        opts.attempts = 2;
        opts.cache_size = 1024;
        opts.use_hosts_file = false;

        let resolver = TokioAsyncResolver::tokio(config, opts);

        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|e| Error::Internal(format!("Failed to create HTTP client: {}", e)))?;

        Ok(Self {
            resolver,
            cache: RwLock::new(HashMap::new()),
            custom_records: RwLock::new(HashMap::new()),
            default_ttl,
            doh_enabled,
            doh_url,
            http_client,
        })
    }

    /// Add a custom DNS record for local resolution.
    pub fn add_custom_record(&self, name: &str, record_type: &str, value: &str, ttl: u32) {
        let normalized_name = Self::normalize_domain(name);
        let mut records = self
            .custom_records
            .write()
            .unwrap_or_else(|e| e.into_inner());
        records.insert(
            format!("{}:{}", normalized_name, record_type.to_uppercase()),
            CustomRecord {
                record_type: record_type.to_uppercase(),
                value: value.to_string(),
                ttl,
            },
        );
        tracing::debug!(
            "Added custom DNS record: {} {} -> {}",
            record_type,
            name,
            value
        );
    }

    /// Remove a custom DNS record.
    pub fn remove_custom_record(&self, name: &str, record_type: &str) {
        let normalized_name = Self::normalize_domain(name);
        let mut records = self
            .custom_records
            .write()
            .unwrap_or_else(|e| e.into_inner());
        records.remove(&format!(
            "{}:{}",
            normalized_name,
            record_type.to_uppercase()
        ));
    }

    /// Resolve a DNS query.
    pub async fn resolve(&self, name: &str, record_type: &str) -> Result<ResolveResult> {
        let normalized_name = Self::normalize_domain(name);
        let record_type_upper = record_type.to_uppercase();
        let cache_key = format!("{}:{}", normalized_name, record_type_upper);

        // Check custom records first
        {
            let custom = self
                .custom_records
                .read()
                .unwrap_or_else(|e| e.into_inner());
            if let Some(record) = custom.get(&cache_key) {
                return Ok(ResolveResult {
                    name: normalized_name,
                    record_type: record.record_type.clone(),
                    values: vec![record.value.clone()],
                    ttl: record.ttl,
                    from_cache: false,
                });
            }
        }

        // Check cache
        {
            let cache = self.cache.read().unwrap_or_else(|e| e.into_inner());
            if let Some(cached) = cache.get(&cache_key) {
                if !cached.is_expired() {
                    return Ok(ResolveResult {
                        name: normalized_name,
                        record_type: cached.record_type.clone(),
                        values: cached.values.clone(),
                        ttl: cached.remaining_ttl(),
                        from_cache: true,
                    });
                }
            }
        }

        // Resolve from upstream
        let result = if self.doh_enabled && self.doh_url.is_some() {
            self.resolve_doh(&normalized_name, &record_type_upper)
                .await?
        } else {
            self.resolve_upstream(&normalized_name, &record_type_upper)
                .await?
        };

        // Cache the result
        {
            let mut cache = self.cache.write().unwrap_or_else(|e| e.into_inner());
            cache.insert(
                cache_key,
                CachedRecord {
                    record_type: result.record_type.clone(),
                    values: result.values.clone(),
                    created_at: Utc::now(),
                    ttl: result.ttl,
                },
            );
        }

        Ok(result)
    }

    /// Resolve using standard UDP/TCP upstream.
    async fn resolve_upstream(&self, name: &str, record_type: &str) -> Result<ResolveResult> {
        match record_type {
            "A" => {
                let lookup = self.resolver.ipv4_lookup(name).await.map_err(|e| {
                    Error::Internal(format!("DNS lookup failed for {}: {}", name, e))
                })?;

                let values: Vec<String> = lookup.iter().map(|ip| ip.to_string()).collect();
                let ttl = lookup
                    .as_lookup()
                    .record_iter()
                    .next()
                    .map(|r| r.ttl())
                    .unwrap_or(self.default_ttl);

                Ok(ResolveResult {
                    name: name.to_string(),
                    record_type: "A".to_string(),
                    values,
                    ttl,
                    from_cache: false,
                })
            },
            "AAAA" => {
                let lookup = self.resolver.ipv6_lookup(name).await.map_err(|e| {
                    Error::Internal(format!("DNS lookup failed for {}: {}", name, e))
                })?;

                let values: Vec<String> = lookup.iter().map(|ip| ip.to_string()).collect();
                let ttl = lookup
                    .as_lookup()
                    .record_iter()
                    .next()
                    .map(|r| r.ttl())
                    .unwrap_or(self.default_ttl);

                Ok(ResolveResult {
                    name: name.to_string(),
                    record_type: "AAAA".to_string(),
                    values,
                    ttl,
                    from_cache: false,
                })
            },
            "TXT" => {
                let lookup = self.resolver.txt_lookup(name).await.map_err(|e| {
                    Error::Internal(format!("TXT lookup failed for {}: {}", name, e))
                })?;

                let values: Vec<String> = lookup
                    .iter()
                    .flat_map(|txt| {
                        txt.iter()
                            .map(|data| String::from_utf8_lossy(data).to_string())
                    })
                    .collect();
                let ttl = lookup
                    .as_lookup()
                    .record_iter()
                    .next()
                    .map(|r| r.ttl())
                    .unwrap_or(self.default_ttl);

                Ok(ResolveResult {
                    name: name.to_string(),
                    record_type: "TXT".to_string(),
                    values,
                    ttl,
                    from_cache: false,
                })
            },
            "MX" => {
                let lookup = self.resolver.mx_lookup(name).await.map_err(|e| {
                    Error::Internal(format!("MX lookup failed for {}: {}", name, e))
                })?;

                let values: Vec<String> = lookup
                    .iter()
                    .map(|mx| format!("{} {}", mx.preference(), mx.exchange()))
                    .collect();
                let ttl = lookup
                    .as_lookup()
                    .record_iter()
                    .next()
                    .map(|r| r.ttl())
                    .unwrap_or(self.default_ttl);

                Ok(ResolveResult {
                    name: name.to_string(),
                    record_type: "MX".to_string(),
                    values,
                    ttl,
                    from_cache: false,
                })
            },
            _ => {
                // For other record types, try generic lookup
                let lookup = self
                    .resolver
                    .lookup(name, hickory_resolver::proto::rr::RecordType::A)
                    .await
                    .map_err(|e| {
                        Error::Internal(format!(
                            "DNS lookup failed for {} ({}): {}",
                            name, record_type, e
                        ))
                    })?;

                let values: Vec<String> = lookup
                    .record_iter()
                    .filter_map(|r| r.data().map(|d| d.to_string()))
                    .collect();
                let ttl = lookup
                    .record_iter()
                    .next()
                    .map(|r| r.ttl())
                    .unwrap_or(self.default_ttl);

                Ok(ResolveResult {
                    name: name.to_string(),
                    record_type: record_type.to_string(),
                    values,
                    ttl,
                    from_cache: false,
                })
            },
        }
    }

    /// Resolve using DNS-over-HTTPS.
    async fn resolve_doh(&self, name: &str, record_type: &str) -> Result<ResolveResult> {
        let doh_url = self
            .doh_url
            .as_ref()
            .ok_or_else(|| Error::Internal("DoH URL not configured".to_string()))?;

        // Use JSON format for DoH (simpler to parse)
        let url = format!(
            "{}?name={}&type={}",
            doh_url.trim_end_matches('/'),
            name,
            record_type
        );

        let response = self
            .http_client
            .get(&url)
            .header("Accept", "application/dns-json")
            .send()
            .await
            .map_err(|e| Error::Internal(format!("DoH request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(Error::Internal(format!(
                "DoH request failed with status: {}",
                response.status()
            )));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse DoH response: {}", e)))?;

        // Parse Quad9/Cloudflare DNS JSON format
        let answers = json["Answer"]
            .as_array()
            .ok_or_else(|| Error::Internal("No answers in DoH response".to_string()))?;

        let mut values = Vec::new();
        let mut ttl = self.default_ttl;

        for answer in answers {
            if let Some(data) = answer["data"].as_str() {
                values.push(data.to_string());
            }
            if let Some(answer_ttl) = answer["TTL"].as_u64() {
                ttl = answer_ttl as u32;
            }
        }

        Ok(ResolveResult {
            name: name.to_string(),
            record_type: record_type.to_string(),
            values,
            ttl,
            from_cache: false,
        })
    }

    /// Resolve A record (IPv4).
    pub async fn resolve_a(&self, name: &str) -> Result<Vec<Ipv4Addr>> {
        let result = self.resolve(name, "A").await?;
        let addrs: Vec<Ipv4Addr> = result
            .values
            .iter()
            .filter_map(|v| v.parse().ok())
            .collect();
        Ok(addrs)
    }

    /// Resolve AAAA record (IPv6).
    pub async fn resolve_aaaa(&self, name: &str) -> Result<Vec<Ipv6Addr>> {
        let result = self.resolve(name, "AAAA").await?;
        let addrs: Vec<Ipv6Addr> = result
            .values
            .iter()
            .filter_map(|v| v.parse().ok())
            .collect();
        Ok(addrs)
    }

    /// Resolve any IP (A or AAAA).
    pub async fn resolve_ip(&self, name: &str) -> Result<Vec<IpAddr>> {
        // Try A first, then AAAA
        let mut addrs = Vec::new();

        if let Ok(ipv4) = self.resolve_a(name).await {
            addrs.extend(ipv4.into_iter().map(IpAddr::V4));
        }

        if let Ok(ipv6) = self.resolve_aaaa(name).await {
            addrs.extend(ipv6.into_iter().map(IpAddr::V6));
        }

        if addrs.is_empty() {
            return Err(Error::Internal(format!(
                "No IP addresses found for {}",
                name
            )));
        }

        Ok(addrs)
    }

    /// Clear the DNS cache.
    pub fn clear_cache(&self) {
        let mut cache = self.cache.write().unwrap_or_else(|e| e.into_inner());
        cache.clear();
        tracing::info!("DNS cache cleared");
    }

    /// Remove expired entries from cache.
    pub fn cleanup_cache(&self) {
        let mut cache = self.cache.write().unwrap_or_else(|e| e.into_inner());
        let before = cache.len();
        cache.retain(|_, v| !v.is_expired());
        let removed = before - cache.len();
        if removed > 0 {
            tracing::debug!("Cleaned up {} expired DNS cache entries", removed);
        }
    }

    /// Get cache statistics.
    pub fn cache_stats(&self) -> (usize, usize) {
        let cache = self.cache.read().unwrap_or_else(|e| e.into_inner());
        let total = cache.len();
        let expired = cache.values().filter(|v| v.is_expired()).count();
        (total, total - expired)
    }

    /// Normalize a domain name (lowercase, remove trailing dot).
    fn normalize_domain(name: &str) -> String {
        name.to_lowercase().trim_end_matches('.').to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_domain() {
        assert_eq!(DnsResolver::normalize_domain("Example.COM"), "example.com");
        assert_eq!(DnsResolver::normalize_domain("test.local."), "test.local");
    }

    #[test]
    fn test_cached_record_expiry() {
        let record = CachedRecord {
            record_type: "A".to_string(),
            values: vec!["1.2.3.4".to_string()],
            created_at: Utc::now() - chrono::Duration::seconds(400),
            ttl: 300,
        };
        assert!(record.is_expired());
        assert_eq!(record.remaining_ttl(), 0);

        let fresh_record = CachedRecord {
            record_type: "A".to_string(),
            values: vec!["1.2.3.4".to_string()],
            created_at: Utc::now(),
            ttl: 300,
        };
        assert!(!fresh_record.is_expired());
        assert!(fresh_record.remaining_ttl() > 0);
    }
}
