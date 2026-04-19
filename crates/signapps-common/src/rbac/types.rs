//! RBAC core types — resource / action / decision model.
//!
//! These types are the public contract between every SignApps service and
//! the `OrgPermissionResolver` implementation living in `signapps-org`.
//! They are intentionally lightweight (`Copy` where possible) and fully
//! `serde`-serialisable so decisions can be cached or traced.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A person making an access request.
///
/// Carries the canonical `org_persons.id` (preferred) and the tenant scope.
/// When `person_id` is not present on the JWT, a `Uuid::nil()` placeholder
/// is used — the resolver then treats the caller as an unbound user and
/// evaluates only tenant-admin / board-member / direct-grant rules.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PersonRef {
    /// Person identifier (canonical `org_persons.id`, falls back to JWT
    /// `sub` when no person mapping exists).
    pub id: Uuid,
    /// Tenant identifier — always required; requests without a tenant are
    /// rejected upstream by the auth middleware.
    pub tenant_id: Uuid,
}

/// A resource the caller wants to act on.
///
/// The resolver dispatches on the variant to pick which bindings /
/// grants / board memberships apply.  `Custom` is provided for services
/// that own resource kinds outside the canonical list (e.g. tickets,
/// CRM opportunities).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "resource", rename_all = "snake_case")]
pub enum ResourceRef {
    /// A document handled by `signapps-docs`.
    Document(Uuid),
    /// A folder / workspace in `signapps-storage`.
    Folder(Uuid),
    /// A calendar in `signapps-calendar`.
    Calendar(Uuid),
    /// A mail folder in `signapps-mail`.
    MailFolder(Uuid),
    /// A form in `signapps-forms`.
    Form(Uuid),
    /// A project / task board.
    Project(Uuid),
    /// An org-chart node.
    OrgNode(Uuid),
    /// Any other kind a service wants to ask about.
    Custom {
        /// Stable, borrowed kind label (e.g. `"ticket"`).
        kind: &'static str,
        /// Resource UUID.
        id: Uuid,
    },
}

impl ResourceRef {
    /// Return the stable resource-kind label for this variant.
    ///
    /// Used to populate the `resource_type` column on `org_access_grants`
    /// and to key the decision cache.
    pub fn kind(&self) -> &'static str {
        match self {
            Self::Document(_) => "document",
            Self::Folder(_) => "folder",
            Self::Calendar(_) => "calendar",
            Self::MailFolder(_) => "mail_folder",
            Self::Form(_) => "form",
            Self::Project(_) => "project",
            Self::OrgNode(_) => "org_node",
            Self::Custom { kind, .. } => kind,
        }
    }

    /// Return the resource UUID regardless of the variant.
    pub fn id(&self) -> Uuid {
        match self {
            Self::Document(i)
            | Self::Folder(i)
            | Self::Calendar(i)
            | Self::MailFolder(i)
            | Self::Form(i)
            | Self::Project(i)
            | Self::OrgNode(i) => *i,
            Self::Custom { id, .. } => *id,
        }
    }
}

/// An action the caller wants to perform on a resource.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    /// Read access (list, show, export).
    Read,
    /// Write access (create, update).
    Write,
    /// Delete access.
    Delete,
    /// Share access — grant this resource to somebody else.
    Share,
    /// Full administrative access (change ACL, transfer ownership).
    Admin,
}

impl Action {
    /// Stable snake_case label for logging and SQL `permissions @>` lookups.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Read => "read",
            Self::Write => "write",
            Self::Delete => "delete",
            Self::Share => "share",
            Self::Admin => "admin",
        }
    }
}

/// The outcome of an authorisation check.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum Decision {
    /// Access granted; `source` tells the caller which rule applied.
    Allow {
        /// Source of the grant.
        source: DecisionSource,
    },
    /// Access denied; `reason` tells the caller why.
    Deny {
        /// Deny reason.
        reason: DenyReason,
    },
}

impl Decision {
    /// True if this decision allows access.
    pub fn is_allow(&self) -> bool {
        matches!(self, Decision::Allow { .. })
    }

    /// True if this decision denies access.
    pub fn is_deny(&self) -> bool {
        matches!(self, Decision::Deny { .. })
    }
}

/// Which rule produced an `Allow` decision.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "source", rename_all = "snake_case")]
pub enum DecisionSource {
    /// The caller owns the resource directly.
    OwnerOfResource,
    /// The caller sits on the governing board of a containing node.
    BoardOfContainingNode(Uuid),
    /// A policy binding attached to an ancestor node matched.
    PolicyBinding {
        /// Matched policy.
        policy_id: Uuid,
        /// Binding node.
        node_id: Uuid,
    },
    /// A direct access grant to this specific resource matched.
    AccessGrant {
        /// Matched grant.
        grant_id: Uuid,
    },
    /// The caller is a tenant admin (identity role == admin).
    Admin,
    /// **SO1** — An active delegation escalated the caller's rights.
    Delegation {
        /// Matched delegation id.
        delegation_id: Uuid,
        /// Person who delegated their rights.
        delegator_person_id: Uuid,
    },
}

/// Why a request was denied.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DenyReason {
    /// No applicable policy / board / grant was found.
    NoGrant,
    /// A matching grant existed but has expired.
    GrantExpired,
    /// A matching grant existed but has been revoked.
    GrantRevoked,
    /// The caller's account is disabled.
    Disabled,
    /// The resource does not exist.
    NotFound,
}
