# OAuth Admin UI Implementation Plan (Plan 6 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the operator-facing UI for OAuth provider configuration. Tenant admins land on `/admin/oauth-providers` to enable providers, set credentials, and scope visibility (which org nodes/groups/roles/users can use which provider for which purpose). End users land on `/account/connections` to see their active OAuth connections and reconnect when needed.

**Architecture:**

```
Backend (signapps-identity)
  GET    /api/v1/admin/oauth-providers         → list ProviderConfigSummary[]
  GET    /api/v1/admin/oauth-providers/:key    → full ProviderConfigDetail
  POST   /api/v1/admin/oauth-providers/:key    → upsert config (create or update)
  DELETE /api/v1/admin/oauth-providers/:key    → soft-delete (enabled=false + drop creds)
  POST   /api/v1/admin/oauth-providers/:key/test → end-to-end smoke test (no persist)
  GET    /api/v1/admin/oauth-providers/:key/stats → refresh queue counters

  GET    /api/v1/account/oauth-connections     → user's connected accounts (per-service)
  POST   /api/v1/account/oauth-connections/:id/disconnect → revoke + delete row

Frontend (Next.js 16 + React 19)
  /admin/oauth-providers
    ├─ ProviderListPage (filter by category, search, status)
    ├─ ProviderCard (per row: enabled toggle, scope chip, actions)
    ├─ ProviderConfigDrawer (full config editor)
    │   ├─ GeneralTab (enabled, purposes, allow_user_override)
    │   ├─ CredentialsTab (client_id + client_secret entry, test button)
    │   └─ VisibilityTab (org_nodes / groups / roles / users picker)
    └─ VisibilityPicker (reusable: groups, roles, nodes, users)

  /account/connections
    ├─ ConnectionsListPage
    └─ ConnectionCard (provider + email + status + reconnect/disconnect)
```

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4 (semantic tokens — `bg-card`, `text-foreground`, `border-border`), shadcn/ui (Drawer, Tabs, Card, Button, Input, Switch, Badge), Zustand for cross-component state (only if needed), Axios with JWT auto-refresh.

**Dependencies:** Plans 1-5 fully merged on `main`. Specifically Plan 2's `oauth_provider_configs` table + Plan 3's `EngineV2::start` (used by the test endpoint).

**Scope discipline (out of Plan 6):**
- 5 tabs (Scopes + Audit) — only 3 in MVP (General + Credentials + Visibility). Scopes inline in Visibility for now; Audit is a follow-up.
- OIDC discovery wizard for fully custom providers (not in `catalog.json`) — deferred. Custom providers pasted manually for now.
- SAML metadata XML upload — deferred (no SAML callback handler yet).
- Per-purpose visibility overrides (`oauth_provider_purpose_overrides` from migration 302) — not exposed in the UI yet; one global visibility per config.

---

## File Structure

### Backend created
- `services/signapps-identity/src/handlers/admin/mod.rs` (if not present) + `services/signapps-identity/src/handlers/admin/oauth_providers.rs`
- `services/signapps-identity/src/handlers/oauth/account_connections.rs` — user-facing list + disconnect

### Backend modified
- `services/signapps-identity/src/main.rs` — register new routes + admin guard middleware

### Frontend created
- `client/src/types/oauth-providers.ts` — TypeScript types mirroring backend Serde
- `client/src/lib/api/oauth-providers.ts` — Axios client (admin)
- `client/src/lib/api/account-connections.ts` — Axios client (user)
- `client/src/app/admin/oauth-providers/page.tsx` — list page
- `client/src/app/admin/oauth-providers/loading.tsx` — skeleton
- `client/src/components/admin/oauth/ProviderCard.tsx`
- `client/src/components/admin/oauth/ProviderConfigDrawer.tsx`
- `client/src/components/admin/oauth/tabs/GeneralTab.tsx`
- `client/src/components/admin/oauth/tabs/CredentialsTab.tsx`
- `client/src/components/admin/oauth/tabs/VisibilityTab.tsx`
- `client/src/components/shared/VisibilityPicker.tsx` — reusable
- `client/src/app/account/connections/page.tsx`
- `client/src/components/account/ConnectionCard.tsx`

---

## Task 1: Backend admin endpoints — list + get + upsert + delete

**Files:**
- Create: `services/signapps-identity/src/handlers/admin/oauth_providers.rs`
- Modify: `services/signapps-identity/src/main.rs` (register routes)
- Modify: `services/signapps-identity/src/handlers/mod.rs` (re-export admin module)

The 4 CRUD endpoints. Auth: existing JWT middleware + tenant scoping via `Claims.tenant_id`. Admin-only — reject if `Claims.role` is not "admin".

- [ ] **Step 1: Discover the AppError + Claims surface in identity**

Run:
```bash
grep -n 'pub struct Claims\|pub enum Claims' crates/signapps-common/src/*.rs services/signapps-identity/src/*.rs 2>&1 | head -5
grep -rn 'fn admin_required\|admin_only\|require_admin' services/signapps-identity/src/ 2>&1 | head -5
```

If there's an existing admin guard middleware (e.g., `admin_required`), use it. Otherwise we check `claims.role == "admin"` inline.

- [ ] **Step 2: Write the admin oauth_providers handlers**

Create `services/signapps-identity/src/handlers/admin/oauth_providers.rs`:

