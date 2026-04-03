//! SMTP reply codes and text.
//!
//! Provides factory functions for standard SMTP response tuples `(code, text)`.
//! Each function returns a [`SmtpReply`] containing the numeric status code
//! and the human-readable message.

/// An SMTP reply consisting of a status code and message text.
///
/// The caller is responsible for formatting this into the wire protocol
/// (`code text\r\n` or multiline `code-text\r\n`).
///
/// # Examples
///
/// ```
/// use signapps_smtp::reply;
///
/// let r = reply::ok();
/// assert_eq!(r.code, 250);
/// ```
#[derive(Debug, Clone, PartialEq)]
pub struct SmtpReply {
    /// The three-digit SMTP status code.
    pub code: u16,
    /// The human-readable message text.
    pub text: String,
}

impl SmtpReply {
    /// Create a new reply with the given code and text.
    ///
    /// # Panics
    ///
    /// None.
    pub fn new(code: u16, text: impl Into<String>) -> Self {
        Self {
            code,
            text: text.into(),
        }
    }

    /// Format this reply as an SMTP wire-protocol line (`code text\r\n`).
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_smtp::reply;
    ///
    /// let r = reply::ok();
    /// assert_eq!(r.to_wire(), "250 OK\r\n");
    /// ```
    pub fn to_wire(&self) -> String {
        format!("{} {}\r\n", self.code, self.text)
    }
}

/// 220 service ready greeting.
///
/// # Examples
///
/// ```
/// let r = signapps_smtp::reply::greeting("mail.example.com");
/// assert_eq!(r.code, 220);
/// ```
pub fn greeting(hostname: &str) -> SmtpReply {
    SmtpReply::new(220, format!("{hostname} ESMTP ready"))
}

/// 250 EHLO response (first line of multiline).
///
/// The caller should append capability lines as separate `250-` lines.
pub fn ehlo_ok(hostname: &str) -> SmtpReply {
    SmtpReply::new(250, format!("{hostname} Hello"))
}

/// 250 generic OK response.
pub fn ok() -> SmtpReply {
    SmtpReply::new(250, "OK")
}

/// 354 start mail input.
pub fn start_data() -> SmtpReply {
    SmtpReply::new(354, "Start mail input; end with <CRLF>.<CRLF>")
}

/// 221 closing connection.
pub fn quit() -> SmtpReply {
    SmtpReply::new(221, "Bye")
}

/// 503 bad sequence of commands.
pub fn bad_sequence() -> SmtpReply {
    SmtpReply::new(503, "Bad sequence of commands")
}

/// 500 syntax error, command unrecognized.
pub fn syntax_error() -> SmtpReply {
    SmtpReply::new(500, "Syntax error, command unrecognized")
}

/// 530 authentication required.
pub fn auth_required() -> SmtpReply {
    SmtpReply::new(530, "Authentication required")
}

/// 535 authentication credentials invalid.
pub fn auth_failed() -> SmtpReply {
    SmtpReply::new(535, "Authentication credentials invalid")
}

/// 550 requested action not taken: mailbox unavailable.
pub fn unknown_recipient() -> SmtpReply {
    SmtpReply::new(550, "No such user")
}

/// 552 message exceeds fixed maximum message size.
pub fn too_large() -> SmtpReply {
    SmtpReply::new(552, "Message exceeds fixed maximum message size")
}

/// 334 authentication challenge (base64-encoded prompt).
pub fn auth_challenge(challenge: &str) -> SmtpReply {
    SmtpReply::new(334, challenge)
}

/// 235 authentication successful.
pub fn auth_ok() -> SmtpReply {
    SmtpReply::new(235, "Authentication successful")
}

/// 502 command not implemented.
pub fn not_implemented() -> SmtpReply {
    SmtpReply::new(502, "Command not implemented")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn greeting_format() {
        let r = greeting("mx.example.com");
        assert_eq!(r.code, 220);
        assert!(r.text.contains("mx.example.com"));
    }

    #[test]
    fn ok_reply() {
        let r = ok();
        assert_eq!(r.code, 250);
        assert_eq!(r.text, "OK");
    }

    #[test]
    fn wire_format() {
        let r = ok();
        assert_eq!(r.to_wire(), "250 OK\r\n");
    }

    #[test]
    fn bad_sequence_code() {
        assert_eq!(bad_sequence().code, 503);
    }

    #[test]
    fn auth_required_code() {
        assert_eq!(auth_required().code, 530);
    }

    #[test]
    fn too_large_code() {
        assert_eq!(too_large().code, 552);
    }
}
