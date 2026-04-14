//! Org-aware email naming rules handlers.
//!
//! Provides CRUD endpoints for mailserver naming rules and an address-resolution
//! endpoint that walks the org hierarchy to apply the nearest rule.

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

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// A mailserver naming rule linked to an org node.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct NamingRule {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Org node this rule applies to.
    pub node_id: Uuid,
    /// Address pattern, e.g. `{first_name}.{last_name}`.
    pub pattern: String,
    /// Domain to use (optional; if absent, walks up for a domain).
    pub domain_id: Option<Uuid>,
    /// Collision strategy: `increment` | `initial` | `error`.
    pub collision_strategy: Option<String>,
    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
    /// Row last-update timestamp.
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request payload to create a naming rule.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateNamingRuleRequest {
    /// Org node this rule applies to.
    pub node_id: Uuid,
    /// Address pattern (e.g. `{first_name}.{last_name}`).
    pub pattern: String,
    /// Optional domain UUID.
    pub domain_id: Option<Uuid>,
    /// Collision strategy (`increment`, `initial`, `error`).
    pub collision_strategy: Option<String>,
}

/// Request payload to update a naming rule.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateNamingRuleRequest {
    /// New pattern (optional).
    pub pattern: Option<String>,
    /// New domain UUID (optional).
    pub domain_id: Option<Uuid>,
    /// New collision strategy (optional).
    pub collision_strategy: Option<String>,
}

/// Resolved email address for a person.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct ResolvedAddress {
    /// Full email address.
    pub address: String,
    /// Domain part.
    pub domain: String,
    /// Pattern that was applied.
    pub pattern: String,
    /// Org node where the rule was found.
    pub rule_node: Uuid,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List all naming rules.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/naming-rules",
    tag = "mailserver-naming-rules",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of naming rules", body = Vec<NamingRule>),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_naming_rules(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, NamingRule>(
        "SELECT * FROM mailserver.naming_rules ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    {
        Ok(rules) => Json(rules).into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to list naming rules");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Create a naming rule.
