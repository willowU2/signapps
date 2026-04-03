//! IMAP response builder.
//!
//! Constructs IMAP response lines: untagged (`*`), tagged (`tag OK/NO/BAD`),
//! and continuation (`+`). Provides helper functions for common response
//! patterns (CAPABILITY, LIST, STATUS, FETCH, SEARCH, FLAGS, EXISTS, RECENT).
//!
//! # Examples
//!
//! ```
//! use signapps_imap::response::{ImapResponse, capability_response};
//!
//! let caps = vec!["IMAP4rev2".to_string(), "IDLE".to_string()];
//! let resp = capability_response(&caps);
//! let bytes = resp.to_bytes();
//! assert!(String::from_utf8_lossy(&bytes).contains("IMAP4rev2"));
//! ```

/// An IMAP response line.
///
/// IMAP responses come in three forms:
/// - **Untagged** (`* ...`): server-initiated data or status.
/// - **Tagged** (`tag OK/NO/BAD ...`): command completion response.
/// - **Continue** (`+ ...`): continuation request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ImapResponse {
    /// Untagged response: `* <content>\r\n`.
    Untagged(String),
    /// Tagged response: `<tag> <content>\r\n`.
    Tagged(String, String),
    /// Continuation response: `+ <content>\r\n`.
    Continue(String),
}

impl ImapResponse {
    /// Serialize the response to bytes suitable for writing to the network.
    ///
    /// Each response is terminated with `\r\n`.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_imap::response::ImapResponse;
    ///
    /// let resp = ImapResponse::Untagged("OK ready".to_string());
    /// assert_eq!(resp.to_bytes(), b"* OK ready\r\n");
    /// ```
    ///
    /// # Panics
    ///
    /// This function does not panic.
    pub fn to_bytes(&self) -> Vec<u8> {
        match self {
            ImapResponse::Untagged(content) => format!("* {}\r\n", content).into_bytes(),
            ImapResponse::Tagged(tag, content) => format!("{} {}\r\n", tag, content).into_bytes(),
            ImapResponse::Continue(content) => format!("+ {}\r\n", content).into_bytes(),
        }
    }
}

/// Build a CAPABILITY response listing server capabilities.
///
/// # Examples
///
/// ```
/// use signapps_imap::response::capability_response;
///
/// let resp = capability_response(&["IMAP4rev2".to_string(), "IDLE".to_string()]);
/// let bytes = resp.to_bytes();
/// let s = String::from_utf8(bytes).unwrap();
/// assert!(s.starts_with("* CAPABILITY"));
/// assert!(s.contains("IMAP4rev2"));
/// ```
///
/// # Panics
///
/// This function does not panic.
pub fn capability_response(caps: &[String]) -> ImapResponse {
    ImapResponse::Untagged(format!("CAPABILITY {}", caps.join(" ")))
}

/// Build a LIST response for a single mailbox.
///
/// # Examples
///
/// ```
/// use signapps_imap::response::list_response;
///
/// let resp = list_response(&["\\HasNoChildren", "\\Sent"], "/", "Sent");
/// let bytes = resp.to_bytes();
/// let s = String::from_utf8(bytes).unwrap();
/// assert!(s.contains("LIST"));
/// assert!(s.contains("\"Sent\""));
/// ```
///
/// # Panics
///
/// This function does not panic.
pub fn list_response(flags: &[&str], delimiter: &str, name: &str) -> ImapResponse {
    let flags_str = flags.join(" ");
    ImapResponse::Untagged(format!(
        "LIST ({}) \"{}\" \"{}\"",
        flags_str, delimiter, name
    ))
}

/// Build a STATUS response for a mailbox.
///
/// # Examples
///
/// ```
/// use signapps_imap::response::status_response;
///
/// let resp = status_response("INBOX", &[
///     ("MESSAGES".to_string(), 42),
///     ("UNSEEN".to_string(), 5),
/// ]);
/// let bytes = resp.to_bytes();
/// let s = String::from_utf8(bytes).unwrap();
/// assert!(s.contains("STATUS \"INBOX\""));
/// ```
///
/// # Panics
///
/// This function does not panic.
pub fn status_response(mailbox: &str, items: &[(String, u32)]) -> ImapResponse {
    let items_str: Vec<String> = items.iter().map(|(k, v)| format!("{} {}", k, v)).collect();
    ImapResponse::Untagged(format!("STATUS \"{}\" ({})", mailbox, items_str.join(" ")))
}

/// Build a FETCH response for a single message.
///
/// # Examples
///
/// ```
/// use signapps_imap::response::fetch_response;
///
/// let resp = fetch_response(1, vec![
///     ("FLAGS".to_string(), "(\\Seen)".to_string()),
///     ("UID".to_string(), "10".to_string()),
/// ]);
/// let bytes = resp.to_bytes();
/// let s = String::from_utf8(bytes).unwrap();
/// assert!(s.contains("1 FETCH"));
/// ```
///
/// # Panics
///
/// This function does not panic.
pub fn fetch_response(seq: u32, items: Vec<(String, String)>) -> ImapResponse {
    let data: Vec<String> = items.iter().map(|(k, v)| format!("{} {}", k, v)).collect();
    ImapResponse::Untagged(format!("{} FETCH ({})", seq, data.join(" ")))
}

