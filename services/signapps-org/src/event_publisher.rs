//! Typed helpers that publish `org.*` events on the [`PgEventBus`].
//!
//! Keeping the event topic strings in one place protects the consumers
//! (RBAC cache invalidator in [`crate::events`], provisioning fan-out
//! in the mail/storage/calendar/chat services) from subtle drift if
//! handlers grow different typos for the same topic.
//!
//! The publisher is a borrow around an `&PgEventBus` so it works with
//! whatever ownership pattern each handler has (Arc, clone, etc.).

use signapps_common::pg_events::{NewEvent, PgEventBus};
use signapps_db::models::org::Person;
use uuid::Uuid;

// ============================================================================
// Topics — single source of truth
// ============================================================================

/// Canonical event topic names. Kept as constants so the RBAC cache
/// listener (`crate::events::spawn_invalidation_listener`) and any
/// downstream consumer can match the same strings.
pub mod topics {
    /// A new [`Person`](signapps_db::models::org::Person) was created.
    pub const USER_CREATED: &str = "org.user.created";
    /// A person was deactivated / archived.
    pub const USER_DEACTIVATED: &str = "org.user.deactivated";
    /// A new access grant was issued.
    pub const GRANT_CREATED: &str = "org.grant.created";
    /// An access grant was revoked.
    pub const GRANT_REVOKED: &str = "org.grant.revoked";
    /// Canonical `org_assignments` changed (create, update, delete).
    pub const ASSIGNMENT_CHANGED: &str = "org.assignment.changed";
    /// A policy or one of its bindings was mutated.
    pub const POLICY_UPDATED: &str = "org.policy.updated";
}

// ============================================================================
// Publisher
// ============================================================================

/// Typed publisher wrapping an [`&PgEventBus`](PgEventBus).
///
/// Every method is `anyhow::Result<()>` because handlers tolerate
/// publication failures (they log and continue) while the AD sync
/// worker wants `?`-bubble on failure.
pub struct OrgEventPublisher<'a> {
    /// Underlying event bus.
    pub bus: &'a PgEventBus,
}

impl<'a> OrgEventPublisher<'a> {
    /// Wrap an event bus.
    #[must_use]
    pub fn new(bus: &'a PgEventBus) -> Self {
        Self { bus }
    }

    /// Publish `org.user.created` with the full person row as payload.
    ///
    /// Consumer services deserialize the payload back into
    /// [`Person`] and provision user-owned resources (mailbox, drive,
    /// calendar, chat membership).
    pub async fn user_created(&self, person: &Person) -> anyhow::Result<()> {
        let payload = serde_json::to_value(person)?;
        self.bus
            .publish(NewEvent {
                event_type: topics::USER_CREATED.to_string(),
                aggregate_id: Some(person.id),
                payload,
            })
            .await?;
        Ok(())
    }

    /// Publish `org.user.deactivated` (archive / soft-delete).
    pub async fn user_deactivated(
        &self,
        person_id: Uuid,
        tenant_id: Uuid,
    ) -> anyhow::Result<()> {
        self.bus
            .publish(NewEvent {
                event_type: topics::USER_DEACTIVATED.to_string(),
                aggregate_id: Some(person_id),
                payload: serde_json::json!({
                    "person_id": person_id,
                    "tenant_id": tenant_id,
                }),
            })
            .await?;
        Ok(())
    }

    /// Publish `org.grant.created` with enough metadata for targeted
    /// RBAC cache invalidation (resource_type + resource_id).
    pub async fn grant_created(
        &self,
        grant_id: Uuid,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
    ) -> anyhow::Result<()> {
        self.bus
            .publish(NewEvent {
                event_type: topics::GRANT_CREATED.to_string(),
                aggregate_id: Some(grant_id),
                payload: serde_json::json!({
                    "id": grant_id,
                    "tenant_id": tenant_id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                }),
            })
            .await?;
        Ok(())
    }

    /// Publish `org.grant.revoked`.
    pub async fn grant_revoked(
        &self,
        grant_id: Uuid,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
    ) -> anyhow::Result<()> {
        self.bus
            .publish(NewEvent {
                event_type: topics::GRANT_REVOKED.to_string(),
                aggregate_id: Some(grant_id),
                payload: serde_json::json!({
                    "id": grant_id,
                    "tenant_id": tenant_id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                }),
            })
            .await?;
        Ok(())
    }

    /// Publish `org.assignment.changed` (create, update, delete).
    pub async fn assignment_changed(&self, person_id: Uuid) -> anyhow::Result<()> {
        self.bus
            .publish(NewEvent {
                event_type: topics::ASSIGNMENT_CHANGED.to_string(),
                aggregate_id: Some(person_id),
                payload: serde_json::json!({ "person_id": person_id }),
            })
            .await?;
        Ok(())
    }

    /// Publish `org.policy.updated` — used on policy mutation and on
    /// binding add/remove (single topic because the RBAC cache
    /// invalidation is broad either way).
    pub async fn policy_updated(&self, policy_id: Uuid) -> anyhow::Result<()> {
        self.bus
            .publish(NewEvent {
                event_type: topics::POLICY_UPDATED.to_string(),
                aggregate_id: Some(policy_id),
                payload: serde_json::json!({ "policy_id": policy_id }),
            })
            .await?;
        Ok(())
    }
}
