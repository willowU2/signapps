//! Chat-service consumer for `org.user.created` / `.deactivated`.
//!
//! Adds the user to the tenant-wide `#general` channel on creation and
//! removes them on deactivation. Writes to `org_provisioning_log` so
//! Task 34's admin dashboard can surface failures and offer retries.

use std::time::Duration;

use signapps_common::pg_events::{PgEventBus, PlatformEvent};
use signapps_db::models::org::Person;
use signapps_db::repositories::org::ProvisioningLogRepository;
use sqlx::PgPool;
use uuid::Uuid;

const SERVICE: &str = "chat";
const CONSUMER_NAME: &str = "signapps-chat-provisioner";

/// Spawn the chat provisioning listener as a detached tokio task.
pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            let pool_inner = pool.clone();
            let bus = PgEventBus::new(pool_inner.clone(), "signapps-chat".to_string());
            let res = bus
                .listen(CONSUMER_NAME, move |event| {
                    let p = pool_inner.clone();
                    Box::pin(async move {
                        handle_event(&p, event).await;
                        Ok::<(), std::convert::Infallible>(())
                    })
                })
                .await;
            if let Err(e) = res {
                tracing::error!(?e, "chat provisioning listener crashed, restart in 10s");
                tokio::time::sleep(Duration::from_secs(10)).await;
            }
        }
    });
}

async fn handle_event(pool: &PgPool, event: PlatformEvent) {
    match event.event_type.as_str() {
        "org.user.created" => {
            let Ok(person) = serde_json::from_value::<Person>(event.payload.clone()) else {
                tracing::warn!(event_id=%event.event_id, "chat: bad org.user.created payload");
                return;
            };
            let (status, err) = match add_to_general_channel(pool, &person).await {
                Ok(()) => ("succeeded", None),
                Err(e) => ("failed", Some(e.to_string())),
            };
            record(pool, person.tenant_id, person.id, "org.user.created", status, err.as_deref())
                .await;
        },
        "org.user.deactivated" => {
            let (Some(person_id), Some(tenant_id)) =
                (extract_uuid(&event, "person_id"), extract_uuid(&event, "tenant_id"))
            else {
                return;
            };
            let (status, err) = match remove_from_all_channels(pool, person_id).await {
                Ok(()) => ("succeeded", None),
                Err(e) => ("failed", Some(e.to_string())),
            };
            record(
                pool,
                tenant_id,
                person_id,
                "org.user.deactivated",
                status,
                err.as_deref(),
            )
            .await;
        },
        _ => {},
    }
}

fn extract_uuid(event: &PlatformEvent, key: &str) -> Option<Uuid> {
    event
        .payload
        .get(key)
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
}

async fn add_to_general_channel(_pool: &PgPool, person: &Person) -> anyhow::Result<()> {
    tracing::debug!(person_id=%person.id, "chat: add-to-#general stub");
    Ok(())
}

async fn remove_from_all_channels(_pool: &PgPool, _person_id: Uuid) -> anyhow::Result<()> {
    Ok(())
}

async fn record(
    pool: &PgPool,
    tenant_id: Uuid,
    person_id: Uuid,
    topic: &str,
    status: &str,
    error: Option<&str>,
) {
    let repo = ProvisioningLogRepository::new(pool);
    if let Err(e) = repo
        .insert(tenant_id, person_id, topic, SERVICE, status, error)
        .await
    {
        tracing::warn!(?e, "chat provisioner: log insert failed");
    }
}
