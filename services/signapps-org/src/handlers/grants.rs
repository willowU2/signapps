//! CRUD handlers for `/api/v1/org/grants` — canonical surface (S1 W5).
//!
//! Issues and manages HMAC-signed access grants (see [`crate::grants`]).
//!
//! Endpoints:
//! - `POST /` create a grant (returns `{ id, token, url }`).
//! - `GET /` list grants (filters: `tenant_id`, `active`).
//! - `GET /:id` detail (no raw token).
//! - `POST /verify?token=…` re-validate a token.
//! - `DELETE /:id` revoke a grant.
//!
//! Events emitted:
//! - `org.grant.created`
//! - `org.grant.revoked`

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::auth::Claims;
use signapps_common::pg_events::NewEvent;
use signapps_common::{Error, Result};
use signapps_db::models::org::AccessGrant;
use signapps_db::repositories::org::AccessGrantRepository;
use uuid::Uuid;

use crate::grants::{peek_tenant_id, resource_target_url, tenant_hmac_secret, token};
use crate::AppState;

// ============================================================================
// Router
// ============================================================================

/// Build the grants router nested at `/api/v1/org/grants`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/verify", post(verify))
        .route("/:id", get(detail).delete(revoke))
}

// ============================================================================
// Request / response DTOs
// ============================================================================

/// Query parameters for `GET /api/v1/org/grants`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Tenant UUID — required.
    pub tenant_id: Uuid,
    /// When `true`, only return grants that are neither revoked nor
    /// expired. Defaults to `false` (all grants).
    #[serde(default)]
    pub active: bool,
}

/// Request body for `POST /api/v1/org/grants`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateGrantBody {
    /// Tenant owner of the grant.
    pub tenant_id: Uuid,
    /// Person issuing the grant. If omitted the authenticated subject is used.
    pub granted_by: Option<Uuid>,
    /// Optional recipient (`None` = anonymous link).
    pub granted_to: Option<Uuid>,
    /// Resource target kind (e.g. `"document"`).
    pub resource_type: String,
    /// Resource id.
    pub resource_id: Uuid,
    /// Permission set (JSONB, free-form).
    pub permissions: serde_json::Value,
    /// Optional natural expiry (UTC).
    pub expires_at: Option<DateTime<Utc>>,
}

/// Response body for `POST /api/v1/org/grants`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct CreateGrantResponse {
    /// Database id of the new grant row.
    pub id: Uuid,
    /// Live HMAC-signed token — shown only once on creation.
    pub token: String,
    /// Canonical short URL `/g/<token>`.
    pub url: String,
    /// Deep link to the resource (same shape as the redirect Location).
    pub resource_url: String,
}

/// Query parameters for `POST /api/v1/org/grants/verify`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct VerifyQuery {
    /// Raw HMAC-signed token to validate.
    pub token: String,
}

/// Response body for `POST /api/v1/org/grants/verify`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct VerifyResponse {
    /// Grant row id embedded in the token payload.
    pub grant_id: Uuid,
    /// Tenant embedded in the token payload.
    pub tenant_id: Uuid,
    /// Resource kind.
    pub resource_type: String,
    /// Resource id.
    pub resource_id: Uuid,
    /// Permissions JSON loaded from the DB row.
    pub permissions: serde_json::Value,
    /// Expiry (either from token or DB row).
    pub expires_at: Option<DateTime<Utc>>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/org/grants — list grants for a tenant.
