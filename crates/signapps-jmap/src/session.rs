//! JMAP Session resource (RFC 8620 Section 2).
//!
//! The Session object is the entry point for a JMAP client. It advertises
//! the server's capabilities, lists accounts, and provides endpoint URLs
//! for API, upload, download, and event-source operations.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A JMAP account descriptor within the session.
///
/// Each account has a human-readable name, read-only status, and a set of
/// capabilities with per-account configuration.
///
/// # Examples
///
/// ```
/// use signapps_jmap::session::JmapAccount;
/// use std::collections::HashMap;
///
/// let account = JmapAccount {
///     name: "user@example.com".to_string(),
///     is_personal: true,
///     is_read_only: false,
///     account_capabilities: HashMap::new(),
/// };
/// assert!(account.is_personal);
/// ```
///
/// # Panics
///
/// None.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JmapAccount {
    /// Human-readable account name (usually the email address).
    pub name: String,

    /// Whether this is a personal account (as opposed to shared/delegated).
    #[serde(rename = "isPersonal")]
    pub is_personal: bool,

    /// Whether the account is read-only.
    #[serde(rename = "isReadOnly")]
    pub is_read_only: bool,

    /// Per-account capability configuration objects.
    #[serde(rename = "accountCapabilities")]
    pub account_capabilities: HashMap<String, serde_json::Value>,
}

/// The JMAP Session resource (RFC 8620 Section 2).
///
/// Returned by `GET /.well-known/jmap`. It describes the server's capabilities,
/// available accounts, endpoint URLs, and current session state.
///
/// # Examples
///
/// ```
/// use signapps_jmap::session::{JmapSession, JmapAccount};
/// use std::collections::HashMap;
///
/// let session = JmapSession::new(
///     "user@example.com".to_string(),
///     "https://mail.example.com/jmap".to_string(),
/// );
/// assert_eq!(session.username, "user@example.com");
/// assert!(!session.api_url.is_empty());
/// ```
///
/// # Panics
///
/// None.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JmapSession {
    /// Server-level capabilities and their configuration.
    pub capabilities: HashMap<String, serde_json::Value>,

    /// Map of account ID -> account descriptor.
    pub accounts: HashMap<String, JmapAccount>,

    /// Map of capability URI -> primary account ID for that capability.
    #[serde(rename = "primaryAccounts")]
    pub primary_accounts: HashMap<String, String>,

    /// Authenticated username (usually the email address).
    pub username: String,

    /// URL for JMAP API requests (`POST`).
    #[serde(rename = "apiUrl")]
    pub api_url: String,

    /// URL template for blob uploads.
    #[serde(rename = "uploadUrl")]
    pub upload_url: String,

    /// URL template for blob downloads.
    #[serde(rename = "downloadUrl")]
    pub download_url: String,

    /// URL template for server-sent event streams.
    #[serde(rename = "eventSourceUrl")]
    pub event_source_url: String,

    /// Opaque string representing the current session state.
    pub state: String,
}

