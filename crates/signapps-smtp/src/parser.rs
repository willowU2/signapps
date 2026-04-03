//! SMTP command parser.
//!
//! Parses raw byte lines (terminated by `\r\n`) into structured [`SmtpCommand`]
//! values. Each line is expected to contain exactly one command.

use crate::auth::SaslMechanism;

/// Errors that can occur during SMTP command parsing.
#[derive(Debug, thiserror::Error)]
pub enum SmtpError {
    /// The input line is not valid UTF-8.
    #[error("invalid UTF-8 in command")]
    InvalidUtf8,

    /// The command syntax is malformed.
    #[error("syntax error: {0}")]
    SyntaxError(String),

    /// An unknown or unsupported SASL mechanism was requested.
    #[error("unsupported auth mechanism: {0}")]
    UnsupportedMechanism(String),

    /// Base64 decoding failed.
    #[error("base64 decode error: {0}")]
    Base64Error(String),
}

/// A parsed SMTP command.
///
/// Represents all commands recognized by this library plus a catch-all
/// [`Unknown`](SmtpCommand::Unknown) variant for anything else.
///
/// # Examples
///
/// ```
/// use signapps_smtp::parser::parse_command;
///
/// let cmd = parse_command(b"EHLO example.com\r\n").unwrap();
/// ```
#[derive(Debug, Clone, PartialEq)]
pub enum SmtpCommand {
    /// EHLO with the client domain.
    Ehlo(String),
    /// HELO with the client domain.
    Helo(String),
    /// MAIL FROM with sender address and optional parameters (SIZE, BODY, etc.).
    MailFrom {
        /// The sender email address (extracted from angle brackets).
        address: String,
        /// Extension parameters as key-value pairs.
        params: Vec<(String, String)>,
    },
    /// RCPT TO with recipient address and optional parameters.
    RcptTo {
        /// The recipient email address (extracted from angle brackets).
        address: String,
        /// Extension parameters as key-value pairs.
        params: Vec<(String, String)>,
    },
    /// DATA command — begins message transfer.
    Data,
    /// QUIT command — ends the session.
    Quit,
    /// RSET command — resets the session to post-EHLO state.
    Rset,
    /// NOOP command — no operation.
    Noop,
    /// STARTTLS command — requests TLS upgrade.
    StartTls,
    /// AUTH command with mechanism and optional initial response.
    Auth {
        /// The SASL mechanism name (PLAIN, LOGIN, XOAUTH2).
        mechanism: String,
        /// Optional initial response (base64-encoded), provided on the same line.
        initial_response: Option<String>,
    },
    /// Continuation response during an AUTH exchange (base64-encoded).
    AuthResponse(String),
    /// An unrecognized command.
    Unknown(String),
}

