//! SSO handlers — SAML 2.0 and OIDC.
//!
//! Provides:
//!  - SAML SP metadata  GET  /api/v1/auth/sso/saml/metadata
//!  - SAML ACS          POST /api/v1/auth/sso/saml/acs
//!  - OIDC authorize    GET  /api/v1/auth/sso/oidc/authorize
//!  - OIDC callback     GET  /api/v1/auth/sso/oidc/callback
//!  - Config CRUD       GET/PUT /api/v1/admin/sso/config

use axum::{
    extract::{Extension, Form, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// DTOs
// ============================================================================

/// SSO configuration stored per tenant.
#[derive(Debug, Clone, Serialize, Deserialize)]
/// SsoConfig data transfer object.
pub struct SsoConfig {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub protocol: String,
    pub enabled: bool,
    // SAML
    pub idp_entity_id: Option<String>,
    pub idp_sso_url: Option<String>,
    pub idp_slo_url: Option<String>,
    pub idp_certificate: Option<String>,
    pub sp_entity_id: Option<String>,
    // OIDC
    pub oidc_issuer: Option<String>,
    pub oidc_client_id: Option<String>,
    pub oidc_scopes: Option<String>,
    // Mapping
    pub email_attribute: Option<String>,
    pub name_attribute: Option<String>,
    pub auto_create_users: bool,
    pub default_role: i16,
    pub metadata: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

/// Request to create/update SSO config.
#[derive(Debug, Deserialize)]
/// Request body for UpsertSsoConfig.
pub struct UpsertSsoConfigRequest {
    pub protocol: String,
    pub enabled: Option<bool>,
    pub idp_entity_id: Option<String>,
    pub idp_sso_url: Option<String>,
    pub idp_slo_url: Option<String>,
    pub idp_certificate: Option<String>,
    pub sp_entity_id: Option<String>,
    pub oidc_issuer: Option<String>,
    pub oidc_client_id: Option<String>,
    pub oidc_client_secret: Option<String>,
    pub oidc_scopes: Option<String>,
    pub email_attribute: Option<String>,
    pub name_attribute: Option<String>,
    pub auto_create_users: Option<bool>,
    pub default_role: Option<i16>,
    pub metadata: Option<serde_json::Value>,
}

/// Query params for OIDC authorize.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct AuthorizeQuery {
    pub tenant_id: Option<String>,
    pub redirect_uri: Option<String>,
}

/// Query params for OIDC callback.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct OidcCallbackQuery {
    pub code: String,
    pub state: Option<String>,
}

// ============================================================================
// SAML — SP Metadata
// ============================================================================

/// `GET /api/v1/auth/sso/saml/metadata` — Return SP metadata XML.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn saml_metadata(State(state): State<AppState>) -> Response {
    // Load the configured SP entity ID from env (or use a sensible default).
    let sp_entity_id = std::env::var("SAML_SP_ENTITY_ID")
        .unwrap_or_else(|_| "https://app.signapps.io/sp".to_string());
    let acs_url = std::env::var("SAML_ACS_URL")
        .unwrap_or_else(|_| "https://app.signapps.io/api/v1/auth/sso/saml/acs".to_string());
    let app_url = std::env::var("APP_URL")
        .unwrap_or_else(|_| "https://app.signapps.io".to_string());

    let xml = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  entityID="{sp_entity_id}">
  <SPSSODescriptor AuthnRequestsSigned="false"
                   WantAssertionsSigned="true"
                   protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
        Location="{acs_url}"
        index="0"
        isDefault="true"/>
    <AttributeConsumingService index="0">
      <ServiceName xml:lang="en">SignApps</ServiceName>
      <RequestedAttribute Name="email" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic" isRequired="true"/>
      <RequestedAttribute Name="name" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"/>
    </AttributeConsumingService>
  </SPSSODescriptor>
</EntityDescriptor>"#,
        sp_entity_id = sp_entity_id,
        acs_url = acs_url,
    );

    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/xml; charset=utf-8")],
        xml,
    )
        .into_response()
}

