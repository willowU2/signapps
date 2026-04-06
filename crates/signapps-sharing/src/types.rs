//! Core domain types for the sharing/permission engine.
//!
//! This module defines the fundamental enums and value objects that drive
//! the multi-axis permission model: [`ResourceType`], [`Role`], [`Action`],
//! [`GranteeType`], [`ResourceRef`], and [`Grantee`].

use std::fmt;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ─── ResourceType ────────────────────────────────────────────────────────────

/// The kind of resource a permission grant applies to.
///
/// Used both as a discriminator in the `sharing.grants` table and as a key
/// for capability lookups in `sharing.capabilities`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceType {
    /// A single uploaded or synced file.
    File,
    /// A directory / folder node.
    Folder,
    /// A calendar (container of events).
    Calendar,
    /// A single calendar event or occurrence.
    Event,
    /// A collaborative document (Tiptap/Docs service).
    Document,
    /// A form definition managed by signapps-forms.
    Form,
    /// An address book / contact list.
    ContactBook,
    /// A chat channel or thread.
    Channel,
    /// An IT asset record.
    Asset,
    /// A vault entry (password / secret).
    VaultEntry,
}

impl ResourceType {
    /// Returns the canonical snake_case string representation.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_sharing::types::ResourceType;
    ///
    /// assert_eq!(ResourceType::File.as_str(), "file");
    /// assert_eq!(ResourceType::VaultEntry.as_str(), "vault_entry");
    /// ```
    pub fn as_str(self) -> &'static str {
        match self {
            Self::File => "file",
            Self::Folder => "folder",
            Self::Calendar => "calendar",
            Self::Event => "event",
            Self::Document => "document",
            Self::Form => "form",
            Self::ContactBook => "contact_book",
            Self::Channel => "channel",
            Self::Asset => "asset",
            Self::VaultEntry => "vault_entry",
        }
    }
}

impl fmt::Display for ResourceType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl std::str::FromStr for ResourceType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "file" => Ok(Self::File),
            "folder" => Ok(Self::Folder),
            "calendar" => Ok(Self::Calendar),
            "event" => Ok(Self::Event),
            "document" => Ok(Self::Document),
            "form" => Ok(Self::Form),
            "contact_book" => Ok(Self::ContactBook),
            "channel" => Ok(Self::Channel),
            "asset" => Ok(Self::Asset),
            "vault_entry" => Ok(Self::VaultEntry),
            other => Err(format!("unknown resource type: {other}")),
        }
    }
}

// ─── Role ─────────────────────────────────────────────────────────────────────

/// Permission role on a resource, ordered from most restrictive to most
/// permissive.
///
/// The numeric `level()` is stored as a signed integer so that `deny` can be
/// represented as -1 (below any positive grant) and used for explicit deny
/// semantics.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    /// Explicitly deny all access, overriding positive grants from other axes.
    Deny,
    /// Read-only access.
    Viewer,
    /// Read + write access.
    Editor,
    /// Full control including permission delegation.
    Manager,
}

impl Role {
    /// Numeric level for comparisons.
    ///
    /// `deny = -1`, `viewer = 1`, `editor = 2`, `manager = 3`.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_sharing::types::Role;
    ///
    /// assert!(Role::Editor.level() > Role::Viewer.level());
    /// assert!(Role::Deny.level() < 0);
    /// ```
    pub fn level(self) -> i32 {
        match self {
            Self::Deny => -1,
            Self::Viewer => 1,
            Self::Editor => 2,
            Self::Manager => 3,
        }
    }

    /// Returns the more permissive of two roles.
    ///
    /// If either role is [`Role::Deny`], the deny wins only when it is the
    /// sole grant; when both are compared we pick the higher level so that
    /// a positive grant on another axis can override a deny on a less specific
    /// axis.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_sharing::types::Role;
    ///
    /// assert_eq!(Role::max_permissive(Role::Viewer, Role::Editor), Role::Editor);
    /// assert_eq!(Role::max_permissive(Role::Manager, Role::Deny), Role::Manager);
    /// ```
    pub fn max_permissive(a: Self, b: Self) -> Self {
        if a.level() >= b.level() {
            a
        } else {
            b
        }
    }

