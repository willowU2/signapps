use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AuditLogEntry {
    pub id: Uuid,
    pub actor_id: Option<Uuid>,
    pub actor_ip: Option<String>,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub old_data: Option<serde_json::Value>,
    pub new_data: Option<serde_json::Value>,
    pub metadata: serde_json::Value,
    pub workspace_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}
