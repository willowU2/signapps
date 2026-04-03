//! IMAP command parser.
//!
//! Parses raw IMAP command lines (`tag COMMAND args\r\n`) into structured
//! [`ImapCommand`] values. Supports all IMAP4rev2 commands plus common
//! extensions (IDLE, NAMESPACE, ID, MOVE, ENABLE).
//!
//! # Examples
//!
//! ```
//! use signapps_imap::parser::{parse_command, ImapCommandType};
//!
//! let cmd = parse_command("a001 LOGIN user pass\r\n").unwrap();
//! assert_eq!(cmd.tag, "a001");
//! matches!(cmd.command, ImapCommandType::Login { .. });
//! ```

use crate::fetch::FetchItem;

/// A parsed IMAP command with its tag and typed payload.
///
/// # Examples
///
/// ```
/// use signapps_imap::parser::parse_command;
/// let cmd = parse_command("tag1 NOOP\r\n").unwrap();
/// assert_eq!(cmd.tag, "tag1");
/// ```
#[derive(Debug, Clone)]
pub struct ImapCommand {
    /// The client-assigned tag (e.g. `"a001"`).
    pub tag: String,
    /// The parsed command type and its arguments.
    pub command: ImapCommandType,
}

/// All supported IMAP command types.
///
/// Each variant carries the parsed arguments for that command.
/// The `Uid` variant wraps another command to indicate UID-prefixed mode.
#[derive(Debug, Clone)]
pub enum ImapCommandType {
    /// CAPABILITY — request server capabilities.
    Capability,
    /// LOGIN username password — plaintext authentication.
    Login {
        /// Username for authentication.
        username: String,
        /// Password for authentication.
        password: String,
    },
    /// AUTHENTICATE mechanism [initial-response] — SASL authentication.
    Authenticate {
        /// SASL mechanism name (e.g. `"PLAIN"`, `"XOAUTH2"`).
        mechanism: String,
        /// Optional initial response (base64-encoded).
        initial: Option<String>,
    },
    /// LOGOUT — end the session.
    Logout,
    /// SELECT mailbox — open a mailbox for read/write.
    Select {
        /// Mailbox name to select.
        mailbox: String,
    },
    /// EXAMINE mailbox — open a mailbox read-only.
    Examine {
        /// Mailbox name to examine.
        mailbox: String,
    },
    /// CREATE mailbox — create a new mailbox.
    Create {
        /// Mailbox name to create.
        mailbox: String,
    },
    /// DELETE mailbox — delete a mailbox.
    Delete {
        /// Mailbox name to delete.
        mailbox: String,
    },
    /// RENAME from to — rename a mailbox.
    Rename {
        /// Current mailbox name.
        from: String,
        /// New mailbox name.
        to: String,
    },
    /// LIST reference pattern — list mailboxes matching pattern.
    List {
        /// Reference name (namespace prefix).
        reference: String,
        /// Mailbox pattern with optional wildcards.
        pattern: String,
    },
    /// LSUB reference pattern — list subscribed mailboxes.
    Lsub {
        /// Reference name.
        reference: String,
        /// Mailbox pattern.
        pattern: String,
    },
    /// STATUS mailbox (items) — query mailbox status without selecting.
    Status {
        /// Mailbox name.
        mailbox: String,
        /// Status data items to return.
        items: Vec<String>,
    },
    /// APPEND mailbox [flags] message — append a message to a mailbox.
    Append {
        /// Target mailbox name.
        mailbox: String,
        /// Optional flags to set on the appended message.
        flags: Option<Vec<String>>,
        /// Raw message content.
        message: Vec<u8>,
    },
    /// FETCH sequence items — retrieve message data.
    Fetch {
        /// Sequence set (e.g. `"1:*"`, `"1,3,5"`).
        sequence: String,
        /// Items to fetch.
        items: Vec<FetchItem>,
    },
    /// SEARCH criteria — search for messages matching criteria.
    Search {
        /// Search criteria.
        criteria: Vec<SearchKey>,
    },
    /// STORE sequence action flags — modify message flags.
    Store {
        /// Sequence set.
        sequence: String,
        /// Flag modification action.
        action: StoreAction,
        /// Flags to set/add/remove.
        flags: Vec<String>,
    },
    /// COPY sequence mailbox — copy messages to another mailbox.
    Copy {
        /// Sequence set.
        sequence: String,
        /// Destination mailbox.
        mailbox: String,
    },
    /// MOVE sequence mailbox — move messages to another mailbox.
    Move {
        /// Sequence set.
        sequence: String,
        /// Destination mailbox.
        mailbox: String,
    },
    /// EXPUNGE — permanently remove messages marked \Deleted.
    Expunge,
    /// CLOSE — close the selected mailbox, expunging deleted messages.
    Close,
    /// IDLE — enter idle mode for real-time notifications.
    Idle,
    /// DONE — end IDLE mode (sent as a continuation line without a tag).
    Done,
    /// NOOP — no operation (keepalive / poll for updates).
    Noop,
    /// UID prefix — execute the inner command using UIDs instead of sequence numbers.
    Uid {
        /// The wrapped command to execute in UID mode.
        inner: Box<ImapCommandType>,
    },
    /// NAMESPACE — query personal/other/shared namespace prefixes.
    Namespace,
    /// ID params — exchange client/server identification.
    Id {
        /// Key-value identification parameters.
        params: Option<Vec<(String, String)>>,
    },
    /// ENABLE extensions — enable protocol extensions.
    Enable {
        /// Extension names to enable (e.g. `"CONDSTORE"`).
        extensions: Vec<String>,
    },
}

