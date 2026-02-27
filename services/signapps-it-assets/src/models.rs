use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct HardwareAsset {
    pub id: DefaultUuidField,
    pub name: String,
    pub r#type: String,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub purchase_date: Option<NaiveDate>,
    pub warranty_expires: Option<NaiveDate>,
    pub status: Option<String>,
    pub location: Option<String>,
    pub assigned_user_id: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// Handling postgres optional uuid type mappings that sqlx might complain about
pub type DefaultUuidField = Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateHardwareReq {
    pub name: String,
    #[serde(rename = "type")]
    pub asset_type: String,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub purchase_date: Option<NaiveDate>,
    pub warranty_expires: Option<NaiveDate>,
    pub location: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateHardwareReq {
    pub name: Option<String>,
    pub status: Option<String>,
    pub location: Option<String>,
    pub assigned_user_id: Option<Uuid>,
    pub notes: Option<String>,
}
