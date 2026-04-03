//! IMAP command handlers backed by PostgreSQL.
//!
//! Each handler function takes the connection state, the parsed command
//! arguments, and returns a list of IMAP responses. All database queries
//! target the `mailserver.*` schema.

use signapps_imap::fetch::FetchItem;
use signapps_imap::parser::{SearchKey, StoreAction};
use signapps_imap::response::{
    exists_response, fetch_response, flags_response, list_response, recent_response,
    search_response, status_response, ImapResponse,
};

use super::session::{ImapConnectionState, MailAccountInfo, SelectedMailbox};
use sqlx::Row;
use uuid::Uuid;

/// Standard IMAP flags supported by this server.
const STANDARD_FLAGS: &[&str] = &[
    "\\Seen",
    "\\Answered",
    "\\Flagged",
    "\\Deleted",
    "\\Draft",
    "\\Recent",
];

/// SPECIAL-USE flag mapping from `mailserver.mailboxes.special_use`.
fn special_use_flag(special_use: &str) -> &'static str {
    match special_use {
        "inbox" => "\\Inbox",
        "sent" => "\\Sent",
        "drafts" => "\\Drafts",
        "trash" => "\\Trash",
        "junk" | "spam" => "\\Junk",
        "archive" => "\\Archive",
        _ => "\\HasNoChildren",
    }
}

// ─── Bitmask flags ──────────────────────────────────────────────────────────

/// Flag bitmask constants matching `mailserver.message_mailboxes.flags`.
const FLAG_SEEN: i32 = 1;
const FLAG_ANSWERED: i32 = 2;
const FLAG_FLAGGED: i32 = 4;
const FLAG_DELETED: i32 = 8;
const FLAG_DRAFT: i32 = 16;
const FLAG_RECENT: i32 = 32;

/// Convert an IMAP flag name to its bitmask value.
fn flag_to_bit(flag: &str) -> i32 {
    match flag {
        "\\Seen" => FLAG_SEEN,
        "\\Answered" => FLAG_ANSWERED,
        "\\Flagged" => FLAG_FLAGGED,
        "\\Deleted" => FLAG_DELETED,
        "\\Draft" => FLAG_DRAFT,
        "\\Recent" => FLAG_RECENT,
        _ => 0,
    }
}

/// Convert a bitmask to a list of IMAP flag names.
fn bits_to_flags(bits: i32) -> Vec<String> {
    let mut flags = Vec::new();
    if bits & FLAG_SEEN != 0 {
        flags.push("\\Seen".to_string());
    }
    if bits & FLAG_ANSWERED != 0 {
        flags.push("\\Answered".to_string());
    }
    if bits & FLAG_FLAGGED != 0 {
        flags.push("\\Flagged".to_string());
    }
    if bits & FLAG_DELETED != 0 {
        flags.push("\\Deleted".to_string());
    }
    if bits & FLAG_DRAFT != 0 {
        flags.push("\\Draft".to_string());
    }
    if bits & FLAG_RECENT != 0 {
        flags.push("\\Recent".to_string());
    }
    flags
}

// ─── LOGIN ──────────────────────────────────────────────────────────────────

/// Handle LOGIN command: verify credentials against `mailserver.accounts`.
///
/// Verifies the password using argon2 against the stored `password_hash`.
/// On success, sets the account in the connection state.
///
/// # Errors
///
/// Returns a tagged NO response if authentication fails.
///
/// # Panics
///
/// This function does not panic.
#[tracing::instrument(skip(conn, password), fields(username = %username))]
pub async fn handle_login(
    conn: &mut ImapConnectionState,
    tag: &str,
    username: &str,
    password: &str,
) -> Vec<ImapResponse> {
    let row = sqlx::query(
        "SELECT id, address, display_name, password_hash, is_active \
         FROM mailserver.accounts WHERE address = $1",
    )
    .bind(username)
    .fetch_optional(conn.pool())
    .await;

    let row = match row {
        Ok(Some(r)) => r,
        Ok(None) => {
            tracing::warn!(username = %username, "IMAP LOGIN: account not found");
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO [AUTHENTICATIONFAILED] Invalid credentials".to_string(),
            )];
        },
        Err(e) => {
            tracing::error!(?e, "IMAP LOGIN: database error");
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO [UNAVAILABLE] Internal server error".to_string(),
            )];
        },
    };

    let is_active: bool = row.get("is_active");
    if !is_active {
        return vec![ImapResponse::Tagged(
            tag.to_string(),
            "NO [AUTHENTICATIONFAILED] Account disabled".to_string(),
        )];
    }

    let password_hash: Option<String> = row.get("password_hash");
    let hash = match password_hash {
        Some(h) => h,
        None => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO [AUTHENTICATIONFAILED] No password set".to_string(),
            )];
        },
    };

    // Verify password with argon2
    let parsed = match argon2::PasswordHash::new(&hash) {
        Ok(h) => h,
        Err(_) => {
            tracing::error!(username = %username, "IMAP LOGIN: invalid password hash format");
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO [AUTHENTICATIONFAILED] Invalid credentials".to_string(),
            )];
        },
    };

    use argon2::PasswordVerifier;
    if argon2::Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_err()
    {
        tracing::warn!(username = %username, "IMAP LOGIN: wrong password");
        return vec![ImapResponse::Tagged(
            tag.to_string(),
            "NO [AUTHENTICATIONFAILED] Invalid credentials".to_string(),
        )];
    }

    let account_id: Uuid = row.get("id");
    let address: String = row.get("address");
    let display_name: Option<String> = row.get("display_name");

    conn.set_account(MailAccountInfo {
        id: account_id,
        address: address.clone(),
        display_name,
    });

    // Update last_login timestamp
    let _ = sqlx::query("UPDATE mailserver.accounts SET last_login = NOW() WHERE id = $1")
        .bind(account_id)
        .execute(conn.pool())
        .await;

    tracing::info!(username = %address, "IMAP LOGIN: authenticated");

    vec![ImapResponse::Tagged(
        tag.to_string(),
        "OK [CAPABILITY IMAP4rev2 IDLE NAMESPACE CONDSTORE MOVE] LOGIN completed".to_string(),
    )]
}

// ─── LIST ───────────────────────────────────────────────────────────────────

