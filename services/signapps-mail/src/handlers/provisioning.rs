//! Org-aware email provisioning handlers.
//!
//! Provides endpoints to provision mailserver accounts for org members by
//! resolving their email address via the naming-rule hierarchy.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use signapps_common::Claims;

use crate::AppState;

use super::naming_rules::{resolve_address_internal, ResolvedAddress};

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// A provisioned mailserver account.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct MailserverAccount {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Person this account belongs to.
    pub person_id: Option<Uuid>,
    /// Full email address.
    pub address: String,
    /// Domain UUID.
    pub domain_id: Option<Uuid>,
    /// Whether the account is active.
    pub is_active: Option<bool>,
    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
}

/// Preview of what would be provisioned for a person.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct ProvisionPreview {
    /// Resolved email address.
    pub address: String,
    /// Domain part.
    pub domain: String,
    /// Pattern applied.
    pub pattern: String,
    /// Org node where the rule was found.
    pub rule_node: Uuid,
    /// Whether an account already exists for this person.
    pub already_provisioned: bool,
}

/// Result of bulk provisioning.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct BulkProvisionResult {
    /// Number of accounts created.
    pub provisioned: usize,
    /// Number of persons skipped (already had an account or no rule found).
    pub skipped: usize,
    /// Errors encountered (person_id → message).
    pub errors: Vec<ProvisionError>,
}

/// A single provisioning error.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct ProvisionError {
    /// Person UUID.
    pub person_id: Uuid,
    /// Error message.
    pub message: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Row used when looking up existing accounts.
#[derive(Debug, sqlx::FromRow)]
struct AccountExists {
    #[allow(dead_code)]
    id: Uuid,
}

