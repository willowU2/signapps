//! SignApps Forms Service
//! Forms builder and response collector (Google Forms equivalent)

use axum::{
    extract::{Path, State},
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{auth_middleware, AuthState};
use signapps_common::Claims;
use signapps_common::JwtConfig;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;
use signapps_db::repositories::FormRepository;
use signapps_db::models::{FieldType, FormField, CreateForm, UpdateForm, Answer, SubmitResponse};

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateFormRequest {
    pub title: String,
    pub description: Option<String>,
    pub fields: Vec<CreateFieldRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFieldRequest {
    pub field_type: FieldType,
    pub label: String,
    pub required: bool,
    pub options: Option<Vec<String>>,
    pub layout: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFormRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub fields: Option<Vec<CreateFieldRequest>>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitResponseRequest {
    pub respondent: Option<String>,
    pub answers: Vec<Answer>,
}

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct AppState {
    pub jwt_config: JwtConfig,
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

async fn list_forms(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match FormRepository::list_by_owner(&state.pool, claims.sub).await {
        Ok(forms) => (StatusCode::OK, Json(serde_json::to_value(forms).unwrap())),
        Err(e) => {
            tracing::error!("Failed to list forms: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal Error" })))
        }
    }
}

async fn create_form(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateFormRequest>,
) -> impl IntoResponse {
    let fields: Vec<FormField> = payload
        .fields
        .into_iter()
        .map(|f| FormField {
            id: Uuid::new_v4(),
            field_type: f.field_type,
            label: f.label,
            required: f.required,
            options: f.options,
            layout: f.layout,
        })
        .collect();

    let create_data = CreateForm {
        title: payload.title,
        description: payload.description.unwrap_or_default(),
        owner_id: claims.sub,
        fields,
    };

    match FormRepository::create(&state.pool, claims.sub, create_data).await {
        Ok(form) => {
            tracing::info!(id = %form.id, "Form created");
            (StatusCode::CREATED, Json(serde_json::to_value(form).unwrap()))
        }
        Err(e) => {
            tracing::error!("Failed to create form: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal Error" })))
        }
    }
}

async fn get_form(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    match FormRepository::get_by_id(&state.pool, id).await {
        Ok(Some(form)) => (StatusCode::OK, Json(serde_json::to_value(form).unwrap())),
        Ok(None) => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Form not found" }))),
        Err(e) => {
            tracing::error!("Failed to get form: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal Error" })))
        }
    }
}

async fn update_form(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateFormRequest>,
) -> impl IntoResponse {
    let fields = payload.fields.map(|fields| {
        fields
            .into_iter()
            .map(|f| FormField {
                id: Uuid::new_v4(),
                field_type: f.field_type,
                label: f.label,
                required: f.required,
                options: f.options,
                layout: f.layout,
            })
            .collect()
    });

    let update_data = UpdateForm {
        title: payload.title,
        description: payload.description,
        fields,
        is_published: None,
    };

    match FormRepository::update(&state.pool, id, update_data).await {
        Ok(form) => (StatusCode::OK, Json(serde_json::to_value(form).unwrap())),
        Err(signapps_common::Error::NotFound(_)) => {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Form not found" })))
        }
        Err(e) => {
            tracing::error!("Failed to update form: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal Error" })))
        }
    }
}

async fn delete_form(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Basic authorization check: verify the form exists and user owns it
    match FormRepository::get_by_id(&state.pool, id).await {
        Ok(Some(form)) => {
            if form.owner_id != claims.sub {
                return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "Forbidden" })));
            }
        }
        Ok(None) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Form not found" }))),
        Err(e) => {
            tracing::error!("Failed to fetch form for deletion: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal Error" })));
        }
    }

    match FormRepository::delete(&state.pool, id).await {
        Ok(_) => {
            tracing::info!(id = %id, user = %claims.sub, "Form deleted");
            (StatusCode::NO_CONTENT, Json(serde_json::json!({})))
        }
        Err(e) => {
            tracing::error!("Failed to delete form: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal Error" })))
        }
    }
}

async fn publish_form(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    match FormRepository::publish(&state.pool, id).await {
        Ok(form) => {
            tracing::info!(id = %id, "Form published");
            (
                StatusCode::OK,
                Json(serde_json::json!({ "id": id, "is_published": form.is_published })),
            )
        }
        Err(signapps_common::Error::NotFound(_)) => {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Form not found" })))
        }
        Err(e) => {
            tracing::error!("Failed to publish form: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal Error" })))
        }
    }
}

async fn submit_response(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SubmitResponseRequest>,
) -> impl IntoResponse {
    match FormRepository::get_by_id(&state.pool, id).await {
        Ok(Some(form)) => {
            if !form.is_published {
                return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "Form is not published" })));
            }
        }
        Ok(None) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Form not found" }))),
        Err(e) => {
            tracing::error!("Failed to get form: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal Error" })));
        }
    }

    let submit_data = SubmitResponse {
        form_id: id,
        respondent: payload.respondent,
        answers: payload.answers,
    };

    match FormRepository::submit_response(&state.pool, submit_data).await {
        Ok(response) => {
            tracing::info!(id = %response.id, form_id = %id, "Response submitted");
            (StatusCode::CREATED, Json(serde_json::to_value(response).unwrap()))
        }
        Err(e) => {
            tracing::error!("Failed to submit response: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal Error" })))
        }
    }
}

async fn list_responses(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    match FormRepository::list_responses(&state.pool, id).await {
        Ok(responses) => (StatusCode::OK, Json(serde_json::to_value(responses).unwrap())),
        Err(e) => {
            tracing::error!("Failed to list responses: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal Error" })))
        }
    }
}

async fn health_check() -> StatusCode {
    StatusCode::OK
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().unwrap(),
            "http://127.0.0.1:3000".parse().unwrap(),
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

    let public_routes = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/forms/:id/respond", post(submit_response));

    let protected_routes = Router::new()
        .route("/api/v1/forms", get(list_forms).post(create_form))
        .route("/api/v1/forms/:id", get(get_form).put(update_form).delete(delete_form))
        .route("/api/v1/forms/:id/publish", post(publish_form))
        .route("/api/v1/forms/:id/responses", get(list_responses))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(protected_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_forms");
    load_env();

    let config = ServiceConfig::from_env("signapps-forms", 3015);
    config.log_startup();

    let db_pool = signapps_db::create_pool(&config.database_url).await?;

    if let Err(e) = signapps_db::run_migrations(&db_pool).await {
        tracing::warn!("Failed to apply database migrations for Forms: {}", e);
    }

    tracing::info!("Running fallback SQL creation for forms schema to bypass sqlx caching...");
    let fallback_sql = include_str!("../../../migrations/041_create_forms.sql");
    use sqlx::Executor;
    match db_pool.inner().execute(fallback_sql).await {
        Ok(_) => tracing::info!("Forms tables successfully created via fallback SQL"),
        Err(e) => tracing::error!("Fallback SQL execution failed: {}", e),
    }

    let pool = db_pool.inner().clone();

    let jwt_config = JwtConfig {
        secret: config.jwt_secret.clone(),
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 3600,
        refresh_expiration: 86400 * 7,
    };

    let state = AppState { jwt_config, pool };

    tracing::info!("Database connected & service ready");

    let app = create_router(state);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
