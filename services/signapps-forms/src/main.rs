//! SignApps Forms Service
//! Forms builder and response collector (Google Forms equivalent)

mod openapi;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use signapps_cache::CacheService;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{auth_middleware, tenant_context_middleware, AuthState};
use signapps_common::pg_events::{NewEvent, PgEventBus};
use signapps_common::Claims;
use signapps_common::JwtConfig;
use signapps_db::models::{Answer, CreateForm, FieldType, FormField, SubmitResponse, UpdateForm};
use signapps_db::repositories::FormRepository;
use signapps_sharing::routes::sharing_routes;
use signapps_sharing::{ResourceType, SharingEngine};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// FM3 — Webhook config types
// ---------------------------------------------------------------------------

/// Request body for setting a webhook URL on a form.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct SetWebhookRequest {
    /// The URL to POST to when a response is submitted.
    /// Pass `null` or omit to remove the webhook.
    pub url: Option<String>,
    /// Optional secret included in the `X-Webhook-Secret` header.
    pub secret: Option<String>,
}

/// Stored webhook configuration (serialised to DB as JSON in form metadata).
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct WebhookConfig {
    pub url: String,
    pub secret: Option<String>,
}

// In-memory webhook store: form_id → config
type WebhookStore =
    std::sync::Arc<tokio::sync::RwLock<std::collections::HashMap<Uuid, WebhookConfig>>>;

