//! Activity feed handlers.

use axum::{
    extract::{Extension, Query, State},
    Json,
};
use serde::Deserialize;
use signapps_common::{Claims, Result};
use signapps_db::models::activity::Activity;
use signapps_db::repositories::activity_repository::ActivityRepository;
use uuid::Uuid;

use crate::AppState;

/// Query parameters for listing activities.
#[derive(Debug, Deserialize)]
pub struct ActivitiesQuery {
    pub workspace_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub mine: Option<bool>,
}

/// List activities based on query parameters
#[tracing::instrument(skip(state))]
pub async fn list_activities(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ActivitiesQuery>,
) -> Result<Json<Vec<Activity>>> {
    let repo = ActivityRepository::new(state.pool.inner().clone());
    
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = query.offset.unwrap_or(0);

    let activities = if query.mine.unwrap_or(false) {
        repo.get_user_recent(claims.sub, limit).await?
    } else if let (Some(ref entity_type), Some(entity_id)) = (&query.entity_type, query.entity_id) {
        repo.get_entity_history(entity_type, entity_id).await?
    } else {
        repo.get_feed(query.workspace_id, limit, offset).await?
    };

    Ok(Json(activities))
}
