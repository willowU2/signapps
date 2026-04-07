use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A user activity event recording an action taken on an entity.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Activity {
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
