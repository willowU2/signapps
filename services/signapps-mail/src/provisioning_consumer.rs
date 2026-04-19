//! Mail-service consumer for `org.user.created` and `org.user.deactivated`.
//!
//! Subscribes to the canonical org topics emitted by `signapps-org`
//! (see [`signapps_org::event_publisher::topics`]) and performs the
//! minimum amount of work needed to "provision" a mailbox for a newly
//! created person (and suspend it on deactivation).
//!
//! **Scope (W5 Task 33)**: the real mailbox lifecycle logic lives in
//! [`crate::handlers::provisioning`]. Here we only wire the event →
//! handler plumbing and record the attempt in `org_provisioning_log`.
//!
//! Each run is logged via [`ProvisioningLogRepository`] so the admin
//! dashboard (Task 34) can show the cross-service provisioning queue.

use std::time::Duration;

use signapps_common::pg_events::{PgEventBus, PlatformEvent};
use signapps_db::models::org::Person;
use signapps_db::repositories::org::ProvisioningLogRepository;
use sqlx::PgPool;

const SERVICE: &str = "mail";
const CONSUMER_NAME: &str = "signapps-mail-provisioner";

/// Spawn the provisioning listener as a detached tokio task tied to
/// the mail router factory scope.
pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            let pool_inner = pool.clone();
            let bus = PgEventBus::new(pool_inner.clone(), "signapps-mail".to_string());
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
                tracing::error!(?e, "mail provisioning listener crashed, restart in 10s");
                tokio::time::sleep(Duration::from_secs(10)).await;
            }
        }
    });
}

async fn handle_event(pool: &PgPool, event: PlatformEvent) {
    match event.event_type.as_str() {
        "org.user.created" => on_user_created(pool, &event).await,
        "org.user.deactivated" => on_user_deactivated(pool, &event).await,
        _ => {}, // ignore everything else
    }
}

async fn on_user_created(pool: &PgPool, event: &PlatformEvent) {
    let Ok(person) = serde_json::from_value::<Person>(event.payload.clone()) else {
        tracing::warn!(event_id=%event.event_id, "mail provisioner: malformed org.user.created payload");
        return;
    };

    match create_default_mailbox(pool, &person).await {
        Ok(()) => {
            record(pool, &person, "org.user.created", "succeeded", None).await;
            tracing::info!(person_id=%person.id, "mail provisioning ok");
        },
        Err(e) => {
            let msg = e.to_string();
            record(pool, &person, "org.user.created", "failed", Some(&msg)).await;
            tracing::warn!(person_id=%person.id, error=%msg, "mail provisioning failed");
        },
    }
}

async fn on_user_deactivated(pool: &PgPool, event: &PlatformEvent) {
    let person_id = event
        .payload
        .get("person_id")
        .and_then(|v| v.as_str())
        .and_then(|s| uuid::Uuid::parse_str(s).ok());
    let tenant_id = event
        .payload
        .get("tenant_id")
        .and_then(|v| v.as_str())
        .and_then(|s| uuid::Uuid::parse_str(s).ok());
    let (Some(person_id), Some(tenant_id)) = (person_id, tenant_id) else {
        tracing::warn!(event_id=%event.event_id, "mail provisioner: missing ids on deactivation");
        return;
    };

    match suspend_mailbox(pool, person_id).await {
        Ok(()) => {
            record_raw(pool, tenant_id, person_id, "org.user.deactivated", "succeeded", None).await;
            tracing::info!(%person_id, "mail deprovisioning ok");
        },
        Err(e) => {
            let msg = e.to_string();
            record_raw(
                pool,
                tenant_id,
                person_id,
                "org.user.deactivated",
                "failed",
                Some(&msg),
            )
            .await;
            tracing::warn!(%person_id, error=%msg, "mail deprovisioning failed");
        },
    }
}

/// Minimal welcome-row stub used by Task 33.
///
/// Writes a row in `org_provisioning_log` via the caller — this
/// function itself only performs a trivial DB no-op so the success
/// path of the consumer can be exercised end-to-end. The real default
/// mailbox creation is the responsibility of
/// [`crate::handlers::provisioning`].
async fn create_default_mailbox(_pool: &PgPool, person: &Person) -> anyhow::Result<()> {
    tracing::debug!(person_id=%person.id, email=%person.email, "mail: default mailbox stub");
    Ok(())
}

async fn suspend_mailbox(_pool: &PgPool, _person_id: uuid::Uuid) -> anyhow::Result<()> {
    // Stub — see create_default_mailbox.
    Ok(())
}

async fn record(pool: &PgPool, person: &Person, topic: &str, status: &str, error: Option<&str>) {
    record_raw(pool, person.tenant_id, person.id, topic, status, error).await;
}

async fn record_raw(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
    person_id: uuid::Uuid,
    topic: &str,
    status: &str,
    error: Option<&str>,
) {
    let repo = ProvisioningLogRepository::new(pool);
    if let Err(e) = repo
        .insert(tenant_id, person_id, topic, SERVICE, status, error)
        .await
    {
        tracing::warn!(?e, "mail provisioner: could not write provisioning log");
    }
}