```rust
//! Admin CRUD endpoints for `identity.oauth_provider_configs`.
//!
//! All endpoints are tenant-scoped via `Claims.tenant_id` and require
//! `Claims.role == "admin"`.

use crate::AppState;
use axum::extract::{Path, State};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{AppError, Claims};
use signapps_oauth::{Catalog, ProviderCategory};
use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ProviderConfigSummary {
    pub provider_key: String,
    pub display_name: String,
    pub categories: Vec<ProviderCategory>,
    pub enabled: bool,
    pub purposes: Vec<String>,
    pub visibility: String,
    pub allow_user_override: bool,
    pub has_credentials: bool,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ProviderConfigDetail {
    pub id: Uuid,
    pub provider_key: String,
    pub display_name: String,
    pub categories: Vec<ProviderCategory>,
    pub enabled: bool,
    pub purposes: Vec<String>,
    pub allowed_scopes: Vec<String>,
    pub default_scopes: Vec<String>,
    pub visibility: String,
    pub visible_to_org_nodes: Vec<Uuid>,
    pub visible_to_groups: Vec<Uuid>,
    pub visible_to_roles: Vec<String>,
    pub visible_to_users: Vec<Uuid>,
    pub allow_user_override: bool,
    pub is_tenant_sso: bool,
    pub auto_provision_users: bool,
    pub default_role: Option<String>,
    pub has_credentials: bool,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertProviderConfigBody {
    pub enabled: Option<bool>,
    pub purposes: Option<Vec<String>>,
    pub allowed_scopes: Option<Vec<String>>,
    /// Plaintext credentials — encrypted server-side via signapps-keystore
    /// before the row is written. Pass `None` to leave existing credentials
    /// in place.
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    /// JSON map of extra params (e.g., `{"tenant": "common"}` for Microsoft).
    pub extra_params: Option<serde_json::Value>,
    pub visibility: Option<String>,
    pub visible_to_org_nodes: Option<Vec<Uuid>>,
    pub visible_to_groups: Option<Vec<Uuid>>,
    pub visible_to_roles: Option<Vec<String>>,
    pub visible_to_users: Option<Vec<Uuid>>,
    pub allow_user_override: Option<bool>,
    pub is_tenant_sso: Option<bool>,
    pub auto_provision_users: Option<bool>,
    pub default_role: Option<String>,
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/// GET /api/v1/admin/oauth-providers
///
/// Lists every provider in the embedded catalog, joined with this tenant's
/// `oauth_provider_configs` row (if any). Disabled and non-configured
/// providers are still listed so the admin can enable them.
#[instrument(skip(state, claims))]
pub async fn list_providers(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<ProviderConfigSummary>>, AppError> {
    require_admin(&claims)?;
    let tenant_id = claims.tenant_id.ok_or(AppError::Forbidden("no tenant".into()))?;
    let pool = state.pool.inner().clone();

    // Load every existing config row for the tenant
    let configs: Vec<ConfigRow> = sqlx::query_as(
        "SELECT provider_key, enabled, purposes, visibility, allow_user_override, \
                client_id_enc IS NOT NULL AS has_credentials, updated_at \
         FROM identity.oauth_provider_configs \
         WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| AppError::Internal(format!("query oauth_provider_configs: {e}")))?;

    // Index by key for fast lookup against the catalog
    let by_key: std::collections::HashMap<String, ConfigRow> =
        configs.into_iter().map(|c| (c.provider_key.clone(), c)).collect();

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
                visibility: cfg.map(|c| c.visibility.clone()).unwrap_or_else(|| "all".into()),
                allow_user_override: cfg.map(|c| c.allow_user_override).unwrap_or(false),
                has_credentials: cfg.map(|c| c.has_credentials).unwrap_or(false),
                updated_at: cfg.map(|c| c.updated_at).unwrap_or_else(Utc::now),
            }
        })
        .collect();

    Ok(Json(summaries))
}

/// GET /api/v1/admin/oauth-providers/:key
#[instrument(skip(state, claims))]
pub async fn get_provider(
    Path(provider_key): Path<String>,
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<ProviderConfigDetail>, AppError> {
    require_admin(&claims)?;
    let tenant_id = claims.tenant_id.ok_or(AppError::Forbidden("no tenant".into()))?;
    let pool = state.pool.inner().clone();

    let provider = state
        .oauth_engine_state
        .catalog
        .get(&provider_key)
        .map_err(|_| AppError::NotFound(format!("provider {provider_key:?} unknown")))?;

    let row: Option<DetailRow> = sqlx::query_as(
        "SELECT id, enabled, purposes, allowed_scopes, visibility, \
                visible_to_org_nodes, visible_to_groups, visible_to_roles, visible_to_users, \
                allow_user_override, is_tenant_sso, auto_provision_users, default_role, \
                client_id_enc IS NOT NULL AS has_credentials, updated_at \
         FROM identity.oauth_provider_configs \
         WHERE tenant_id = $1 AND provider_key = $2",
    )
    .bind(tenant_id)
    .bind(&provider_key)
    .fetch_optional(&pool)
    .await
    .map_err(|e| AppError::Internal(format!("query oauth_provider_configs: {e}")))?;

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
/// Upsert the config. Credentials are encrypted before write.
#[instrument(skip(state, claims, body))]
pub async fn upsert_provider(
    Path(provider_key): Path<String>,
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<UpsertProviderConfigBody>,
) -> Result<Json<ProviderConfigDetail>, AppError> {
    use signapps_common::crypto::EncryptedField;

    require_admin(&claims)?;
    let tenant_id = claims.tenant_id.ok_or(AppError::Forbidden("no tenant".into()))?;
    let pool = state.pool.inner().clone();

    // Encrypt new credentials if provided
    let dek = state.keystore.dek("oauth-tokens-v1");
    let client_id_enc = body
        .client_id
        .as_deref()
        .map(|s| <()>::encrypt(s.as_bytes(), &dek))
        .transpose()
        .map_err(|e| AppError::Internal(format!("encrypt client_id: {e}")))?;
    let client_secret_enc = body
        .client_secret
        .as_deref()
        .map(|s| <()>::encrypt(s.as_bytes(), &dek))
        .transpose()
        .map_err(|e| AppError::Internal(format!("encrypt client_secret: {e}")))?;
    let extra_params_enc = match body.extra_params.as_ref() {
        Some(v) => Some(
            <()>::encrypt(serde_json::to_string(v).unwrap_or_default().as_bytes(), &dek)
                .map_err(|e| AppError::Internal(format!("encrypt extra_params: {e}")))?,
        ),
        None => None,
    };

    // Upsert — only update fields the caller actually supplied (COALESCE pattern).
    sqlx::query(
        r#"
        INSERT INTO identity.oauth_provider_configs (
            tenant_id, provider_key,
            client_id_enc, client_secret_enc, extra_params_enc,
            enabled, purposes, allowed_scopes,
            visibility, visible_to_org_nodes, visible_to_groups, visible_to_roles, visible_to_users,
            allow_user_override, is_tenant_sso, auto_provision_users, default_role
        ) VALUES (
            $1, $2,
            $3, $4, $5,
            COALESCE($6, false), COALESCE($7, '{}'::TEXT[]), COALESCE($8, '{}'::TEXT[]),
            COALESCE($9, 'all'), COALESCE($10, '{}'::UUID[]), COALESCE($11, '{}'::UUID[]),
            COALESCE($12, '{}'::TEXT[]), COALESCE($13, '{}'::UUID[]),
            COALESCE($14, false), COALESCE($15, false), COALESCE($16, false), $17
        )
        ON CONFLICT (tenant_id, provider_key) DO UPDATE SET
            client_id_enc        = COALESCE(EXCLUDED.client_id_enc, identity.oauth_provider_configs.client_id_enc),
            client_secret_enc    = COALESCE(EXCLUDED.client_secret_enc, identity.oauth_provider_configs.client_secret_enc),
            extra_params_enc     = COALESCE(EXCLUDED.extra_params_enc, identity.oauth_provider_configs.extra_params_enc),
            enabled              = COALESCE($6, identity.oauth_provider_configs.enabled),
            purposes             = COALESCE($7, identity.oauth_provider_configs.purposes),
            allowed_scopes       = COALESCE($8, identity.oauth_provider_configs.allowed_scopes),
            visibility           = COALESCE($9, identity.oauth_provider_configs.visibility),
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
    .execute(&pool)
    .await
    .map_err(|e| AppError::Internal(format!("upsert oauth_provider_configs: {e}")))?;

    // Reload + return full detail
    get_provider(Path(provider_key), State(state), claims).await
}

/// DELETE /api/v1/admin/oauth-providers/:key
///
/// Soft-delete: enabled=false + drop credentials + drop org filters.
/// Existing OAuth-acquired tokens are NOT touched (still in mail.accounts
/// etc.) — admin can disable a provider while keeping the data.
#[instrument(skip(state, claims))]
pub async fn delete_provider(
    Path(provider_key): Path<String>,
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<serde_json::Value>, AppError> {
    require_admin(&claims)?;
    let tenant_id = claims.tenant_id.ok_or(AppError::Forbidden("no tenant".into()))?;
    let pool = state.pool.inner().clone();

    sqlx::query(
        "UPDATE identity.oauth_provider_configs SET \
            enabled = false, \
            client_id_enc = NULL, client_secret_enc = NULL, extra_params_enc = NULL, \
            updated_at = NOW() \
         WHERE tenant_id = $1 AND provider_key = $2",
    )
    .bind(tenant_id)
    .bind(&provider_key)
    .execute(&pool)
    .await
    .map_err(|e| AppError::Internal(format!("soft-delete oauth_provider_config: {e}")))?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn require_admin(claims: &Claims) -> Result<(), AppError> {
    // Adapt to the actual Claims struct — common patterns are `.role: String`,
    // `.roles: Vec<String>`, or a `.is_admin()` method.
    if claims.role.as_deref() == Some("admin") || claims.role.as_deref() == Some("super_admin") {
        Ok(())
    } else {
        Err(AppError::Forbidden("admin role required".into()))
    }
}

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
```

**Adapt notes:**
- `claims.tenant_id` and `claims.role` field names — verify against `signapps-common::Claims` and adapt. If the project uses a `roles: Vec<String>`, change `require_admin` accordingly.
- `signapps-common::AppError` variants — Plan 4 found `BadGateway` doesn't exist (used `ExternalService`). Adapt `Forbidden(String)`/`NotFound(String)` to whatever variants exist.

- [ ] **Step 3: Wire the routes**

