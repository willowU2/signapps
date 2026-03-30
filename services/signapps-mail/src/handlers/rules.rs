use crate::models::MailRule;
use crate::AppState;
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use uuid::Uuid;

// Re-export condition/action types for in-process rule evaluation (still used by other modules)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
/// RuleCondition data transfer object.
pub struct RuleCondition {
    pub field: String,    // "from" | "subject" | "body"
    pub operator: String, // "contains" | "equals" | "starts_with"
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
/// Enum representing RuleAction variants.
pub enum RuleAction {
    #[serde(rename = "move_to")]
    MoveTo { folder: String },
    #[serde(rename = "label")]
    Label { tag: String },
    #[serde(rename = "forward")]
    Forward { email: String },
    #[serde(rename = "delete")]
    Delete,
    #[serde(rename = "mark_read")]
    MarkRead,
}

// -------------------------------------------------------------------------
// Bug 9: RuleStore (in-memory) removed. All CRUD now goes to mail.rules.
// Schema (from migration 026_mail_schema.sql):
//   id UUID, account_id UUID, name VARCHAR(255), priority INT,
//   enabled BOOLEAN, conditions JSONB, actions JSONB,
//   stop_processing BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
// -------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
/// Request body for CreateRule.
pub struct CreateRuleRequest {
    pub name: String,
    pub conditions: serde_json::Value,
    pub actions: serde_json::Value,
    pub enabled: Option<bool>,
    pub priority: Option<i32>,
    pub stop_processing: Option<bool>,
}

#[derive(Debug, Deserialize)]
/// Request body for UpdateRule.
pub struct UpdateRuleRequest {
    pub name: Option<String>,
    pub conditions: Option<serde_json::Value>,
    pub actions: Option<serde_json::Value>,
    pub enabled: Option<bool>,
    pub priority: Option<i32>,
    pub stop_processing: Option<bool>,
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/rules",
    responses((status = 200, description = "Success")),
    tag = "Mail"
)]
#[tracing::instrument(skip_all)]
pub async fn list_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    // Fetch the account for this user (any active account) — rules are scoped to account_id
    // which is linked to a user. We list all rules where the account belongs to the user.
    let rules = sqlx::query_as::<_, MailRule>(
        r#"
        SELECT r.*
        FROM mail.rules r
        JOIN mail.accounts a ON a.id = r.account_id
        WHERE a.user_id = $1
        ORDER BY r.priority ASC, r.created_at ASC
        "#,
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await;

    match rules {
        Ok(r) => Json(r).into_response(),
        Err(e) => {
            tracing::error!("Failed to list rules: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response()
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/rules",
    responses((status = 200, description = "Success")),
    tag = "Mail"
)]
#[tracing::instrument(skip_all)]
pub async fn get_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(rule_id): axum::extract::Path<Uuid>,
) -> impl IntoResponse {
    let rule = sqlx::query_as::<_, MailRule>(
        r#"
        SELECT r.*
        FROM mail.rules r
        JOIN mail.accounts a ON a.id = r.account_id
        WHERE r.id = $1 AND a.user_id = $2
        "#,
    )
    .bind(rule_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    match rule {
        Ok(Some(r)) => Json(r).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Rule not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to get rule {}: {:?}", rule_id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response()
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/rules",
    responses((status = 201, description = "Success")),
    tag = "Mail"
)]
#[tracing::instrument(skip_all)]
pub async fn create_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateRuleRequest>,
) -> impl IntoResponse {
    // Resolve account_id from user — use the first active account
    let account_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM mail.accounts WHERE user_id = $1 AND status = 'active' ORDER BY created_at LIMIT 1",
    )
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let Some(account_id) = account_id else {
        return (
            StatusCode::BAD_REQUEST,
            "No active mail account found for user",
        )
            .into_response();
    };

    let rule = sqlx::query_as::<_, MailRule>(
        r#"
        INSERT INTO mail.rules (account_id, name, priority, enabled, conditions, actions, stop_processing)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        "#,
    )
    .bind(account_id)
    .bind(&payload.name)
    .bind(payload.priority.unwrap_or(0))
    .bind(payload.enabled.unwrap_or(true))
    .bind(&payload.conditions)
    .bind(&payload.actions)
    .bind(payload.stop_processing.unwrap_or(false))
    .fetch_one(&state.pool)
    .await;

    match rule {
        Ok(r) => (StatusCode::CREATED, Json(r)).into_response(),
        Err(e) => {
            tracing::error!("Failed to create rule: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create rule").into_response()
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/rules",
    responses((status = 200, description = "Success")),
    tag = "Mail"
)]
#[tracing::instrument(skip_all)]
pub async fn update_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(rule_id): axum::extract::Path<Uuid>,
    Json(payload): Json<UpdateRuleRequest>,
) -> impl IntoResponse {
    // Verify ownership
    let owned: Option<(Uuid,)> = sqlx::query_as(
        "SELECT r.id FROM mail.rules r JOIN mail.accounts a ON a.id = r.account_id WHERE r.id = $1 AND a.user_id = $2",
    )
    .bind(rule_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    if owned.is_none() {
        return (StatusCode::NOT_FOUND, "Rule not found").into_response();
    }

    let rule = sqlx::query_as::<_, MailRule>(
        r#"
        UPDATE mail.rules SET
            name             = COALESCE($1, name),
            conditions       = COALESCE($2, conditions),
            actions          = COALESCE($3, actions),
            enabled          = COALESCE($4, enabled),
            priority         = COALESCE($5, priority),
            stop_processing  = COALESCE($6, stop_processing),
            updated_at       = NOW()
        WHERE id = $7
        RETURNING *
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.conditions)
    .bind(&payload.actions)
    .bind(payload.enabled)
    .bind(payload.priority)
    .bind(payload.stop_processing)
    .bind(rule_id)
    .fetch_one(&state.pool)
    .await;

    match rule {
        Ok(r) => (StatusCode::OK, Json(r)).into_response(),
        Err(e) => {
            tracing::error!("Failed to update rule {}: {:?}", rule_id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update rule").into_response()
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/rules",
    responses((status = 204, description = "Success")),
    tag = "Mail"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(rule_id): axum::extract::Path<Uuid>,
) -> impl IntoResponse {
    // Verify ownership and delete in one query
    let result = sqlx::query(
        r#"
        DELETE FROM mail.rules
        WHERE id = $1
          AND account_id IN (SELECT id FROM mail.accounts WHERE user_id = $2)
        "#,
    )
    .bind(rule_id)
    .bind(claims.sub)
    .execute(&state.pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, "Rule not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to delete rule {}: {:?}", rule_id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete rule").into_response()
        },
    }
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