/// Handle LIST command: return mailboxes matching the pattern.
///
/// Queries `mailserver.mailboxes` for the authenticated account and returns
/// LIST responses with SPECIAL-USE flags.
///
/// # Errors
///
/// Returns a tagged NO response on database errors.
///
/// # Panics
///
/// This function does not panic.
#[tracing::instrument(skip(conn), fields(reference = %reference, pattern = %pattern))]
pub async fn handle_list(
    conn: &ImapConnectionState,
    tag: &str,
    reference: &str,
    pattern: &str,
) -> Vec<ImapResponse> {
    let account = match conn.account() {
        Some(a) => a,
        None => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "BAD Not authenticated".to_string(),
            )]
        },
    };

    // If pattern is empty, return hierarchy delimiter info
    if pattern.is_empty() {
        return vec![
            list_response(&["\\Noselect"], "/", ""),
            ImapResponse::Tagged(tag.to_string(), "OK LIST completed".to_string()),
        ];
    }

    let rows = sqlx::query(
        "SELECT name, special_use FROM mailserver.mailboxes \
         WHERE account_id = $1 ORDER BY sort_order, name",
    )
    .bind(account.id)
    .fetch_all(conn.pool())
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "IMAP LIST: database error");
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO LIST failed".to_string(),
            )];
        },
    };

    let mut responses: Vec<ImapResponse> = Vec::new();

    // Convert IMAP wildcard to simplified pattern for matching
    let sql_pattern = pattern.replace('*', "%");

    for row in &rows {
        let name: String = row.get("name");
        let special_use: Option<String> = row.get("special_use");

        // Simple wildcard matching
        let full_name = if reference.is_empty() {
            name.clone()
        } else {
            format!("{}{}", reference, name)
        };

        if !matches_imap_pattern(&full_name, &sql_pattern) && pattern != "*" {
            continue;
        }

        let mut flags = vec!["\\HasNoChildren"];
        if let Some(ref su) = special_use {
            let flag = special_use_flag(su);
            if flag != "\\HasNoChildren" {
                flags.push(flag);
            }
        }

        responses.push(list_response(&flags, "/", &full_name));
    }

    responses.push(ImapResponse::Tagged(
        tag.to_string(),
        "OK LIST completed".to_string(),
    ));
    responses
}

/// Simple IMAP pattern matching (supports `*` as wildcard).
fn matches_imap_pattern(name: &str, pattern: &str) -> bool {
    if pattern == "%" || pattern == "*" {
        return true;
    }
    let pattern_lower = pattern.to_lowercase();
    let name_lower = name.to_lowercase();
    // Simple contains check for common patterns
    if pattern_lower.contains('%') {
        // % matches any character except hierarchy delimiter
        let parts: Vec<&str> = pattern_lower.split('%').collect();
        if parts.len() == 1 {
            return name_lower == pattern_lower;
        }
        // Simple prefix/suffix check
        if let Some(prefix) = parts.first() {
            if !prefix.is_empty() && !name_lower.starts_with(*prefix) {
                return false;
            }
        }
        return true;
    }
    name_lower == pattern_lower
}

// ─── SELECT / EXAMINE ───────────────────────────────────────────────────────

/// Handle SELECT or EXAMINE command: open a mailbox.
///
/// Loads the mailbox from `mailserver.mailboxes`, counts messages, and returns
/// the standard SELECT responses (EXISTS, RECENT, FLAGS, UIDVALIDITY, UIDNEXT).
///
/// # Errors
///
/// Returns a tagged NO response if the mailbox is not found or on DB errors.
///
/// # Panics
///
/// This function does not panic.
#[tracing::instrument(skip(conn), fields(mailbox = %mailbox_name, readonly))]
pub async fn handle_select(
    conn: &mut ImapConnectionState,
    tag: &str,
    mailbox_name: &str,
    readonly: bool,
) -> Vec<ImapResponse> {
    let account = match conn.account() {
        Some(a) => a.clone(),
        None => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "BAD Not authenticated".to_string(),
            )]
        },
    };

    let row = sqlx::query(
        "SELECT id, name, uid_validity, uid_next, total_messages, unread_messages, highest_modseq \
         FROM mailserver.mailboxes \
         WHERE account_id = $1 AND LOWER(name) = LOWER($2)",
    )
    .bind(account.id)
    .bind(mailbox_name)
    .fetch_optional(conn.pool())
    .await;

    let row = match row {
        Ok(Some(r)) => r,
        Ok(None) => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                format!("NO [NONEXISTENT] Mailbox \"{}\" not found", mailbox_name),
            )]
        },
        Err(e) => {
            tracing::error!(?e, "IMAP SELECT: database error");
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO SELECT failed".to_string(),
            )];
        },
    };

    let mailbox_id: Uuid = row.get("id");
    let name: String = row.get("name");
    let uid_validity: i32 = row.get("uid_validity");
    let uid_next: i32 = row.get("uid_next");
    let total: i32 = row.get("total_messages");
    let unread: i32 = row.get("unread_messages");
    let highest_modseq: i64 = row.get("highest_modseq");

    // Count recent messages (messages with \Recent flag)
    let recent_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM mailserver.message_mailboxes \
         WHERE mailbox_id = $1 AND (flags & $2) != 0",
    )
    .bind(mailbox_id)
    .bind(FLAG_RECENT)
    .fetch_one(conn.pool())
    .await
    .unwrap_or(0);

    conn.set_selected_mailbox(SelectedMailbox {
        id: mailbox_id,
        name: name.clone(),
        uid_validity,
        uid_next,
        readonly,
        total_messages: total,
        unread_messages: unread,
        highest_modseq,
    });

    let cmd_name = if readonly { "EXAMINE" } else { "SELECT" };

    let mut responses = vec![
        exists_response(total as u32),
        recent_response(recent_count as u32),
        flags_response(STANDARD_FLAGS),
        ImapResponse::Untagged(
            "OK [PERMANENTFLAGS (\\Seen \\Answered \\Flagged \\Deleted \\Draft \\*)] Permanent flags".to_string()
        ),
        ImapResponse::Untagged(format!("OK [UIDVALIDITY {}] UIDs valid", uid_validity)),
        ImapResponse::Untagged(format!("OK [UIDNEXT {}] Predicted next UID", uid_next)),
        ImapResponse::Untagged(format!(
            "OK [HIGHESTMODSEQ {}] Highest modification sequence",
            highest_modseq
        )),
    ];

    if unread > 0 {
        // Find first unseen message sequence number
        let first_unseen: Option<i64> = sqlx::query_scalar(
            "SELECT MIN(uid) FROM mailserver.message_mailboxes \
             WHERE mailbox_id = $1 AND (flags & $2) = 0",
        )
        .bind(mailbox_id)
        .bind(FLAG_SEEN)
        .fetch_optional(conn.pool())
        .await
        .ok()
        .flatten();

        if let Some(seq) = first_unseen {
            responses.push(ImapResponse::Untagged(format!(
                "OK [UNSEEN {}] First unseen message",
                seq
            )));
        }
    }

    let rw = if readonly { "READ-ONLY" } else { "READ-WRITE" };
    responses.push(ImapResponse::Tagged(
        tag.to_string(),
        format!("OK [{}] {} completed", rw, cmd_name),
    ));

    responses
}

