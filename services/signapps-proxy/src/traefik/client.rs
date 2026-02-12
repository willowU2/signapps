//! Traefik client for dynamic configuration.

use reqwest::Client;
use signapps_common::{Error, Result};
use signapps_db::models::{HeadersConfig, Route};
use std::collections::HashMap;

use super::config::*;

/// Client for managing Traefik configuration.
#[derive(Clone)]
pub struct TraefikClient {
    client: Client,
    api_url: String,
    cert_resolver: String,
}

impl TraefikClient {
    /// Create a new Traefik client.
    pub fn new(api_url: &str) -> Self {
        Self {
            client: Client::new(),
            api_url: api_url.trim_end_matches('/').to_string(),
            cert_resolver: "letsencrypt".to_string(),
        }
    }

    /// Create with custom cert resolver.
    pub fn with_cert_resolver(api_url: &str, cert_resolver: &str) -> Self {
        Self {
            client: Client::new(),
            api_url: api_url.trim_end_matches('/').to_string(),
            cert_resolver: cert_resolver.to_string(),
        }
    }

    /// Generate Traefik configuration from routes.
    pub fn generate_config(&self, routes: &[Route]) -> TraefikConfig {
        let mut config = TraefikConfig::default();

        for route in routes {
            if !route.enabled {
                continue;
            }

            let safe_name = sanitize_name(&route.name);

            // Create service
            let service = Service {
                load_balancer: LoadBalancer {
                    servers: vec![Server {
                        url: route.target.clone(),
                    }],
                    pass_host_header: Some(true),
                    health_check: None,
                },
            };
            config
                .http
                .services
                .insert(format!("{}-service", safe_name), service);

            // Build middlewares list
            let mut middlewares = Vec::new();

            // Add shield middlewares if enabled
            if let Some(shield) = route.get_shield_config() {
                if shield.enabled {
                    // IP allow list (whitelist) - Traefik native middleware
                    if !shield.whitelist.is_empty() {
                        let mw_name = format!("{}-ipallowlist", safe_name);
                        let allow_list =
                            Middleware::IpAllowList(IpAllowListMiddleware {
                                ip_allow_list: IpAllowListOptions {
                                    source_range: shield.whitelist.clone(),
                                },
                            });
                        config
                            .http
                            .middlewares
                            .insert(mw_name.clone(), allow_list);
                        middlewares.push(mw_name);
                    }

                    // Rate limiting with blacklist IPs excluded from detection
                    let mw_name = format!("{}-ratelimit", safe_name);
                    let excluded_ips = if !shield.blacklist.is_empty() {
                        Some(shield.blacklist.clone())
                    } else {
                        None
                    };
                    let rate_limit = Middleware::RateLimit(RateLimitMiddleware {
                        rate_limit: RateLimitOptions {
                            average: shield.requests_per_second as i64,
                            burst: shield.burst_size as i64,
                            period: Some("1s".to_string()),
                            source_criterion: Some(SourceCriterion {
                                request_host: None,
                                ip_strategy: Some(IpStrategy {
                                    depth: Some(1),
                                    excluded_ips,
                                }),
                            }),
                        },
                    });
                    config.http.middlewares.insert(mw_name.clone(), rate_limit);
                    middlewares.push(mw_name);
                }
            }

            // Add headers middleware if configured
            if let Some(headers_config) = route.get_headers_config() {
                let mw_name = format!("{}-headers", safe_name);
                let headers = self.build_headers_middleware(&headers_config);
                config.http.middlewares.insert(mw_name.clone(), headers);
                middlewares.push(mw_name);
            }

            // Add security headers
            let security_mw_name = format!("{}-security", safe_name);
            let security_headers = Middleware::Headers(HeadersMiddleware {
                headers: HeadersOptions {
                    custom_request_headers: None,
                    custom_response_headers: None,
                    access_control_allow_origin_list: None,
                    access_control_allow_methods: None,
                    access_control_allow_headers: None,
                    sts_seconds: Some(31536000),
                    sts_include_subdomains: Some(true),
                    frame_deny: Some(true),
                    content_type_nosniff: Some(true),
                    browser_xss_filter: Some(true),
                },
            });
            config
                .http
                .middlewares
                .insert(security_mw_name.clone(), security_headers);
            middlewares.push(security_mw_name);

            // Create router
            let mut entry_points = vec!["websecure".to_string()];
            if !route.tls_enabled {
                entry_points = vec!["web".to_string()];
            }

            let router = Router {
                rule: format!("Host(`{}`)", route.host),
                service: format!("{}-service", safe_name),
                middlewares: if middlewares.is_empty() {
                    None
                } else {
                    Some(middlewares)
                },
                tls: if route.tls_enabled {
                    Some(TlsConfig {
                        cert_resolver: Some(self.cert_resolver.clone()),
                        domains: Some(vec![TlsDomain {
                            main: route.host.clone(),
                            sans: None,
                        }]),
                    })
                } else {
                    None
                },
                priority: None,
                entry_points,
            };

            config
                .http
                .routers
                .insert(format!("{}-router", safe_name), router);

            // Add HTTP to HTTPS redirect if TLS enabled
            if route.tls_enabled {
                let redirect_router = Router {
                    rule: format!("Host(`{}`)", route.host),
                    service: format!("{}-service", safe_name),
                    middlewares: Some(vec![format!("{}-redirect", safe_name)]),
                    tls: None,
                    priority: None,
                    entry_points: vec!["web".to_string()],
                };

                let redirect_mw = Middleware::RedirectScheme(RedirectSchemeMiddleware {
                    redirect_scheme: RedirectSchemeOptions {
                        scheme: "https".to_string(),
                        permanent: Some(true),
                    },
                });

                config
                    .http
                    .routers
                    .insert(format!("{}-http-router", safe_name), redirect_router);
                config
                    .http
                    .middlewares
                    .insert(format!("{}-redirect", safe_name), redirect_mw);
            }
        }

        config
    }