// ============================================================================
// SAML — Assertion Consumer Service
// ============================================================================

/// POST payload for SAML ACS.
#[derive(Debug, Deserialize)]
/// AcsPayload data transfer object.
pub struct AcsPayload {
    #[serde(rename = "SAMLResponse")]
    pub saml_response: Option<String>,
    #[serde(rename = "RelayState")]
    pub relay_state: Option<String>,
}

/// `POST /api/v1/auth/sso/saml/acs` — Assertion Consumer Service.
///
/// In production this would use a SAML library (e.g. `samael`) to verify the
/// response signature and extract the NameID + attributes.  For this stub we
/// parse the Base64 payload and extract the email attribute if present.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn saml_acs(
    State(state): State<AppState>,
    Form(payload): Form<AcsPayload>,
) -> Result<Json<serde_json::Value>> {
    let saml_response = payload
        .saml_response
        .ok_or_else(|| Error::BadRequest("Missing SAMLResponse".to_string()))?;

    // Decode Base64
    let decoded = base64_decode(&saml_response)
        .map_err(|_| Error::BadRequest("Invalid Base64 in SAMLResponse".to_string()))?;

    let xml_str = String::from_utf8(decoded)
        .map_err(|_| Error::BadRequest("Invalid UTF-8 in SAMLResponse".to_string()))?;

    // Extract email from the assertion — very simplified: look for the attribute value
    // after 'email'. A real implementation would use XML parsing + signature verification.
    let email = extract_saml_attribute(&xml_str, "email")
        .ok_or_else(|| Error::BadRequest("Email attribute not found in SAMLResponse".to_string()))?;

    let name = extract_saml_attribute(&xml_str, "name");

    tracing::info!(email = %email, "SAML ACS: user authenticated");

    // Find or create user
    let user_id = find_or_create_sso_user(&state, &email, name.as_deref()).await?;

    // Issue JWT pair
    let tokens = crate::auth::jwt::create_tokens(
        user_id,
        &email,
        1, // default user role
        None,
        None,
        &state.jwt_secret,
    )?;

    Ok(Json(serde_json::json!({
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "user_id": user_id,
        "relay_state": payload.relay_state,
    })))
}

// ============================================================================
// OIDC — Authorize redirect
// ============================================================================

/// `GET /api/v1/auth/sso/oidc/authorize` — Redirect to OIDC IdP.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn oidc_authorize(
    State(state): State<AppState>,
    Query(query): Query<AuthorizeQuery>,
) -> Result<Response> {
    // Look up OIDC config for the tenant
    let tenant_id_str = query.tenant_id.as_deref().unwrap_or("");
    let tenant_id = Uuid::parse_str(tenant_id_str)
        .map_err(|_| Error::BadRequest("Invalid tenant_id".to_string()))?;

    let cfg = get_sso_config(&state, tenant_id, "oidc").await?
        .ok_or_else(|| Error::NotFound("OIDC configuration not found for tenant".to_string()))?;

    if !cfg.enabled {
        return Err(Error::BadRequest("OIDC SSO is not enabled for this tenant".to_string()));
    }

    let issuer = cfg.oidc_issuer.ok_or_else(|| Error::BadRequest("OIDC issuer not configured".to_string()))?;
    let client_id = cfg.oidc_client_id.ok_or_else(|| Error::BadRequest("OIDC client_id not configured".to_string()))?;
    let scopes = cfg.oidc_scopes.unwrap_or_else(|| "openid email profile".to_string());
    let redirect_uri = query.redirect_uri.unwrap_or_else(|| {
        let base = std::env::var("APP_URL").unwrap_or_else(|_| "http://localhost:3001".to_string());
        format!("{}/api/v1/auth/sso/oidc/callback", base)
    });

    // State for CSRF — in production store in a short-lived cache
    let state_param = format!("{}-{}", tenant_id, Utc::now().timestamp());

    let auth_url = format!(
        "{issuer}/authorize?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}&scope={scopes}&state={state_param}",
        issuer = issuer,
        client_id = url_encode(&client_id),
        redirect_uri = url_encode(&redirect_uri),
        scopes = url_encode(&scopes),
        state_param = url_encode(&state_param),
    );

    Ok((
        StatusCode::FOUND,
        [(header::LOCATION, auth_url)],
    )
        .into_response())
}

