//! SMTP session state machine.
//!
//! [`SmtpSession`] tracks the protocol state of a single SMTP connection.
//! The caller feeds raw lines via [`SmtpSession::feed_line`] and receives
//! [`SmtpAction`] values describing what to do next (send a reply, start TLS,
//! deliver a message, etc.).
//!
//! During the DATA phase, use [`SmtpSession::feed_data_line`] instead, which
//! accumulates message bytes until the end-of-data marker is received.

use base64::Engine;

use crate::auth::{self, LoginNext, LoginState, SaslMechanism};
use crate::envelope::SmtpEnvelope;
use crate::parser::{self, SmtpCommand, SmtpError};
use crate::reply;

/// The current state of an SMTP session.
///
/// State transitions follow RFC 5321:
/// `Connected` -> `Greeted` -> `Authenticated` (optional) -> `MailFrom` -> `RcptTo` -> `Data`
///
/// [`SmtpSession`] enforces valid transitions and returns `503 Bad sequence` for
/// commands issued in the wrong state.
#[derive(Debug, Clone, PartialEq)]
pub enum SmtpState {
    /// Connection established, awaiting EHLO/HELO.
    Connected,
    /// EHLO/HELO received. Ready for AUTH, MAIL FROM, STARTTLS, or QUIT.
    Greeted {
        /// The client domain from the EHLO/HELO command.
        domain: String,
    },
    /// Successfully authenticated. Ready for MAIL FROM.
    Authenticated {
        /// The authenticated account identifier.
        account: String,
    },
    /// MAIL FROM received. Ready for RCPT TO.
    MailFrom {
        /// The envelope sender address.
        sender: String,
    },
    /// At least one RCPT TO received. Ready for more RCPT TO or DATA.
    RcptTo {
        /// The envelope sender address.
        sender: String,
        /// The accumulated recipient addresses.
        recipients: Vec<String>,
    },
    /// DATA command issued. Accumulating message bytes.
    Data,
}

/// Actions the caller should perform in response to session processing.
///
/// The session returns one or more actions for each command. The caller must
/// execute them in order (typically writing reply bytes to the network).
#[derive(Debug, Clone, PartialEq)]
pub enum SmtpAction {
    /// Send a simple reply to the client.
    Reply(u16, String),
    /// Send the EHLO multiline response with capabilities.
    SendCapabilities(Vec<String>),
    /// Initiate a TLS upgrade. The caller should perform the TLS handshake
    /// and then continue the session.
    StartTls,
    /// Begin an AUTH exchange. The caller should handle the SASL mechanism.
    Authenticate {
        /// The SASL mechanism name.
        mechanism: String,
        /// Optional initial response from the client.
        initial: Option<String>,
    },
    /// Send an AUTH challenge to the client (334 response).
    AuthChallenge(String),
    /// The DATA command was accepted; start accumulating message lines.
    AcceptData,
    /// A complete message has been received. Deliver it.
    Deliver(SmtpEnvelope),
    /// Close the connection.
    Close,
}

/// Configuration for an SMTP session.
///
/// Controls the server hostname, size limits, and authentication/TLS requirements.
///
/// # Examples
///
/// ```
/// use signapps_smtp::SmtpConfig;
///
/// let config = SmtpConfig {
///     hostname: "mail.example.com".into(),
///     max_message_size: 50 * 1024 * 1024,
///     require_auth: true,
///     require_tls: true,
/// };
/// ```
#[derive(Debug, Clone)]
pub struct SmtpConfig {
    /// The server hostname, used in greetings and EHLO responses.
    pub hostname: String,
    /// Maximum message size in bytes. Default: 50 MiB.
    pub max_message_size: usize,
    /// Whether authentication is required before MAIL FROM (submission port 587).
    pub require_auth: bool,
    /// Whether STARTTLS is required before any other command (submission port 587).
    pub require_tls: bool,
}

impl Default for SmtpConfig {
    fn default() -> Self {
        Self {
            hostname: "localhost".into(),
            max_message_size: 50 * 1024 * 1024,
            require_auth: false,
            require_tls: false,
        }
    }
}

