//! SYSVOL and NETLOGON share management.
//!
//! SYSVOL contains Group Policy objects and login scripts.
//! NETLOGON contains login scripts (subset of SYSVOL).

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// An SMB share definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmbShare {
    /// Share name (e.g., "SYSVOL", "NETLOGON").
    pub name: String,
    /// Local filesystem path or storage URI.
    pub path: PathBuf,
    /// Whether the share is read-only.
    pub read_only: bool,
    /// Description.
    pub description: String,
}

/// Default SYSVOL share for an AD domain.
pub fn sysvol_share(domain: &str, storage_root: &str) -> SmbShare {
    SmbShare {
        name: "SYSVOL".to_string(),
        path: PathBuf::from(format!("{storage_root}/sysvol/{domain}")),
        read_only: false,
        description: format!("Logon server share for {domain}"),
    }
}

/// Default NETLOGON share (symlink into SYSVOL).
pub fn netlogon_share(domain: &str, storage_root: &str) -> SmbShare {
    SmbShare {
        name: "NETLOGON".to_string(),
        path: PathBuf::from(format!("{storage_root}/sysvol/{domain}/scripts")),
        read_only: true,
        description: "Logon scripts".to_string(),
    }
}

/// SYSVOL directory structure for a domain.
///
/// Creates the standard directory layout:
/// ```text
/// sysvol/{domain}/
///   Policies/
///     {GUID}/
///       Machine/
///       User/
///       GPT.INI
///   scripts/
/// ```
pub fn sysvol_directories(domain: &str) -> Vec<String> {
    vec![
        format!("sysvol/{domain}"),
        format!("sysvol/{domain}/Policies"),
        format!("sysvol/{domain}/scripts"),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sysvol_share_path() {
        let share = sysvol_share("example.com", "/data/storage");
        assert_eq!(share.name, "SYSVOL");
        assert_eq!(
            share.path.to_str().unwrap(),
            "/data/storage/sysvol/example.com"
        );
        assert!(!share.read_only);
    }

    #[test]
    fn netlogon_share_readonly() {
        let share = netlogon_share("example.com", "/data/storage");
        assert_eq!(share.name, "NETLOGON");
        assert!(share.read_only);
    }

    #[test]
    fn sysvol_directory_structure() {
        let dirs = sysvol_directories("example.com");
        assert_eq!(dirs.len(), 3);
        assert!(dirs[0].contains("example.com"));
        assert!(dirs[1].contains("Policies"));
        assert!(dirs[2].contains("scripts"));
    }
}
