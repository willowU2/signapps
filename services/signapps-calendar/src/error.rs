//! Calendar service errors.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CalendarError {
    #[error("Not found")]
    NotFound,

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Forbidden")]
    Forbidden,

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Internal server error")]
    InternalError,
}

impl CalendarError {
    pub fn not_found(_msg: &str) -> Self {
        CalendarError::NotFound
    }

    pub fn unauthorized() -> Self {
        CalendarError::Unauthorized
    }

    pub fn forbidden(_msg: &str) -> Self {
        CalendarError::Forbidden
    }

    pub fn bad_request(msg: &str) -> Self {
        CalendarError::InvalidInput(msg.to_string())
    }

    pub fn internal(_msg: &str) -> Self {
        CalendarError::InternalError
    }

    pub fn conflict(msg: &str) -> Self {
        CalendarError::Conflict(msg.to_string())
    }
}

impl IntoResponse for CalendarError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            CalendarError::NotFound => (StatusCode::NOT_FOUND, "Resource not found".to_string()),
            CalendarError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized".to_string()),
            CalendarError::Forbidden => (StatusCode::FORBIDDEN, "Forbidden".to_string()),
            CalendarError::InvalidInput(msg) => (StatusCode::BAD_REQUEST, msg),
            CalendarError::Conflict(msg) => (StatusCode::CONFLICT, msg),
            CalendarError::InternalError => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            ),
        };

        let body = Json(json!({
            "error": error_message,
            "status": status.as_u16() as i32
        }));

        (status, body).into_response()
    }
}