/// Person ID row for bulk query.
#[derive(Debug, sqlx::FromRow)]
struct PersonIdRow {
    id: Uuid,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// Provision a mailserver account for a person.
///
/// Resolves the person's address via the org-hierarchy naming rules and
/// inserts a row into `mailserver.accounts`.
///
/// # Errors
///
/// Returns 404 if the person, assignment, rule, or domain cannot be found.
/// Returns 409 if an account already exists for the person.
#[utoipa::path(
    post,
    path = "/api/v1/mailserver/provision/{person_id}",
    tag = "mailserver-provisioning",
    security(("bearerAuth" = [])),
    params(("person_id" = Uuid, Path, description = "Person UUID")),
    responses(
        (status = 201, description = "Account provisioned", body = MailserverAccount),
        (status = 404, description = "Person / rule / domain not found"),
        (status = 409, description = "Account already exists"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn provision_person(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Path(person_id): Path<Uuid>,
) -> impl IntoResponse {
    // Check not already provisioned
    match sqlx::query_as::<_, AccountExists>(
        "SELECT id FROM mailserver.accounts WHERE person_id = $1 LIMIT 1",
    )
    .bind(person_id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(_)) => {
            return (
                StatusCode::CONFLICT,
                Json(serde_json::json!({ "error": "Account already exists for this person" })),
            )
                .into_response();
        },
        Err(e) => {
            tracing::error!(?e, "Failed to check existing account");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
        Ok(None) => {},
    }

    let resolved: ResolvedAddress = match resolve_address_internal(&state.pool, person_id).await {
        Ok(r) => r,
        Err(resp) => return resp,
    };

    // Look up domain_id
    let domain_id: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM mailserver.domains WHERE name = $1 LIMIT 1")
            .bind(&resolved.domain)
            .fetch_optional(&state.pool)
            .await
            .unwrap_or(None);

    match sqlx::query_as::<_, MailserverAccount>(
        r#"INSERT INTO mailserver.accounts
               (id, person_id, address, domain_id, is_active, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, true, NOW())
           RETURNING *"#,
    )
    .bind(person_id)
    .bind(&resolved.address)
    .bind(domain_id)
    .fetch_one(&state.pool)
    .await
    {
        Ok(account) => (StatusCode::CREATED, Json(account)).into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to provision account");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Preview provisioning for a person without creating any account.
///
/// # Errors
///
/// Returns 404 if the person, assignment, rule, or domain cannot be found.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/provision/{person_id}/preview",
    tag = "mailserver-provisioning",
    security(("bearerAuth" = [])),
    params(("person_id" = Uuid, Path, description = "Person UUID")),
    responses(
        (status = 200, description = "Preview of provisioning", body = ProvisionPreview),
        (status = 404, description = "Person / rule / domain not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn preview_provision(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Path(person_id): Path<Uuid>,
) -> impl IntoResponse {
    let resolved: ResolvedAddress = match resolve_address_internal(&state.pool, person_id).await {
        Ok(r) => r,
        Err(resp) => return resp,
    };

    let already_provisioned = sqlx::query_as::<_, AccountExists>(
        "SELECT id FROM mailserver.accounts WHERE person_id = $1 LIMIT 1",
    )
    .bind(person_id)
    .fetch_optional(&state.pool)
    .await
    .map(|r| r.is_some())
    .unwrap_or(false);

    Json(ProvisionPreview {
        address: resolved.address,
        domain: resolved.domain,
        pattern: resolved.pattern,
        rule_node: resolved.rule_node,
        already_provisioned,
    })
    .into_response()
}

/// Provision accounts for all employees not yet in mailserver.accounts.
///
/// Finds all persons with an employee role that do not already have a
/// mailserver account, resolves their address, and creates the account.
///
/// # Errors
///
/// Returns partial results: errors per person are included in the response.
#[utoipa::path(
    post,
    path = "/api/v1/mailserver/provision/bulk",
    tag = "mailserver-provisioning",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Bulk provisioning result", body = BulkProvisionResult),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn bulk_provision(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
) -> impl IntoResponse {
    // Find all persons with employee role not yet provisioned
    let candidates = match sqlx::query_as::<_, PersonIdRow>(
        r#"SELECT DISTINCT p.id
           FROM core.persons p
           JOIN core.assignments ca ON ca.person_id = p.id
           JOIN core.roles r ON r.id = ca.role_id
           WHERE r.name = 'employee'
             AND ca.end_date IS NULL
             AND p.id NOT IN (
                 SELECT person_id FROM mailserver.accounts WHERE person_id IS NOT NULL
             )"#,
    )
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!(?e, "Failed to fetch bulk provision candidates");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
    };

    let mut provisioned = 0usize;
    let mut skipped = 0usize;
    let mut errors: Vec<ProvisionError> = Vec::new();

    for row in candidates {
        let pid = row.id;
        let resolved = match resolve_address_internal(&state.pool, pid).await {
            Ok(r) => r,
            Err(_) => {
                skipped += 1;
                continue;
            },
        };

        let domain_id: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM mailserver.domains WHERE name = $1 LIMIT 1")
                .bind(&resolved.domain)
                .fetch_optional(&state.pool)
                .await
                .unwrap_or(None);

        match sqlx::query(
            r#"INSERT INTO mailserver.accounts
                   (id, person_id, address, domain_id, is_active, created_at)
               VALUES (gen_random_uuid(), $1, $2, $3, true, NOW())
               ON CONFLICT (address) DO NOTHING"#,
        )
        .bind(pid)
        .bind(&resolved.address)
        .bind(domain_id)
        .execute(&state.pool)
        .await
        {
            Ok(r) if r.rows_affected() > 0 => provisioned += 1,
            Ok(_) => skipped += 1,
            Err(e) => {
                tracing::error!(?e, person_id = %pid, "Failed to provision account in bulk");
                errors.push(ProvisionError {
                    person_id: pid,
                    message: e.to_string(),
                });
            },
        }
    }

    Json(BulkProvisionResult {
        provisioned,
        skipped,
        errors,
    })
    .into_response()
}
