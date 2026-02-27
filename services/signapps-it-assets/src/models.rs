use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct HardwareAsset {
    pub id: Uuid,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateHardwareRequest {
    pub name: String,
    pub r#type: String,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub purchase_date: Option<NaiveDate>,
    pub warranty_expires: Option<NaiveDate>,
    pub location: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct NetworkInterface {
    pub id: Uuid,
    pub hardware_id: Option<Uuid>,
    pub mac_address: String,
    pub ip_address: Option<ipnetwork::IpNetwork>,
    pub is_primary: Option<bool>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateNetworkInterfaceRequest {
    pub hardware_id: Uuid,
    pub mac_address: String,
    pub ip_address: Option<String>,
    pub is_primary: Option<bool>,
}
