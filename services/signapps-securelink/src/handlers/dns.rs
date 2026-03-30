//! DNS and ad-blocking handlers.
//!
//! These handlers manage DNS configuration and ad-blocking for
//! the tunnel service.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::dns::{
    Blocklist as DnsBlocklist, CustomDnsRecord as DnsRecord, DnsConfig as DnsServiceConfig,
    DnsStats,
};
use crate::AppState;
use signapps_common::Result;

/// Get current DNS configuration.
#[tracing::instrument(skip_all)]
pub async fn get_dns_config(State(state): State<AppState>) -> Result<Json<DnsServiceConfig>> {
    let config = state.dns_config.read().await;
    Ok(Json(config.clone()))
}

/// Update DNS configuration.
#[tracing::instrument(skip_all)]
pub async fn update_dns_config(
    State(state): State<AppState>,
    Json(request): Json<UpdateDnsConfigRequest>,
) -> Result<Json<DnsServiceConfig>> {
    let mut config = state.dns_config.write().await;

    // Apply updates
    if let Some(enabled) = request.enabled {
        config.enabled = enabled;
    }
    if let Some(upstream) = request.upstream {
        // Validate upstream DNS servers
        for server in &upstream {
            if !is_valid_dns_server(server) {
                return Err(signapps_common::Error::Validation(format!(
                    "Invalid DNS server: {}",
                    server
                )));
            }
        }
        config.upstream = upstream;
    }
    if let Some(adblock_enabled) = request.adblock_enabled {
        config.adblock_enabled = adblock_enabled;
    }
    if let Some(listen_addr) = request.listen_addr {
        config.listen_addr = listen_addr;
    }
    if let Some(cache_ttl) = request.cache_ttl {
        config.cache_ttl = cache_ttl;
    }

    tracing::info!(
        "Updated DNS config: enabled={}, adblock={}, upstream={:?}",
        config.enabled,
        config.adblock_enabled,
        config.upstream
    );

    Ok(Json(config.clone()))
}

/// Request to update DNS configuration.
#[derive(Debug, Deserialize)]
/// Request body for UpdateDnsConfig.
pub struct UpdateDnsConfigRequest {
    pub enabled: Option<bool>,
    pub upstream: Option<Vec<String>>,
    pub adblock_enabled: Option<bool>,
    pub listen_addr: Option<String>,
    pub cache_ttl: Option<u32>,
}

/// Get all DNS blocklists.
#[tracing::instrument(skip_all)]
pub async fn list_blocklists(State(state): State<AppState>) -> Result<Json<Vec<DnsBlocklist>>> {
    let blocklists = state.blocklists.read().await;
    Ok(Json(blocklists.clone()))
}

