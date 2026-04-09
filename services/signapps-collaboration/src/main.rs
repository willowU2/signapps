//! SignApps Collaboration Service
//!
//! Boards for mind maps, kanban, and other collaborative workspaces.
//! Persists board data as JSONB in PostgreSQL.

mod openapi;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{auth_middleware, AuthState};
use signapps_common::Claims;
use signapps_common::JwtConfig;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/// A collaboration board (mind map, kanban, etc.).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct BoardRow {
    /// Unique identifier.
    pub id: Uuid,
    /// Board title.
    pub title: String,
    /// Board type (e.g. `mindmap`, `kanban`).
    pub board_type: Option<String>,
    /// Board payload stored as JSON.
    pub data: serde_json::Value,
    /// Owner user.
    pub owner_id: Uuid,
    /// Optional tenant scope.
    pub tenant_id: Option<Uuid>,
    /// Row creation timestamp.
    pub created_at: Option<chrono::DateTime<Utc>>,
    /// Row update timestamp.
    pub updated_at: Option<chrono::DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

/// Request body for creating a board.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateBoardRequest {
    /// Board title.
    pub title: String,
    /// Board type (defaults to `mindmap`).
    pub board_type: Option<String>,
    /// Initial board data payload.
    pub data: Option<serde_json::Value>,
}

/// Request body for updating a board.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateBoardRequest {
    /// New title (if provided).
    pub title: Option<String>,
    /// New board data (if provided).
    pub data: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

