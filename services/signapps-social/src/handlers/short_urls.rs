use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use rand::Rng;
use uuid::Uuid;

use crate::models::{CreateShortUrlRequest, ShortUrl};
use crate::AppState;
use signapps_common::Claims;

fn generate_short_code() -> String {
    const CHARS: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();
    (0..8)
        .map(|_| {
            let idx = rng.gen_range(0..CHARS.len());
            CHARS[idx] as char
        })
        .collect()
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/short_urls",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn list_short_urls(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, ShortUrl>(
        "SELECT * FROM social.short_urls WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => Ok(Json(rows)),
        Err(e) => {
            tracing::error!("list_short_urls: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/short_urls",
    responses((status = 201, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn create_short_url(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateShortUrlRequest>,
) -> impl IntoResponse {
    let code = generate_short_code();
    match sqlx::query_as::<_, ShortUrl>(
        r#"INSERT INTO social.short_urls (user_id, short_code, original_url, post_id)
           VALUES ($1, $2, $3, $4)
           RETURNING *"#,
    )
    .bind(claims.sub)
    .bind(&code)
    .bind(&payload.original_url)
    .bind(payload.post_id)
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => Ok((StatusCode::CREATED, Json(row))),
        Err(e) => {
            tracing::error!("create_short_url: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/short_urls",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn track_click(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, ShortUrl>(
        r#"UPDATE social.short_urls SET clicks = clicks + 1
           WHERE short_code = $1
           RETURNING *"#,
    )
    .bind(&code)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(row)) => Ok(Json(serde_json::json!({
            "redirect_url": row.original_url
        }))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("track_click: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/short_urls",
    responses((status = 204, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_short_url(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM social.short_urls WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("delete_short_url: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
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
