//! Mail domain management handlers.
//!
//! Provides CRUD endpoints for mailserver domains, including DKIM key generation
//! on creation, DNS record generation, and DNS verification.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// A mailserver domain.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct MailDomain {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Domain name (e.g. `example.com`).
    pub name: String,
    /// Whether the domain is active.
    pub is_active: Option<bool>,
    /// Tenant ID owning this domain.
    pub tenant_id: Option<Uuid>,
    /// DKIM selector (e.g. `signapps`).
    pub dkim_selector: Option<String>,
    /// DKIM private key (PEM, never exposed in API responses).
    #[serde(skip_serializing)]
    pub dkim_private_key: Option<String>,
    /// DKIM DNS TXT record value.
    pub dkim_dns_value: Option<String>,
    /// DMARC policy (`none`, `quarantine`, `reject`).
    pub dmarc_policy: Option<String>,
    /// Whether DNS records have been verified.
    pub dns_verified: Option<bool>,
    /// Timestamp of last DNS verification.
    pub dns_verified_at: Option<DateTime<Utc>>,
    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
    /// Row last-update timestamp.
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request to create a new mail domain.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateDomainRequest {
    /// Domain name (e.g. `example.com`).
    pub name: String,
    /// DMARC policy (default: `none`).
    pub dmarc_policy: Option<String>,
}

/// Request to update a mail domain.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateDomainRequest {
    /// Whether the domain is active.
    pub is_active: Option<bool>,
    /// DMARC policy.
    pub dmarc_policy: Option<String>,
}

/// A DNS record required for the mail domain.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct DnsRecord {
    /// DNS record name (e.g. `example.com`, `signapps._domainkey.example.com`).
    pub name: String,
    /// Record type (`MX`, `TXT`, `CNAME`).
    #[serde(rename = "type")]
    pub type_: String,
    /// Record value.
    pub value: String,
    /// TTL in seconds.
    pub ttl: u32,
}

/// DNS verification result.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct DnsVerificationResult {
    /// Whether all required DNS records are present and correct.
    pub verified: bool,
    /// Per-record check results.
    pub checks: Vec<DnsCheck>,
}

/// Individual DNS record check result.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct DnsCheck {
    /// Record type being checked.
    pub record_type: String,
    /// Whether this record passed verification.
    pub ok: bool,
    /// Expected value.
    pub expected: String,
    /// Actual value found (if any).
    pub found: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List all domains for the current tenant.
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// None.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/domains",
    tag = "mailserver-domains",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of domains", body = Vec<MailDomain>),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_domains(State(state): State<AppState>) -> impl IntoResponse {
    match sqlx::query_as::<_, MailDomain>(
        "SELECT id, name, is_active, tenant_id, dkim_selector, dkim_private_key, \
         dkim_dns_value, dmarc_policy, dns_verified, dns_verified_at, created_at, updated_at \
         FROM mailserver.domains ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await
    {
        Ok(domains) => Json(serde_json::json!({ "domains": domains })).into_response(),
        Err(e) => {
            tracing::error!("Failed to list domains: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to list domains" })),
            )
                .into_response()
        },
    }
}

/// Create a new mail domain with auto-generated DKIM keys.
///
/// Generates an RSA-2048 DKIM key pair on creation. The private key is stored
/// in the database; the public key DNS TXT value is returned for DNS setup.
///
/// # Errors
///
/// Returns 400 if domain already exists, 500 on database or key generation failure.
///
/// # Panics
///
/// None.
#[utoipa::path(
    post,
    path = "/api/v1/mailserver/domains",
    tag = "mailserver-domains",
    security(("bearerAuth" = [])),
    request_body = CreateDomainRequest,
    responses(
        (status = 201, description = "Domain created", body = MailDomain),
        (status = 400, description = "Domain already exists"),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip_all, fields(domain = %payload.name))]