/// Parse a single SMTP command from a raw byte line.
///
/// The input should include the trailing `\r\n`; it will be stripped before parsing.
/// If the line does not end with `\r\n`, trailing whitespace is still trimmed.
///
/// # Errors
///
/// Returns [`SmtpError::InvalidUtf8`] if the line is not valid UTF-8.
/// Returns [`SmtpError::SyntaxError`] if a recognized command has invalid syntax.
///
/// # Panics
///
/// None.
///
/// # Examples
///
/// ```
/// use signapps_smtp::parser::{parse_command, SmtpCommand};
///
/// let cmd = parse_command(b"MAIL FROM:<user@example.com> SIZE=1024\r\n").unwrap();
/// match cmd {
///     SmtpCommand::MailFrom { address, params } => {
///         assert_eq!(address, "user@example.com");
///         assert_eq!(params, vec![("SIZE".into(), "1024".into())]);
///     }
///     _ => panic!("unexpected command"),
/// }
/// ```
pub fn parse_command(line: &[u8]) -> Result<SmtpCommand, SmtpError> {
    let text = std::str::from_utf8(line).map_err(|_| SmtpError::InvalidUtf8)?;
    let trimmed = text.trim_end_matches("\r\n").trim_end_matches('\n').trim();

    if trimmed.is_empty() {
        return Err(SmtpError::SyntaxError("empty command".into()));
    }

    let upper = trimmed.to_uppercase();

    // Simple commands with no arguments
    if upper == "DATA" {
        return Ok(SmtpCommand::Data);
    }
    if upper == "QUIT" {
        return Ok(SmtpCommand::Quit);
    }
    if upper == "RSET" {
        return Ok(SmtpCommand::Rset);
    }
    if upper == "NOOP" || upper.starts_with("NOOP ") {
        return Ok(SmtpCommand::Noop);
    }
    if upper == "STARTTLS" {
        return Ok(SmtpCommand::StartTls);
    }

    // EHLO / HELO
    if upper.starts_with("EHLO ") {
        let domain = trimmed[5..].trim().to_string();
        if domain.is_empty() {
            return Err(SmtpError::SyntaxError("EHLO requires a domain".into()));
        }
        return Ok(SmtpCommand::Ehlo(domain));
    }
    if upper == "EHLO" {
        return Err(SmtpError::SyntaxError("EHLO requires a domain".into()));
    }
    if upper.starts_with("HELO ") {
        let domain = trimmed[5..].trim().to_string();
        if domain.is_empty() {
            return Err(SmtpError::SyntaxError("HELO requires a domain".into()));
        }
        return Ok(SmtpCommand::Helo(domain));
    }
    if upper == "HELO" {
        return Err(SmtpError::SyntaxError("HELO requires a domain".into()));
    }

    // MAIL FROM:<address> [params...]
    if upper.starts_with("MAIL FROM:") {
        let rest = trimmed[10..].trim();
        let (address, params) = parse_address_and_params(rest)?;
        return Ok(SmtpCommand::MailFrom { address, params });
    }
    if upper.starts_with("MAIL ") {
        return Err(SmtpError::SyntaxError(
            "MAIL requires FROM:<address>".into(),
        ));
    }

    // RCPT TO:<address> [params...]
    if upper.starts_with("RCPT TO:") {
        let rest = trimmed[8..].trim();
        let (address, params) = parse_address_and_params(rest)?;
        return Ok(SmtpCommand::RcptTo { address, params });
    }
    if upper.starts_with("RCPT ") {
        return Err(SmtpError::SyntaxError("RCPT requires TO:<address>".into()));
    }

    // AUTH mechanism [initial-response]
    if upper.starts_with("AUTH ") {
        let rest = trimmed[5..].trim();
        let mut parts = rest.splitn(2, ' ');
        let mechanism = parts.next().unwrap_or_default().to_uppercase();
        if mechanism.is_empty() {
            return Err(SmtpError::SyntaxError("AUTH requires a mechanism".into()));
        }
        // Validate it's a known mechanism (but store as-is for flexibility)
        let _ = SaslMechanism::parse(&mechanism)?;
        let initial_response = parts.next().map(|s| s.trim().to_string());
        return Ok(SmtpCommand::Auth {
            mechanism,
            initial_response,
        });
    }

    Ok(SmtpCommand::Unknown(trimmed.to_string()))
}

