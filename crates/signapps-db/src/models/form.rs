use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FieldType {
    Text,
    TextArea,
    SingleChoice,
    MultipleChoice,
    Rating,
    Date,
    Email,
    Number,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormField {
    pub id: Uuid,
    pub field_type: FieldType,
    pub label: String,
    pub required: bool,
    pub options: Option<Vec<String>>,
    pub layout: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Form {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub owner_id: Uuid,
    pub fields: sqlx::types::Json<Vec<FormField>>,
    pub is_published: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Answer {
    pub field_id: Uuid,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FormResponse {
    pub id: Uuid,
    pub form_id: Uuid,
    pub respondent: Option<String>,
    pub answers: sqlx::types::Json<Vec<Answer>>,
    pub submitted_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateForm {
    pub title: String,
    pub description: String,
    pub owner_id: Uuid,
    pub fields: Vec<FormField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateForm {
    pub title: Option<String>,
    pub description: Option<String>,
    pub fields: Option<Vec<FormField>>,
    pub is_published: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitResponse {
    pub form_id: Uuid,
    pub respondent: Option<String>,
    pub answers: Vec<Answer>,
}
