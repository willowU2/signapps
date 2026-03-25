//! Email template CRUD handler — AQ-EMTPL.
//!
//! CRUD for mail.email_templates — templates with variable substitution.

use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// Domain types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EmailTemplate {
    pub id: Uuid,
    pub account_id: Uuid,
    pub name: String,
    pub subject: String,
    pub body_html: String,
    pub variables: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// Request DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub account_id: Uuid,
    pub name: String,
    pub subject: Option<String>,
    pub body_html: Option<String>,
    /// JSON array of variable names, e.g. ["prenom","entreprise"]
    pub variables: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTemplateRequest {
    pub name: Option<String>,
    pub subject: Option<String>,
    pub body_html: Option<String>,
    pub variables: Option<serde_json::Value>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/mail/templates?account_id=...
pub async fn list_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let account_id: Option<Uuid> = params.get("account_id").and_then(|v| v.parse().ok());

    let result = if let Some(acc_id) = account_id {
        sqlx::query_as::<_, EmailTemplate>(
            "SELECT * FROM mail.email_templates WHERE account_id = $1 ORDER BY name ASC",
        )
        .bind(acc_id)
        .fetch_all(&state.pool)
        .await
    } else {
        // Return templates for all accounts owned by the user (via accounts table)
        sqlx::query_as::<_, EmailTemplate>(
            r#"SELECT t.* FROM mail.email_templates t
               JOIN mail.accounts a ON a.id = t.account_id
               WHERE a.user_id = $1
               ORDER BY t.name ASC"#,
        )
        .bind(claims.sub)
        .fetch_all(&state.pool)
        .await
    };

    match result {
        Ok(templates) => Json(templates).into_response(),
        Err(e) => {
            tracing::error!("Failed to list templates: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}

/// GET /api/v1/mail/templates/:id
pub async fn get_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, EmailTemplate>("SELECT * FROM mail.email_templates WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
    {
        Ok(Some(t)) => Json(t).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Template not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// POST /api/v1/mail/templates
pub async fn create_template(
    State(state): State<AppState>,
    Json(payload): Json<CreateTemplateRequest>,
) -> impl IntoResponse {
    if payload.name.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, "Template name must not be empty").into_response();
    }

    let result = sqlx::query_as::<_, EmailTemplate>(
        r#"INSERT INTO mail.email_templates (account_id, name, subject, body_html, variables)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *"#,
    )
    .bind(payload.account_id)
    .bind(&payload.name)
    .bind(payload.subject.as_deref().unwrap_or(""))
    .bind(payload.body_html.as_deref().unwrap_or(""))
    .bind(payload.variables.unwrap_or(serde_json::json!([])))
    .fetch_one(&state.pool)
    .await;

    match result {
        Ok(t) => (StatusCode::CREATED, Json(t)).into_response(),
        Err(e) => {
            tracing::error!("Failed to create template: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}

/// PUT /api/v1/mail/templates/:id
pub async fn update_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTemplateRequest>,
) -> impl IntoResponse {
    let result = sqlx::query_as::<_, EmailTemplate>(
        r#"UPDATE mail.email_templates
           SET name       = COALESCE($2, name),
               subject    = COALESCE($3, subject),
               body_html  = COALESCE($4, body_html),
               variables  = COALESCE($5, variables),
               updated_at = NOW()
           WHERE id = $1
           RETURNING *"#,
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.subject)
    .bind(&payload.body_html)
    .bind(payload.variables)
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(t)) => Json(t).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Template not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to update template {}: {}", id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        },
    }
}

/// DELETE /api/v1/mail/templates/:id
pub async fn delete_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM mail.email_templates WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
    {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, "Template not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
