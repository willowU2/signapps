//! Default visibility values per resource type.
//!
//! [`system_default_visibility`] returns the built-in visibility string for a
//! resource type.  Services use this when bootstrapping a new resource before
//! any tenant-specific default has been configured in `sharing.default_visibility`.
//!
//! | Value        | Meaning                                          |
//! |--------------|--------------------------------------------------|
//! | `"private"`  | Only the owner has access by default.            |
//! | `"workspace"` | All members of the owning workspace can read.   |
//! | `"org_node"` | All members of the owning org-node can read.     |

use crate::types::ResourceType;

/// Return the system-level default visibility string for a resource type.
///
/// This is used as a fallback when no tenant-specific default has been
/// configured in `sharing.default_visibility`.
///
/// # Examples
///
/// ```
/// use signapps_sharing::defaults::system_default_visibility;
/// use signapps_sharing::types::ResourceType;
///
/// assert_eq!(system_default_visibility(ResourceType::File), "private");
/// assert_eq!(system_default_visibility(ResourceType::Calendar), "workspace");
/// assert_eq!(system_default_visibility(ResourceType::Asset), "org_node");
/// ```
///
/// # Panics
///
/// No panics.
pub fn system_default_visibility(resource_type: ResourceType) -> &'static str {
    match resource_type {
        // Private by default — sensitive or user-scoped resources.
        ResourceType::File
        | ResourceType::Folder
        | ResourceType::Document
        | ResourceType::Form
        | ResourceType::ContactBook
        | ResourceType::VaultEntry => "private",

        // Workspace-visible by default — collaborative resources.
        ResourceType::Calendar | ResourceType::Event | ResourceType::Channel => "workspace",

        // Org-node visible by default — IT infrastructure resources.
        ResourceType::Asset => "org_node",
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ResourceType;

    #[test]
    fn file_defaults_private() {
        assert_eq!(system_default_visibility(ResourceType::File), "private");
    }

    #[test]
    fn folder_defaults_private() {
        assert_eq!(system_default_visibility(ResourceType::Folder), "private");
    }

    #[test]
    fn document_defaults_private() {
        assert_eq!(system_default_visibility(ResourceType::Document), "private");
    }

    #[test]
    fn form_defaults_private() {
        assert_eq!(system_default_visibility(ResourceType::Form), "private");
    }

    #[test]
    fn contact_book_defaults_private() {
        assert_eq!(system_default_visibility(ResourceType::ContactBook), "private");
    }

    #[test]
    fn vault_entry_defaults_private() {
        assert_eq!(system_default_visibility(ResourceType::VaultEntry), "private");
    }

    #[test]
    fn calendar_defaults_workspace() {
        assert_eq!(system_default_visibility(ResourceType::Calendar), "workspace");
    }

    #[test]
    fn event_defaults_workspace() {
        assert_eq!(system_default_visibility(ResourceType::Event), "workspace");
    }

    #[test]
    fn channel_defaults_workspace() {
        assert_eq!(system_default_visibility(ResourceType::Channel), "workspace");
    }

    #[test]
    fn asset_defaults_org_node() {
        assert_eq!(system_default_visibility(ResourceType::Asset), "org_node");
    }

    #[test]
    fn all_resource_types_covered() {
        // Ensure every variant returns a non-empty string (no panic).
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
            let v = system_default_visibility(rt);
            assert!(!v.is_empty(), "empty visibility for {rt}");
        }
    }
}
