//! SignApps Contacts Service
//! Manages contacts and address book with group support

mod carddav;
mod carddav_sync;
mod handlers;
mod openapi;

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
use signapps_cache::CacheService;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{auth_middleware, tenant_context_middleware, AuthState};
use signapps_common::pg_events::{NewEvent, PgEventBus};
use signapps_common::{Claims, JwtConfig};
use signapps_db::DatabasePool;
use signapps_sharing::routes::sharing_routes;
use signapps_sharing::{ResourceType, SharingEngine};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
/// Represents a contact.
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

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
/// Represents a contact group.
pub struct ContactGroup {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateContact operation.
pub struct CreateContactRequest {
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub organization: Option<String>,
    pub job_title: Option<String>,
    pub group_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for UpdateContact operation.
pub struct UpdateContactRequest {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub organization: Option<String>,
    pub job_title: Option<String>,
    pub group_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateGroup operation.
pub struct CreateGroupRequest {
    pub name: String,
    pub color: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for UpdateGroup operation.
pub struct UpdateGroupRequest {
    pub name: Option<String>,
    pub color: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for AddGroupMember operation.
pub struct AddGroupMemberRequest {
    pub contact_id: Uuid,
}

// ---------------------------------------------------------------------------
// Application state (in-memory for skeleton)
// ---------------------------------------------------------------------------

#[derive(Clone)]
/// Application state for the Contacts service.
pub struct AppState {
    pub pool: DatabasePool,
    pub jwt_config: JwtConfig,
    pub event_bus: PgEventBus,
}

// ── DB helpers ──────────────────────────────────────────────────────────────

async fn fetch_group_ids(
    pool: &sqlx::PgPool,
    contact_id: Uuid,
) -> Result<Vec<Uuid>, sqlx::Error> {
    let rows: Vec<(Uuid,)> =
        sqlx::query_as("SELECT group_id FROM contact_group_members WHERE contact_id = $1")
            .bind(contact_id)
            .fetch_all(pool)
            .await?;
    Ok(rows.into_iter().map(|(g,)| g).collect())
}

fn row_to_contact(row: &sqlx::postgres::PgRow, group_ids: Vec<Uuid>) -> Contact {
    use sqlx::Row;
    let created: chrono::DateTime<chrono::Utc> = row.try_get("created_at").unwrap_or_else(|_| Utc::now());
    let updated: chrono::DateTime<chrono::Utc> = row.try_get("updated_at").unwrap_or_else(|_| Utc::now());
    Contact {
        id: row.try_get("id").unwrap_or_else(|_| Uuid::nil()),
        owner_id: row.try_get("owner_id").unwrap_or_else(|_| Uuid::nil()),
        first_name: row.try_get("first_name").unwrap_or_default(),
        last_name: row.try_get("last_name").unwrap_or_default(),
        email: row.try_get("email").ok(),
        phone: row.try_get("phone").ok(),
        organization: row.try_get("organization").ok(),
        job_title: row.try_get("job_title").ok(),
        group_ids,
        created_at: created.to_rfc3339(),
        updated_at: updated.to_rfc3339(),
    }
}

fn row_to_group(row: &sqlx::postgres::PgRow) -> ContactGroup {
    use sqlx::Row;
    let created: chrono::DateTime<chrono::Utc> = row.try_get("created_at").unwrap_or_else(|_| Utc::now());
    let updated: chrono::DateTime<chrono::Utc> = row.try_get("updated_at").unwrap_or_else(|_| Utc::now());
    ContactGroup {
        id: row.try_get("id").unwrap_or_else(|_| Uuid::nil()),
        owner_id: row.try_get("owner_id").unwrap_or_else(|_| Uuid::nil()),
        name: row.try_get("name").unwrap_or_default(),
        description: row.try_get("description").ok(),
        color: row.try_get("color").ok(),
        created_at: created.to_rfc3339(),
        updated_at: updated.to_rfc3339(),
    }
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
    path = "/api/v1/contacts",
    responses(
        (status = 200, description = "List of contacts", body = Vec<Contact>),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Contacts",
)]
async fn list_contacts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let pool = state.pool.inner();
    let rows = match sqlx::query(
        "SELECT * FROM contacts WHERE owner_id = $1 ORDER BY updated_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "Failed to list contacts");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!([]))).into_response();
        }
    };