// ─── FETCH ──────────────────────────────────────────────────────────────────

/// Handle FETCH command: retrieve message data.
///
/// Queries `mailserver.messages`, `mailserver.message_mailboxes`, and
/// `mailserver.message_contents` to build responses for the requested items.
///
/// # Errors
///
/// Returns a tagged NO response on database errors.
///
/// # Panics
///
/// This function does not panic.
#[tracing::instrument(skip(conn, items), fields(sequence = %sequence, is_uid))]
pub async fn handle_fetch(
    conn: &ImapConnectionState,
    tag: &str,
    sequence: &str,
    items: &[FetchItem],
    is_uid: bool,
) -> Vec<ImapResponse> {
    let mailbox = match conn.selected_mailbox() {
        Some(m) => m,
        None => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "BAD No mailbox selected".to_string(),
            )]
        },
    };

    // Build the WHERE clause for the sequence set
    let (where_clause, uid_column) = if is_uid {
        (build_sequence_where("mm.uid", sequence), "mm.uid")
    } else {
        // For sequence numbers we use ROW_NUMBER() but for simplicity
        // we order by uid and use uid as a proxy
        (build_sequence_where("mm.uid", sequence), "mm.uid")
    };

    let query = format!(
        "SELECT m.id, m.message_id_header, m.in_reply_to, m.sender, m.sender_name, \
                m.recipients, m.subject, m.date, m.has_attachments, \
                mm.uid, mm.flags, mm.modseq, \
                mc.raw_size, mc.body_text, mc.body_html, mc.headers_json, mc.body_structure \
         FROM mailserver.message_mailboxes mm \
         JOIN mailserver.messages m ON m.id = mm.message_id \
         JOIN mailserver.message_contents mc ON mc.id = m.content_id \
         WHERE mm.mailbox_id = $1 AND {} \
         ORDER BY {} ASC",
        where_clause, uid_column
    );

    let rows = sqlx::query(&query)
        .bind(mailbox.id)
        .fetch_all(conn.pool())
        .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "IMAP FETCH: database error");
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO FETCH failed".to_string(),
            )];
        },
    };

    // Expand macro items
    let expanded = expand_fetch_items(items);

    let mut responses: Vec<ImapResponse> = Vec::new();

    for (idx, row) in rows.iter().enumerate() {
        let uid: i32 = row.get("uid");
        let flag_bits: i32 = row.get("flags");
        let modseq: i64 = row.get("modseq");
        let seq_num = (idx + 1) as u32; // simplified sequence number

        let mut fetch_items: Vec<(String, String)> = Vec::new();

        for item in &expanded {
            match item {
                FetchItem::Flags => {
                    let flags = bits_to_flags(flag_bits);
                    fetch_items.push(("FLAGS".to_string(), format!("({})", flags.join(" "))));
                },
                FetchItem::Uid => {
                    fetch_items.push(("UID".to_string(), uid.to_string()));
                },
                FetchItem::Envelope => {
                    let subject: Option<String> = row.get("subject");
                    let sender: String = row.get("sender");
                    let sender_name: Option<String> = row.get("sender_name");
                    let date: Option<chrono::DateTime<chrono::Utc>> = row.get("date");
                    let message_id: Option<String> = row.get("message_id_header");
                    let in_reply_to: Option<String> = row.get("in_reply_to");
                    let recipients: Option<serde_json::Value> = row.get("recipients");

                    let date_str = date
                        .map(|d| d.format("%a, %d %b %Y %H:%M:%S %z").to_string())
                        .unwrap_or_default();
                    let subj = subject.as_deref().unwrap_or("");
                    let from_name = sender_name.as_deref().unwrap_or("");
                    let mid = message_id.as_deref().unwrap_or("");
                    let irt = in_reply_to.as_deref().unwrap_or("NIL");

                    // Build ENVELOPE response
                    // (date subject from sender reply-to to cc bcc in-reply-to message-id)
                    let to_addrs = recipients
                        .as_ref()
                        .and_then(|r| r.get("to"))
                        .and_then(|v| v.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|v| v.as_str())
                                .collect::<Vec<_>>()
                                .join(",")
                        })
                        .unwrap_or_default();

                    let envelope = format!(
                        "(\"{}\" \"{}\" ((\"{}\" NIL \"{}\" \"\")) \
                         ((\"{}\" NIL \"{}\" \"\")) NIL \
                         ((NIL NIL \"{}\" \"\")) NIL NIL \"{}\" \"{}\")",
                        date_str, subj, from_name, sender, from_name, sender, to_addrs, irt, mid,
                    );
                    fetch_items.push(("ENVELOPE".to_string(), envelope));
                },
                FetchItem::Rfc822Size => {
                    let size: Option<i64> = row.get("raw_size");
                    fetch_items.push(("RFC822.SIZE".to_string(), size.unwrap_or(0).to_string()));
                },
                FetchItem::InternalDate => {
                    let date: Option<chrono::DateTime<chrono::Utc>> = row.get("date");
                    let date_str = date
                        .map(|d| d.format("\"%d-%b-%Y %H:%M:%S %z\"").to_string())
                        .unwrap_or_else(|| "\"01-Jan-1970 00:00:00 +0000\"".to_string());
                    fetch_items.push(("INTERNALDATE".to_string(), date_str));
                },
                FetchItem::Rfc822Header => {
                    let headers: Option<serde_json::Value> = row.get("headers_json");
                    let header_str = headers
                        .map(|h| {
                            if let Some(obj) = h.as_object() {
                                obj.iter()
                                    .map(|(k, v)| format!("{}: {}", k, v.as_str().unwrap_or("")))
                                    .collect::<Vec<_>>()
                                    .join("\r\n")
                            } else {
                                String::new()
                            }
                        })
                        .unwrap_or_default();
                    fetch_items.push((
                        "RFC822.HEADER".to_string(),
                        format!("{{{}}}\r\n{}", header_str.len(), header_str),
                    ));
                },
                FetchItem::Rfc822 | FetchItem::Rfc822Text => {
                    let body_text: Option<String> = row.get("body_text");
                    let body_html: Option<String> = row.get("body_html");
                    let body = body_html.or(body_text).unwrap_or_default();
                    let label = if matches!(item, FetchItem::Rfc822) {
                        "RFC822"
                    } else {
                        "RFC822.TEXT"
                    };
                    fetch_items
                        .push((label.to_string(), format!("{{{}}}\r\n{}", body.len(), body)));
                },
                FetchItem::BodySection { section, partial } => {
                    let content = match section.to_uppercase().as_str() {
                        "HEADER" | "HEADER.FIELDS" => {
                            let headers: Option<serde_json::Value> = row.get("headers_json");
                            headers
                                .map(|h| {
                                    if let Some(obj) = h.as_object() {
                                        obj.iter()
                                            .map(|(k, v)| {
                                                format!("{}: {}", k, v.as_str().unwrap_or(""))
                                            })
                                            .collect::<Vec<_>>()
                                            .join("\r\n")
                                    } else {
                                        String::new()
                                    }
                                })
                                .unwrap_or_default()
                        },
                        "TEXT" => {
                            let body_text: Option<String> = row.get("body_text");
                            body_text.unwrap_or_default()
                        },
                        _ => {
                            // Full message body
                            let body_text: Option<String> = row.get("body_text");
                            let body_html: Option<String> = row.get("body_html");
                            body_html.or(body_text).unwrap_or_default()
                        },
                    };

                    let content = if let Some((offset, count)) = partial {
                        let start = (*offset as usize).min(content.len());
                        let end = (start + *count as usize).min(content.len());
                        content[start..end].to_string()
                    } else {
                        content
                    };

                    let section_label = if section.is_empty() {
                        "BODY[]".to_string()
                    } else {
                        format!("BODY[{}]", section)
                    };
                    fetch_items.push((
                        section_label,
                        format!("{{{}}}\r\n{}", content.len(), content),
                    ));
                },
                FetchItem::BodyStructure | FetchItem::Body => {
                    let bs: Option<serde_json::Value> = row.get("body_structure");
                    let body_html: Option<String> = row.get("body_html");

                    let structure = if body_html.is_some() && bs.is_none() {
                        "(\"TEXT\" \"HTML\" (\"CHARSET\" \"UTF-8\") NIL NIL \"7BIT\" 0 0)"
                            .to_string()
                    } else {
                        "(\"TEXT\" \"PLAIN\" (\"CHARSET\" \"UTF-8\") NIL NIL \"7BIT\" 0 0)"
                            .to_string()
                    };

                    let label = if matches!(item, FetchItem::BodyStructure) {
                        "BODYSTRUCTURE"
                    } else {
                        "BODY"
                    };
                    fetch_items.push((label.to_string(), structure));
                },
                FetchItem::Modseq => {
                    fetch_items.push(("MODSEQ".to_string(), format!("({})", modseq)));
                },
                // Macros should already be expanded
                FetchItem::All | FetchItem::Fast | FetchItem::Full => {},
            }
        }

        responses.push(fetch_response(seq_num, fetch_items));
    }

    responses.push(ImapResponse::Tagged(
        tag.to_string(),
        "OK FETCH completed".to_string(),
    ));
    responses
}

