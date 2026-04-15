//! Admin CRUD endpoints for `identity.oauth_provider_configs`.
//!
//! All endpoints are tenant-scoped via `Claims.tenant_id` and require
//! admin role (`Claims.role >= 2`). The router-level `require_admin`
//! middleware enforces this; handlers check again as defence-in-depth.
//!
//! # Endpoints
//!
//! | Method | Path | Description |
//! |--------|------|-------------|
//! | `GET` | `/api/v1/admin/oauth-providers` | List all catalog providers joined with tenant config |
//! | `GET` | `/api/v1/admin/oauth-providers/:key` | Full config detail for a single provider |
//! | `POST` | `/api/v1/admin/oauth-providers/:key` | Upsert config (COALESCE-patch semantics) |
//! | `DELETE` | `/api/v1/admin/oauth-providers/:key` | Soft-delete (disable + wipe credentials) |

use crate::AppState;
use axum::extract::{Extension, Path, State};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{crypto::EncryptedField, Claims, Error};
use signapps_oauth::ProviderCategory;
use tracing::instrument;
use uuid::Uuid;

// ── Response types ────────────────────────────────────────────────────────────

/// Lightweight summary of a provider, suitable for the list view.
///
/// Providers that exist in the catalog but have no `oauth_provider_configs`
/// row yet are still returned so the admin can discover and enable them.
#[derive(Debug, Serialize)]
pub struct ProviderConfigSummary {
    /// Provider key (e.g. `"google"`, `"microsoft"`).
    pub provider_key: String,
    /// Human-readable name from the catalog.
    pub display_name: String,
    /// Functional categories (SSO, mail, calendar, …).
    pub categories: Vec<ProviderCategory>,
    /// Whether this provider is currently enabled for the tenant.
    pub enabled: bool,
    /// Allowed purposes for this config (e.g. `["sso", "mail"]`).
    pub purposes: Vec<String>,
    /// Who can see the provider (`"all"`, `"org_nodes"`, `"groups"`, …).
    pub visibility: String,
    /// Whether users can individually override the visibility rules.
    pub allow_user_override: bool,
    /// `true` if encrypted credentials are stored for this tenant.
    pub has_credentials: bool,
    /// Last time the config was modified.
    pub updated_at: DateTime<Utc>,
}

/// Full provider configuration detail, suitable for the config drawer.
#[derive(Debug, Serialize)]
pub struct ProviderConfigDetail {
    /// Row UUID (`Uuid::nil()` when no config row exists yet).
    pub id: Uuid,
    /// Provider key.
    pub provider_key: String,
    /// Human-readable name from the catalog.
    pub display_name: String,
    /// Functional categories.
    pub categories: Vec<ProviderCategory>,
    /// Whether this provider is currently enabled.
    pub enabled: bool,
    /// Allowed purposes.
    pub purposes: Vec<String>,
    /// Scopes this tenant is allowed to request.
    pub allowed_scopes: Vec<String>,
    /// Default scopes from the catalog definition.
    pub default_scopes: Vec<String>,
    /// Visibility policy.
    pub visibility: String,
    /// Org node IDs that may use this provider (only when `visibility = "org_nodes"`).
    pub visible_to_org_nodes: Vec<Uuid>,
    /// Group IDs that may use this provider (only when `visibility = "groups"`).
    pub visible_to_groups: Vec<Uuid>,
    /// Role names that may use this provider (only when `visibility = "roles"`).
    pub visible_to_roles: Vec<String>,
    /// User IDs that may use this provider (only when `visibility = "users"`).
    pub visible_to_users: Vec<Uuid>,
    /// Whether users can override the visibility rules.
    pub allow_user_override: bool,
    /// Whether this provider is the tenant's primary SSO.
    pub is_tenant_sso: bool,
    /// Auto-provision new user accounts on first SSO login.
    pub auto_provision_users: bool,
    /// Default role assigned to auto-provisioned accounts.
    pub default_role: Option<String>,
    /// Whether encrypted credentials are stored.
    pub has_credentials: bool,
    /// Last modification timestamp.
    pub updated_at: DateTime<Utc>,
}

// ── Request types ─────────────────────────────────────────────────────────────

