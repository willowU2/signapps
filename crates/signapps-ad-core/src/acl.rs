//! Access control for directory operations.
//!
//! Checks whether a bound LDAP user has permission to perform an operation
//! on a target object. Uses the existing delegation and policy systems.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// The type of operation being checked.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AclOperation {
    Read,
    Write,
    Create,
    Delete,
    Move,
}

/// The result of an access check.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AclDecision {
    Allow,
    Deny,
}

/// Check access for an operation.
///
/// Simplified model for initial implementation:
/// 1. Domain admin (role >= 2) → allow everything
/// 2. Regular user → read-only
/// 3. All write/create/delete/move → deny for non-admins
///
/// Future: resolve workforce_org_delegations for granular permissions.
#[tracing::instrument]
pub fn check_access(
    user_role: i16,
    operation: AclOperation,
    _target_node_id: Option<Uuid>,
) -> AclDecision {
    if user_role >= 2 {
        return AclDecision::Allow;
    }
    match operation {
        AclOperation::Read => AclDecision::Allow,
        _ => AclDecision::Deny,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn admin_can_do_everything() {
        let node = Some(Uuid::new_v4());
        assert_eq!(check_access(2, AclOperation::Read, node), AclDecision::Allow);
        assert_eq!(check_access(2, AclOperation::Write, node), AclDecision::Allow);
        assert_eq!(check_access(2, AclOperation::Create, node), AclDecision::Allow);
        assert_eq!(check_access(2, AclOperation::Delete, node), AclDecision::Allow);
        assert_eq!(check_access(3, AclOperation::Delete, node), AclDecision::Allow);
    }

    #[test]
    fn regular_user_read_only() {
        let node = Some(Uuid::new_v4());
        assert_eq!(check_access(1, AclOperation::Read, node), AclDecision::Allow);
        assert_eq!(check_access(1, AclOperation::Write, node), AclDecision::Deny);
        assert_eq!(check_access(1, AclOperation::Create, node), AclDecision::Deny);
        assert_eq!(check_access(1, AclOperation::Delete, node), AclDecision::Deny);
    }
}