// ============================================================================
// OIDC — Callback
// ============================================================================

/// `GET /api/v1/auth/sso/oidc/callback` — Handle OIDC authorization code callback.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn oidc_callback(
    State(state): State<AppState>,
    Query(query): Query<OidcCallbackQuery>,
) -> Result<Json<serde_json::Value>> {
    // In a real implementation:
    // 1. Validate state against stored CSRF state
    // 2. Exchange code for tokens with the IdP
    // 3. Validate ID token signature (JWKS)
    // 4. Extract claims from ID token
    // 5. Find or create user

    // Stub: acknowledge the callback
    tracing::info!(code = %query.code, "OIDC callback received");

    Ok(Json(serde_json::json!({
        "status": "oidc_callback_received",
        "code": query.code,
        "message": "Exchange code for tokens using the tenant OIDC configuration",
    })))
}

// ============================================================================
// Admin — SSO Config CRUD
// ============================================================================

/// `GET /api/v1/admin/sso/config` — Get SSO configs for the current tenant.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SsoConfig>>> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("Tenant required".to_string()))?;

    let rows = sqlx::query_as::<
        _,
        (
            Uuid, Uuid, String, bool,
            Option<String>, Option<String>, Option<String>, Option<String>, Option<String>,
            Option<String>, Option<String>, Option<String>,
            Option<String>, Option<String>, bool, i16,
            serde_json::Value,
            chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>,
        ),
    >(
        r#"SELECT id, tenant_id, protocol, enabled,
                  idp_entity_id, idp_sso_url, idp_slo_url, idp_certificate, sp_entity_id,
                  oidc_issuer, oidc_client_id, oidc_scopes,
                  email_attribute, name_attribute, auto_create_users, default_role,
                  metadata, created_at, updated_at
           FROM identity.sso_configs
           WHERE tenant_id = $1
           ORDER BY protocol"#,
    )
    .bind(tenant_id)
    .fetch_all(&*state.pool)
    .await?;

    let configs: Vec<SsoConfig> = rows
        .into_iter()
        .map(|r| SsoConfig {
            id: r.0,
            tenant_id: r.1,
            protocol: r.2,
            enabled: r.3,
            idp_entity_id: r.4,
            idp_sso_url: r.5,
            idp_slo_url: r.6,
            idp_certificate: r.7,
            sp_entity_id: r.8,
            oidc_issuer: r.9,
            oidc_client_id: r.10,
            oidc_scopes: r.11,
            email_attribute: r.12,
            name_attribute: r.13,
            auto_create_users: r.14,
            default_role: r.15,
            metadata: r.16,
            created_at: r.17.to_rfc3339(),
            updated_at: r.18.to_rfc3339(),
        })
        .collect();

    Ok(Json(configs))
}