    let mut result = Vec::with_capacity(rows.len());
    for row in &rows {
        use sqlx::Row;
        let id: Uuid = row.try_get("id").unwrap_or_else(|_| Uuid::nil());
        let group_ids = fetch_group_ids(pool, id).await.unwrap_or_default();
        result.push(row_to_contact(row, group_ids));
    }
    Json(result).into_response()
}

#[utoipa::path(
    post,
    path = "/api/v1/contacts",
    request_body = CreateContactRequest,
    responses(
        (status = 201, description = "Contact created", body = Contact),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Contacts",
)]
async fn create_contact(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateContactRequest>,
) -> impl IntoResponse {
    let pool = state.pool.inner();
    let id = Uuid::new_v4();
    let row = match sqlx::query(
        "INSERT INTO contacts
            (id, owner_id, first_name, last_name, email, phone, organization, job_title)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&payload.first_name)
    .bind(&payload.last_name)
    .bind(&payload.email)
    .bind(&payload.phone)
    .bind(&payload.organization)
    .bind(&payload.job_title)
    .fetch_one(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "Failed to insert contact");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "DB insert failed" })),
            );
        }
    };

    let group_ids = payload.group_ids.unwrap_or_default();
    for gid in &group_ids {
        let _ = sqlx::query(
            "INSERT INTO contact_group_members (group_id, contact_id) VALUES ($1, $2)
             ON CONFLICT DO NOTHING",
        )
        .bind(gid)
        .bind(id)
        .execute(pool)
        .await;
    }

    let contact = row_to_contact(&row, group_ids);
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
    (
        StatusCode::CREATED,
        Json(serde_json::to_value(contact).unwrap_or_default()),
    )
}

#[utoipa::path(
    get,
    path = "/api/v1/contacts/{id}",
    params(
        ("id" = Uuid, Path, description = "Contact UUID"),
    ),
    responses(
        (status = 200, description = "Contact found", body = Contact),
        (status = 404, description = "Contact not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Contacts",
)]
async fn get_contact(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let pool = state.pool.inner();
    let row = sqlx::query("SELECT * FROM contacts WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await;
    match row {
        Ok(Some(r)) => {
            let gids = fetch_group_ids(pool, id).await.unwrap_or_default();
            (
                StatusCode::OK,
                Json(serde_json::to_value(row_to_contact(&r, gids)).unwrap_or_default()),
            )
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Contact not found" })),
        ),
        Err(e) => {
            tracing::error!(?e, "Failed to fetch contact");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "DB error" })),
            )
        }
    }
}

#[utoipa::path(
    put,
    path = "/api/v1/contacts/{id}",
    params(
        ("id" = Uuid, Path, description = "Contact UUID"),
    ),
    request_body = UpdateContactRequest,
    responses(
        (status = 200, description = "Contact updated", body = Contact),
        (status = 404, description = "Contact not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Contacts",
)]
async fn update_contact(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateContactRequest>,
) -> impl IntoResponse {
    let pool = state.pool.inner();
    // COALESCE pattern — update only fields provided in payload.
    let row = match sqlx::query(
        "UPDATE contacts SET
            first_name   = COALESCE($2, first_name),
            last_name    = COALESCE($3, last_name),
            email        = COALESCE($4, email),
            phone        = COALESCE($5, phone),
            organization = COALESCE($6, organization),
            job_title    = COALESCE($7, job_title),
            updated_at   = NOW()
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(&payload.first_name)
    .bind(&payload.last_name)
    .bind(&payload.email)
    .bind(&payload.phone)
    .bind(&payload.organization)
    .bind(&payload.job_title)
    .fetch_optional(pool)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Contact not found" })),
            );
        }
        Err(e) => {
            tracing::error!(?e, "Update contact failed");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "DB error" })),
            );
        }
    };

    // Replace group memberships if provided.
    if let Some(new_groups) = payload.group_ids.as_ref() {
        let _ = sqlx::query("DELETE FROM contact_group_members WHERE contact_id = $1")
            .bind(id)
            .execute(pool)
            .await;
        for gid in new_groups {
            let _ = sqlx::query(
                "INSERT INTO contact_group_members (group_id, contact_id) VALUES ($1, $2)
                 ON CONFLICT DO NOTHING",
            )
            .bind(gid)
            .bind(id)
            .execute(pool)
            .await;
        }
    }

    let gids = fetch_group_ids(pool, id).await.unwrap_or_default();
    (
        StatusCode::OK,
        Json(serde_json::to_value(row_to_contact(&row, gids)).unwrap_or_default()),
    )
}