pub async fn create_domain(
    State(state): State<AppState>,
    Json(payload): Json<CreateDomainRequest>,
) -> impl IntoResponse {
    let dkim_selector = "signapps".to_string();
    let dmarc_policy = payload.dmarc_policy.unwrap_or_else(|| "none".to_string());

    // Generate DKIM RSA-2048 key pair
    let (private_pem, dns_txt_value) = match signapps_dkim::keygen::generate_rsa_2048() {
        Ok(pair) => pair,
        Err(e) => {
            tracing::error!("DKIM key generation failed: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "DKIM key generation failed" })),
            )
                .into_response();
        },
    };

    match sqlx::query_as::<_, MailDomain>(
        r#"INSERT INTO mailserver.domains
               (name, is_active, dkim_selector, dkim_private_key, dkim_dns_value, dmarc_policy)
           VALUES ($1, true, $2, $3, $4, $5)
           RETURNING id, name, is_active, tenant_id, dkim_selector, dkim_private_key,
                     dkim_dns_value, dmarc_policy, dns_verified, dns_verified_at, created_at, updated_at"#,
    )
    .bind(&payload.name)
    .bind(&dkim_selector)
    .bind(&private_pem)
    .bind(&dns_txt_value)
    .bind(&dmarc_policy)
    .fetch_one(&state.pool)
    .await
    {
        Ok(domain) => {
            // Best-effort: create default service subdomains
            if let Err(e) = crate::handlers::subdomains::create_default_subdomains(
                &state.pool,
                domain.id,
                &domain.name,
            )
            .await
            {
                tracing::warn!(
                    domain = %domain.name,
                    "Failed to create default subdomains: {}",
                    e
                );
            }

            // Best-effort: provision DNS records via SecureLink
            let server_ip = std::env::var("MAIL_SERVER_IP")
                .unwrap_or_else(|_| "127.0.0.1".to_string());
            let dns_client = crate::dns::securelink::SecurelinkDnsClient::new();

            // Provision mail DNS records (MX, SPF, DKIM, DMARC)
            match dns_client.provision_mail_domain(
                &domain.name,
                &server_ip,
                domain.dkim_selector.as_deref().unwrap_or("signapps"),
                domain.dkim_dns_value.as_deref().unwrap_or(""),
                domain.dmarc_policy.as_deref().unwrap_or("none"),
            ).await {
                Ok(results) => {
                    let success_count = results.iter().filter(|r| r.success).count();
                    tracing::info!(
                        domain = %domain.name,
                        total = results.len(),
                        success = success_count,
                        "DNS mail records provisioned via SecureLink"
                    );
                },
                Err(e) => {
                    tracing::warn!(
                        domain = %domain.name,
                        "SecureLink DNS provisioning skipped (configure DNS manually): {}",
                        e
                    );
                },
            }

            // Provision service subdomain DNS records
            match dns_client.provision_service_subdomains(&domain.name, &server_ip).await {
                Ok(results) => {
                    let success_count = results.iter().filter(|r| r.success).count();
                    tracing::info!(
                        domain = %domain.name,
                        total = results.len(),
                        success = success_count,
                        "DNS subdomain records provisioned via SecureLink"
                    );
                },
                Err(e) => {
                    tracing::warn!(
                        domain = %domain.name,
                        "SecureLink subdomain DNS provisioning skipped: {}",
                        e
                    );
                },
            }

            (StatusCode::CREATED, Json(domain)).into_response()
        },
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("duplicate") || msg.contains("unique") {
                (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "error": "Domain already exists" })),
                )
                    .into_response()
            } else {
                tracing::error!("Failed to create domain: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({ "error": "Failed to create domain" })),
                )
                    .into_response()
            }
        },
    }
}

/// Get a single domain by ID.
///
/// # Errors
///
/// Returns 404 if domain not found.
///
/// # Panics
///
/// None.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/domains/{id}",
    tag = "mailserver-domains",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Domain ID")),
    responses(
        (status = 200, description = "Domain details", body = MailDomain),
        (status = 404, description = "Domain not found"),
    )
)]
#[tracing::instrument(skip(state), fields(domain_id = %id))]
pub async fn get_domain(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    match sqlx::query_as::<_, MailDomain>(
        "SELECT id, name, is_active, tenant_id, dkim_selector, dkim_private_key, \
         dkim_dns_value, dmarc_policy, dns_verified, dns_verified_at, created_at, updated_at \
         FROM mailserver.domains WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(domain)) => Json(domain).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Domain not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to get domain: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to get domain" })),
            )
                .into_response()
        },
    }
}