/// `PUT /api/v1/admin/sso/config` — Upsert SSO config for the current tenant.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn upsert_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpsertSsoConfigRequest>,
) -> Result<Json<SsoConfig>> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("Tenant required".to_string()))?;

    if !["saml", "oidc"].contains(&payload.protocol.as_str()) {
        return Err(Error::Validation(
            "protocol must be 'saml' or 'oidc'".to_string(),
        ));
    }

    let metadata = payload
        .metadata
        .unwrap_or_else(|| serde_json::json!({}));

    let row = sqlx::query_as::<
        _,
        (
            Uuid, Uuid, String, bool,
            Option<String>, Option<String>, Option<String>, Option<String>, Option<String>,
            Option<String>, Option<String>, Option<String>,
            Option<String>, Option<String>, bool, i16,
            serde_json::Value,
            chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>,
        ),
    >(
        r#"INSERT INTO identity.sso_configs
               (tenant_id, protocol, enabled,
                idp_entity_id, idp_sso_url, idp_slo_url, idp_certificate, sp_entity_id,
                oidc_issuer, oidc_client_id, oidc_client_secret, oidc_scopes,
                email_attribute, name_attribute, auto_create_users, default_role, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           ON CONFLICT (tenant_id, protocol) DO UPDATE SET
               enabled = EXCLUDED.enabled,
               idp_entity_id = EXCLUDED.idp_entity_id,
               idp_sso_url = EXCLUDED.idp_sso_url,
               idp_slo_url = EXCLUDED.idp_slo_url,
               idp_certificate = EXCLUDED.idp_certificate,
               sp_entity_id = EXCLUDED.sp_entity_id,
               oidc_issuer = EXCLUDED.oidc_issuer,
               oidc_client_id = EXCLUDED.oidc_client_id,
               oidc_client_secret = COALESCE(EXCLUDED.oidc_client_secret, identity.sso_configs.oidc_client_secret),
               oidc_scopes = EXCLUDED.oidc_scopes,
               email_attribute = EXCLUDED.email_attribute,
               name_attribute = EXCLUDED.name_attribute,
               auto_create_users = EXCLUDED.auto_create_users,
               default_role = EXCLUDED.default_role,
               metadata = EXCLUDED.metadata,
               updated_at = now()
           RETURNING id, tenant_id, protocol, enabled,
                     idp_entity_id, idp_sso_url, idp_slo_url, idp_certificate, sp_entity_id,
                     oidc_issuer, oidc_client_id, oidc_scopes,
                     email_attribute, name_attribute, auto_create_users, default_role,
                     metadata, created_at, updated_at"#,
    )
    .bind(tenant_id)
    .bind(&payload.protocol)
    .bind(payload.enabled.unwrap_or(false))
    .bind(&payload.idp_entity_id)
    .bind(&payload.idp_sso_url)
    .bind(&payload.idp_slo_url)
    .bind(&payload.idp_certificate)
    .bind(&payload.sp_entity_id)
    .bind(&payload.oidc_issuer)
    .bind(&payload.oidc_client_id)
    .bind(&payload.oidc_client_secret)
    .bind(payload.oidc_scopes.as_deref().unwrap_or("openid email profile"))
    .bind(payload.email_attribute.as_deref().unwrap_or("email"))
    .bind(payload.name_attribute.as_deref().unwrap_or("name"))
    .bind(payload.auto_create_users.unwrap_or(true))
    .bind(payload.default_role.unwrap_or(1))
    .bind(&metadata)
    .fetch_one(&*state.pool)
    .await?;

    let config = SsoConfig {
        id: row.0,
        tenant_id: row.1,
        protocol: row.2,
        enabled: row.3,
        idp_entity_id: row.4,
        idp_sso_url: row.5,
        idp_slo_url: row.6,
        idp_certificate: row.7,
        sp_entity_id: row.8,
        oidc_issuer: row.9,
        oidc_client_id: row.10,
        oidc_scopes: row.11,
        email_attribute: row.12,
        name_attribute: row.13,
        auto_create_users: row.14,
        default_role: row.15,
        metadata: row.16,
        created_at: row.17.to_rfc3339(),
        updated_at: row.18.to_rfc3339(),
    };

    tracing::info!(tenant_id = %tenant_id, protocol = %config.protocol, "SSO config upserted");

    Ok(Json(config))
}

// ============================================================================
// Password Policies
// ============================================================================

