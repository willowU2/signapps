//! IMAP session state machine.
//!
//! Tracks the connection lifecycle through [`ImapState`] transitions
//! (NotAuthenticated -> Authenticated -> Selected) and validates that
//! commands are only accepted in the correct state.
//!
//! The session does **not** perform I/O or database queries — it only
//! validates state transitions and generates protocol-level responses.
//! Actual data retrieval is handled by the server layer.
//!
//! # Examples
//!
//! ```
//! use signapps_imap::session::ImapSession;
//! use signapps_imap::parser::parse_command;
//!
//! let mut session = ImapSession::new();
//! let cmd = parse_command("a001 CAPABILITY\r\n").unwrap();
//! let responses = session.process(&cmd);
//! assert!(!responses.is_empty());
//! ```

use crate::parser::{ImapCommand, ImapCommandType};
use crate::response::{capability_response, ImapResponse};

/// The current state of an IMAP session.
///
/// Determines which commands are valid at any point in the connection.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ImapState {
    /// Initial state before authentication.
    NotAuthenticated,
    /// After successful LOGIN/AUTHENTICATE, before SELECT/EXAMINE.
    Authenticated,
    /// A mailbox is selected for operations.
    Selected {
        /// Name of the selected mailbox.
        mailbox: String,
        /// Whether the mailbox was opened read-only (EXAMINE).
        readonly: bool,
    },
}

/// IMAP session state machine.
///
/// Tracks connection state, supported capabilities, and validates
/// commands against the current state. Does not perform I/O.
///
/// # Examples
///
/// ```
/// use signapps_imap::session::{ImapSession, ImapState};
///
/// let session = ImapSession::new();
/// assert_eq!(session.state(), &ImapState::NotAuthenticated);
/// ```
pub struct ImapSession {
    state: ImapState,
    capabilities: Vec<String>,
}

impl ImapSession {
    /// Create a new session in the `NotAuthenticated` state.
    ///
    /// Initializes with IMAP4rev2 capabilities: IDLE, NAMESPACE, ID,
    /// SPECIAL-USE, CONDSTORE, MOVE, LITERAL+.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_imap::session::ImapSession;
    ///
    /// let session = ImapSession::new();
    /// assert!(session.capabilities().contains(&"IMAP4rev2".to_string()));
    /// ```
    ///
    /// # Panics
    ///
    /// This function does not panic.
    pub fn new() -> Self {
        Self {
            state: ImapState::NotAuthenticated,
            capabilities: vec![
                "IMAP4rev2".to_string(),
                "IMAP4rev1".to_string(),
                "AUTH=PLAIN".to_string(),
                "AUTH=XOAUTH2".to_string(),
                "IDLE".to_string(),
                "NAMESPACE".to_string(),
                "ID".to_string(),
                "SPECIAL-USE".to_string(),
                "CONDSTORE".to_string(),
                "MOVE".to_string(),
                "LITERAL+".to_string(),
                "ENABLE".to_string(),
                "UNSELECT".to_string(),
            ],
        }
    }

    /// Returns the current session state.
    pub fn state(&self) -> &ImapState {
        &self.state
    }

    /// Returns the list of advertised capabilities.
    pub fn capabilities(&self) -> &[String] {
        &self.capabilities
    }

    /// Transition the session to the `Authenticated` state.
    ///
    /// Called by the server layer after successful credential verification.
    pub fn set_authenticated(&mut self) {
        self.state = ImapState::Authenticated;
    }

    /// Transition the session to the `Selected` state.
    ///
    /// Called by the server layer after a successful SELECT or EXAMINE.
    pub fn set_selected(&mut self, mailbox: String, readonly: bool) {
        self.state = ImapState::Selected { mailbox, readonly };
    }

    /// Transition back to the `Authenticated` state (CLOSE / UNSELECT).
    pub fn set_deselected(&mut self) {
        self.state = ImapState::Authenticated;
    }