    /// Returns the canonical string representation stored in the database.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Deny => "deny",
            Self::Viewer => "viewer",
            Self::Editor => "editor",
            Self::Manager => "manager",
        }
    }
}

impl fmt::Display for Role {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl std::str::FromStr for Role {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "deny" => Ok(Self::Deny),
            "viewer" => Ok(Self::Viewer),
            "editor" => Ok(Self::Editor),
            "manager" => Ok(Self::Manager),
            other => Err(format!("unknown role: {other}")),
        }
    }
}

// ─── Action ──────────────────────────────────────────────────────────────────

/// A fine-grained permission action, backed by a plain string to allow
/// domain-specific extensions without changing this enum.
///
/// Use the constructor helpers ([`Action::read`], [`Action::write`], …) for
/// standard actions; custom actions can be built via [`Action::new`].
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Action(String);

impl Action {
    /// Create a custom action from any string.
    pub fn new(s: impl Into<String>) -> Self {
        Self(s.into())
    }

    /// Standard read action (`"read"`).
    pub fn read() -> Self {
        Self("read".into())
    }

    /// Standard write action (`"write"`).
    pub fn write() -> Self {
        Self("write".into())
    }

    /// Standard delete action (`"delete"`).
    pub fn delete() -> Self {
        Self("delete".into())
    }

    /// Standard share action (`"share"`).
    pub fn share() -> Self {
        Self("share".into())
    }

    /// Standard list action (`"list"`).
    pub fn list() -> Self {
        Self("list".into())
    }

    /// Returns the underlying string slice.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for Action {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl From<String> for Action {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl From<&str> for Action {
    fn from(s: &str) -> Self {
        Self(s.to_owned())
    }
}

// ─── GranteeType ─────────────────────────────────────────────────────────────

/// The kind of principal a permission grant targets.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GranteeType {
    /// A specific user account.
    User,
    /// A named group of users.
    Group,
    /// A node in the organisational hierarchy (team, department, BU…).
    OrgNode,
    /// Every authenticated user in the tenant (public within the tenant).
    Everyone,
}

impl GranteeType {
    /// Returns the canonical string stored in the database.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::User => "user",
            Self::Group => "group",
            Self::OrgNode => "org_node",
            Self::Everyone => "everyone",
        }
    }
}

impl fmt::Display for GranteeType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl std::str::FromStr for GranteeType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "user" => Ok(Self::User),
            "group" => Ok(Self::Group),
            "org_node" => Ok(Self::OrgNode),
            "everyone" => Ok(Self::Everyone),
            other => Err(format!("unknown grantee type: {other}")),
        }
    }
}

// ─── ResourceRef ─────────────────────────────────────────────────────────────

/// A typed reference to a specific resource instance.
///
/// Combines a [`ResourceType`] discriminator with the resource's UUID so
/// that permission lookups are always type-safe.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ResourceRef {
    /// The kind of resource.
    pub resource_type: ResourceType,
    /// The unique identifier of the resource instance.
    pub resource_id: Uuid,
}

impl ResourceRef {
    /// Create a reference to a file resource.
    pub fn file(id: Uuid) -> Self {
        Self {
            resource_type: ResourceType::File,
            resource_id: id,
        }
    }

    /// Create a reference to a folder resource.
    pub fn folder(id: Uuid) -> Self {
        Self {
            resource_type: ResourceType::Folder,
            resource_id: id,
        }
    }

    /// Create a reference to a calendar resource.
    pub fn calendar(id: Uuid) -> Self {
        Self {
            resource_type: ResourceType::Calendar,
            resource_id: id,
        }
    }

    /// Create a reference to an event resource.
    pub fn event(id: Uuid) -> Self {
        Self {
            resource_type: ResourceType::Event,
            resource_id: id,
        }
    }

    /// Create a reference to a document resource.
    pub fn document(id: Uuid) -> Self {
        Self {
            resource_type: ResourceType::Document,
            resource_id: id,
        }
    }

    /// Create a reference to a form resource.
    pub fn form(id: Uuid) -> Self {
        Self {
            resource_type: ResourceType::Form,
            resource_id: id,
        }
    }

    /// Create a reference to a contact book resource.
    pub fn contact_book(id: Uuid) -> Self {
        Self {
            resource_type: ResourceType::ContactBook,
            resource_id: id,
        }
    }

