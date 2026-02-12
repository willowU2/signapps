//! Traefik configuration types.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Complete Traefik dynamic configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TraefikConfig {
    pub http: HttpConfig,
}

/// HTTP configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HttpConfig {
    pub routers: HashMap<String, Router>,
    pub services: HashMap<String, Service>,
    pub middlewares: HashMap<String, Middleware>,
}

/// Traefik router configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Router {
    pub rule: String,
    pub service: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub middlewares: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tls: Option<TlsConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<i32>,
    #[serde(rename = "entryPoints")]
    pub entry_points: Vec<String>,
}

/// TLS configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TlsConfig {
    #[serde(rename = "certResolver", skip_serializing_if = "Option::is_none")]
    pub cert_resolver: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domains: Option<Vec<TlsDomain>>,
}

/// TLS domain configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlsDomain {
    pub main: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sans: Option<Vec<String>>,
}

/// Traefik service configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    #[serde(rename = "loadBalancer")]
    pub load_balancer: LoadBalancer,
}

/// Load balancer configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadBalancer {
    pub servers: Vec<Server>,
    #[serde(rename = "passHostHeader", skip_serializing_if = "Option::is_none")]
    pub pass_host_header: Option<bool>,
    #[serde(rename = "healthCheck", skip_serializing_if = "Option::is_none")]
    pub health_check: Option<HealthCheck>,
}

/// Backend server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Server {
    pub url: String,
}

/// Health check configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    pub path: String,
    pub interval: String,
    pub timeout: String,
}

/// Middleware configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Middleware {
    Headers(HeadersMiddleware),
    RateLimit(RateLimitMiddleware),
    BasicAuth(BasicAuthMiddleware),
    StripPrefix(StripPrefixMiddleware),
    RedirectScheme(RedirectSchemeMiddleware),
    Chain(ChainMiddleware),
    IpAllowList(IpAllowListMiddleware),
}

/// Headers middleware.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeadersMiddleware {
    pub headers: HeadersOptions,
}

/// Headers options.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HeadersOptions {
    #[serde(
        rename = "customRequestHeaders",
        skip_serializing_if = "Option::is_none"
    )]
    pub custom_request_headers: Option<HashMap<String, String>>,
    #[serde(
        rename = "customResponseHeaders",
        skip_serializing_if = "Option::is_none"
    )]
    pub custom_response_headers: Option<HashMap<String, String>>,
    #[serde(
        rename = "accessControlAllowOriginList",
        skip_serializing_if = "Option::is_none"
    )]
    pub access_control_allow_origin_list: Option<Vec<String>>,
    #[serde(
        rename = "accessControlAllowMethods",
        skip_serializing_if = "Option::is_none"
    )]
    pub access_control_allow_methods: Option<Vec<String>>,
    #[serde(
        rename = "accessControlAllowHeaders",
        skip_serializing_if = "Option::is_none"
    )]
    pub access_control_allow_headers: Option<Vec<String>>,
    #[serde(rename = "stsSeconds", skip_serializing_if = "Option::is_none")]
    pub sts_seconds: Option<i64>,
    #[serde(
        rename = "stsIncludeSubdomains",
        skip_serializing_if = "Option::is_none"
    )]
    pub sts_include_subdomains: Option<bool>,
    #[serde(rename = "frameDeny", skip_serializing_if = "Option::is_none")]
    pub frame_deny: Option<bool>,
    #[serde(rename = "contentTypeNosniff", skip_serializing_if = "Option::is_none")]
    pub content_type_nosniff: Option<bool>,
    #[serde(rename = "browserXssFilter", skip_serializing_if = "Option::is_none")]
    pub browser_xss_filter: Option<bool>,
}

/// Rate limit middleware.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitMiddleware {
    #[serde(rename = "rateLimit")]
    pub rate_limit: RateLimitOptions,
}

/// Rate limit options.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitOptions {
    pub average: i64,
    pub burst: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub period: Option<String>,
    #[serde(rename = "sourceCriterion", skip_serializing_if = "Option::is_none")]
    pub source_criterion: Option<SourceCriterion>,
}

/// Source criterion for rate limiting.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceCriterion {
    #[serde(rename = "requestHost", skip_serializing_if = "Option::is_none")]
    pub request_host: Option<bool>,
    #[serde(rename = "ipStrategy", skip_serializing_if = "Option::is_none")]
    pub ip_strategy: Option<IpStrategy>,
}

/// IP strategy for rate limiting.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpStrategy {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub depth: Option<i32>,
    #[serde(rename = "excludedIPs", skip_serializing_if = "Option::is_none")]
    pub excluded_ips: Option<Vec<String>>,
}

/// Basic auth middleware.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BasicAuthMiddleware {
    #[serde(rename = "basicAuth")]
    pub basic_auth: BasicAuthOptions,
}

/// Basic auth options.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BasicAuthOptions {
    pub users: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub realm: Option<String>,
    #[serde(rename = "removeHeader", skip_serializing_if = "Option::is_none")]
    pub remove_header: Option<bool>,
}

/// Strip prefix middleware.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StripPrefixMiddleware {
    #[serde(rename = "stripPrefix")]
    pub strip_prefix: StripPrefixOptions,
}

/// Strip prefix options.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StripPrefixOptions {
    pub prefixes: Vec<String>,
}

/// Redirect scheme middleware.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedirectSchemeMiddleware {
    #[serde(rename = "redirectScheme")]
    pub redirect_scheme: RedirectSchemeOptions,
}

/// Redirect scheme options.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedirectSchemeOptions {
    pub scheme: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permanent: Option<bool>,
}

/// Chain middleware.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainMiddleware {
    pub chain: ChainOptions,
}

/// Chain options.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainOptions {
    pub middlewares: Vec<String>,
}

/// IP allow list middleware.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpAllowListMiddleware {
    #[serde(rename = "ipAllowList")]
    pub ip_allow_list: IpAllowListOptions,
}

/// IP allow list options.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpAllowListOptions {
    #[serde(rename = "sourceRange")]
    pub source_range: Vec<String>,
}