    /// Build headers middleware from config.
    fn build_headers_middleware(&self, config: &HeadersConfig) -> Middleware {
        let mut request_headers: HashMap<String, String> = HashMap::new();
        let mut response_headers: HashMap<String, String> = HashMap::new();

        for header in &config.request_headers {
            request_headers.insert(header.name.clone(), header.value.clone());
        }

        for header in &config.response_headers {
            response_headers.insert(header.name.clone(), header.value.clone());
        }

        // Remove headers by setting them to empty
        for name in &config.remove_request_headers {
            request_headers.insert(name.clone(), String::new());
        }

        for name in &config.remove_response_headers {
            response_headers.insert(name.clone(), String::new());
        }

        Middleware::Headers(HeadersMiddleware {
            headers: HeadersOptions {
                custom_request_headers: if request_headers.is_empty() {
                    None
                } else {
                    Some(request_headers)
                },
                custom_response_headers: if response_headers.is_empty() {
                    None
                } else {
                    Some(response_headers)
                },
                ..Default::default()
            },
        })
    }

    /// Get current Traefik configuration via API.
    pub async fn get_current_config(&self) -> Result<serde_json::Value> {
        let response = self
            .client
            .get(format!("{}/api/http/routers", self.api_url))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Failed to get Traefik config: {}", e)))?;

        if !response.status().is_success() {
            return Err(Error::Internal(format!(
                "Traefik API error: {}",
                response.status()
            )));
        }

        let config: serde_json::Value = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse Traefik response: {}", e)))?;

        Ok(config)
    }

    /// Check if Traefik API is healthy.
    pub async fn health_check(&self) -> Result<bool> {
        let response = self
            .client
            .get(format!("{}/api/overview", self.api_url))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Traefik health check failed: {}", e)))?;

        Ok(response.status().is_success())
    }

    /// Get Traefik overview stats.
    pub async fn get_overview(&self) -> Result<serde_json::Value> {
        let response = self
            .client
            .get(format!("{}/api/overview", self.api_url))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Failed to get Traefik overview: {}", e)))?;

        if !response.status().is_success() {
            return Err(Error::Internal(format!(
                "Traefik API error: {}",
                response.status()
            )));
        }

        let overview: serde_json::Value = response
            .json()
            .await
            .map_err(|e| Error::Internal(format!("Failed to parse overview: {}", e)))?;

        Ok(overview)
    }
}

/// Sanitize a name for use in Traefik configuration.
fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_name() {
        assert_eq!(sanitize_name("My Route"), "my-route");
        assert_eq!(sanitize_name("api.example.com"), "api-example-com");
    }
}
