use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use uuid::Uuid;

use crate::models::{CreateSignatureRequest, Signature, UpdateSignatureRequest};
use crate::AppState;
use signapps_common::Claims;

#[tracing::instrument(skip_all)]
pub async fn list_signatures(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, Signature>(
        "SELECT * FROM social.signatures WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => Ok(Json(rows)),
        Err(e) => {
            tracing::error!("list_signatures: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn create_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateSignatureRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, Signature>(
        r#"INSERT INTO social.signatures (user_id, name, content, is_auto_add)
           VALUES ($1, $2, $3, $4)
           RETURNING *"#,
    )
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(&payload.content)
    .bind(payload.is_auto_add.unwrap_or(false))
    .fetch_one(&state.pool)
    .await
    {
        Ok(sig) => Ok((StatusCode::CREATED, Json(sig))),
        Err(e) => {
            tracing::error!("create_signature: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn update_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSignatureRequest>,
) -> impl IntoResponse {
    let existing = sqlx::query_as::<_, Signature>(
        "SELECT * FROM social.signatures WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    let sig = match existing {
        Ok(Some(s)) => s,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("update_signature fetch: {e}");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        },
    };

    let name = payload.name.unwrap_or(sig.name);
    let content = payload.content.unwrap_or(sig.content);
    let is_auto_add = payload.is_auto_add.unwrap_or(sig.is_auto_add);

    match sqlx::query_as::<_, Signature>(
        r#"UPDATE social.signatures
           SET name = $1, content = $2, is_auto_add = $3, updated_at = NOW()
           WHERE id = $4 AND user_id = $5
           RETURNING *"#,
    )
    .bind(&name)
    .bind(&content)
    .bind(is_auto_add)
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => Ok(Json(row)),
        Err(e) => {
            tracing::error!("update_signature: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn delete_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM social.signatures WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("delete_signature: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}