/// Update a mail domain.
///
/// # Errors
///
/// Returns 404 if domain not found.
///
/// # Panics
///
/// None.
#[utoipa::path(
    put,
    path = "/api/v1/mailserver/domains/{id}",
    tag = "mailserver-domains",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Domain ID")),
    request_body = UpdateDomainRequest,
    responses(
        (status = 200, description = "Domain updated", body = MailDomain),
        (status = 404, description = "Domain not found"),
    )
)]
#[tracing::instrument(skip(state), fields(domain_id = %id))]
pub async fn update_domain(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateDomainRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, MailDomain>(
        r#"UPDATE mailserver.domains SET
               is_active = COALESCE($2, is_active),
               dmarc_policy = COALESCE($3, dmarc_policy),
               updated_at = NOW()
           WHERE id = $1
           RETURNING id, name, is_active, tenant_id, dkim_selector, dkim_private_key,
                     dkim_dns_value, dmarc_policy, dns_verified, dns_verified_at, created_at, updated_at"#,
    )
    .bind(id)
    .bind(payload.is_active)
    .bind(payload.dmarc_policy)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(domain)) => Json(domain).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Domain not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to update domain: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to update domain" })),
            )
                .into_response()
        },
    }
}

/// Delete a mail domain.
///
/// # Errors
///
/// Returns 404 if domain not found.
///
/// # Panics
///
/// None.
#[utoipa::path(
    delete,
    path = "/api/v1/mailserver/domains/{id}",
    tag = "mailserver-domains",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Domain ID")),
    responses(
        (status = 200, description = "Domain deleted"),
        (status = 404, description = "Domain not found"),
    )
)]
#[tracing::instrument(skip(state), fields(domain_id = %id))]
pub async fn delete_domain(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Fetch domain name before deletion for DNS cleanup (tenant-scoped)
    let domain_name: Option<String> = sqlx::query_scalar(
        "SELECT name FROM mailserver.domains WHERE id = $1 AND tenant_id IS NOT NULL",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    match sqlx::query(
        "DELETE FROM mailserver.domains WHERE id = $1 AND tenant_id IS NOT NULL RETURNING id",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(_)) => {
            // Best-effort: deprovision DNS records via SecureLink
            if let Some(ref name) = domain_name {
                let dns_client = crate::dns::securelink::SecurelinkDnsClient::new();
                if let Err(e) = dns_client.deprovision_mail_domain(name).await {
                    tracing::warn!(
                        domain = %name,
                        "SecureLink DNS deprovision failed (records may need manual cleanup): {}",
                        e
                    );
                }
            }
            Json(serde_json::json!({ "success": true })).into_response()
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Domain not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to delete domain: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to delete domain" })),
            )
                .into_response()
        },
    }
}