#[utoipa::path(
    get,
    path = "/api/v1/org/grants",
    tag = "Org",
    params(ListQuery),
    responses(
        (status = 200, description = "Grants for tenant", body = Vec<AccessGrant>),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<AccessGrant>>> {
    let rows = if q.active {
        sqlx::query_as::<_, AccessGrant>(
            "SELECT * FROM org_access_grants
              WHERE tenant_id = $1
                AND revoked_at IS NULL
                AND (expires_at IS NULL OR expires_at > now())
              ORDER BY created_at DESC
              LIMIT 200",
        )
        .bind(q.tenant_id)
        .fetch_all(st.pool.inner())
        .await
    } else {
        sqlx::query_as::<_, AccessGrant>(
            "SELECT * FROM org_access_grants
              WHERE tenant_id = $1
              ORDER BY created_at DESC
              LIMIT 200",
        )
        .bind(q.tenant_id)
        .fetch_all(st.pool.inner())
        .await
    }
    .map_err(|e| Error::Database(format!("list grants: {e}")))?;
    Ok(Json(rows))
}

/// POST /api/v1/org/grants — create a grant + emit `org.grant.created`.
#[utoipa::path(
    post,
    path = "/api/v1/org/grants",
    tag = "Org",
    request_body = CreateGrantBody,
    responses(
        (status = 201, description = "Grant created", body = CreateGrantResponse),
        (status = 400, description = "Invalid body"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, claims, body), fields(tenant_id=%body.tenant_id, resource_type=%body.resource_type))]
