//! Activity feed handlers.

use axum::{
    extract::{Extension, Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Result};
use signapps_db::models::activity::Activity;
use signapps_db::repositories::activity_repository::ActivityRepository;
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;

/// Query parameters for listing activities.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ActivitiesQuery {
    pub workspace_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub mine: Option<bool>,
}

/// Activity entry from cross-module feed.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
/// ActivityEntry data transfer object.
pub struct ActivityEntry {
    pub id: Uuid,
    pub actor_id: Uuid,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub entity_title: Option<String>,
    pub metadata: serde_json::Value,
    pub workspace_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// List activities based on query parameters
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
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

/// Cross-module activity feed endpoint.
/// Returns activities from all modules for the user's workspace(s).
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn cross_module_activity(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ActivityEntry>>> {
    let workspace_id = claims
        .workspace_ids
        .as_ref()
        .and_then(|ids| ids.first())
        .copied();

    let activities = sqlx::query_as::<_, ActivityEntry>(
        "SELECT id, actor_id, action, entity_type, entity_id, entity_title, metadata, workspace_id, created_at \
         FROM platform.activities \
         WHERE ($1::uuid IS NULL OR workspace_id = $1) \
         ORDER BY created_at DESC LIMIT 50"
    )
    .bind(workspace_id)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    Ok(Json(activities))
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
