use axum::{
    extract::Multipart,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;

pub async fn handle_convert(mut multipart: Multipart) -> impl IntoResponse {
    let mut input_format = None;
    let mut target_format = None;
    let mut file_data = None;

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        let name = field.name().unwrap_or("").to_string();
        
        if name == "input_format" {
            input_format = field.text().await.ok();
        } else if name == "target_format" {
            target_format = field.text().await.ok();
        } else if name == "file" {
            file_data = field.bytes().await.ok();
        }
    }

    let (input, target, data) = match (input_format, target_format, file_data) {
        (Some(i), Some(t), Some(d)) => (i, t, d),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Missing input_format, target_format, or file" })),
            )
        }
    };

    tracing::info!("Converting {} bytes from {} to {}", data.len(), input, target);

    // TODO: Route to appropriate parser based on input and target format

    (
        StatusCode::OK,
        Json(json!({ "status": "success", "message": "Conversion implementation in progress" })),
    )
}