/// An SMTP session state machine.
///
/// Tracks the protocol state of a single SMTP connection and produces
/// [`SmtpAction`] values for the caller to execute. The session does not
/// perform any I/O itself.
///
/// # Examples
///
/// ```
/// use signapps_smtp::{SmtpSession, SmtpConfig, SmtpAction};
///
/// let config = SmtpConfig::default();
/// let mut session = SmtpSession::new(config);
///
/// // Initial greeting
/// let greeting = session.greeting();
///
/// // Process EHLO
/// let actions = session.feed_line(b"EHLO client.example.com\r\n");
/// assert!(!actions.is_empty());
/// ```
pub struct SmtpSession {
    state: SmtpState,
    config: SmtpConfig,
    /// Whether TLS has been established (set by caller after STARTTLS handshake).
    tls_active: bool,
    /// Whether the session has been authenticated.
    authenticated: bool,
    /// Accumulator for DATA lines.
    data_buffer: Vec<u8>,
    /// Current declared message size (from SIZE= parameter).
    declared_size: Option<usize>,
    /// Active LOGIN auth state (two-step exchange).
    login_state: Option<LoginState>,
    /// The authenticated account name.
    auth_account: Option<String>,
    /// Envelope sender — persisted across state transitions into Data.
    envelope_sender: String,
    /// Envelope recipients — persisted across state transitions into Data.
    envelope_recipients: Vec<String>,
}

impl SmtpSession {
    /// Create a new session with the given configuration.
    ///
    /// The session starts in the [`SmtpState::Connected`] state.
    ///
    /// # Panics
    ///
    /// None.
    pub fn new(config: SmtpConfig) -> Self {
        Self {
            state: SmtpState::Connected,
            config,
            tls_active: false,
            authenticated: false,
            data_buffer: Vec::new(),
            declared_size: None,
            login_state: None,
            auth_account: None,
            envelope_sender: String::new(),
            envelope_recipients: Vec::new(),
        }
    }

    /// Generate the initial 220 greeting banner.
    ///
    /// Should be sent immediately after accepting the TCP connection.
    ///
    /// # Panics
    ///
    /// None.
    pub fn greeting(&self) -> SmtpAction {
        let r = reply::greeting(&self.config.hostname);
        SmtpAction::Reply(r.code, r.text)
    }

    /// Get the current session state.
    pub fn state(&self) -> &SmtpState {
        &self.state
    }

    /// Check whether TLS is active on this session.
    pub fn is_tls_active(&self) -> bool {
        self.tls_active
    }

    /// Check whether this session is authenticated.
    pub fn is_authenticated(&self) -> bool {
        self.authenticated
    }

    /// Notify the session that TLS has been established.
    ///
    /// Call this after completing the TLS handshake initiated by STARTTLS.
    /// The session resets to [`SmtpState::Connected`] per RFC 3207.
    pub fn set_tls_active(&mut self) {
        self.tls_active = true;
        // Per RFC 3207, after STARTTLS the session resets to initial state
        self.state = SmtpState::Connected;
    }

    /// Notify the session that authentication succeeded.
    ///
    /// Call this after verifying the credentials received via AUTH.
    pub fn set_authenticated(&mut self, account: &str) {
        self.authenticated = true;
        self.auth_account = Some(account.to_string());
        self.state = SmtpState::Authenticated {
            account: account.to_string(),
        };
    }

    /// Feed a raw SMTP command line and get back the actions to perform.
    ///
    /// The line should include the trailing `\r\n`. The session parses the
    /// command, validates it against the current state, updates the state,
    /// and returns one or more actions.
    ///
    /// During the DATA phase, use [`feed_data_line`](Self::feed_data_line) instead.
    ///
    /// # Panics
    ///
    /// None.
    pub fn feed_line(&mut self, line: &[u8]) -> Vec<SmtpAction> {
        // Handle LOGIN auth continuation
        if let Some(login_state) = self.login_state.take() {
            return self.handle_login_response(&login_state, line);
        }

        let cmd = match parser::parse_command(line) {
            Ok(cmd) => cmd,
            Err(SmtpError::InvalidUtf8 | SmtpError::SyntaxError(_)) => {
                let r = reply::syntax_error();
                return vec![SmtpAction::Reply(r.code, r.text)];
            },
            Err(SmtpError::UnsupportedMechanism(_)) => {
                let r = reply::not_implemented();
                return vec![SmtpAction::Reply(r.code, r.text)];
            },
            Err(SmtpError::Base64Error(_)) => {
                let r = reply::syntax_error();
                return vec![SmtpAction::Reply(r.code, r.text)];
            },
        };

        match cmd {
            SmtpCommand::Ehlo(domain) => self.handle_ehlo(domain),
            SmtpCommand::Helo(domain) => self.handle_helo(domain),
            SmtpCommand::MailFrom { address, params } => self.handle_mail_from(address, params),
            SmtpCommand::RcptTo { address, params } => self.handle_rcpt_to(address, params),
            SmtpCommand::Data => self.handle_data(),
            SmtpCommand::Quit => self.handle_quit(),
            SmtpCommand::Rset => self.handle_rset(),
            SmtpCommand::Noop => {
                let r = reply::ok();
                vec![SmtpAction::Reply(r.code, r.text)]
            },
            SmtpCommand::StartTls => self.handle_starttls(),
            SmtpCommand::Auth {
                mechanism,
                initial_response,
            } => self.handle_auth(mechanism, initial_response),
            SmtpCommand::AuthResponse(_) => {
                let r = reply::bad_sequence();
                vec![SmtpAction::Reply(r.code, r.text)]
            },
            SmtpCommand::Unknown(_) => {
                let r = reply::not_implemented();
                vec![SmtpAction::Reply(r.code, r.text)]
            },
        }
    }