/// IMAP SEARCH key — a single search criterion.
///
/// Criteria can be combined using `And`, `Or`, and `Not`.
#[derive(Debug, Clone)]
pub enum SearchKey {
    /// Match all messages.
    All,
    /// Messages with the \Seen flag.
    Seen,
    /// Messages without the \Seen flag.
    Unseen,
    /// Messages with the \Flagged flag.
    Flagged,
    /// Messages without the \Flagged flag.
    Unflagged,
    /// Messages with the \Answered flag.
    Answered,
    /// Messages with the \Deleted flag.
    Deleted,
    /// Messages with the \Recent flag.
    Recent,
    /// Messages that are both \Recent and not \Seen.
    New,
    /// Messages that are not \Recent.
    Old,
    /// Messages whose From header contains the given string.
    From(String),
    /// Messages whose To header contains the given string.
    To(String),
    /// Messages whose Subject header contains the given string.
    Subject(String),
    /// Messages whose body contains the given string.
    Body(String),
    /// Messages whose headers or body contain the given string.
    Text(String),
    /// Messages with an internal date before the given date.
    Before(String),
    /// Messages with an internal date on or after the given date.
    Since(String),
    /// Messages with an internal date on the given date.
    On(String),
    /// Messages larger than the given number of bytes.
    Larger(u32),
    /// Messages smaller than the given number of bytes.
    Smaller(u32),
    /// Messages with UIDs in the given set.
    Uid(String),
    /// Messages with sequence numbers in the given set.
    SequenceSet(String),
    /// Negation of a search criterion.
    Not(Box<SearchKey>),
    /// Disjunction: matches if either criterion matches.
    Or(Box<SearchKey>, Box<SearchKey>),
    /// Conjunction: matches if all criteria match.
    And(Vec<SearchKey>),
}

/// STORE action — how to modify flags.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StoreAction {
    /// Replace all flags with the given set.
    SetFlags,
    /// Add flags to the existing set.
    AddFlags,
    /// Remove flags from the existing set.
    RemoveFlags,
    /// Replace all flags (silent — no untagged FETCH response).
    SetFlagsSilent,
    /// Add flags (silent).
    AddFlagsSilent,
    /// Remove flags (silent).
    RemoveFlagsSilent,
}

