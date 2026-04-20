//! SO9 — CRUD handlers for resource renewals.
//!
//! Exposes (all under `/api/v1/org`):
//! - `GET    /resources/:id/renewals` → list renewals for a resource.
//! - `POST   /resources/:id/renewals` → create a renewal.
//! - `GET    /renewals` → cross-resource list with filters (dashboard).
//! - `POST   /renewals/:renewal_id/renew` → mark as renewed.
//! - `POST   /renewals/:renewal_id/snooze` → postpone.
//! - `POST   /renewals/:renewal_id/cancel` → cancel.
//! - `DELETE /renewals/:renewal_id` → delete (admin).
//! - `GET    /renewals/export.ics` → export ICS calendar (RFC 5545 manual).

use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::Response,
    routing::{delete, get, post},
    Extension, Json, Router,
};
use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::auth::Claims;
use signapps_common::{Error, Result};
use signapps_db::models::org::{RenewalKind, RenewalStatus, ResourceRenewal};
use signapps_db::repositories::org::{
    NewResourceRenewal, RenewalListFilters, ResourceRenewalRepository,
};
use uuid::Uuid;

use crate::AppState;

/// Router for `/api/v1/org/resources/:id/renewals`.
pub fn resource_renewals_routes() -> Router<AppState> {
    Router::new().route("/:id/renewals", get(list_for_resource).post(create))
}

/// Router for `/api/v1/org/renewals`.
pub fn cross_renewals_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_all))
        .route("/export.ics", get(export_ics))
        .route("/:renewal_id/renew", post(mark_renewed))
        .route("/:renewal_id/snooze", post(snooze))
        .route("/:renewal_id/cancel", post(cancel))
        .route("/:renewal_id", delete(delete_renewal))
}

// ─── DTOs ─────────────────────────────────────────────────────────────

/// Query for `GET /org/renewals`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListAllQuery {
    /// Tenant.
    pub tenant_id: Uuid,
    /// Filter par resource_id.
    pub resource_id: Option<Uuid>,
    /// Filter par kind (snake_case).
    pub kind: Option<String>,
    /// Filter par status.
    pub status: Option<String>,
    /// `due_date >= due_from`.
    pub due_from: Option<NaiveDate>,
    /// `due_date <= due_to`.
    pub due_to: Option<NaiveDate>,
}

/// Body for `POST /org/resources/:id/renewals`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateRenewalBody {
    /// Tenant (redundant but safer).
    pub tenant_id: Uuid,
    /// Kind snake_case.
    pub kind: String,
    /// Due date.
    pub due_date: NaiveDate,
    /// Grace period en jours (défaut 0).
    #[serde(default)]
    pub grace_period_days: i32,
    /// Notes optionnelles.
    pub renewal_notes: Option<String>,
}

/// Body for `POST /org/renewals/:id/renew`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct RenewBody {
    /// Notes optionnelles (ex: référence nouvelle licence).
    pub renewal_notes: Option<String>,
}

/// Body for `POST /org/renewals/:id/snooze`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct SnoozeBody {
    /// Date jusqu'à laquelle reporter.
    pub snoozed_until: NaiveDate,
}

// ─── Handlers ─────────────────────────────────────────────────────────

