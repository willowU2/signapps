//! `OrgPermissionResolver` — the trait every service depends on when it
//! needs to decide whether the caller can act on a resource.
//!
//! The real implementation lives in `signapps-org` (see `OrgClient`).
//! Services receive it as `Arc<dyn OrgPermissionResolver>` through
//! `SharedState::resolver`.

use async_trait::async_trait;

use super::types::{Action, Decision, PersonRef, ResourceRef};

/// Authorisation oracle used by every service.
///
/// Implementors MUST be thread-safe and cheap to `Arc::clone`.  The
/// canonical impl backs the trait with a moka cache (60 s TTL) plus
/// SQL lookups against `org_access_grants`, `org_policy_bindings` and
/// `org_board_members`.
#[async_trait]
pub trait OrgPermissionResolver: Send + Sync {
    /// Decide whether `who` can perform `action` on `resource`.
    ///
    /// # Errors
    ///
    /// Returns [`RbacError::Unavailable`] if the underlying store is
    /// unreachable and [`RbacError::BadRequest`] on obviously invalid
    /// inputs (e.g. nil UUID when the resource shape requires one).
    async fn check(
        &self,
        who: PersonRef,
        resource: ResourceRef,
        action: Action,
    ) -> Result<Decision, RbacError>;
}

/// Error returned by an [`OrgPermissionResolver`].
#[derive(thiserror::Error, Debug)]
pub enum RbacError {
    /// The resolver could not reach its backing store.
    #[error("resolver unavailable: {0}")]
    Unavailable(String),
    /// The caller supplied an obviously invalid request.
    #[error("invalid request: {0}")]
    BadRequest(String),
}
