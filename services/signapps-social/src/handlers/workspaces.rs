use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use uuid::Uuid;

use crate::models::{CreateWorkspaceRequest, InviteMemberRequest, Workspace, WorkspaceMember};
use crate::AppState;
use signapps_common::Claims;

pub async fn list_workspaces(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, Workspace>(
        r#"SELECT w.* FROM social.workspaces w
           LEFT JOIN social.workspace_members m ON m.workspace_id = w.id
           WHERE w.owner_id = $1 OR m.user_id = $1
           ORDER BY w.created_at DESC"#,
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => Ok(Json(rows)),
        Err(e) => {
            tracing::error!("list_workspaces: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn create_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateWorkspaceRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, Workspace>(
        r#"INSERT INTO social.workspaces (owner_id, name, slug, avatar_url, description)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *"#,
    )
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(&payload.slug)
    .bind(&payload.avatar_url)
    .bind(&payload.description)
    .fetch_one(&state.pool)
    .await
    {
        Ok(ws) => {
            // Add owner as member
            sqlx::query(
                r#"INSERT INTO social.workspace_members (workspace_id, user_id, role, accepted_at)
                   VALUES ($1, $2, 'owner', NOW())"#,
            )
            .bind(ws.id)
            .bind(claims.sub)
            .execute(&state.pool)
            .await
            .ok();

            Ok((StatusCode::CREATED, Json(ws)))
        },
        Err(e) => {
            tracing::error!("create_workspace: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn get_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, Workspace>(
        "SELECT * FROM social.workspaces WHERE id = $1 AND owner_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(ws)) => Ok(Json(ws)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("get_workspace: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn delete_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM social.workspaces WHERE id = $1 AND owner_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("delete_workspace: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn list_members(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, WorkspaceMember>(
        "SELECT * FROM social.workspace_members WHERE workspace_id = $1 ORDER BY invited_at",
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => Ok(Json(rows)),
        Err(e) => {
            tracing::error!("list_members: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn invite_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<InviteMemberRequest>,
) -> impl IntoResponse {
    // Verify ownership
    let owner_check = sqlx::query_as::<_, Workspace>(
        "SELECT * FROM social.workspaces WHERE id = $1 AND owner_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    match owner_check {
        Ok(Some(_)) => {},
        Ok(None) => return Err(StatusCode::FORBIDDEN),
        Err(e) => {
            tracing::error!("invite_member ownership check: {e}");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        },
    }

    match sqlx::query_as::<_, WorkspaceMember>(
        r#"INSERT INTO social.workspace_members (workspace_id, user_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (workspace_id, user_id) DO NOTHING
           RETURNING *"#,
    )
    .bind(id)
    .bind(payload.user_id)
    .bind(payload.role.unwrap_or_else(|| "member".to_string()))
    .fetch_one(&state.pool)
    .await
    {
        Ok(member) => Ok((StatusCode::CREATED, Json(member))),
        Err(e) => {
            tracing::error!("invite_member: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn remove_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((ws_id, user_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    // Verify ownership
    let owner_check = sqlx::query_as::<_, Workspace>(
        "SELECT * FROM social.workspaces WHERE id = $1 AND owner_id = $2",
    )
    .bind(ws_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    match owner_check {
        Ok(Some(_)) => {},
        Ok(None) => return Err(StatusCode::FORBIDDEN),
        Err(e) => {
            tracing::error!("remove_member ownership check: {e}");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        },
    }

    match sqlx::query(
        "DELETE FROM social.workspace_members WHERE workspace_id = $1 AND user_id = $2",
    )
    .bind(ws_id)
    .bind(user_id)
    .execute(&state.pool)
    .await
    {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("remove_member: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}
