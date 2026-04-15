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
use crate::models::{
    AuditEntry, BulkGrantRequest, BulkGrantResult, CreateGrant, CreateTemplate,
    EffectivePermission, Grant, Template,
};
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
#[utoipa::path(
    get,
    path = "/api/v1/{prefix}/{resource_id}/grants",
    params(
        ("prefix" = String, Path, description = "Resource type prefix (e.g. `files`, `calendars`)"),
        ("resource_id" = Uuid, Path, description = "UUID of the resource"),
    ),
    responses(
        (status = 200, description = "List of active grants on the resource", body = Vec<Grant>),
        (status = 401, description = "Unauthorized — missing or invalid JWT"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearerAuth" = [])),
    tag = "Sharing"
)]
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
#[utoipa::path(
    post,
    path = "/api/v1/{prefix}/{resource_id}/grants",
    params(
        ("prefix" = String, Path, description = "Resource type prefix (e.g. `files`, `calendars`)"),
        ("resource_id" = Uuid, Path, description = "UUID of the resource"),
    ),
    request_body = CreateGrant,
    responses(
        (status = 200, description = "Grant created successfully", body = Grant),
        (status = 400, description = "Invalid grant input"),
        (status = 401, description = "Unauthorized — missing or invalid JWT"),
        (status = 403, description = "Forbidden — caller lacks manager role"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearerAuth" = [])),
    tag = "Sharing"
)]
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
#[utoipa::path(
    delete,
    path = "/api/v1/{prefix}/{resource_id}/grants/{grant_id}",
    params(
        ("prefix" = String, Path, description = "Resource type prefix (e.g. `files`, `calendars`)"),
        ("resource_id" = Uuid, Path, description = "UUID of the resource"),
        ("grant_id" = Uuid, Path, description = "UUID of the grant to revoke"),
    ),
    responses(
        (status = 200, description = "Grant revoked successfully"),
        (status = 401, description = "Unauthorized — missing or invalid JWT"),
        (status = 403, description = "Forbidden — caller lacks manager role"),
        (status = 404, description = "Grant not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearerAuth" = [])),
    tag = "Sharing"
)]
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
#[utoipa::path(
    get,
    path = "/api/v1/{prefix}/{resource_id}/permissions",
    params(
        ("prefix" = String, Path, description = "Resource type prefix (e.g. `files`, `calendars`)"),
        ("resource_id" = Uuid, Path, description = "UUID of the resource"),
    ),
    responses(
        (status = 200, description = "Effective permission for the caller, or null if no access", body = Option<EffectivePermission>),
        (status = 401, description = "Unauthorized — missing or invalid JWT"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearerAuth" = [])),
    tag = "Sharing"
)]
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
#[utoipa::path(
    get,
    path = "/api/v1/shared-with-me",
    params(
        ("resource_type" = Option<String>, Query, description = "Optional resource type filter (e.g. `file`, `calendar`)"),
    ),
    responses(
        (status = 200, description = "All grants where the caller is the grantee", body = Vec<Grant>),
        (status = 400, description = "Invalid resource_type query parameter"),
        (status = 401, description = "Unauthorized — missing or invalid JWT"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearerAuth" = [])),
    tag = "Sharing"
)]
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

// ─── Bulk grant handler ───────────────────────────────────────────────────────

/// Apply the same grant to multiple resources at once.
///
/// `POST /api/v1/sharing/bulk-grant`
///
/// Processes each resource independently — a failure on one resource does not
/// abort the rest of the batch.  The response body always contains the count of
/// successfully created grants and the list of per-resource errors.
///
/// # Errors
///
/// Returns [`Error::Unauthorized`] if no valid JWT is present.
/// Returns [`Error::BadRequest`] if `resource_type` is not a valid type string.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/sharing/bulk-grant",
    request_body = BulkGrantRequest,
    responses(
        (status = 200, description = "Bulk grant result (partial success possible)", body = BulkGrantResult),
        (status = 400, description = "Invalid resource_type or request body"),
        (status = 401, description = "Unauthorized — missing or invalid JWT"),
        (status = 403, description = "Forbidden — caller lacks required role"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearerAuth" = [])),
    tag = "Sharing"
)]
#[instrument(skip(engine, claims, body), fields(user_id = %claims.sub, resource_type = %body.resource_type))]
pub async fn bulk_grant_handler(
    State(engine): State<SharingEngine>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<BulkGrantRequest>,
) -> Result<Json<BulkGrantResult>> {
    let actor_ctx = engine.build_user_context(&claims).await?;

    let resource_type: crate::types::ResourceType = body
        .resource_type
        .parse()
        .map_err(|_| Error::BadRequest(format!("invalid resource_type: {}", body.resource_type)))?;

    let create_grant = CreateGrant {
        grantee_type: body.grantee_type,
        grantee_id: body.grantee_id,
        role: body.role,
        can_reshare: Some(body.can_reshare),
        expires_at: body.expires_at,
    };

    let result = engine
        .bulk_grant(
            &actor_ctx,
            resource_type,
            body.resource_ids,
            body.owner_id,
            create_grant,
        )
        .await?;

    Ok(Json(result))
}

