use axum::{routing::get, Json, Router};
use serde::Serialize;

#[derive(Serialize)]
struct Notification {
    id: String,
    title: String,
    body: String,
    priority: String,
    read: bool,
    created_at: String,
    source: String,
}

#[derive(Serialize)]
struct NotificationResponse {
    notifications: Vec<Notification>,
    unread_count: u32,
}

async fn list_notifications() -> Json<NotificationResponse> {
    Json(NotificationResponse {
        notifications: vec![],
        unread_count: 0,
    })
}

async fn health() -> &'static str {
    "OK"
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/notifications", get(list_notifications))
        .route("/health", get(health));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8095").await.unwrap();
    println!("signapps-notifications listening on :8095");
    axum::serve(listener, app).await.unwrap();
}
