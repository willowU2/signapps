//! FETCH item parser and response builder.
//!
//! Parses IMAP FETCH data item specifiers (e.g. `FLAGS`, `ENVELOPE`,
//! `BODY[HEADER]`) and builds FETCH response lines from key-value pairs.
//!
//! # Examples
//!
//! ```
//! use signapps_imap::fetch::{parse_fetch_items, FetchItem};
//!
//! let items = parse_fetch_items("(FLAGS UID ENVELOPE)");
//! assert_eq!(items.len(), 3);
//! ```

/// A single FETCH data item specifier.
///
/// Represents what data the client wants to retrieve for each message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FetchItem {
    /// Macro for: FLAGS, INTERNALDATE, RFC822.SIZE, ENVELOPE.
    All,
    /// Macro for: FLAGS, INTERNALDATE, RFC822.SIZE.
    Fast,
    /// Macro for: FLAGS, INTERNALDATE, RFC822.SIZE, ENVELOPE, BODY.
    Full,
    /// The envelope structure of the message.
    Envelope,
    /// The flags set on this message.
    Flags,
    /// The internal date of the message.
    InternalDate,
    /// The full RFC 2822 message.
    Rfc822,
    /// The RFC 2822 header of the message.
    Rfc822Header,
    /// The size of the message in bytes.
    Rfc822Size,
    /// The text body of the message.
    Rfc822Text,
    /// The MIME body structure (non-extensible).
    Body,
    /// The MIME body structure (extensible).
    BodyStructure,
    /// A specific body section with optional partial range.
    BodySection {
        /// Section specifier (e.g. `"HEADER"`, `"1.TEXT"`, `""`).
        section: String,
        /// Optional partial byte range `(offset, count)`.
        partial: Option<(u32, u32)>,
    },
    /// The unique identifier of the message.
    Uid,
    /// The modification sequence number (CONDSTORE).
    Modseq,
}

/// Parse a FETCH item list from the argument string.
///
/// Accepts both parenthesized lists `(FLAGS UID)` and single items `FLAGS`.
///
/// # Examples
///
/// ```
/// use signapps_imap::fetch::{parse_fetch_items, FetchItem};
///
/// let items = parse_fetch_items("(FLAGS UID RFC822.SIZE)");
/// assert_eq!(items.len(), 3);
/// assert!(items.contains(&FetchItem::Flags));
/// assert!(items.contains(&FetchItem::Uid));
/// assert!(items.contains(&FetchItem::Rfc822Size));
/// ```
///
/// # Panics
///
/// This function does not panic.
pub fn parse_fetch_items(s: &str) -> Vec<FetchItem> {
    let s = s.trim();
    let inner = if s.starts_with('(') {
        let end = s.rfind(')').unwrap_or(s.len());
        &s[1..end]
    } else {
        s
    };

    let mut items = Vec::new();
    let mut chars = inner.chars().peekable();

    while chars.peek().is_some() {
        // Skip whitespace
        while let Some(&c) = chars.peek() {
            if c.is_whitespace() {
                chars.next();
            } else {
                break;
            }
        }

        if chars.peek().is_none() {
            break;
        }

        // Collect the next token
        let mut token = String::new();
        while let Some(&c) = chars.peek() {
            if c.is_whitespace() || c == ')' {
                break;
            }
            if c == '[' {
                // BODY[section] or BODY.PEEK[section]
                token.push(c);
                chars.next();
                // Collect until ']'
                while let Some(&inner_c) = chars.peek() {
                    token.push(inner_c);
                    chars.next();
                    if inner_c == ']' {
                        break;
                    }
                }
                // Check for partial <offset.count>
                if let Some(&'<') = chars.peek() {
                    token.push('<');
                    chars.next();
                    while let Some(&pc) = chars.peek() {
                        token.push(pc);
                        chars.next();
                        if pc == '>' {
                            break;
                        }
                    }
                }
                continue;
            }
            token.push(c);
            chars.next();
        }

        if token.is_empty() {
            continue;
        }

        let item = parse_single_fetch_item(&token);
        if let Some(item) = item {
            items.push(item);
        }
    }

    items
}