/// Expand FETCH macros (ALL, FAST, FULL) into individual items.
fn expand_fetch_items(items: &[FetchItem]) -> Vec<FetchItem> {
    let mut expanded = Vec::new();
    for item in items {
        match item {
            FetchItem::All => {
                expanded.extend_from_slice(&[
                    FetchItem::Flags,
                    FetchItem::InternalDate,
                    FetchItem::Rfc822Size,
                    FetchItem::Envelope,
                ]);
            },
            FetchItem::Fast => {
                expanded.extend_from_slice(&[
                    FetchItem::Flags,
                    FetchItem::InternalDate,
                    FetchItem::Rfc822Size,
                ]);
            },
            FetchItem::Full => {
                expanded.extend_from_slice(&[
                    FetchItem::Flags,
                    FetchItem::InternalDate,
                    FetchItem::Rfc822Size,
                    FetchItem::Envelope,
                    FetchItem::Body,
                ]);
            },
            other => expanded.push(other.clone()),
        }
    }
    expanded
}

// ─── SEARCH ─────────────────────────────────────────────────────────────────

/// Handle SEARCH command: translate criteria to SQL and return matching UIDs.
///
/// # Errors
///
/// Returns a tagged NO response on database errors.
///
/// # Panics
///
/// This function does not panic.
#[tracing::instrument(skip(conn, criteria))]
pub async fn handle_search(
    conn: &ImapConnectionState,
    tag: &str,
    criteria: &[SearchKey],
    is_uid: bool,
) -> Vec<ImapResponse> {
    let mailbox = match conn.selected_mailbox() {
        Some(m) => m,
        None => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "BAD No mailbox selected".to_string(),
            )]
        },
    };

    let mut where_parts: Vec<String> = vec![format!("mm.mailbox_id = '{}'", mailbox.id)];

    for criterion in criteria {
        if let Some(sql) = search_key_to_sql(criterion) {
            where_parts.push(sql);
        }
    }

    let query = format!(
        "SELECT mm.uid FROM mailserver.message_mailboxes mm \
         JOIN mailserver.messages m ON m.id = mm.message_id \
         JOIN mailserver.message_contents mc ON mc.id = m.content_id \
         WHERE {} ORDER BY mm.uid ASC",
        where_parts.join(" AND ")
    );

    let rows = sqlx::query(&query).fetch_all(conn.pool()).await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "IMAP SEARCH: database error");
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO SEARCH failed".to_string(),
            )];
        },
    };

    let uids: Vec<u32> = rows.iter().map(|r| r.get::<i32, _>("uid") as u32).collect();

    vec![
        search_response(&uids),
        ImapResponse::Tagged(tag.to_string(), "OK SEARCH completed".to_string()),
    ]
}

