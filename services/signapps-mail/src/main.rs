use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    pool: Pool<Postgres>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "signapps_mail=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    let state = AppState { pool };

    let app = Router::new()
        .route("/api/v1/mail", get(list_emails).post(send_email))
        .route("/api/v1/mail/:id", get(get_email).patch(update_email))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3004));
    tracing::info!("listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// --- Models ---

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
struct Email {
    id: Uuid,
    sender: String,
    recipient: String,
    subject: String,
    body: String,
    is_read: bool,
    is_archived: bool,
    is_deleted: bool,
    labels: Vec<String>,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
struct CreateEmail {
    sender: String,
    recipient: String,
    subject: String,
    body: String,
}

#[derive(Debug, Deserialize)]
struct UpdateEmail {
    is_read: Option<bool>,
    is_archived: Option<bool>,
    is_deleted: Option<bool>,
    labels: Option<Vec<String>>,
}

// --- Handlers ---

async fn list_emails(
    State(state): State<AppState>,
    // Query params (e.g. ?folder=inbox) would go here
) -> impl IntoResponse {
    // For MVP, just return all
    // In real app, filter by folder/user
    let emails = sqlx::query_as::<_, Email>("SELECT * FROM emails ORDER BY created_at DESC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or(vec![]);

    Json(emails)
}

async fn send_email(
    State(state): State<AppState>,
    Json(payload): Json<CreateEmail>,
) -> impl IntoResponse {
    let email = sqlx::query_as::<_, Email>(
        "INSERT INTO emails (sender, recipient, subject, body) VALUES ($1, $2, $3, $4) RETURNING *",
    )
    .bind(payload.sender)
    .bind(payload.recipient)
    .bind(payload.subject)
    .bind(payload.body)
    .fetch_one(&state.pool)
    .await;

    match email {
        Ok(email) => (StatusCode::CREATED, Json(email)).into_response(),
        Err(e) => {
            tracing::error!("Failed to send email: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to send email").into_response()
        },
    }
}

async fn get_email(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let email = sqlx::query_as::<_, Email>("SELECT * FROM emails WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .unwrap();

    match email {
        Some(email) => Json(email).into_response(),
        None => (StatusCode::NOT_FOUND, "Email not found").into_response(),
    }
}

async fn update_email(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateEmail>,
) -> impl IntoResponse {
    let email: Result<Option<Email>, sqlx::Error> = sqlx::query_as::<_, Email>(
        r#"
        UPDATE emails
        SET is_read = COALESCE($1::BOOLEAN, is_read),
            is_archived = COALESCE($2::BOOLEAN, is_archived),
            is_deleted = COALESCE($3::BOOLEAN, is_deleted),
            labels = COALESCE($4::TEXT[], labels)
        WHERE id = $5
        RETURNING *
        "#,
    )
    .bind(payload.is_read)
    .bind(payload.is_archived)
    .bind(payload.is_deleted)
    .bind(payload.labels)
    .bind(id)
    .fetch_optional(&state.pool)
    .await;

    match email {
        Ok(Some(email)) => Json(email).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Email not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to update email: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update email").into_response()
        },
    }
}
