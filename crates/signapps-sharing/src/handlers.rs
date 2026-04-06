//! Generic Axum HTTP handlers for the sharing REST API.
//!
//! These handlers are resource-type-agnostic and can be mounted by any
//! service that uses the sharing engine. The resource type is provided at
//! router-construction time (see [`crate::routes`]).
//!
//! All handlers:
//! - Extract [`Claims`] from request extensions (set by upstream auth middleware).
//! - Build a [`UserContext`] via [`SharingEngine::build_user_context`].
//! - Delegate business logic to [`SharingEngine`].
//! - Return JSON responses on success.

use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::Deserialize;
use signapps_common::{Claims, Error, Result};
use tracing::instrument;
use uuid::Uuid;

use crate::engine::SharingEngine;
use crate::models::{CreateGrant, EffectivePermission, Grant};
use crate::types::ResourceType;

// ─── Path extractors ─────────────────────────────────────────────────────────

/// Path parameters for resource-level sharing endpoints.
#[derive(Debug, Deserialize)]
pub struct ResourcePath {
    /// The UUID of the specific resource instance.
    pub resource_id: Uuid,
}

/// Path parameters for grant-level endpoints (includes grant_id).
#[derive(Debug, Deserialize)]
pub struct GrantPath {
    /// The UUID of the specific resource instance.
    pub resource_id: Uuid,
    /// The UUID of the grant to operate on.
    pub grant_id: Uuid,
}

/// Query parameters for the `shared_with_me` endpoint.
#[derive(Debug, Deserialize)]
pub struct SharedWithMeQuery {
    /// Optional resource type filter (e.g. `"file"`, `"calendar"`).
    pub resource_type: Option<String>,
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/// List all active grants on a resource.
///
/// `GET /api/v1/{prefix}/:resource_id/grants`
///
/// # Errors
///
/// Returns [`Error::Unauthorized`] if no valid JWT is present.
/// Returns [`Error::Database`] if the DB query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[instrument(skip(engine, claims), fields(user_id = %claims.sub, resource_id = %path.resource_id))]
pub async fn list_grants_handler(
    State(engine): State<SharingEngine>,
    Extension(claims): Extension<Claims>,
    Path(path): Path<ResourcePath>,
    // resource_type is injected as a state extension by the router
    Extension(resource_type): Extension<ResourceType>,
) -> Result<Json<Vec<Grant>>> {
    let user_ctx = engine.build_user_context(&claims).await?;
    let resource = crate::types::ResourceRef {
        resource_type,
        resource_id: path.resource_id,
    };
    let grants = engine.list_grants(&user_ctx, resource).await?;
    Ok(Json(grants))
}

/// Create a new permission grant on a resource.
///
/// `POST /api/v1/{prefix}/:resource_id/grants`
///
/// # Errors
///
/// Returns [`Error::Unauthorized`] if no valid JWT is present.
/// Returns [`Error::Forbidden`] if the actor lacks manager role.
/// Returns [`Error::BadRequest`] for invalid grant combinations.
/// Returns [`Error::Database`] if the DB query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[instrument(skip(engine, claims, body), fields(user_id = %claims.sub, resource_id = %path.resource_id))]
pub async fn create_grant_handler(
    State(engine): State<SharingEngine>,
    Extension(claims): Extension<Claims>,
    Path(path): Path<ResourcePath>,
    Extension(resource_type): Extension<ResourceType>,
    Json(body): Json<CreateGrant>,
) -> Result<Json<Grant>> {
    let user_ctx = engine.build_user_context(&claims).await?;
    let resource = crate::types::ResourceRef {
        resource_type,
        resource_id: path.resource_id,
    };
    let grant = engine.grant(&user_ctx, resource, None, body).await?;
    Ok(Json(grant))
}

/// Revoke a specific grant on a resource.
///
/// `DELETE /api/v1/{prefix}/:resource_id/grants/:grant_id`
///
/// # Errors
///
/// Returns [`Error::Unauthorized`] if no valid JWT is present.
/// Returns [`Error::Forbidden`] if the actor lacks manager role.
/// Returns [`Error::NotFound`] if the grant does not exist.
/// Returns [`Error::Database`] if the DB query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[instrument(skip(engine, claims), fields(
    user_id  = %claims.sub,
    resource_id = %path.resource_id,
    grant_id = %path.grant_id,
))]
pub async fn revoke_grant_handler(
    State(engine): State<SharingEngine>,
    Extension(claims): Extension<Claims>,
    Path(path): Path<GrantPath>,
    Extension(resource_type): Extension<ResourceType>,
) -> Result<Json<()>> {
    let user_ctx = engine.build_user_context(&claims).await?;
    let resource = crate::types::ResourceRef {
        resource_type,
        resource_id: path.resource_id,
    };
    engine
        .revoke(&user_ctx, resource, None, path.grant_id)
        .await?;
    Ok(Json(()))
}

/// Get the effective permission for the calling user on a resource.
///
/// `GET /api/v1/{prefix}/:resource_id/permissions`
///
/// Returns `null` in the JSON body when the user has no access.
///
/// # Errors
///
/// Returns [`Error::Unauthorized`] if no valid JWT is present.
/// Returns [`Error::Database`] if the DB query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[instrument(skip(engine, claims), fields(user_id = %claims.sub, resource_id = %path.resource_id))]
pub async fn permissions_handler(
    State(engine): State<SharingEngine>,
    Extension(claims): Extension<Claims>,
    Path(path): Path<ResourcePath>,
    Extension(resource_type): Extension<ResourceType>,
) -> Result<Json<Option<EffectivePermission>>> {
    let user_ctx = engine.build_user_context(&claims).await?;
    let resource = crate::types::ResourceRef {
        resource_type,
        resource_id: path.resource_id,
    };
    let perm = engine.effective_role(&user_ctx, resource, None).await?;
    Ok(Json(perm))
}

/// List all resources shared with the calling user.
///
/// `GET /api/v1/shared-with-me`
///
/// Accepts an optional `resource_type` query parameter to filter results.
///
/// # Errors
///
/// Returns [`Error::Unauthorized`] if no valid JWT is present.
/// Returns [`Error::BadRequest`] if `resource_type` query param is not a valid type string.
/// Returns [`Error::Database`] if the DB query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[instrument(skip(engine, claims), fields(user_id = %claims.sub))]
pub async fn shared_with_me_handler(
    State(engine): State<SharingEngine>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<SharedWithMeQuery>,
) -> Result<Json<Vec<Grant>>> {
    let user_ctx = engine.build_user_context(&claims).await?;

    let rt_filter = query
        .resource_type
        .as_deref()
        .map(|s| {
            s.parse::<ResourceType>()
                .map_err(|e| Error::BadRequest(format!("invalid resource_type: {e}")))
        })
        .transpose()?;

    let grants = engine.shared_with_me(&user_ctx, rt_filter).await?;
    Ok(Json(grants))
}
