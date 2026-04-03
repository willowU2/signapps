use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// The input type of a form field.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub enum FieldType {
    #[default]
    Text,
    TextArea,
    SingleChoice,
    MultipleChoice,
    Rating,
    Date,
    Email,
    Number,
}

/// A single field definition within a form, including its type, label, and options.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct FormField {
    pub id: Uuid,
    pub field_type: FieldType,
    pub label: String,
    pub required: bool,
    pub options: Option<Vec<String>>,
    pub layout: Option<String>,
    pub placeholder: Option<String>,
}

/// A form with a title, description, and a list of field definitions.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Form {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub owner_id: Uuid,
    #[cfg_attr(feature = "openapi", schema(value_type = Vec<FormField>))]
    pub fields: sqlx::types::Json<Vec<FormField>>,
    pub is_published: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A single field answer within a form submission.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Answer {
    pub field_id: Uuid,
    pub value: serde_json::Value,
}

/// A submitted form response containing all field answers.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct FormResponse {
    pub id: Uuid,
    pub form_id: Uuid,
    pub respondent: Option<String>,
    #[cfg_attr(feature = "openapi", schema(value_type = Vec<Answer>))]
    pub answers: sqlx::types::Json<Vec<Answer>>,
    pub submitted_at: DateTime<Utc>,
}

/// Request to create a new form with its fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateForm {
    pub title: String,
    pub description: String,
    pub owner_id: Uuid,
    pub fields: Vec<FormField>,
}

/// Request to update an existing form's title, description, fields, or publication status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateForm {
    pub title: Option<String>,
    pub description: Option<String>,
    pub fields: Option<Vec<FormField>>,
    pub is_published: Option<bool>,
}

/// Request to submit a filled-in form response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitResponse {
    pub form_id: Uuid,
    pub respondent: Option<String>,
    pub answers: Vec<Answer>,
}