In `services/signapps-identity/src/main.rs`, register on the JWT-protected admin router (look for existing `/api/v1/admin/...` routes for the pattern):

```rust
.route("/api/v1/admin/oauth-providers",       get(handlers::admin::oauth_providers::list_providers))
.route("/api/v1/admin/oauth-providers/:key",  get(handlers::admin::oauth_providers::get_provider))
.route("/api/v1/admin/oauth-providers/:key",  post(handlers::admin::oauth_providers::upsert_provider))
.route("/api/v1/admin/oauth-providers/:key",  delete(handlers::admin::oauth_providers::delete_provider))
```

In `services/signapps-identity/src/handlers/mod.rs`, add `pub mod admin;` if missing, and in `services/signapps-identity/src/handlers/admin/mod.rs`, add `pub mod oauth_providers;`.

- [ ] **Step 4: Build + commit**

Run: `cargo check -p signapps-identity 2>&1 | tail -10`
Expected: success.

```bash
rtk git add services/signapps-identity/
rtk git commit -m "$(cat <<'EOF'
feat(identity): admin CRUD endpoints for oauth_provider_configs

4 endpoints, all tenant-scoped + admin-only:

- GET    /api/v1/admin/oauth-providers      → list (catalog ∪ configs)
- GET    /api/v1/admin/oauth-providers/:key → full detail
- POST   /api/v1/admin/oauth-providers/:key → upsert (encrypt creds)
- DELETE /api/v1/admin/oauth-providers/:key → soft-delete (drop creds)

UpsertProviderConfigBody uses Option<...> + COALESCE so callers can
PATCH-style update single fields without overwriting others. Credentials
are encrypted via signapps-keystore (DEK 'oauth-tokens-v1') before
write — plaintext never persisted.

Soft-delete preserves OAuth-acquired tokens in mail.accounts etc. —
admin can disable a provider without losing user connections.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Backend test endpoint

**Files:**
- Modify: `services/signapps-identity/src/handlers/admin/oauth_providers.rs`
- Modify: `services/signapps-identity/src/main.rs`

`POST /api/v1/admin/oauth-providers/:key/test` — runs `EngineV2::start` with the supplied credentials and returns the `authorization_url` so the admin can manually click through. No data is persisted.

- [ ] **Step 1: Add the test handler**

Append to `oauth_providers.rs`:

```rust
#[derive(Debug, Deserialize)]
pub struct TestProviderBody {
    /// Test credentials — if absent, use the saved encrypted ones.
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub extra_params: Option<serde_json::Value>,
    pub purpose: signapps_oauth::OAuthPurpose,
    /// Where the admin's browser will be redirected after the OAuth dance.
    /// Default: `/admin/oauth-providers?test=1`.
    pub redirect_after: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TestProviderResponse {
    pub authorization_url: String,
    pub flow_id: Uuid,
    pub note: String,
}

#[instrument(skip(state, claims, body))]
pub async fn test_provider(
    Path(provider_key): Path<String>,
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<TestProviderBody>,
) -> Result<Json<TestProviderResponse>, AppError> {
    use signapps_oauth::{ResolvedCredentials, StartRequest};
    require_admin(&claims)?;
    let tenant_id = claims.tenant_id.ok_or(AppError::Forbidden("no tenant".into()))?;

    // If the caller supplied credentials, use them. Otherwise resolve from the
    // saved encrypted config (so admins can re-test without re-entering secrets).
    let creds = match (&body.client_id, &body.client_secret) {
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
            let cfg = state
                .oauth_engine_state
                .configs
                .get(tenant_id, &provider_key)
                .await
                .map_err(crate::handlers::oauth::error::oauth_error_to_app_error)?
                .ok_or(AppError::NotFound(
                    "no saved credentials and none supplied".into(),
                ))?;
            crate::handlers::oauth::creds::resolve_credentials(&cfg, &state.keystore)
                .map_err(crate::handlers::oauth::error::oauth_error_to_app_error)?
        }
    };

