//! Privilege Attribute Certificate (MS-PAC) for Windows.
//!
//! The PAC is embedded in Kerberos tickets and contains the user's
//! security identity: SIDs, group memberships, domain info. Windows
//! uses this to determine authorization without querying LDAP.

use serde::{Deserialize, Serialize};
use signapps_ad_core::SecurityIdentifier;

/// A group membership entry in the PAC.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMembership {
    /// Relative ID of the group.
    pub rid: u32,
    /// Attributes (SE_GROUP_MANDATORY | SE_GROUP_ENABLED = 7).
    pub attributes: u32,
}

impl GroupMembership {
    /// Default attributes for a mandatory, enabled group.
    ///
    /// Sets `SE_GROUP_MANDATORY | SE_GROUP_ENABLED_BY_DEFAULT | SE_GROUP_ENABLED` (0x07).
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_kerberos_kdc::pac::GroupMembership;
    ///
    /// let gm = GroupMembership::default_attrs(512);
    /// assert_eq!(gm.rid, 512);
    /// assert_eq!(gm.attributes, 0x07);
    /// ```
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    pub fn default_attrs(rid: u32) -> Self {
        Self {
            rid,
            attributes: 0x07, // SE_GROUP_MANDATORY | SE_GROUP_ENABLED_BY_DEFAULT | SE_GROUP_ENABLED
        }
    }
}

/// SID with attributes (for extra SIDs like universal groups).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidAndAttributes {
    /// The security identifier.
    pub sid: SecurityIdentifier,
    /// Group attributes flags.
    pub attributes: u32,
}

/// The KERB_VALIDATION_INFO structure (MS-PAC §2.5).
///
/// Contains the user's logon information extracted from PostgreSQL.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KerbValidationInfo {
    /// When the user last logged on (Unix timestamp).
    pub logon_time: i64,
    /// sAMAccountName.
    pub effective_name: String,
    /// displayName.
    pub full_name: String,
    /// User RID (last component of user SID).
    pub user_id: u32,
    /// Primary group RID (default: 513 = Domain Users).
    pub primary_group_id: u32,
    /// Group memberships (RIDs relative to domain SID).
    pub group_ids: Vec<GroupMembership>,
    /// Logon flags.
    pub user_flags: u32,
    /// Name of the DC that authenticated the user.
    pub logon_server: String,
    /// NetBIOS domain name.
    pub logon_domain_name: String,
    /// Domain SID.
    pub logon_domain_id: SecurityIdentifier,
    /// Extra SIDs (universal groups, well-known SIDs).
    pub extra_sids: Vec<SidAndAttributes>,
}

/// PAC signature type.
#[derive(Debug, Clone)]
pub struct PacSignature {
    /// Signature type (HMAC_MD5 = 0xFFFFFF76, HMAC_SHA1_96_AES256 = 16).
    pub sig_type: i32,
    /// Signature bytes.
    pub signature: Vec<u8>,
}

/// The complete PAC structure.
///
/// Bundles the validation info with UPN and DNS domain for embedding in
/// a Kerberos ticket.
///
/// # Examples
///
/// ```
/// use signapps_ad_core::SecurityIdentifier;
/// use signapps_kerberos_kdc::pac::Pac;
///
/// let domain_sid = SecurityIdentifier::parse("S-1-5-21-100-200-300").unwrap();
/// let pac = Pac::build(
///     "admin", "Domain Admin", 1000, &[512, 513],
///     &domain_sid, "EXAMPLE", "DC01",
///     "admin@example.com", "example.com",
/// );
/// assert_eq!(pac.logon_info.effective_name, "admin");
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pac {
    /// User logon information.
    pub logon_info: KerbValidationInfo,
    /// UPN (user@domain.com).
    pub upn: String,
    /// DNS domain name.
    pub dns_domain: String,
}

impl Pac {
    /// Build a PAC from database information.
    ///
    /// # Arguments
    ///
    /// - `username`: sAMAccountName
    /// - `display_name`: Full display name
    /// - `user_rid`: User's RID (from SID)
    /// - `group_rids`: RIDs of groups the user belongs to
    /// - `domain_sid`: The domain's SID
    /// - `domain_name`: NetBIOS domain name (e.g., "EXAMPLE")
    /// - `dc_name`: Domain controller name
    /// - `upn`: userPrincipalName (e.g., "admin@example.com")
    /// - `dns_domain`: DNS domain (e.g., "example.com")
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::SecurityIdentifier;
    /// use signapps_kerberos_kdc::pac::Pac;
    ///
    /// let domain_sid = SecurityIdentifier::parse("S-1-5-21-100-200-300").unwrap();
    /// let pac = Pac::build(
    ///     "jdoe", "John Doe", 1001, &[513],
    ///     &domain_sid, "CORP", "DC01",
    ///     "jdoe@corp.local", "corp.local",
    /// );
    /// assert_eq!(pac.logon_info.primary_group_id, 513);
    /// assert_eq!(pac.dns_domain, "corp.local");
    /// ```
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[allow(clippy::too_many_arguments)]
    pub fn build(
        username: &str,
        display_name: &str,
        user_rid: u32,
        group_rids: &[u32],
        domain_sid: &SecurityIdentifier,
        domain_name: &str,
        dc_name: &str,
        upn: &str,
        dns_domain: &str,
    ) -> Self {
        let group_ids: Vec<GroupMembership> = group_rids
            .iter()
            .map(|&rid| GroupMembership::default_attrs(rid))
            .collect();

        Self {
            logon_info: KerbValidationInfo {
                logon_time: chrono::Utc::now().timestamp(),
                effective_name: username.to_string(),
                full_name: display_name.to_string(),
                user_id: user_rid,
                primary_group_id: 513, // Domain Users
                group_ids,
                user_flags: 0,
                logon_server: dc_name.to_string(),
                logon_domain_name: domain_name.to_string(),
                logon_domain_id: domain_sid.clone(),
                extra_sids: vec![],
            },
            upn: upn.to_string(),
            dns_domain: dns_domain.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_pac() {
        let domain_sid = SecurityIdentifier::parse("S-1-5-21-100-200-300").unwrap();
        let pac = Pac::build(
            "admin",
            "Domain Admin",
            1000,
            &[512, 513, 519],
            &domain_sid,
            "EXAMPLE",
            "DC01",
            "admin@example.com",
            "example.com",
        );
        assert_eq!(pac.logon_info.effective_name, "admin");
        assert_eq!(pac.logon_info.user_id, 1000);
        assert_eq!(pac.logon_info.group_ids.len(), 3);
        assert_eq!(pac.logon_info.primary_group_id, 513);
        assert_eq!(pac.dns_domain, "example.com");
    }

    #[test]
    fn group_membership_attrs() {
        let gm = GroupMembership::default_attrs(512);
        assert_eq!(gm.rid, 512);
        assert_eq!(gm.attributes, 0x07);
    }

    #[test]
    fn pac_domain_sid() {
        let domain_sid = SecurityIdentifier::parse("S-1-5-21-100-200-300").unwrap();
        let pac = Pac::build(
            "user",
            "User",
            1001,
            &[],
            &domain_sid,
            "EX",
            "DC",
            "u@ex.com",
            "ex.com",
        );
        assert_eq!(
            pac.logon_info.logon_domain_id.to_string(),
            "S-1-5-21-100-200-300"
        );
    }
}
