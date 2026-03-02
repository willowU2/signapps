use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct RemoteConnection {
    pub id: Uuid,
    pub hardware_id: Option<Uuid>,
    pub name: String,
    pub protocol: String, // 'rdp', 'vnc', 'ssh'
    pub hostname: String,
    pub port: i32,
    pub username: Option<String>,
    #[serde(skip_serializing)]
    #[allow(dead_code)]
    pub password_encrypted: Option<String>,
    #[serde(skip_serializing)]
    #[allow(dead_code)]
    pub private_key_encrypted: Option<String>,
    pub parameters: Option<serde_json::Value>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateConnectionRequest {
    pub hardware_id: Option<Uuid>,
    pub name: String,
    pub protocol: String,
    pub hostname: String,
    pub port: i32,
    pub username: Option<String>,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub parameters: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateConnectionRequest {
    pub name: Option<String>,
    pub protocol: Option<String>,
    pub hostname: Option<String>,
    pub port: Option<i32>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub parameters: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct GuacamoleInstruction {
    pub opcode: String,
    pub args: Vec<String>,
}
