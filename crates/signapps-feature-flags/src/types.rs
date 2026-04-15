//! Public types for feature flags and rollout contexts.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

/// A single feature flag row.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, sqlx::FromRow)]
pub struct FeatureFlag {
    /// Primary key
    pub id: Uuid,
    /// Unique flag key (e.g. `"deploy.api_enabled"`)
    pub key: String,
    /// Environment the flag applies to (`"prod"`, `"dev"`, or `"all"`)
    pub env: String,
    /// Whether the flag is enabled at all
    pub enabled: bool,
    /// Percent of population where the flag is on (0-100)
    pub rollout_percent: i32,
    /// Explicit org allow-list (always enabled for these)
    pub target_orgs: Vec<Uuid>,
    /// Explicit user allow-list (always enabled for these)
    pub target_users: Vec<Uuid>,
    /// Optional human description
    pub description: Option<String>,
    /// Who created the flag (nullable for CLI-originated flags)
    pub created_by: Option<Uuid>,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
}

/// Information used by the evaluator to decide whether a flag is enabled
/// for the current request.
#[derive(Debug, Clone, Default)]
pub struct RolloutContext {
    /// Current environment name (`"prod"` or `"dev"`)
    pub env: String,
    /// Optional user id (used for rollout hashing and user targeting)
    pub user_id: Option<Uuid>,
    /// Optional org id (used for rollout hashing and org targeting)
    pub org_id: Option<Uuid>,
}