/// Convert a single search key to a SQL WHERE clause fragment.
fn search_key_to_sql(key: &SearchKey) -> Option<String> {
    match key {
        SearchKey::All => None, // no filter needed
        SearchKey::Seen => Some(format!("(mm.flags & {}) != 0", FLAG_SEEN)),
        SearchKey::Unseen => Some(format!("(mm.flags & {}) = 0", FLAG_SEEN)),
        SearchKey::Flagged => Some(format!("(mm.flags & {}) != 0", FLAG_FLAGGED)),
        SearchKey::Unflagged => Some(format!("(mm.flags & {}) = 0", FLAG_FLAGGED)),
        SearchKey::Answered => Some(format!("(mm.flags & {}) != 0", FLAG_ANSWERED)),
        SearchKey::Deleted => Some(format!("(mm.flags & {}) != 0", FLAG_DELETED)),
        SearchKey::Recent => Some(format!("(mm.flags & {}) != 0", FLAG_RECENT)),
        SearchKey::New => Some(format!(
            "(mm.flags & {}) != 0 AND (mm.flags & {}) = 0",
            FLAG_RECENT, FLAG_SEEN
        )),
        SearchKey::Old => Some(format!("(mm.flags & {}) = 0", FLAG_RECENT)),
        SearchKey::From(s) => Some(format!("LOWER(m.sender) LIKE LOWER('%{}%')", escape_sql(s))),
        SearchKey::To(s) => Some(format!("m.recipients::text ILIKE '%{}%'", escape_sql(s))),
        SearchKey::Subject(s) => Some(format!(
            "LOWER(m.subject) LIKE LOWER('%{}%')",
            escape_sql(s)
        )),
        SearchKey::Body(s) => Some(format!(
            "(LOWER(mc.body_text) LIKE LOWER('%{}%') OR LOWER(mc.body_html) LIKE LOWER('%{}%'))",
            escape_sql(s),
            escape_sql(s)
        )),
        SearchKey::Text(s) => Some(format!(
            "(LOWER(m.subject) LIKE LOWER('%{e}%') OR LOWER(m.sender) LIKE LOWER('%{e}%') \
             OR LOWER(mc.body_text) LIKE LOWER('%{e}%'))",
            e = escape_sql(s)
        )),
        SearchKey::Before(d) => Some(format!("m.date < '{}'", escape_sql(d))),
        SearchKey::Since(d) => Some(format!("m.date >= '{}'", escape_sql(d))),
        SearchKey::On(d) => Some(format!("m.date::date = '{}'", escape_sql(d))),
        SearchKey::Larger(n) => Some(format!("mc.raw_size > {}", n)),
        SearchKey::Smaller(n) => Some(format!("mc.raw_size < {}", n)),
        SearchKey::Uid(set) => Some(build_sequence_where("mm.uid", set)),
        SearchKey::SequenceSet(set) => Some(build_sequence_where("mm.uid", set)),
        SearchKey::Not(inner) => search_key_to_sql(inner).map(|s| format!("NOT ({})", s)),
        SearchKey::Or(a, b) => {
            let sa = search_key_to_sql(a);
            let sb = search_key_to_sql(b);
            match (sa, sb) {
                (Some(a), Some(b)) => Some(format!("({} OR {})", a, b)),
                (Some(a), None) => Some(a),
                (None, Some(b)) => Some(b),
                (None, None) => None,
            }
        },
        SearchKey::And(keys) => {
            let parts: Vec<String> = keys.iter().filter_map(search_key_to_sql).collect();
            if parts.is_empty() {
                None
            } else {
                Some(format!("({})", parts.join(" AND ")))
            }
        },
    }
}

/// Escape a string for safe SQL interpolation (prevent SQL injection).
fn escape_sql(s: &str) -> String {
    s.replace('\'', "''").replace('\\', "\\\\")
}

// ─── STORE ──────────────────────────────────────────────────────────────────

/// Handle STORE command: modify message flags.
///
/// Updates `mailserver.message_mailboxes.flags` and increments `modseq`.
///
/// # Errors
///
/// Returns a tagged NO response on database errors.
///
/// # Panics
///
/// This function does not panic.
#[tracing::instrument(skip(conn, flags), fields(sequence = %sequence))]
pub async fn handle_store(
    conn: &ImapConnectionState,
    tag: &str,
    sequence: &str,
    action: &StoreAction,
    flags: &[String],
    is_uid: bool,
) -> Vec<ImapResponse> {
    let mailbox = match conn.selected_mailbox() {
        Some(m) => m,
        None => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "BAD No mailbox selected".to_string(),
            )]
        },
    };

    // Compute the bitmask for the requested flags
    let flag_mask: i32 = flags.iter().map(|f| flag_to_bit(f)).sum();

    let where_clause = build_sequence_where("uid", sequence);

    let sql = match action {
        StoreAction::SetFlags | StoreAction::SetFlagsSilent => {
            format!(
                "UPDATE mailserver.message_mailboxes \
                 SET flags = $1, modseq = modseq + 1 \
                 WHERE mailbox_id = $2 AND {}",
                where_clause
            )
        },
        StoreAction::AddFlags | StoreAction::AddFlagsSilent => {
            format!(
                "UPDATE mailserver.message_mailboxes \
                 SET flags = flags | $1, modseq = modseq + 1 \
                 WHERE mailbox_id = $2 AND {}",
                where_clause
            )
        },
        StoreAction::RemoveFlags | StoreAction::RemoveFlagsSilent => {
            format!(
                "UPDATE mailserver.message_mailboxes \
                 SET flags = flags & ~$1, modseq = modseq + 1 \
                 WHERE mailbox_id = $2 AND {}",
                where_clause
            )
        },
    };

    let result = sqlx::query(&sql)
        .bind(flag_mask)
        .bind(mailbox.id)
        .execute(conn.pool())
        .await;

    if let Err(e) = result {
        tracing::error!(?e, "IMAP STORE: database error");
        return vec![ImapResponse::Tagged(
            tag.to_string(),
            "NO STORE failed".to_string(),
        )];
    }

    // Increment mailbox highest_modseq
    let _ = sqlx::query(
        "UPDATE mailserver.mailboxes SET highest_modseq = highest_modseq + 1 WHERE id = $1",
    )
    .bind(mailbox.id)
    .execute(conn.pool())
    .await;

    // For non-silent actions, fetch and return the updated flags
    let is_silent = matches!(
        action,
        StoreAction::SetFlagsSilent | StoreAction::AddFlagsSilent | StoreAction::RemoveFlagsSilent
    );

    let mut responses: Vec<ImapResponse> = Vec::new();

    if !is_silent {
        let fetch_query = format!(
            "SELECT uid, flags FROM mailserver.message_mailboxes \
             WHERE mailbox_id = $1 AND {} ORDER BY uid ASC",
            build_sequence_where("uid", sequence)
        );
        if let Ok(rows) = sqlx::query(&fetch_query)
            .bind(mailbox.id)
            .fetch_all(conn.pool())
            .await
        {
            for (idx, row) in rows.iter().enumerate() {
                let uid: i32 = row.get("uid");
                let flag_bits: i32 = row.get("flags");
                let flag_list = bits_to_flags(flag_bits);
                let seq_num = (idx + 1) as u32;

                let mut items = vec![("FLAGS".to_string(), format!("({})", flag_list.join(" ")))];
                if is_uid {
                    items.push(("UID".to_string(), uid.to_string()));
                }
                responses.push(fetch_response(seq_num, items));
            }
        }
    }

    responses.push(ImapResponse::Tagged(
        tag.to_string(),
        "OK STORE completed".to_string(),
    ));
    responses
}