/// Parse a single FETCH item token into a [`FetchItem`].
fn parse_single_fetch_item(token: &str) -> Option<FetchItem> {
    let upper = token.to_uppercase();

    // Handle BODY[section]<partial> and BODY.PEEK[section]<partial>
    if upper.starts_with("BODY[") || upper.starts_with("BODY.PEEK[") {
        let bracket_start = token.find('[').unwrap_or(0);
        let bracket_end = token.find(']').unwrap_or(token.len());
        let section = token[bracket_start + 1..bracket_end].to_string();

        let partial = if let Some(angle_start) = token.find('<') {
            let angle_end = token.find('>').unwrap_or(token.len());
            let range_str = &token[angle_start + 1..angle_end];
            let parts: Vec<&str> = range_str.split('.').collect();
            if parts.len() == 2 {
                let offset: u32 = parts[0].parse().ok()?;
                let count: u32 = parts[1].parse().ok()?;
                Some((offset, count))
            } else {
                None
            }
        } else {
            None
        };

        return Some(FetchItem::BodySection { section, partial });
    }

    match upper.as_str() {
        "ALL" => Some(FetchItem::All),
        "FAST" => Some(FetchItem::Fast),
        "FULL" => Some(FetchItem::Full),
        "ENVELOPE" => Some(FetchItem::Envelope),
        "FLAGS" => Some(FetchItem::Flags),
        "INTERNALDATE" => Some(FetchItem::InternalDate),
        "RFC822" => Some(FetchItem::Rfc822),
        "RFC822.HEADER" => Some(FetchItem::Rfc822Header),
        "RFC822.SIZE" => Some(FetchItem::Rfc822Size),
        "RFC822.TEXT" => Some(FetchItem::Rfc822Text),
        "BODY" => Some(FetchItem::Body),
        "BODYSTRUCTURE" => Some(FetchItem::BodyStructure),
        "UID" => Some(FetchItem::Uid),
        "MODSEQ" => Some(FetchItem::Modseq),
        _ => None,
    }
}

/// Build a FETCH response data string for a single message.
///
/// Takes a sequence number and a list of `(item_name, item_value)` pairs,
/// and returns the formatted untagged FETCH response line.
///
/// # Examples
///
/// ```
/// use signapps_imap::fetch::build_fetch_response;
///
/// let line = build_fetch_response(1, &[
///     ("FLAGS".to_string(), "(\\Seen)".to_string()),
///     ("UID".to_string(), "42".to_string()),
/// ]);
/// assert_eq!(line, "* 1 FETCH (FLAGS (\\Seen) UID 42)");
/// ```
///
/// # Panics
///
/// This function does not panic.
pub fn build_fetch_response(seq: u32, items: &[(String, String)]) -> String {
    let data: Vec<String> = items.iter().map(|(k, v)| format!("{} {}", k, v)).collect();
    format!("* {} FETCH ({})", seq, data.join(" "))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_single_flags() {
        let items = parse_fetch_items("FLAGS");
        assert_eq!(items, vec![FetchItem::Flags]);
    }

    #[test]
    fn test_parse_parenthesized_list() {
        let items = parse_fetch_items("(FLAGS UID ENVELOPE RFC822.SIZE)");
        assert_eq!(items.len(), 4);
        assert!(items.contains(&FetchItem::Flags));
        assert!(items.contains(&FetchItem::Uid));
        assert!(items.contains(&FetchItem::Envelope));
        assert!(items.contains(&FetchItem::Rfc822Size));
    }

    #[test]
    fn test_parse_all_macro() {
        let items = parse_fetch_items("ALL");
        assert_eq!(items, vec![FetchItem::All]);
    }

    #[test]
    fn test_parse_body_section() {
        let items = parse_fetch_items("BODY[HEADER]");
        assert_eq!(items.len(), 1);
        match &items[0] {
            FetchItem::BodySection { section, partial } => {
                assert_eq!(section, "HEADER");
                assert!(partial.is_none());
            },
            other => panic!("Expected BodySection, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_body_section_with_partial() {
        let items = parse_fetch_items("BODY[]<0.512>");
        assert_eq!(items.len(), 1);
        match &items[0] {
            FetchItem::BodySection { section, partial } => {
                assert_eq!(section, "");
                assert_eq!(*partial, Some((0, 512)));
            },
            other => panic!("Expected BodySection, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_body_peek() {
        let items = parse_fetch_items("BODY.PEEK[TEXT]");
        assert_eq!(items.len(), 1);
        match &items[0] {
            FetchItem::BodySection { section, .. } => {
                assert_eq!(section, "TEXT");
            },
            other => panic!("Expected BodySection, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_mixed_items() {
        let items = parse_fetch_items("(FLAGS BODY[HEADER] UID BODYSTRUCTURE)");
        assert_eq!(items.len(), 4);
        assert!(items.contains(&FetchItem::Flags));
        assert!(items.contains(&FetchItem::Uid));
        assert!(items.contains(&FetchItem::BodyStructure));
    }

    #[test]
    fn test_build_fetch_response() {
        let line = build_fetch_response(
            5,
            &[
                ("FLAGS".to_string(), "(\\Seen \\Answered)".to_string()),
                ("UID".to_string(), "123".to_string()),
                ("RFC822.SIZE".to_string(), "4096".to_string()),
            ],
        );
        assert_eq!(
            line,
            "* 5 FETCH (FLAGS (\\Seen \\Answered) UID 123 RFC822.SIZE 4096)"
        );
    }

    #[test]
    fn test_parse_empty() {
        let items = parse_fetch_items("");
        assert!(items.is_empty());
    }
}
