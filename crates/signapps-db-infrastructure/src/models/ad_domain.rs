//! Active Directory domain configuration model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

/// An Active Directory domain linked to a tenant's org tree.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdDomain {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub tree_id: Uuid,
    pub dns_name: String,
    pub netbios_name: String,
    pub domain_sid: String,
    pub realm: String,
    pub forest_root: bool,
    pub domain_function_level: i32,
    pub schema_version: i32,
    pub config: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a new AD domain.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateAdDomain {
    pub dns_name: String,
    pub netbios_name: String,
    pub tree_id: Uuid,
}