#[utoipa::path(
    delete,
    path = "/api/v1/contacts/{id}",
    params(
        ("id" = Uuid, Path, description = "Contact UUID"),
    ),
    responses(
        (status = 204, description = "Contact deleted"),
        (status = 404, description = "Contact not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Contacts",
)]
async fn delete_contact(State(state): State<AppState>, Path(id): Path<Uuid>) -> StatusCode {
    let pool = state.pool.inner();
    match sqlx::query("DELETE FROM contacts WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
    {
        Ok(res) if res.rows_affected() > 0 => {
            tracing::info!(id = %id, "Contact deleted");
            StatusCode::NO_CONTENT
        }
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => {
            tracing::error!(?e, "Delete contact failed");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

/// POST /api/v1/contacts/import/csv
///
/// Accepts a multipart form upload with a CSV file field named "file".
/// Expected columns (case-insensitive header row): name, email, phone, company
/// or: first_name, last_name, email, phone, company, job_title
///
/// Returns a JSON summary: { imported, skipped, failed }
#[utoipa::path(
    post,
    path = "/api/v1/contacts/import/csv",
    request_body(
        content_type = "multipart/form-data",
        description = "CSV file with contacts (field name: `file`)",
    ),
    responses(
        (status = 200, description = "Import result with counts", body = inline(serde_json::Value)),
        (status = 400, description = "Missing or invalid CSV file"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Contacts",
)]
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

        let id = Uuid::new_v4();
        let email = parse_col(&cols, idx_email);
        let phone = parse_col(&cols, idx_phone);
        let organization = parse_col(&cols, idx_company);
        let job_title = parse_col(&cols, idx_job_title);

        let insert = sqlx::query(
            "INSERT INTO contacts
                (id, owner_id, first_name, last_name, email, phone, organization, job_title)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(id)
        .bind(claims.sub)
        .bind(&first_name)
        .bind(&last_name)
        .bind(&email)
        .bind(&phone)
        .bind(&organization)
        .bind(&job_title)
        .execute(state.pool.inner())
        .await;

        match insert {
            Ok(_) => imported += 1,
            Err(_) => failed += 1,
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

#[utoipa::path(
    get,
    path = "/api/v1/contacts/groups",
    responses(
        (status = 200, description = "List of contact groups", body = Vec<ContactGroup>),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Groups",
)]
async fn list_groups(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let rows = sqlx::query("SELECT * FROM contact_groups WHERE owner_id = $1 ORDER BY name")
        .bind(claims.sub)
        .fetch_all(state.pool.inner())
        .await
        .unwrap_or_default();
    let groups: Vec<ContactGroup> = rows.iter().map(row_to_group).collect();
    Json(groups).into_response()
}

#[utoipa::path(
    post,
    path = "/api/v1/contacts/groups",
    request_body = CreateGroupRequest,
    responses(
        (status = 201, description = "Group created", body = ContactGroup),
        (status = 400, description = "Invalid group name"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Groups",
)]
async fn create_group(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateGroupRequest>,
) -> impl IntoResponse {
    if payload.name.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Group name cannot be empty" })),
        );
    }
    let id = Uuid::new_v4();
    match sqlx::query(
        "INSERT INTO contact_groups (id, owner_id, name, description, color)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.color)
    .fetch_one(state.pool.inner())
    .await
    {
        Ok(row) => {
            let group = row_to_group(&row);
            tracing::info!(id = %group.id, "Contact group created");
            (
                StatusCode::CREATED,
                Json(serde_json::to_value(group).unwrap_or_default()),
            )
        }
        Err(e) => {
            tracing::error!(?e, "Create group failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "DB error" })),
            )
        }
    }
}

#[utoipa::path(
    put,
    path = "/api/v1/contacts/groups/{id}",
    params(
        ("id" = Uuid, Path, description = "Group UUID"),
    ),
    request_body = UpdateGroupRequest,
    responses(
        (status = 200, description = "Group updated", body = ContactGroup),
        (status = 400, description = "Invalid group name"),
        (status = 404, description = "Group not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Groups",
)]
async fn update_group(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateGroupRequest>,
) -> impl IntoResponse {
    if let Some(n) = payload.name.as_ref() {
        if n.trim().is_empty() {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Group name cannot be empty" })),
            );
        }
    }
    match sqlx::query(
        "UPDATE contact_groups SET
            name        = COALESCE($2, name),
            description = COALESCE($3, description),
            color       = COALESCE($4, color),
            updated_at  = NOW()
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.color)
    .fetch_optional(state.pool.inner())
    .await
    {
        Ok(Some(row)) => (
            StatusCode::OK,
            Json(serde_json::to_value(row_to_group(&row)).unwrap_or_default()),
        ),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Group not found" })),
        ),
        Err(e) => {
            tracing::error!(?e, "Update group failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "DB error" })),
            )
        }
    }
}

#[utoipa::path(
    delete,
    path = "/api/v1/contacts/groups/{id}",
    params(
        ("id" = Uuid, Path, description = "Group UUID"),
    ),
    responses(
        (status = 204, description = "Group deleted"),
        (status = 404, description = "Group not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Groups",
)]
async fn delete_group(State(state): State<AppState>, Path(id): Path<Uuid>) -> StatusCode {
    // Cascade: contact_group_members.group_id ON DELETE CASCADE handles membership cleanup.
    match sqlx::query("DELETE FROM contact_groups WHERE id = $1")
        .bind(id)
        .execute(state.pool.inner())
        .await
    {
        Ok(res) if res.rows_affected() > 0 => {
            tracing::info!(id = %id, "Contact group deleted");
            StatusCode::NO_CONTENT
        }
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => {
            tracing::error!(?e, "Delete group failed");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

#[utoipa::path(
    post,
    path = "/api/v1/contacts/groups/{id}/members",
    params(
        ("id" = Uuid, Path, description = "Group UUID"),
    ),
    request_body = AddGroupMemberRequest,
    responses(
        (status = 200, description = "Member added"),
        (status = 404, description = "Group or contact not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Groups",
)]
async fn add_group_member(
    State(state): State<AppState>,
    Path(group_id): Path<Uuid>,
    Json(payload): Json<AddGroupMemberRequest>,
) -> impl IntoResponse {
    let pool = state.pool.inner();
    let group_exists: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM contact_groups WHERE id = $1")
            .bind(group_id)
            .fetch_optional(pool)
            .await
            .unwrap_or(None);
    if group_exists.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Group not found" })),
        );
    }
    let contact_exists: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM contacts WHERE id = $1")
            .bind(payload.contact_id)
            .fetch_optional(pool)
            .await
            .unwrap_or(None);
    if contact_exists.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Contact not found" })),
        );
    }
    let _ = sqlx::query(
        "INSERT INTO contact_group_members (group_id, contact_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING",
    )
    .bind(group_id)
    .bind(payload.contact_id)
    .execute(pool)
    .await;
    let _ = sqlx::query("UPDATE contacts SET updated_at = NOW() WHERE id = $1")
        .bind(payload.contact_id)
        .execute(pool)
        .await;
    (StatusCode::OK, Json(serde_json::json!({ "ok": true })))
}

#[utoipa::path(
    delete,
    path = "/api/v1/contacts/groups/{id}/members/{contact_id}",
    params(
        ("id" = Uuid, Path, description = "Group UUID"),
        ("contact_id" = Uuid, Path, description = "Contact UUID to remove"),
    ),
    responses(
        (status = 204, description = "Member removed"),
        (status = 404, description = "Contact not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Groups",
)]
async fn remove_group_member(
    State(state): State<AppState>,
    Path((group_id, contact_id)): Path<(Uuid, Uuid)>,
) -> StatusCode {
    let pool = state.pool.inner();
    match sqlx::query(
        "DELETE FROM contact_group_members WHERE group_id = $1 AND contact_id = $2",
    )
    .bind(group_id)
    .bind(contact_id)
    .execute(pool)
    .await
    {
        Ok(res) if res.rows_affected() > 0 => {
            let _ = sqlx::query("UPDATE contacts SET updated_at = NOW() WHERE id = $1")
                .bind(contact_id)
                .execute(pool)
                .await;
            StatusCode::NO_CONTENT
        }
        Ok(_) => StatusCode::NOT_FOUND,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "Service is healthy", body = inline(serde_json::Value)),
    ),
    tag = "System",
)]
async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-contacts",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "contacts",
            "label": "Contacts",
            "description": "Répertoire et annuaire",
            "icon": "ContactRound",
            "category": "Organisation",
            "color": "text-indigo-500",
            "href": "/contacts",
            "port": 3021
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
        .merge(signapps_common::version::router("signapps-contacts"));

    let protected_routes = Router::new()
        .route("/api/v1/contacts", get(list_contacts).post(create_contact))
        .route(
            "/api/v1/contacts/groups",
            get(list_groups).post(create_group),
        )
        .route(
            "/api/v1/contacts/groups/:id",
            axum::routing::put(update_group).delete(delete_group),
        )
        .route(
            "/api/v1/contacts/groups/:id/members",
            post(add_group_member),
        )
        .route(
            "/api/v1/contacts/groups/:id/members/:contact_id",
            axum::routing::delete(remove_group_member),
        )
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
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Sharing sub-router: State<SharingEngine> — separate from AppState.
    let sharing_sub =
        sharing_routes("contacts", ResourceType::ContactBook).with_state(sharing_engine);

    // Persons routes (protected)
    let persons_routes = Router::new()
        .route(
            "/api/v1/persons",
            get(handlers::persons::list_persons).post(handlers::persons::create_person),
        )
        .route(
            "/api/v1/persons/:id",
            get(handlers::persons::get_person).put(handlers::persons::update_person),
        )
        .route(
            "/api/v1/persons/:id/assignments",
            get(handlers::persons::get_person_assignments),
        )
        .route(
            "/api/v1/persons/:id/history",
            get(handlers::persons::get_person_history),
        )
        .route(
            "/api/v1/persons/:id/link-user",
            post(handlers::persons::link_user),
        )
        .route(
            "/api/v1/persons/:id/unlink-user",
            post(handlers::persons::unlink_user),
        )
        .route(
            "/api/v1/persons/:id/effective-permissions",
            get(handlers::persons::get_effective_permissions),
        )
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // CRM routes (protected)
    let crm_routes = Router::new()
        .route(
            "/api/v1/crm/deals",
            get(handlers::crm::list_deals).post(handlers::crm::create_deal),
        )
        .route(
            "/api/v1/crm/deals/:id",
            get(handlers::crm::get_deal)
                .put(handlers::crm::update_deal)
                .delete(handlers::crm::delete_deal),
        )
        .route(
            "/api/v1/crm/leads",
            get(handlers::crm::list_leads).post(handlers::crm::create_lead),
        )
        .route(
            "/api/v1/crm/leads/:id",
            get(handlers::crm::get_lead)
                .put(handlers::crm::update_lead)
                .delete(handlers::crm::delete_lead),
        )
        .route("/api/v1/crm/pipeline", get(handlers::crm::get_pipeline))
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(protected_routes)
        .merge(persons_routes)
        .merge(crm_routes)
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
    init_tracing("signapps_contacts");
    load_env();

    let config = ServiceConfig::from_env("signapps-contacts", 3021);
    config.log_startup();

    // JWT config — auto-detects RS256 or HS256 from environment
    let jwt_config = JwtConfig::from_env();

    let pool = signapps_db::create_pool(&config.database_url)
        .await
        .expect("Failed to connect to Postgres");
    tracing::info!("Database pool created for event publishing");

    let event_bus = PgEventBus::new(pool.inner().clone(), "signapps-contacts".to_string());

    let state = AppState {
        pool: pool.clone(),
        jwt_config,
        event_bus,
    };

    tracing::info!("Contacts service backed by PostgreSQL");

    let sharing_engine = SharingEngine::new(pool.inner().clone(), CacheService::default_config());

    let app = create_router(state, sharing_engine);

    signapps_common::bootstrap::run_server(app, &config).await?;

    Ok(())
}