// ─── COPY / MOVE ────────────────────────────────────────────────────────────

/// Handle COPY command: copy messages to another mailbox.
///
/// Creates new `message_mailboxes` entries in the target mailbox.
///
/// # Errors
///
/// Returns a tagged NO response if the target mailbox is not found.
///
/// # Panics
///
/// This function does not panic.
#[tracing::instrument(skip(conn), fields(sequence = %sequence, target = %target_mailbox))]
pub async fn handle_copy(
    conn: &ImapConnectionState,
    tag: &str,
    sequence: &str,
    target_mailbox: &str,
    is_uid: bool,
) -> Vec<ImapResponse> {
    let src_mailbox = match conn.selected_mailbox() {
        Some(m) => m,
        None => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "BAD No mailbox selected".to_string(),
            )]
        },
    };

    let account = match conn.account() {
        Some(a) => a,
        None => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "BAD Not authenticated".to_string(),
            )]
        },
    };

    // Find target mailbox
    let target = sqlx::query(
        "SELECT id, uid_next FROM mailserver.mailboxes \
         WHERE account_id = $1 AND LOWER(name) = LOWER($2)",
    )
    .bind(account.id)
    .bind(target_mailbox)
    .fetch_optional(conn.pool())
    .await;

    let target = match target {
        Ok(Some(r)) => r,
        Ok(None) => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                format!("NO [TRYCREATE] Mailbox \"{}\" not found", target_mailbox),
            )]
        },
        Err(e) => {
            tracing::error!(?e, "IMAP COPY: database error");
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO COPY failed".to_string(),
            )];
        },
    };

    let target_id: Uuid = target.get("id");
    let target_uid_next: i32 = target.get("uid_next");

    // Fetch messages from source mailbox
    let where_clause = build_sequence_where("mm.uid", sequence);
    let query = format!(
        "SELECT mm.message_id FROM mailserver.message_mailboxes mm \
         WHERE mm.mailbox_id = $1 AND {} ORDER BY mm.uid ASC",
        where_clause
    );

    let rows = match sqlx::query(&query)
        .bind(src_mailbox.id)
        .fetch_all(conn.pool())
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "IMAP COPY: failed to fetch source messages");
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO COPY failed".to_string(),
            )];
        },
    };

    let mut next_uid = target_uid_next;
    for row in &rows {
        let message_id: Uuid = row.get("message_id");

        let _ = sqlx::query(
            "INSERT INTO mailserver.message_mailboxes (message_id, mailbox_id, uid, modseq, flags) \
             VALUES ($1, $2, $3, 1, 0) \
             ON CONFLICT (message_id, mailbox_id) DO NOTHING",
        )
        .bind(message_id)
        .bind(target_id)
        .bind(next_uid)
        .execute(conn.pool())
        .await;

        next_uid += 1;
    }

    // Update target mailbox counters
    let _ = sqlx::query(
        "UPDATE mailserver.mailboxes SET uid_next = $1, \
         total_messages = total_messages + $2 WHERE id = $3",
    )
    .bind(next_uid)
    .bind(rows.len() as i32)
    .bind(target_id)
    .execute(conn.pool())
    .await;

    let cmd = if is_uid { "UID COPY" } else { "COPY" };
    vec![ImapResponse::Tagged(
        tag.to_string(),
        format!("OK {} completed", cmd),
    )]
}

/// Handle MOVE command: move messages to another mailbox.
///
/// Copies messages to the target and removes them from the source.
///
/// # Errors
///
/// Returns a tagged NO response if the target mailbox is not found.
///
/// # Panics
///
/// This function does not panic.
#[tracing::instrument(skip(conn), fields(sequence = %sequence, target = %target_mailbox))]
pub async fn handle_move(
    conn: &ImapConnectionState,
    tag: &str,
    sequence: &str,
    target_mailbox: &str,
    is_uid: bool,
) -> Vec<ImapResponse> {
    // First copy
    let copy_responses = handle_copy(conn, tag, sequence, target_mailbox, is_uid).await;

    // Check if copy succeeded
    let copy_ok = copy_responses
        .iter()
        .any(|r| matches!(r, ImapResponse::Tagged(_, content) if content.starts_with("OK")));

    if !copy_ok {
        return copy_responses;
    }

    // Remove from source mailbox
    let mailbox = match conn.selected_mailbox() {
        Some(m) => m,
        None => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "BAD No mailbox selected".to_string(),
            )]
        },
    };

    let where_clause = build_sequence_where("uid", sequence);
    let delete_query = format!(
        "DELETE FROM mailserver.message_mailboxes \
         WHERE mailbox_id = $1 AND {}",
        where_clause
    );

    let result = sqlx::query(&delete_query)
        .bind(mailbox.id)
        .execute(conn.pool())
        .await;

    if let Err(e) = result {
        tracing::error!(?e, "IMAP MOVE: failed to remove source messages");
        return vec![ImapResponse::Tagged(
            tag.to_string(),
            "NO MOVE failed".to_string(),
        )];
    }

    // Update source mailbox counters
    let _ = sqlx::query(
        "UPDATE mailserver.mailboxes SET total_messages = \
         (SELECT COUNT(*) FROM mailserver.message_mailboxes WHERE mailbox_id = $1) \
         WHERE id = $1",
    )
    .bind(mailbox.id)
    .execute(conn.pool())
    .await;

    vec![ImapResponse::Tagged(
        tag.to_string(),
        "OK MOVE completed".to_string(),
    )]
}

