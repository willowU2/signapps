//! My Team resolution handlers.
//!
//! Provides endpoints for a manager or employee to view their team hierarchy:
//! - Direct reports (N-1)
//! - Extended team (all descendants)
//! - Manager (N+1)
//! - Peers (same node, different person)
//! - Team summary and pending actions

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Resolve the person record for the currently authenticated user.
///
/// Returns `None` when no active `core.persons` row matches the JWT subject.
async fn resolve_person_id(
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
        tracing::error!(?e, "DB error resolving person");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(row.map(|(id,)| id))
}

/// Resolve the primary org node for a person.
async fn resolve_node_id(
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
        tracing::error!(?e, "DB error resolving node");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(row.map(|(id,)| id))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 1: get_my_team
// ─────────────────────────────────────────────────────────────────────────────

/// Get the direct team for the authenticated user (direct reports + manager).
#[utoipa::path(
    get,
    path = "/api/v1/workforce/my-team",
    responses(
        (status = 200, description = "Team resolved"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce My Team"
)]
#[tracing::instrument(skip_all)]
pub async fn get_my_team(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    let person_id = match resolve_person_id(pool, claims.sub, ctx.tenant_id).await? {
        Some(id) => id,
        None => {
            return Ok(Json(json!({
                "manager": null,
                "direct_reports": [],
                "team_size": 0,
                "has_reports": false
            })));
        }
    };

    let node_id = match resolve_node_id(pool, person_id).await? {
        Some(id) => id,
        None => {
            return Ok(Json(json!({
                "manager": null,
                "direct_reports": [],
                "team_size": 0,
                "has_reports": false
            })));
        }
    };

    // Direct reports: depth = 1
    let direct_reports: Vec<(Uuid, String, String, Option<String>, Option<String>)> =
        sqlx::query_as(
            r#"
            SELECT DISTINCT a.person_id, p.first_name, p.last_name, p.email, p.avatar_url
            FROM core.assignments a
            JOIN core.persons p ON p.id = a.person_id
            JOIN core.org_closure oc ON oc.descendant_id = a.node_id
            WHERE oc.ancestor_id = $1
              AND oc.depth = 1
              AND a.end_date IS NULL
              AND a.person_id != $2
            "#,
        )
        .bind(node_id)
        .bind(person_id)
        .fetch_all(&**pool)
        .await
        .map_err(|e| {
            tracing::error!(?e, "DB error fetching direct reports");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Manager: ancestor at depth 1 with assignment_type = 'holder'
    let manager: Option<(Uuid, String, String, Option<String>, Option<String>)> =
        sqlx::query_as(
            r#"
            SELECT p.id, p.first_name, p.last_name, p.email, p.avatar_url
            FROM core.assignments a
            JOIN core.persons p ON p.id = a.person_id
            JOIN core.org_closure oc ON oc.descendant_id = $1
            WHERE oc.depth = 1
              AND a.node_id = oc.ancestor_id
              AND a.assignment_type = 'holder'
              AND a.end_date IS NULL
            LIMIT 1
            "#,
        )
        .bind(node_id)
        .fetch_optional(&**pool)
        .await
        .map_err(|e| {
            tracing::error!(?e, "DB error fetching manager");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let team_size = direct_reports.len();
    let has_reports = team_size > 0;

    let reports_json: Vec<_> = direct_reports
        .into_iter()
        .map(|(id, first, last, email, avatar)| {
            json!({ "id": id, "first_name": first, "last_name": last, "email": email, "avatar_url": avatar })
        })
        .collect();

    let manager_json = manager.map(|(id, first, last, email, avatar)| {
        json!({ "id": id, "first_name": first, "last_name": last, "email": email, "avatar_url": avatar })
    });

    Ok(Json(json!({
        "manager": manager_json,
        "direct_reports": reports_json,
        "team_size": team_size,
        "has_reports": has_reports
    })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 2: get_extended_team
// ─────────────────────────────────────────────────────────────────────────────

/// Get the full extended team for the authenticated user (all descendants).
#[utoipa::path(
    get,
    path = "/api/v1/workforce/my-team/extended",
    responses(
        (status = 200, description = "Extended team resolved"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce My Team"
)]
#[tracing::instrument(skip_all)]
pub async fn get_extended_team(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    let person_id = match resolve_person_id(pool, claims.sub, ctx.tenant_id).await? {
        Some(id) => id,
        None => {
            return Ok(Json(json!({
                "manager": null,
                "extended_team": [],
                "team_size": 0
            })));
        }
    };

    let node_id = match resolve_node_id(pool, person_id).await? {
        Some(id) => id,
        None => {
            return Ok(Json(json!({
                "manager": null,
                "extended_team": [],
                "team_size": 0
            })));
        }
    };

    // All descendants: depth > 0
    let members: Vec<(Uuid, String, String, Option<String>, Option<String>, i32)> =
        sqlx::query_as(
            r#"
            SELECT DISTINCT a.person_id, p.first_name, p.last_name, p.email, p.avatar_url, oc.depth
            FROM core.assignments a
            JOIN core.persons p ON p.id = a.person_id
            JOIN core.org_closure oc ON oc.descendant_id = a.node_id
            WHERE oc.ancestor_id = $1
              AND oc.depth > 0
              AND a.end_date IS NULL
              AND a.person_id != $2
            ORDER BY oc.depth
            "#,
        )
        .bind(node_id)
        .bind(person_id)
        .fetch_all(&**pool)
        .await
        .map_err(|e| {
            tracing::error!(?e, "DB error fetching extended team");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Manager
    let manager: Option<(Uuid, String, String, Option<String>, Option<String>)> =
        sqlx::query_as(
            r#"
            SELECT p.id, p.first_name, p.last_name, p.email, p.avatar_url
            FROM core.assignments a
            JOIN core.persons p ON p.id = a.person_id
            JOIN core.org_closure oc ON oc.descendant_id = $1
            WHERE oc.depth = 1
              AND a.node_id = oc.ancestor_id
              AND a.assignment_type = 'holder'
              AND a.end_date IS NULL
            LIMIT 1
            "#,
        )
        .bind(node_id)
        .fetch_optional(&**pool)
        .await
        .map_err(|e| {
            tracing::error!(?e, "DB error fetching manager for extended team");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let team_size = members.len();
    let members_json: Vec<_> = members
        .into_iter()
        .map(|(id, first, last, email, avatar, depth)| {
            json!({ "id": id, "first_name": first, "last_name": last, "email": email, "avatar_url": avatar, "depth": depth })
        })
        .collect();

    let manager_json = manager.map(|(id, first, last, email, avatar)| {
        json!({ "id": id, "first_name": first, "last_name": last, "email": email, "avatar_url": avatar })
    });

    Ok(Json(json!({
        "manager": manager_json,
        "extended_team": members_json,
        "team_size": team_size
    })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 3: get_manager
// ─────────────────────────────────────────────────────────────────────────────

/// Get the manager of the authenticated user.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/my-team/manager",
    responses(
        (status = 200, description = "Manager resolved (null if none)"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce My Team"
)]
#[tracing::instrument(skip_all)]
pub async fn get_manager(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    let person_id = match resolve_person_id(pool, claims.sub, ctx.tenant_id).await? {
        Some(id) => id,
        None => return Ok(Json(json!({ "manager": null }))),
    };

    let node_id = match resolve_node_id(pool, person_id).await? {
        Some(id) => id,
        None => return Ok(Json(json!({ "manager": null }))),
    };

    let manager: Option<(Uuid, String, String, Option<String>, Option<String>)> =
        sqlx::query_as(
            r#"
            SELECT p.id, p.first_name, p.last_name, p.email, p.avatar_url
            FROM core.assignments a
            JOIN core.persons p ON p.id = a.person_id
            JOIN core.org_closure oc ON oc.descendant_id = $1
            WHERE oc.depth = 1
              AND a.node_id = oc.ancestor_id
              AND a.assignment_type = 'holder'
              AND a.end_date IS NULL
            LIMIT 1
            "#,
        )
        .bind(node_id)
        .fetch_optional(&**pool)
        .await
        .map_err(|e| {
            tracing::error!(?e, "DB error fetching manager");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let manager_json = manager.map(|(id, first, last, email, avatar)| {
        json!({ "id": id, "first_name": first, "last_name": last, "email": email, "avatar_url": avatar })
    });

    Ok(Json(json!({ "manager": manager_json })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 4: get_peers
// ─────────────────────────────────────────────────────────────────────────────

/// Get peers of the authenticated user (same primary node, different person).
#[utoipa::path(
    get,
    path = "/api/v1/workforce/my-team/peers",
    responses(
        (status = 200, description = "Peers resolved"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce My Team"
)]
#[tracing::instrument(skip_all)]
pub async fn get_peers(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    let person_id = match resolve_person_id(pool, claims.sub, ctx.tenant_id).await? {
        Some(id) => id,
        None => return Ok(Json(json!({ "peers": [] }))),
    };

    let node_id = match resolve_node_id(pool, person_id).await? {
        Some(id) => id,
        None => return Ok(Json(json!({ "peers": [] }))),
    };

    let peers: Vec<(Uuid, String, String, Option<String>, Option<String>)> = sqlx::query_as(
        r#"
        SELECT a.person_id, p.first_name, p.last_name, p.email, p.avatar_url
        FROM core.assignments a
        JOIN core.persons p ON p.id = a.person_id
        WHERE a.node_id = $1
          AND a.person_id != $2
          AND a.end_date IS NULL
        "#,
    )
    .bind(node_id)
    .bind(person_id)
    .fetch_all(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error fetching peers");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let peers_json: Vec<_> = peers
        .into_iter()
        .map(|(id, first, last, email, avatar)| {
            json!({ "id": id, "first_name": first, "last_name": last, "email": email, "avatar_url": avatar })
        })
        .collect();

    Ok(Json(json!({ "peers": peers_json })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 5: get_team_summary
// ─────────────────────────────────────────────────────────────────────────────

/// Get a summary of the team managed by the authenticated user.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/my-team/summary",
    responses(
        (status = 200, description = "Team summary"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce My Team"
)]
#[tracing::instrument(skip_all)]
pub async fn get_team_summary(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    let person_id = match resolve_person_id(pool, claims.sub, ctx.tenant_id).await? {
        Some(id) => id,
        None => {
            return Ok(Json(json!({
                "team_size": 0,
                "on_leave_today": 0,
                "pending_leaves": 0,
                "pending_timesheets": 0,
                "avg_fte": 0.0
            })));
        }
    };

    let node_id = match resolve_node_id(pool, person_id).await? {
        Some(id) => id,
        None => {
            return Ok(Json(json!({
                "team_size": 0,
                "on_leave_today": 0,
                "pending_leaves": 0,
                "pending_timesheets": 0,
                "avg_fte": 0.0
            })));
        }
    };

    // Count direct reports
    let count_row: Option<(i64,)> = sqlx::query_as(
        r#"
        SELECT COUNT(DISTINCT a.person_id)
        FROM core.assignments a
        JOIN core.org_closure oc ON oc.descendant_id = a.node_id
        WHERE oc.ancestor_id = $1
          AND oc.depth = 1
          AND a.end_date IS NULL
          AND a.person_id != $2
        "#,
    )
    .bind(node_id)
    .bind(person_id)
    .fetch_optional(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error counting team");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let team_size = count_row.map(|(c,)| c).unwrap_or(0);

    // Average FTE ratio for direct reports
    let avg_fte_row: Option<(Option<f64>,)> = sqlx::query_as(
        r#"
        SELECT AVG(a.fte_ratio)
        FROM core.assignments a
        JOIN core.org_closure oc ON oc.descendant_id = a.node_id
        WHERE oc.ancestor_id = $1
          AND oc.depth = 1
          AND a.end_date IS NULL
          AND a.person_id != $2
        "#,
    )
    .bind(node_id)
    .bind(person_id)
    .fetch_optional(&**pool)
    .await
    .unwrap_or(None);

    let avg_fte = avg_fte_row
        .and_then(|(v,)| v)
        .unwrap_or(1.0);

    Ok(Json(json!({
        "team_size": team_size,
        "on_leave_today": 0,
        "pending_leaves": 0,
        "pending_timesheets": 0,
        "avg_fte": avg_fte
    })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 6: get_pending_actions
// ─────────────────────────────────────────────────────────────────────────────

/// Get pending actions for the authenticated manager (leave/timesheet approvals).
///
/// Returns an empty list if approval tables do not yet exist.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/my-team/pending-actions",
    responses(
        (status = 200, description = "Pending actions list"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce My Team"
)]
#[tracing::instrument(skip_all)]
pub async fn get_pending_actions(
    State(_state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    // Placeholder: leave/timesheet approval tables may not exist yet.
    // Returns empty list so callers always get a valid response.
    Ok(Json(json!({ "pending_actions": [] })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 7: approve_leave
// ─────────────────────────────────────────────────────────────────────────────

/// Approve a leave request on behalf of the team manager.
///
/// Placeholder — will be wired to a leave approval table when available.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/my-team/leaves/{id}/approve",
    responses(
        (status = 200, description = "Leave approved"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Workforce My Team"
)]
#[tracing::instrument(skip_all)]
pub async fn approve_leave(
    State(_state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    Ok(Json(json!({ "status": "approved" })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 8: reject_leave
// ─────────────────────────────────────────────────────────────────────────────

/// Reject a leave request on behalf of the team manager.
///
/// Placeholder — will be wired to a leave approval table when available.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/my-team/leaves/{id}/reject",
    responses(
        (status = 200, description = "Leave rejected"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Workforce My Team"
)]
#[tracing::instrument(skip_all)]
pub async fn reject_leave(
    State(_state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    Ok(Json(json!({ "status": "rejected" })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 9: approve_timesheet
// ─────────────────────────────────────────────────────────────────────────────

/// Approve a timesheet submission on behalf of the team manager.
///
/// Placeholder — will be wired to a timesheet approval table when available.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/my-team/timesheets/{id}/approve",
    responses(
        (status = 200, description = "Timesheet approved"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Workforce My Team"
)]
#[tracing::instrument(skip_all)]
pub async fn approve_timesheet(
    State(_state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    Ok(Json(json!({ "status": "approved" })))
}
