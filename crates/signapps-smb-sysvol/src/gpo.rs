//! Group Policy Object (GPO) storage and management.
//!
//! GPOs are stored in SYSVOL as directory structures:
//! `{domain}/Policies/{GUID}/Machine/` and `{domain}/Policies/{GUID}/User/`
//! with a GPT.INI file at the root.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A Group Policy Object definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupPolicyObject {
    /// GPO GUID (formatted as {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}).
    pub id: Uuid,
    /// Display name (e.g., "Default Domain Policy").
    pub display_name: String,
    /// GPO version (incremented on changes).
    pub version: u32,
    /// Whether this GPO is enabled.
    pub enabled: bool,
    /// Machine-side configuration.
    pub machine_enabled: bool,
    /// User-side configuration.
    pub user_enabled: bool,
}

impl GroupPolicyObject {
    /// Format the GPO GUID as Windows expects it (with braces).
    pub fn guid_string(&self) -> String {
        format!("{{{}}}", self.id.to_string().to_uppercase())
    }

    /// The SYSVOL path for this GPO.
    pub fn sysvol_path(&self, domain: &str) -> String {
        format!("sysvol/{domain}/Policies/{}", self.guid_string())
    }

    /// Generate the GPT.INI content.
    ///
    /// GPT.INI is a simple INI file that Windows reads to determine
    /// the GPO version. Format:
    /// ```ini
    /// [General]
    /// Version=N
    /// displayName=Name
    /// ```
    pub fn gpt_ini(&self) -> String {
        format!(
            "[General]\r\nVersion={}\r\ndisplayName={}\r\n",
            self.version, self.display_name
        )
    }
}

/// The Default Domain Policy GPO (created with every new domain).
pub fn default_domain_policy() -> GroupPolicyObject {
    GroupPolicyObject {
        id: Uuid::parse_str("31B2F340-016D-11D2-945F-00C04FB984F9").expect("known GUID"),
        display_name: "Default Domain Policy".to_string(),
        version: 1,
        enabled: true,
        machine_enabled: true,
        user_enabled: true,
    }
}

/// The Default Domain Controllers Policy GPO.
pub fn default_dc_policy() -> GroupPolicyObject {
    GroupPolicyObject {
        id: Uuid::parse_str("6AC1786C-016F-11D2-945F-00C04FB984F9").expect("known GUID"),
        display_name: "Default Domain Controllers Policy".to_string(),
        version: 1,
        enabled: true,
        machine_enabled: true,
        user_enabled: true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guid_format() {
        let gpo = default_domain_policy();
        let guid = gpo.guid_string();
        assert!(guid.starts_with('{'));
        assert!(guid.ends_with('}'));
        assert_eq!(guid, "{31B2F340-016D-11D2-945F-00C04FB984F9}");
    }

    #[test]
    fn sysvol_path() {
        let gpo = default_domain_policy();
        let path = gpo.sysvol_path("example.com");
        assert_eq!(path, "sysvol/example.com/Policies/{31B2F340-016D-11D2-945F-00C04FB984F9}");
    }

    #[test]
    fn gpt_ini_content() {
        let gpo = default_domain_policy();
        let ini = gpo.gpt_ini();
        assert!(ini.contains("[General]"));
        assert!(ini.contains("Version=1"));
        assert!(ini.contains("displayName=Default Domain Policy"));
        // Windows uses CRLF
        assert!(ini.contains("\r\n"));
    }

    #[test]
    fn default_policies_exist() {
        let ddp = default_domain_policy();
        let dcp = default_dc_policy();
        assert_ne!(ddp.id, dcp.id);
        assert!(ddp.enabled);
        assert!(dcp.enabled);
    }
}