// ─── EXPUNGE ────────────────────────────────────────────────────────────────

/// Handle EXPUNGE command: permanently remove messages with \Deleted flag.
///
/// Deletes entries from `message_mailboxes` where the `\Deleted` flag is set.
///
/// # Errors
///
/// Returns a tagged NO response on database errors.
///
/// # Panics
///
/// This function does not panic.
#[tracing::instrument(skip(conn))]
pub async fn handle_expunge(conn: &ImapConnectionState, tag: &str) -> Vec<ImapResponse> {
    let mailbox = match conn.selected_mailbox() {
        Some(m) => m,
        None => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "BAD No mailbox selected".to_string(),
            )]
        },
    };

    // Fetch UIDs of deleted messages first (to emit EXPUNGE responses)
    let deleted = sqlx::query(
        "SELECT uid FROM mailserver.message_mailboxes \
         WHERE mailbox_id = $1 AND (flags & $2) != 0 ORDER BY uid ASC",
    )
    .bind(mailbox.id)
    .bind(FLAG_DELETED)
    .fetch_all(conn.pool())
    .await;

    let deleted = match deleted {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "IMAP EXPUNGE: database error");
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO EXPUNGE failed".to_string(),
            )];
        },
    };

    let mut responses: Vec<ImapResponse> = Vec::new();

    // Send EXPUNGE responses in reverse order (sequence numbers shift)
    let uids: Vec<i32> = deleted.iter().map(|r| r.get("uid")).collect();
    for (idx, _uid) in uids.iter().enumerate().rev() {
        responses.push(ImapResponse::Untagged(format!("{} EXPUNGE", idx + 1)));
    }

    // Delete the messages
    let result = sqlx::query(
        "DELETE FROM mailserver.message_mailboxes \
         WHERE mailbox_id = $1 AND (flags & $2) != 0",
    )
    .bind(mailbox.id)
    .bind(FLAG_DELETED)
    .execute(conn.pool())
    .await;

    if let Err(e) = result {
        tracing::error!(?e, "IMAP EXPUNGE: delete failed");
    }

    // Update mailbox counters
    let _ = sqlx::query(
        "UPDATE mailserver.mailboxes SET total_messages = \
         (SELECT COUNT(*) FROM mailserver.message_mailboxes WHERE mailbox_id = $1) \
         WHERE id = $1",
    )
    .bind(mailbox.id)
    .execute(conn.pool())
    .await;

    responses.push(ImapResponse::Tagged(
        tag.to_string(),
        "OK EXPUNGE completed".to_string(),
    ));
    responses
}

// ─── NAMESPACE ──────────────────────────────────────────────────────────────

/// Handle NAMESPACE command: return personal namespace.
///
/// Returns the personal namespace with `""` prefix and `"/"` delimiter.
///
/// # Panics
///
/// This function does not panic.
pub fn handle_namespace(tag: &str) -> Vec<ImapResponse> {
    vec![
        ImapResponse::Untagged("NAMESPACE ((\"\" \"/\")) NIL NIL".to_string()),
        ImapResponse::Tagged(tag.to_string(), "OK NAMESPACE completed".to_string()),
    ]
}

// ─── STATUS ─────────────────────────────────────────────────────────────────

/// Handle STATUS command: return mailbox status without selecting it.
///
/// # Errors
///
/// Returns a tagged NO response if the mailbox is not found.
///
/// # Panics
///
/// This function does not panic.
#[tracing::instrument(skip(conn, items), fields(mailbox = %mailbox_name))]
pub async fn handle_status(
    conn: &ImapConnectionState,
    tag: &str,
    mailbox_name: &str,
    items: &[String],
) -> Vec<ImapResponse> {
    let account = match conn.account() {
        Some(a) => a,
        None => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "BAD Not authenticated".to_string(),
            )]
        },
    };

    let row = sqlx::query(
        "SELECT id, total_messages, unread_messages, uid_next, uid_validity, highest_modseq \
         FROM mailserver.mailboxes \
         WHERE account_id = $1 AND LOWER(name) = LOWER($2)",
    )
    .bind(account.id)
    .bind(mailbox_name)
    .fetch_optional(conn.pool())
    .await;

    let row = match row {
        Ok(Some(r)) => r,
        Ok(None) => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                format!("NO Mailbox \"{}\" not found", mailbox_name),
            )]
        },
        Err(e) => {
            tracing::error!(?e, "IMAP STATUS: database error");
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO STATUS failed".to_string(),
            )];
        },
    };

    let mailbox_id: Uuid = row.get("id");
    let total: i32 = row.get("total_messages");
    let unread: i32 = row.get("unread_messages");
    let uid_next: i32 = row.get("uid_next");
    let uid_validity: i32 = row.get("uid_validity");
    let highest_modseq: i64 = row.get("highest_modseq");

    // Count recent messages
    let recent: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM mailserver.message_mailboxes \
         WHERE mailbox_id = $1 AND (flags & $2) != 0",
    )
    .bind(mailbox_id)
    .bind(FLAG_RECENT)
    .fetch_one(conn.pool())
    .await
    .unwrap_or(0);

    let mut result_items: Vec<(String, u32)> = Vec::new();
    for item in items {
        match item.as_str() {
            "MESSAGES" => result_items.push(("MESSAGES".to_string(), total as u32)),
            "RECENT" => result_items.push(("RECENT".to_string(), recent as u32)),
            "UNSEEN" => result_items.push(("UNSEEN".to_string(), unread as u32)),
            "UIDNEXT" => result_items.push(("UIDNEXT".to_string(), uid_next as u32)),
            "UIDVALIDITY" => {
                result_items.push(("UIDVALIDITY".to_string(), uid_validity as u32));
            },
            "HIGHESTMODSEQ" => {
                result_items.push(("HIGHESTMODSEQ".to_string(), highest_modseq as u32));
            },
            _ => {}, // Ignore unknown items
        }
    }

    vec![
        status_response(mailbox_name, &result_items),
        ImapResponse::Tagged(tag.to_string(), "OK STATUS completed".to_string()),
    ]
}