fn new_webhook_store() -> WebhookStore {
    std::sync::Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new()))
}

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateForm operation.
pub struct CreateFormRequest {
    pub title: String,
    pub description: Option<String>,
    #[serde(default)]
    pub fields: Vec<CreateFieldRequest>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateField operation.
pub struct CreateFieldRequest {
    #[serde(default)]
    pub field_type: FieldType,
    pub label: String,
    #[serde(default)]
    pub required: bool,
    pub options: Option<Vec<String>>,
    pub layout: Option<String>,
    pub placeholder: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for UpdateForm operation.
pub struct UpdateFormRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub fields: Option<Vec<CreateFieldRequest>>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for SubmitResponse operation.
pub struct SubmitResponseRequest {
    pub respondent: Option<String>,
    pub answers: Vec<Answer>,
}

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

#[derive(Clone)]
/// Application state for  service.
pub struct AppState {
    pub jwt_config: JwtConfig,
    pub pool: sqlx::PgPool,
    pub event_bus: PgEventBus,
    /// FM3: in-memory webhook config store (form_id → WebhookConfig)
    pub webhooks: WebhookStore,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

#[utoipa::path(
    get,
    path = "/api/v1/forms",
    responses(
        (status = 200, description = "List of forms owned by the authenticated user"),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "forms"
)]
async fn list_forms(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match FormRepository::list_by_owner(&state.pool, claims.sub).await {
        Ok(forms) => (
            StatusCode::OK,
            Json(serde_json::to_value(forms).unwrap_or_default()),
        ),
        Err(e) => {
            tracing::error!("Failed to list forms: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

#[utoipa::path(
    post,
    path = "/api/v1/forms",
    request_body = CreateFormRequest,
    responses(
        (status = 201, description = "Form created"),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "forms"
)]
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
            placeholder: f.placeholder,
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
            (
                StatusCode::CREATED,
                Json(serde_json::to_value(form).unwrap_or_default()),
            )
        },
        Err(e) => {
            tracing::error!("Failed to create form: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

#[utoipa::path(
    get,
    path = "/api/v1/forms/{id}",
    params(("id" = Uuid, Path, description = "Form UUID")),
    responses(
        (status = 200, description = "Form found"),
        (status = 404, description = "Form not found"),
        (status = 500, description = "Internal error"),
    ),
    tag = "forms"
)]
async fn get_form(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    match FormRepository::get_by_id(&state.pool, id).await {
        Ok(Some(form)) => (
            StatusCode::OK,
            Json(serde_json::to_value(form).unwrap_or_default()),
        ),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Form not found" })),
        ),
        Err(e) => {
            tracing::error!("Failed to get form: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

#[utoipa::path(
    put,
    path = "/api/v1/forms/{id}",
    params(("id" = Uuid, Path, description = "Form UUID")),
    request_body = UpdateFormRequest,
    responses(
        (status = 200, description = "Form updated"),
        (status = 404, description = "Form not found"),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "forms"
)]
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
                placeholder: f.placeholder,
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
        Ok(form) => (
            StatusCode::OK,
            Json(serde_json::to_value(form).unwrap_or_default()),
        ),
        Err(signapps_common::Error::NotFound(_)) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Form not found" })),
        ),
        Err(e) => {
            tracing::error!("Failed to update form: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

#[utoipa::path(
    delete,
    path = "/api/v1/forms/{id}",
    params(("id" = Uuid, Path, description = "Form UUID")),
    responses(
        (status = 204, description = "Form deleted"),
        (status = 403, description = "Forbidden — caller does not own this form"),
        (status = 404, description = "Form not found"),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "forms"
)]
async fn delete_form(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Basic authorization check: verify the form exists and user owns it
    match FormRepository::get_by_id(&state.pool, id).await {
        Ok(Some(form)) => {
            if form.owner_id != claims.sub {
                return (
                    StatusCode::FORBIDDEN,
                    Json(serde_json::json!({ "error": "Forbidden" })),
                );
            }
        },
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Form not found" })),
            )
        },
        Err(e) => {
            tracing::error!("Failed to fetch form for deletion: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            );
        },
    }

    match FormRepository::delete(&state.pool, id).await {
        Ok(_) => {
            tracing::info!(id = %id, user = %claims.sub, "Form deleted");
            (StatusCode::NO_CONTENT, Json(serde_json::json!({})))
        },
        Err(e) => {
            tracing::error!("Failed to delete form: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

#[utoipa::path(
    post,
    path = "/api/v1/forms/{id}/publish",
    params(("id" = Uuid, Path, description = "Form UUID")),
    responses(
        (status = 200, description = "Form published"),
        (status = 404, description = "Form not found"),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "forms"
)]
async fn publish_form(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    match FormRepository::publish(&state.pool, id).await {
        Ok(form) => {
            tracing::info!(id = %id, "Form published");
            (
                StatusCode::OK,
                Json(serde_json::json!({ "id": id, "is_published": form.is_published })),
            )
        },
        Err(signapps_common::Error::NotFound(_)) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Form not found" })),
        ),
        Err(e) => {
            tracing::error!("Failed to publish form: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

#[utoipa::path(
    patch,
    path = "/api/v1/forms/{id}/unpublish",
    params(("id" = Uuid, Path, description = "Form UUID")),
    responses(
        (status = 200, description = "Form unpublished"),
        (status = 404, description = "Form not found"),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "forms"
)]
async fn unpublish_form(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let result = sqlx::query_as::<_, signapps_db::models::Form>(
        r#"UPDATE forms.forms SET is_published = FALSE, updated_at = NOW()
           WHERE id = $1 RETURNING *"#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(form)) => {
            tracing::info!(id = %id, "Form unpublished");
            (
                StatusCode::OK,
                Json(serde_json::json!({ "id": id, "is_published": form.is_published })),
            )
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Form not found" })),
        ),
        Err(e) => {
            tracing::error!("Failed to unpublish form: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

#[utoipa::path(
    post,
    path = "/api/v1/forms/{id}/respond",
    params(("id" = Uuid, Path, description = "Form UUID")),
    request_body = SubmitResponseRequest,
    responses(
        (status = 201, description = "Response submitted"),
        (status = 403, description = "Form is not published"),
        (status = 404, description = "Form not found"),
        (status = 500, description = "Internal error"),
    ),
    tag = "forms"
)]
async fn submit_response(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SubmitResponseRequest>,
) -> impl IntoResponse {
    match FormRepository::get_by_id(&state.pool, id).await {
        Ok(Some(form)) => {
            if !form.is_published {
                return (
                    StatusCode::FORBIDDEN,
                    Json(serde_json::json!({ "error": "Form is not published" })),
                );
            }
        },
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Form not found" })),
            )
        },
        Err(e) => {
            tracing::error!("Failed to get form: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            );
        },
    }

    let submit_data = SubmitResponse {
        form_id: id,
        respondent: payload.respondent,
        answers: payload.answers,
    };

    match FormRepository::submit_response(&state.pool, submit_data).await {
        Ok(response) => {
            tracing::info!(id = %response.id, form_id = %id, "Response submitted");
            let event_payload = serde_json::json!({
                "form_id": id,
                "response_id": response.id,
            });
            let _ = state
                .event_bus
                .publish(NewEvent {
                    event_type: "forms.response.submitted".into(),
                    aggregate_id: Some(response.id),
                    payload: event_payload.clone(),
                })
                .await;
            // FM3: dispatch webhook if configured
            dispatch_webhook(state.webhooks.clone(), id, event_payload);
            (
                StatusCode::CREATED,
                Json(serde_json::to_value(response).unwrap_or_default()),
            )
        },
        Err(e) => {
            tracing::error!("Failed to submit response: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

#[utoipa::path(
    get,
    path = "/api/v1/forms/{id}/responses",
    params(("id" = Uuid, Path, description = "Form UUID")),
    responses(
        (status = 200, description = "List of responses for this form"),
        (status = 500, description = "Internal error"),
    ),
    security(("bearerAuth" = [])),
    tag = "forms"
)]
async fn list_responses(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    match FormRepository::list_responses(&state.pool, id).await {
        Ok(responses) => (
            StatusCode::OK,
            Json(serde_json::to_value(responses).unwrap_or_default()),
        ),
        Err(e) => {
            tracing::error!("Failed to list responses: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        },
    }
}

// ---------------------------------------------------------------------------
// FM3 — Webhook handlers
// ---------------------------------------------------------------------------

/// POST /api/v1/forms/:id/webhook
///
/// Set (or clear) a webhook URL for the given form.
/// When a response is submitted, the service will POST to this URL.
#[utoipa::path(
    post,
    path = "/api/v1/forms/{id}/webhook",
    params(("id" = Uuid, Path, description = "Form UUID")),
    request_body = SetWebhookRequest,
    responses(
        (status = 200, description = "Webhook set or cleared"),
    ),
    security(("bearerAuth" = [])),
    tag = "forms-webhooks"
)]
async fn set_webhook(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SetWebhookRequest>,
) -> impl IntoResponse {
    match payload.url {
        Some(url) if !url.is_empty() => {
            let config = WebhookConfig {
                url,
                secret: payload.secret,
            };
            state.webhooks.write().await.insert(id, config.clone());
            tracing::info!(form_id = %id, url = %config.url, "Webhook set");
            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "form_id": id,
                    "webhook_url": config.url,
                    "has_secret": config.secret.is_some()
                })),
            )
        },
        _ => {
            state.webhooks.write().await.remove(&id);
            tracing::info!(form_id = %id, "Webhook removed");
            (
                StatusCode::OK,
                Json(serde_json::json!({ "form_id": id, "webhook_url": null })),
            )
        },
    }
}

/// GET /api/v1/forms/:id/webhook
///
/// Returns the current webhook configuration for the given form (secret redacted).
#[utoipa::path(
    get,
    path = "/api/v1/forms/{id}/webhook",
    params(("id" = Uuid, Path, description = "Form UUID")),
    responses(
        (status = 200, description = "Current webhook configuration (secret redacted)"),
    ),
    security(("bearerAuth" = [])),
    tag = "forms-webhooks"
)]
async fn get_webhook(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match state.webhooks.read().await.get(&id) {
        Some(cfg) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "form_id": id,
                "webhook_url": cfg.url,
                "has_secret": cfg.secret.is_some()
            })),
        ),
        None => (
            StatusCode::OK,
            Json(serde_json::json!({ "form_id": id, "webhook_url": null })),
        ),
    }
}

/// Fire the webhook for a form (called after a response is submitted).
/// Non-blocking: spawns a task, never fails the caller.
fn dispatch_webhook(webhooks: WebhookStore, form_id: Uuid, payload: serde_json::Value) {
    tokio::spawn(async move {
        let config = {
            let lock = webhooks.read().await;
            lock.get(&form_id).cloned()
        };
        let Some(cfg) = config else { return };

        let client = reqwest::Client::new();
        let mut req = client
            .post(&cfg.url)
            .header("Content-Type", "application/json")
            .header("X-SignApps-Event", "forms.response.submitted");

        if let Some(secret) = &cfg.secret {
            req = req.header("X-Webhook-Secret", secret.as_str());
        }

        match req.json(&payload).send().await {
            Ok(r) if r.status().is_success() => {
                tracing::info!(form_id = %form_id, url = %cfg.url, "Webhook delivered");
            },
            Ok(r) => {
                tracing::warn!(form_id = %form_id, status = %r.status(), "Webhook returned non-2xx");
            },
            Err(e) => {
                tracing::error!(form_id = %form_id, "Webhook delivery failed: {e}");
            },
        }
    });
}

async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-forms",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "forms",
            "label": "Formulaires",
            "description": "Formulaires et sondages",
            "icon": "ClipboardList",
            "category": "Productivité",
            "color": "text-violet-500",
            "href": "/forms",
            "port": 3015
        }
    }))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