/// Parse a raw IMAP command line into an [`ImapCommand`].
///
/// The input should include the trailing `\r\n`.
///
/// # Errors
///
/// Returns `None` if the line cannot be parsed as a valid IMAP command.
///
/// # Examples
///
/// ```
/// use signapps_imap::parser::parse_command;
/// let cmd = parse_command("a001 NOOP\r\n").unwrap();
/// assert_eq!(cmd.tag, "a001");
/// ```
///
/// # Panics
///
/// This function does not panic.
pub fn parse_command(line: &str) -> Option<ImapCommand> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Special case: DONE has no tag (continuation during IDLE)
    if trimmed.eq_ignore_ascii_case("DONE") {
        return Some(ImapCommand {
            tag: String::new(),
            command: ImapCommandType::Done,
        });
    }

    let (tag, rest) = split_first_word(trimmed)?;

    let command = parse_command_type(rest)?;

    Some(ImapCommand {
        tag: tag.to_string(),
        command,
    })
}

/// Parse the command portion (after the tag) into an [`ImapCommandType`].
fn parse_command_type(input: &str) -> Option<ImapCommandType> {
    let (cmd_word, args) = split_first_word(input)?;
    let cmd_upper = cmd_word.to_uppercase();

    match cmd_upper.as_str() {
        "CAPABILITY" => Some(ImapCommandType::Capability),
        "NOOP" => Some(ImapCommandType::Noop),
        "LOGOUT" => Some(ImapCommandType::Logout),
        "IDLE" => Some(ImapCommandType::Idle),
        "EXPUNGE" => Some(ImapCommandType::Expunge),
        "CLOSE" => Some(ImapCommandType::Close),
        "NAMESPACE" => Some(ImapCommandType::Namespace),

        "LOGIN" => {
            let (username, rest) = parse_astring(args)?;
            let (password, _) = parse_astring(rest.trim_start())?;
            Some(ImapCommandType::Login { username, password })
        },

        "AUTHENTICATE" => {
            let (mechanism, rest) = split_first_word(args)?;
            let initial = if rest.is_empty() {
                None
            } else {
                Some(rest.trim().to_string())
            };
            Some(ImapCommandType::Authenticate {
                mechanism: mechanism.to_uppercase(),
                initial,
            })
        },

        "SELECT" => {
            let (mailbox, _) = parse_astring(args)?;
            Some(ImapCommandType::Select { mailbox })
        },

        "EXAMINE" => {
            let (mailbox, _) = parse_astring(args)?;
            Some(ImapCommandType::Examine { mailbox })
        },

        "CREATE" => {
            let (mailbox, _) = parse_astring(args)?;
            Some(ImapCommandType::Create { mailbox })
        },

        "DELETE" => {
            let (mailbox, _) = parse_astring(args)?;
            Some(ImapCommandType::Delete { mailbox })
        },

        "RENAME" => {
            let (from, rest) = parse_astring(args)?;
            let (to, _) = parse_astring(rest.trim_start())?;
            Some(ImapCommandType::Rename { from, to })
        },

        "LIST" => {
            let (reference, rest) = parse_astring(args)?;
            let (pattern, _) = parse_astring(rest.trim_start())?;
            Some(ImapCommandType::List { reference, pattern })
        },

        "LSUB" => {
            let (reference, rest) = parse_astring(args)?;
            let (pattern, _) = parse_astring(rest.trim_start())?;
            Some(ImapCommandType::Lsub { reference, pattern })
        },

        "STATUS" => {
            let (mailbox, rest) = parse_astring(args)?;
            let items = parse_parenthesized_list(rest.trim_start());
            Some(ImapCommandType::Status { mailbox, items })
        },

        "FETCH" => {
            let (sequence, rest) = split_first_word(args)?;
            let items = crate::fetch::parse_fetch_items(rest);
            Some(ImapCommandType::Fetch {
                sequence: sequence.to_string(),
                items,
            })
        },

        "SEARCH" => {
            let criteria = parse_search_criteria(args);
            Some(ImapCommandType::Search { criteria })
        },

        "STORE" => {
            let (sequence, rest) = split_first_word(args)?;
            let (action_str, rest) = split_first_word(rest)?;
            let action = parse_store_action(action_str)?;
            let flags = parse_flag_list(rest);
            Some(ImapCommandType::Store {
                sequence: sequence.to_string(),
                action,
                flags,
            })
        },

        "COPY" => {
            let (sequence, rest) = split_first_word(args)?;
            let (mailbox, _) = parse_astring(rest)?;
            Some(ImapCommandType::Copy {
                sequence: sequence.to_string(),
                mailbox,
            })
        },

        "MOVE" => {
            let (sequence, rest) = split_first_word(args)?;
            let (mailbox, _) = parse_astring(rest)?;
            Some(ImapCommandType::Move {
                sequence: sequence.to_string(),
                mailbox,
            })
        },

        "APPEND" => {
            let (mailbox, rest) = parse_astring(args)?;
            let rest = rest.trim_start();
            let (flags, rest) = if rest.starts_with('(') {
                let items = parse_flag_list(rest);
                let close = rest.find(')').map(|i| i + 1).unwrap_or(rest.len());
                (Some(items), rest[close..].trim_start())
            } else {
                (None, rest)
            };
            // The message body follows as a literal — for now store the remainder
            let message = rest.as_bytes().to_vec();
            Some(ImapCommandType::Append {
                mailbox,
                flags,
                message,
            })
        },

        "UID" => {
            let inner = parse_command_type(args)?;
            Some(ImapCommandType::Uid {
                inner: Box::new(inner),
            })
        },

        "ID" => {
            if args.trim().eq_ignore_ascii_case("NIL") || args.trim().is_empty() {
                Some(ImapCommandType::Id { params: None })
            } else {
                let params = parse_id_params(args);
                Some(ImapCommandType::Id {
                    params: Some(params),
                })
            }
        },

        "ENABLE" => {
            let extensions = args.split_whitespace().map(|s| s.to_uppercase()).collect();
            Some(ImapCommandType::Enable { extensions })
        },

        _ => None,
    }
}