#[utoipa::path(
    post,
    path = "/api/v1/mailserver/naming-rules",
    tag = "mailserver-naming-rules",
    request_body = CreateNamingRuleRequest,
    security(("bearerAuth" = [])),
    responses(
        (status = 201, description = "Naming rule created", body = NamingRule),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create_naming_rule(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Json(body): Json<CreateNamingRuleRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, NamingRule>(
        r#"INSERT INTO mailserver.naming_rules
               (id, node_id, pattern, domain_id, collision_strategy, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
           RETURNING *"#,
    )
    .bind(body.node_id)
    .bind(&body.pattern)
    .bind(body.domain_id)
    .bind(&body.collision_strategy)
    .fetch_one(&state.pool)
    .await
    {
        Ok(rule) => (StatusCode::CREATED, Json(rule)).into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to create naming rule");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Update a naming rule.
#[utoipa::path(
    put,
    path = "/api/v1/mailserver/naming-rules/{id}",
    tag = "mailserver-naming-rules",
    request_body = UpdateNamingRuleRequest,
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Naming rule UUID")),
    responses(
        (status = 200, description = "Updated naming rule", body = NamingRule),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn update_naming_rule(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateNamingRuleRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, NamingRule>(
        r#"UPDATE mailserver.naming_rules
           SET pattern            = COALESCE($2, pattern),
               domain_id         = COALESCE($3, domain_id),
               collision_strategy = COALESCE($4, collision_strategy),
               updated_at        = NOW()
           WHERE id = $1
           RETURNING *"#,
    )
    .bind(id)
    .bind(&body.pattern)
    .bind(body.domain_id)
    .bind(&body.collision_strategy)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(rule)) => Json(rule).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Naming rule not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to update naming rule");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Delete a naming rule.
#[utoipa::path(
    delete,
    path = "/api/v1/mailserver/naming-rules/{id}",
    tag = "mailserver-naming-rules",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Naming rule UUID")),
    responses(
        (status = 204, description = "Deleted"),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn delete_naming_rule(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM mailserver.naming_rules WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
    {
        Ok(r) if r.rows_affected() == 0 => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Naming rule not found" })),
        )
            .into_response(),
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to delete naming rule");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

// ---------------------------------------------------------------------------
// Internal helper: walk org closure to resolve an address for a person node.
// ---------------------------------------------------------------------------

/// Row returned from core.persons
#[derive(Debug, sqlx::FromRow)]
struct PersonRow {
    first_name: String,
    last_name: String,
}

/// Row returned from core.assignments
#[derive(Debug, sqlx::FromRow)]
struct AssignmentRow {
    node_id: Uuid,
}

/// Rule row with depth for closure walk
#[derive(Debug, sqlx::FromRow)]
struct RuleWithDepth {
    #[allow(dead_code)]
    id: Uuid,
    node_id: Uuid,
    pattern: String,
    domain_id: Option<Uuid>,
    #[allow(dead_code)]
    collision_strategy: Option<String>,
    #[allow(dead_code)]
    depth: i32,
}

/// Domain row
#[derive(Debug, sqlx::FromRow)]
struct DomainRow {
    name: String,
}

/// Resolve the email address for a person following org hierarchy rules.
///
/// # Errors
///
/// Returns an `IntoResponse` error on database failure or when required data
/// (person, assignment, rule, domain) cannot be found.
pub async fn resolve_address_internal(
    pool: &sqlx::PgPool,
    person_id: Uuid,
) -> Result<ResolvedAddress, axum::response::Response> {
    // 1. Get person
    let person = sqlx::query_as::<_, PersonRow>(
        "SELECT first_name, last_name FROM core.persons WHERE id = $1",
    )
    .bind(person_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "Failed to fetch person");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Database error" })),
        )
            .into_response()
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Person not found" })),
        )
            .into_response()
    })?;

    // 2. Get primary assignment node
    let assignment = sqlx::query_as::<_, AssignmentRow>(
        "SELECT node_id FROM core.assignments WHERE person_id = $1 AND is_primary = true AND end_date IS NULL LIMIT 1",
    )
    .bind(person_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "Failed to fetch assignment");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Database error" })),
        )
            .into_response()
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "No primary assignment found for person" })),
        )
            .into_response()
    })?;

    // 3. Walk org_closure to find the nearest naming rule
    let rule = sqlx::query_as::<_, RuleWithDepth>(
        r#"SELECT nr.id, nr.node_id, nr.pattern, nr.domain_id, nr.collision_strategy,
                  oc.depth
           FROM mailserver.naming_rules nr
           JOIN core.org_closure oc ON oc.ancestor_id = nr.node_id
           WHERE oc.descendant_id = $1
           ORDER BY oc.depth ASC
           LIMIT 1"#,
    )
    .bind(assignment.node_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "Failed to walk org closure for naming rule");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Database error" })),
        )
            .into_response()
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "No naming rule found in org hierarchy" })),
        )
            .into_response()
    })?;

    // 4. Resolve domain: rule's domain_id or walk up for first domain
    let domain_name = if let Some(did) = rule.domain_id {
        sqlx::query_as::<_, DomainRow>("SELECT name FROM mailserver.domains WHERE id = $1")
            .bind(did)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                tracing::error!(?e, "Failed to fetch domain");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({ "error": "Database error" })),
                )
                    .into_response()
            })?
            .map(|d| d.name)
    } else {
        // Walk up for first domain attached to an org node
        sqlx::query_as::<_, DomainRow>(
            r#"SELECT d.name
               FROM mailserver.domains d
               JOIN core.org_nodes n ON n.domain_id = d.id
               JOIN core.org_closure oc ON oc.ancestor_id = n.id
               WHERE oc.descendant_id = $1
               ORDER BY oc.depth ASC
               LIMIT 1"#,
        )
        .bind(assignment.node_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            tracing::error!(?e, "Failed to walk org for domain");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        })?
        .map(|d| d.name)
    };

    let domain = domain_name.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "No domain found in org hierarchy" })),
        )
            .into_response()
    })?;

    // 5. Apply pattern — normalise: lowercase, strip accents (basic ASCII fold)
    let first = ascii_fold(&person.first_name).to_lowercase();
    let last = ascii_fold(&person.last_name).to_lowercase();
    let local = rule
        .pattern
        .replace("{first_name}", &first)
        .replace("{last_name}", &last);

    let address = format!("{local}@{domain}");

    Ok(ResolvedAddress {
        address,
        domain,
        pattern: rule.pattern,
        rule_node: rule.node_id,
    })
}

/// Basic ASCII fold for common accented characters.
fn ascii_fold(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'à' | 'â' | 'ä' | 'á' | 'ã' | 'å' => 'a',
            'è' | 'ê' | 'ë' | 'é' => 'e',
            'ì' | 'î' | 'ï' | 'í' => 'i',
            'ò' | 'ô' | 'ö' | 'ó' | 'õ' | 'ø' => 'o',
            'ù' | 'û' | 'ü' | 'ú' => 'u',
            'ç' | 'ć' | 'č' => 'c',
            'ñ' | 'ń' => 'n',
            'ý' | 'ÿ' => 'y',
            'ß' => 's',
            other => other,
        })
        .collect()
}

/// Resolve the email address for a person by walking the org hierarchy.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/naming-rules/resolve/{person_id}",
    tag = "mailserver-naming-rules",
    security(("bearerAuth" = [])),
    params(("person_id" = Uuid, Path, description = "Person UUID")),
    responses(
        (status = 200, description = "Resolved address", body = ResolvedAddress),
        (status = 404, description = "Person, assignment, rule, or domain not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn resolve_address(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Path(person_id): Path<Uuid>,
) -> impl IntoResponse {
    match resolve_address_internal(&state.pool, person_id).await {
        Ok(resolved) => Json(resolved).into_response(),
        Err(err_response) => err_response,
    }
}