    /// Create a reference to a channel resource.
    pub fn channel(id: Uuid) -> Self {
        Self {
            resource_type: ResourceType::Channel,
            resource_id: id,
        }
    }

    /// Create a reference to an asset resource.
    pub fn asset(id: Uuid) -> Self {
        Self {
            resource_type: ResourceType::Asset,
            resource_id: id,
        }
    }

    /// Create a reference to a vault entry resource.
    pub fn vault_entry(id: Uuid) -> Self {
        Self {
            resource_type: ResourceType::VaultEntry,
            resource_id: id,
        }
    }
}

impl fmt::Display for ResourceRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}:{}", self.resource_type, self.resource_id)
    }
}

// ─── Grantee ──────────────────────────────────────────────────────────────────

/// A principal that can hold a permission grant.
///
/// Covers the four grant axes supported by the sharing engine:
/// direct user, group membership, org-node ancestry, and the tenant-wide
/// `Everyone` grant.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "type", content = "id", rename_all = "snake_case")]
pub enum Grantee {
    /// A specific user, identified by their UUID.
    User(Uuid),
    /// A group, identified by its UUID.
    Group(Uuid),
    /// An organisational node, identified by its UUID.
    OrgNode(Uuid),
    /// Every authenticated user in the tenant (no UUID required).
    Everyone,
}

impl Grantee {
    /// Returns the [`GranteeType`] discriminator for this grantee.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_sharing::types::{Grantee, GranteeType};
    /// use uuid::Uuid;
    ///
    /// let g = Grantee::User(Uuid::new_v4());
    /// assert_eq!(g.grantee_type(), GranteeType::User);
    /// assert_eq!(Grantee::Everyone.grantee_type(), GranteeType::Everyone);
    /// ```
    pub fn grantee_type(&self) -> GranteeType {
        match self {
            Self::User(_) => GranteeType::User,
            Self::Group(_) => GranteeType::Group,
            Self::OrgNode(_) => GranteeType::OrgNode,
            Self::Everyone => GranteeType::Everyone,
        }
    }

    /// Returns the UUID of the grantee, or `None` for [`Grantee::Everyone`].
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_sharing::types::Grantee;
    /// use uuid::Uuid;
    ///
    /// let id = Uuid::new_v4();
    /// assert_eq!(Grantee::User(id).grantee_id(), Some(id));
    /// assert_eq!(Grantee::Everyone.grantee_id(), None);
    /// ```
    pub fn grantee_id(&self) -> Option<Uuid> {
        match self {
            Self::User(id) | Self::Group(id) | Self::OrgNode(id) => Some(*id),
            Self::Everyone => None,
        }
    }
}