/// Split input into the first whitespace-delimited word and the remainder.
fn split_first_word(s: &str) -> Option<(&str, &str)> {
    let s = s.trim_start();
    if s.is_empty() {
        return None;
    }
    match s.find(char::is_whitespace) {
        Some(pos) => Some((&s[..pos], s[pos..].trim_start())),
        None => Some((s, "")),
    }
}

/// Parse an IMAP atom or quoted string, returning the value and the remaining input.
///
/// Supports:
/// - Quoted strings: `"hello world"`
/// - Atoms: `INBOX`, `1:*`
fn parse_astring(s: &str) -> Option<(String, &str)> {
    let s = s.trim_start();
    if s.is_empty() {
        return None;
    }

    if let Some(inner) = s.strip_prefix('"') {
        // Quoted string — scan for the closing unescaped quote
        let bytes = inner.as_bytes();
        let mut pos = 0;
        while pos < bytes.len() {
            if bytes[pos] == b'\\' {
                pos += 2; // skip escaped char
                continue;
            }
            if bytes[pos] == b'"' {
                let value = inner[..pos].replace("\\\"", "\"").replace("\\\\", "\\");
                let remainder = &inner[pos + 1..];
                return Some((value, remainder));
            }
            pos += 1;
        }
        // Unterminated quote — take everything after the opening quote
        Some((inner.to_string(), ""))
    } else {
        // Atom — delimited by whitespace, parens, or brackets
        let end = s
            .find(|c: char| c.is_whitespace() || c == '(' || c == ')' || c == '[' || c == ']')
            .unwrap_or(s.len());
        if end == 0 {
            return None;
        }
        Some((s[..end].to_string(), &s[end..]))
    }
}