/// Application state for the collaboration service.
#[derive(Clone)]
pub struct AppState {
    /// JWT configuration for auth middleware.
    pub jwt_config: JwtConfig,
    /// Database pool.
    pub pool: sqlx::PgPool,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /api/v1/collaboration/boards — list boards for the current user.
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/collaboration/boards",
    responses(
        (status = 200, description = "List of boards", body = Vec<BoardRow>),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "collaboration"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
async fn list_boards(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let result = sqlx::query_as::<_, BoardRow>(
        "SELECT * FROM collaboration.boards WHERE owner_id = $1 ORDER BY updated_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await;

    match result {
        Ok(rows) => (StatusCode::OK, Json(serde_json::to_value(rows).unwrap_or_default())),
        Err(e) => {
            tracing::error!(?e, "Failed to list boards");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

/// POST /api/v1/collaboration/boards — create a new board.
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/collaboration/boards",
    request_body = CreateBoardRequest,
    responses(
        (status = 201, description = "Board created", body = BoardRow),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "collaboration"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
async fn create_board(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateBoardRequest>,
) -> impl IntoResponse {
    let board_type = payload.board_type.unwrap_or_else(|| "mindmap".to_string());
    let data = payload.data.unwrap_or(serde_json::json!({}));

    let result = sqlx::query_as::<_, BoardRow>(
        r#"INSERT INTO collaboration.boards (title, board_type, data, owner_id)
           VALUES ($1, $2, $3, $4)
           RETURNING *"#,
    )
    .bind(&payload.title)
    .bind(&board_type)
    .bind(&data)
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await;

    match result {
        Ok(row) => {
            tracing::info!(id = %row.id, "Board created");
            (StatusCode::CREATED, Json(serde_json::to_value(row).unwrap_or_default()))
        },
        Err(e) => {
            tracing::error!(?e, "Failed to create board");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

/// GET /api/v1/collaboration/boards/:id — get a single board.
///
/// # Errors
///
/// Returns 404 if not found, 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/collaboration/boards/{id}",
    params(("id" = Uuid, Path, description = "Board UUID")),
    responses(
        (status = 200, description = "Board found", body = BoardRow),
        (status = 404, description = "Board not found"),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "collaboration"
)]
#[tracing::instrument(skip(state, _claims), fields(board_id = %id))]
async fn get_board(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query_as::<_, BoardRow>(
        "SELECT * FROM collaboration.boards WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(row)) => (StatusCode::OK, Json(serde_json::to_value(row).unwrap_or_default())),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Board not found" })),
        ),
        Err(e) => {
            tracing::error!(?e, "Failed to get board");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

/// PUT /api/v1/collaboration/boards/:id — update a board.
///
/// # Errors
///
/// Returns 403 if not owner, 404 if not found, 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    put,
    path = "/api/v1/collaboration/boards/{id}",
    params(("id" = Uuid, Path, description = "Board UUID")),
    request_body = UpdateBoardRequest,
    responses(
        (status = 200, description = "Board updated", body = BoardRow),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Board not found"),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "collaboration"
)]
#[tracing::instrument(skip(state, claims, payload), fields(user_id = %claims.sub, board_id = %id))]
async fn update_board(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateBoardRequest>,
) -> impl IntoResponse {
    // Check ownership
    let existing = sqlx::query_as::<_, BoardRow>(
        "SELECT * FROM collaboration.boards WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await;

    match existing {
        Ok(Some(board)) => {
            if board.owner_id != claims.sub {
                return (
                    StatusCode::FORBIDDEN,
                    Json(serde_json::json!({ "error": "Forbidden" })),
                );
            }
        },
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Board not found" })),
            );
        },
        Err(e) => {
            tracing::error!(?e, "Failed to fetch board for update");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            );
        },
    }

    let result = sqlx::query_as::<_, BoardRow>(
        r#"UPDATE collaboration.boards
           SET title = COALESCE($1, title),
               data = COALESCE($2, data),
               updated_at = NOW()
           WHERE id = $3
           RETURNING *"#,
    )
    .bind(payload.title)
    .bind(payload.data)
    .bind(id)
    .fetch_one(&state.pool)
    .await;

    match result {
        Ok(row) => {
            tracing::info!(id = %id, "Board updated");
            (StatusCode::OK, Json(serde_json::to_value(row).unwrap_or_default()))
        },
        Err(e) => {
            tracing::error!(?e, "Failed to update board");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

/// DELETE /api/v1/collaboration/boards/:id — delete a board.
///
/// # Errors
///
/// Returns 403 if not owner, 404 if not found, 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    delete,
    path = "/api/v1/collaboration/boards/{id}",
    params(("id" = Uuid, Path, description = "Board UUID")),
    responses(
        (status = 204, description = "Board deleted"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Board not found"),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "collaboration"
)]
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub, board_id = %id))]
async fn delete_board(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Check ownership
    let existing = sqlx::query_as::<_, BoardRow>(
        "SELECT * FROM collaboration.boards WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await;

    match existing {
        Ok(Some(board)) => {
            if board.owner_id != claims.sub {
                return (
                    StatusCode::FORBIDDEN,
                    Json(serde_json::json!({ "error": "Forbidden" })),
                );
            }
        },
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Board not found" })),
            );
        },
        Err(e) => {
            tracing::error!(?e, "Failed to fetch board for deletion");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            );
        },
    }

    match sqlx::query("DELETE FROM collaboration.boards WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
    {
        Ok(_) => {
            tracing::info!(id = %id, user = %claims.sub, "Board deleted");
            (StatusCode::NO_CONTENT, Json(serde_json::json!({})))
        },
        Err(e) => {
            tracing::error!(?e, "Failed to delete board");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/// Health check endpoint.
async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-collaboration",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "collaboration",
            "label": "Collaboration",
            "description": "Mind maps, kanban et espaces collaboratifs",
            "icon": "GitBranch",
            "category": "Productivité",
            "color": "text-indigo-500",
            "href": "/collaboration",
            "port": 3034
        }
    }))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/// Build the Axum router for the collaboration service.
fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().expect("valid origin"),
            "http://127.0.0.1:3000".parse().expect("valid origin"),
        ]))
        .allow_credentials(true)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::ORIGIN,
            axum::http::HeaderName::from_static("x-workspace-id"),
            axum::http::HeaderName::from_static("x-request-id"),
        ]);

    let public_routes = Router::new().route("/health", get(health_check));

    let protected_routes = Router::new()
        .route(
            "/api/v1/collaboration/boards",
            get(list_boards).post(create_board),
        )
        .route(
            "/api/v1/collaboration/boards/:id",
            get(get_board).put(update_board).delete(delete_board),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(protected_routes)
        .merge(openapi::swagger_router())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_collaboration");
    load_env();

    let config = ServiceConfig::from_env("signapps-collaboration", 3034);
    config.log_startup();

    let db_pool = signapps_db::create_pool(&config.database_url).await?;

    if let Err(e) = signapps_db::run_migrations(&db_pool).await {
        tracing::warn!("Failed to apply database migrations for Collaboration: {}", e);
    }

    tracing::info!("Running fallback SQL creation for collaboration schema...");
    let fallback_sql = include_str!("../../../migrations/254_collaboration_schema.sql");
    use sqlx::Executor;
    match db_pool.inner().execute(fallback_sql).await {
        Ok(_) => tracing::info!("Collaboration tables successfully created via fallback SQL"),
        Err(e) => tracing::error!("Fallback SQL execution failed: {}", e),
    }

    let pool = db_pool.inner().clone();

    let jwt_config = JwtConfig::from_env();

    let state = AppState { jwt_config, pool };

    tracing::info!("Database connected & service ready");

    let app = create_router(state);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
