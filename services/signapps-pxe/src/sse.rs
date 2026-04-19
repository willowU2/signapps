//! SSE streaming of PXE deployment progress.
//!
//! A PostgreSQL `LISTEN pxe_deployment_progress` channel is wired (by
//! migration 427) to fire after every `UPDATE` on `pxe.deployments` that
//! changes `progress` or `status`. This module exposes:
//!
//! * [`subscribe_deployment`] — a low-level filter that yields the raw
//!   JSON payloads targeted at a specific MAC. Exposed for tests.
//! * [`stream_deployment`] — the Axum handler that wraps the above in an
//!   `Sse<...>` response with a keep-alive.
//!
//! The NOTIFY payload shape is:
//! ```json
//! {"mac":"aa:bb:cc:..","progress":50,"status":"running","step":"..."}
//! ```
//!
//! Filtering is done server-side: we forward only the payloads whose
//! `"mac":"<target>"` substring matches, so each SSE stream only sees
//! the updates for its own deployment.

use axum::extract::{Path, State};
use axum::response::sse::{Event, KeepAlive, Sse};
use futures_util::stream::Stream;
use futures_util::StreamExt;
use signapps_db::DatabasePool;
use std::convert::Infallible;

use crate::AppState;

/// Subscribe to deployment progress notifications for a specific MAC.
///
/// Opens a dedicated `PgListener` on the `pxe_deployment_progress`
/// channel, filters each incoming NOTIFY payload by the `"mac":"…"`
/// substring and yields only matching payloads as JSON strings.
///
/// # Arguments
///
/// * `db` — shared pool; used only to pull connection options for the
///   listener (the listener itself opens its own dedicated connection).
/// * `mac` — canonical lowercase MAC (e.g. `aa:bb:cc:dd:ee:ff`).
///
/// # Errors
///
/// Returns an error if the `PgListener` cannot connect or fails to
/// subscribe to the `pxe_deployment_progress` channel.
///
/// # Examples
///
/// ```text
/// let mut rx = subscribe_deployment(&pool, "aa:bb:cc:00:11:22").await?;
/// while let Some(payload) = rx.next().await {
///     println!("SSE event: {payload}");
/// }
/// ```
///
/// # Panics
///
/// Aucun panic possible — toutes les erreurs sont propagées via
/// `anyhow::Result`.
pub async fn subscribe_deployment(
    db: &DatabasePool,
    mac: &str,
) -> anyhow::Result<impl Stream<Item = String>> {
    let mut listener = sqlx::postgres::PgListener::connect_with(db.inner()).await?;
    listener.listen("pxe_deployment_progress").await?;
    tracing::debug!(mac = %mac, "SSE subscribe: LISTEN acquired");
    let mac_filter = mac.to_string();
    // PostgreSQL `json_build_object` renders as `"key" : "value"` with
    // spaces around the colon, so match the raw MAC value only.
    let needle = format!("\"{mac_filter}\"");

    let stream = async_stream::stream! {
        loop {
            match listener.recv().await {
                Ok(notification) => {
                    let payload = notification.payload().to_string();
                    if payload.contains(&needle) {
                        yield payload;
                    }
                }
                Err(e) => {
                    tracing::warn!(error = %e, "PgListener error on pxe_deployment_progress");
                    break;
                }
            }
        }
    };

    Ok(stream)
}

/// SSE handler : `GET /api/v1/pxe/deployments/:mac/stream`.
///
/// Streams live deployment progress events as Server-Sent Events. Each
/// event carries the JSON payload emitted by the DB trigger verbatim.
///
/// The stream stays open until the client disconnects or the listener
/// errors. A default `KeepAlive` (every 15 s) is attached so middleboxes
/// don't time-out the idle connection between updates.
///
/// # Examples
///
/// From the browser :
/// ```js
/// const src = new EventSource('/api/v1/pxe/deployments/aa:bb:cc:dd:ee:ff/stream');
/// src.onmessage = (ev) => console.log(JSON.parse(ev.data));
/// ```
///
/// # Errors
///
/// The handler never returns an HTTP error; instead, if the DB
/// subscription fails, the stream emits a single SSE `error` event with
/// a JSON body `{"error": "..."}` and then closes. Clients should treat
/// that as a terminal state (or reconnect manually).
///
/// # Panics
///
/// Aucun panic possible.
#[utoipa::path(
    get,
    path = "/api/v1/pxe/deployments/{mac}/stream",
    params(("mac" = String, Path, description = "Canonical MAC address (xx:xx:xx:xx:xx:xx)")),
    responses(
        (status = 200, description = "SSE stream of progress updates (text/event-stream)"),
    ),
    security(("bearerAuth" = [])),
    tag = "pxe-deployments"
)]
#[tracing::instrument(skip(state), fields(mac = %mac))]
pub async fn stream_deployment(
    State(state): State<AppState>,
    Path(mac): Path<String>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let db = state.db.clone();
    let inner = async_stream::stream! {
        match subscribe_deployment(&db, &mac).await {
            Ok(s) => {
                let mut pinned = Box::pin(s);
                while let Some(payload) = pinned.next().await {
                    yield Ok::<_, Infallible>(Event::default().data(payload));
                }
            }
            Err(e) => {
                tracing::error!(error = %e, "SSE subscribe failed");
                yield Ok::<_, Infallible>(
                    Event::default()
                        .event("error")
                        .data(format!("{{\"error\":\"{e}\"}}")),
                );
            }
        }
    };

    Sse::new(inner).keep_alive(KeepAlive::default())
}