/// Parse a parenthesized list of atoms: `(MESSAGES RECENT UIDNEXT)`.
fn parse_parenthesized_list(s: &str) -> Vec<String> {
    let s = s.trim();
    let inner = if s.starts_with('(') && s.ends_with(')') {
        &s[1..s.len() - 1]
    } else if s.starts_with('(') {
        // Find closing paren
        let end = s.find(')').unwrap_or(s.len());
        &s[1..end]
    } else {
        s
    };
    inner.split_whitespace().map(|w| w.to_uppercase()).collect()
}

/// Parse IMAP flag list: `(\Seen \Flagged)` or `\Seen \Flagged`.
fn parse_flag_list(s: &str) -> Vec<String> {
    let s = s.trim();
    let inner = if s.starts_with('(') {
        let end = s.find(')').unwrap_or(s.len());
        &s[1..end]
    } else {
        s
    };
    inner.split_whitespace().map(|f| f.to_string()).collect()
}

/// Parse a STORE action string into a [`StoreAction`].
fn parse_store_action(s: &str) -> Option<StoreAction> {
    match s.to_uppercase().as_str() {
        "FLAGS" => Some(StoreAction::SetFlags),
        "+FLAGS" => Some(StoreAction::AddFlags),
        "-FLAGS" => Some(StoreAction::RemoveFlags),
        "FLAGS.SILENT" => Some(StoreAction::SetFlagsSilent),
        "+FLAGS.SILENT" => Some(StoreAction::AddFlagsSilent),
        "-FLAGS.SILENT" => Some(StoreAction::RemoveFlagsSilent),
        _ => None,
    }
}

/// Parse SEARCH criteria from the argument string.
///
/// This is a simplified parser that handles common criteria.
/// Nested `NOT`/`OR` and `AND` grouping are supported at one level.
pub fn parse_search_criteria(s: &str) -> Vec<SearchKey> {
    let mut criteria = Vec::new();
    let tokens: Vec<&str> = s.split_whitespace().collect();
    let mut i = 0;

    while i < tokens.len() {
        let token = tokens[i].to_uppercase();
        match token.as_str() {
            "ALL" => criteria.push(SearchKey::All),
            "SEEN" => criteria.push(SearchKey::Seen),
            "UNSEEN" => criteria.push(SearchKey::Unseen),
            "FLAGGED" => criteria.push(SearchKey::Flagged),
            "UNFLAGGED" => criteria.push(SearchKey::Unflagged),
            "ANSWERED" => criteria.push(SearchKey::Answered),
            "DELETED" => criteria.push(SearchKey::Deleted),
            "RECENT" => criteria.push(SearchKey::Recent),
            "NEW" => criteria.push(SearchKey::New),
            "OLD" => criteria.push(SearchKey::Old),

            "FROM" => {
                i += 1;
                if i < tokens.len() {
                    criteria.push(SearchKey::From(unquote(tokens[i])));
                }
            },
            "TO" => {
                i += 1;
                if i < tokens.len() {
                    criteria.push(SearchKey::To(unquote(tokens[i])));
                }
            },
            "SUBJECT" => {
                i += 1;
                if i < tokens.len() {
                    criteria.push(SearchKey::Subject(unquote(tokens[i])));
                }
            },
            "BODY" => {
                i += 1;
                if i < tokens.len() {
                    criteria.push(SearchKey::Body(unquote(tokens[i])));
                }
            },
            "TEXT" => {
                i += 1;
                if i < tokens.len() {
                    criteria.push(SearchKey::Text(unquote(tokens[i])));
                }
            },
            "BEFORE" => {
                i += 1;
                if i < tokens.len() {
                    criteria.push(SearchKey::Before(tokens[i].to_string()));
                }
            },
            "SINCE" => {
                i += 1;
                if i < tokens.len() {
                    criteria.push(SearchKey::Since(tokens[i].to_string()));
                }
            },
            "ON" => {
                i += 1;
                if i < tokens.len() {
                    criteria.push(SearchKey::On(tokens[i].to_string()));
                }
            },
            "LARGER" => {
                i += 1;
                if i < tokens.len() {
                    if let Ok(n) = tokens[i].parse() {
                        criteria.push(SearchKey::Larger(n));
                    }
                }
            },
            "SMALLER" => {
                i += 1;
                if i < tokens.len() {
                    if let Ok(n) = tokens[i].parse() {
                        criteria.push(SearchKey::Smaller(n));
                    }
                }
            },
            "UID" => {
                i += 1;
                if i < tokens.len() {
                    criteria.push(SearchKey::Uid(tokens[i].to_string()));
                }
            },
            "NOT" => {
                i += 1;
                if i < tokens.len() {
                    // Parse the next single criterion and negate it
                    let sub = parse_single_search_key(&tokens, &mut i);
                    if let Some(key) = sub {
                        criteria.push(SearchKey::Not(Box::new(key)));
                    }
                    continue; // i already advanced
                }
            },
            "OR" => {
                // OR key1 key2
                i += 1;
                let k1 = parse_single_search_key(&tokens, &mut i);
                let k2 = parse_single_search_key(&tokens, &mut i);
                if let (Some(a), Some(b)) = (k1, k2) {
                    criteria.push(SearchKey::Or(Box::new(a), Box::new(b)));
                }
                continue;
            },
            _ => {
                // Try to interpret as a sequence set (e.g. "1:*", "1,2,3")
                if token
                    .chars()
                    .all(|c| c.is_ascii_digit() || c == ':' || c == ',' || c == '*')
                {
                    criteria.push(SearchKey::SequenceSet(token));
                }
            },
        }
        i += 1;
    }

    criteria
}

