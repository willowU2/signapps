//! PgEventBus consumer for `org.*` topics — invalidates the
//! `OrgClient` decision cache on grant / policy / assignment changes.
//!
//! The loop is started from `lib.rs::router(...)`; it runs for the
//! lifetime of the single-binary because `PgEventBus::listen` blocks
//! forever (catch-up + live LISTEN).

use std::sync::Arc;

use signapps_common::pg_events::{PgEventBus, PlatformEvent};

use crate::rbac_client::OrgClient;

/// Spawn a background task that subscribes to the `org.*` topics we
/// care about and forwards each event to [`invalidate_on_event`].
///
/// PgEventBus consumers can subscribe on only one topic at a time, so
/// we open one tokio task per topic.  Each task survives disconnects
/// via the catch-up + live LISTEN design already baked into
/// `PgEventBus::listen`.
pub fn spawn_invalidation_listener(
    bus: Arc<PgEventBus>,
    resolver: Arc<OrgClient>,
) {
    for topic in [
        "org.grant.created",
        "org.grant.revoked",
        "org.policy.updated",
        "org.assignment.changed",
    ] {
        let bus = bus.clone();
        let resolver = resolver.clone();
        tokio::spawn(async move {
            tracing::info!(topic, "rbac cache invalidation listener starting");
            let consumer = format!("rbac-cache-{topic}");
            let resolver2 = resolver.clone();
            let res = bus
                .listen(&consumer, move |event| {
                    let resolver = resolver2.clone();
                    Box::pin(async move {
                        invalidate_on_event(&resolver, &event).await;
                        Ok::<(), std::convert::Infallible>(())
                    })
                })
                .await;
            if let Err(e) = res {
                tracing::error!(topic, ?e, "rbac cache listener crashed");
            }
        });
    }
}

/// Apply the cache invalidation that corresponds to a single event.
pub async fn invalidate_on_event(resolver: &OrgClient, event: &PlatformEvent) {
    match event.event_type.as_str() {
        "org.grant.created" | "org.grant.revoked" => {
            // The payload carries the resource_type/resource_id of the
            // grant — we invalidate every cached decision for that
            // resource regardless of the person/action.
            if let Some((kind, id)) = extract_resource(&event.payload) {
                resolver.cache().invalidate_resource(kind, id).await;
                tracing::debug!(%event.event_type, kind, %id, "rbac cache: targeted invalidation");
            } else {
                resolver.cache().invalidate_all().await;
                tracing::debug!(%event.event_type, "rbac cache: broad invalidation (no resource in payload)");
            }
        },
        "org.policy.updated" | "org.assignment.changed" => {
            // Policy / assignment edits can affect arbitrarily many
            // resources.  Broad invalidation is cheaper than enumerating.
            resolver.cache().invalidate_all().await;
            tracing::debug!(%event.event_type, "rbac cache: broad invalidation");
        },
        _ => {}, // ignore
    }
}

/// Best-effort extraction of `(resource_type, resource_id)` from an
/// event payload.  Returns `None` if either field is missing or
/// invalid — the caller falls back to `invalidate_all`.
///
/// Note: `kind` must be a `&'static str` because the moka cache key
/// carries the same type.  We match against a whitelist of known
/// canonical kinds; anything else triggers a broad invalidation.
fn extract_resource(payload: &serde_json::Value) -> Option<(&'static str, uuid::Uuid)> {
    let raw = payload.get("resource_type").and_then(|v| v.as_str())?;
    let kind: &'static str = match raw {
        "document" => "document",
        "folder" => "folder",
        "calendar" => "calendar",
        "mail_folder" => "mail_folder",
        "form" => "form",
        "project" => "project",
        "org_node" => "org_node",
        _ => return None,
    };
    let id = payload
        .get("resource_id")
        .and_then(|v| v.as_str())
        .and_then(|s| uuid::Uuid::parse_str(s).ok())?;
    Some((kind, id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_resource_handles_canonical_kinds() {
        let p = serde_json::json!({
            "resource_type": "document",
            "resource_id": "00000000-0000-0000-0000-000000000001"
        });
        let (kind, id) = extract_resource(&p).expect("extract");
        assert_eq!(kind, "document");
        assert_eq!(id, uuid::Uuid::from_u128(1));
    }

    #[test]
    fn extract_resource_rejects_unknown_kind() {
        let p = serde_json::json!({
            "resource_type": "unknown_kind",
            "resource_id": "00000000-0000-0000-0000-000000000001"
        });
        assert!(extract_resource(&p).is_none());
    }

    #[test]
    fn extract_resource_rejects_missing_fields() {
        let p = serde_json::json!({});
        assert!(extract_resource(&p).is_none());
    }
}
