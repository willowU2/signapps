//! Group and RBAC models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Group entity for RBAC.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Group {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub parent_id: Option<Uuid>,
    pub ldap_dn: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create group request.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateGroup {
    pub name: String,
    pub description: Option<String>,
    pub parent_id: Option<Uuid>,
}

/// Group member relation.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct GroupMember {
    pub group_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub added_at: DateTime<Utc>,
}

/// Role entity for RBAC.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Role {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub permissions: serde_json::Value,
    pub is_system: bool,
    pub created_at: DateTime<Utc>,
}

/// Create role request.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateRole {
    pub name: String,
    pub description: Option<String>,
    pub permissions: serde_json::Value,
}

/// Permission definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Permission {
    pub resource: String,
    pub actions: Vec<String>,
}

/// Webhook entity for custom integrations.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Webhook {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    #[serde(skip_serializing)]
    pub secret: Option<String>,
    pub events: Vec<String>,
    pub headers: serde_json::Value,
    pub enabled: bool,
    pub last_triggered: Option<DateTime<Utc>>,
    pub last_status: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create webhook request.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateWebhook {
    pub name: String,
    pub url: String,
    pub secret: Option<String>,
    pub events: Vec<String>,
    pub headers: Option<serde_json::Value>,
    #[serde(default = "default_webhook_enabled")]
    pub enabled: bool,
}

fn default_webhook_enabled() -> bool {
    true
}