fn create_router(state: AppState, sharing_engine: SharingEngine) -> Router {
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

    let public_routes = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/forms/:id/respond", post(submit_response))
        .merge(signapps_common::version::router("signapps-forms"));

    let protected_routes = Router::new()
        .route("/api/v1/forms", get(list_forms).post(create_form))
        .route(
            "/api/v1/forms/:id",
            get(get_form).put(update_form).delete(delete_form),
        )
        .route("/api/v1/forms/:id/publish", post(publish_form))
        .route(
            "/api/v1/forms/:id/unpublish",
            axum::routing::patch(unpublish_form),
        )
        .route("/api/v1/forms/:id/responses", get(list_responses))
        // FM3: Webhook management
        .route(
            "/api/v1/forms/:id/webhook",
            get(get_webhook).post(set_webhook),
        )
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Sharing sub-router: State<SharingEngine> — separate from AppState.
    let sharing_sub = sharing_routes("forms", ResourceType::Form)
        .with_state(sharing_engine);

    public_routes
        .merge(protected_routes)
        .merge(sharing_sub)
        .merge(openapi::swagger_router())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

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
    let fallback_sql = include_str!("../../../migrations/051_create_forms.sql");
    use sqlx::Executor;
    match db_pool.inner().execute(fallback_sql).await {
        Ok(_) => tracing::info!("Forms tables successfully created via fallback SQL"),
        Err(e) => tracing::error!("Fallback SQL execution failed: {}", e),
    }

    let pool = db_pool.inner().clone();

    // JWT config — auto-detects RS256 or HS256 from environment
    let jwt_config = JwtConfig::from_env();

    let event_bus = PgEventBus::new(pool.clone(), "signapps-forms".to_string());

    let state = AppState {
        jwt_config,
        pool: pool.clone(),
        event_bus,
        webhooks: new_webhook_store(),
    };

    let sharing_engine = SharingEngine::new(pool, CacheService::default_config());

    tracing::info!("Database connected & service ready");

    let app = create_router(state, sharing_engine);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