/// Body for `POST /api/v1/admin/oauth-providers/:key`.
///
/// All fields are `Option<_>`. Fields set to `None` are left unchanged on an
/// existing row (COALESCE semantics). This allows callers to update a single
/// field — e.g. just flip `enabled` — without supplying the full config.
#[derive(Debug, Deserialize)]
pub struct UpsertProviderConfigBody {
    /// Enable or disable the provider for this tenant.
    pub enabled: Option<bool>,
    /// Allowed purposes (e.g. `["sso", "mail", "calendar"]`).
    pub purposes: Option<Vec<String>>,
    /// Scopes the tenant may request.
    pub allowed_scopes: Option<Vec<String>>,
    /// OAuth client ID (plaintext — encrypted server-side before write).
    /// Pass `None` to leave existing credentials in place.
    pub client_id: Option<String>,
    /// OAuth client secret (plaintext — encrypted server-side before write).
    pub client_secret: Option<String>,
    /// Provider-specific extra parameters (e.g. `{"tenant": "common"}` for Microsoft).
    pub extra_params: Option<serde_json::Value>,
    /// Visibility policy (`"all"`, `"org_nodes"`, `"groups"`, `"roles"`, `"users"`).
    pub visibility: Option<String>,
    /// Org node IDs allowed when `visibility = "org_nodes"`.
    pub visible_to_org_nodes: Option<Vec<Uuid>>,
    /// Group IDs allowed when `visibility = "groups"`.
    pub visible_to_groups: Option<Vec<Uuid>>,
    /// Role names allowed when `visibility = "roles"`.
    pub visible_to_roles: Option<Vec<String>>,
    /// User IDs allowed when `visibility = "users"`.
    pub visible_to_users: Option<Vec<Uuid>>,
    /// Whether users can override the visibility rules.
    pub allow_user_override: Option<bool>,
    /// Set as the tenant's primary SSO provider.
    pub is_tenant_sso: Option<bool>,
    /// Auto-provision new user accounts on first SSO login.
    pub auto_provision_users: Option<bool>,
    /// Default role assigned to auto-provisioned accounts.
    pub default_role: Option<String>,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// GET /api/v1/admin/oauth-providers
///
/// Lists every provider in the embedded catalog joined with this tenant's
/// `oauth_provider_configs` row (if any). Providers without a config row are
/// still returned (with `enabled = false`) so admins can discover and enable them.
///
/// # Errors
///
/// - `Error::Forbidden` if the caller is not an admin or has no `tenant_id`.
/// - `Error::Internal` on database failures.
#[instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn list_providers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ProviderConfigSummary>>, Error> {
    require_admin(&claims)?;
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("no tenant_id in token".into()))?;

    let configs: Vec<ConfigRow> = sqlx::query_as(
        "SELECT provider_key, enabled, purposes, visibility, allow_user_override, \
                (client_id_enc IS NOT NULL) AS has_credentials, updated_at \
         FROM identity.oauth_provider_configs \
         WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("query oauth_provider_configs: {e}")))?;

    // Index by provider key for O(1) lookup during catalog scan.
    let by_key: std::collections::HashMap<String, ConfigRow> = configs
        .into_iter()
        .map(|c| (c.provider_key.clone(), c))
        .collect();

    let summaries: Vec<ProviderConfigSummary> = state
        .oauth_engine_state
        .catalog
        .iter()
        .map(|(key, def)| {
            let cfg = by_key.get(key);
            ProviderConfigSummary {
                provider_key: key.to_string(),
                display_name: def.display_name.clone(),
                categories: def.categories.clone(),
                enabled: cfg.map(|c| c.enabled).unwrap_or(false),
                purposes: cfg.map(|c| c.purposes.clone()).unwrap_or_default(),
                visibility: cfg
                    .map(|c| c.visibility.clone())
                    .unwrap_or_else(|| "all".into()),
                allow_user_override: cfg.map(|c| c.allow_user_override).unwrap_or(false),
                has_credentials: cfg.map(|c| c.has_credentials).unwrap_or(false),
                updated_at: cfg.map(|c| c.updated_at).unwrap_or_else(Utc::now),
            }
        })
        .collect();

    Ok(Json(summaries))
}

