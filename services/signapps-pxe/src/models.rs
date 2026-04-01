use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow, utoipa::ToSchema)]
/// Represents a pxe profile.
pub struct PxeProfile {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub boot_script: String,
    pub os_type: Option<String>,
    pub os_version: Option<String>,
    pub is_default: Option<bool>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
/// Request payload for CreatePxeProfile operation.
pub struct CreatePxeProfileRequest {
    pub name: String,
    pub description: Option<String>,
    pub boot_script: String,
    pub os_type: Option<String>,
    pub os_version: Option<String>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, utoipa::ToSchema)]
/// Represents a pxe asset.
pub struct PxeAsset {
    pub id: Uuid,
    pub mac_address: String,
    pub hostname: Option<String>,
    #[schema(value_type = Option<String>)]
    pub ip_address: Option<ipnetwork::IpNetwork>,
    pub status: String,
    pub profile_id: Option<Uuid>,
    pub assigned_user_id: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
    pub last_seen: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
/// Request payload for RegisterPxeAsset operation.
pub struct RegisterPxeAssetRequest {
    pub mac_address: String,
    pub hostname: Option<String>,
    pub profile_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
/// Request payload for UpdatePxeProfile operation.
pub struct UpdatePxeProfileRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub boot_script: Option<String>,
    pub os_type: Option<String>,
    pub os_version: Option<String>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
/// Request payload for UpdatePxeAsset operation.
pub struct UpdatePxeAssetRequest {
    pub hostname: Option<String>,
    pub status: Option<String>,
    pub profile_id: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
}