impl JmapSession {
    /// Create a new session with default capabilities and endpoint URL templates.
    ///
    /// The caller should add accounts via [`JmapSession::add_account`] after
    /// construction.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_jmap::session::JmapSession;
    ///
    /// let session = JmapSession::new(
    ///     "user@example.com".to_string(),
    ///     "https://mail.example.com".to_string(),
    /// );
    /// assert!(session.capabilities.contains_key("urn:ietf:params:jmap:core"));
    /// ```
    pub fn new(username: String, base_url: String) -> Self {
        let mut capabilities = HashMap::new();

        // Core capability (RFC 8620 Section 2)
        capabilities.insert(
            "urn:ietf:params:jmap:core".to_string(),
            serde_json::json!({
                "maxSizeUpload": 50_000_000_i64,
                "maxConcurrentUpload": 4,
                "maxSizeRequest": 10_000_000_i64,
                "maxConcurrentRequests": 4,
                "maxCallsInRequest": 16,
                "maxObjectsInGet": 500,
                "maxObjectsInSet": 500,
                "collationAlgorithms": ["i;ascii-casemap", "i;unicode-casemap"]
            }),
        );

        // Mail capability (RFC 8621)
        capabilities.insert(
            "urn:ietf:params:jmap:mail".to_string(),
            serde_json::json!({
                "maxMailboxesPerEmail": null,
                "maxMailboxDepth": null,
                "maxSizeMailboxName": 256,
                "maxSizeAttachmentsPerEmail": 50_000_000_i64,
                "emailQuerySortOptions": [
                    "receivedAt", "sentAt", "from", "to", "subject", "size"
                ],
                "mayCreateTopLevelMailbox": true
            }),
        );

        // Submission capability
        capabilities.insert(
            "urn:ietf:params:jmap:submission".to_string(),
            serde_json::json!({}),
        );

        let state = uuid::Uuid::new_v4().to_string();

        Self {
            capabilities,
            accounts: HashMap::new(),
            primary_accounts: HashMap::new(),
            username,
            api_url: format!("{base_url}/jmap"),
            upload_url: format!("{base_url}/jmap/upload/{{accountId}}"),
            download_url: format!(
                "{base_url}/jmap/download/{{accountId}}/{{blobId}}/{{name}}"
            ),
            event_source_url: format!(
                "{base_url}/jmap/eventsource?types={{types}}&closeafter={{closeafter}}&ping={{ping}}"
            ),
            state,
        }
    }

    /// Add an account to this session and optionally set it as the primary
    /// account for the given capabilities.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_jmap::session::{JmapSession, JmapAccount};
    /// use std::collections::HashMap;
    ///
    /// let mut session = JmapSession::new("user@example.com".into(), "https://x.com".into());
    /// let account = JmapAccount {
    ///     name: "user@example.com".to_string(),
    ///     is_personal: true,
    ///     is_read_only: false,
    ///     account_capabilities: HashMap::new(),
    /// };
    /// session.add_account("acc-1", account, true);
    /// assert!(session.accounts.contains_key("acc-1"));
    /// ```
    pub fn add_account(
        &mut self,
        account_id: impl Into<String>,
        account: JmapAccount,
        is_primary: bool,
    ) {
        let id = account_id.into();
        if is_primary {
            for cap_uri in self.capabilities.keys() {
                self.primary_accounts.insert(cap_uri.clone(), id.clone());
            }
        }
        self.accounts.insert(id, account);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_construction_and_serialization() {
        let mut session = JmapSession::new(
            "alice@example.com".to_string(),
            "https://jmap.example.com".to_string(),
        );

        let mut account_caps = HashMap::new();
        account_caps.insert(
            "urn:ietf:params:jmap:mail".to_string(),
            serde_json::json!({}),
        );

        let account = JmapAccount {
            name: "alice@example.com".to_string(),
            is_personal: true,
            is_read_only: false,
            account_capabilities: account_caps,
        };

        session.add_account("u1", account, true);

        // Verify structure
        assert_eq!(session.username, "alice@example.com");
        assert!(session
            .capabilities
            .contains_key("urn:ietf:params:jmap:core"));
        assert!(session
            .capabilities
            .contains_key("urn:ietf:params:jmap:mail"));
        assert!(session.accounts.contains_key("u1"));
        assert_eq!(
            session.primary_accounts.get("urn:ietf:params:jmap:mail"),
            Some(&"u1".to_string())
        );

        // Verify JSON serialization
        let json = serde_json::to_value(&session).expect("serialize");
        assert_eq!(json["username"], "alice@example.com");
        assert!(json["apiUrl"].as_str().unwrap().contains("/jmap"));
        assert!(json["uploadUrl"].as_str().unwrap().contains("{accountId}"));
    }

    #[test]
    fn session_round_trip() {
        let session = JmapSession::new(
            "bob@test.com".to_string(),
            "https://mail.test.com".to_string(),
        );
        let json = serde_json::to_string(&session).expect("serialize");
        let session2: JmapSession = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(session2.username, "bob@test.com");
        assert_eq!(session2.api_url, "https://mail.test.com/jmap");
    }
}
