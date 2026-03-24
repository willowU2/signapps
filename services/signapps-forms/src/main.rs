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
use signapps_common::Claims;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{auth_middleware, AuthState};
use signapps_common::JwtConfig;
use std::sync::{Arc, Mutex};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Form {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub owner_id: Uuid,
    pub fields: Vec<FormField>,
    pub created_at: String,
    pub updated_at: String,
    pub is_published: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Answer {
    pub field_id: Uuid,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormResponse {
    pub id: Uuid,
    pub form_id: Uuid,
    pub respondent: Option<String>,
    pub answers: Vec<Answer>,
    pub submitted_at: String,
}

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
// Application state (in-memory for skeleton)
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct AppState {
    pub jwt_config: JwtConfig,
    pub forms: Arc<Mutex<Vec<Form>>>,
    pub responses: Arc<Mutex<Vec<FormResponse>>>,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn list_forms(State(state): State<AppState>) -> impl IntoResponse {
    let forms = state.forms.lock().unwrap_or_else(|e| e.into_inner());
    Json(forms.clone())
}

async fn create_form(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateFormRequest>,
) -> impl IntoResponse {
    let now = Utc::now().to_rfc3339();
    let fields: Vec<FormField> = payload
        .fields
        .into_iter()
        .map(|f| FormField {
            id: Uuid::new_v4(),
            field_type: f.field_type,
            label: f.label,
            required: f.required,
            options: f.options,
        })
        .collect();

    let form = Form {
        id: Uuid::new_v4(),
        title: payload.title,
        description: payload.description.unwrap_or_default(),
        owner_id: claims.sub,
        fields,
        created_at: now.clone(),
        updated_at: now,
        is_published: false,
    };
    state.forms.lock().unwrap_or_else(|e| e.into_inner()).push(form.clone());
    tracing::info!(id = %form.id, "Form created");
    (StatusCode::CREATED, Json(form))
}

async fn get_form(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let forms = state.forms.lock().unwrap_or_else(|e| e.into_inner());
    match forms.iter().find(|f| f.id == id) {
        Some(f) => (StatusCode::OK, Json(serde_json::to_value(f).unwrap_or_default())),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Form not found" })),
        ),
    }
}

async fn update_form(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateFormRequest>,
) -> impl IntoResponse {
    let mut forms = state.forms.lock().unwrap_or_else(|e| e.into_inner());
    match forms.iter_mut().find(|f| f.id == id) {
        Some(f) => {
            if let Some(v) = payload.title {
                f.title = v;
            }
            if let Some(v) = payload.description {
                f.description = v;
            }
            if let Some(new_fields) = payload.fields {
                f.fields = new_fields
                    .into_iter()
                    .map(|cf| FormField {
                        id: Uuid::new_v4(),
                        field_type: cf.field_type,
                        label: cf.label,
                        required: cf.required,
                        options: cf.options,
                    })
                    .collect();
            }
            f.updated_at = Utc::now().to_rfc3339();
            (StatusCode::OK, Json(serde_json::to_value(&*f).unwrap_or_default()))
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Form not found" })),
        ),
    }
}

async fn publish_form(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let mut forms = state.forms.lock().unwrap_or_else(|e| e.into_inner());
    match forms.iter_mut().find(|f| f.id == id) {
        Some(f) => {
            f.is_published = !f.is_published;
            f.updated_at = Utc::now().to_rfc3339();
            let status = if f.is_published { "published" } else { "unpublished" };
            tracing::info!(id = %id, status, "Form publish toggled");
            (
                StatusCode::OK,
                Json(serde_json::json!({ "id": id, "is_published": f.is_published })),
            )
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Form not found" })),
        ),
    }
}

async fn submit_response(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SubmitResponseRequest>,
) -> impl IntoResponse {
    // Verify form exists and is published (no auth needed for public forms)
    let is_published = {
        let forms = state.forms.lock().unwrap_or_else(|e| e.into_inner());
        forms.iter().find(|f| f.id == id).map(|f| f.is_published)
    };
    match is_published {
        None => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Form not found" }))),
        Some(false) => return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "Form is not published" }))),
        _ => {}
    }
    let response = FormResponse {
        id: Uuid::new_v4(),
        form_id: id,
        respondent: payload.respondent,
        answers: payload.answers,
        submitted_at: Utc::now().to_rfc3339(),
    };
    state.responses.lock().unwrap_or_else(|e| e.into_inner()).push(response.clone());
    tracing::info!(id = %response.id, form_id = %id, "Response submitted");
    (StatusCode::CREATED, Json(serde_json::to_value(response).unwrap_or_default()))
}

async fn list_responses(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let exists = state.forms.lock().unwrap_or_else(|e| e.into_inner()).iter().any(|f| f.id == id);
    if !exists {
        return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Form not found" })));
    }
    let responses = state.responses.lock().unwrap_or_else(|e| e.into_inner());
    let form_responses: Vec<&FormResponse> = responses.iter().filter(|r| r.form_id == id).collect();
    (StatusCode::OK, Json(serde_json::to_value(form_responses).unwrap_or_default()))
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
        ]);

    // Public routes: health + submit response (no auth for published forms)
    let public_routes = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/forms/:id/respond", post(submit_response));

    // Protected routes: CRUD + publish + view responses
    let protected_routes = Router::new()
        .route("/api/v1/forms", get(list_forms).post(create_form))
        .route(
            "/api/v1/forms/:id",
            get(get_form).put(update_form),
        )
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

    let jwt_config = JwtConfig {
        secret: config.jwt_secret.clone(),
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 3600,
        refresh_expiration: 86400 * 7,
    };

    let state = AppState {
        jwt_config,
        forms: Arc::new(Mutex::new(Vec::new())),
        responses: Arc::new(Mutex::new(Vec::new())),
    };

    tracing::info!("In-memory store initialized (skeleton — no DB yet)");

    let app = create_router(state);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
