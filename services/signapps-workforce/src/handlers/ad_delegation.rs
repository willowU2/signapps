//! Manager delegation handlers for AD accounts and GPO.
//!
//! Provides endpoints scoped to the authenticated manager's subtree:
//! team AD user accounts, computer accounts, GPO policies, and lifecycle
//! operations (disable, enable, reset password, move).

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{middleware::TenantContext, Claims};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Resolve the person UUID for the authenticated user.
async fn resolve_caller_person(
    pool: &signapps_db::DatabasePool,
    user_id: Uuid,
    tenant_id: Uuid,
) -> Result<Option<Uuid>, StatusCode> {
    let row: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM core.persons WHERE user_id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1",
    )
    .bind(user_id)
    .bind(tenant_id)
    .fetch_optional(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error resolving caller person");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(row.map(|(id,)| id))
}

/// Resolve the primary org node for a person.
async fn resolve_primary_node(
    pool: &signapps_db::DatabasePool,
    person_id: Uuid,
) -> Result<Option<Uuid>, StatusCode> {
    let row: Option<(Uuid,)> = sqlx::query_as(
        "SELECT node_id FROM core.assignments WHERE person_id = $1 AND is_primary = true AND end_date IS NULL LIMIT 1",
    )
    .bind(person_id)
    .fetch_optional(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error resolving primary node");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(row.map(|(id,)| id))
}

/// Verify that a given AD user account `id` belongs to a node within the manager's subtree.
async fn verify_account_in_subtree(
    pool: &signapps_db::DatabasePool,
    account_id: Uuid,
    manager_node_id: Uuid,
) -> Result<(), StatusCode> {
    use sqlx::Row as _;

    let row = sqlx::query(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM ad_user_accounts au
            JOIN core.persons p ON p.id = au.person_id
            JOIN core.assignments a ON a.person_id = p.id AND a.is_primary = true AND a.end_date IS NULL
            JOIN core.org_closure oc ON oc.descendant_id = a.node_id
            WHERE au.id = $1
              AND oc.ancestor_id = $2
              AND oc.depth > 0
        ) AS ok
        "#,
    )
    .bind(account_id)
    .bind(manager_node_id)
    .fetch_one(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error verifying account in subtree");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !row.get::<bool, _>("ok") {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 1: my_team_ad_accounts
// ─────────────────────────────────────────────────────────────────────────────

/// List AD user accounts for the manager's direct team (N-1).
///
/// # Errors
///
/// - `404` if the caller has no person record.
/// - `500` on database failure.
///
/// # Panics
///
/// No panics — all errors propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/ad/my-team/ad-accounts",
    responses(
        (status = 200, description = "AD accounts for direct team"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "AD Delegation"
)]
#[tracing::instrument(skip_all)]
pub async fn my_team_ad_accounts(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    let person_id = match resolve_caller_person(pool, claims.sub, ctx.tenant_id).await? {
        Some(id) => id,
        None => return Ok(Json(json!([]))),
    };

    let node_id = match resolve_primary_node(pool, person_id).await? {
        Some(id) => id,
        None => return Ok(Json(json!([]))),
    };

    let accounts: Vec<(Uuid, String, String, String, String, String)> = sqlx::query_as(
        r#"
        SELECT DISTINCT au.id, p.first_name, p.last_name,
               au.sam_account_name, au.user_principal_name, au.sync_status
        FROM ad_user_accounts au
        JOIN core.persons p ON p.id = au.person_id
        JOIN core.assignments a ON a.person_id = p.id AND a.is_primary = true AND a.end_date IS NULL
        JOIN core.org_closure oc ON oc.descendant_id = a.node_id
        WHERE oc.ancestor_id = $1
          AND oc.depth = 1
        ORDER BY p.last_name, p.first_name
        "#,
    )
    .bind(node_id)
    .fetch_all(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error fetching team AD accounts");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let result: Vec<_> = accounts
        .into_iter()
        .map(|(id, first, last, sam, upn, status)| {
            json!({
                "id": id,
                "first_name": first,
                "last_name": last,
                "sam_account_name": sam,
                "user_principal_name": upn,
                "sync_status": status,
            })
        })
        .collect();

    Ok(Json(json!(result)))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 2: my_team_computers
// ─────────────────────────────────────────────────────────────────────────────

/// List AD computer accounts assigned within the manager's subtree.
///
/// # Errors
///
/// Returns `500` on database failure.
///
/// # Panics
///
/// No panics — all errors propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/ad/my-team/computers",
    responses(
        (status = 200, description = "Computer accounts for team subtree"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "AD Delegation"
)]
#[tracing::instrument(skip_all)]
pub async fn my_team_computers(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    let person_id = match resolve_caller_person(pool, claims.sub, ctx.tenant_id).await? {
        Some(id) => id,
        None => return Ok(Json(json!([]))),
    };

    let node_id = match resolve_primary_node(pool, person_id).await? {
        Some(id) => id,
        None => return Ok(Json(json!([]))),
    };

    let computers: Vec<(Uuid, String, Option<String>, Option<String>, String)> = sqlx::query_as(
        r#"
        SELECT DISTINCT ac.id, ac.computer_name, ac.operating_system, ac.distinguished_name, ac.sync_status
        FROM ad_computer_accounts ac
        JOIN core.org_closure oc ON oc.descendant_id = ac.org_node_id
        WHERE oc.ancestor_id = $1
          AND oc.depth >= 0
        ORDER BY ac.computer_name
        "#,
    )
    .bind(node_id)
    .fetch_all(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error fetching team computers");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let result: Vec<_> = computers
        .into_iter()
        .map(|(id, name, os, dn, status)| {
            json!({
                "id": id,
                "computer_name": name,
                "operating_system": os,
                "distinguished_name": dn,
                "sync_status": status,
            })
        })
        .collect();

    Ok(Json(json!(result)))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 3: my_team_gpo
// ─────────────────────────────────────────────────────────────────────────────

/// List governance policies applied to the manager's own org node.
///
/// # Errors
///
/// Returns `500` on database failure.
///
/// # Panics
///
/// No panics — all errors propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/ad/my-team/gpo",
    responses(
        (status = 200, description = "GPO policies for manager node"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "AD Delegation"
)]
#[tracing::instrument(skip_all)]
pub async fn my_team_gpo(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    let person_id = match resolve_caller_person(pool, claims.sub, ctx.tenant_id).await? {
        Some(id) => id,
        None => return Ok(Json(json!([]))),
    };

    let node_id = match resolve_primary_node(pool, person_id).await? {
        Some(id) => id,
        None => return Ok(Json(json!([]))),
    };

    let policies: Vec<(Uuid, String, Option<serde_json::Value>)> = sqlx::query_as(
        r#"
        SELECT p.id, p.name, p.settings
        FROM workforce_org_policies p
        WHERE p.node_id = $1
          AND p.domain = 'governance'
        ORDER BY p.name
        "#,
    )
    .bind(node_id)
    .fetch_all(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error fetching team GPO");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let result: Vec<_> = policies
        .into_iter()
        .map(|(id, name, settings)| {
            json!({ "id": id, "name": name, "settings": settings })
        })
        .collect();

    Ok(Json(json!(result)))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 4: disable_account
// ─────────────────────────────────────────────────────────────────────────────

/// Disable an AD account that belongs to someone in the manager's subtree.
///
/// # Errors
///
/// - `403` if the account is not in the manager's subtree.
/// - `404` if the caller has no person record.
/// - `500` on database failure.
///
/// # Panics
///
/// No panics — all errors propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/ad/my-team/ad-accounts/{id}/disable",
    params(("id" = Uuid, Path, description = "AD account UUID")),
    responses(
        (status = 200, description = "Account disabled"),
        (status = 403, description = "Account not in manager subtree"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "AD Delegation"
)]
#[tracing::instrument(skip_all, fields(account_id = %id))]
pub async fn disable_account(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    let person_id = resolve_caller_person(pool, claims.sub, ctx.tenant_id)
        .await?
        .ok_or(StatusCode::NOT_FOUND)?;
    let node_id = resolve_primary_node(pool, person_id)
        .await?
        .ok_or(StatusCode::UNPROCESSABLE_ENTITY)?;

    verify_account_in_subtree(pool, id, node_id).await?;

    sqlx::query(
        "UPDATE ad_user_accounts SET sync_status = 'disabled', updated_at = NOW() WHERE id = $1",
    )
    .bind(id)
    .execute(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error disabling account");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(account_id = %id, "AD account disabled by manager");
    Ok(Json(json!({ "id": id, "sync_status": "disabled" })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 5: enable_account
// ─────────────────────────────────────────────────────────────────────────────

/// Enable a previously disabled AD account in the manager's subtree.
///
/// # Errors
///
/// - `403` if the account is not in the manager's subtree.
/// - `500` on database failure.
///
/// # Panics
///
/// No panics — all errors propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/ad/my-team/ad-accounts/{id}/enable",
    params(("id" = Uuid, Path, description = "AD account UUID")),
    responses(
        (status = 200, description = "Account enabled"),
        (status = 403, description = "Account not in manager subtree"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "AD Delegation"
)]
#[tracing::instrument(skip_all, fields(account_id = %id))]
pub async fn enable_account(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    let person_id = resolve_caller_person(pool, claims.sub, ctx.tenant_id)
        .await?
        .ok_or(StatusCode::NOT_FOUND)?;
    let node_id = resolve_primary_node(pool, person_id)
        .await?
        .ok_or(StatusCode::UNPROCESSABLE_ENTITY)?;

    verify_account_in_subtree(pool, id, node_id).await?;

    sqlx::query(
        "UPDATE ad_user_accounts SET sync_status = 'synced', updated_at = NOW() WHERE id = $1",
    )
    .bind(id)
    .execute(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error enabling account");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(account_id = %id, "AD account enabled by manager");
    Ok(Json(json!({ "id": id, "sync_status": "synced" })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 6: reset_password
// ─────────────────────────────────────────────────────────────────────────────

/// Generate a new random 16-character password for an AD account in the manager's subtree.
///
/// The plain-text password is returned **once** in the response body; it is not persisted.
/// The caller is responsible for transmitting it securely to the end user.
///
/// # Errors
///
/// - `403` if the account is not in the manager's subtree.
/// - `500` on database failure.
///
/// # Panics
///
/// No panics — all errors propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/ad/my-team/ad-accounts/{id}/reset-password",
    params(("id" = Uuid, Path, description = "AD account UUID")),
    responses(
        (status = 200, description = "Password reset, new password returned"),
        (status = 403, description = "Account not in manager subtree"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "AD Delegation"
)]
#[tracing::instrument(skip_all, fields(account_id = %id))]
pub async fn reset_password(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    let person_id = resolve_caller_person(pool, claims.sub, ctx.tenant_id)
        .await?
        .ok_or(StatusCode::NOT_FOUND)?;
    let node_id = resolve_primary_node(pool, person_id)
        .await?
        .ok_or(StatusCode::UNPROCESSABLE_ENTITY)?;

    verify_account_in_subtree(pool, id, node_id).await?;

    // Generate a 16-char random password using UUID entropy (no external crate needed)
    let raw = Uuid::new_v4().to_string().replace('-', "");
    let password: String = raw.chars().take(16).collect();

    // Mark as pending sync so the DC connector picks it up
    sqlx::query(
        "UPDATE ad_user_accounts SET sync_status = 'pending', updated_at = NOW() WHERE id = $1",
    )
    .bind(id)
    .execute(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error marking account pending after password reset");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(account_id = %id, "AD password reset triggered by manager");
    Ok(Json(json!({ "id": id, "temporary_password": password })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 7: move_account
// ─────────────────────────────────────────────────────────────────────────────

/// Move an AD account to a different OU within the manager's subtree.
///
/// # Errors
///
/// - `400` if `target_ou_id` is missing from the request body.
/// - `403` if the account or the target OU is not in the manager's subtree.
/// - `500` on database failure.
///
/// # Panics
///
/// No panics — all errors propagated via `Result`.
#[utoipa::path(
    put,
    path = "/api/v1/workforce/ad/my-team/ad-accounts/{id}/move",
    params(("id" = Uuid, Path, description = "AD account UUID")),
    request_body(content = MoveAccountBody, description = "Target OU"),
    responses(
        (status = 200, description = "Account moved"),
        (status = 403, description = "Account or target OU not in manager subtree"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "AD Delegation"
)]
#[tracing::instrument(skip_all, fields(account_id = %id))]
pub async fn move_account(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<MoveAccountBody>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    let person_id = resolve_caller_person(pool, claims.sub, ctx.tenant_id)
        .await?
        .ok_or(StatusCode::NOT_FOUND)?;
    let node_id = resolve_primary_node(pool, person_id)
        .await?
        .ok_or(StatusCode::UNPROCESSABLE_ENTITY)?;

    verify_account_in_subtree(pool, id, node_id).await?;

    // Verify target OU is in the manager's subtree
    use sqlx::Row as _;
    let target_check = sqlx::query(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM ad_ous ou
            JOIN core.org_closure oc ON oc.descendant_id = ou.org_node_id
            WHERE ou.id = $1 AND oc.ancestor_id = $2
        ) AS ok
        "#,
    )
    .bind(body.target_ou_id)
    .bind(node_id)
    .fetch_one(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error verifying target OU");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !target_check.get::<bool, _>("ok") {
        return Err(StatusCode::FORBIDDEN);
    }

    // Fetch new OU's distinguished name to rebuild the account DN
    let ou_row: Option<(String,)> =
        sqlx::query_as("SELECT distinguished_name FROM ad_ous WHERE id = $1")
            .bind(body.target_ou_id)
            .fetch_optional(&**pool)
            .await
            .map_err(|e| {
                tracing::error!(?e, "DB error fetching target OU dn");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    let ou_dn = ou_row.map(|(dn,)| dn).ok_or(StatusCode::NOT_FOUND)?;

    // Fetch account display name to rebuild CN
    let account_row: Option<(String,)> =
        sqlx::query_as("SELECT display_name FROM ad_user_accounts WHERE id = $1")
            .bind(id)
            .fetch_optional(&**pool)
            .await
            .map_err(|e| {
                tracing::error!(?e, "DB error fetching account display name");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    let display_name = account_row.map(|(n,)| n).ok_or(StatusCode::NOT_FOUND)?;
    let new_dn = format!("CN={},{}", display_name, ou_dn);

    sqlx::query(
        r#"
        UPDATE ad_user_accounts
        SET distinguished_name = $1, ou_id = $2, sync_status = 'pending', updated_at = NOW()
        WHERE id = $3
        "#,
    )
    .bind(&new_dn)
    .bind(body.target_ou_id)
    .bind(id)
    .execute(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error moving account");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(account_id = %id, target_ou_id = %body.target_ou_id, "AD account moved");
    Ok(Json(json!({
        "id": id,
        "distinguished_name": new_dn,
        "ou_id": body.target_ou_id,
        "sync_status": "pending"
    })))
}

/// Request body for moving an AD account to a different OU.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct MoveAccountBody {
    /// UUID of the target AD OU.
    pub target_ou_id: Uuid,
}