    /// Process a parsed IMAP command and return protocol-level responses.
    ///
    /// This method validates state transitions and generates responses for
    /// commands that the session can handle purely at the protocol level
    /// (CAPABILITY, LOGOUT, NOOP). For data commands (FETCH, SEARCH, etc.),
    /// it returns either a state-validation error or an empty response list
    /// indicating the server layer should handle the command.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_imap::session::ImapSession;
    /// use signapps_imap::parser::parse_command;
    /// use signapps_imap::response::ImapResponse;
    ///
    /// let mut session = ImapSession::new();
    /// let cmd = parse_command("a001 CAPABILITY\r\n").unwrap();
    /// let responses = session.process(&cmd);
    /// assert!(responses.len() >= 2); // * CAPABILITY ... + tag OK
    /// ```
    ///
    /// # Panics
    ///
    /// This function does not panic.
    pub fn process(&mut self, cmd: &ImapCommand) -> Vec<ImapResponse> {
        let tag = &cmd.tag;

        match &cmd.command {
            // ── Any-state commands ─────────────────────────────────────────
            ImapCommandType::Capability => {
                vec![
                    capability_response(&self.capabilities),
                    ImapResponse::Tagged(tag.clone(), "OK CAPABILITY completed".to_string()),
                ]
            },

            ImapCommandType::Noop => {
                vec![ImapResponse::Tagged(
                    tag.clone(),
                    "OK NOOP completed".to_string(),
                )]
            },

            ImapCommandType::Logout => {
                vec![
                    ImapResponse::Untagged("BYE signapps closing connection".to_string()),
                    ImapResponse::Tagged(tag.clone(), "OK LOGOUT completed".to_string()),
                ]
            },

            ImapCommandType::Id { .. } => {
                vec![
                    ImapResponse::Untagged(
                        "ID (\"name\" \"signapps-mail\" \"version\" \"0.1.0\")".to_string(),
                    ),
                    ImapResponse::Tagged(tag.clone(), "OK ID completed".to_string()),
                ]
            },

            // ── Not-Authenticated state ────────────────────────────────────
            ImapCommandType::Login { .. } => {
                // Validation only — actual auth is done by the server layer.
                // The server layer calls set_authenticated() on success.
                // Return empty to signal the server should handle this.
                vec![]
            },

            ImapCommandType::Authenticate { .. } => {
                vec![]
            },

            // ── Authenticated state required ───────────────────────────────
            ImapCommandType::Select { .. }
            | ImapCommandType::Examine { .. }
            | ImapCommandType::Create { .. }
            | ImapCommandType::Delete { .. }
            | ImapCommandType::Rename { .. }
            | ImapCommandType::List { .. }
            | ImapCommandType::Lsub { .. }
            | ImapCommandType::Status { .. }
            | ImapCommandType::Append { .. }
            | ImapCommandType::Namespace
            | ImapCommandType::Enable { .. } => {
                if self.state == ImapState::NotAuthenticated {
                    return vec![ImapResponse::Tagged(
                        tag.clone(),
                        "BAD Command requires authentication".to_string(),
                    )];
                }
                // Server layer handles the actual command
                vec![]
            },

            // ── Selected state required ────────────────────────────────────
            ImapCommandType::Fetch { .. }
            | ImapCommandType::Search { .. }
            | ImapCommandType::Store { .. }
            | ImapCommandType::Copy { .. }
            | ImapCommandType::Move { .. }
            | ImapCommandType::Expunge
            | ImapCommandType::Close
            | ImapCommandType::Idle => {
                match &self.state {
                    ImapState::NotAuthenticated => {
                        return vec![ImapResponse::Tagged(
                            tag.clone(),
                            "BAD Command requires authentication".to_string(),
                        )];
                    },
                    ImapState::Authenticated => {
                        return vec![ImapResponse::Tagged(
                            tag.clone(),
                            "BAD No mailbox selected".to_string(),
                        )];
                    },
                    ImapState::Selected { readonly, .. } => {
                        // Reject write operations on read-only mailbox
                        if *readonly {
                            match &cmd.command {
                                ImapCommandType::Store { .. }
                                | ImapCommandType::Expunge
                                | ImapCommandType::Move { .. } => {
                                    return vec![ImapResponse::Tagged(
                                        tag.clone(),
                                        "NO Mailbox is read-only".to_string(),
                                    )];
                                },
                                _ => {},
                            }
                        }
                    },
                }
                // Server layer handles the actual command
                vec![]
            },

            ImapCommandType::Done => {
                // DONE is handled by the IDLE loop in the server
                vec![]
            },

            ImapCommandType::Uid { inner } => {
                // Delegate to the inner command with same state checks
                let inner_cmd = ImapCommand {
                    tag: tag.clone(),
                    command: *inner.clone(),
                };
                self.process(&inner_cmd)
            },
        }
    }
}

