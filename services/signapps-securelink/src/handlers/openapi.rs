//! OpenAPI documentation for the SecureLink service.

use utoipa::OpenApi;

use crate::handlers::{
    dns::{
        AddDnsRecordRequest, CreateBlocklistRequest, DeleteDnsRecordRequest, DnsQueryRequest,
        DnsQueryResponse, FlushCacheResponse, RefreshBlocklistResponse, ResetStatsResponse,
        UpdateBlocklistRequest, UpdateDnsConfigRequest,
    },
    relays::{ConnectResponse, DisconnectResponse, RelayStats, RelayTestResponse},
    tunnels::{
        BulkActionResponse, BulkTunnelAction, DashboardStatsResponse, QuickConnectRequest,
        ReconnectResponse, TunnelStatusResponse,
    },
    DnsHealth, HealthResponse, TunnelHealth,
};
use crate::tunnel::types::{
    BlockedDomainStat, CreateRelay, CreateTunnel, DnsBlocklist, DnsRecord, DnsServiceConfig,
    DnsStats, Relay, RelayStatus, RelayTestResult, Tunnel, TunnelStatus, UpdateRelay, UpdateTunnel,
};
use crate::TrafficPoint;

/// OpenAPI specification for the SecureLink service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps SecureLink",
        version = "1.0.0",
        description = "Web tunnels, DNS, VPN and relay management for SignApps Platform."
    ),
    servers(
        (url = "http://localhost:3006", description = "Local development server"),
    ),
    paths(
        // Health
        crate::handlers::health_check_standalone,
        // Tunnels
        crate::handlers::tunnels::list_tunnels,
        crate::handlers::tunnels::get_tunnel,
        crate::handlers::tunnels::create_tunnel,
        crate::handlers::tunnels::update_tunnel,
        crate::handlers::tunnels::delete_tunnel,
        crate::handlers::tunnels::get_tunnel_status,
        crate::handlers::tunnels::reconnect_tunnel,
        crate::handlers::tunnels::bulk_tunnel_action,
        crate::handlers::tunnels::quick_connect,
        crate::handlers::tunnels::dashboard_stats,
        crate::handlers::tunnels::dashboard_traffic,
        // Relays
        crate::handlers::relays::list_relays,
        crate::handlers::relays::get_relay,
        crate::handlers::relays::create_relay,
        crate::handlers::relays::update_relay,
        crate::handlers::relays::delete_relay,
        crate::handlers::relays::test_relay,
        crate::handlers::relays::connect_relay,
        crate::handlers::relays::disconnect_relay,
        crate::handlers::relays::get_relay_stats,
        // DNS
        crate::handlers::dns::get_dns_config,
        crate::handlers::dns::update_dns_config,
        crate::handlers::dns::list_blocklists,
        crate::handlers::dns::get_blocklist,
        crate::handlers::dns::add_blocklist,
        crate::handlers::dns::update_blocklist,
        crate::handlers::dns::delete_blocklist,
        crate::handlers::dns::refresh_blocklist,
        crate::handlers::dns::get_dns_stats,
        crate::handlers::dns::reset_dns_stats,
        crate::handlers::dns::list_dns_records,
        crate::handlers::dns::add_dns_record,
        crate::handlers::dns::delete_dns_record,
        crate::handlers::dns::query_dns,
        crate::handlers::dns::flush_dns_cache,
    ),
    components(schemas(
        // Health
        HealthResponse,
        TunnelHealth,
        DnsHealth,
        // Tunnel types
        Tunnel,
        TunnelStatus,
        CreateTunnel,
        UpdateTunnel,
        TunnelStatusResponse,
        ReconnectResponse,
        BulkTunnelAction,
        BulkActionResponse,
        QuickConnectRequest,
        DashboardStatsResponse,
        TrafficPoint,
        // Relay types
        Relay,
        RelayStatus,
        CreateRelay,
        UpdateRelay,
        RelayTestResult,
        RelayTestResponse,
        ConnectResponse,
        DisconnectResponse,
        RelayStats,
        // DNS types
        DnsServiceConfig,
        DnsRecord,
        DnsBlocklist,
        DnsStats,
        BlockedDomainStat,
        UpdateDnsConfigRequest,
        CreateBlocklistRequest,
        UpdateBlocklistRequest,
        RefreshBlocklistResponse,
        ResetStatsResponse,
        AddDnsRecordRequest,
        DeleteDnsRecordRequest,
        DnsQueryRequest,
        DnsQueryResponse,
        FlushCacheResponse,
    )),
    tags(
        (name = "Health", description = "Service health checks"),
        (name = "Tunnels", description = "Web tunnel management — expose local services without opening ports"),
        (name = "Relays", description = "Relay server management — public entry points for tunneled connections"),
        (name = "DNS", description = "DNS resolver and ad-blocking management"),
        (name = "Dashboard", description = "Dashboard statistics and traffic history"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct SecurelinkApiDoc;

/// Adds Bearer JWT security scheme to the OpenAPI spec.
struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
            components.add_security_scheme(
                "bearer",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}