    /// Feed a line during the DATA phase.
    ///
    /// Accumulates the line into the message buffer. When the end-of-data
    /// marker (a line containing only `.`) is received, returns a
    /// [`SmtpAction::Deliver`] with the complete envelope.
    ///
    /// Returns `None` if the line was accumulated (more data expected),
    /// or `Some(action)` if the message is complete or an error occurred.
    ///
    /// # Panics
    ///
    /// None.
    pub fn feed_data_line(&mut self, line: &[u8]) -> Option<SmtpAction> {
        if self.state != SmtpState::Data {
            let r = reply::bad_sequence();
            return Some(SmtpAction::Reply(r.code, r.text));
        }

        // Check for end-of-data marker: ".\r\n" or ".\n"
        let trimmed = if line.ends_with(b"\r\n") {
            &line[..line.len() - 2]
        } else if line.ends_with(b"\n") {
            &line[..line.len() - 1]
        } else {
            line
        };

        if trimmed == b"." {
            // End of data — build envelope and deliver
            let envelope = SmtpEnvelope {
                sender: self.envelope_sender.clone(),
                recipients: self.envelope_recipients.clone(),
                data: self.data_buffer.clone(),
            };

            self.data_buffer.clear();
            self.declared_size = None;
            self.envelope_sender.clear();
            self.envelope_recipients.clear();
            self.reset_to_post_auth_state();

            return Some(SmtpAction::Deliver(envelope));
        }

        // Check size limit
        if self.data_buffer.len() + line.len() > self.config.max_message_size {
            self.data_buffer.clear();
            self.declared_size = None;
            self.envelope_sender.clear();
            self.envelope_recipients.clear();
            self.reset_to_post_auth_state();
            let r = reply::too_large();
            return Some(SmtpAction::Reply(r.code, r.text));
        }

        // Dot-stuffing: lines starting with ".." have the first dot removed (RFC 5321 4.5.2)
        if line.starts_with(b"..") {
            self.data_buffer.extend_from_slice(&line[1..]);
        } else {
            self.data_buffer.extend_from_slice(line);
        }

        None
    }

    // ── Private helpers ─────────────────────────────────────────────────

    /// Reset state to Greeted or Authenticated after DATA or RSET.
    fn reset_to_post_auth_state(&mut self) {
        if self.authenticated {
            if let Some(ref account) = self.auth_account {
                self.state = SmtpState::Authenticated {
                    account: account.clone(),
                };
            }
        } else {
            self.state = SmtpState::Greeted {
                domain: String::new(),
            };
        }
    }

    fn handle_ehlo(&mut self, domain: String) -> Vec<SmtpAction> {
        self.state = SmtpState::Greeted {
            domain: domain.clone(),
        };

        let mut capabilities = vec![
            format!("{} Hello {}", self.config.hostname, domain),
            format!("SIZE {}", self.config.max_message_size),
            "8BITMIME".to_string(),
            "PIPELINING".to_string(),
            "ENHANCEDSTATUSCODES".to_string(),
        ];

        if !self.tls_active && self.config.require_tls {
            capabilities.push("STARTTLS".to_string());
        }

        if !self.authenticated {
            capabilities.push("AUTH PLAIN LOGIN XOAUTH2".to_string());
        }

        vec![SmtpAction::SendCapabilities(capabilities)]
    }