/// GET /api/v1/admin/oauth-providers/:key
///
/// Returns the full configuration detail for a single provider. If no config
/// row exists yet, returns a default struct so the frontend can display the
/// empty config form.
///
/// # Errors
///
/// - `Error::Forbidden` if the caller is not an admin or has no `tenant_id`.
/// - `Error::NotFound` if the provider key is unknown in the catalog.
/// - `Error::Internal` on database failures.
#[instrument(skip(state, claims), fields(user_id = %claims.sub, provider_key = %provider_key))]
pub async fn get_provider(
    Path(provider_key): Path<String>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ProviderConfigDetail>, Error> {
    require_admin(&claims)?;
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("no tenant_id in token".into()))?;

    let provider = state
        .oauth_engine_state
        .catalog
        .get(&provider_key)
        .map_err(|_| Error::NotFound(format!("provider {provider_key:?} unknown in catalog")))?;

    let row: Option<DetailRow> = sqlx::query_as(
        "SELECT id, enabled, purposes, allowed_scopes, visibility, \
                visible_to_org_nodes, visible_to_groups, visible_to_roles, visible_to_users, \
                allow_user_override, is_tenant_sso, auto_provision_users, default_role, \
                (client_id_enc IS NOT NULL) AS has_credentials, updated_at \
         FROM identity.oauth_provider_configs \
         WHERE tenant_id = $1 AND provider_key = $2",
    )
    .bind(tenant_id)
    .bind(&provider_key)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("query oauth_provider_configs detail: {e}")))?;

    let detail = match row {
        Some(r) => ProviderConfigDetail {
            id: r.id,
            provider_key: provider_key.clone(),
            display_name: provider.display_name.clone(),
            categories: provider.categories.clone(),
            enabled: r.enabled,
            purposes: r.purposes,
            allowed_scopes: r.allowed_scopes,
            default_scopes: provider.default_scopes.clone(),
            visibility: r.visibility,
            visible_to_org_nodes: r.visible_to_org_nodes,
            visible_to_groups: r.visible_to_groups,
            visible_to_roles: r.visible_to_roles,
            visible_to_users: r.visible_to_users,
            allow_user_override: r.allow_user_override,
            is_tenant_sso: r.is_tenant_sso,
            auto_provision_users: r.auto_provision_users,
            default_role: r.default_role,
            has_credentials: r.has_credentials,
            updated_at: r.updated_at,
        },
        None => ProviderConfigDetail {
            id: Uuid::nil(),
            provider_key: provider_key.clone(),
            display_name: provider.display_name.clone(),
            categories: provider.categories.clone(),
            enabled: false,
            purposes: vec![],
            allowed_scopes: provider.default_scopes.clone(),
            default_scopes: provider.default_scopes.clone(),
            visibility: "all".into(),
            visible_to_org_nodes: vec![],
            visible_to_groups: vec![],
            visible_to_roles: vec![],
            visible_to_users: vec![],
            allow_user_override: false,
            is_tenant_sso: false,
            auto_provision_users: false,
            default_role: None,
            has_credentials: false,
            updated_at: Utc::now(),
        },
    };

    Ok(Json(detail))
}

