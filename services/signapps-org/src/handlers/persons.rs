//! CRUD handlers for `/api/v1/org/persons` — canonical surface (S1 W2).
//!
//! Backed by [`PersonRepository`].
//!
//! Events emitted:
//! - `org.user.created` on successful create (matches the plan's W5
//!   provisioning fanout topic name).
//! - `org.user.updated` on successful update.
//! - `org.user.archived` on successful archive.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use signapps_common::pg_events::NewEvent;
use signapps_common::{Error, Result};
use signapps_db::models::org::Person;
use signapps_db::repositories::org::PersonRepository;
use uuid::Uuid;

use crate::event_publisher::OrgEventPublisher;
use crate::AppState;

// ============================================================================
// Router
// ============================================================================

/// Build the persons CRUD router nested at `/api/v1/org/persons`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/:id", get(detail).patch(update).delete(archive))
}

// ============================================================================
// Request / response DTOs
// ============================================================================

/// Query parameters for `GET /api/v1/org/persons`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Tenant UUID — required.
    pub tenant_id: Uuid,
}

/// Request body for `POST /api/v1/org/persons`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreatePersonBody {
    /// Tenant owner.
    pub tenant_id: Uuid,
    /// Primary email (unique per tenant).
    pub email: String,
    /// First name (optional).
    pub first_name: Option<String>,
    /// Last name (optional).
    pub last_name: Option<String>,
    /// Optional LDAP/AD Distinguished Name.
    pub dn: Option<String>,
}

/// Request body for `PATCH /api/v1/org/persons/:id`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdatePersonBody {
    /// New first name (optional).
    pub first_name: Option<String>,
    /// New last name (optional).
    pub last_name: Option<String>,
    /// New email (optional).
    pub email: Option<String>,
    /// New DN (optional).
    pub dn: Option<String>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/org/persons — list all active persons for a tenant.
#[utoipa::path(
    get,
    path = "/api/v1/org/persons",
    tag = "Org",
    params(ListQuery),
    responses(
        (status = 200, description = "Active persons for tenant", body = Vec<Person>),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Person>>> {
    let repo = PersonRepository::new(st.pool.inner());
    let persons = repo
        .list_by_tenant(q.tenant_id)
        .await
        .map_err(|e| Error::Database(format!("list_by_tenant: {e}")))?;
    Ok(Json(persons))
}

/// POST /api/v1/org/persons — create a person + emit `org.user.created`.
#[utoipa::path(
    post,
    path = "/api/v1/org/persons",
    tag = "Org",
    request_body = CreatePersonBody,
    responses(
        (status = 201, description = "Person created", body = Person),
        (status = 400, description = "Invalid body (duplicate email, ...)"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn create(
    State(st): State<AppState>,
    Json(body): Json<CreatePersonBody>,
) -> Result<(StatusCode, Json<Person>)> {
    let repo = PersonRepository::new(st.pool.inner());
    let person = repo
        .create(
            body.tenant_id,
            &body.email,
            body.first_name.as_deref(),
            body.last_name.as_deref(),
            body.dn.as_deref(),
        )
        .await
        .map_err(|e| Error::Database(format!("create person: {e}")))?;

    if let Err(e) = OrgEventPublisher::new(&st.event_bus).user_created(&person).await {
        tracing::error!(?e, "failed to publish org.user.created event");
    }
    Ok((StatusCode::CREATED, Json(person)))
}

/// GET /api/v1/org/persons/:id — fetch one person.
#[utoipa::path(
    get,
    path = "/api/v1/org/persons/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Person UUID")),
    responses(
        (status = 200, description = "Person detail", body = Person),
        (status = 404, description = "Person not found"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn detail(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<Person>> {
    PersonRepository::new(st.pool.inner())
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get person: {e}")))?
        .map(Json)
        .ok_or_else(|| Error::NotFound(format!("org person {id}")))
}

/// PATCH /api/v1/org/persons/:id — update mutable fields.
#[utoipa::path(
    patch,
    path = "/api/v1/org/persons/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Person UUID")),
    request_body = UpdatePersonBody,
    responses(
        (status = 200, description = "Person updated", body = Person),
        (status = 404, description = "Person not found"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn update(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePersonBody>,
) -> Result<Json<Person>> {
    let person = sqlx::query_as::<_, Person>(
        "UPDATE org_persons SET
            first_name = COALESCE($2, first_name),
            last_name  = COALESCE($3, last_name),
            email      = COALESCE($4, email),
            dn         = COALESCE($5, dn),
            updated_at = now()
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(body.first_name)
    .bind(body.last_name)
    .bind(body.email)
    .bind(body.dn)
    .fetch_optional(st.pool.inner())
    .await
    .map_err(|e| Error::Database(format!("update person: {e}")))?
    .ok_or_else(|| Error::NotFound(format!("org person {id}")))?;

    // `org.user.updated` stays a raw event (no provisioning consumer
    // today, so no point promoting it to the typed helper).
    if let Ok(payload) = serde_json::to_value(&person) {
        let _ = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.user.updated".to_string(),
                aggregate_id: Some(person.id),
                payload,
            })
            .await;
    }
    Ok(Json(person))
}

/// DELETE /api/v1/org/persons/:id — soft-archive.
#[utoipa::path(
    delete,
    path = "/api/v1/org/persons/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Person UUID")),
    responses(
        (status = 204, description = "Person archived"),
        (status = 404, description = "Person not found"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn archive(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let repo = PersonRepository::new(st.pool.inner());
    let existing = repo
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get person: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("org person {id}")))?;
    repo.archive(id)
        .await
        .map_err(|e| Error::Database(format!("archive person: {e}")))?;

    // Canonical deactivation topic consumed by the provisioning
    // fan-out workers (mail suspend, drive freeze, chat removal, ...).
    if let Err(e) = OrgEventPublisher::new(&st.event_bus)
        .user_deactivated(id, existing.tenant_id)
        .await
    {
        tracing::error!(?e, "failed to publish org.user.deactivated event");
    }
    // Keep the legacy `org.user.archived` alias for any consumer that
    // still listens for it — cheap to publish, trivial to remove once
    // all consumers have migrated.
    let _ = st
        .event_bus
        .publish(NewEvent {
            event_type: "org.user.archived".to_string(),
            aggregate_id: Some(id),
            payload: serde_json::json!({ "id": id, "tenant_id": existing.tenant_id }),
        })
        .await;
    Ok(StatusCode::NO_CONTENT)
}
