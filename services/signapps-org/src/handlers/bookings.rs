//! SO7 handlers for `/api/v1/org/site-bookings` and
//! `/api/v1/org/sites/:id/availability|occupancy` — SO7.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, patch},
    Json, Router,
};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::models::org::{BookingStatus, SiteBooking};
use signapps_db::repositories::org::{BookingRepository, OccupancyBucket, SiteRepository};
use uuid::Uuid;

use crate::AppState;

/// Mount the bookings router at `/api/v1/org/site-bookings`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/:id/cancel", patch(cancel))
}

/// Mount the availability/occupancy router — nested at
/// `/api/v1/org/sites/:id`.
pub fn occupancy_routes() -> Router<AppState> {
    Router::new()
        .route("/availability", get(availability))
        .route("/occupancy", get(occupancy))
}

// ─── DTOs ─────────────────────────────────────────────────────────────

/// Query for `GET /api/v1/org/site-bookings`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Filter by site (required).
    pub site_id: Uuid,
    /// ISO 8601 UTC lower bound (inclusive).
    pub since: DateTime<Utc>,
    /// ISO 8601 UTC upper bound (exclusive).
    pub until: DateTime<Utc>,
}

/// Body for `POST /api/v1/org/site-bookings`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateBody {
    /// Site UUID.
    pub site_id: Uuid,
    /// Person UUID.
    pub person_id: Uuid,
    /// Début.
    pub start_at: DateTime<Utc>,
    /// Fin.
    pub end_at: DateTime<Utc>,
    /// Motif optionnel.
    pub purpose: Option<String>,
    /// Status (`confirmed` default).
    #[serde(default = "default_confirmed")]
    pub status: String,
    /// Créer une room Meet associée ?
    #[serde(default)]
    pub link_meet: bool,
}

fn default_confirmed() -> String {
    "confirmed".to_string()
}

/// Query for `GET /api/v1/org/sites/:id/availability?day=YYYY-MM-DD`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct AvailabilityQuery {
    /// ISO date (UTC).
    pub day: NaiveDate,
    /// Slot duration in minutes (default 30).
    #[serde(default = "default_slot_minutes")]
    pub slot_minutes: i64,
}

fn default_slot_minutes() -> i64 {
    30
}

/// One 30-min slot.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct AvailabilitySlot {
    /// Start of the slot (UTC).
    pub start_at: DateTime<Utc>,
    /// End of the slot (UTC).
    pub end_at: DateTime<Utc>,
    /// `true` if nothing overlaps.
    pub available: bool,
}

/// Response of `GET /availability`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct AvailabilityResponse {
    /// Site id echoed back.
    pub site_id: Uuid,
    /// Date queried.
    pub day: NaiveDate,
    /// Slot duration in minutes.
    pub slot_minutes: i64,
    /// List of slots with availability flag.
    pub slots: Vec<AvailabilitySlot>,
}

/// Query for `GET /api/v1/org/sites/:id/occupancy`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct OccupancyQuery {
    /// Range start (UTC).
    pub since: DateTime<Utc>,
    /// Range end (UTC).
    pub until: DateTime<Utc>,
    /// `day` | `hour` (default `day`).
    #[serde(default = "default_day")]
    pub granularity: String,
}

fn default_day() -> String {
    "day".to_string()
}

/// Response of `GET /occupancy`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct OccupancyResponse {
    /// Site id echoed back.
    pub site_id: Uuid,
    /// Granularity.
    pub granularity: String,
    /// Capacity of the site (if known).
    pub capacity: Option<i32>,
    /// Raw buckets.
    pub buckets: Vec<OccupancyBucket>,
}

// ─── Handlers ─────────────────────────────────────────────────────────