/// POST /api/v1/admin/oauth-providers/:key
///
/// Upsert the provider config for this tenant. Only fields present in the
/// body (`Some(...)`) are written; absent fields (`None`) retain their
/// existing values via COALESCE on conflict.
///
/// Client credentials are encrypted via the keystore (DEK `oauth-tokens-v1`)
/// before being stored. Passing `None` for `client_id` / `client_secret`
/// leaves the existing encrypted credentials in place.
///
/// # Errors
///
/// - `Error::Forbidden` if the caller is not an admin or has no `tenant_id`.
/// - `Error::Internal` on encryption or database failures.
#[instrument(skip(state, claims, body), fields(user_id = %claims.sub, provider_key = %provider_key))]
pub async fn upsert_provider(
    Path(provider_key): Path<String>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertProviderConfigBody>,
) -> Result<Json<ProviderConfigDetail>, Error> {
    require_admin(&claims)?;
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("no tenant_id in token".into()))?;

    // Encrypt any credentials the caller supplied.
    let dek = state.keystore.dek("oauth-tokens-v1");

    let client_id_enc: Option<Vec<u8>> = body
        .client_id
        .as_deref()
        .map(|s| {
            <()>::encrypt(s.as_bytes(), &dek)
                .map_err(|e| Error::Internal(format!("encrypt client_id: {e}")))
        })
        .transpose()?;

    let client_secret_enc: Option<Vec<u8>> = body
        .client_secret
        .as_deref()
        .map(|s| {
            <()>::encrypt(s.as_bytes(), &dek)
                .map_err(|e| Error::Internal(format!("encrypt client_secret: {e}")))
        })
        .transpose()?;

    let extra_params_enc: Option<Vec<u8>> = body
        .extra_params
        .as_ref()
        .map(|v| {
            let json = serde_json::to_string(v)
                .map_err(|e| Error::Internal(format!("serialize extra_params: {e}")))?;
            <()>::encrypt(json.as_bytes(), &dek)
                .map_err(|e| Error::Internal(format!("encrypt extra_params: {e}")))
        })
        .transpose()?;

    sqlx::query(
        r#"
        INSERT INTO identity.oauth_provider_configs (
            tenant_id, provider_key,
            client_id_enc, client_secret_enc, extra_params_enc,
            enabled, purposes, allowed_scopes,
            visibility,
            visible_to_org_nodes, visible_to_groups, visible_to_roles, visible_to_users,
            allow_user_override, is_tenant_sso, auto_provision_users, default_role
        ) VALUES (
            $1, $2,
            $3, $4, $5,
            COALESCE($6, false),
            COALESCE($7, ARRAY[]::TEXT[]),
            COALESCE($8, ARRAY[]::TEXT[]),
            COALESCE($9, 'all'),
            COALESCE($10, ARRAY[]::UUID[]),
            COALESCE($11, ARRAY[]::UUID[]),
            COALESCE($12, ARRAY[]::TEXT[]),
            COALESCE($13, ARRAY[]::UUID[]),
            COALESCE($14, false),
            COALESCE($15, false),
            COALESCE($16, false),
            $17
        )
        ON CONFLICT (tenant_id, provider_key) DO UPDATE SET
            client_id_enc        = COALESCE(EXCLUDED.client_id_enc,
                                            identity.oauth_provider_configs.client_id_enc),
            client_secret_enc    = COALESCE(EXCLUDED.client_secret_enc,
                                            identity.oauth_provider_configs.client_secret_enc),
            extra_params_enc     = COALESCE(EXCLUDED.extra_params_enc,
                                            identity.oauth_provider_configs.extra_params_enc),
            enabled              = COALESCE($6,  identity.oauth_provider_configs.enabled),
            purposes             = COALESCE($7,  identity.oauth_provider_configs.purposes),
            allowed_scopes       = COALESCE($8,  identity.oauth_provider_configs.allowed_scopes),
            visibility           = COALESCE($9,  identity.oauth_provider_configs.visibility),
            visible_to_org_nodes = COALESCE($10, identity.oauth_provider_configs.visible_to_org_nodes),
            visible_to_groups    = COALESCE($11, identity.oauth_provider_configs.visible_to_groups),
            visible_to_roles     = COALESCE($12, identity.oauth_provider_configs.visible_to_roles),
            visible_to_users     = COALESCE($13, identity.oauth_provider_configs.visible_to_users),
            allow_user_override  = COALESCE($14, identity.oauth_provider_configs.allow_user_override),
            is_tenant_sso        = COALESCE($15, identity.oauth_provider_configs.is_tenant_sso),
            auto_provision_users = COALESCE($16, identity.oauth_provider_configs.auto_provision_users),
            default_role         = COALESCE($17, identity.oauth_provider_configs.default_role),
            updated_at           = NOW()
        "#,
    )
    .bind(tenant_id)
    .bind(&provider_key)
    .bind(client_id_enc.as_deref())
    .bind(client_secret_enc.as_deref())
    .bind(extra_params_enc.as_deref())
    .bind(body.enabled)
    .bind(body.purposes.as_deref())
    .bind(body.allowed_scopes.as_deref())
    .bind(body.visibility.as_deref())
    .bind(body.visible_to_org_nodes.as_deref())
    .bind(body.visible_to_groups.as_deref())
    .bind(body.visible_to_roles.as_deref())
    .bind(body.visible_to_users.as_deref())
    .bind(body.allow_user_override)
    .bind(body.is_tenant_sso)
    .bind(body.auto_provision_users)
    .bind(body.default_role.as_deref())
    .execute(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("upsert oauth_provider_configs: {e}")))?;

    // Reload and return the full detail so the frontend gets the canonical state.
    get_provider(Path(provider_key), State(state), Extension(claims)).await
}

