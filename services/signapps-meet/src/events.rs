//! PgEventBus consumer for signapps-meet.
//!
//! Listens for cross-service events and reacts to calendar lifecycle:
//!
//! * `calendar.event.deleted` — if the deleted event had a linked Meet
//!   room (`meet_room_code` in the payload), delete the LiveKit room and
//!   mark `meet.rooms.status = 'ended'` so it drops out of the active
//!   rooms listing.

use std::sync::Arc;

use signapps_common::pg_events::{PgEventBus, PlatformEvent};
use signapps_livekit_client::LiveKitClient;
use sqlx::{Pool, Postgres};

/// Handle a single `calendar.event.deleted` event.
///
/// Non-fatal: any error is logged and swallowed so the consumer cursor
/// still advances (we don't want a transient LiveKit failure to block
/// the whole event stream).
///
/// # Errors
///
/// Returns a `sqlx::Error` only for unrecoverable DB failures so the bus
/// retries the event. Missing `meet_room_code` or a 404 from LiveKit is
/// treated as success.
async fn handle_calendar_deleted(
    pool: &Pool<Postgres>,
    livekit: &LiveKitClient,
    event: &PlatformEvent,
) -> Result<(), sqlx::Error> {
    let code = event
        .payload
        .get("meet_room_code")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let Some(code) = code else {
        return Ok(()); // Event had no Meet room — nothing to clean up.
    };

    // Ask LiveKit to drop the room — best-effort, log and continue.
    if let Err(e) = livekit.delete_room(&code).await {
        tracing::warn!(meet_room_code = %code, ?e, "livekit delete_room failed");
    }

    let _ = sqlx::query(
        "UPDATE meet.rooms SET status = 'ended', actual_end = NOW(), updated_at = NOW() \
         WHERE room_code = $1 AND status <> 'ended'",
    )
    .bind(&code)
    .execute(pool)
    .await?;

    tracing::info!(meet_room_code = %code, "cleaned up Meet room after calendar event deletion");
    Ok(())
}

/// Entry point: start the PgEventBus consumer loop.
///
/// Runs for the lifetime of the service. The consumer name
/// `signapps-meet-calendar` persists its cursor in
/// `platform.event_consumers` so restarts pick up where they left off.
pub async fn run_consumer(pool: Pool<Postgres>, livekit: Arc<LiveKitClient>) {
    let bus = PgEventBus::new(pool.clone(), "signapps-meet".to_string());
    let listener_pool = pool.clone();

    let result = bus
        .listen("signapps-meet-calendar", move |event: PlatformEvent| {
            let p = listener_pool.clone();
            let lk = livekit.clone();
            Box::pin(async move {
                if event.event_type == "calendar.event.deleted" {
                    handle_calendar_deleted(&p, &lk, &event).await?;
                }
                Ok::<(), sqlx::Error>(())
            })
        })
        .await;

    if let Err(e) = result {
        tracing::error!(?e, "signapps-meet calendar consumer crashed");
    }
}