// ─── Template handlers ────────────────────────────────────────────────────────

/// List all sharing templates in the calling user's tenant.
///
/// `GET /api/v1/sharing/templates`
///
/// # Errors
///
/// Returns [`Error::Unauthorized`] if no valid JWT is present.
/// Returns [`Error::Database`] if the DB query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/sharing/templates",
    responses(
        (status = 200, description = "List of sharing templates for the caller's tenant", body = Vec<Template>),
        (status = 401, description = "Unauthorized — missing or invalid JWT"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearerAuth" = [])),
    tag = "Sharing"
)]
#[instrument(skip(engine, claims), fields(user_id = %claims.sub))]
pub async fn list_templates_handler(
    State(engine): State<SharingEngine>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Template>>> {
    let user_ctx = engine.build_user_context(&claims).await?;
    let templates = engine.list_templates(&user_ctx).await?;
    Ok(Json(templates))
}

/// Create a new sharing template (admin only).
///
/// `POST /api/v1/sharing/templates`
///
/// # Errors
///
/// Returns [`Error::Unauthorized`] if no valid JWT is present.
/// Returns [`Error::Forbidden`] if the actor is not an admin.
/// Returns [`Error::Database`] if the DB query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/sharing/templates",
    request_body = CreateTemplate,
    responses(
        (status = 200, description = "Template created successfully", body = Template),
        (status = 401, description = "Unauthorized — missing or invalid JWT"),
        (status = 403, description = "Forbidden — admin role required"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearerAuth" = [])),
    tag = "Sharing"
)]
#[instrument(skip(engine, claims, body), fields(user_id = %claims.sub))]
pub async fn create_template_handler(
    State(engine): State<SharingEngine>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTemplate>,
) -> Result<Json<Template>> {
    let actor_ctx = engine.build_user_context(&claims).await?;
    let template = engine.create_template(&actor_ctx, body).await?;
    Ok(Json(template))
}

/// Delete a sharing template by ID (admin only).
///
/// `DELETE /api/v1/sharing/templates/:template_id`
///
/// System templates cannot be deleted and will return 404.
///
/// # Errors
///
/// Returns [`Error::Unauthorized`] if no valid JWT is present.
/// Returns [`Error::Forbidden`] if the actor is not an admin.
/// Returns [`Error::NotFound`] if the template does not exist or is a system template.
/// Returns [`Error::Database`] if the DB query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    delete,
    path = "/api/v1/sharing/templates/{template_id}",
    params(
        ("template_id" = Uuid, Path, description = "UUID of the template to delete"),
    ),
    responses(
        (status = 200, description = "Template deleted successfully"),
        (status = 401, description = "Unauthorized — missing or invalid JWT"),
        (status = 403, description = "Forbidden — admin role required"),
        (status = 404, description = "Template not found or is a system template"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearerAuth" = [])),
    tag = "Sharing"
)]
#[instrument(skip(engine, claims), fields(user_id = %claims.sub, template_id = %template_id))]
pub async fn delete_template_handler(
    State(engine): State<SharingEngine>,
    Extension(claims): Extension<Claims>,
    Path(template_id): Path<Uuid>,
) -> Result<Json<()>> {
    let actor_ctx = engine.build_user_context(&claims).await?;
    engine.delete_template(&actor_ctx, template_id).await?;
    Ok(Json(()))
}

// ─── Apply-template handler ───────────────────────────────────────────────────

/// Path parameters for the apply-template endpoint.
#[derive(Debug, Deserialize)]
pub struct ApplyTemplatePath {
    /// UUID of the target resource.
    pub resource_id: Uuid,
    /// UUID of the template to apply.
    pub template_id: Uuid,
}

/// Response body for the apply-template endpoint.
#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
pub struct ApplyTemplateResponse {
    /// Number of grants that were created from the template.
    pub count: usize,
}

/// Apply a sharing template to a resource.
///
/// `POST /api/v1/{prefix}/:resource_id/apply-template/:template_id`
///
/// Expands all grant definitions from the named template onto the target
/// resource.  Requires `manager` role on the resource or admin JWT.
/// Individual grant failures are skipped; the response always reports how
/// many grants were actually created.
///
/// # Errors
///
/// Returns [`Error::Unauthorized`] if no valid JWT is present.
/// Returns [`Error::Forbidden`] if the actor lacks manager role.
/// Returns [`Error::NotFound`] if the template does not exist.
/// Returns [`Error::Database`] if the DB query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/{prefix}/{resource_id}/apply-template/{template_id}",
    params(
        ("prefix" = String, Path, description = "Resource type prefix (e.g. `files`, `calendars`)"),
        ("resource_id" = Uuid, Path, description = "UUID of the target resource"),
        ("template_id" = Uuid, Path, description = "UUID of the template to apply"),
    ),
    responses(
        (status = 200, description = "Template applied — number of grants created", body = ApplyTemplateResponse),
        (status = 401, description = "Unauthorized — missing or invalid JWT"),
        (status = 403, description = "Forbidden — caller lacks manager role"),
        (status = 404, description = "Template not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearerAuth" = [])),
    tag = "Sharing"
)]
#[instrument(skip(engine, claims), fields(
    user_id     = %claims.sub,
    resource_id = %path.resource_id,
    template_id = %path.template_id,
))]
pub async fn apply_template_handler(
    State(engine): State<SharingEngine>,
    Extension(claims): Extension<Claims>,
    Path(path): Path<ApplyTemplatePath>,
    Extension(resource_type): Extension<ResourceType>,
) -> Result<Json<ApplyTemplateResponse>> {
    let user_ctx = engine.build_user_context(&claims).await?;
    let resource = crate::types::ResourceRef {
        resource_type,
        resource_id: path.resource_id,
    };
    let count = engine
        .apply_template(&user_ctx, resource, None, path.template_id)
        .await?;
    Ok(Json(ApplyTemplateResponse { count }))
}

