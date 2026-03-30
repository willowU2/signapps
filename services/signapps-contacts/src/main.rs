//! SignApps Contacts Service
//! Manages contacts and address book with group support

mod carddav;
mod carddav_sync;

use axum::{
    extract::{Multipart, Path, State},
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
use signapps_common::pg_events::{NewEvent, PgEventBus};
use signapps_common::{Claims, JwtConfig};
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
    pub event_bus: PgEventBus,
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
    let contacts = state.contacts.lock().unwrap_or_else(|e| e.into_inner());
    Json(contacts.clone())
}

async fn create_contact(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateContactRequest>,
) -> impl IntoResponse {
    let now = Utc::now().to_rfc3339();
    let contact = Contact {
        id: Uuid::new_v4(),
        owner_id: claims.sub,
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
    state
        .contacts
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .push(contact.clone());
    tracing::info!(id = %contact.id, "Contact created");
    let _ = state
        .event_bus
        .publish(NewEvent {
            event_type: "contacts.created".into(),
            aggregate_id: Some(contact.id),
            payload: serde_json::json!({
                "owner_id": claims.sub,
                "first_name": contact.first_name,
                "last_name": contact.last_name,
            }),
        })
        .await;
    (StatusCode::CREATED, Json(contact))
}

async fn get_contact(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let contacts = state.contacts.lock().unwrap_or_else(|e| e.into_inner());
    match contacts.iter().find(|c| c.id == id) {
        Some(c) => (
            StatusCode::OK,
            Json(serde_json::to_value(c).unwrap_or_default()),
        ),
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
    let mut contacts = state.contacts.lock().unwrap_or_else(|e| e.into_inner());
    match contacts.iter_mut().find(|c| c.id == id) {
        Some(c) => {
            if let Some(v) = payload.first_name {
                c.first_name = v;
            }
            if let Some(v) = payload.last_name {
                c.last_name = v;
            }
            if payload.email.is_some() {
                c.email = payload.email;
            }
            if payload.phone.is_some() {
                c.phone = payload.phone;
            }
            if payload.organization.is_some() {
                c.organization = payload.organization;
            }
            if payload.job_title.is_some() {
                c.job_title = payload.job_title;
            }
            if let Some(v) = payload.group_ids {
                c.group_ids = v;
            }
            c.updated_at = Utc::now().to_rfc3339();
            (
                StatusCode::OK,
                Json(serde_json::to_value(&*c).unwrap_or_default()),
            )
        },
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Contact not found" })),
        ),
    }
}

async fn delete_contact(State(state): State<AppState>, Path(id): Path<Uuid>) -> StatusCode {
    let mut contacts = state.contacts.lock().unwrap_or_else(|e| e.into_inner());
    let before = contacts.len();
    contacts.retain(|c| c.id != id);
    if contacts.len() < before {
        tracing::info!(id = %id, "Contact deleted");
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

/// POST /api/v1/contacts/import/csv
///
/// Accepts a multipart form upload with a CSV file field named "file".
/// Expected columns (case-insensitive header row): name, email, phone, company
/// or: first_name, last_name, email, phone, company, job_title
///
/// Returns a JSON summary: { imported, skipped, failed }
async fn import_contacts_csv(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut csv_bytes: Vec<u8> = Vec::new();

    // Extract the file field from the multipart body
    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            match field.bytes().await {
                Ok(b) => {
                    csv_bytes = b.to_vec();
                    break;
                },
                Err(e) => {
                    tracing::error!("Failed to read CSV field: {e}");
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({ "error": "Failed to read uploaded file" })),
                    );
                },
            }
        }
    }

    if csv_bytes.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "No file field found in multipart body" })),
        );
    }

    // Parse CSV
    let content = match std::str::from_utf8(&csv_bytes) {
        Ok(s) => s.to_string(),
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "CSV file must be UTF-8 encoded" })),
            )
        },
    };

    let mut imported = 0u32;
    let mut skipped = 0u32;
    let mut failed = 0u32;
    let now = Utc::now().to_rfc3339();

    let mut lines = content.lines();

    // Parse header row
    let header_line = match lines.next() {
        Some(h) => h,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "CSV file is empty" })),
            )
        },
    };

    let headers: Vec<String> = header_line
        .split(',')
        .map(|h| h.trim().to_lowercase().replace('"', ""))
        .collect();

    // Map header names to column indexes
    let col = |name: &str| -> Option<usize> { headers.iter().position(|h| h == name) };

    let idx_first_name = col("first_name");
    let idx_last_name = col("last_name");
    let idx_name = col("name"); // "Name, Surname" or "Full Name"
    let idx_email = col("email");
    let idx_phone = col("phone");
    let idx_company = col("company").or_else(|| col("organization"));
    let idx_job_title = col("job_title").or_else(|| col("title"));

    let parse_col = |row: &[&str], idx: Option<usize>| -> Option<String> {
        idx.and_then(|i| row.get(i))
            .map(|v| v.trim().replace('"', ""))
            .filter(|v| !v.is_empty())
    };

    for line in lines {
        if line.trim().is_empty() {
            skipped += 1;
            continue;
        }
        let cols: Vec<&str> = line.split(',').collect();

        let (first_name, last_name) = if let (Some(f), Some(l)) = (
            parse_col(&cols, idx_first_name),
            parse_col(&cols, idx_last_name),
        ) {
            (f, l)
        } else if let Some(full) = parse_col(&cols, idx_name) {
            let parts: Vec<&str> = full.splitn(2, ' ').collect();
            let first = parts.first().copied().unwrap_or("").to_string();
            let last = parts.get(1).copied().unwrap_or("").to_string();
            (first, last)
        } else {
            skipped += 1;
            continue;
        };

        if first_name.is_empty() && last_name.is_empty() {
            skipped += 1;
            continue;
        }

        let contact = Contact {
            id: Uuid::new_v4(),
            owner_id: claims.sub,
            first_name,
            last_name,
            email: parse_col(&cols, idx_email),
            phone: parse_col(&cols, idx_phone),
            organization: parse_col(&cols, idx_company),
            job_title: parse_col(&cols, idx_job_title),
            group_ids: vec![],
            created_at: now.clone(),
            updated_at: now.clone(),
        };

        match state.contacts.lock() {
            Ok(mut lock) => {
                lock.push(contact);
                imported += 1;
            },
            Err(_) => {
                failed += 1;
            },
        }
    }

    tracing::info!(
        owner = %claims.sub,
        imported,
        skipped,
        failed,
        "CSV contacts import completed"
    );

    (
        StatusCode::OK,
        Json(serde_json::json!({ "imported": imported, "skipped": skipped, "failed": failed })),
    )
}

