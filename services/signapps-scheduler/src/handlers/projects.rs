use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use signapps_common::{Claims, TenantContext};
use signapps_db::models::{CreateProject, UpdateProject};
use signapps_db::repositories::ProjectRepository;
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Deserialize, Default)]
pub struct ProjectListQuery {
    pub workspace_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[tracing::instrument(skip_all)]
pub async fn list(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Query(query): Query<ProjectListQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let limit = query.limit.unwrap_or(100);
    let offset = query.offset.unwrap_or(0);

    match ProjectRepository::list_with_stats(
        state.pool.inner(),
        ctx.tenant_id,
        query.workspace_id,
        limit,
        offset,
    )
    .await
    {
        Ok(projects) => Ok(Json(json!({ "data": projects }))),
        Err(e) => {
            tracing::error!("Failed to list projects: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn create(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Json(payload): Json<CreateProject>,
) -> Result<impl IntoResponse, StatusCode> {
    match ProjectRepository::create(state.pool.inner(), ctx.tenant_id, claims.sub, payload).await {
        Ok(project) => Ok((StatusCode::CREATED, Json(json!({ "data": project })))),
        Err(e) => {
            tracing::error!("Failed to create project: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn get_by_id(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    match ProjectRepository::find_by_id(state.pool.inner(), id).await {
        Ok(Some(project)) => {
            if project.tenant_id != ctx.tenant_id {
                return Err(StatusCode::NOT_FOUND);
            }
            Ok(Json(json!({ "data": project })))
        },
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to get project: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn update(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProject>,
) -> Result<impl IntoResponse, StatusCode> {
    match ProjectRepository::update(state.pool.inner(), id, payload).await {
        Ok(project) => Ok(Json(json!({ "data": project }))),
        Err(e) => {
            tracing::error!("Failed to update project: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn delete(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    match ProjectRepository::delete(state.pool.inner(), id).await {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("Failed to delete project: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}