/// DELETE /api/v1/admin/oauth-providers/:key
///
/// Soft-delete: sets `enabled = false` and nulls out all encrypted credentials.
/// Existing OAuth-acquired tokens in downstream tables (e.g. `mail.accounts`)
/// are not touched — the admin can disable a provider while preserving existing
/// user connections.
///
/// # Errors
///
/// - `Error::Forbidden` if the caller is not an admin or has no `tenant_id`.
/// - `Error::Internal` on database failures.
#[instrument(skip(state, claims), fields(user_id = %claims.sub, provider_key = %provider_key))]
pub async fn delete_provider(
    Path(provider_key): Path<String>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, Error> {
    require_admin(&claims)?;
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("no tenant_id in token".into()))?;

    sqlx::query(
        "UPDATE identity.oauth_provider_configs \
         SET enabled = false, \
             client_id_enc = NULL, \
             client_secret_enc = NULL, \
             extra_params_enc = NULL, \
             updated_at = NOW() \
         WHERE tenant_id = $1 AND provider_key = $2",
    )
    .bind(tenant_id)
    .bind(&provider_key)
    .execute(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("soft-delete oauth_provider_config: {e}")))?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Test endpoint types ───────────────────────────────────────────────────────

/// Body for `POST /api/v1/admin/oauth-providers/:key/test`.
///
/// Admins can supply transient credentials for an in-flight smoke test
/// without saving them first. If `client_id` and `client_secret` are
/// omitted the saved (encrypted) credentials are used instead.
#[derive(Debug, Deserialize)]
pub struct TestProviderBody {
    /// Transient client ID — if absent, the saved encrypted one is used.
    pub client_id: Option<String>,
    /// Transient client secret — if absent, the saved encrypted one is used.
    pub client_secret: Option<String>,
    /// Extra provider params (e.g. `{"tenant": "common"}` for Microsoft).
    pub extra_params: Option<serde_json::Value>,
    /// OAuth purpose to test (e.g. `Login`, `Integration`).
    pub purpose: signapps_oauth::OAuthPurpose,
    /// Where the browser lands after the OAuth dance completes.
    ///
    /// Defaults to `/admin/oauth-providers?test=1`.
    pub redirect_after: Option<String>,
}

/// Response for `POST /api/v1/admin/oauth-providers/:key/test`.
#[derive(Debug, Serialize)]
pub struct TestProviderResponse {
    /// The provider's authorization URL — open this in a browser to run the flow.
    pub authorization_url: String,
    /// Internal flow ID for log correlation.
    pub flow_id: uuid::Uuid,
    /// Human-readable note for the caller.
    pub note: String,
}

// ── Handlers (continued) ──────────────────────────────────────────────────────

/// POST /api/v1/admin/oauth-providers/:key/test
///
/// Runs `EngineV2::start` with the supplied (or saved) credentials and returns
/// the `authorization_url` so the admin can click through the flow manually.
/// Nothing is persisted — this is a pure smoke test.
///
/// If `client_id` + `client_secret` are present in the body they are used
/// as-is (no save). Otherwise the saved encrypted credentials are loaded and
/// decrypted on the fly.
///
/// # Errors
///
/// - `Error::Forbidden` if the caller is not an admin or has no `tenant_id`.
/// - `Error::NotFound` if the provider has no saved config and no credentials
///   were supplied in the body.
/// - `Error::BadRequest` / `Error::Forbidden` / `Error::ExternalService` for
///   OAuth engine errors (purpose not allowed, provider disabled, etc.).
/// - `Error::Internal` on unexpected failures.
#[instrument(skip(state, claims, body), fields(user_id = %claims.sub, provider_key = %provider_key))]
pub async fn test_provider(
    Path(provider_key): Path<String>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<TestProviderBody>,
) -> Result<Json<TestProviderResponse>, Error> {
    use signapps_oauth::{ResolvedCredentials, StartRequest};

    require_admin(&claims)?;
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("no tenant_id in token".into()))?;

    // Build resolved credentials: either inline from the body or decrypted from
    // the saved config.
    let creds: ResolvedCredentials = match (&body.client_id, &body.client_secret) {
        (Some(id), Some(secret)) => ResolvedCredentials {
            client_id: id.clone(),
            client_secret: secret.clone(),
            extra_params: body
                .extra_params
                .as_ref()
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default(),
            override_id: None,
        },
        _ => {
            // Fall back to saved + encrypted credentials.
            let cfg = state
                .oauth_engine_state
                .configs
                .get(tenant_id, &provider_key)
                .await
                .map_err(crate::handlers::oauth::error::oauth_error_to_app_error)?
                .ok_or_else(|| {
                    Error::NotFound("no saved credentials and none supplied in body".into())
                })?;
            crate::handlers::oauth::creds::resolve_credentials(&cfg, &state.keystore)
                .map_err(crate::handlers::oauth::error::oauth_error_to_app_error)?
        },
    };

    let req = StartRequest {
        tenant_id,
        provider_key: provider_key.clone(),
        user_id: Some(claims.sub),
        purpose: body.purpose,
        redirect_after: body
            .redirect_after
            .or_else(|| Some("/admin/oauth-providers?test=1".into())),
        requested_scopes: vec![],
        override_client_id: None,
    };

    let resp = state
        .oauth_engine_state
        .engine
        .start(req, creds)
        .await
        .map_err(crate::handlers::oauth::error::oauth_error_to_app_error)?;

    Ok(Json(TestProviderResponse {
        authorization_url: resp.authorization_url,
        flow_id: resp.flow_id,
        note: "Open this URL in a browser to complete the test flow. \
               The result lands at the redirect_after URL."
            .into(),
    }))
}

