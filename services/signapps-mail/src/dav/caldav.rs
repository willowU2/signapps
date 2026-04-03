//! CalDAV handlers for calendar access via DAV.
//!
//! Implements PROPFIND, GET, PUT, DELETE, and REPORT for CalDAV resources
//! stored in `mailserver.cal_calendars` and `mailserver.cal_events`.

use axum::http::Method;
use signapps_dav::{
    caldav::{
        build_calendar_multiget_response, build_calendar_propfind_response, CalendarInfo,
        CalendarResource,
    },
    ical::{is_in_time_range, ICalEvent},
    webdav::DavResponse,
    xml::{build_multistatus, build_resource_response, parse_propfind, parse_report, ReportRequest},
};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

use super::auth::DavAuth;

/// CalDAV event row from the database.
#[derive(Debug, sqlx::FromRow)]
struct CalEventRow {
    #[allow(dead_code)]
    id: Uuid,
    uid: String,
    etag: String,
    ical_data: String,
    dtstart: Option<String>,
}

/// CalDAV calendar row from the database.
#[derive(Debug, sqlx::FromRow)]
struct CalCalendarRow {
    id: Uuid,
    display_name: String,
    ctag: String,
    color: Option<String>,
    description: Option<String>,
}

/// Handle a CalDAV request.
///
/// Routes by HTTP method to the appropriate handler.
///
/// # Errors
///
/// Returns a [`DavResponse`] with an appropriate status code on error.
///
/// # Panics
///
/// None.
#[allow(clippy::too_many_arguments)]
#[tracing::instrument(skip(pool, auth, body), fields(email = %auth.email, path = %path))]
pub async fn handle(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    method: &Method,
    path: &str,
    depth: u8,
    body: Option<&str>,
    if_match: Option<&str>,
) -> DavResponse {
    let segments: Vec<&str> = path.trim_matches('/').split('/').collect();

    match method.as_str() {
        "PROPFIND" => handle_propfind(pool, auth, &segments, depth, body).await,
        "GET" => handle_get(pool, auth, &segments).await,
        "PUT" => handle_put(pool, auth, &segments, body, if_match).await,
        "DELETE" => handle_delete(pool, auth, &segments, if_match).await,
        "REPORT" => handle_report(pool, auth, &segments, body).await,
        "MKCOL" => handle_mkcol(pool, auth, &segments).await,
        _ => DavResponse::new(405, String::new()),
    }
}

/// Handle PROPFIND requests.
async fn handle_propfind(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    segments: &[&str],
    depth: u8,
    body: Option<&str>,
) -> DavResponse {
    let _propfind = match parse_propfind(body.unwrap_or("")) {
        Ok(pf) => pf,
        Err(e) => {
            tracing::warn!("Invalid PROPFIND body: {}", e);
            return DavResponse::new(400, format!("Invalid PROPFIND: {e}"));
        }
    };

    match segments.len() {
        0..=3 => {
            if depth == 0 {
                let resp = build_resource_response(
                    &format!("/dav/calendars/{}/", auth.email),
                    vec![
                        ("D:displayname".to_string(), auth.email.clone()),
                        (
                            "D:resourcetype".to_string(),
                            "<D:collection/>".to_string(),
                        ),
                    ],
                );
                DavResponse::multistatus(build_multistatus(&[resp]))
            } else {
                list_calendars(pool, auth).await
            }
        }
        4 => {
            let calendar_id = segments[3].trim_matches('/');
            if depth == 0 {
                calendar_props(pool, auth, calendar_id).await
            } else {
                list_events(pool, auth, calendar_id).await
            }
        }
        _ => {
            let calendar_id = segments[3];
            let event_file = segments[4];
            let event_uid = event_file.trim_end_matches(".ics");
            event_props(pool, auth, calendar_id, event_uid).await
        }
    }
}