async fn list_groups(State(state): State<AppState>) -> impl IntoResponse {
    let groups = state.groups.lock().unwrap_or_else(|e| e.into_inner());
    Json(groups.clone())
}

async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-contacts",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds()
    }))
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

    let public_routes = Router::new().route("/health", get(health_check));

    let protected_routes = Router::new()
        .route("/api/v1/contacts", get(list_contacts).post(create_contact))
        .route("/api/v1/contacts/groups", get(list_groups))
        .route("/api/v1/contacts/import/csv", post(import_contacts_csv))
        .route("/api/v1/contacts/export/vcf", get(carddav::export_vcf))
        .route("/api/v1/contacts/import/vcf", post(carddav::import_vcf))
        .route(
            "/api/v1/contacts/carddav/sync",
            post(carddav_sync::sync_carddav),
        )
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

    let pool = signapps_db::create_pool(&config.database_url)
        .await
        .expect("Failed to connect to Postgres");
    tracing::info!("Database pool created for event publishing");

    let event_bus = PgEventBus::new(pool.inner().clone(), "signapps-contacts".to_string());

    let state = AppState {
        jwt_config,
        contacts: Arc::new(Mutex::new(Vec::new())),
        groups: Arc::new(Mutex::new(Vec::new())),
        event_bus,
    };

    tracing::info!("In-memory store initialized (skeleton — no DB yet)");

    let app = create_router(state);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