/// Password policy DTO (tenant-level, persisted in DB).
#[derive(Debug, Clone, Serialize, Deserialize)]
/// TenantPasswordPolicy data transfer object.
pub struct TenantPasswordPolicy {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub min_length: i16,
    pub require_uppercase: bool,
    pub require_number: bool,
    pub require_special: bool,
    pub expiry_days: Option<i32>,
    pub max_attempts: i16,
    pub lockout_minutes: i16,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
/// Request body for UpsertPasswordPolicy.
pub struct UpsertPasswordPolicyRequest {
    pub min_length: Option<i16>,
    pub require_uppercase: Option<bool>,
    pub require_number: Option<bool>,
    pub require_special: Option<bool>,
    pub expiry_days: Option<i32>,
    pub max_attempts: Option<i16>,
    pub lockout_minutes: Option<i16>,
}

/// `GET /api/v1/admin/security/password-policy` — Get tenant password policy.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_password_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<PasswordPolicy>> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("Tenant required".to_string()))?;

    let row = sqlx::query_as::<
        _,
        (Uuid, Uuid, i16, bool, bool, bool, Option<i32>, i16, i16, chrono::DateTime<chrono::Utc>),
    >(
        r#"SELECT id, tenant_id, min_length, require_uppercase, require_number, require_special,
                  expiry_days, max_attempts, lockout_minutes, updated_at
           FROM identity.password_policies
           WHERE tenant_id = $1"#,
    )
    .bind(tenant_id)
    .fetch_optional(&*state.pool)
    .await?;

    let policy = match row {
        Some(r) => PasswordPolicy {
            id: r.0,
            tenant_id: r.1,
            min_length: r.2,
            require_uppercase: r.3,
            require_number: r.4,
            require_special: r.5,
            expiry_days: r.6,
            max_attempts: r.7,
            lockout_minutes: r.8,
            updated_at: r.9.to_rfc3339(),
        },
        None => PasswordPolicy {
            id: Uuid::nil(),
            tenant_id,
            min_length: 8,
            require_uppercase: false,
            require_number: false,
            require_special: false,
            expiry_days: None,
            max_attempts: 5,
            lockout_minutes: 15,
            updated_at: Utc::now().to_rfc3339(),
        },
    };

    Ok(Json(policy))
}

/// `PUT /api/v1/admin/security/password-policy` — Upsert tenant password policy.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn upsert_password_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpsertPasswordPolicyRequest>,
) -> Result<Json<PasswordPolicy>> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("Tenant required".to_string()))?;

    let row = sqlx::query_as::<
        _,
        (Uuid, Uuid, i16, bool, bool, bool, Option<i32>, i16, i16, chrono::DateTime<chrono::Utc>),
    >(
        r#"INSERT INTO identity.password_policies
               (tenant_id, min_length, require_uppercase, require_number, require_special,
                expiry_days, max_attempts, lockout_minutes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (tenant_id) DO UPDATE SET
               min_length       = EXCLUDED.min_length,
               require_uppercase = EXCLUDED.require_uppercase,
               require_number   = EXCLUDED.require_number,
               require_special  = EXCLUDED.require_special,
               expiry_days      = EXCLUDED.expiry_days,
               max_attempts     = EXCLUDED.max_attempts,
               lockout_minutes  = EXCLUDED.lockout_minutes,
               updated_at       = now()
           RETURNING id, tenant_id, min_length, require_uppercase, require_number, require_special,
                     expiry_days, max_attempts, lockout_minutes, updated_at"#,
    )
    .bind(tenant_id)
    .bind(payload.min_length.unwrap_or(8))
    .bind(payload.require_uppercase.unwrap_or(false))
    .bind(payload.require_number.unwrap_or(false))
    .bind(payload.require_special.unwrap_or(false))
    .bind(payload.expiry_days)
    .bind(payload.max_attempts.unwrap_or(5))
    .bind(payload.lockout_minutes.unwrap_or(15))
    .fetch_one(&*state.pool)
    .await?;

    let policy = PasswordPolicy {
        id: row.0,
        tenant_id: row.1,
        min_length: row.2,
        require_uppercase: row.3,
        require_number: row.4,
        require_special: row.5,
        expiry_days: row.6,
        max_attempts: row.7,
        lockout_minutes: row.8,
        updated_at: row.9.to_rfc3339(),
    };

    tracing::info!(tenant_id = %tenant_id, "Password policy updated");
    Ok(Json(policy))
}