/// List all calendars for the authenticated user.
async fn list_calendars(pool: &Pool<Postgres>, auth: &DavAuth) -> DavResponse {
    let calendars: Vec<CalCalendarRow> = match sqlx::query_as(
        r#"SELECT id, display_name, COALESCE(ctag, '') AS ctag, color, description
           FROM mailserver.cal_calendars
           WHERE account_id = $1"#,
    )
    .bind(auth.account_id)
    .fetch_all(pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!("Failed to list calendars: {}", e);
            return DavResponse::new(500, format!("DB error: {e}"));
        }
    };

    let infos: Vec<CalendarInfo> = calendars
        .iter()
        .map(|c| CalendarInfo {
            href: format!("/dav/calendars/{}/{}/", auth.email, c.id),
            display_name: c.display_name.clone(),
            ctag: format!("\"{}\"", c.ctag),
            color: c.color.clone(),
            description: c.description.clone(),
        })
        .collect();

    DavResponse::multistatus(build_calendar_propfind_response(&infos))
}

/// Return properties for a single calendar collection.
async fn calendar_props(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    calendar_id: &str,
) -> DavResponse {
    let cal_uuid = match Uuid::parse_str(calendar_id) {
        Ok(u) => u,
        Err(_) => return DavResponse::not_found(),
    };

    let cal: Option<CalCalendarRow> = match sqlx::query_as(
        r#"SELECT id, display_name, COALESCE(ctag, '') AS ctag, color, description
           FROM mailserver.cal_calendars
           WHERE id = $1 AND account_id = $2"#,
    )
    .bind(cal_uuid)
    .bind(auth.account_id)
    .fetch_optional(pool)
    .await
    {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to fetch calendar: {}", e);
            return DavResponse::new(500, format!("DB error: {e}"));
        }
    };

    match cal {
        Some(c) => {
            let info = CalendarInfo {
                href: format!("/dav/calendars/{}/{}/", auth.email, c.id),
                display_name: c.display_name,
                ctag: format!("\"{}\"", c.ctag),
                color: c.color,
                description: c.description,
            };
            DavResponse::multistatus(build_calendar_propfind_response(&[info]))
        }
        None => DavResponse::not_found(),
    }
}

/// List all events in a calendar.
async fn list_events(pool: &Pool<Postgres>, auth: &DavAuth, calendar_id: &str) -> DavResponse {
    let cal_uuid = match Uuid::parse_str(calendar_id) {
        Ok(u) => u,
        Err(_) => return DavResponse::not_found(),
    };

    let events: Vec<CalEventRow> = match sqlx::query_as(
        r#"SELECT id, uid, COALESCE(etag, '') AS etag, COALESCE(ical_data, '') AS ical_data,
                  dtstart
           FROM mailserver.cal_events
           WHERE calendar_id = $1 AND calendar_id IN (
               SELECT id FROM mailserver.cal_calendars WHERE account_id = $2
           )"#,
    )
    .bind(cal_uuid)
    .bind(auth.account_id)
    .fetch_all(pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!("Failed to list events: {}", e);
            return DavResponse::new(500, format!("DB error: {e}"));
        }
    };

    let resources: Vec<CalendarResource> = events
        .iter()
        .map(|e| CalendarResource {
            href: format!("/dav/calendars/{}/{}/{}.ics", auth.email, cal_uuid, e.uid),
            etag: format!("\"{}\"", e.etag),
            calendar_data: e.ical_data.clone(),
        })
        .collect();

    DavResponse::multistatus(build_calendar_multiget_response(&resources))
}

/// Return properties for a single event.
async fn event_props(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    calendar_id: &str,
    event_uid: &str,
) -> DavResponse {
    let cal_uuid = match Uuid::parse_str(calendar_id) {
        Ok(u) => u,
        Err(_) => return DavResponse::not_found(),
    };

    let event: Option<CalEventRow> = match sqlx::query_as(
        r#"SELECT e.id, e.uid, COALESCE(e.etag, '') AS etag,
                  COALESCE(e.ical_data, '') AS ical_data, e.dtstart
           FROM mailserver.cal_events e
           JOIN mailserver.cal_calendars c ON c.id = e.calendar_id
           WHERE e.uid = $1 AND e.calendar_id = $2 AND c.account_id = $3"#,
    )
    .bind(event_uid)
    .bind(cal_uuid)
    .bind(auth.account_id)
    .fetch_optional(pool)
    .await
    {
        Ok(e) => e,
        Err(e) => {
            tracing::error!("Failed to fetch event: {}", e);
            return DavResponse::new(500, format!("DB error: {e}"));
        }
    };

    match event {
        Some(e) => {
            let resp = build_resource_response(
                &format!("/dav/calendars/{}/{}/{}.ics", auth.email, cal_uuid, e.uid),
                vec![
                    ("D:getetag".to_string(), format!("\"{}\"", e.etag)),
                    (
                        "D:getcontenttype".to_string(),
                        "text/calendar; charset=utf-8".to_string(),
                    ),
                ],
            );
            DavResponse::multistatus(build_multistatus(&[resp]))
        }
        None => DavResponse::not_found(),
    }
}