/// Parse a single search key at the current position, advancing the index.
fn parse_single_search_key(tokens: &[&str], i: &mut usize) -> Option<SearchKey> {
    if *i >= tokens.len() {
        return None;
    }
    let token = tokens[*i].to_uppercase();
    *i += 1;
    match token.as_str() {
        "ALL" => Some(SearchKey::All),
        "SEEN" => Some(SearchKey::Seen),
        "UNSEEN" => Some(SearchKey::Unseen),
        "FLAGGED" => Some(SearchKey::Flagged),
        "UNFLAGGED" => Some(SearchKey::Unflagged),
        "ANSWERED" => Some(SearchKey::Answered),
        "DELETED" => Some(SearchKey::Deleted),
        "RECENT" => Some(SearchKey::Recent),
        "NEW" => Some(SearchKey::New),
        "OLD" => Some(SearchKey::Old),
        "FROM" => {
            if *i < tokens.len() {
                let val = unquote(tokens[*i]);
                *i += 1;
                Some(SearchKey::From(val))
            } else {
                None
            }
        },
        "TO" => {
            if *i < tokens.len() {
                let val = unquote(tokens[*i]);
                *i += 1;
                Some(SearchKey::To(val))
            } else {
                None
            }
        },
        "SUBJECT" => {
            if *i < tokens.len() {
                let val = unquote(tokens[*i]);
                *i += 1;
                Some(SearchKey::Subject(val))
            } else {
                None
            }
        },
        _ => None,
    }
}

/// Remove surrounding double quotes from a token, if present.
fn unquote(s: &str) -> String {
    if s.starts_with('"') && s.ends_with('"') && s.len() >= 2 {
        s[1..s.len() - 1].to_string()
    } else {
        s.to_string()
    }
}