impl Default for ImapSession {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse_command;

    #[test]
    fn test_new_session_state() {
        let session = ImapSession::new();
        assert_eq!(*session.state(), ImapState::NotAuthenticated);
    }

    #[test]
    fn test_capabilities() {
        let session = ImapSession::new();
        let caps = session.capabilities();
        assert!(caps.contains(&"IMAP4rev2".to_string()));
        assert!(caps.contains(&"IDLE".to_string()));
        assert!(caps.contains(&"NAMESPACE".to_string()));
        assert!(caps.contains(&"ID".to_string()));
        assert!(caps.contains(&"SPECIAL-USE".to_string()));
        assert!(caps.contains(&"CONDSTORE".to_string()));
        assert!(caps.contains(&"MOVE".to_string()));
        assert!(caps.contains(&"LITERAL+".to_string()));
    }

    #[test]
    fn test_capability_command() {
        let mut session = ImapSession::new();
        let cmd = parse_command("a001 CAPABILITY\r\n").unwrap();
        let responses = session.process(&cmd);
        assert_eq!(responses.len(), 2);
        let bytes = responses[0].to_bytes();
        let s = String::from_utf8(bytes).unwrap();
        assert!(s.contains("CAPABILITY"));
        assert!(s.contains("IMAP4rev2"));
    }

    #[test]
    fn test_login_transitions_to_authenticated() {
        let mut session = ImapSession::new();
        assert_eq!(*session.state(), ImapState::NotAuthenticated);

        let cmd = parse_command("a001 LOGIN user pass\r\n").unwrap();
        let responses = session.process(&cmd);
        // Session returns empty — server handles auth
        assert!(responses.is_empty());

        // Server calls set_authenticated on success
        session.set_authenticated();
        assert_eq!(*session.state(), ImapState::Authenticated);
    }

    #[test]
    fn test_select_transitions_to_selected() {
        let mut session = ImapSession::new();
        session.set_authenticated();

        let cmd = parse_command("a002 SELECT INBOX\r\n").unwrap();
        let responses = session.process(&cmd);
        // Empty means server should handle
        assert!(responses.is_empty());

        // Server calls set_selected on success
        session.set_selected("INBOX".to_string(), false);
        assert_eq!(
            *session.state(),
            ImapState::Selected {
                mailbox: "INBOX".to_string(),
                readonly: false,
            }
        );
    }

    #[test]
    fn test_fetch_before_select_returns_bad() {
        let mut session = ImapSession::new();
        session.set_authenticated();

        let cmd = parse_command("a003 FETCH 1:* FLAGS\r\n").unwrap();
        let responses = session.process(&cmd);
        assert_eq!(responses.len(), 1);
        let bytes = responses[0].to_bytes();
        let s = String::from_utf8(bytes).unwrap();
        assert!(s.contains("BAD"));
        assert!(s.contains("No mailbox selected"));
    }

