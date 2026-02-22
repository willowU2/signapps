use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Represents a user-defined tag for categorizing storage files
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Tag {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub color: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request to create a new tag
#[derive(Debug, Deserialize)]
pub struct CreateTagRequest {
    pub name: String,
    pub color: Option<String>,
}

/// Request to update an existing tag
#[derive(Debug, Deserialize)]
pub struct UpdateTagRequest {
    pub name: Option<String>,
    pub color: Option<String>,
}

/// Represents the association between a file and a tag
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FileTag {
    pub file_id: Uuid,
    pub tag_id: Uuid,
    pub created_at: Option<DateTime<Utc>>,
}

/// Represents a specific version of a file in storage
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FileVersion {
    pub id: Uuid,
    pub file_id: Uuid,
    pub version_number: i32,
    pub size: i64,
    pub content_type: Option<String>,
    pub storage_key: String,
    pub created_at: Option<DateTime<Utc>>,
}

/// Response returned when fetching tags for a file
#[derive(Debug, Serialize)]
pub struct FileTagResponse {
    pub id: Uuid,
    pub name: String,
    pub color: String,
}