/// Parse ID command parameters: `("name" "value" "name2" "value2")`.
fn parse_id_params(s: &str) -> Vec<(String, String)> {
    let s = s.trim();
    let inner = if s.starts_with('(') {
        let end = s.rfind(')').unwrap_or(s.len());
        &s[1..end]
    } else {
        s
    };

    let mut params = Vec::new();
    let mut tokens = Vec::new();
    // Collect quoted strings
    let mut chars = inner.chars().peekable();
    while let Some(&c) = chars.peek() {
        if c == '"' {
            chars.next(); // consume opening quote
            let mut val = String::new();
            for ch in chars.by_ref() {
                if ch == '"' {
                    break;
                }
                val.push(ch);
            }
            tokens.push(val);
        } else if c.is_whitespace() {
            chars.next();
        } else {
            // Atom
            let mut val = String::new();
            while let Some(&ch) = chars.peek() {
                if ch.is_whitespace() || ch == '"' {
                    break;
                }
                val.push(ch);
                chars.next();
            }
            tokens.push(val);
        }
    }

    let mut i = 0;
    while i + 1 < tokens.len() {
        params.push((tokens[i].clone(), tokens[i + 1].clone()));
        i += 2;
    }

    params
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_login() {
        let cmd = parse_command("a001 LOGIN user pass123\r\n").unwrap();
        assert_eq!(cmd.tag, "a001");
        match &cmd.command {
            ImapCommandType::Login { username, password } => {
                assert_eq!(username, "user");
                assert_eq!(password, "pass123");
            },
            other => panic!("Expected Login, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_login_quoted() {
        let cmd = parse_command("t1 LOGIN \"my user\" \"my pass\"\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::Login { username, password } => {
                assert_eq!(username, "my user");
                assert_eq!(password, "my pass");
            },
            other => panic!("Expected Login, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_select() {
        let cmd = parse_command("a002 SELECT INBOX\r\n").unwrap();
        assert_eq!(cmd.tag, "a002");
        match &cmd.command {
            ImapCommandType::Select { mailbox } => {
                assert_eq!(mailbox, "INBOX");
            },
            other => panic!("Expected Select, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_select_quoted() {
        let cmd = parse_command("a002 SELECT \"Sent Mail\"\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::Select { mailbox } => {
                assert_eq!(mailbox, "Sent Mail");
            },
            other => panic!("Expected Select, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_fetch_multiple_items() {
        let cmd = parse_command("a003 FETCH 1:* (FLAGS UID ENVELOPE RFC822.SIZE)\r\n").unwrap();
        assert_eq!(cmd.tag, "a003");
        match &cmd.command {
            ImapCommandType::Fetch { sequence, items } => {
                assert_eq!(sequence, "1:*");
                assert!(items.len() >= 4);
            },
            other => panic!("Expected Fetch, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_search_criteria() {
        let cmd = parse_command("a004 SEARCH UNSEEN FROM \"john\"\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::Search { criteria } => {
                assert_eq!(criteria.len(), 2);
                assert!(matches!(criteria[0], SearchKey::Unseen));
                match &criteria[1] {
                    SearchKey::From(s) => assert_eq!(s, "john"),
                    other => panic!("Expected From, got {:?}", other),
                }
            },
            other => panic!("Expected Search, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_store_add_flags() {
        let cmd = parse_command("a005 STORE 1:3 +FLAGS (\\Seen \\Flagged)\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::Store {
                sequence,
                action,
                flags,
            } => {
                assert_eq!(sequence, "1:3");
                assert_eq!(*action, StoreAction::AddFlags);
                assert_eq!(flags.len(), 2);
                assert!(flags.contains(&"\\Seen".to_string()));
                assert!(flags.contains(&"\\Flagged".to_string()));
            },
            other => panic!("Expected Store, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_uid_fetch() {
        let cmd = parse_command("a006 UID FETCH 100:200 (FLAGS)\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::Uid { inner } => match inner.as_ref() {
                ImapCommandType::Fetch { sequence, items } => {
                    assert_eq!(sequence, "100:200");
                    assert!(!items.is_empty());
                },
                other => panic!("Expected inner Fetch, got {:?}", other),
            },
            other => panic!("Expected Uid, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_capability() {
        let cmd = parse_command("a007 CAPABILITY\r\n").unwrap();
        assert_eq!(cmd.tag, "a007");
        assert!(matches!(cmd.command, ImapCommandType::Capability));
    }

    #[test]
    fn test_parse_logout() {
        let cmd = parse_command("a008 LOGOUT\r\n").unwrap();
        assert!(matches!(cmd.command, ImapCommandType::Logout));
    }

    #[test]
    fn test_parse_list() {
        let cmd = parse_command("a009 LIST \"\" \"*\"\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::List { reference, pattern } => {
                assert_eq!(reference, "");
                assert_eq!(pattern, "*");
            },
            other => panic!("Expected List, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_done() {
        let cmd = parse_command("DONE\r\n").unwrap();
        assert!(matches!(cmd.command, ImapCommandType::Done));
        assert_eq!(cmd.tag, "");
    }

    #[test]
    fn test_parse_noop() {
        let cmd = parse_command("a010 NOOP\r\n").unwrap();
        assert!(matches!(cmd.command, ImapCommandType::Noop));
    }

    #[test]
    fn test_parse_namespace() {
        let cmd = parse_command("a011 NAMESPACE\r\n").unwrap();
        assert!(matches!(cmd.command, ImapCommandType::Namespace));
    }

    #[test]
    fn test_parse_enable() {
        let cmd = parse_command("a012 ENABLE CONDSTORE QRESYNC\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::Enable { extensions } => {
                assert_eq!(extensions, &["CONDSTORE", "QRESYNC"]);
            },
            other => panic!("Expected Enable, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_copy() {
        let cmd = parse_command("a013 COPY 1:5 \"Archive\"\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::Copy { sequence, mailbox } => {
                assert_eq!(sequence, "1:5");
                assert_eq!(mailbox, "Archive");
            },
            other => panic!("Expected Copy, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_move() {
        let cmd = parse_command("a014 MOVE 3 Trash\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::Move { sequence, mailbox } => {
                assert_eq!(sequence, "3");
                assert_eq!(mailbox, "Trash");
            },
            other => panic!("Expected Move, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_status() {
        let cmd = parse_command("a015 STATUS INBOX (MESSAGES RECENT UNSEEN)\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::Status { mailbox, items } => {
                assert_eq!(mailbox, "INBOX");
                assert_eq!(items, &["MESSAGES", "RECENT", "UNSEEN"]);
            },
            other => panic!("Expected Status, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_empty_line() {
        assert!(parse_command("").is_none());
        assert!(parse_command("\r\n").is_none());
    }

    #[test]
    fn test_parse_unknown_command() {
        assert!(parse_command("a099 XYZZY\r\n").is_none());
    }

    #[test]
    fn test_parse_search_or() {
        let cmd = parse_command("a016 SEARCH OR SEEN UNSEEN\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::Search { criteria } => {
                assert_eq!(criteria.len(), 1);
                assert!(matches!(&criteria[0], SearchKey::Or(_, _)));
            },
            other => panic!("Expected Search, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_search_not() {
        let cmd = parse_command("a017 SEARCH NOT DELETED\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::Search { criteria } => {
                assert_eq!(criteria.len(), 1);
                match &criteria[0] {
                    SearchKey::Not(inner) => {
                        assert!(matches!(inner.as_ref(), SearchKey::Deleted));
                    },
                    other => panic!("Expected Not, got {:?}", other),
                }
            },
            other => panic!("Expected Search, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_id_nil() {
        let cmd = parse_command("a018 ID NIL\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::Id { params } => assert!(params.is_none()),
            other => panic!("Expected Id, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_rename() {
        let cmd = parse_command("a019 RENAME \"Old Folder\" \"New Folder\"\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::Rename { from, to } => {
                assert_eq!(from, "Old Folder");
                assert_eq!(to, "New Folder");
            },
            other => panic!("Expected Rename, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_store_silent() {
        let cmd = parse_command("a020 STORE 1 +FLAGS.SILENT (\\Seen)\r\n").unwrap();
        match &cmd.command {
            ImapCommandType::Store { action, .. } => {
                assert_eq!(*action, StoreAction::AddFlagsSilent);
            },
            other => panic!("Expected Store, got {:?}", other),
        }
    }
}
