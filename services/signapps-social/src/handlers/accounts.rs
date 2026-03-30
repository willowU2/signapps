use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::Utc;
use signapps_common::Claims;
use uuid::Uuid;

use crate::{
    models::{CreateAccountRequest, UpdateAccountRequest},
    AppState,
};

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/accounts",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
pub async fn list_accounts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, crate::models::SocialAccount>(
        "SELECT id, user_id, platform, platform_user_id, username, display_name, avatar_url,
                access_token, refresh_token, token_expires_at, platform_config, is_active,
                created_at, updated_at
         FROM social.accounts
         WHERE user_id = $1 AND is_active = true
         ORDER BY created_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => (StatusCode::OK, Json(serde_json::json!(rows))),
        Err(e) => {
            tracing::error!("list_accounts: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/accounts",
    responses((status = 201, description = "Success")),
    tag = "Social"
)]
pub async fn create_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateAccountRequest>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    let now = Utc::now();
    let config = payload
        .platform_config
        .unwrap_or_else(|| serde_json::json!({}));

    match sqlx::query_as::<_, crate::models::SocialAccount>(
        "INSERT INTO social.accounts
            (id, user_id, platform, platform_user_id, username, display_name, avatar_url,
             access_token, refresh_token, token_expires_at, platform_config, is_active,
             created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13)
         RETURNING id, user_id, platform, platform_user_id, username, display_name, avatar_url,
                   access_token, refresh_token, token_expires_at, platform_config, is_active,
                   created_at, updated_at",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&payload.platform)
    .bind(&payload.platform_user_id)
    .bind(&payload.username)
    .bind(&payload.display_name)
    .bind(&payload.avatar_url)
    .bind(&payload.access_token)
    .bind(&payload.refresh_token)
    .bind(payload.token_expires_at)
    .bind(config)
    .bind(now)
    .bind(now)
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => (StatusCode::CREATED, Json(serde_json::json!(row))),
        Err(e) => {
            tracing::error!("create_account: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/accounts",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
pub async fn get_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, crate::models::SocialAccount>(
        "SELECT id, user_id, platform, platform_user_id, username, display_name, avatar_url,
                access_token, refresh_token, token_expires_at, platform_config, is_active,
                created_at, updated_at
         FROM social.accounts
         WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(row)) => (StatusCode::OK, Json(serde_json::json!(row))),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Account not found" })),
        ),
        Err(e) => {
            tracing::error!("get_account: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/accounts",
    responses((status = 204, description = "Success")),
    tag = "Social"
)]
pub async fn delete_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    match sqlx::query(
        "UPDATE social.accounts SET is_active = false, updated_at = NOW()
         WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => {
            tracing::error!("delete_account: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/accounts",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
pub async fn update_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAccountRequest>,
) -> impl IntoResponse {
    // Build a partial update
    let existing = sqlx::query_as::<_, crate::models::SocialAccount>(
        "SELECT id, user_id, platform, platform_user_id, username, display_name, avatar_url,
                access_token, refresh_token, token_expires_at, platform_config, is_active,
                created_at, updated_at
         FROM social.accounts WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    let acct = match existing {
        Ok(Some(a)) => a,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Account not found" })),
            )
        },
        Err(e) => {
            tracing::error!("update_account fetch: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            );
        },
    };

    let username = payload.username.or(acct.username);
    let display_name = payload.display_name.or(acct.display_name);
    let avatar_url = payload.avatar_url.or(acct.avatar_url);
    let is_active = payload.is_active.unwrap_or(acct.is_active);
    let platform_config = payload.platform_config.unwrap_or(acct.platform_config);

    match sqlx::query_as::<_, crate::models::SocialAccount>(
        "UPDATE social.accounts
         SET username=$1, display_name=$2, avatar_url=$3, is_active=$4,
             platform_config=$5, updated_at=NOW()
         WHERE id=$6 AND user_id=$7
         RETURNING id, user_id, platform, platform_user_id, username, display_name, avatar_url,
                   access_token, refresh_token, token_expires_at, platform_config, is_active,
                   created_at, updated_at",
    )
    .bind(&username)
    .bind(&display_name)
    .bind(&avatar_url)
    .bind(is_active)
    .bind(&platform_config)
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => (StatusCode::OK, Json(serde_json::json!(row))),
        Err(e) => {
            tracing::error!("update_account: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/accounts",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
pub async fn refresh_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Placeholder: real OAuth refresh logic would call the platform's token endpoint
    match sqlx::query(
        "UPDATE social.accounts SET updated_at = NOW() WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => (
            StatusCode::OK,
            Json(
                serde_json::json!({ "message": "Token refresh not yet implemented for this platform" }),
            ),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Account not found" })),
        ),
        Err(e) => {
            tracing::error!("refresh_token: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
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