    let req = StartRequest {
        tenant_id,
        provider_key: provider_key.clone(),
        user_id: Some(claims.sub),
        purpose: body.purpose,
        redirect_after: body.redirect_after.or_else(|| Some("/admin/oauth-providers?test=1".into())),
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
```

- [ ] **Step 2: Register the route**

In `main.rs`:
```rust
.route("/api/v1/admin/oauth-providers/:key/test", post(handlers::admin::oauth_providers::test_provider))
```

- [ ] **Step 3: Build + commit**

```bash
cargo check -p signapps-identity 2>&1 | tail -5
rtk git add services/signapps-identity/
rtk git commit -m "feat(identity): POST /api/v1/admin/oauth-providers/:key/test

Builds and returns the authorize_url for an end-to-end smoke test
without persisting anything. Admins can use the supplied credentials
or test the saved ones (omit client_id/client_secret in the body).

Returns { authorization_url, flow_id, note } — the admin clicks the
URL to verify the flow lands at the configured redirect.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Backend stats + account connections endpoints

**Files:**
- Modify: `services/signapps-identity/src/handlers/admin/oauth_providers.rs` (add stats handler)
- Create: `services/signapps-identity/src/handlers/oauth/account_connections.rs`
- Modify: `services/signapps-identity/src/main.rs`

- [ ] **Step 1: Add stats handler in admin/oauth_providers.rs**

Append:

```rust
#[derive(Debug, Serialize)]
pub struct ProviderStats {
    pub provider_key: String,
    pub total_in_queue: i64,
    pub disabled: i64,
    pub warning_count: i64,
    pub last_disabled_at: Option<DateTime<Utc>>,
}

#[instrument(skip(state, claims))]
pub async fn provider_stats(
    Path(provider_key): Path<String>,
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<ProviderStats>, AppError> {
    require_admin(&claims)?;
    let tenant_id = claims.tenant_id.ok_or(AppError::Forbidden("no tenant".into()))?;
    let pool = state.pool.inner().clone();

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
    .fetch_one(&pool)
    .await
    .map_err(|e| AppError::Internal(format!("stats query: {e}")))?;

    Ok(Json(ProviderStats {
        provider_key,
        total_in_queue: row.0,
        disabled: row.1,
        warning_count: row.2,
        last_disabled_at: row.3,
    }))
}
```

Register: `.route("/api/v1/admin/oauth-providers/:key/stats", get(handlers::admin::oauth_providers::provider_stats))`.

- [ ] **Step 2: Account connections handler**

Create `services/signapps-identity/src/handlers/oauth/account_connections.rs`:

```rust
//! User-facing list of OAuth-connected accounts.

use crate::AppState;
use axum::extract::{Path, State};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::Serialize;
use signapps_common::{AppError, Claims};
use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct ConnectionRow {
    pub id: Uuid,
    pub source_table: String,
    pub provider_key: String,
    pub display_email: Option<String>,
    pub status: String, // "connected" | "needs_reconnect"
    pub expires_at: Option<DateTime<Utc>>,
    pub disabled: bool,
    pub last_error: Option<String>,
}

/// GET /api/v1/account/oauth-connections
///
/// Lists every (mail, calendar, social) row for the current user that
/// has refresh_token_enc set. Joins with oauth_refresh_queue to surface
/// disabled / failure state.
#[instrument(skip(state, claims))]
pub async fn list_connections(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<ConnectionRow>>, AppError> {
    let pool = state.pool.inner().clone();
    let mut out = vec![];

    // mail.accounts
    let mail: Vec<MailRow> = sqlx::query_as(
        "SELECT id, COALESCE(oauth_provider_key, '') AS provider, \
                email_address, oauth_expires_at \
         FROM mail.accounts \
         WHERE user_id = $1 AND oauth_refresh_token_enc IS NOT NULL",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await
    .map_err(|e| AppError::Internal(format!("mail.accounts query: {e}")))?;
    for r in mail {
        let q = lookup_queue_row(&pool, "mail.accounts", r.id).await;
        out.push(ConnectionRow {
            id: r.id,
            source_table: "mail.accounts".into(),
            provider_key: r.provider,
            display_email: Some(r.email_address),
            status: status_from_queue(&q),
            expires_at: r.oauth_expires_at,
            disabled: q.as_ref().map(|q| q.disabled).unwrap_or(false),
            last_error: q.as_ref().and_then(|q| q.last_error.clone()),
        });
    }

    // calendar.provider_connections
    let cal: Vec<CalRow> = sqlx::query_as(
        "SELECT id, provider, token_expires_at \
         FROM calendar.provider_connections \
         WHERE user_id = $1 AND refresh_token_enc IS NOT NULL",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await
    .map_err(|e| AppError::Internal(format!("calendar query: {e}")))?;
    for r in cal {
        let q = lookup_queue_row(&pool, "calendar.provider_connections", r.id).await;
        out.push(ConnectionRow {
            id: r.id,
            source_table: "calendar.provider_connections".into(),
            provider_key: r.provider,
            display_email: None,
            status: status_from_queue(&q),
            expires_at: r.token_expires_at,
            disabled: q.as_ref().map(|q| q.disabled).unwrap_or(false),
            last_error: q.as_ref().and_then(|q| q.last_error.clone()),
        });
    }

    // social.accounts
    let soc: Vec<SocRow> = sqlx::query_as(
        "SELECT id, platform, token_expires_at \
         FROM social.accounts \
         WHERE user_id = $1 AND refresh_token_enc IS NOT NULL",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await
    .map_err(|e| AppError::Internal(format!("social query: {e}")))?;
    for r in soc {
        let q = lookup_queue_row(&pool, "social.accounts", r.id).await;
        out.push(ConnectionRow {
            id: r.id,
            source_table: "social.accounts".into(),
            provider_key: r.platform,
            display_email: None,
            status: status_from_queue(&q),
            expires_at: r.token_expires_at,
            disabled: q.as_ref().map(|q| q.disabled).unwrap_or(false),
            last_error: q.as_ref().and_then(|q| q.last_error.clone()),
        });
    }

    Ok(Json(out))
}

/// POST /api/v1/account/oauth-connections/:source_table/:id/disconnect
///
/// Drops the encrypted tokens. The user can re-OAuth to reconnect.
#[instrument(skip(state, claims))]
pub async fn disconnect(
    Path((source_table, id)): Path<(String, Uuid)>,
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<serde_json::Value>, AppError> {
    let pool = state.pool.inner().clone();
    let sql = match source_table.as_str() {
        "mail.accounts" => {
            "UPDATE mail.accounts SET oauth_access_token_enc = NULL, oauth_refresh_token_enc = NULL, \
                                       oauth_expires_at = NULL, oauth_provider_key = NULL, \
                                       updated_at = NOW() WHERE id = $1 AND user_id = $2"
        }
        "calendar.provider_connections" => {
            "UPDATE calendar.provider_connections SET access_token_enc = NULL, refresh_token_enc = NULL, \
                                                       token_expires_at = NULL, updated_at = NOW() \
             WHERE id = $1 AND user_id = $2"
        }
        "social.accounts" => {
            "UPDATE social.accounts SET access_token_enc = NULL, refresh_token_enc = NULL, \
                                         token_expires_at = NULL, updated_at = NOW() \
             WHERE id = $1 AND user_id = $2"
        }
        _ => return Err(AppError::BadRequest(format!("unknown source_table: {source_table}"))),
    };
    sqlx::query(sql)
        .bind(id)
        .bind(claims.sub)
        .execute(&pool)
        .await
        .map_err(|e| AppError::Internal(format!("disconnect: {e}")))?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Helpers ──────────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct MailRow {
    id: Uuid,
    provider: String,
    email_address: String,
    oauth_expires_at: Option<DateTime<Utc>>,
}

#[derive(sqlx::FromRow)]
struct CalRow {
    id: Uuid,
    provider: String,
    token_expires_at: Option<DateTime<Utc>>,
}

#[derive(sqlx::FromRow)]
struct SocRow {
    id: Uuid,
    platform: String,
    token_expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug)]
struct QueueState {
    disabled: bool,
    last_error: Option<String>,
}

async fn lookup_queue_row(pool: &PgPool, source_table: &str, source_id: Uuid) -> Option<QueueState> {
    sqlx::query_as::<_, (bool, Option<String>)>(
        "SELECT disabled, last_error FROM identity.oauth_refresh_queue \
         WHERE source_table = $1 AND source_id = $2",
    )
    .bind(source_table)
    .bind(source_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(disabled, last_error)| QueueState { disabled, last_error })
}

fn status_from_queue(q: &Option<QueueState>) -> String {
    match q {
        Some(q) if q.disabled => "needs_reconnect".into(),
        _ => "connected".into(),
    }
}
```

- [ ] **Step 3: Wire routes + commit**

In `main.rs`:
```rust
.route("/api/v1/account/oauth-connections", get(handlers::oauth::account_connections::list_connections))
.route("/api/v1/account/oauth-connections/:source_table/:id/disconnect",
       post(handlers::oauth::account_connections::disconnect))
```

In `services/signapps-identity/src/handlers/oauth/mod.rs`, add `pub mod account_connections;`.

```bash
cargo check -p signapps-identity 2>&1 | tail -10
rtk git add services/signapps-identity/
rtk git commit -m "feat(identity): provider stats + user account connections endpoints

GET /api/v1/admin/oauth-providers/:key/stats
- Returns per-provider counts from identity.oauth_refresh_queue:
  total_in_queue, disabled, warning_count (3-9 failures), last_disabled_at

GET /api/v1/account/oauth-connections (user)
- Lists every mail.accounts / calendar.provider_connections /
  social.accounts row for the user that has a refresh_token_enc.
- Joins with oauth_refresh_queue to surface 'connected' vs
  'needs_reconnect' status + last_error if present.

POST /api/v1/account/oauth-connections/:source_table/:id/disconnect
- Drops the encrypted tokens. User must re-OAuth to reconnect.
- Tenant scoping via WHERE user_id = claims.sub.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Frontend types + API client

**Files:**
- Create: `client/src/types/oauth-providers.ts`
- Create: `client/src/lib/api/oauth-providers.ts`
- Create: `client/src/lib/api/account-connections.ts`

- [ ] **Step 1: Discover existing API client patterns**

Run: `head -40 client/src/lib/api/ai.ts` (or any existing API client file).
Note the imports — `axiosInstance`, base URL, JWT handling, `Promise<T>` return shapes.

- [ ] **Step 2: TypeScript types**

```typescript
// client/src/types/oauth-providers.ts

export type ProviderCategory =
  | "Mail" | "Calendar" | "Drive" | "Social" | "Sso"
  | "Chat" | "Dev" | "Crm" | "Other";

export type OAuthPurpose = "login" | "integration";

export interface ProviderConfigSummary {
  provider_key: string;
  display_name: string;
  categories: ProviderCategory[];
  enabled: boolean;
  purposes: string[];
  visibility: "all" | "restricted";
  allow_user_override: boolean;
  has_credentials: boolean;
  updated_at: string;
}

export interface ProviderConfigDetail {
  id: string;
  provider_key: string;
  display_name: string;
  categories: ProviderCategory[];
  enabled: boolean;
  purposes: string[];
  allowed_scopes: string[];
  default_scopes: string[];
  visibility: "all" | "restricted";
  visible_to_org_nodes: string[];
  visible_to_groups: string[];
  visible_to_roles: string[];
  visible_to_users: string[];
  allow_user_override: boolean;
  is_tenant_sso: boolean;
  auto_provision_users: boolean;
  default_role: string | null;
  has_credentials: boolean;
  updated_at: string;
}

export interface UpsertProviderConfigBody {
  enabled?: boolean;
  purposes?: string[];
  allowed_scopes?: string[];
  client_id?: string;
  client_secret?: string;
  extra_params?: Record<string, unknown>;
  visibility?: "all" | "restricted";
  visible_to_org_nodes?: string[];
  visible_to_groups?: string[];
  visible_to_roles?: string[];
  visible_to_users?: string[];
  allow_user_override?: boolean;
  is_tenant_sso?: boolean;
  auto_provision_users?: boolean;
  default_role?: string | null;
}

export interface TestProviderResponse {
  authorization_url: string;
  flow_id: string;
  note: string;
}

export interface ProviderStats {
  provider_key: string;
  total_in_queue: number;
  disabled: number;
  warning_count: number;
  last_disabled_at: string | null;
}
```

- [ ] **Step 3: Admin API client**

```typescript
// client/src/lib/api/oauth-providers.ts
import { axiosInstance } from "@/lib/axios"; // adapt to actual import path
import type {
  ProviderConfigSummary, ProviderConfigDetail, UpsertProviderConfigBody,
  TestProviderResponse, ProviderStats, OAuthPurpose,
} from "@/types/oauth-providers";

const BASE = "/api/v1/admin/oauth-providers";

export async function listProviders(): Promise<ProviderConfigSummary[]> {
  const r = await axiosInstance.get<ProviderConfigSummary[]>(BASE);
  return r.data;
}

export async function getProvider(key: string): Promise<ProviderConfigDetail> {
  const r = await axiosInstance.get<ProviderConfigDetail>(`${BASE}/${encodeURIComponent(key)}`);
  return r.data;
}

export async function upsertProvider(
  key: string,
  body: UpsertProviderConfigBody,
): Promise<ProviderConfigDetail> {
  const r = await axiosInstance.post<ProviderConfigDetail>(
    `${BASE}/${encodeURIComponent(key)}`,
    body,
  );
  return r.data;
}

export async function deleteProvider(key: string): Promise<void> {
  await axiosInstance.delete(`${BASE}/${encodeURIComponent(key)}`);
}

export async function testProvider(
  key: string,
  body: { client_id?: string; client_secret?: string; purpose: OAuthPurpose; redirect_after?: string },
): Promise<TestProviderResponse> {
  const r = await axiosInstance.post<TestProviderResponse>(
    `${BASE}/${encodeURIComponent(key)}/test`,
    body,
  );
  return r.data;
}

export async function getProviderStats(key: string): Promise<ProviderStats> {
  const r = await axiosInstance.get<ProviderStats>(
    `${BASE}/${encodeURIComponent(key)}/stats`,
  );
  return r.data;
}
```

- [ ] **Step 4: Account connections API client**

```typescript
// client/src/lib/api/account-connections.ts
import { axiosInstance } from "@/lib/axios";

export interface AccountConnection {
  id: string;
  source_table: "mail.accounts" | "calendar.provider_connections" | "social.accounts";
  provider_key: string;
  display_email: string | null;
  status: "connected" | "needs_reconnect";
  expires_at: string | null;
  disabled: boolean;
  last_error: string | null;
}

export async function listConnections(): Promise<AccountConnection[]> {
  const r = await axiosInstance.get<AccountConnection[]>("/api/v1/account/oauth-connections");
  return r.data;
}

export async function disconnect(sourceTable: string, id: string): Promise<void> {
  await axiosInstance.post(
    `/api/v1/account/oauth-connections/${encodeURIComponent(sourceTable)}/${id}/disconnect`,
  );
}
```

**Adapt notes:** `@/lib/axios` is a guess — find the actual axios instance in `client/src/lib/`. Could be `@/lib/api/client.ts`, `@/lib/http.ts`, etc.

- [ ] **Step 5: Type-check + commit**

Run from `client/`: `npx tsc --noEmit 2>&1 | tail -10`

If there are import errors for `@/lib/axios`, find the real path.

```bash
rtk git add client/src/types/oauth-providers.ts client/src/lib/api/oauth-providers.ts client/src/lib/api/account-connections.ts
rtk git commit -m "feat(client): OAuth provider TypeScript types + API clients

types/oauth-providers.ts mirrors the backend Serde types:
- ProviderConfigSummary, ProviderConfigDetail
- UpsertProviderConfigBody (Option<...> in Rust → optional in TS)
- TestProviderResponse, ProviderStats
- ProviderCategory, OAuthPurpose enums

lib/api/oauth-providers.ts wraps the 6 admin endpoints
(list, get, upsert, delete, test, stats) with axios.

lib/api/account-connections.ts wraps user-facing list + disconnect.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Frontend admin page + ProviderCard

**Files:**
- Create: `client/src/app/admin/oauth-providers/page.tsx`
- Create: `client/src/components/admin/oauth/ProviderCard.tsx`

The list view: filter by category, search, status. No drawer yet.

- [ ] **Step 1: ProviderCard component**

```tsx
// client/src/components/admin/oauth/ProviderCard.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProviderConfigSummary } from "@/types/oauth-providers";

interface Props {
  provider: ProviderConfigSummary;
  onConfigure: (key: string) => void;
}

export function ProviderCard({ provider, onConfigure }: Props) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-foreground">
              {provider.display_name}
            </CardTitle>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {provider.categories.map((c) => (
                <Badge key={c} variant="outline" className="text-xs">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
          <StatusPill provider={provider} />
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="space-y-0.5">
          <div>
            {provider.enabled ? "Activé" : "Non configuré"}
            {provider.has_credentials ? " · credentials OK" : ""}
          </div>
          {provider.purposes.length > 0 && (
            <div className="text-xs">
              Usages : {provider.purposes.join(", ")}
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onConfigure(provider.provider_key)}
        >
          Configurer
        </Button>
      </CardContent>
    </Card>
  );
}

function StatusPill({ provider }: { provider: ProviderConfigSummary }) {
  if (!provider.enabled) {
    return <span className="text-xs text-muted-foreground">⚪ Inactif</span>;
  }
  if (!provider.has_credentials) {
    return <span className="text-xs text-yellow-500">🟡 Sans credentials</span>;
  }
  return <span className="text-xs text-green-500">🟢 Activé</span>;
}
```

- [ ] **Step 2: List page**

```tsx
// client/src/app/admin/oauth-providers/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ProviderCard } from "@/components/admin/oauth/ProviderCard";
import { listProviders } from "@/lib/api/oauth-providers";
import type { ProviderConfigSummary, ProviderCategory } from "@/types/oauth-providers";

const CATEGORIES: (ProviderCategory | "All")[] = [
  "All", "Mail", "Calendar", "Drive", "Social", "Sso", "Chat", "Dev", "Crm",
];

export default function OAuthProvidersPage() {
  const [providers, setProviders] = useState<ProviderConfigSummary[] | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProviderCategory | "All">("All");

  useEffect(() => {
    let cancelled = false;
    listProviders()
      .then((data) => { if (!cancelled) setProviders(data); })
      .catch((err) => { console.error("listProviders failed", err); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!providers) return [];
    return providers.filter((p) => {
      if (category !== "All" && !p.categories.includes(category)) return false;
      if (search && !p.display_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [providers, search, category]);

  // Group by primary category for the list view
  const grouped = useMemo(() => {
    const groups = new Map<ProviderCategory, ProviderConfigSummary[]>();
    for (const p of filtered) {
      const primary = p.categories[0] ?? "Other" as ProviderCategory;
      if (!groups.has(primary)) groups.set(primary, []);
      groups.get(primary)!.push(p);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 space-y-3">
        <h1 className="text-2xl font-semibold text-foreground">OAuth Providers</h1>
        <p className="text-sm text-muted-foreground">
          Configurez les fournisseurs OAuth disponibles pour votre tenant.
          Activez, fournissez les credentials, et restreignez la visibilité par
          département, groupe ou rôle.
        </p>
        <div className="flex gap-3">
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ProviderCategory | "All")}
            className="rounded-md border border-border bg-background px-3 py-1 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {providers === null ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : grouped.length === 0 ? (
        <p className="text-muted-foreground">Aucun provider ne correspond.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, list]) => (
            <section key={cat}>
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {cat} ({list.length})
              </h2>
              <div className="grid gap-2">
                {list.map((p) => (
                  <ProviderCard
                    key={p.provider_key}
                    provider={p}
                    onConfigure={(key) => {
                      // Placeholder — drawer wired in Task 6
                      console.info("configure", key);
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check + commit**

```bash
cd client && npx tsc --noEmit 2>&1 | tail -10
cd ..

rtk git add client/
rtk git commit -m "feat(client): /admin/oauth-providers list page + ProviderCard

Page features:
- Filter by category dropdown (Mail/Calendar/Drive/...)
- Search by display name
- Grouped by primary category for visual scanning
- ProviderCard: 3-state status pill (Inactif / Sans credentials / Activé),
  category badges, enabled/purposes summary, [Configurer] action

Drawer wired in next task. The console.info('configure', key) placeholder
will be replaced with the real handler.

Tailwind 4 semantic tokens (bg-card, text-foreground, border-border)
used throughout. shadcn/ui Card, Badge, Button, Input.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: ProviderConfigDrawer + 3 tabs (General / Credentials / Visibility)

**Files:**
- Create: `client/src/components/admin/oauth/ProviderConfigDrawer.tsx`
- Create: `client/src/components/admin/oauth/tabs/GeneralTab.tsx`
- Create: `client/src/components/admin/oauth/tabs/CredentialsTab.tsx`
- Create: `client/src/components/admin/oauth/tabs/VisibilityTab.tsx`
- Modify: `client/src/app/admin/oauth-providers/page.tsx` (wire drawer)

- [ ] **Step 1: Drawer scaffold**

```tsx
// client/src/components/admin/oauth/ProviderConfigDrawer.tsx
"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GeneralTab } from "./tabs/GeneralTab";
import { CredentialsTab } from "./tabs/CredentialsTab";
import { VisibilityTab } from "./tabs/VisibilityTab";
import { getProvider, upsertProvider } from "@/lib/api/oauth-providers";
import type { ProviderConfigDetail, UpsertProviderConfigBody } from "@/types/oauth-providers";

interface Props {
  providerKey: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function ProviderConfigDrawer({ providerKey, onClose, onUpdated }: Props) {
  const [detail, setDetail] = useState<ProviderConfigDetail | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!providerKey) {
      setDetail(null);
      return;
    }
    getProvider(providerKey)
      .then((d) => setDetail(d))
      .catch((err) => console.error("getProvider failed", err));
  }, [providerKey]);

  const save = async (patch: UpsertProviderConfigBody) => {
    if (!providerKey) return;
    setSaving(true);
    try {
      const fresh = await upsertProvider(providerKey, patch);
      setDetail(fresh);
      onUpdated();
    } catch (e) {
      console.error("upsertProvider failed", e);
      alert("Échec de la sauvegarde — voir console.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={!!providerKey} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="bg-card text-foreground sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{detail?.display_name ?? providerKey}</SheetTitle>
        </SheetHeader>

        {detail ? (
          <Tabs defaultValue="general" className="mt-4">
            <TabsList>
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="credentials">Credentials</TabsTrigger>
              <TabsTrigger value="visibility">Visibilité</TabsTrigger>
            </TabsList>
            <TabsContent value="general">
              <GeneralTab detail={detail} saving={saving} onSave={save} />
            </TabsContent>
            <TabsContent value="credentials">
              <CredentialsTab detail={detail} saving={saving} onSave={save} />
            </TabsContent>
            <TabsContent value="visibility">
              <VisibilityTab detail={detail} saving={saving} onSave={save} />
            </TabsContent>
          </Tabs>
        ) : (
          <p className="mt-6 text-muted-foreground">Chargement...</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: GeneralTab**

```tsx
// client/src/components/admin/oauth/tabs/GeneralTab.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { ProviderConfigDetail, UpsertProviderConfigBody } from "@/types/oauth-providers";

interface Props {
  detail: ProviderConfigDetail;
  saving: boolean;
  onSave: (patch: UpsertProviderConfigBody) => void;
}

export function GeneralTab({ detail, saving, onSave }: Props) {
  const [enabled, setEnabled] = useState(detail.enabled);
  const [loginAllowed, setLoginAllowed] = useState(detail.purposes.includes("login"));
  const [integrationAllowed, setIntegrationAllowed] = useState(detail.purposes.includes("integration"));
  const [allowUserOverride, setAllowUserOverride] = useState(detail.allow_user_override);

  const submit = () => {
    const purposes: string[] = [];
    if (loginAllowed) purposes.push("login");
    if (integrationAllowed) purposes.push("integration");
    onSave({ enabled, purposes, allow_user_override: allowUserOverride });
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="enabled">Activé pour ce tenant</Label>
        <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="space-y-2">
        <Label>Usages autorisés</Label>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Connexion (login)</span>
          <Switch checked={loginAllowed} onCheckedChange={setLoginAllowed} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Intégration (mail, calendrier, drive)</span>
          <Switch checked={integrationAllowed} onCheckedChange={setIntegrationAllowed} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="userOverride">Permettre aux utilisateurs leurs propres credentials</Label>
        <Switch id="userOverride" checked={allowUserOverride} onCheckedChange={setAllowUserOverride} />
      </div>

      <Button onClick={submit} disabled={saving}>
        {saving ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: CredentialsTab**

```tsx
// client/src/components/admin/oauth/tabs/CredentialsTab.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { testProvider } from "@/lib/api/oauth-providers";
import type { ProviderConfigDetail, UpsertProviderConfigBody } from "@/types/oauth-providers";

interface Props {
  detail: ProviderConfigDetail;
  saving: boolean;
  onSave: (patch: UpsertProviderConfigBody) => void;
}

export function CredentialsTab({ detail, saving, onSave }: Props) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [testing, setTesting] = useState(false);

  const submit = () => {
    const body: UpsertProviderConfigBody = {};
    if (clientId) body.client_id = clientId;
    if (clientSecret) body.client_secret = clientSecret;
    if (Object.keys(body).length === 0) {
      alert("Renseignez au moins un champ pour mettre à jour les credentials.");
      return;
    }
    onSave(body);
    setClientId("");
    setClientSecret("");
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await testProvider(detail.provider_key, {
        client_id: clientId || undefined,
        client_secret: clientSecret || undefined,
        purpose: detail.purposes[0] === "login" ? "login" : "integration",
      });
      window.open(r.authorization_url, "_blank");
    } catch (e) {
      console.error("test failed", e);
      alert("Test échoué — voir console.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        {detail.has_credentials
          ? "Credentials enregistrés (chiffrés). Renseignez ci-dessous pour les remplacer."
          : "Aucun credential enregistré. Renseignez les valeurs fournies par le provider."}
      </p>

      <div className="space-y-2">
        <Label htmlFor="cid">Client ID</Label>
        <Input
          id="cid"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder={detail.has_credentials ? "(masqué)" : ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="csec">Client Secret</Label>
        <Input
          id="csec"
          type="password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder={detail.has_credentials ? "(masqué)" : ""}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={submit} disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
        <Button variant="outline" onClick={test} disabled={testing || !detail.has_credentials && !clientId}>
          {testing ? "Test en cours..." : "Tester la connexion"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: VisibilityTab (simplified — full picker comes Task 7)**

```tsx
// client/src/components/admin/oauth/tabs/VisibilityTab.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ProviderConfigDetail, UpsertProviderConfigBody } from "@/types/oauth-providers";

interface Props {
  detail: ProviderConfigDetail;
  saving: boolean;
  onSave: (patch: UpsertProviderConfigBody) => void;
}

export function VisibilityTab({ detail, saving, onSave }: Props) {
  const [visibility, setVisibility] = useState<"all" | "restricted">(detail.visibility);
  const [rolesText, setRolesText] = useState(detail.visible_to_roles.join(", "));

  const submit = () => {
    const patch: UpsertProviderConfigBody = { visibility };
    if (visibility === "restricted") {
      patch.visible_to_roles = rolesText.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      patch.visible_to_roles = [];
    }
    onSave(patch);
  };

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        Choisissez si tous les utilisateurs voient ce provider, ou restreignez
        l'accès à des rôles spécifiques.
      </p>

      <div className="space-y-2">
        <Label>Visibilité</Label>
        <div className="flex gap-2">
          <Button
            variant={visibility === "all" ? "default" : "outline"}
            onClick={() => setVisibility("all")}
            size="sm"
          >
            Tous
          </Button>
          <Button
            variant={visibility === "restricted" ? "default" : "outline"}
            onClick={() => setVisibility("restricted")}
            size="sm"
          >
            Restreint
          </Button>
        </div>
      </div>

      {visibility === "restricted" && (
        <div className="space-y-2">
          <Label htmlFor="roles">Rôles autorisés (séparés par virgules)</Label>
          <Input
            id="roles"
            value={rolesText}
            onChange={(e) => setRolesText(e.target.value)}
            placeholder="admin, manager"
          />
          <p className="text-xs text-muted-foreground">
            Pour la sélection avancée (org_nodes, groupes, users nominaux),
            voir le composant complet VisibilityPicker (Task 7).
          </p>
        </div>
      )}

      <Button onClick={submit} disabled={saving}>
        {saving ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Wire drawer into the page**

In `client/src/app/admin/oauth-providers/page.tsx`, replace the placeholder `console.info` with state to open the drawer:

```tsx
import { ProviderConfigDrawer } from "@/components/admin/oauth/ProviderConfigDrawer";
// ...

const [drawerKey, setDrawerKey] = useState<string | null>(null);

// In ProviderCard onConfigure:
onConfigure={(key) => setDrawerKey(key)}

// At end of return:
<ProviderConfigDrawer
  providerKey={drawerKey}
  onClose={() => setDrawerKey(null)}
  onUpdated={() => {
    // Reload list after a save
    listProviders().then(setProviders).catch(console.error);
  }}
/>
```

- [ ] **Step 6: Type-check + commit**

```bash
cd client && npx tsc --noEmit 2>&1 | tail -10
cd ..

rtk git add client/
rtk git commit -m "feat(client): ProviderConfigDrawer with 3 tabs (General/Credentials/Visibility)

Drawer opens when admin clicks [Configurer] on a ProviderCard. Loads
full ProviderConfigDetail from the backend, then renders 3 tabs:

- GeneralTab: enabled toggle, login/integration purpose toggles,
  allow_user_override toggle
- CredentialsTab: client_id + client_secret entry. Empty fields keep
  existing values. [Tester la connexion] opens the authorize_url
  returned by POST /test in a new tab.
- VisibilityTab (MVP): all/restricted toggle + comma-separated role
  list. Full picker with org_nodes/groups/users follows in Task 7.

Drawer auto-reloads the list page on successful save. Uses shadcn/ui
Sheet, Tabs, Button, Switch, Input, Label.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: VisibilityPicker reusable component

**Files:**
- Create: `client/src/components/shared/VisibilityPicker.tsx`
- Modify: `client/src/components/admin/oauth/tabs/VisibilityTab.tsx`

A reusable picker for selecting (org_nodes, groups, roles, users). Will be used by other admin features later (GPO policies, content perms, etc.).

For MVP, the picker uses simple multi-select boxes. A future iteration adds search-as-you-type from the orgs API.

- [ ] **Step 1: Build the picker**

```tsx
// client/src/components/shared/VisibilityPicker.tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface VisibilitySelection {
  org_nodes: string[];
  groups: string[];
  roles: string[];
  users: string[];
}

interface Props {
  value: VisibilitySelection;
  onChange: (next: VisibilitySelection) => void;
}

/**
 * Reusable picker for org-aware visibility (org_nodes, groups, roles, users).
 *
 * MVP version: each list is a comma-separated input + a list of badges showing
 * what's selected. A future iteration adds search-as-you-type from /api/v1/org/...
 * endpoints — the API surface stays the same so callers don't change.
 */
export function VisibilityPicker({ value, onChange }: Props) {
  const update = (k: keyof VisibilitySelection, items: string[]) =>
    onChange({ ...value, [k]: items });

  return (
    <div className="space-y-4">
      <ListInput
        label="Filières / Départements (UUIDs des org_nodes)"
        items={value.org_nodes}
        onChange={(items) => update("org_nodes", items)}
        placeholder="d290f1ee-6c54-4b01-90e6-d701748f0851, ..."
      />
      <ListInput
        label="Groupes transverses (UUIDs)"
        items={value.groups}
        onChange={(items) => update("groups", items)}
        placeholder="UUID, UUID, ..."
      />
      <ListInput
        label="Rôles"
        items={value.roles}
        onChange={(items) => update("roles", items)}
        placeholder="admin, manager"
      />
      <ListInput
        label="Utilisateurs nominaux (UUIDs — override prioritaire)"
        items={value.users}
        onChange={(items) => update("users", items)}
        placeholder="UUID, UUID, ..."
      />
    </div>
  );
}

function ListInput({
  label, items, onChange, placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");

  const add = () => {
    const additions = text.split(",").map((s) => s.trim()).filter(Boolean);
    if (additions.length === 0) return;
    const merged = Array.from(new Set([...items, ...additions]));
    onChange(merged);
    setText("");
  };

  const remove = (item: string) => onChange(items.filter((i) => i !== item));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>+</Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map((i) => (
            <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => remove(i)}>
              {i} ✕
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into VisibilityTab**

Replace the simplified VisibilityTab body with the full picker:

```tsx
// client/src/components/admin/oauth/tabs/VisibilityTab.tsx (replace previous)
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VisibilityPicker, type VisibilitySelection } from "@/components/shared/VisibilityPicker";
import type { ProviderConfigDetail, UpsertProviderConfigBody } from "@/types/oauth-providers";

interface Props {
  detail: ProviderConfigDetail;
  saving: boolean;
  onSave: (patch: UpsertProviderConfigBody) => void;
}

export function VisibilityTab({ detail, saving, onSave }: Props) {
  const [visibility, setVisibility] = useState<"all" | "restricted">(detail.visibility);
  const [selection, setSelection] = useState<VisibilitySelection>({
    org_nodes: detail.visible_to_org_nodes,
    groups: detail.visible_to_groups,
    roles: detail.visible_to_roles,
    users: detail.visible_to_users,
  });

  const submit = () => {
    const patch: UpsertProviderConfigBody = { visibility };
    if (visibility === "restricted") {
      patch.visible_to_org_nodes = selection.org_nodes;
      patch.visible_to_groups = selection.groups;
      patch.visible_to_roles = selection.roles;
      patch.visible_to_users = selection.users;
    } else {
      patch.visible_to_org_nodes = [];
      patch.visible_to_groups = [];
      patch.visible_to_roles = [];
      patch.visible_to_users = [];
    }
    onSave(patch);
  };

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        Choisissez si tous les utilisateurs voient ce provider, ou restreignez
        l'accès. Visibilité = OR entre (org_nodes ∪ groupes ∪ rôles). Les
        utilisateurs nominaux sont une whitelist prioritaire.
      </p>

      <div className="space-y-2">
        <Label>Visibilité</Label>
        <div className="flex gap-2">
          <Button
            variant={visibility === "all" ? "default" : "outline"}
            onClick={() => setVisibility("all")}
            size="sm"
          >
            Tous
          </Button>
          <Button
            variant={visibility === "restricted" ? "default" : "outline"}
            onClick={() => setVisibility("restricted")}
            size="sm"
          >
            Restreint
          </Button>
        </div>
      </div>

      {visibility === "restricted" && (
        <VisibilityPicker value={selection} onChange={setSelection} />
      )}

      <Button onClick={submit} disabled={saving}>
        {saving ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Type-check + commit**

```bash
cd client && npx tsc --noEmit 2>&1 | tail -10
cd ..

rtk git add client/
rtk git commit -m "feat(client): reusable VisibilityPicker + full VisibilityTab

shared/VisibilityPicker.tsx — reusable for org_nodes / groups / roles /
users selection. MVP shows comma-separated input + badge list (Enter
to add, click badge to remove). Future iteration adds search-as-you-type
from /api/v1/org/* endpoints — API surface stays the same.

VisibilityTab now uses the picker when 'restricted'. Sends 4 lists
in the patch body; backend ScopeResolver evaluates as OR between
org_nodes/groups/roles, with users as nominal-override whitelist.

Will be reused by future admin features (GPO policies, content perms).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: User /account/connections page

**Files:**
- Create: `client/src/app/account/connections/page.tsx`
- Create: `client/src/components/account/ConnectionCard.tsx`

- [ ] **Step 1: ConnectionCard**

```tsx
// client/src/components/account/ConnectionCard.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AccountConnection } from "@/lib/api/account-connections";

interface Props {
  conn: AccountConnection;
  onDisconnect: (sourceTable: string, id: string) => void;
}

export function ConnectionCard({ conn, onDisconnect }: Props) {
  const isHealthy = conn.status === "connected" && !conn.disabled;
  return (
    <Card className="bg-card border-border">
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span>{conn.provider_key}</span>
            <Badge variant="outline" className="text-xs">
              {conn.source_table.split(".")[0]}
            </Badge>
          </div>
          {conn.display_email && (
            <div className="text-xs text-muted-foreground">{conn.display_email}</div>
          )}
          <div className="text-xs">
            {isHealthy ? (
              <span className="text-green-500">🟢 Connecté</span>
            ) : (
              <span className="text-red-500">🔴 Reconnexion requise{conn.last_error ? ` — ${conn.last_error}` : ""}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!isHealthy && (
            <Button
              size="sm"
              onClick={() => {
                // Reconnect by initiating a fresh OAuth flow
                window.location.href = `/api/v1/oauth/${conn.provider_key}/start?integration=1`;
              }}
            >
              Reconnecter
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDisconnect(conn.source_table, conn.id)}
          >
            Déconnecter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Page**

```tsx
// client/src/app/account/connections/page.tsx
"use client";

import { useEffect, useState } from "react";
import { ConnectionCard } from "@/components/account/ConnectionCard";
import { listConnections, disconnect, type AccountConnection } from "@/lib/api/account-connections";

export default function AccountConnectionsPage() {
  const [conns, setConns] = useState<AccountConnection[] | null>(null);

  const reload = () => {
    listConnections().then(setConns).catch((e) => {
      console.error("listConnections failed", e);
      setConns([]);
    });
  };

  useEffect(reload, []);

  const handleDisconnect = async (sourceTable: string, id: string) => {
    if (!confirm("Confirmer la déconnexion ?")) return;
    try {
      await disconnect(sourceTable, id);
      reload();
    } catch (e) {
      console.error("disconnect failed", e);
      alert("Échec de la déconnexion.");
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold text-foreground">Mes connexions</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Comptes externes connectés à votre profil. Reconnectez celles qui ont
        perdu l'autorisation, ou déconnectez celles que vous n'utilisez plus.
      </p>

      <div className="mt-6 space-y-2">
        {conns === null ? (
          <p className="text-muted-foreground">Chargement...</p>
        ) : conns.length === 0 ? (
          <p className="text-muted-foreground">
            Vous n'avez aucune connexion OAuth active. Contactez votre admin
            pour activer un provider, ou rendez-vous sur la page mail / calendrier
            pour ajouter un compte.
          </p>
        ) : (
          conns.map((c) => (
            <ConnectionCard key={`${c.source_table}-${c.id}`} conn={c} onDisconnect={handleDisconnect} />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check + commit**

```bash
cd client && npx tsc --noEmit 2>&1 | tail -10
cd ..

rtk git add client/
rtk git commit -m "feat(client): /account/connections user page + ConnectionCard

Lists every OAuth connection for the current user (mail, calendar,
social) joined with refresh queue state. Status pill shows green
(Connecté) or red (Reconnexion requise) with last_error hint.

ConnectionCard actions:
- Reconnecter (only when not healthy) — kicks off a fresh OAuth flow
  via /api/v1/oauth/:provider/start
- Déconnecter — confirm dialog, then POST /disconnect

Empty state suggests where to go to add a connection (mail / calendar
pages) since the admin must enable a provider first.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Final validation

**Files:** None (verification only).

- [ ] **Step 1: Backend — cargo check + clippy + tests**

```bash
cargo check -p signapps-identity 2>&1 | tail -5
cargo clippy -p signapps-identity --tests -- -D warnings 2>&1 | tail -10
cargo test -p signapps-identity 2>&1 | tail -10
```

Expect: identity check + clippy clean (only pre-existing handler debt, no new warnings from Plan 6 code).

- [ ] **Step 2: Frontend — type check + lint**

```bash
cd client
npx tsc --noEmit 2>&1 | tail -15
npm run lint 2>&1 | tail -10  # or eslint if no script
cd ..
```

Expect: 0 type errors in new files. Lint may have pre-existing warnings — flag any NEW ones from Plan 6 files.

- [ ] **Step 3: Frontend — production build smoke test**

```bash
cd client
npm run build 2>&1 | tail -15
cd ..
```

Expect: build succeeds. Some pre-existing pages may fail — check if any new error originates from oauth-providers / account/connections.

- [ ] **Step 4: Doctor**

`bash scripts/doctor.sh 2>&1 | tail -20`
Expect: 24/24 (no new doctor checks in Plan 6 — admin UI is observable via logs and the existing oauth-refresh-queue check).

- [ ] **Step 5: Smoke E2E (manual — describe, do not execute)**

For the human reviewer:
1. Visit `/admin/oauth-providers` as an admin user — list should render with categories.
2. Click [Configurer] on Google — drawer opens with 3 tabs.
3. Set credentials in CredentialsTab → save → page reloads.
4. Click [Tester] in CredentialsTab → new tab opens at `accounts.google.com/...`.
5. Toggle [Enabled] in GeneralTab → save → ProviderCard status pill turns green.
6. Visit `/account/connections` as a user — empty state shown.

- [ ] **Step 6: cargo fmt + commit**

```bash
cargo fmt -p signapps-identity --check 2>&1 | tail -5
# if diff in scope → format + commit `style(plan-6): cargo fmt`
```

- [ ] **Step 7: Git log summary**

`rtk git log --oneline main..feat/oauth-admin-ui 2>/dev/null | head -15`

---

**Self-review:**

- ✅ Spec section 9.5 "Endpoints API" → Tasks 1, 2, 3
- ✅ Spec section 9.2 "ProviderListPage" → Task 5
- ✅ Spec section 9.3 "ProviderConfigDrawer 5 tabs" → Task 6 (3 tabs MVP — Scopes & Audit deferred)
- ✅ Spec section 9.4 "VisibilityPicker reusable" → Task 7
- ✅ Spec section 9.7 "Vue utilisateur /account/connections" → Task 8
- ⏸ Spec section 9.6 "Custom OIDC discovery wizard" → deferred (manual JSON entry for now)
- ⏸ Spec section 9.6 "SAML metadata XML upload" → deferred (no SAML callback handler yet)
- ⏸ Per-purpose visibility overrides (`oauth_provider_purpose_overrides`) → deferred
- ⏸ Audit log tab → deferred

**Plan 6 closes the OAuth refactor.** Future incremental enhancements:
- Custom OIDC provider wizard (auto-fetch `.well-known/openid-configuration`)
- SAML support (Engine v3 + metadata upload UI)
- Per-purpose visibility overrides (login-only-for-all + integration-restricted)
- Audit log endpoint + tab
- Calendar + Social consumers (template from mail Plan 4)
- Service extraction: separate `signapps-scheduler` for the refresh job
- Drop legacy plaintext TEXT columns once the migration is verified clean
- Prometheus metrics on the refresh job
