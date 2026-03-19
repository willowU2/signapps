use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use signapps_common::{Claims, TenantContext};
use signapps_db::models::CreateProject;
use signapps_db::repositories::ProjectRepository;
use uuid::Uuid;

use crate::AppState;

pub async fn list_projects(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<impl IntoResponse, StatusCode> {
    match ProjectRepository::list_with_stats(state.pool.inner(), ctx.tenant_id, None, 100, 0).await
    {
        Ok(projects) => Ok(Json(json!({ "data": projects }))),
        Err(e) => {
            tracing::error!("Failed to list projects: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn create_project(
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

pub async fn get_project(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    Ok(Json(json!({
        "id": id,
        "tenant_id": ctx.tenant_id,
        "name": "Placeholder Project"
    })))
}