// ─── CREATE / DELETE / RENAME ───────────────────────────────────────────────

/// Handle CREATE command: create a new mailbox.
///
/// # Errors
///
/// Returns a tagged NO response if the mailbox already exists.
///
/// # Panics
///
/// This function does not panic.
#[tracing::instrument(skip(conn), fields(mailbox = %mailbox_name))]
pub async fn handle_create(
    conn: &ImapConnectionState,
    tag: &str,
    mailbox_name: &str,
) -> Vec<ImapResponse> {
    let account = match conn.account() {
        Some(a) => a,
        None => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "BAD Not authenticated".to_string(),
            )]
        },
    };

    // Generate a random UID validity
    let uid_validity: i32 = (chrono::Utc::now().timestamp() & 0x7FFF_FFFF) as i32;

    let result = sqlx::query(
        "INSERT INTO mailserver.mailboxes (account_id, name, uid_validity, uid_next, sort_order) \
         VALUES ($1, $2, $3, 1, 99)",
    )
    .bind(account.id)
    .bind(mailbox_name)
    .bind(uid_validity)
    .execute(conn.pool())
    .await;

    match result {
        Ok(_) => {
            tracing::info!(mailbox = %mailbox_name, "IMAP CREATE: mailbox created");
            vec![ImapResponse::Tagged(
                tag.to_string(),
                "OK CREATE completed".to_string(),
            )]
        },
        Err(e) => {
            tracing::warn!(?e, "IMAP CREATE: failed");
            vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO CREATE failed (mailbox may already exist)".to_string(),
            )]
        },
    }
}

/// Handle DELETE command: delete a mailbox.
///
/// # Errors
///
/// Returns a tagged NO response if the mailbox is not found.
///
/// # Panics
///
/// This function does not panic.
#[tracing::instrument(skip(conn), fields(mailbox = %mailbox_name))]
pub async fn handle_delete(
    conn: &ImapConnectionState,
    tag: &str,
    mailbox_name: &str,
) -> Vec<ImapResponse> {
    let account = match conn.account() {
        Some(a) => a,
        None => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "BAD Not authenticated".to_string(),
            )]
        },
    };

    // Prevent deleting INBOX
    if mailbox_name.eq_ignore_ascii_case("INBOX") {
        return vec![ImapResponse::Tagged(
            tag.to_string(),
            "NO Cannot delete INBOX".to_string(),
        )];
    }

    let result = sqlx::query(
        "DELETE FROM mailserver.mailboxes \
         WHERE account_id = $1 AND LOWER(name) = LOWER($2)",
    )
    .bind(account.id)
    .bind(mailbox_name)
    .execute(conn.pool())
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => vec![ImapResponse::Tagged(
            tag.to_string(),
            "OK DELETE completed".to_string(),
        )],
        Ok(_) => vec![ImapResponse::Tagged(
            tag.to_string(),
            "NO Mailbox not found".to_string(),
        )],
        Err(e) => {
            tracing::error!(?e, "IMAP DELETE: database error");
            vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO DELETE failed".to_string(),
            )]
        },
    }
}

/// Handle RENAME command: rename a mailbox.
///
/// # Errors
///
/// Returns a tagged NO response if the source mailbox is not found.
///
/// # Panics
///
/// This function does not panic.
#[tracing::instrument(skip(conn), fields(from = %from, to = %to))]
pub async fn handle_rename(
    conn: &ImapConnectionState,
    tag: &str,
    from: &str,
    to: &str,
) -> Vec<ImapResponse> {
    let account = match conn.account() {
        Some(a) => a,
        None => {
            return vec![ImapResponse::Tagged(
                tag.to_string(),
                "BAD Not authenticated".to_string(),
            )]
        },
    };

    if from.eq_ignore_ascii_case("INBOX") {
        return vec![ImapResponse::Tagged(
            tag.to_string(),
            "NO Cannot rename INBOX".to_string(),
        )];
    }

    let result = sqlx::query(
        "UPDATE mailserver.mailboxes SET name = $1 \
         WHERE account_id = $2 AND LOWER(name) = LOWER($3)",
    )
    .bind(to)
    .bind(account.id)
    .bind(from)
    .execute(conn.pool())
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => vec![ImapResponse::Tagged(
            tag.to_string(),
            "OK RENAME completed".to_string(),
        )],
        Ok(_) => vec![ImapResponse::Tagged(
            tag.to_string(),
            "NO Source mailbox not found".to_string(),
        )],
        Err(e) => {
            tracing::error!(?e, "IMAP RENAME: database error");
            vec![ImapResponse::Tagged(
                tag.to_string(),
                "NO RENAME failed".to_string(),
            )]
        },
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/// Build a SQL WHERE clause fragment for an IMAP sequence set.
///
/// Supports:
/// - Single numbers: `5` -> `uid = 5`
/// - Ranges: `1:10` -> `uid BETWEEN 1 AND 10`
/// - Wildcard: `1:*` -> `uid >= 1`
/// - Comma-separated: `1,3,5` -> `uid IN (1, 3, 5)`
/// - Mixed: `1:3,5,7:*` -> `(uid BETWEEN 1 AND 3 OR uid = 5 OR uid >= 7)`
fn build_sequence_where(column: &str, sequence: &str) -> String {
    let parts: Vec<&str> = sequence.split(',').collect();

    if parts.len() == 1 {
        let part = parts[0];
        return single_range_where(column, part);
    }

    let clauses: Vec<String> = parts
        .iter()
        .map(|p| single_range_where(column, p))
        .collect();

    format!("({})", clauses.join(" OR "))
}

/// Build a WHERE clause for a single range element.
fn single_range_where(column: &str, part: &str) -> String {
    if let Some(colon) = part.find(':') {
        let start = &part[..colon];
        let end = &part[colon + 1..];
        if end == "*" {
            format!("{} >= {}", column, start)
        } else {
            format!("{} BETWEEN {} AND {}", column, start, end)
        }
    } else if part == "*" {
        format!("{} >= 1", column)
    } else {
        format!("{} = {}", column, part)
    }
}