    fn handle_helo(&mut self, domain: String) -> Vec<SmtpAction> {
        self.state = SmtpState::Greeted {
            domain: domain.clone(),
        };
        let r = reply::ehlo_ok(&self.config.hostname);
        vec![SmtpAction::Reply(r.code, r.text)]
    }

    fn handle_mail_from(
        &mut self,
        address: String,
        params: Vec<(String, String)>,
    ) -> Vec<SmtpAction> {
        match &self.state {
            SmtpState::Greeted { .. } | SmtpState::Authenticated { .. } => {},
            _ => {
                let r = reply::bad_sequence();
                return vec![SmtpAction::Reply(r.code, r.text)];
            },
        }

        if self.config.require_tls && !self.tls_active {
            return vec![SmtpAction::Reply(
                530,
                "Must issue a STARTTLS command first".into(),
            )];
        }

        if self.config.require_auth && !self.authenticated {
            let r = reply::auth_required();
            return vec![SmtpAction::Reply(r.code, r.text)];
        }

        // Check SIZE parameter
        for (key, value) in &params {
            if key == "SIZE" {
                if let Ok(size) = value.parse::<usize>() {
                    if size > self.config.max_message_size {
                        let r = reply::too_large();
                        return vec![SmtpAction::Reply(r.code, r.text)];
                    }
                    self.declared_size = Some(size);
                }
            }
        }

        self.envelope_sender = address.clone();
        self.envelope_recipients.clear();
        self.state = SmtpState::MailFrom { sender: address };
        let r = reply::ok();
        vec![SmtpAction::Reply(r.code, r.text)]
    }

    fn handle_rcpt_to(
        &mut self,
        address: String,
        _params: Vec<(String, String)>,
    ) -> Vec<SmtpAction> {
        match &self.state {
            SmtpState::MailFrom { sender } => {
                let sender = sender.clone();
                self.envelope_recipients.push(address.clone());
                self.state = SmtpState::RcptTo {
                    sender,
                    recipients: self.envelope_recipients.clone(),
                };
                let r = reply::ok();
                vec![SmtpAction::Reply(r.code, r.text)]
            },
            SmtpState::RcptTo { sender, .. } => {
                let sender = sender.clone();
                self.envelope_recipients.push(address.clone());
                self.state = SmtpState::RcptTo {
                    sender,
                    recipients: self.envelope_recipients.clone(),
                };
                let r = reply::ok();
                vec![SmtpAction::Reply(r.code, r.text)]
            },
            _ => {
                let r = reply::bad_sequence();
                vec![SmtpAction::Reply(r.code, r.text)]
            },
        }
    }

    fn handle_data(&mut self) -> Vec<SmtpAction> {
        match &self.state {
            SmtpState::RcptTo { .. } => {
                self.state = SmtpState::Data;
                self.data_buffer.clear();
                let r = reply::start_data();
                vec![SmtpAction::Reply(r.code, r.text), SmtpAction::AcceptData]
            },
            _ => {
                let r = reply::bad_sequence();
                vec![SmtpAction::Reply(r.code, r.text)]
            },
        }
    }

    fn handle_quit(&mut self) -> Vec<SmtpAction> {
        let r = reply::quit();
        vec![SmtpAction::Reply(r.code, r.text), SmtpAction::Close]
    }

    fn handle_rset(&mut self) -> Vec<SmtpAction> {
        self.data_buffer.clear();
        self.declared_size = None;
        self.envelope_sender.clear();
        self.envelope_recipients.clear();

        match &self.state {
            SmtpState::Connected => {}, // stay in Connected
            _ => self.reset_to_post_auth_state(),
        }

        let r = reply::ok();
        vec![SmtpAction::Reply(r.code, r.text)]
    }

    fn handle_starttls(&mut self) -> Vec<SmtpAction> {
        match &self.state {
            SmtpState::Greeted { .. } => {
                if self.tls_active {
                    return vec![SmtpAction::Reply(503, "TLS already active".into())];
                }
                vec![
                    SmtpAction::Reply(220, "Ready to start TLS".into()),
                    SmtpAction::StartTls,
                ]
            },
            _ => {
                let r = reply::bad_sequence();
                vec![SmtpAction::Reply(r.code, r.text)]
            },
        }
    }