pub async fn create(
    State(st): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateGrantBody>,
) -> Result<(StatusCode, Json<CreateGrantResponse>)> {
    let granted_by = body.granted_by.unwrap_or(claims.sub);

    // 1. Fresh grant id, used both as DB PK and inside the token
    //    payload so the token binds to the row.
    let grant_id = Uuid::new_v4();

    // 2. Sign the token with the per-tenant HMAC secret.
    let secret = tenant_hmac_secret(Some(&st.keystore), body.tenant_id);
    let payload = token::TokenPayload {
        grant_id,
        tenant_id: body.tenant_id,
        resource_type: body.resource_type.clone(),
        resource_id: body.resource_id,
        expires_at: body.expires_at,
    };
    let raw_token = token::sign(&payload, &secret)
        .map_err(|e| Error::Internal(format!("grant token sign: {e}")))?;
    let token_hash = token::hash(&raw_token);

    // 3. Persist. We rely on the DB-level UUID default being ignored
    //    because we pass our own id via the INSERT? The repo's create
    //    method uses the DB default — but we need our id to match the
    //    token payload. So use a direct INSERT here.
    let grant = sqlx::query_as::<_, AccessGrant>(
        "INSERT INTO org_access_grants
            (id, tenant_id, granted_by, granted_to, resource_type, resource_id,
             permissions, token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *",
    )
    .bind(grant_id)
    .bind(body.tenant_id)
    .bind(granted_by)
    .bind(body.granted_to)
    .bind(&body.resource_type)
    .bind(body.resource_id)
    .bind(&body.permissions)
    .bind(&token_hash)
    .bind(body.expires_at)
    .fetch_one(st.pool.inner())
    .await
    .map_err(|e| Error::Database(format!("insert grant: {e}")))?;

    // 4. Emit org.grant.created (resource_type + resource_id in the
    //    payload so the RBAC cache can do targeted invalidation).
    let _ = st
        .event_bus
        .publish(NewEvent {
            event_type: "org.grant.created".to_string(),
            aggregate_id: Some(grant.id),
            payload: serde_json::json!({
                "id": grant.id,
                "tenant_id": grant.tenant_id,
                "resource_type": grant.resource_type,
                "resource_id": grant.resource_id,
                "expires_at": grant.expires_at,
                "granted_to": grant.granted_to,
            }),
        })
        .await;

    // 5. Build the response. The raw token is returned only here.
    let response = CreateGrantResponse {
        id: grant.id,
        url: format!("/g/{raw_token}"),
        resource_url: resource_target_url(&grant.resource_type, grant.resource_id),
        token: raw_token,
    };

    tracing::info!(
        grant_id = %grant.id,
        tenant_id = %grant.tenant_id,
        resource_type = %grant.resource_type,
        "grant created"
    );

    Ok((StatusCode::CREATED, Json(response)))
}

/// GET /api/v1/org/grants/:id — fetch one grant (no raw token in the payload).
#[utoipa::path(
    get,
    path = "/api/v1/org/grants/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Grant UUID")),
    responses(
        (status = 200, description = "Grant detail", body = AccessGrant),
        (status = 404, description = "Grant not found"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn detail(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<AccessGrant>> {
    let grant = sqlx::query_as::<_, AccessGrant>("SELECT * FROM org_access_grants WHERE id = $1")
        .bind(id)
        .fetch_optional(st.pool.inner())
        .await
        .map_err(|e| Error::Database(format!("get grant: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("org grant {id}")))?;
    Ok(Json(grant))
}

/// POST /api/v1/org/grants/verify?token=… — re-validate a token.
#[utoipa::path(
    post,
    path = "/api/v1/org/grants/verify",
    tag = "Org",
    params(VerifyQuery),
    responses(
        (status = 200, description = "Token valid", body = VerifyResponse),
        (status = 403, description = "Token invalid / expired / revoked"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, q), fields(token_len = q.token.len()))]
pub async fn verify(
    State(st): State<AppState>,
    Query(q): Query<VerifyQuery>,
) -> Result<Json<VerifyResponse>> {
    // Peek tenant id from payload without trusting HMAC yet.
    let tenant_preview = peek_tenant_id(&q.token)
        .ok_or_else(|| Error::BadRequest("malformed token".to_string()))?;

    let secret = tenant_hmac_secret(Some(&st.keystore), tenant_preview);
    let payload = token::verify(&q.token, &secret).map_err(|e| match e {
        token::TokenError::Expired => Error::Forbidden("token expired".to_string()),
        _ => Error::Forbidden("token invalid".to_string()),
    })?;

    let hashed = token::hash(&q.token);
    let repo = AccessGrantRepository::new(st.pool.inner());
    let grant = repo
        .get_by_token(&hashed)
        .await
        .map_err(|e| Error::Database(format!("verify lookup: {e}")))?
        .ok_or_else(|| Error::Forbidden("grant not found".to_string()))?;

    if grant.revoked_at.is_some() {
        return Err(Error::Forbidden("grant revoked".to_string()));
    }
    if let Some(exp) = grant.expires_at {
        if chrono::Utc::now() >= exp {
            return Err(Error::Forbidden("grant expired".to_string()));
        }
    }

    Ok(Json(VerifyResponse {
        grant_id: payload.grant_id,
        tenant_id: payload.tenant_id,
        resource_type: grant.resource_type,
        resource_id: grant.resource_id,
        permissions: grant.permissions,
        expires_at: grant.expires_at.or(payload.expires_at),
    }))
}

/// DELETE /api/v1/org/grants/:id — revoke a grant.
#[utoipa::path(
    delete,
    path = "/api/v1/org/grants/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Grant UUID")),
    responses(
        (status = 204, description = "Grant revoked"),
        (status = 404, description = "Grant not found"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn revoke(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    // Load first so we can emit a payload useful for cache invalidation.
    let grant = sqlx::query_as::<_, AccessGrant>("SELECT * FROM org_access_grants WHERE id = $1")
        .bind(id)
        .fetch_optional(st.pool.inner())
        .await
        .map_err(|e| Error::Database(format!("get grant: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("org grant {id}")))?;

    let repo = AccessGrantRepository::new(st.pool.inner());
    repo.revoke(id)
        .await
        .map_err(|e| Error::Database(format!("revoke grant: {e}")))?;

    let _ = st
        .event_bus
        .publish(NewEvent {
            event_type: "org.grant.revoked".to_string(),
            aggregate_id: Some(id),
            payload: serde_json::json!({
                "id": id,
                "tenant_id": grant.tenant_id,
                "resource_type": grant.resource_type,
                "resource_id": grant.resource_id,
            }),
        })
        .await;

    tracing::info!(grant_id = %id, "grant revoked");
    Ok(StatusCode::NO_CONTENT)
}