/// Handle GET -- return iCalendar data for a single event.
async fn handle_get(pool: &Pool<Postgres>, auth: &DavAuth, segments: &[&str]) -> DavResponse {
    if segments.len() < 5 {
        return DavResponse::not_found();
    }

    let calendar_id = segments[3];
    let event_file = segments[4];
    let event_uid = event_file.trim_end_matches(".ics");

    let cal_uuid = match Uuid::parse_str(calendar_id) {
        Ok(u) => u,
        Err(_) => return DavResponse::not_found(),
    };

    let row: Option<CalEventRow> = match sqlx::query_as(
        r#"SELECT e.id, e.uid, COALESCE(e.etag, '') AS etag,
                  COALESCE(e.ical_data, '') AS ical_data, e.dtstart
           FROM mailserver.cal_events e
           JOIN mailserver.cal_calendars c ON c.id = e.calendar_id
           WHERE e.uid = $1 AND e.calendar_id = $2 AND c.account_id = $3"#,
    )
    .bind(event_uid)
    .bind(cal_uuid)
    .bind(auth.account_id)
    .fetch_optional(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("Failed to fetch event for GET: {}", e);
            return DavResponse::new(500, format!("DB error: {e}"));
        }
    };

    match row {
        Some(event) => DavResponse::with_headers(
            200,
            event.ical_data,
            vec![
                (
                    "Content-Type".to_string(),
                    "text/calendar; charset=utf-8".to_string(),
                ),
                ("ETag".to_string(), format!("\"{}\"", event.etag)),
            ],
        ),
        None => DavResponse::not_found(),
    }
}

/// Handle PUT -- create or update an event.
async fn handle_put(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    segments: &[&str],
    body: Option<&str>,
    _if_match: Option<&str>,
) -> DavResponse {
    if segments.len() < 5 {
        return DavResponse::new(400, "Invalid PUT path".to_string());
    }

    let calendar_id = segments[3];
    let event_file = segments[4];
    let event_uid = event_file.trim_end_matches(".ics");

    let cal_uuid = match Uuid::parse_str(calendar_id) {
        Ok(u) => u,
        Err(_) => return DavResponse::new(400, "Invalid calendar ID".to_string()),
    };

    let ical_data = match body {
        Some(b) if !b.is_empty() => b,
        _ => return DavResponse::new(400, "Empty PUT body".to_string()),
    };

    let event = match ICalEvent::parse(ical_data) {
        Ok(e) => e,
        Err(e) => {
            tracing::warn!("Invalid iCal data: {}", e);
            return DavResponse::new(400, format!("Invalid iCal: {e}"));
        }
    };

    let cal_exists: bool = match sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM mailserver.cal_calendars WHERE id = $1 AND account_id = $2)",
    )
    .bind(cal_uuid)
    .bind(auth.account_id)
    .fetch_one(pool)
    .await
    {
        Ok(exists) => exists,
        Err(e) => {
            tracing::error!("Calendar ownership check failed: {}", e);
            return DavResponse::new(500, format!("DB error: {e}"));
        }
    };

    if !cal_exists {
        return DavResponse::not_found();
    }

    let new_etag = Uuid::new_v4().to_string();

    let result = sqlx::query(
        r#"INSERT INTO mailserver.cal_events
               (calendar_id, uid, summary, description, dtstart, dtend,
                rrule, location, organizer, status, ical_data, etag)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (calendar_id, uid) DO UPDATE SET
               summary = EXCLUDED.summary,
               description = EXCLUDED.description,
               dtstart = EXCLUDED.dtstart,
               dtend = EXCLUDED.dtend,
               rrule = EXCLUDED.rrule,
               location = EXCLUDED.location,
               organizer = EXCLUDED.organizer,
               status = EXCLUDED.status,
               ical_data = EXCLUDED.ical_data,
               etag = EXCLUDED.etag,
               updated_at = NOW()"#,
    )
    .bind(cal_uuid)
    .bind(event_uid)
    .bind(&event.summary)
    .bind(&event.description)
    .bind(&event.dtstart)
    .bind(&event.dtend)
    .bind(&event.rrule)
    .bind(&event.location)
    .bind(&event.organizer)
    .bind(&event.status)
    .bind(ical_data)
    .bind(&new_etag)
    .execute(pool)
    .await;

    if let Err(e) = result {
        tracing::error!("Failed to upsert event: {}", e);
        return DavResponse::new(500, format!("DB error: {e}"));
    }

    let new_ctag = Uuid::new_v4().to_string();
    let _ = sqlx::query("UPDATE mailserver.cal_calendars SET ctag = $1 WHERE id = $2")
        .bind(&new_ctag)
        .bind(cal_uuid)
        .execute(pool)
        .await;

    tracing::info!(
        calendar_id = %cal_uuid,
        event_uid = %event_uid,
        "CalDAV event upserted"
    );

    DavResponse::with_headers(
        201,
        String::new(),
        vec![("ETag".to_string(), format!("\"{}\"", new_etag))],
    )
}