    #[test]
    fn test_fetch_before_auth_returns_bad() {
        let mut session = ImapSession::new();

        let cmd = parse_command("a003 FETCH 1:* FLAGS\r\n").unwrap();
        let responses = session.process(&cmd);
        assert_eq!(responses.len(), 1);
        let bytes = responses[0].to_bytes();
        let s = String::from_utf8(bytes).unwrap();
        assert!(s.contains("BAD"));
        assert!(s.contains("requires authentication"));
    }

    #[test]
    fn test_select_before_auth_returns_bad() {
        let mut session = ImapSession::new();

        let cmd = parse_command("a002 SELECT INBOX\r\n").unwrap();
        let responses = session.process(&cmd);
        assert_eq!(responses.len(), 1);
        let bytes = responses[0].to_bytes();
        let s = String::from_utf8(bytes).unwrap();
        assert!(s.contains("BAD"));
    }

    #[test]
    fn test_logout_command() {
        let mut session = ImapSession::new();
        let cmd = parse_command("a099 LOGOUT\r\n").unwrap();
        let responses = session.process(&cmd);
        assert_eq!(responses.len(), 2);
        let bye = String::from_utf8(responses[0].to_bytes()).unwrap();
        assert!(bye.contains("BYE"));
        let ok = String::from_utf8(responses[1].to_bytes()).unwrap();
        assert!(ok.contains("OK LOGOUT"));
    }

    #[test]
    fn test_noop_any_state() {
        let mut session = ImapSession::new();
        let cmd = parse_command("a001 NOOP\r\n").unwrap();
        let responses = session.process(&cmd);
        assert_eq!(responses.len(), 1);
        let s = String::from_utf8(responses[0].to_bytes()).unwrap();
        assert!(s.contains("OK NOOP"));
    }

    #[test]
    fn test_store_readonly_rejected() {
        let mut session = ImapSession::new();
        session.set_authenticated();
        session.set_selected("INBOX".to_string(), true);

        let cmd = parse_command("a005 STORE 1 +FLAGS (\\Seen)\r\n").unwrap();
        let responses = session.process(&cmd);
        assert_eq!(responses.len(), 1);
        let s = String::from_utf8(responses[0].to_bytes()).unwrap();
        assert!(s.contains("NO"));
        assert!(s.contains("read-only"));
    }

    #[test]
    fn test_close_deselects() {
        let mut session = ImapSession::new();
        session.set_authenticated();
        session.set_selected("INBOX".to_string(), false);

        // CLOSE is handled by server layer, but verify state check passes
        let cmd = parse_command("a006 CLOSE\r\n").unwrap();
        let responses = session.process(&cmd);
        assert!(responses.is_empty()); // server handles

        session.set_deselected();
        assert_eq!(*session.state(), ImapState::Authenticated);
    }

    #[test]
    fn test_uid_fetch_state_check() {
        let mut session = ImapSession::new();
        session.set_authenticated();
        // No mailbox selected — UID FETCH should be rejected
        let cmd = parse_command("a007 UID FETCH 1:* (FLAGS)\r\n").unwrap();
        let responses = session.process(&cmd);
        assert_eq!(responses.len(), 1);
        let s = String::from_utf8(responses[0].to_bytes()).unwrap();
        assert!(s.contains("BAD"));
    }

    #[test]
    fn test_id_command() {
        let mut session = ImapSession::new();
        let cmd = parse_command("a008 ID NIL\r\n").unwrap();
        let responses = session.process(&cmd);
        assert_eq!(responses.len(), 2);
        let s = String::from_utf8(responses[0].to_bytes()).unwrap();
        assert!(s.contains("signapps-mail"));
    }

    #[test]
    fn test_namespace_requires_auth() {
        let mut session = ImapSession::new();
        let cmd = parse_command("a009 NAMESPACE\r\n").unwrap();
        let responses = session.process(&cmd);
        assert_eq!(responses.len(), 1);
        let s = String::from_utf8(responses[0].to_bytes()).unwrap();
        assert!(s.contains("BAD"));
    }
}
