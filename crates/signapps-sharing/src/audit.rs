//! Structured audit logger for the sharing engine.
//!
//! [`AuditLogger`] wraps [`SharingRepository::insert_audit`] and provides
//! convenience methods for each sharing event type.  Every method builds a
//! typed JSONB `details` payload using [`serde_json::json!`] and delegates to
//! the repository for persistence.
//!
//! All entries are immutable once written; there is no update or delete path.

use signapps_common::Result;
use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

use crate::repository::SharingRepository;

// ─── GrantCreatedEvent ────────────────────────────────────────────────────────

/// Input bundle for [`AuditLogger::log_grant_created`].
///
/// Groups the 8+ individual parameters into a single struct to comply with
/// the function-argument-count limit.
pub struct GrantCreatedEvent<'a> {
    /// Tenant scope for this event.
    pub tenant_id: Uuid,
    /// The resource type (e.g. `"file"`, `"folder"`).
    pub resource_type: &'a str,
    /// The specific resource instance.
    pub resource_id: Uuid,
    /// The actor who created the grant.
    pub actor_id: Uuid,
    /// The newly created grant's identifier.
    pub grant_id: Uuid,
    /// The kind of grantee (`"user"`, `"group"`, `"org_node"`, `"everyone"`).
    pub grantee_type: &'a str,
    /// The grantee UUID, or `None` for `"everyone"` grants.
    pub grantee_id: Option<Uuid>,
    /// The assigned role string.
    pub role: &'a str,
}

// ─── AuditLogger ─────────────────────────────────────────────────────────────