/// Handle DELETE -- remove an event.
async fn handle_delete(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    segments: &[&str],
    _if_match: Option<&str>,
) -> DavResponse {
    if segments.len() < 5 {
        return DavResponse::new(400, "Invalid DELETE path".to_string());
    }

    let calendar_id = segments[3];
    let event_file = segments[4];
    let event_uid = event_file.trim_end_matches(".ics");

    let cal_uuid = match Uuid::parse_str(calendar_id) {
        Ok(u) => u,
        Err(_) => return DavResponse::not_found(),
    };

    let result = sqlx::query(
        r#"DELETE FROM mailserver.cal_events
           WHERE uid = $1 AND calendar_id = $2
             AND calendar_id IN (
                 SELECT id FROM mailserver.cal_calendars WHERE account_id = $3
             )"#,
    )
    .bind(event_uid)
    .bind(cal_uuid)
    .bind(auth.account_id)
    .execute(pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            let new_ctag = Uuid::new_v4().to_string();
            let _ = sqlx::query("UPDATE mailserver.cal_calendars SET ctag = $1 WHERE id = $2")
                .bind(&new_ctag)
                .bind(cal_uuid)
                .execute(pool)
                .await;

            tracing::info!(
                calendar_id = %cal_uuid,
                event_uid = %event_uid,
                "CalDAV event deleted"
            );
            DavResponse::new(204, String::new())
        }
        Ok(_) => DavResponse::not_found(),
        Err(e) => {
            tracing::error!("Failed to delete event: {}", e);
            DavResponse::new(500, format!("DB error: {e}"))
        }
    }
}

/// Handle REPORT -- calendar-query and calendar-multiget.
async fn handle_report(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    segments: &[&str],
    body: Option<&str>,
) -> DavResponse {
    let report_body = match body {
        Some(b) => b,
        None => return DavResponse::new(400, "REPORT requires a body".to_string()),
    };

    let report = match parse_report(report_body) {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("Invalid REPORT body: {}", e);
            return DavResponse::new(400, format!("Invalid REPORT: {e}"));
        }
    };

    if segments.len() < 4 {
        return DavResponse::not_found();
    }

    let calendar_id = segments[3].trim_matches('/');
    let cal_uuid = match Uuid::parse_str(calendar_id) {
        Ok(u) => u,
        Err(_) => return DavResponse::not_found(),
    };

    match report {
        ReportRequest::CalendarQuery { time_range } => {
            handle_calendar_query(pool, auth, cal_uuid, time_range).await
        }
        ReportRequest::CalendarMultiget { hrefs } => {
            handle_calendar_multiget(pool, auth, cal_uuid, &hrefs).await
        }
        _ => DavResponse::new(400, "Unsupported REPORT type for CalDAV".to_string()),
    }
}