    fn handle_auth(
        &mut self,
        mechanism: String,
        initial_response: Option<String>,
    ) -> Vec<SmtpAction> {
        match &self.state {
            SmtpState::Greeted { .. } => {},
            _ => {
                let r = reply::bad_sequence();
                return vec![SmtpAction::Reply(r.code, r.text)];
            },
        }

        if self.authenticated {
            return vec![SmtpAction::Reply(503, "Already authenticated".into())];
        }

        let mech = match SaslMechanism::parse(&mechanism) {
            Ok(m) => m,
            Err(_) => {
                let r = reply::not_implemented();
                return vec![SmtpAction::Reply(r.code, r.text)];
            },
        };

        match mech {
            SaslMechanism::Plain => {
                if let Some(initial) = initial_response {
                    vec![SmtpAction::Authenticate {
                        mechanism,
                        initial: Some(initial),
                    }]
                } else {
                    // Send empty challenge to prompt for credentials
                    vec![SmtpAction::AuthChallenge(String::new())]
                }
            },
            SaslMechanism::Login => {
                if let Some(initial) = initial_response {
                    // Initial response is the username (base64)
                    let waiting = LoginState::WaitingUsername;
                    return self.handle_login_response(&waiting, initial.as_bytes());
                }
                // Send username challenge: base64("Username:")
                let challenge = base64::engine::general_purpose::STANDARD.encode("Username:");
                self.login_state = Some(LoginState::WaitingUsername);
                vec![SmtpAction::AuthChallenge(challenge)]
            },
            SaslMechanism::XOAuth2 => {
                if let Some(initial) = initial_response {
                    vec![SmtpAction::Authenticate {
                        mechanism,
                        initial: Some(initial),
                    }]
                } else {
                    vec![SmtpAction::AuthChallenge(String::new())]
                }
            },
        }
    }