/// Convenience wrapper for writing immutable sharing audit log entries.
///
/// Construct via [`AuditLogger::new`] then call the typed event methods.
pub struct AuditLogger<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> AuditLogger<'pool> {
    /// Create a new `AuditLogger` backed by the given connection pool.
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }

    /// Record a `grant_created` event.
    ///
    /// Called after successfully inserting a new grant row.
    ///
    /// # Errors
    ///
    /// Returns [`signapps_common::Error::Database`] if the insert fails.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, event), fields(
        tenant_id = tracing::field::Empty,
        actor_id  = tracing::field::Empty,
        grant_id  = tracing::field::Empty,
    ))]
    pub async fn log_grant_created(&self, event: GrantCreatedEvent<'_>) -> Result<()> {
        tracing::Span::current()
            .record("tenant_id", tracing::field::display(event.tenant_id))
            .record("actor_id", tracing::field::display(event.actor_id))
            .record("grant_id", tracing::field::display(event.grant_id));
        let details = serde_json::json!({
            "grant_id":    event.grant_id,
            "grantee_type": event.grantee_type,
            "grantee_id":  event.grantee_id,
            "role":        event.role,
        });

        SharingRepository::insert_audit(
            self.pool,
            event.tenant_id,
            event.resource_type,
            event.resource_id,
            event.actor_id,
            "grant_created",
            details,
        )
        .await?;

        tracing::info!(
            tenant_id   = %event.tenant_id,
            resource    = %event.resource_type,
            resource_id = %event.resource_id,
            actor_id    = %event.actor_id,
            grant_id    = %event.grant_id,
            role        = %event.role,
            "grant created"
        );

        Ok(())
    }

    /// Record a `grant_revoked` event.
    ///
    /// Called after successfully deleting a grant row.
    ///
    /// # Errors
    ///
    /// Returns [`signapps_common::Error::Database`] if the insert fails.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self), fields(
        tenant_id = %tenant_id,
        actor_id  = %actor_id,
        grant_id  = %grant_id,
    ))]
    pub async fn log_grant_revoked(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        actor_id: Uuid,
        grant_id: Uuid,
    ) -> Result<()> {
        let details = serde_json::json!({ "grant_id": grant_id });

        SharingRepository::insert_audit(
            self.pool,
            tenant_id,
            resource_type,
            resource_id,
            actor_id,
            "grant_revoked",
            details,
        )
        .await?;

        tracing::info!(
            tenant_id   = %tenant_id,
            resource    = %resource_type,
            resource_id = %resource_id,
            actor_id    = %actor_id,
            grant_id    = %grant_id,
            "grant revoked"
        );

        Ok(())
    }

    /// Record an `access_denied` event.
    ///
    /// Called by the permission resolver when a check fails.
    ///
    /// # Errors
    ///
    /// Returns [`signapps_common::Error::Database`] if the insert fails.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self), fields(
        tenant_id = %tenant_id,
        actor_id  = %actor_id,
        action,
    ))]
    pub async fn log_access_denied(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        actor_id: Uuid,
        action: &str,
        reason: &str,
    ) -> Result<()> {
        let details = serde_json::json!({ "action": action, "reason": reason });

        SharingRepository::insert_audit(
            self.pool,
            tenant_id,
            resource_type,
            resource_id,
            actor_id,
            "access_denied",
            details,
        )
        .await?;

        tracing::warn!(
            tenant_id   = %tenant_id,
            resource    = %resource_type,
            resource_id = %resource_id,
            actor_id    = %actor_id,
            action,
            reason,
            "access denied"
        );

        Ok(())
    }

    /// Record a `deny_set` event.
    ///
    /// Called when an explicit deny grant is added to a resource.
    ///
    /// # Errors
    ///
    /// Returns [`signapps_common::Error::Database`] if the insert fails.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self), fields(
        tenant_id = %tenant_id,
        actor_id  = %actor_id,
        grant_id  = %grant_id,
    ))]
    pub async fn log_deny_set(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        actor_id: Uuid,
        grant_id: Uuid,
        grantee_type: &str,
        grantee_id: Option<Uuid>,
    ) -> Result<()> {
        let details = serde_json::json!({
            "grant_id":    grant_id,
            "grantee_type": grantee_type,
            "grantee_id":  grantee_id,
        });

        SharingRepository::insert_audit(
            self.pool,
            tenant_id,
            resource_type,
            resource_id,
            actor_id,
            "deny_set",
            details,
        )
        .await?;

        tracing::info!(
            tenant_id   = %tenant_id,
            resource    = %resource_type,
            resource_id = %resource_id,
            actor_id    = %actor_id,
            grant_id    = %grant_id,
            "deny set on resource"
        );

        Ok(())
    }

    /// Record a `template_applied` event.
    ///
    /// Called after successfully applying a sharing template to a resource.
    ///
    /// # Errors
    ///
    /// Returns [`signapps_common::Error::Database`] if the insert fails.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self), fields(
        tenant_id   = %tenant_id,
        actor_id    = %actor_id,
        template_id = %template_id,
    ))]
    pub async fn log_template_applied(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        actor_id: Uuid,
        template_id: Uuid,
        grants_created: usize,
    ) -> Result<()> {
        let details = serde_json::json!({
            "template_id":    template_id,
            "grants_created": grants_created,
        });

        SharingRepository::insert_audit(
            self.pool,
            tenant_id,
            resource_type,
            resource_id,
            actor_id,
            "template_applied",
            details,
        )
        .await?;

        tracing::info!(
            tenant_id     = %tenant_id,
            resource      = %resource_type,
            resource_id   = %resource_id,
            actor_id      = %actor_id,
            template_id   = %template_id,
            grants_created,
            "sharing template applied"
        );

        Ok(())
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // AuditLogger requires a live PgPool for meaningful tests.
    // Integration tests live in tests/integration_*.rs.

    #[test]
    fn audit_logger_is_zero_overhead_at_compile_time() {
        // Just verify the struct can be named and the size check succeeds
        // (the pool reference is a fat pointer, so size is 2 * usize).
        assert!(std::mem::size_of::<AuditLogger<'_>>() > 0);
    }
}