/// GET /api/v1/org/site-bookings
#[utoipa::path(
    get,
    path = "/api/v1/org/site-bookings",
    tag = "Org Bookings",
    params(ListQuery),
    responses((status = 200, description = "Bookings", body = Vec<SiteBooking>)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<SiteBooking>>> {
    if q.until <= q.since {
        return Err(Error::BadRequest("until must be > since".to_string()));
    }
    let rows = BookingRepository::new(st.pool.inner())
        .list_by_site(q.site_id, q.since, q.until)
        .await
        .map_err(|e| Error::Database(format!("list bookings: {e}")))?;
    Ok(Json(rows))
}

/// POST /api/v1/org/site-bookings
#[utoipa::path(
    post,
    path = "/api/v1/org/site-bookings",
    tag = "Org Bookings",
    request_body = CreateBody,
    responses(
        (status = 201, description = "Booked", body = SiteBooking),
        (status = 409, description = "Conflict"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn create(
    State(st): State<AppState>,
    Json(body): Json<CreateBody>,
) -> Result<(StatusCode, Json<SiteBooking>)> {
    if body.end_at <= body.start_at {
        return Err(Error::BadRequest(
            "end_at must be > start_at".to_string(),
        ));
    }
    let status = BookingStatus::parse(&body.status).map_err(Error::BadRequest)?;
    let repo = BookingRepository::new(st.pool.inner());

    // Only enforce conflicts for confirmed bookings.
    if matches!(status, BookingStatus::Confirmed) {
        let has_conflict = repo
            .has_conflict(body.site_id, body.start_at, body.end_at)
            .await
            .map_err(|e| Error::Database(format!("conflict check: {e}")))?;
        if has_conflict {
            return Err(Error::Conflict(
                "site already booked during that range".to_string(),
            ));
        }
    }

    // Meet integration stub : when link_meet=true we just leave
    // meet_room_id NULL for now — wiring to signapps-meet is deferred.
    let _ = body.link_meet;

    let row = repo
        .create(
            body.site_id,
            body.person_id,
            body.start_at,
            body.end_at,
            body.purpose.as_deref(),
            status,
            None,
        )
        .await
        .map_err(|e| Error::Database(format!("create booking: {e}")))?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// PATCH /api/v1/org/site-bookings/:id/cancel
#[utoipa::path(
    patch,
    path = "/api/v1/org/site-bookings/{id}/cancel",
    tag = "Org Bookings",
    params(("id" = Uuid, Path, description = "Booking UUID")),
    responses(
        (status = 204, description = "Cancelled"),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn cancel(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let ok = BookingRepository::new(st.pool.inner())
        .cancel(id)
        .await
        .map_err(|e| Error::Database(format!("cancel: {e}")))?;
    if !ok {
        return Err(Error::NotFound(format!("booking {id}")));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/org/sites/:id/availability?day=YYYY-MM-DD
#[utoipa::path(
    get,
    path = "/api/v1/org/sites/{id}/availability",
    tag = "Org Bookings",
    params(
        ("id" = Uuid, Path, description = "Site UUID"),
        AvailabilityQuery,
    ),
    responses((status = 200, description = "Slots", body = AvailabilityResponse)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn availability(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<AvailabilityQuery>,
) -> Result<Json<AvailabilityResponse>> {
    let bookings = BookingRepository::new(st.pool.inner())
        .day_bookings(id, q.day)
        .await
        .map_err(|e| Error::Database(format!("day bookings: {e}")))?;

    let slot_minutes = q.slot_minutes.clamp(15, 240);
    let day_start = q
        .day
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| Error::BadRequest("invalid day".to_string()))?
        .and_utc();
    let mut slots = Vec::with_capacity(24 * 60 / slot_minutes as usize);
    let mut cursor = day_start;
    let end_of_day = day_start + Duration::days(1);
    while cursor < end_of_day {
        let next = cursor + Duration::minutes(slot_minutes);
        let overlaps = bookings.iter().any(|b| {
            matches!(b.status, BookingStatus::Confirmed)
                && !(b.end_at <= cursor || b.start_at >= next)
        });
        slots.push(AvailabilitySlot {
            start_at: cursor,
            end_at: next,
            available: !overlaps,
        });
        cursor = next;
    }

    Ok(Json(AvailabilityResponse {
        site_id: id,
        day: q.day,
        slot_minutes,
        slots,
    }))
}

/// GET /api/v1/org/sites/:id/occupancy?since=…&until=…&granularity=day|hour
#[utoipa::path(
    get,
    path = "/api/v1/org/sites/{id}/occupancy",
    tag = "Org Bookings",
    params(
        ("id" = Uuid, Path, description = "Site UUID"),
        OccupancyQuery,
    ),
    responses((status = 200, description = "Heatmap buckets", body = OccupancyResponse)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn occupancy(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<OccupancyQuery>,
) -> Result<Json<OccupancyResponse>> {
    if q.until <= q.since {
        return Err(Error::BadRequest(
            "until must be > since".to_string(),
        ));
    }
    let site = SiteRepository::new(st.pool.inner())
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get site: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("site {id}")))?;
    let buckets = BookingRepository::new(st.pool.inner())
        .occupancy(id, q.since, q.until, &q.granularity)
        .await
        .map_err(|e| Error::Database(format!("occupancy: {e}")))?;
    Ok(Json(OccupancyResponse {
        site_id: id,
        granularity: q.granularity,
        capacity: site.capacity,
        buckets,
    }))
}