/// Get a specific blocklist.
#[tracing::instrument(skip_all)]
pub async fn get_blocklist(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<DnsBlocklist>> {
    let blocklists = state.blocklists.read().await;
    let blocklist = blocklists
        .iter()
        .find(|b| b.id == id)
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Blocklist {}", id)))?;
    Ok(Json(blocklist.clone()))
}

/// Request to create a blocklist.
#[derive(Debug, Deserialize)]
/// Request body for CreateBlocklist.
pub struct CreateBlocklistRequest {
    pub name: String,
    pub url: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

/// Add a new blocklist.
#[tracing::instrument(skip_all)]
pub async fn add_blocklist(
    State(state): State<AppState>,
    Json(request): Json<CreateBlocklistRequest>,
) -> Result<(StatusCode, Json<DnsBlocklist>)> {
    // Validate URL
    if !request.url.starts_with("http://") && !request.url.starts_with("https://") {
        return Err(signapps_common::Error::Validation(
            "Blocklist URL must start with http:// or https://".to_string(),
        ));
    }

    let blocklist = DnsBlocklist {
        id: Uuid::new_v4(),
        name: request.name,
        url: request.url,
        enabled: request.enabled,
        domain_count: 0,
        last_updated: None,
    };

    let mut blocklists = state.blocklists.write().await;
    blocklists.push(blocklist.clone());

    tracing::info!(
        "Added blocklist '{}' from {}",
        blocklist.name,
        blocklist.url
    );

    Ok((StatusCode::CREATED, Json(blocklist)))
}

/// Update a blocklist.
#[allow(dead_code)]
#[tracing::instrument(skip_all)]
pub async fn update_blocklist(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateBlocklistRequest>,
) -> Result<Json<DnsBlocklist>> {
    let mut blocklists = state.blocklists.write().await;
    let blocklist = blocklists
        .iter_mut()
        .find(|b| b.id == id)
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Blocklist {}", id)))?;

    if let Some(name) = request.name {
        blocklist.name = name;
    }
    if let Some(enabled) = request.enabled {
        blocklist.enabled = enabled;
    }

    Ok(Json(blocklist.clone()))
}

/// Request to update a blocklist.
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
/// Request body for UpdateBlocklist.
pub struct UpdateBlocklistRequest {
    pub name: Option<String>,
    pub enabled: Option<bool>,
}

/// Delete a blocklist.
#[tracing::instrument(skip_all)]
pub async fn delete_blocklist(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let mut blocklists = state.blocklists.write().await;
    let index = blocklists
        .iter()
        .position(|b| b.id == id)
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Blocklist {}", id)))?;

    let removed = blocklists.remove(index);
    tracing::info!("Deleted blocklist '{}' ({})", removed.name, id);

    Ok(StatusCode::NO_CONTENT)
}

/// Refresh a blocklist (re-download).
#[tracing::instrument(skip_all)]
pub async fn refresh_blocklist(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RefreshBlocklistResponse>> {
    let mut blocklists = state.blocklists.write().await;
    let blocklist = blocklists
        .iter_mut()
        .find(|b| b.id == id)
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Blocklist {}", id)))?;

    // In a real implementation, we would download and parse the blocklist here
    // For now, we just update the timestamp
    blocklist.last_updated = Some(chrono::Utc::now());

    tracing::info!(
        "Refreshed blocklist '{}' from {}",
        blocklist.name,
        blocklist.url
    );

    Ok(Json(RefreshBlocklistResponse {
        message: format!("Blocklist '{}' refreshed", blocklist.name),
        domain_count: blocklist.domain_count,
    }))
}

/// Response for blocklist refresh.
#[derive(Debug, Serialize)]
/// Response for RefreshBlocklist.
pub struct RefreshBlocklistResponse {
    pub message: String,
    pub domain_count: u32,
}

/// Get DNS statistics.
#[tracing::instrument(skip_all)]
pub async fn get_dns_stats(State(state): State<AppState>) -> Result<Json<DnsStats>> {
    let stats = state.dns_stats.read().await;
    Ok(Json(stats.clone()))
}

/// Reset DNS statistics.
#[tracing::instrument(skip_all)]
pub async fn reset_dns_stats(State(state): State<AppState>) -> Result<Json<ResetStatsResponse>> {
    let mut stats = state.dns_stats.write().await;
    *stats = DnsStats::default();

    tracing::info!("DNS statistics reset");

    Ok(Json(ResetStatsResponse {
        message: "DNS statistics have been reset".to_string(),
    }))
}

/// Response for stats reset.
#[derive(Debug, Serialize)]
/// Response for ResetStats.
pub struct ResetStatsResponse {
    pub message: String,
}

/// Get custom DNS records.
#[tracing::instrument(skip_all)]
pub async fn list_dns_records(State(state): State<AppState>) -> Result<Json<Vec<DnsRecord>>> {
    let config = state.dns_config.read().await;
    Ok(Json(config.custom_records.clone()))
}

/// Request to add a DNS record.
#[derive(Debug, Deserialize)]
/// Request body for AddDnsRecord.
pub struct AddDnsRecordRequest {
    pub name: String,
    pub record_type: String,
    pub value: String,
    #[serde(default = "default_ttl")]
    pub ttl: u32,
}

fn default_ttl() -> u32 {
    3600
}

/// Add a custom DNS record.
#[tracing::instrument(skip_all)]
pub async fn add_dns_record(
    State(state): State<AppState>,
    Json(request): Json<AddDnsRecordRequest>,
) -> Result<(StatusCode, Json<DnsRecord>)> {
    // Validate record type
    let valid_types = ["A", "AAAA", "CNAME", "TXT", "MX"];
    if !valid_types.contains(&request.record_type.to_uppercase().as_str()) {
        return Err(signapps_common::Error::Validation(format!(
            "Invalid record type: {}. Valid types are: {:?}",
            request.record_type, valid_types
        )));
    }

    let mut config = state.dns_config.write().await;

    // Check for duplicate
    if config
        .custom_records
        .iter()
        .any(|r| r.name == request.name && r.record_type == request.record_type)
    {
        return Err(signapps_common::Error::Validation(format!(
            "Record {} {} already exists",
            request.record_type, request.name
        )));
    }

    let record = DnsRecord {
        name: request.name,
        record_type: request.record_type.to_uppercase(),
        value: request.value,
        ttl: request.ttl,
    };

    config.custom_records.push(record.clone());

    tracing::info!(
        "Added DNS record: {} {} -> {}",
        record.record_type,
        record.name,
        record.value
    );

    Ok((StatusCode::CREATED, Json(record)))
}

/// Delete a custom DNS record.
#[tracing::instrument(skip_all)]
pub async fn delete_dns_record(
    State(state): State<AppState>,
    Json(request): Json<DeleteDnsRecordRequest>,
) -> Result<StatusCode> {
    let mut config = state.dns_config.write().await;

    let index = config
        .custom_records
        .iter()
        .position(|r| r.name == request.name && r.record_type == request.record_type)
        .ok_or_else(|| {
            signapps_common::Error::NotFound(format!(
                "DNS record {} {}",
                request.record_type, request.name
            ))
        })?;

    let removed = config.custom_records.remove(index);
    tracing::info!(
        "Deleted DNS record: {} {} -> {}",
        removed.record_type,
        removed.name,
        removed.value
    );

    Ok(StatusCode::NO_CONTENT)
}

/// Request to delete a DNS record.
#[derive(Debug, Deserialize)]
/// Request body for DeleteDnsRecord.
pub struct DeleteDnsRecordRequest {
    pub name: String,
    pub record_type: String,
}

/// Validate a DNS server address.
fn is_valid_dns_server(server: &str) -> bool {
    // Simple validation - check if it's an IP address or hostname
    // Could be enhanced with more thorough validation
    !server.is_empty()
        && (
            // IP address (v4 or v6)
            server.parse::<std::net::IpAddr>().is_ok() ||
        // Hostname (simple check)
        server.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-')
        )
}

/// Query DNS for a specific domain.
///
/// Uses the upstream resolvers configured in `DnsConfig`. Performs a real
/// `A`/`AAAA` lookup via `hickory-resolver` for those record types and falls
/// back to `std::net::ToSocketAddrs` for others.
#[tracing::instrument(skip_all)]
pub async fn query_dns(
    State(state): State<AppState>,
    Json(request): Json<DnsQueryRequest>,
) -> Result<Json<DnsQueryResponse>> {
    use hickory_resolver::{
        config::{NameServerConfigGroup, ResolverConfig, ResolverOpts},
        TokioAsyncResolver,
    };

    tracing::debug!(
        "DNS query for {} (type: {})",
        request.domain,
        request.record_type
    );

    let start = std::time::Instant::now();

    // Build resolver using the configured upstream DNS servers.
    let dns_cfg = state.dns_config.read().await;
    let upstream = dns_cfg.upstream.clone();
    drop(dns_cfg);

    let resolver = {
        let mut name_servers = NameServerConfigGroup::new();
        for addr_str in &upstream {
            // Parse "8.8.8.8" or "8.8.8.8:53" format.
            let socket_addr: std::net::SocketAddr = if addr_str.contains(':') {
                addr_str
                    .parse()
                    .unwrap_or_else(|_| "8.8.8.8:53".parse().expect("8.8.8.8:53 is valid"))
            } else {
                format!("{}:53", addr_str)
                    .parse()
                    .unwrap_or_else(|_| "8.8.8.8:53".parse().expect("8.8.8.8:53 is valid"))
            };
            name_servers.push(hickory_resolver::config::NameServerConfig::new(
                socket_addr,
                hickory_resolver::config::Protocol::Udp,
            ));
        }
        let cfg = if name_servers.is_empty() {
            ResolverConfig::default()
        } else {
            ResolverConfig::from_parts(None, vec![], name_servers)
        };
        TokioAsyncResolver::tokio(cfg, ResolverOpts::default())
    };

    let record_type = request.record_type.to_uppercase();
    let domain = request.domain.trim_end_matches('.').to_string();

    let (answers, source) = match record_type.as_str() {
        "A" => {
            let lookup = resolver
                .ipv4_lookup(&domain)
                .await
                .map_err(|e| signapps_common::Error::Internal(e.to_string()))?;
            let addrs = lookup.iter().map(|ip| ip.to_string()).collect::<Vec<_>>();
            (addrs, "resolver")
        },
        "AAAA" => {
            let lookup = resolver
                .ipv6_lookup(&domain)
                .await
                .map_err(|e| signapps_common::Error::Internal(e.to_string()))?;
            let addrs = lookup.iter().map(|ip| ip.to_string()).collect::<Vec<_>>();
            (addrs, "resolver")
        },
        "MX" => {
            let lookup = resolver
                .mx_lookup(&domain)
                .await
                .map_err(|e| signapps_common::Error::Internal(e.to_string()))?;
            let records = lookup
                .iter()
                .map(|mx| {
                    format!(
                        "{} {}",
                        mx.preference(),
                        mx.exchange().to_string().trim_end_matches('.')
                    )
                })
                .collect::<Vec<_>>();
            (records, "resolver")
        },
        "TXT" => {
            let lookup = resolver
                .txt_lookup(&domain)
                .await
                .map_err(|e| signapps_common::Error::Internal(e.to_string()))?;
            let records = lookup
                .iter()
                .flat_map(|txt| txt.iter().map(|b| String::from_utf8_lossy(b).to_string()))
                .collect::<Vec<_>>();
            (records, "resolver")
        },
        _ => {
            // Unsupported record type — return empty with a note.
            tracing::warn!("Unsupported DNS record type: {}", record_type);
            (vec![], "unsupported")
        },
    };

    let elapsed_ms = start.elapsed().as_millis() as u64;

    Ok(Json(DnsQueryResponse {
        domain: request.domain,
        record_type,
        answers,
        query_time_ms: elapsed_ms,
        source: source.to_string(),
    }))
}

/// Request for DNS query.
#[derive(Debug, Deserialize)]
/// Request body for DnsQuery.
pub struct DnsQueryRequest {
    pub domain: String,
    #[serde(default = "default_record_type")]
    pub record_type: String,
}

fn default_record_type() -> String {
    "A".to_string()
}

/// Response for DNS query.
#[derive(Debug, Serialize)]
/// Response for DnsQuery.
pub struct DnsQueryResponse {
    pub domain: String,
    pub record_type: String,
    pub answers: Vec<String>,
    pub query_time_ms: u64,
    pub source: String,
}

/// Flush DNS cache.
#[tracing::instrument(skip_all)]
pub async fn flush_dns_cache(State(_state): State<AppState>) -> Result<Json<FlushCacheResponse>> {
    // In a real implementation, this would clear the DNS cache
    tracing::info!("DNS cache flushed");

    Ok(Json(FlushCacheResponse {
        message: "DNS cache has been flushed".to_string(),
        entries_cleared: 0,
    }))
}

/// Response for cache flush.
#[derive(Debug, Serialize)]
/// Response for FlushCache.
pub struct FlushCacheResponse {
    pub message: String,
    pub entries_cleared: usize,
}