    fn handle_login_response(&mut self, state: &LoginState, line: &[u8]) -> Vec<SmtpAction> {
        let text = match std::str::from_utf8(line) {
            Ok(t) => t.trim_end_matches("\r\n").trim_end_matches('\n').trim(),
            Err(_) => {
                let r = reply::auth_failed();
                return vec![SmtpAction::Reply(r.code, r.text)];
            },
        };

        match auth::decode_login_step(state, text) {
            Ok(LoginNext::Challenge(challenge, new_state)) => {
                self.login_state = Some(new_state);
                vec![SmtpAction::AuthChallenge(challenge)]
            },
            Ok(LoginNext::Done(username, password)) => {
                self.login_state = None;
                vec![SmtpAction::Authenticate {
                    mechanism: "LOGIN".to_string(),
                    initial: Some(format!(
                        "{}:{}",
                        base64::engine::general_purpose::STANDARD.encode(&username),
                        base64::engine::general_purpose::STANDARD.encode(&password),
                    )),
                }]
            },
            Err(_) => {
                self.login_state = None;
                let r = reply::auth_failed();
                vec![SmtpAction::Reply(r.code, r.text)]
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn greeting_returns_220() {
        let session = SmtpSession::new(SmtpConfig {
            hostname: "mx.example.com".into(),
            ..SmtpConfig::default()
        });
        let action = session.greeting();
        match action {
            SmtpAction::Reply(code, text) => {
                assert_eq!(code, 220);
                assert!(text.contains("mx.example.com"));
            },
            _ => panic!("expected Reply action"),
        }
    }

    #[test]
    fn ehlo_transitions_to_greeted() {
        let mut session = SmtpSession::new(SmtpConfig::default());
        let actions = session.feed_line(b"EHLO client.example.com\r\n");
        assert!(!actions.is_empty());
        match &actions[0] {
            SmtpAction::SendCapabilities(caps) => {
                assert!(!caps.is_empty());
                assert!(caps[0].contains("client.example.com"));
            },
            _ => panic!("expected SendCapabilities"),
        }
        assert!(matches!(session.state(), SmtpState::Greeted { .. }));
    }

    #[test]
    fn mail_from_before_ehlo_returns_503() {
        let mut session = SmtpSession::new(SmtpConfig::default());
        let actions = session.feed_line(b"MAIL FROM:<user@example.com>\r\n");
        assert_eq!(actions.len(), 1);
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 503),
            _ => panic!("expected Reply"),
        }
    }

    #[test]
    fn data_before_rcpt_returns_503() {
        let mut session = SmtpSession::new(SmtpConfig::default());
        session.feed_line(b"EHLO test\r\n");
        session.feed_line(b"MAIL FROM:<sender@example.com>\r\n");
        let actions = session.feed_line(b"DATA\r\n");
        assert_eq!(actions.len(), 1);
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 503),
            _ => panic!("expected Reply"),
        }
    }

    #[test]
    fn happy_path_ehlo_mail_rcpt_data_deliver() {
        let mut session = SmtpSession::new(SmtpConfig::default());

        // EHLO
        let actions = session.feed_line(b"EHLO client.example.com\r\n");
        assert!(!actions.is_empty());

        // MAIL FROM
        let actions = session.feed_line(b"MAIL FROM:<sender@example.com>\r\n");
        assert_eq!(actions.len(), 1);
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 250),
            _ => panic!("expected 250 Reply"),
        }

        // RCPT TO
        let actions = session.feed_line(b"RCPT TO:<recipient@example.com>\r\n");
        assert_eq!(actions.len(), 1);
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 250),
            _ => panic!("expected 250 Reply"),
        }

        // DATA
        let actions = session.feed_line(b"DATA\r\n");
        assert!(actions.len() >= 1);
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 354),
            _ => panic!("expected 354 Reply"),
        }

        // Feed data lines
        assert!(session
            .feed_data_line(b"From: sender@example.com\r\n")
            .is_none());
        assert!(session
            .feed_data_line(b"To: recipient@example.com\r\n")
            .is_none());
        assert!(session.feed_data_line(b"Subject: Test\r\n").is_none());
        assert!(session.feed_data_line(b"\r\n").is_none());
        assert!(session.feed_data_line(b"Hello, world!\r\n").is_none());

        // End of data
        let action = session.feed_data_line(b".\r\n");
        assert!(action.is_some());
        match action.unwrap() {
            SmtpAction::Deliver(envelope) => {
                assert_eq!(envelope.sender, "sender@example.com");
                assert_eq!(envelope.recipients, vec!["recipient@example.com"]);
                assert!(!envelope.data.is_empty());
                // Verify data contains our message lines
                let data_str = String::from_utf8_lossy(&envelope.data);
                assert!(data_str.contains("Subject: Test"));
                assert!(data_str.contains("Hello, world!"));
            },
            _ => panic!("expected Deliver action"),
        }
    }

    #[test]
    fn multiple_rcpt_to() {
        let mut session = SmtpSession::new(SmtpConfig::default());
        session.feed_line(b"EHLO test\r\n");
        session.feed_line(b"MAIL FROM:<sender@example.com>\r\n");

        let actions = session.feed_line(b"RCPT TO:<alice@example.com>\r\n");
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 250),
            _ => panic!("expected 250"),
        }

        let actions = session.feed_line(b"RCPT TO:<bob@example.com>\r\n");
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 250),
            _ => panic!("expected 250"),
        }

        let actions = session.feed_line(b"RCPT TO:<carol@example.com>\r\n");
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 250),
            _ => panic!("expected 250"),
        }

        match session.state() {
            SmtpState::RcptTo { recipients, .. } => {
                assert_eq!(recipients.len(), 3);
                assert!(recipients.contains(&"alice@example.com".to_string()));
                assert!(recipients.contains(&"bob@example.com".to_string()));
                assert!(recipients.contains(&"carol@example.com".to_string()));
            },
            _ => panic!("expected RcptTo state"),
        }
    }

    #[test]
    fn rset_resets_to_greeted() {
        let mut session = SmtpSession::new(SmtpConfig::default());
        session.feed_line(b"EHLO test\r\n");
        session.feed_line(b"MAIL FROM:<sender@example.com>\r\n");
        session.feed_line(b"RCPT TO:<recipient@example.com>\r\n");

        assert!(matches!(session.state(), SmtpState::RcptTo { .. }));

        let actions = session.feed_line(b"RSET\r\n");
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 250),
            _ => panic!("expected 250"),
        }

        assert!(matches!(session.state(), SmtpState::Greeted { .. }));
    }

    #[test]
    fn quit_returns_221_and_close() {
        let mut session = SmtpSession::new(SmtpConfig::default());
        let actions = session.feed_line(b"QUIT\r\n");
        assert!(actions.len() >= 2);
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 221),
            _ => panic!("expected 221"),
        }
        assert!(matches!(actions[1], SmtpAction::Close));
    }

    #[test]
    fn auth_required_blocks_mail_from() {
        let mut session = SmtpSession::new(SmtpConfig {
            require_auth: true,
            ..SmtpConfig::default()
        });
        session.feed_line(b"EHLO test\r\n");
        let actions = session.feed_line(b"MAIL FROM:<user@example.com>\r\n");
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 530),
            _ => panic!("expected 530"),
        }
    }

    #[test]
    fn noop_returns_250() {
        let mut session = SmtpSession::new(SmtpConfig::default());
        session.feed_line(b"EHLO test\r\n");
        let actions = session.feed_line(b"NOOP\r\n");
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 250),
            _ => panic!("expected 250"),
        }
    }

    #[test]
    fn unknown_command_returns_502() {
        let mut session = SmtpSession::new(SmtpConfig::default());
        session.feed_line(b"EHLO test\r\n");
        let actions = session.feed_line(b"VRFY user@example.com\r\n");
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 502),
            _ => panic!("expected 502"),
        }
    }

    #[test]
    fn auth_plain_with_initial_response() {
        let mut session = SmtpSession::new(SmtpConfig::default());
        session.feed_line(b"EHLO test\r\n");

        let encoded = base64::engine::general_purpose::STANDARD.encode(b"\0testuser\0testpass");
        let cmd = format!("AUTH PLAIN {}\r\n", encoded);
        let actions = session.feed_line(cmd.as_bytes());

        match &actions[0] {
            SmtpAction::Authenticate { mechanism, initial } => {
                assert_eq!(mechanism, "PLAIN");
                assert!(initial.is_some());
            },
            _ => panic!("expected Authenticate action, got: {:?}", actions),
        }
    }

    #[test]
    fn starttls_in_greeted_state() {
        let mut session = SmtpSession::new(SmtpConfig {
            require_tls: true,
            ..SmtpConfig::default()
        });
        session.feed_line(b"EHLO test\r\n");

        let actions = session.feed_line(b"STARTTLS\r\n");
        assert!(actions.len() >= 2);
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 220),
            _ => panic!("expected 220"),
        }
        assert!(matches!(actions[1], SmtpAction::StartTls));
    }

    #[test]
    fn size_exceeded_at_mail_from() {
        let mut session = SmtpSession::new(SmtpConfig {
            max_message_size: 1024,
            ..SmtpConfig::default()
        });
        session.feed_line(b"EHLO test\r\n");

        let actions = session.feed_line(b"MAIL FROM:<user@example.com> SIZE=2048\r\n");
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 552),
            _ => panic!("expected 552"),
        }
    }

    #[test]
    fn dot_stuffing_in_data() {
        let mut session = SmtpSession::new(SmtpConfig::default());
        session.feed_line(b"EHLO test\r\n");
        session.feed_line(b"MAIL FROM:<sender@example.com>\r\n");
        session.feed_line(b"RCPT TO:<recipient@example.com>\r\n");
        session.feed_line(b"DATA\r\n");

        // Lines starting with ".." should have the first dot removed
        assert!(session.feed_data_line(b"..hidden dot\r\n").is_none());
        assert!(session.feed_data_line(b"normal line\r\n").is_none());

        let action = session.feed_data_line(b".\r\n").unwrap();
        match action {
            SmtpAction::Deliver(envelope) => {
                let data_str = String::from_utf8_lossy(&envelope.data);
                assert!(data_str.contains(".hidden dot"));
                assert!(!data_str.contains("..hidden dot"));
                assert!(data_str.contains("normal line"));
            },
            _ => panic!("expected Deliver"),
        }
    }

    #[test]
    fn multiple_transactions_same_session() {
        let mut session = SmtpSession::new(SmtpConfig::default());
        session.feed_line(b"EHLO test\r\n");

        // First transaction
        session.feed_line(b"MAIL FROM:<a@example.com>\r\n");
        session.feed_line(b"RCPT TO:<b@example.com>\r\n");
        session.feed_line(b"DATA\r\n");
        session.feed_data_line(b"First message\r\n");
        let action = session.feed_data_line(b".\r\n").unwrap();
        match action {
            SmtpAction::Deliver(env) => assert_eq!(env.sender, "a@example.com"),
            _ => panic!("expected Deliver"),
        }

        // Session should be back in Greeted state — start another transaction
        let actions = session.feed_line(b"MAIL FROM:<c@example.com>\r\n");
        match &actions[0] {
            SmtpAction::Reply(code, _) => assert_eq!(*code, 250),
            _ => panic!("expected 250 for second MAIL FROM"),
        }
    }
}