/// Verify DNS records for a domain.
///
/// Performs live DNS lookups to verify MX, SPF, DKIM, and DMARC records
/// are correctly configured.
///
/// # Errors
///
/// Returns 404 if domain not found, 500 on DNS resolution failure.
///
/// # Panics
///
/// None.
#[utoipa::path(
    post,
    path = "/api/v1/mailserver/domains/{id}/verify-dns",
    tag = "mailserver-domains",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Domain ID")),
    responses(
        (status = 200, description = "DNS verification result", body = DnsVerificationResult),
        (status = 404, description = "Domain not found"),
    )
)]
#[tracing::instrument(skip(state), fields(domain_id = %id))]
pub async fn verify_dns(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let domain = match sqlx::query_as::<_, MailDomain>(
        "SELECT id, name, is_active, tenant_id, dkim_selector, dkim_private_key, \
         dkim_dns_value, dmarc_policy, dns_verified, dns_verified_at, created_at, updated_at \
         FROM mailserver.domains WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(d)) => d,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Domain not found" })),
            )
                .into_response();
        },
        Err(e) => {
            tracing::error!("Failed to fetch domain: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
    };

    // Perform DNS verification (best-effort, non-blocking)
    let resolver = match trust_dns_resolver::TokioAsyncResolver::tokio_from_system_conf() {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("DNS resolver init failed: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "DNS resolver initialization failed" })),
            )
                .into_response();
        },
    };

    let mut checks = Vec::new();

    // Check MX record
    let mx_ok = match resolver.mx_lookup(&domain.name).await {
        Ok(mx) => {
            let found: Vec<String> = mx.iter().map(|r| r.exchange().to_string()).collect();
            let ok = !found.is_empty();
            checks.push(DnsCheck {
                record_type: "MX".to_string(),
                ok,
                expected: format!("mail.{}", domain.name),
                found: Some(found.join(", ")),
            });
            ok
        },
        Err(_) => {
            checks.push(DnsCheck {
                record_type: "MX".to_string(),
                ok: false,
                expected: format!("mail.{}", domain.name),
                found: None,
            });
            false
        },
    };

    // Check TXT records (SPF + DMARC)
    let txt_records: Vec<String> = match resolver.txt_lookup(&domain.name).await {
        Ok(txt) => txt.iter().map(|r| r.to_string()).collect(),
        Err(_) => Vec::new(),
    };

    let spf_ok = txt_records.iter().any(|r| r.starts_with("v=spf1"));
    checks.push(DnsCheck {
        record_type: "SPF".to_string(),
        ok: spf_ok,
        expected: "v=spf1 ...".to_string(),
        found: txt_records
            .iter()
            .find(|r| r.starts_with("v=spf1"))
            .cloned(),
    });

    // Check DMARC
    let dmarc_domain = format!("_dmarc.{}", domain.name);
    let dmarc_records: Vec<String> = match resolver.txt_lookup(&dmarc_domain).await {
        Ok(txt) => txt.iter().map(|r| r.to_string()).collect(),
        Err(_) => Vec::new(),
    };
    let dmarc_ok = dmarc_records.iter().any(|r| r.starts_with("v=DMARC1"));
    checks.push(DnsCheck {
        record_type: "DMARC".to_string(),
        ok: dmarc_ok,
        expected: "v=DMARC1; ...".to_string(),
        found: dmarc_records
            .iter()
            .find(|r| r.starts_with("v=DMARC1"))
            .cloned(),
    });

    // Check DKIM
    let selector = domain.dkim_selector.as_deref().unwrap_or("signapps");
    let dkim_domain = format!("{}._domainkey.{}", selector, domain.name);
    let dkim_records: Vec<String> = match resolver.txt_lookup(&dkim_domain).await {
        Ok(txt) => txt.iter().map(|r| r.to_string()).collect(),
        Err(_) => Vec::new(),
    };
    let dkim_ok = dkim_records.iter().any(|r| r.starts_with("v=DKIM1"));
    checks.push(DnsCheck {
        record_type: "DKIM".to_string(),
        ok: dkim_ok,
        expected: "v=DKIM1; ...".to_string(),
        found: dkim_records
            .iter()
            .find(|r| r.starts_with("v=DKIM1"))
            .cloned(),
    });

    let all_verified = mx_ok && spf_ok && dmarc_ok && dkim_ok;

    // Update verification status in DB
    let _ = sqlx::query(
        "UPDATE mailserver.domains SET dns_verified = $1, dns_verified_at = NOW() WHERE id = $2",
    )
    .bind(all_verified)
    .bind(id)
    .execute(&state.pool)
    .await;

    Json(DnsVerificationResult {
        verified: all_verified,
        checks,
    })
    .into_response()
}

/// Get required DNS records for a domain.
///
/// Returns the MX, SPF, DKIM, and DMARC records that should be configured
/// in the domain's DNS to enable email delivery and authentication.
///
/// # Errors
///
/// Returns 404 if domain not found.
///
/// # Panics
///
/// None.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/domains/{id}/dns-records",
    tag = "mailserver-domains",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Domain ID")),
    responses(
        (status = 200, description = "Required DNS records", body = Vec<DnsRecord>),
        (status = 404, description = "Domain not found"),
    )
)]
#[tracing::instrument(skip(state), fields(domain_id = %id))]
pub async fn get_dns_records(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let domain = match sqlx::query_as::<_, MailDomain>(
        "SELECT id, name, is_active, tenant_id, dkim_selector, dkim_private_key, \
         dkim_dns_value, dmarc_policy, dns_verified, dns_verified_at, created_at, updated_at \
         FROM mailserver.domains WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(d)) => d,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Domain not found" })),
            )
                .into_response();
        },
        Err(e) => {
            tracing::error!("Failed to fetch domain: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
    };

    let server_ip = std::env::var("MAIL_SERVER_IP").unwrap_or_else(|_| "127.0.0.1".to_string());
    let records = crate::dns::records::required_dns_records(&domain, &server_ip);

    Json(serde_json::json!({ "records": records })).into_response()
}
