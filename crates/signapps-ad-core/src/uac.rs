//! userAccountControl bit flags (MS-ADTS §2.2.16).
//!
//! `UserAccountControl` is a bitmask stored in Active Directory that controls
//! account behaviour: disabled, locked, password policy, delegation, etc.

use serde::{Deserialize, Serialize};

/// Bitmask of Active Directory `userAccountControl` flags (MS-ADTS §2.2.16).
///
/// # Examples
///
/// ```
/// use signapps_ad_core::uac::UserAccountControl;
///
/// let mut uac = UserAccountControl::normal_user();
/// assert!(!uac.is_disabled());
/// uac.set(UserAccountControl::ACCOUNTDISABLE);
/// assert!(uac.is_disabled());
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct UserAccountControl(pub u32);

impl UserAccountControl {
    /// Account is disabled.
    pub const ACCOUNTDISABLE: u32 = 0x0002;
    /// Home directory is required.
    pub const HOMEDIR_REQUIRED: u32 = 0x0008;
    /// Account is locked out.
    pub const LOCKOUT: u32 = 0x0010;
    /// Password is not required.
    pub const PASSWD_NOTREQD: u32 = 0x0020;
    /// User cannot change their password (advisory; enforced via ACL in full AD).
    pub const PASSWD_CANT_CHANGE: u32 = 0x0040;
    /// Standard user account.
    pub const NORMAL_ACCOUNT: u32 = 0x0200;
    /// Workstation or member server computer account.
    pub const WORKSTATION_TRUST_ACCOUNT: u32 = 0x1000;
    /// Domain controller computer account.
    pub const SERVER_TRUST_ACCOUNT: u32 = 0x2000;
    /// Password does not expire.
    pub const DONT_EXPIRE_PASSWD: u32 = 0x0001_0000;
    /// Smart card is required for interactive logon.
    pub const SMARTCARD_REQUIRED: u32 = 0x0004_0000;
    /// Account is trusted for Kerberos delegation.
    pub const TRUSTED_FOR_DELEGATION: u32 = 0x0008_0000;
    /// Account cannot be delegated.
    pub const NOT_DELEGATED: u32 = 0x0010_0000;
    /// Account uses AES keys for Kerberos.
    pub const USE_AES_KEYS: u32 = 0x0020_0000;
    /// Kerberos pre-authentication is not required.
    pub const DONT_REQUIRE_PREAUTH: u32 = 0x0040_0000;
    /// Password has expired.
    pub const PASSWORD_EXPIRED: u32 = 0x0080_0000;
    /// Account is trusted to authenticate for delegation (S4U2Proxy).
    pub const TRUSTED_TO_AUTH_FOR_DELEGATION: u32 = 0x0100_0000;

    /// Creates a `UserAccountControl` for a normal (human) user account.
    ///
    /// Sets [`NORMAL_ACCOUNT`](Self::NORMAL_ACCOUNT).
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::uac::UserAccountControl;
    ///
    /// let uac = UserAccountControl::normal_user();
    /// assert!(uac.has(UserAccountControl::NORMAL_ACCOUNT));
    /// ```
    pub fn normal_user() -> Self {
        Self(Self::NORMAL_ACCOUNT)
    }

    /// Creates a `UserAccountControl` for a workstation or member-server computer account.
    ///
    /// Sets [`WORKSTATION_TRUST_ACCOUNT`](Self::WORKSTATION_TRUST_ACCOUNT).
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::uac::UserAccountControl;
    ///
    /// let uac = UserAccountControl::computer();
    /// assert!(uac.has(UserAccountControl::WORKSTATION_TRUST_ACCOUNT));
    /// ```
    pub fn computer() -> Self {
        Self(Self::WORKSTATION_TRUST_ACCOUNT)
    }

    /// Creates a `UserAccountControl` for a domain controller.
    ///
    /// Sets [`SERVER_TRUST_ACCOUNT`](Self::SERVER_TRUST_ACCOUNT) and
    /// [`TRUSTED_FOR_DELEGATION`](Self::TRUSTED_FOR_DELEGATION).
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::uac::UserAccountControl;
    ///
    /// let uac = UserAccountControl::domain_controller();
    /// assert!(uac.has(UserAccountControl::SERVER_TRUST_ACCOUNT));
    /// assert!(uac.has(UserAccountControl::TRUSTED_FOR_DELEGATION));
    /// ```
    pub fn domain_controller() -> Self {
        Self(Self::SERVER_TRUST_ACCOUNT | Self::TRUSTED_FOR_DELEGATION)
    }