/// GET /org/resources/:id/renewals.
#[utoipa::path(
    get,
    path = "/api/v1/org/resources/{id}/renewals",
    tag = "Org Renewals",
    params(("id" = Uuid, Path, description = "Resource UUID")),
    responses((status = 200, description = "Renewals", body = Vec<ResourceRenewal>)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list_for_resource(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ResourceRenewal>>> {
    let rows = ResourceRenewalRepository::new(st.pool.inner())
        .list(RenewalListFilters {
            tenant_id: Uuid::nil(), // Not used when resource_id is set
            resource_id: Some(id),
            kind: None,
            status: None,
            due_from: None,
            due_to: None,
        })
        .await
        .map_err(|e| Error::Database(format!("list renewals for resource: {e}")))?;
    Ok(Json(rows))
}

/// POST /org/resources/:id/renewals.
#[utoipa::path(
    post,
    path = "/api/v1/org/resources/{id}/renewals",
    tag = "Org Renewals",
    params(("id" = Uuid, Path, description = "Resource UUID")),
    request_body = CreateRenewalBody,
    responses(
        (status = 201, description = "Created", body = ResourceRenewal),
        (status = 400, description = "Invalid kind"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn create(
    State(st): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateRenewalBody>,
) -> Result<(StatusCode, Json<ResourceRenewal>)> {
    let kind = RenewalKind::parse(&body.kind).map_err(Error::BadRequest)?;
    if body.grace_period_days < 0 {
        return Err(Error::BadRequest("grace_period_days must be >= 0".into()));
    }

    let row = ResourceRenewalRepository::new(st.pool.inner())
        .create(NewResourceRenewal {
            tenant_id: body.tenant_id,
            resource_id: id,
            kind,
            due_date: body.due_date,
            grace_period_days: body.grace_period_days,
            status: RenewalStatus::Pending,
            renewal_notes: body.renewal_notes,
        })
        .await
        .map_err(|e| Error::Database(format!("create renewal: {e}")))?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// GET /org/renewals.
#[utoipa::path(
    get,
    path = "/api/v1/org/renewals",
    tag = "Org Renewals",
    params(ListAllQuery),
    responses((status = 200, description = "Renewals", body = Vec<ResourceRenewal>)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list_all(
    State(st): State<AppState>,
    Query(q): Query<ListAllQuery>,
) -> Result<Json<Vec<ResourceRenewal>>> {
    let kind = match q.kind.as_deref() {
        Some(s) => Some(RenewalKind::parse(s).map_err(Error::BadRequest)?),
        None => None,
    };
    let status = match q.status.as_deref() {
        Some(s) => Some(RenewalStatus::parse(s).map_err(Error::BadRequest)?),
        None => None,
    };
    let rows = ResourceRenewalRepository::new(st.pool.inner())
        .list(RenewalListFilters {
            tenant_id: q.tenant_id,
            resource_id: q.resource_id,
            kind,
            status,
            due_from: q.due_from,
            due_to: q.due_to,
        })
        .await
        .map_err(|e| Error::Database(format!("list renewals: {e}")))?;
    Ok(Json(rows))
}

/// POST /org/renewals/:id/renew.
#[utoipa::path(
    post,
    path = "/api/v1/org/renewals/{renewal_id}/renew",
    tag = "Org Renewals",
    params(("renewal_id" = Uuid, Path, description = "Renewal UUID")),
    request_body = RenewBody,
    responses(
        (status = 200, description = "Renewed", body = ResourceRenewal),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, claims, body))]
pub async fn mark_renewed(
    State(st): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(renewal_id): Path<Uuid>,
    Json(body): Json<RenewBody>,
) -> Result<Json<ResourceRenewal>> {
    let row = ResourceRenewalRepository::new(st.pool.inner())
        .mark_renewed(renewal_id, Utc::now(), Some(claims.sub), body.renewal_notes)
        .await
        .map_err(|e| Error::Database(format!("mark_renewed: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("renewal {renewal_id}")))?;
    Ok(Json(row))
}

/// POST /org/renewals/:id/snooze.
#[utoipa::path(
    post,
    path = "/api/v1/org/renewals/{renewal_id}/snooze",
    tag = "Org Renewals",
    params(("renewal_id" = Uuid, Path, description = "Renewal UUID")),
    request_body = SnoozeBody,
    responses(
        (status = 200, description = "Snoozed", body = ResourceRenewal),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn snooze(
    State(st): State<AppState>,
    Path(renewal_id): Path<Uuid>,
    Json(body): Json<SnoozeBody>,
) -> Result<Json<ResourceRenewal>> {
    let row = ResourceRenewalRepository::new(st.pool.inner())
        .snooze(renewal_id, body.snoozed_until)
        .await
        .map_err(|e| Error::Database(format!("snooze: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("renewal {renewal_id}")))?;
    Ok(Json(row))
}

/// POST /org/renewals/:id/cancel.
#[utoipa::path(
    post,
    path = "/api/v1/org/renewals/{renewal_id}/cancel",
    tag = "Org Renewals",
    params(("renewal_id" = Uuid, Path, description = "Renewal UUID")),
    responses(
        (status = 200, description = "Cancelled", body = ResourceRenewal),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn cancel(
    State(st): State<AppState>,
    Path(renewal_id): Path<Uuid>,
) -> Result<Json<ResourceRenewal>> {
    let row = ResourceRenewalRepository::new(st.pool.inner())
        .cancel(renewal_id)
        .await
        .map_err(|e| Error::Database(format!("cancel: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("renewal {renewal_id}")))?;
    Ok(Json(row))
}

/// DELETE /org/renewals/:id.
#[utoipa::path(
    delete,
    path = "/api/v1/org/renewals/{renewal_id}",
    tag = "Org Renewals",
    params(("renewal_id" = Uuid, Path, description = "Renewal UUID")),
    responses(
        (status = 204, description = "Deleted"),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn delete_renewal(
    State(st): State<AppState>,
    Path(renewal_id): Path<Uuid>,
) -> Result<StatusCode> {
    let removed = ResourceRenewalRepository::new(st.pool.inner())
        .delete(renewal_id)
        .await
        .map_err(|e| Error::Database(format!("delete renewal: {e}")))?;
    if !removed {
        return Err(Error::NotFound(format!("renewal {renewal_id}")));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// GET /org/renewals/export.ics — RFC 5545 VCALENDAR manuel.
#[utoipa::path(
    get,
    path = "/api/v1/org/renewals/export.ics",
    tag = "Org Renewals",
    params(ListAllQuery),
    responses((status = 200, description = "VCALENDAR", content_type = "text/calendar")),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn export_ics(
    State(st): State<AppState>,
    Query(q): Query<ListAllQuery>,
) -> Result<Response> {
    let kind = match q.kind.as_deref() {
        Some(s) => Some(RenewalKind::parse(s).map_err(Error::BadRequest)?),
        None => None,
    };
    let status = match q.status.as_deref() {
        Some(s) => Some(RenewalStatus::parse(s).map_err(Error::BadRequest)?),
        None => None,
    };
    let rows = ResourceRenewalRepository::new(st.pool.inner())
        .list(RenewalListFilters {
            tenant_id: q.tenant_id,
            resource_id: q.resource_id,
            kind,
            status,
            due_from: q.due_from,
            due_to: q.due_to,
        })
        .await
        .map_err(|e| Error::Database(format!("list renewals: {e}")))?;

    let body = build_ics(&rows);
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/calendar; charset=utf-8")
        .header(
            header::CONTENT_DISPOSITION,
            r#"attachment; filename="signapps-renewals.ics""#,
        )
        .body(body.into())
        .map_err(|e| Error::Internal(format!("ics response: {e}")))
}

/// Build an RFC 5545 VCALENDAR string from renewals.
#[must_use]
fn build_ics(rows: &[ResourceRenewal]) -> String {
    let now = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let mut out = String::new();
    out.push_str("BEGIN:VCALENDAR\r\n");
    out.push_str("VERSION:2.0\r\n");
    out.push_str("PRODID:-//SignApps//Renewals//EN\r\n");
    out.push_str("CALSCALE:GREGORIAN\r\n");
    out.push_str("METHOD:PUBLISH\r\n");
    for row in rows {
        let dtstart = row.due_date.format("%Y%m%d").to_string();
        // End date = start + 1 day (all-day event).
        let dtend = match row.due_date.succ_opt() {
            Some(d) => d.format("%Y%m%d").to_string(),
            None => dtstart.clone(),
        };
        let summary = format!(
            "[{}] {}",
            row.kind.as_str(),
            ics_escape(&format!("renewal {}", row.id))
        );
        let description = row.renewal_notes.as_deref().unwrap_or("SignApps renewal");
        out.push_str("BEGIN:VEVENT\r\n");
        out.push_str(&format!("UID:{}-renewal@signapps\r\n", row.id));
        out.push_str(&format!("DTSTAMP:{now}\r\n"));
        out.push_str(&format!("DTSTART;VALUE=DATE:{dtstart}\r\n"));
        out.push_str(&format!("DTEND;VALUE=DATE:{dtend}\r\n"));
        out.push_str(&format!("SUMMARY:{summary}\r\n"));
        out.push_str(&format!("DESCRIPTION:{}\r\n", ics_escape(description)));
        out.push_str(&format!(
            "STATUS:{}\r\n",
            match row.status {
                RenewalStatus::Cancelled => "CANCELLED",
                _ => "CONFIRMED",
            }
        ));
        out.push_str("END:VEVENT\r\n");
    }
    out.push_str("END:VCALENDAR\r\n");
    out
}

fn ics_escape(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace(',', "\\,")
        .replace(';', "\\;")
        .replace('\n', "\\n")
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
#[allow(dead_code)]
struct _DummyForOpenapi;
