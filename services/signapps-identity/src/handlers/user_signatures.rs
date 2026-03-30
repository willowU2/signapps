//! User signature/stamp management handlers.
//!
//! CRUD endpoints for managing a user's personal signatures (drawn, typed, image)
//! and stamps used for document signing workflows.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// Domain types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserSignature {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub signature_type: String,
    pub image_data: Option<String>,
    pub storage_ref: Option<String>,
    pub display_name: Option<String>,
    pub title: Option<String>,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// Request DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateUserSignatureRequest {
    pub name: String,
    /// "drawn" | "typed" | "image" | "stamp"
    pub signature_type: Option<String>,
    /// Base64-encoded image data
    pub image_data: Option<String>,
    /// Reference to a file in storage service
    pub storage_ref: Option<String>,
    pub display_name: Option<String>,
    pub title: Option<String>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserSignatureRequest {
    pub name: Option<String>,
    pub signature_type: Option<String>,
    pub image_data: Option<String>,
    pub storage_ref: Option<String>,
    pub display_name: Option<String>,
    pub title: Option<String>,
    pub is_default: Option<bool>,
}

// ============================================================================
// Handlers
// ============================================================================

/// `GET /api/v1/user-signatures` — List all signatures for the authenticated user.
#[tracing::instrument(skip_all)]
pub async fn list_user_signatures(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<UserSignature>>> {
    let sigs = sqlx::query_as::<_, UserSignature>(
        r#"
        SELECT id, user_id, name, signature_type, image_data, storage_ref,
               display_name, title, is_default, created_at, updated_at
        FROM identity.user_signatures
        WHERE user_id = $1
        ORDER BY is_default DESC, created_at DESC
        "#,
    )
    .bind(claims.sub)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(Json(sigs))
}

/// `POST /api/v1/user-signatures` — Create a new signature.
#[tracing::instrument(skip_all)]
pub async fn create_user_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateUserSignatureRequest>,
) -> Result<(StatusCode, Json<UserSignature>)> {
    if payload.name.trim().is_empty() {
        return Err(Error::BadRequest(
            "Signature name must not be empty".to_string(),
        ));
    }

    // If marking as default, unset other defaults first
    if payload.is_default.unwrap_or(false) {
        let _ = sqlx::query(
            "UPDATE identity.user_signatures SET is_default = false WHERE user_id = $1",
        )
        .bind(claims.sub)
        .execute(state.pool.inner())
        .await;
    }

    let sig = sqlx::query_as::<_, UserSignature>(
        r#"
        INSERT INTO identity.user_signatures
            (user_id, name, signature_type, image_data, storage_ref, display_name, title, is_default)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, user_id, name, signature_type, image_data, storage_ref,
                  display_name, title, is_default, created_at, updated_at
        "#,
    )
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(payload.signature_type.as_deref().unwrap_or("drawn"))
    .bind(&payload.image_data)
    .bind(&payload.storage_ref)
    .bind(&payload.display_name)
    .bind(&payload.title)
    .bind(payload.is_default.unwrap_or(false))
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    tracing::info!(sig_id = %sig.id, user_id = %claims.sub, "User signature created");
    Ok((StatusCode::CREATED, Json(sig)))
}

/// `GET /api/v1/user-signatures/:id` — Get a single signature.
#[tracing::instrument(skip_all)]
pub async fn get_user_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<UserSignature>> {
    let sig = sqlx::query_as::<_, UserSignature>(
        r#"
        SELECT id, user_id, name, signature_type, image_data, storage_ref,
               display_name, title, is_default, created_at, updated_at
        FROM identity.user_signatures
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or_else(|| Error::NotFound(format!("Signature {id}")))?;

    Ok(Json(sig))
}

/// `PUT /api/v1/user-signatures/:id` — Update a signature.
#[tracing::instrument(skip_all)]
pub async fn update_user_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateUserSignatureRequest>,
) -> Result<Json<UserSignature>> {
    // If marking as default, unset other defaults first
    if payload.is_default == Some(true) {
        let _ = sqlx::query(
            "UPDATE identity.user_signatures SET is_default = false WHERE user_id = $1 AND id != $2",
        )
        .bind(claims.sub)
        .bind(id)
        .execute(state.pool.inner())
        .await;
    }

    let sig = sqlx::query_as::<_, UserSignature>(
        r#"
        UPDATE identity.user_signatures SET
            name = COALESCE($3, name),
            signature_type = COALESCE($4, signature_type),
            image_data = COALESCE($5, image_data),
            storage_ref = COALESCE($6, storage_ref),
            display_name = COALESCE($7, display_name),
            title = COALESCE($8, title),
            is_default = COALESCE($9, is_default),
            updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, name, signature_type, image_data, storage_ref,
                  display_name, title, is_default, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(&payload.signature_type)
    .bind(&payload.image_data)
    .bind(&payload.storage_ref)
    .bind(&payload.display_name)
    .bind(&payload.title)
    .bind(payload.is_default)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or_else(|| Error::NotFound(format!("Signature {id}")))?;

    Ok(Json(sig))
}

/// `DELETE /api/v1/user-signatures/:id` — Delete a signature.
#[tracing::instrument(skip_all)]
pub async fn delete_user_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let result = sqlx::query("DELETE FROM identity.user_signatures WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(state.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound(format!("Signature {id}")));
    }

    tracing::info!(sig_id = %id, user_id = %claims.sub, "User signature deleted");
    Ok(StatusCode::NO_CONTENT)
}