/// Build a SEARCH response with a list of UIDs.
///
/// # Examples
///
/// ```
/// use signapps_imap::response::search_response;
///
/// let resp = search_response(&[1, 5, 10]);
/// let bytes = resp.to_bytes();
/// let s = String::from_utf8(bytes).unwrap();
/// assert!(s.contains("SEARCH 1 5 10"));
/// ```
///
/// # Panics
///
/// This function does not panic.
pub fn search_response(uids: &[u32]) -> ImapResponse {
    let uid_list: Vec<String> = uids.iter().map(|u| u.to_string()).collect();
    ImapResponse::Untagged(format!("SEARCH {}", uid_list.join(" ")))
}

/// Build a FLAGS response listing available flags for the mailbox.
///
/// # Examples
///
/// ```
/// use signapps_imap::response::flags_response;
///
/// let resp = flags_response(&["\\Seen", "\\Answered", "\\Flagged", "\\Deleted", "\\Draft"]);
/// let bytes = resp.to_bytes();
/// let s = String::from_utf8(bytes).unwrap();
/// assert!(s.contains("FLAGS (\\Seen"));
/// ```
///
/// # Panics
///
/// This function does not panic.
pub fn flags_response(flags: &[&str]) -> ImapResponse {
    ImapResponse::Untagged(format!("FLAGS ({})", flags.join(" ")))
}

/// Build an EXISTS response indicating the total message count.
///
/// # Examples
///
/// ```
/// use signapps_imap::response::exists_response;
///
/// let resp = exists_response(42);
/// assert_eq!(resp.to_bytes(), b"* 42 EXISTS\r\n");
/// ```
///
/// # Panics
///
/// This function does not panic.
pub fn exists_response(count: u32) -> ImapResponse {
    ImapResponse::Untagged(format!("{} EXISTS", count))
}

/// Build a RECENT response indicating the count of recent messages.
///
/// # Examples
///
/// ```
/// use signapps_imap::response::recent_response;
///
/// let resp = recent_response(3);
/// assert_eq!(resp.to_bytes(), b"* 3 RECENT\r\n");
/// ```
///
/// # Panics
///
/// This function does not panic.
pub fn recent_response(count: u32) -> ImapResponse {
    ImapResponse::Untagged(format!("{} RECENT", count))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_untagged_to_bytes() {
        let resp = ImapResponse::Untagged("OK ready".to_string());
        assert_eq!(resp.to_bytes(), b"* OK ready\r\n");
    }

    #[test]
    fn test_tagged_to_bytes() {
        let resp = ImapResponse::Tagged("a001".to_string(), "OK LOGIN completed".to_string());
        assert_eq!(resp.to_bytes(), b"a001 OK LOGIN completed\r\n");
    }

    #[test]
    fn test_continue_to_bytes() {
        let resp = ImapResponse::Continue("ready for literal".to_string());
        assert_eq!(resp.to_bytes(), b"+ ready for literal\r\n");
    }

    #[test]
    fn test_capability_response() {
        let caps = vec![
            "IMAP4rev2".to_string(),
            "IDLE".to_string(),
            "NAMESPACE".to_string(),
        ];
        let resp = capability_response(&caps);
        let s = String::from_utf8(resp.to_bytes()).unwrap();
        assert!(s.starts_with("* CAPABILITY IMAP4rev2 IDLE NAMESPACE\r\n"));
    }

    #[test]
    fn test_list_response() {
        let resp = list_response(&["\\HasNoChildren", "\\Sent"], "/", "Sent");
        let s = String::from_utf8(resp.to_bytes()).unwrap();
        assert_eq!(s, "* LIST (\\HasNoChildren \\Sent) \"/\" \"Sent\"\r\n");
    }

    #[test]
    fn test_status_response() {
        let resp = status_response(
            "INBOX",
            &[("MESSAGES".to_string(), 42), ("UNSEEN".to_string(), 5)],
        );
        let s = String::from_utf8(resp.to_bytes()).unwrap();
        assert_eq!(s, "* STATUS \"INBOX\" (MESSAGES 42 UNSEEN 5)\r\n");
    }

    #[test]
    fn test_fetch_response() {
        let resp = fetch_response(
            1,
            vec![
                ("FLAGS".to_string(), "(\\Seen)".to_string()),
                ("UID".to_string(), "10".to_string()),
            ],
        );
        let s = String::from_utf8(resp.to_bytes()).unwrap();
        assert_eq!(s, "* 1 FETCH (FLAGS (\\Seen) UID 10)\r\n");
    }

    #[test]
    fn test_search_response() {
        let resp = search_response(&[1, 5, 10, 42]);
        let s = String::from_utf8(resp.to_bytes()).unwrap();
        assert_eq!(s, "* SEARCH 1 5 10 42\r\n");
    }

    #[test]
    fn test_search_response_empty() {
        let resp = search_response(&[]);
        let s = String::from_utf8(resp.to_bytes()).unwrap();
        assert_eq!(s, "* SEARCH \r\n");
    }

    #[test]
    fn test_flags_response() {
        let resp = flags_response(&["\\Seen", "\\Answered", "\\Flagged"]);
        let s = String::from_utf8(resp.to_bytes()).unwrap();
        assert_eq!(s, "* FLAGS (\\Seen \\Answered \\Flagged)\r\n");
    }

    #[test]
    fn test_exists_response() {
        let resp = exists_response(100);
        assert_eq!(resp.to_bytes(), b"* 100 EXISTS\r\n");
    }

    #[test]
    fn test_recent_response() {
        let resp = recent_response(0);
        assert_eq!(resp.to_bytes(), b"* 0 RECENT\r\n");
    }
}