// ─── Update-grant handler ────────────────────────────────────────────────────

/// Request body for updating the role of an existing grant.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateGrantRoleRequest {
    /// New role to assign on the grant.
    pub role: crate::types::Role,
}

/// Update the role of an existing grant on a resource.
///
/// `PATCH /api/v1/{prefix}/:resource_id/grants/:grant_id`
///
/// Requires `manager` role on the resource or admin JWT.
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
#[utoipa::path(
    patch,
    path = "/api/v1/{prefix}/{resource_id}/grants/{grant_id}",
    params(
        ("prefix" = String, Path, description = "Resource type prefix (e.g. `files`, `calendars`)"),
        ("resource_id" = Uuid, Path, description = "UUID of the resource"),
        ("grant_id" = Uuid, Path, description = "UUID of the grant to update"),
    ),
    request_body = UpdateGrantRoleRequest,
    responses(
        (status = 200, description = "Grant updated successfully", body = Grant),
        (status = 400, description = "Invalid role value"),
        (status = 401, description = "Unauthorized — missing or invalid JWT"),
        (status = 403, description = "Forbidden — caller lacks manager role"),
        (status = 404, description = "Grant not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearerAuth" = [])),
    tag = "Sharing"
)]
#[instrument(skip(engine, claims, body), fields(
    user_id     = %claims.sub,
    resource_id = %path.resource_id,
    grant_id    = %path.grant_id,
))]
pub async fn update_grant_handler(
    State(engine): State<SharingEngine>,
    Extension(claims): Extension<Claims>,
    Path(path): Path<GrantPath>,
    Extension(resource_type): Extension<ResourceType>,
    Json(body): Json<UpdateGrantRoleRequest>,
) -> Result<Json<Grant>> {
    let user_ctx = engine.build_user_context(&claims).await?;
    let resource = crate::types::ResourceRef {
        resource_type,
        resource_id: path.resource_id,
    };
    let grant = engine
        .update_grant_role(&user_ctx, resource, None, path.grant_id, body.role)
        .await?;
    Ok(Json(grant))
}

// ─── Audit handler ────────────────────────────────────────────────────────────

/// Query parameters for the audit log endpoint.
#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    /// Optional resource type filter.
    pub resource_type: Option<String>,
    /// Optional resource ID filter (requires `resource_type`).
    pub resource_id: Option<Uuid>,
    /// Maximum number of entries to return (default 100).
    pub limit: Option<i64>,
}

/// List sharing audit log entries (admin only).
///
/// `GET /api/v1/sharing/audit`
///
/// Accepts optional `resource_type`, `resource_id`, and `limit` query parameters.
/// When both `resource_type` and `resource_id` are provided, results are filtered
/// to that specific resource.  Otherwise the full tenant-wide log is returned.
///
/// # Errors
///
/// Returns [`Error::Unauthorized`] if no valid JWT is present.
/// Returns [`Error::Forbidden`] if the actor is not an admin.
/// Returns [`Error::Database`] if the DB query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/sharing/audit",
    params(
        ("resource_type" = Option<String>, Query, description = "Optional resource type filter"),
        ("resource_id" = Option<Uuid>, Query, description = "Optional resource UUID filter (requires resource_type)"),
        ("limit" = Option<i64>, Query, description = "Maximum entries to return (default 100)"),
    ),
    responses(
        (status = 200, description = "Audit log entries for the tenant", body = Vec<AuditEntry>),
        (status = 401, description = "Unauthorized — missing or invalid JWT"),
        (status = 403, description = "Forbidden — admin role required"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearerAuth" = [])),
    tag = "Sharing"
)]
#[instrument(skip(engine, claims), fields(user_id = %claims.sub))]
pub async fn list_audit_handler(
    State(engine): State<SharingEngine>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AuditQuery>,
) -> Result<Json<Vec<AuditEntry>>> {
    let actor_ctx = engine.build_user_context(&claims).await?;
    let entries = engine
        .list_audit(
            &actor_ctx,
            params.resource_type,
            params.resource_id,
            params.limit.unwrap_or(100),
        )
        .await?;
    Ok(Json(entries))
}
