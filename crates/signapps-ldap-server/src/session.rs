//! LDAP session state management.

use std::net::SocketAddr;
use std::time::Instant;

use uuid::Uuid;

use signapps_ad_core::DistinguishedName;

/// Authentication method used for this session.
#[derive(Debug, Clone, PartialEq)]
pub enum AuthMethod {
    /// Not yet authenticated.
    Anonymous,
    /// Simple bind (DN + password).
    Simple,
    /// SASL/GSSAPI (Kerberos ticket).
    SaslGssapi,
    /// SASL/EXTERNAL (TLS client certificate).
    SaslExternal,
}

/// State for a single LDAP connection.
#[derive(Debug)]
pub struct LdapSession {
    /// Unique session identifier.
    pub id: Uuid,
    /// Bound DN (None = anonymous).
    pub bound_dn: Option<DistinguishedName>,
    /// Bound user ID in the database.
    pub bound_user_id: Option<Uuid>,
    /// User role (1=user, 2=admin, 3=superadmin).
    pub user_role: i16,
    /// How the user authenticated.
    pub auth_method: AuthMethod,
    /// Whether the connection is TLS-secured.
    pub is_tls: bool,
    /// Set to `true` by the Extended handler after a successful StartTLS response.
    ///
    /// The connection loop in `handle_connection` checks this flag after each
    /// message and performs the TLS handshake before processing further messages.
    pub start_tls_pending: bool,
    /// Remote peer address.
    pub remote_addr: SocketAddr,
    /// When the connection was established.
    pub connected_at: Instant,
    /// Next expected message ID.
    pub last_message_id: i32,
}

impl LdapSession {
    /// Create a new anonymous session.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::net::SocketAddr;
    /// use signapps_ldap_server::session::LdapSession;
    ///
    /// let addr: SocketAddr = "127.0.0.1:1234".parse().unwrap();
    /// let session = LdapSession::new(addr, false);
    /// assert!(!session.is_authenticated());
    /// ```
    pub fn new(remote_addr: SocketAddr, is_tls: bool) -> Self {
        Self {
            id: Uuid::new_v4(),
            bound_dn: None,
            bound_user_id: None,
            user_role: 0,
            auth_method: AuthMethod::Anonymous,
            is_tls,
            start_tls_pending: false,
            remote_addr,
            connected_at: Instant::now(),
            last_message_id: 0,
        }
    }

    /// Whether the session is authenticated (not anonymous).
    ///
    /// # Examples
    ///
    /// ```
    /// use std::net::SocketAddr;
    /// use signapps_ldap_server::session::LdapSession;
    ///
    /// let addr: SocketAddr = "127.0.0.1:1234".parse().unwrap();
    /// let session = LdapSession::new(addr, false);
    /// assert!(!session.is_authenticated());
    /// ```
    pub fn is_authenticated(&self) -> bool {
        self.auth_method != AuthMethod::Anonymous
    }

    /// Bind the session to a user.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::net::SocketAddr;
    /// use uuid::Uuid;
    /// use signapps_ad_core::DistinguishedName;
    /// use signapps_ldap_server::session::{AuthMethod, LdapSession};
    ///
    /// let addr: SocketAddr = "127.0.0.1:1234".parse().unwrap();
    /// let mut session = LdapSession::new(addr, false);
    /// let dn = DistinguishedName::parse("CN=Alice,DC=example,DC=com").unwrap();
    /// let uid = Uuid::new_v4();
    /// session.bind(dn, uid, 1, AuthMethod::Simple);
    /// assert!(session.is_authenticated());
    /// ```
    ///
    /// # Errors
    ///
    /// This method is infallible; it always succeeds.
    ///
    /// # Panics
    ///
    /// No panics possible.
    pub fn bind(&mut self, dn: DistinguishedName, user_id: Uuid, role: i16, method: AuthMethod) {
        self.bound_dn = Some(dn);
        self.bound_user_id = Some(user_id);
        self.user_role = role;
        self.auth_method = method;
    }

    /// Unbind (reset to anonymous).
    ///
    /// # Examples
    ///
    /// ```
    /// use std::net::SocketAddr;
    /// use uuid::Uuid;
    /// use signapps_ad_core::DistinguishedName;
    /// use signapps_ldap_server::session::{AuthMethod, LdapSession};
    ///
    /// let addr: SocketAddr = "127.0.0.1:1234".parse().unwrap();
    /// let mut session = LdapSession::new(addr, false);
    /// let dn = DistinguishedName::parse("CN=Alice,DC=example,DC=com").unwrap();
    /// session.bind(dn, Uuid::new_v4(), 1, AuthMethod::Simple);
    /// session.unbind();
    /// assert!(!session.is_authenticated());
    /// ```
    ///
    /// # Panics
    ///
    /// No panics possible.
    pub fn unbind(&mut self) {
        self.bound_dn = None;
        self.bound_user_id = None;
        self.user_role = 0;
        self.auth_method = AuthMethod::Anonymous;
    }
}

#[cfg(test)]
mod tests {
    use std::net::SocketAddr;

    use uuid::Uuid;

    use signapps_ad_core::DistinguishedName;

    use super::{AuthMethod, LdapSession};

    fn test_addr() -> SocketAddr {
        "127.0.0.1:5555".parse().expect("valid addr")
    }

    #[test]
    fn new_session_is_anonymous() {
        let session = LdapSession::new(test_addr(), false);

        assert_eq!(session.auth_method, AuthMethod::Anonymous);
        assert!(session.bound_dn.is_none());
        assert!(session.bound_user_id.is_none());
        assert_eq!(session.user_role, 0);
        assert!(!session.is_authenticated());
    }

    #[test]
    fn bind_sets_state() {
        let mut session = LdapSession::new(test_addr(), false);
        let dn = DistinguishedName::parse("CN=Alice,DC=example,DC=com").expect("valid DN");
        let uid = Uuid::new_v4();

        session.bind(dn.clone(), uid, 1, AuthMethod::Simple);

        assert!(session.is_authenticated());
        assert_eq!(session.auth_method, AuthMethod::Simple);
        assert_eq!(
            session.bound_dn.as_ref().unwrap().to_string(),
            dn.to_string()
        );
        assert_eq!(session.bound_user_id, Some(uid));
        assert_eq!(session.user_role, 1);
    }

    #[test]
    fn unbind_resets_state() {
        let mut session = LdapSession::new(test_addr(), true);
        let dn = DistinguishedName::parse("CN=Bob,DC=corp,DC=local").expect("valid DN");

        session.bind(dn, Uuid::new_v4(), 2, AuthMethod::SaslGssapi);
        assert!(session.is_authenticated());

        session.unbind();

        assert!(!session.is_authenticated());
        assert_eq!(session.auth_method, AuthMethod::Anonymous);
        assert!(session.bound_dn.is_none());
        assert!(session.bound_user_id.is_none());
        assert_eq!(session.user_role, 0);
    }
}