/// Parse an email address (optionally in angle brackets) followed by key=value parameters.
///
/// # Errors
///
/// Returns [`SmtpError::SyntaxError`] if angle brackets are mismatched.
fn parse_address_and_params(input: &str) -> Result<(String, Vec<(String, String)>), SmtpError> {
    let (address, rest) = if input.starts_with('<') {
        let end = input
            .find('>')
            .ok_or_else(|| SmtpError::SyntaxError("missing closing '>'".into()))?;
        let addr = input[1..end].trim().to_string();
        let remaining = input[end + 1..].trim();
        (addr, remaining)
    } else {
        // No angle brackets — take everything up to the first space
        let mut parts = input.splitn(2, ' ');
        let addr = parts.next().unwrap_or_default().to_string();
        let remaining = parts.next().unwrap_or_default().trim();
        (addr, remaining)
    };

    let mut params = Vec::new();
    if !rest.is_empty() {
        for token in rest.split_whitespace() {
            if let Some((key, value)) = token.split_once('=') {
                params.push((key.to_uppercase(), value.to_string()));
            }
            // Ignore tokens without '=' (per RFC 5321, unknown params are ignored)
        }
    }

    Ok((address, params))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_ehlo() {
        let cmd = parse_command(b"EHLO client.example.com\r\n").unwrap();
        assert_eq!(cmd, SmtpCommand::Ehlo("client.example.com".into()));
    }

    #[test]
    fn parse_ehlo_case_insensitive() {
        let cmd = parse_command(b"ehlo Client.Example.COM\r\n").unwrap();
        assert_eq!(cmd, SmtpCommand::Ehlo("Client.Example.COM".into()));
    }

    #[test]
    fn parse_helo() {
        let cmd = parse_command(b"HELO mx.example.com\r\n").unwrap();
        assert_eq!(cmd, SmtpCommand::Helo("mx.example.com".into()));
    }

    #[test]
    fn parse_mail_from_with_angle_brackets() {
        let cmd = parse_command(b"MAIL FROM:<user@example.com>\r\n").unwrap();
        assert_eq!(
            cmd,
            SmtpCommand::MailFrom {
                address: "user@example.com".into(),
                params: vec![],
            }
        );
    }

    #[test]
    fn parse_mail_from_with_size_param() {
        let cmd = parse_command(b"MAIL FROM:<user@example.com> SIZE=1024\r\n").unwrap();
        assert_eq!(
            cmd,
            SmtpCommand::MailFrom {
                address: "user@example.com".into(),
                params: vec![("SIZE".into(), "1024".into())],
            }
        );
    }

    #[test]
    fn parse_mail_from_with_multiple_params() {
        let cmd =
            parse_command(b"MAIL FROM:<user@example.com> SIZE=2048 BODY=8BITMIME\r\n").unwrap();
        assert_eq!(
            cmd,
            SmtpCommand::MailFrom {
                address: "user@example.com".into(),
                params: vec![
                    ("SIZE".into(), "2048".into()),
                    ("BODY".into(), "8BITMIME".into()),
                ],
            }
        );
    }

    #[test]
    fn parse_rcpt_to() {
        let cmd = parse_command(b"RCPT TO:<recipient@example.com>\r\n").unwrap();
        assert_eq!(
            cmd,
            SmtpCommand::RcptTo {
                address: "recipient@example.com".into(),
                params: vec![],
            }
        );
    }

    #[test]
    fn parse_data() {
        let cmd = parse_command(b"DATA\r\n").unwrap();
        assert_eq!(cmd, SmtpCommand::Data);
    }

    #[test]
    fn parse_quit() {
        let cmd = parse_command(b"QUIT\r\n").unwrap();
        assert_eq!(cmd, SmtpCommand::Quit);
    }

    #[test]
    fn parse_rset() {
        let cmd = parse_command(b"RSET\r\n").unwrap();
        assert_eq!(cmd, SmtpCommand::Rset);
    }

    #[test]
    fn parse_noop() {
        let cmd = parse_command(b"NOOP\r\n").unwrap();
        assert_eq!(cmd, SmtpCommand::Noop);
    }

    #[test]
    fn parse_starttls() {
        let cmd = parse_command(b"STARTTLS\r\n").unwrap();
        assert_eq!(cmd, SmtpCommand::StartTls);
    }

    #[test]
    fn parse_auth_plain_with_initial() {
        let cmd = parse_command(b"AUTH PLAIN dGVzdAB0ZXN0AHBhc3M=\r\n").unwrap();
        assert_eq!(
            cmd,
            SmtpCommand::Auth {
                mechanism: "PLAIN".into(),
                initial_response: Some("dGVzdAB0ZXN0AHBhc3M=".into()),
            }
        );
    }

    #[test]
    fn parse_auth_login_no_initial() {
        let cmd = parse_command(b"AUTH LOGIN\r\n").unwrap();
        assert_eq!(
            cmd,
            SmtpCommand::Auth {
                mechanism: "LOGIN".into(),
                initial_response: None,
            }
        );
    }

    #[test]
    fn parse_auth_xoauth2() {
        let cmd = parse_command(b"AUTH XOAUTH2 somebase64data\r\n").unwrap();
        assert_eq!(
            cmd,
            SmtpCommand::Auth {
                mechanism: "XOAUTH2".into(),
                initial_response: Some("somebase64data".into()),
            }
        );
    }

    #[test]
    fn parse_unknown_command() {
        let cmd = parse_command(b"VRFY user@example.com\r\n").unwrap();
        assert_eq!(cmd, SmtpCommand::Unknown("VRFY user@example.com".into()));
    }

    #[test]
    fn parse_empty_returns_error() {
        let result = parse_command(b"\r\n");
        assert!(result.is_err());
    }

    #[test]
    fn parse_mail_from_empty_address() {
        // Bounce address (empty sender) is valid per RFC 5321
        let cmd = parse_command(b"MAIL FROM:<>\r\n").unwrap();
        assert_eq!(
            cmd,
            SmtpCommand::MailFrom {
                address: String::new(),
                params: vec![],
            }
        );
    }
}