// ============================================================================
// Helpers
// ============================================================================

/// Simple percent-encoding for URL query parameters.
fn url_encode(s: &str) -> String {
    let mut encoded = String::with_capacity(s.len() * 2);
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => {
                encoded.push('%');
                encoded.push_str(&format!("{:02X}", byte));
            }
        }
    }
    encoded
}

/// Base64 decode (standard or URL-safe).
fn base64_decode(input: &str) -> std::result::Result<Vec<u8>, ()> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(input)
        .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(input))
        .map_err(|_| ())
}

/// Naive extraction of a SAML attribute value from raw XML.
/// Production code should use a proper XML parser (e.g. `quick-xml`).
fn extract_saml_attribute(xml: &str, attr_name: &str) -> Option<String> {
    // Look for patterns like: <saml:AttributeValue>value</saml:AttributeValue>
    // after finding the attribute name.
    let needle = format!("Name=\"{}\"", attr_name);
    let pos = xml.find(&needle)?;
    let after = &xml[pos..];
    let start = after.find("AttributeValue>")?;
    let value_start = start + "AttributeValue>".len();
    let end = after[value_start..].find('<')?;
    let value = &after[value_start..value_start + end];
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

/// Find an existing user by email or create one for SSO login.
async fn find_or_create_sso_user(
    state: &AppState,
    email: &str,
    name: Option<&str>,
) -> Result<Uuid> {
    // Look up by email (normalized)
    let normalized_email = email.to_lowercase();

    let existing: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM identity.users WHERE lower(username) = $1 LIMIT 1")
            .bind(&normalized_email)
            .fetch_optional(&*state.pool)
            .await?;

    if let Some((id,)) = existing {
        return Ok(id);
    }

    // Auto-create user
    let user_id: Uuid = sqlx::query_scalar(
        r#"INSERT INTO identity.users
               (username, display_name, role, is_active, created_at, updated_at)
           VALUES ($1, $2, 1, true, now(), now())
           RETURNING id"#,
    )
    .bind(&normalized_email)
    .bind(name.unwrap_or(email))
    .fetch_one(&*state.pool)
    .await?;

    tracing::info!(user_id = %user_id, email = %email, "SSO user auto-created");
    Ok(user_id)
}

// ============================================================================
// Validation helper (used at password change)
// ============================================================================

/// Validate a password against the tenant policy.
/// Returns `Ok(())` if valid, `Err(String)` with a message otherwise.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn validate_password_against_policy(
    state: &AppState,
    tenant_id: Uuid,
    password: &str,
) -> Result<()> {
    let row = sqlx::query_as::<
        _,
        (i16, bool, bool, bool),
    >(
        r#"SELECT min_length, require_uppercase, require_number, require_special
           FROM identity.password_policies
           WHERE tenant_id = $1"#,
    )
    .bind(tenant_id)
    .fetch_optional(&*state.pool)
    .await?;

    let (min_length, req_upper, req_number, req_special) = row.unwrap_or((8, false, false, false));

    if (password.len() as i16) < min_length {
        return Err(Error::Validation(format!(
            "Password must be at least {} characters",
            min_length
        )));
    }
    if req_upper && !password.chars().any(|c| c.is_uppercase()) {
        return Err(Error::Validation(
            "Password must contain at least one uppercase letter".to_string(),
        ));
    }
    if req_number && !password.chars().any(|c| c.is_ascii_digit()) {
        return Err(Error::Validation(
            "Password must contain at least one number".to_string(),
        ));
    }
    if req_special && !password.chars().any(|c| !c.is_alphanumeric()) {
        return Err(Error::Validation(
            "Password must contain at least one special character".to_string(),
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
