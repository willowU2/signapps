//! SMTP envelope types.
//!
//! An [`SmtpEnvelope`] captures the sender, recipients, and raw message data
//! accumulated during an SMTP DATA transfer. It is produced by the session
//! state machine when the end-of-data marker (`.` on a line by itself) is received.

/// An SMTP message envelope.
///
/// Contains the routing information (MAIL FROM / RCPT TO) and the raw message
/// bytes collected during the DATA phase. The message data includes all headers
/// and body as transmitted by the client.
///
/// # Examples
///
/// ```
/// use signapps_smtp::SmtpEnvelope;
///
/// let envelope = SmtpEnvelope {
///     sender: "alice@example.com".into(),
///     recipients: vec!["bob@example.com".into()],
///     data: b"From: alice@example.com\r\nTo: bob@example.com\r\n\r\nHello".to_vec(),
/// };
/// assert_eq!(envelope.recipients.len(), 1);
/// ```
#[derive(Debug, Clone, PartialEq)]
pub struct SmtpEnvelope {
    /// The envelope sender (MAIL FROM address). Empty string for bounce messages.
    pub sender: String,
    /// The envelope recipients (RCPT TO addresses). At least one is guaranteed.
    pub recipients: Vec<String>,
    /// The raw message data (headers + body) as received during DATA.
    pub data: Vec<u8>,
}