    /// Returns `true` if all bits in `flag` are set.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::uac::UserAccountControl;
    ///
    /// let uac = UserAccountControl::normal_user();
    /// assert!(uac.has(UserAccountControl::NORMAL_ACCOUNT));
    /// assert!(!uac.has(UserAccountControl::ACCOUNTDISABLE));
    /// ```
    pub fn has(&self, flag: u32) -> bool {
        self.0 & flag == flag
    }

    /// Sets all bits in `flag`.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::uac::UserAccountControl;
    ///
    /// let mut uac = UserAccountControl::normal_user();
    /// uac.set(UserAccountControl::ACCOUNTDISABLE);
    /// assert!(uac.is_disabled());
    /// ```
    pub fn set(&mut self, flag: u32) {
        self.0 |= flag;
    }

    /// Clears all bits in `flag`.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::uac::UserAccountControl;
    ///
    /// let mut uac = UserAccountControl::normal_user();
    /// uac.set(UserAccountControl::ACCOUNTDISABLE);
    /// uac.clear(UserAccountControl::ACCOUNTDISABLE);
    /// assert!(!uac.is_disabled());
    /// ```
    pub fn clear(&mut self, flag: u32) {
        self.0 &= !flag;
    }

    /// Returns `true` if the account is disabled ([`ACCOUNTDISABLE`](Self::ACCOUNTDISABLE) is set).
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::uac::UserAccountControl;
    ///
    /// let uac = UserAccountControl::normal_user();
    /// assert!(!uac.is_disabled());
    /// ```
    pub fn is_disabled(&self) -> bool {
        self.has(Self::ACCOUNTDISABLE)
    }

    /// Returns `true` if the account is locked out ([`LOCKOUT`](Self::LOCKOUT) is set).
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::uac::UserAccountControl;
    ///
    /// let uac = UserAccountControl::normal_user();
    /// assert!(!uac.is_locked());
    /// ```
    pub fn is_locked(&self) -> bool {
        self.has(Self::LOCKOUT)
    }

    /// Returns `true` if Kerberos pre-authentication is required (default).
    ///
    /// Returns `false` when [`DONT_REQUIRE_PREAUTH`](Self::DONT_REQUIRE_PREAUTH) is set,
    /// which makes the account vulnerable to AS-REP roasting.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::uac::UserAccountControl;
    ///
    /// let uac = UserAccountControl::normal_user();
    /// assert!(uac.requires_preauth());
    /// ```
    pub fn requires_preauth(&self) -> bool {
        !self.has(Self::DONT_REQUIRE_PREAUTH)
    }

    /// Returns the raw `u32` bitmask value.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::uac::UserAccountControl;
    ///
    /// let uac = UserAccountControl::normal_user();
    /// assert_eq!(uac.value(), UserAccountControl::NORMAL_ACCOUNT);
    /// ```
    pub fn value(&self) -> u32 {
        self.0
    }
}

impl From<u32> for UserAccountControl {
    fn from(v: u32) -> Self {
        Self(v)
    }
}

impl From<UserAccountControl> for u32 {
    fn from(uac: UserAccountControl) -> u32 {
        uac.0
    }
}

#[cfg(test)]
mod tests {
    use super::UserAccountControl;

    #[test]
    fn normal_user_defaults() {
        let uac = UserAccountControl::normal_user();
        assert!(uac.has(UserAccountControl::NORMAL_ACCOUNT));
        assert!(!uac.is_disabled());
        assert!(!uac.is_locked());
        assert!(uac.requires_preauth());
    }

    #[test]
    fn computer_defaults() {
        let uac = UserAccountControl::computer();
        assert!(uac.has(UserAccountControl::WORKSTATION_TRUST_ACCOUNT));
        assert!(!uac.has(UserAccountControl::NORMAL_ACCOUNT));
    }

    #[test]
    fn set_and_clear_flags() {
        let mut uac = UserAccountControl::normal_user();
        assert!(!uac.is_disabled());

        uac.set(UserAccountControl::ACCOUNTDISABLE);
        assert!(uac.is_disabled());

        uac.clear(UserAccountControl::ACCOUNTDISABLE);
        assert!(!uac.is_disabled());
    }

    #[test]
    fn roundtrip_u32() {
        let raw: u32 = UserAccountControl::NORMAL_ACCOUNT | UserAccountControl::DONT_EXPIRE_PASSWD;
        let uac = UserAccountControl::from(raw);
        let back: u32 = uac.into();
        assert_eq!(raw, back);
    }

    #[test]
    fn preauth_flag() {
        let mut uac = UserAccountControl::normal_user();
        assert!(
            uac.requires_preauth(),
            "preauth should be required by default"
        );

        uac.set(UserAccountControl::DONT_REQUIRE_PREAUTH);
        assert!(
            !uac.requires_preauth(),
            "preauth should not be required after setting flag"
        );
    }
}