// ── Private helpers ───────────────────────────────────────────────────────────

/// Assert that the caller holds at least admin role (role >= 2).
///
/// The router-level `require_admin` middleware already enforces this; this
/// inline check is defence-in-depth in case the route is ever moved outside
/// the admin router.
///
/// # Errors
///
/// Returns `Error::Forbidden` if `claims.role < 2`.
fn require_admin(claims: &Claims) -> Result<(), Error> {
    // role: 1 = User, 2 = Admin, 3 = SuperAdmin
    if claims.role >= 2 {
        Ok(())
    } else {
        Err(Error::Forbidden("admin role required".into()))
    }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

/// Per-provider queue counters returned by the stats endpoint.
#[derive(Debug, Serialize)]
pub struct ProviderStats {
    /// Provider key (e.g. `"google"`, `"microsoft"`).
    pub provider_key: String,
    /// Number of active (not-disabled) queue entries for this provider.
    pub total_in_queue: i64,
    /// Number of entries that are disabled (too many consecutive failures).
    pub disabled: i64,
    /// Number of entries with 3–9 consecutive failures (warning threshold).
    pub warning_count: i64,
    /// Timestamp of the most recent disable event, if any.
    pub last_disabled_at: Option<DateTime<Utc>>,
}

/// GET /api/v1/admin/oauth-providers/:key/stats
///
/// Returns per-provider queue counters from `identity.oauth_refresh_queue`.
/// Useful for surfacing "N accounts need reconnection" in the admin UI.
///
/// # Errors
///
/// - `Error::Forbidden` if the caller is not an admin or has no `tenant_id`.
/// - `Error::Internal` on database failures.
#[instrument(skip(state, claims), fields(user_id = %claims.sub, provider_key = %provider_key))]
pub async fn provider_stats(
    Path(provider_key): Path<String>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ProviderStats>, Error> {
    require_admin(&claims)?;
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("no tenant_id in token".into()))?;

    let row: (i64, i64, i64, Option<DateTime<Utc>>) = sqlx::query_as(
        "SELECT \
            COUNT(*) FILTER (WHERE NOT disabled), \
            COUNT(*) FILTER (WHERE disabled), \
            COUNT(*) FILTER (WHERE consecutive_failures BETWEEN 3 AND 9), \
            MAX(updated_at) FILTER (WHERE disabled) \
         FROM identity.oauth_refresh_queue \
         WHERE tenant_id = $1 AND provider_key = $2",
    )
    .bind(tenant_id)
    .bind(&provider_key)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("stats query: {e}")))?;

    Ok(Json(ProviderStats {
        provider_key,
        total_in_queue: row.0,
        disabled: row.1,
        warning_count: row.2,
        last_disabled_at: row.3,
    }))
}

// ── Private query row types ───────────────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct ConfigRow {
    provider_key: String,
    enabled: bool,
    purposes: Vec<String>,
    visibility: String,
    allow_user_override: bool,
    has_credentials: bool,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
struct DetailRow {
    id: Uuid,
    enabled: bool,
    purposes: Vec<String>,
    allowed_scopes: Vec<String>,
    visibility: String,
    visible_to_org_nodes: Vec<Uuid>,
    visible_to_groups: Vec<Uuid>,
    visible_to_roles: Vec<String>,
    visible_to_users: Vec<Uuid>,
    allow_user_override: bool,
    is_tenant_sso: bool,
    auto_provision_users: bool,
    default_role: Option<String>,
    has_credentials: bool,
    updated_at: DateTime<Utc>,
}