/// Handle calendar-query REPORT: filter events by time range.
async fn handle_calendar_query(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    cal_uuid: Uuid,
    time_range: Option<signapps_dav::xml::TimeRangeFilter>,
) -> DavResponse {
    let events: Vec<CalEventRow> = match sqlx::query_as(
        r#"SELECT e.id, e.uid, COALESCE(e.etag, '') AS etag,
                  COALESCE(e.ical_data, '') AS ical_data, e.dtstart
           FROM mailserver.cal_events e
           JOIN mailserver.cal_calendars c ON c.id = e.calendar_id
           WHERE e.calendar_id = $1 AND c.account_id = $2"#,
    )
    .bind(cal_uuid)
    .bind(auth.account_id)
    .fetch_all(pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!("Failed to query events: {}", e);
            return DavResponse::new(500, format!("DB error: {e}"));
        }
    };

    let filtered: Vec<&CalEventRow> = if let Some(ref tr) = time_range {
        events
            .iter()
            .filter(|e| {
                let dtstart = e.dtstart.as_deref().unwrap_or("");
                is_in_time_range(dtstart, tr.start.as_deref(), tr.end.as_deref())
            })
            .collect()
    } else {
        events.iter().collect()
    };

    let resources: Vec<CalendarResource> = filtered
        .iter()
        .map(|e| CalendarResource {
            href: format!("/dav/calendars/{}/{}/{}.ics", auth.email, cal_uuid, e.uid),
            etag: format!("\"{}\"", e.etag),
            calendar_data: e.ical_data.clone(),
        })
        .collect();

    DavResponse::multistatus(build_calendar_multiget_response(&resources))
}

/// Handle calendar-multiget REPORT: fetch specific events by href.
async fn handle_calendar_multiget(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    cal_uuid: Uuid,
    hrefs: &[String],
) -> DavResponse {
    let mut resources = Vec::new();

    for href in hrefs {
        let uid = href
            .rsplit('/')
            .next()
            .unwrap_or("")
            .trim_end_matches(".ics");

        if uid.is_empty() {
            continue;
        }

        let event: Option<CalEventRow> = sqlx::query_as(
            r#"SELECT e.id, e.uid, COALESCE(e.etag, '') AS etag,
                      COALESCE(e.ical_data, '') AS ical_data, e.dtstart
               FROM mailserver.cal_events e
               JOIN mailserver.cal_calendars c ON c.id = e.calendar_id
               WHERE e.uid = $1 AND e.calendar_id = $2 AND c.account_id = $3"#,
        )
        .bind(uid)
        .bind(cal_uuid)
        .bind(auth.account_id)
        .fetch_optional(pool)
        .await
        .unwrap_or(None);

        if let Some(e) = event {
            resources.push(CalendarResource {
                href: href.clone(),
                etag: format!("\"{}\"", e.etag),
                calendar_data: e.ical_data,
            });
        }
    }

    DavResponse::multistatus(build_calendar_multiget_response(&resources))
}

/// Handle MKCOL -- create a new calendar collection.
async fn handle_mkcol(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    segments: &[&str],
) -> DavResponse {
    if segments.len() < 4 {
        return DavResponse::new(400, "Invalid MKCOL path".to_string());
    }

    let calendar_name = segments[3].trim_matches('/');
    let new_id = Uuid::new_v4();
    let ctag = Uuid::new_v4().to_string();

    let result = sqlx::query(
        r#"INSERT INTO mailserver.cal_calendars
               (id, account_id, display_name, ctag)
           VALUES ($1, $2, $3, $4)"#,
    )
    .bind(new_id)
    .bind(auth.account_id)
    .bind(calendar_name)
    .bind(&ctag)
    .execute(pool)
    .await;

    match result {
        Ok(_) => {
            tracing::info!(
                calendar_id = %new_id,
                name = %calendar_name,
                "CalDAV calendar created via MKCOL"
            );
            DavResponse::new(201, String::new())
        }
        Err(e) => {
            tracing::error!("Failed to create calendar: {}", e);
            DavResponse::new(500, format!("DB error: {e}"))
        }
    }
}
