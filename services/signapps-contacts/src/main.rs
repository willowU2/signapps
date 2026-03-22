//! SignApps Contacts Service
//! Manages contacts and address book with group support

mod carddav;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
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
pub struct Contact {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub organization: Option<String>,
    pub job_title: Option<String>,
    pub group_ids: Vec<Uuid>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactGroup {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateContactRequest {
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub organization: Option<String>,
    pub job_title: Option<String>,
    pub group_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateContactRequest {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub organization: Option<String>,
    pub job_title: Option<String>,
    pub group_ids: Option<Vec<Uuid>>,
}

// ---------------------------------------------------------------------------
// Application state (in-memory for skeleton)
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct AppState {
    pub jwt_config: JwtConfig,
    pub contacts: Arc<Mutex<Vec<Contact>>>,
    pub groups: Arc<Mutex<Vec<ContactGroup>>>,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn list_contacts(State(state): State<AppState>) -> impl IntoResponse {
    let contacts = state.contacts.lock().unwrap();
    Json(contacts.clone())
}

async fn create_contact(
    State(state): State<AppState>,
    Json(payload): Json<CreateContactRequest>,
) -> impl IntoResponse {
    let now = Utc::now().to_rfc3339();
    let contact = Contact {
        id: Uuid::new_v4(),
        owner_id: Uuid::nil(), // TODO: extract from JWT claims
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
        phone: payload.phone,
        organization: payload.organization,
        job_title: payload.job_title,
        group_ids: payload.group_ids.unwrap_or_default(),
        created_at: now.clone(),
        updated_at: now,
    };
    state.contacts.lock().unwrap().push(contact.clone());
    tracing::info!(id = %contact.id, "Contact created");
    (StatusCode::CREATED, Json(contact))
}

async fn get_contact(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let contacts = state.contacts.lock().unwrap();
    match contacts.iter().find(|c| c.id == id) {
        Some(c) => (StatusCode::OK, Json(serde_json::to_value(c).unwrap())),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Contact not found" })),
        ),
    }
}

async fn update_contact(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateContactRequest>,
) -> impl IntoResponse {
    let mut contacts = state.contacts.lock().unwrap();
    match contacts.iter_mut().find(|c| c.id == id) {
        Some(c) => {
            if let Some(v) = payload.first_name { c.first_name = v; }
            if let Some(v) = payload.last_name  { c.last_name = v; }
            if payload.email.is_some()        { c.email = payload.email; }
            if payload.phone.is_some()        { c.phone = payload.phone; }
            if payload.organization.is_some() { c.organization = payload.organization; }
            if payload.job_title.is_some()    { c.job_title = payload.job_title; }
            if let Some(v) = payload.group_ids { c.group_ids = v; }
            c.updated_at = Utc::now().to_rfc3339();
            (StatusCode::OK, Json(serde_json::to_value(&*c).unwrap()))
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Contact not found" })),
        ),
    }
}

async fn delete_contact(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    let mut contacts = state.contacts.lock().unwrap();
    let before = contacts.len();
    contacts.retain(|c| c.id != id);
    if contacts.len() < before {
        tracing::info!(id = %id, "Contact deleted");
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

async fn list_groups(State(state): State<AppState>) -> impl IntoResponse {
    let groups = state.groups.lock().unwrap();
    Json(groups.clone())
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

    let public_routes = Router::new().route("/health", get(health_check));

    let protected_routes = Router::new()
        .route("/api/v1/contacts", get(list_contacts).post(create_contact))
        .route("/api/v1/contacts/groups", get(list_groups))
        .route("/api/v1/contacts/export/vcf", get(carddav::export_vcf))
        .route("/api/v1/contacts/import/vcf", post(carddav::import_vcf))
        .route(
            "/api/v1/contacts/:id",
            get(get_contact).put(update_contact).delete(delete_contact),
        )
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
    init_tracing("signapps_contacts");
    load_env();

    let config = ServiceConfig::from_env("signapps-contacts", 3014);
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
        contacts: Arc::new(Mutex::new(Vec::new())),
        groups: Arc::new(Mutex::new(Vec::new())),
    };

    tracing::info!("In-memory store initialized (skeleton — no DB yet)");

    let app = create_router(state);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