impl fmt::Display for Grantee {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::User(id) => write!(f, "user:{id}"),
            Self::Group(id) => write!(f, "group:{id}"),
            Self::OrgNode(id) => write!(f, "org_node:{id}"),
            Self::Everyone => write!(f, "everyone"),
        }
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_ordering() {
        assert!(Role::Deny.level() < Role::Viewer.level());
        assert!(Role::Viewer.level() < Role::Editor.level());
        assert!(Role::Editor.level() < Role::Manager.level());
    }

    #[test]
    fn role_max_permissive() {
        assert_eq!(
            Role::max_permissive(Role::Viewer, Role::Editor),
            Role::Editor
        );
        assert_eq!(
            Role::max_permissive(Role::Manager, Role::Viewer),
            Role::Manager
        );
        assert_eq!(Role::max_permissive(Role::Deny, Role::Viewer), Role::Viewer);
        assert_eq!(
            Role::max_permissive(Role::Manager, Role::Deny),
            Role::Manager
        );
        assert_eq!(Role::max_permissive(Role::Deny, Role::Deny), Role::Deny);
    }

    #[test]
    fn resource_type_as_str() {
        assert_eq!(ResourceType::File.as_str(), "file");
        assert_eq!(ResourceType::Folder.as_str(), "folder");
        assert_eq!(ResourceType::Calendar.as_str(), "calendar");
        assert_eq!(ResourceType::Event.as_str(), "event");
        assert_eq!(ResourceType::Document.as_str(), "document");
        assert_eq!(ResourceType::Form.as_str(), "form");
        assert_eq!(ResourceType::ContactBook.as_str(), "contact_book");
        assert_eq!(ResourceType::Channel.as_str(), "channel");
        assert_eq!(ResourceType::Asset.as_str(), "asset");
        assert_eq!(ResourceType::VaultEntry.as_str(), "vault_entry");
    }

    #[test]
    fn resource_type_display_matches_as_str() {
        for rt in [
            ResourceType::File,
            ResourceType::Folder,
            ResourceType::Calendar,
            ResourceType::Event,
            ResourceType::Document,
            ResourceType::Form,
            ResourceType::ContactBook,
            ResourceType::Channel,
            ResourceType::Asset,
            ResourceType::VaultEntry,
        ] {
            assert_eq!(rt.to_string(), rt.as_str());
        }
    }

    #[test]
    fn resource_type_roundtrip_from_str() {
        use std::str::FromStr;
        for rt in [
            ResourceType::File,
            ResourceType::Folder,
            ResourceType::Calendar,
            ResourceType::Event,
            ResourceType::Document,
            ResourceType::Form,
            ResourceType::ContactBook,
            ResourceType::Channel,
            ResourceType::Asset,
            ResourceType::VaultEntry,
        ] {
            assert_eq!(ResourceType::from_str(rt.as_str()).unwrap(), rt);
        }
        assert!(ResourceType::from_str("unknown_xyz").is_err());
    }

    #[test]
    fn grantee_type() {
        let id = Uuid::new_v4();
        assert_eq!(Grantee::User(id).grantee_type(), GranteeType::User);
        assert_eq!(Grantee::Group(id).grantee_type(), GranteeType::Group);
        assert_eq!(Grantee::OrgNode(id).grantee_type(), GranteeType::OrgNode);
        assert_eq!(Grantee::Everyone.grantee_type(), GranteeType::Everyone);
    }

    #[test]
    fn grantee_id() {
        let id = Uuid::new_v4();
        assert_eq!(Grantee::User(id).grantee_id(), Some(id));
        assert_eq!(Grantee::Group(id).grantee_id(), Some(id));
        assert_eq!(Grantee::OrgNode(id).grantee_id(), Some(id));
        assert_eq!(Grantee::Everyone.grantee_id(), None);
    }

    #[test]
    fn resource_ref_constructors() {
        let id = Uuid::new_v4();
        assert_eq!(ResourceRef::file(id).resource_type, ResourceType::File);
        assert_eq!(ResourceRef::folder(id).resource_type, ResourceType::Folder);
        assert_eq!(
            ResourceRef::calendar(id).resource_type,
            ResourceType::Calendar
        );
        assert_eq!(ResourceRef::event(id).resource_type, ResourceType::Event);
        assert_eq!(
            ResourceRef::document(id).resource_type,
            ResourceType::Document
        );
        assert_eq!(ResourceRef::form(id).resource_type, ResourceType::Form);
        assert_eq!(
            ResourceRef::contact_book(id).resource_type,
            ResourceType::ContactBook
        );
        assert_eq!(
            ResourceRef::channel(id).resource_type,
            ResourceType::Channel
        );
        assert_eq!(ResourceRef::asset(id).resource_type, ResourceType::Asset);
        assert_eq!(
            ResourceRef::vault_entry(id).resource_type,
            ResourceType::VaultEntry
        );
        // All constructors should preserve the id
        assert_eq!(ResourceRef::file(id).resource_id, id);
    }

    #[test]
    fn action_constructors() {
        assert_eq!(Action::read().as_str(), "read");
        assert_eq!(Action::write().as_str(), "write");
        assert_eq!(Action::delete().as_str(), "delete");
        assert_eq!(Action::share().as_str(), "share");
        assert_eq!(Action::list().as_str(), "list");
        assert_eq!(Action::new("custom").as_str(), "custom");
    }

    #[test]
    fn role_from_str() {
        use std::str::FromStr;
        assert_eq!(Role::from_str("deny").unwrap(), Role::Deny);
        assert_eq!(Role::from_str("viewer").unwrap(), Role::Viewer);
        assert_eq!(Role::from_str("editor").unwrap(), Role::Editor);
        assert_eq!(Role::from_str("manager").unwrap(), Role::Manager);
        assert!(Role::from_str("superuser").is_err());
    }
}
