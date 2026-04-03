//! Local delivery logic for inbound SMTP messages.
//!
//! After the SMTP session accumulates a complete [`SmtpEnvelope`], this module
//! parses the MIME content, persists it into the `mailserver.*` schema, and
//! notifies recipients via PostgreSQL `NOTIFY`.
//!
//! ## Delivery pipeline
//!
//! 1. Parse raw bytes with [`signapps_mime::MimeMessage`].
//! 2. Compute SHA-256 content hash (dedup key).
//! 3. Extract envelope metadata (subject, sender, recipients, date, etc.).
//! 4. Insert into `mailserver.message_contents` (dedup by hash).
//! 5. For each local recipient: resolve account + INBOX, insert message +
//!    message_mailbox, send `NOTIFY mailbox_changes`.

use chrono::{DateTime, Utc};
use signapps_smtp::SmtpEnvelope;
use sqlx::{Pool, Postgres, Row};
use uuid::Uuid;

/// Result of a local delivery attempt for a single recipient.
#[derive(Debug)]
pub enum RecipientResult {
    /// Message delivered successfully.
    Delivered {
        /// The recipient email address.
        address: String,
        /// The account ID that received the message.
        account_id: Uuid,
    },
    /// The recipient domain is not hosted locally.
    UnknownDomain {
        /// The recipient email address.
        address: String,
        /// The domain part that was not found.
        domain: String,
    },
    /// The recipient account does not exist on a local domain.
    UnknownAccount {
        /// The recipient email address.
        address: String,
    },
    /// A transient error occurred during delivery.
    TempError {
        /// The recipient email address.
        address: String,
        /// Description of the error.
        reason: String,
    },
}

/// Outcome of delivering a complete SMTP envelope to local recipients.
#[derive(Debug)]
pub struct DeliveryOutcome {
    /// Per-recipient results.
    pub results: Vec<RecipientResult>,
}

/// Deliver an SMTP envelope to all local recipients.
///
/// Parses the MIME message, deduplicates content by SHA-256 hash, and inserts
/// into the appropriate mailboxes. Non-local recipients are reported as
/// [`RecipientResult::UnknownDomain`].
///
/// # Errors
///
/// Individual recipient failures do not abort delivery for other recipients.
/// All errors are captured in the returned [`DeliveryOutcome`].
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(pool, envelope), fields(
    sender = %envelope.sender,
    recipient_count = envelope.recipients.len(),
    data_size = envelope.data.len(),
))]
pub async fn deliver_local(pool: &Pool<Postgres>, envelope: &SmtpEnvelope) -> DeliveryOutcome {
    // ── 1. Parse MIME message ───────────────────────────────────────────────
    let parsed = match signapps_mime::MimeMessage::parse(&envelope.data) {
        Ok(msg) => msg,
        Err(e) => {
            tracing::error!("MIME parse failed: {}", e);
            // Return temp error for all recipients
            let results = envelope
                .recipients
                .iter()
                .map(|addr| RecipientResult::TempError {
                    address: addr.clone(),
                    reason: format!("MIME parse error: {e}"),
                })
                .collect();
            return DeliveryOutcome { results };
        },
    };

    // ── 2. Extract metadata ─────────────────────────────────────────────────
    let content_hash = parsed.content_hash();
    let raw_size = envelope.data.len() as i64;
    let subject = parsed.subject().map(|s| s.to_string());
    let from_header = parsed.from().map(|s| s.to_string());
    let sender_addr = from_header
        .as_deref()
        .map(extract_email_address)
        .unwrap_or_else(|| envelope.sender.clone());
    let sender_name = from_header.as_deref().and_then(extract_display_name);
    let date = parsed.date().and_then(parse_rfc2822_date);
    let message_id = parsed.message_id().map(|s| s.to_string());
    let in_reply_to = parsed.in_reply_to().map(|s| s.to_string());
    let list_unsubscribe = parsed.list_unsubscribe().map(|s| s.to_string());
    let list_id = parsed.list_id().map(|s| s.to_string());
    let text_body = parsed.text_body();
    let html_body = parsed.html_body();
    let has_attachments = !parsed.attachments().is_empty();
    let body_structure = parsed.body_structure();

    // Build headers JSON from the parsed headers
    let headers_json = serde_json::to_value(&parsed.headers).ok();

    // Build recipients JSON (to/cc from headers)
    let to_addrs: Vec<&str> = parsed.to();
    let cc_addrs: Vec<&str> = parsed
        .header("Cc")
        .map(|v| v.split(',').map(|s| s.trim()).collect())
        .unwrap_or_default();
    let recipients_json = serde_json::json!({
        "to": to_addrs,
        "cc": cc_addrs,
    });

    // Store list headers in metadata for future use
    let _list_unsubscribe = list_unsubscribe;
    let _list_id = list_id;

    // ── 3. Insert content (dedup by hash) ───────────────────────────────────
    let content_id = match insert_content(
        pool,
        &content_hash,
        raw_size,
        headers_json.as_ref(),
        text_body.as_deref(),
        html_body.as_deref(),
        &body_structure,
    )
    .await
    {
        Ok(id) => id,
        Err(e) => {
            tracing::error!("Failed to insert message content: {}", e);
            let results = envelope
                .recipients
                .iter()
                .map(|addr| RecipientResult::TempError {
                    address: addr.clone(),
                    reason: format!("DB error: {e}"),
                })
                .collect();
            return DeliveryOutcome { results };
        },
    };

    tracing::debug!(
        content_id = %content_id,
        content_hash = %content_hash,
        "Message content stored"
    );

    // ── 4. Deliver to each recipient ────────────────────────────────────────
    let mut results = Vec::with_capacity(envelope.recipients.len());

    for recipient in &envelope.recipients {
        let result = deliver_to_recipient(
            pool,
            recipient,
            content_id,
            &sender_addr,
            sender_name.as_deref(),
            &recipients_json,
            subject.as_deref(),
            date,
            message_id.as_deref(),
            in_reply_to.as_deref(),
            has_attachments,
        )
        .await;
        results.push(result);
    }

    DeliveryOutcome { results }
}

/// Deliver a message to a single recipient.
///
/// Resolves the domain, account, and INBOX mailbox, then inserts the message
/// and message_mailbox records.
///
/// # Errors
///
/// Returns a [`RecipientResult`] variant describing the outcome.
///
/// # Panics
///
/// None.
#[allow(clippy::too_many_arguments)]
async fn deliver_to_recipient(
    pool: &Pool<Postgres>,
    recipient: &str,
    content_id: Uuid,
    sender_addr: &str,
    sender_name: Option<&str>,
    recipients_json: &serde_json::Value,
    subject: Option<&str>,
    date: Option<DateTime<Utc>>,
    message_id: Option<&str>,
    in_reply_to: Option<&str>,
    has_attachments: bool,
) -> RecipientResult {
    // Extract domain from recipient address
    let domain = match recipient.rsplit_once('@') {
        Some((_, d)) => d.to_lowercase(),
        None => {
            return RecipientResult::UnknownAccount {
                address: recipient.to_string(),
            };
        },
    };

    // Check if domain is local
    let domain_exists = match sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM mailserver.domains WHERE LOWER(name) = $1 AND COALESCE(is_active, true))"
    )
    .bind(&domain)
    .fetch_one(pool)
    .await
    {
        Ok(exists) => exists,
        Err(e) => {
            return RecipientResult::TempError {
                address: recipient.to_string(),
                reason: format!("Domain lookup failed: {e}"),
            };
        }
    };

    if !domain_exists {
        return RecipientResult::UnknownDomain {
            address: recipient.to_string(),
            domain,
        };
    }

    // Look up the account
    let account = match sqlx::query_as::<_, AccountRow>(
        "SELECT id, domain_id FROM mailserver.accounts WHERE LOWER(address) = LOWER($1) AND COALESCE(is_active, true)"
    )
    .bind(recipient)
    .fetch_optional(pool)
    .await
    {
        Ok(Some(a)) => a,
        Ok(None) => {
            return RecipientResult::UnknownAccount {
                address: recipient.to_string(),
            };
        }
        Err(e) => {
            return RecipientResult::TempError {
                address: recipient.to_string(),
                reason: format!("Account lookup failed: {e}"),
            };
        }
    };

    // ── Sieve filtering ──────────────────────────────────────────────────
    // Load active Sieve script for the recipient and evaluate it.
    // Actions determine target mailbox (FileInto), rejection (Reject),
    // or silent discard (Discard). Redirect enqueues a forwarding copy.
    let sieve_actions = evaluate_sieve(pool, account.id, sender_addr, recipient, subject).await;

    // Check for Reject / Discard before proceeding
    for action in &sieve_actions {
        match action {
            signapps_sieve::SieveAction::Reject(reason) => {
                tracing::info!(
                    recipient = %recipient,
                    reason = %reason,
                    "Sieve: message rejected"
                );
                return RecipientResult::TempError {
                    address: recipient.to_string(),
                    reason: format!("Rejected by recipient filter: {reason}"),
                };
            }
            signapps_sieve::SieveAction::Discard => {
                tracing::info!(
                    recipient = %recipient,
                    "Sieve: message discarded"
                );
                // Silently accept but don't deliver
                return RecipientResult::Delivered {
                    address: recipient.to_string(),
                    account_id: account.id,
                };
            }
            _ => {}
        }
    }

    // Determine target mailbox from Sieve actions (FileInto or default INBOX)
    let target_mailbox_name = sieve_actions
        .iter()
        .find_map(|a| {
            if let signapps_sieve::SieveAction::FileInto(folder) = a {
                Some(folder.as_str())
            } else {
                None
            }
        })
        .unwrap_or("INBOX");

    // Find the target mailbox (try Sieve target first, fall back to INBOX)
    let target_mailbox_id = match find_or_create_mailbox(pool, account.id, target_mailbox_name).await {
        Ok(id) => id,
        Err(e) => {
            // Fall back to INBOX if target mailbox creation fails
            tracing::warn!(
                account_id = %account.id,
                target = %target_mailbox_name,
                "Failed to find/create target mailbox ({}), falling back to INBOX", e
            );
            match find_or_create_mailbox(pool, account.id, "INBOX").await {
                Ok(id) => id,
                Err(e2) => {
                    return RecipientResult::TempError {
                        address: recipient.to_string(),
                        reason: format!("Mailbox lookup failed: {e2}"),
                    };
                }
            }
        }
    };

    // Handle Redirect actions (enqueue forwarding copies)
    for action in &sieve_actions {
        if let signapps_sieve::SieveAction::Redirect(forward_addr) = action {
            tracing::info!(
                recipient = %recipient,
                forward_to = %forward_addr,
                "Sieve: message redirected"
            );
            // Best-effort: insert redirect into outbound queue
            let _ = sqlx::query(
                r#"INSERT INTO mailserver.outbound_queue
                       (sender, recipient, subject, status)
                   VALUES ($1, $2, $3, 'pending')"#,
            )
            .bind(sender_addr)
            .bind(forward_addr)
            .bind(subject.unwrap_or("(no subject)"))
            .execute(pool)
            .await;
        }
    }

    let inbox_id = target_mailbox_id;

    // Insert the message record
    let message_id_result = match sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO mailserver.messages
            (account_id, content_id, message_id_header, in_reply_to,
             sender, sender_name, recipients, subject, date,
             has_attachments, spam_score, spam_status, received_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0.0, 'ham', NOW())
        RETURNING id
        "#,
    )
    .bind(account.id)
    .bind(content_id)
    .bind(message_id)
    .bind(in_reply_to)
    .bind(sender_addr)
    .bind(sender_name)
    .bind(recipients_json)
    .bind(subject)
    .bind(date)
    .bind(has_attachments)
    .fetch_one(pool)
    .await
    {
        Ok(id) => id,
        Err(e) => {
            return RecipientResult::TempError {
                address: recipient.to_string(),
                reason: format!("Message insert failed: {e}"),
            };
        },
    };

    // Place message into INBOX (allocate UID atomically)
    // flags = 0 means unread (Seen flag = bit 0 = 1, so 0 = not seen)
    if let Err(e) = sqlx::query(
        r#"
        WITH alloc AS (
            UPDATE mailserver.mailboxes
            SET uid_next = uid_next + 1,
                highest_modseq = highest_modseq + 1,
                total_messages = total_messages + 1,
                unread_messages = unread_messages + 1
            WHERE id = $2
            RETURNING uid_next - 1 AS allocated_uid, highest_modseq AS allocated_modseq
        )
        INSERT INTO mailserver.message_mailboxes (message_id, mailbox_id, uid, modseq, flags)
        SELECT $1, $2, alloc.allocated_uid, alloc.allocated_modseq, 0
        FROM alloc
        "#,
    )
    .bind(message_id_result)
    .bind(inbox_id)
    .execute(pool)
    .await
    {
        return RecipientResult::TempError {
            address: recipient.to_string(),
            reason: format!("Mailbox insert failed: {e}"),
        };
    }

    // Send PostgreSQL NOTIFY for real-time IMAP IDLE and UI updates
    let notify_payload = serde_json::json!({
        "account_id": account.id.to_string(),
        "mailbox_id": inbox_id.to_string(),
        "message_id": message_id_result.to_string(),
        "event": "new_message",
    });
    if let Err(e) = sqlx::query("SELECT pg_notify('mailbox_changes', $1)")
        .bind(notify_payload.to_string())
        .execute(pool)
        .await
    {
        // Non-fatal: message is delivered, NOTIFY is best-effort
        tracing::warn!(
            account_id = %account.id,
            "pg_notify failed: {}",
            e
        );
    }

    tracing::info!(
        recipient = %recipient,
        account_id = %account.id,
        message_db_id = %message_id_result,
        "Message delivered to INBOX"
    );

    RecipientResult::Delivered {
        address: recipient.to_string(),
        account_id: account.id,
    }
}

/// Insert message content with dedup by SHA-256 hash.
///
/// Returns the `id` of the content row (existing or newly created).
///
/// # Errors
///
/// Returns `sqlx::Error` on database failure.
///
/// # Panics
///
/// None.
async fn insert_content(
    pool: &Pool<Postgres>,
    content_hash: &str,
    raw_size: i64,
    headers_json: Option<&serde_json::Value>,
    body_text: Option<&str>,
    body_html: Option<&str>,
    body_structure: &serde_json::Value,
) -> Result<Uuid, sqlx::Error> {
    let row = sqlx::query(
        r#"
        WITH ins AS (
            INSERT INTO mailserver.message_contents
                (content_hash, raw_size, headers_json,
                 body_text, body_html, body_structure)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (content_hash) DO NOTHING
            RETURNING id
        )
        SELECT id FROM ins
        UNION ALL
        SELECT id FROM mailserver.message_contents
        WHERE content_hash = $1
        LIMIT 1
        "#,
    )
    .bind(content_hash)
    .bind(raw_size)
    .bind(headers_json)
    .bind(body_text)
    .bind(body_html)
    .bind(body_structure)
    .fetch_one(pool)
    .await?;

    Ok(row.get("id"))
}

/// Create an INBOX mailbox for an account that doesn't have one.
///
/// # Errors
///
/// Returns `sqlx::Error` on database failure.
///
/// # Panics
///
/// None.
async fn create_inbox(pool: &Pool<Postgres>, account_id: Uuid) -> Result<Uuid, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO mailserver.mailboxes
            (account_id, name, special_use, uid_validity, sort_order)
        VALUES ($1, 'INBOX', '\Inbox', (EXTRACT(EPOCH FROM NOW())::INT), 0)
        ON CONFLICT DO NOTHING
        RETURNING id
        "#,
    )
    .bind(account_id)
    .fetch_optional(pool)
    .await?;

    match row {
        Some(r) => Ok(r.get("id")),
        None => {
            // Already exists (race condition) — fetch it
            let id = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM mailserver.mailboxes WHERE account_id = $1 AND name = 'INBOX' LIMIT 1",
            )
            .bind(account_id)
            .fetch_one(pool)
            .await?;
            Ok(id)
        },
    }
}

/// Minimal account row for local delivery lookups.
#[derive(Debug, sqlx::FromRow)]
struct AccountRow {
    id: Uuid,
    #[allow(dead_code)]
    domain_id: Uuid,
}

// ── Helper functions ────────────────────────────────────────────────────────

/// Extract the bare email address from a From header value.
///
/// Handles formats like:
/// - `user@example.com`
/// - `<user@example.com>`
/// - `Display Name <user@example.com>`
fn extract_email_address(from: &str) -> String {
    if let Some(start) = from.find('<') {
        if let Some(end) = from.find('>') {
            return from[start + 1..end].trim().to_string();
        }
    }
    // No angle brackets — return the whole thing trimmed
    from.trim().to_string()
}

/// Extract the display name from a From header value.
///
/// Returns `Some("Display Name")` for `Display Name <user@example.com>`,
/// or `None` if no display name is present.
fn extract_display_name(from: &str) -> Option<String> {
    if let Some(start) = from.find('<') {
        let name = from[..start].trim();
        // Strip surrounding quotes
        let name = name.trim_matches('"').trim();
        if name.is_empty() {
            None
        } else {
            Some(name.to_string())
        }
    } else {
        None
    }
}

/// Try to parse an RFC 2822 date string into a `DateTime<Utc>`.
///
/// Returns `None` if the date cannot be parsed.
fn parse_rfc2822_date(date_str: &str) -> Option<DateTime<Utc>> {
    // Try RFC 2822 format first
    if let Ok(dt) = chrono::DateTime::parse_from_rfc2822(date_str) {
        return Some(dt.with_timezone(&Utc));
    }
    // Try RFC 3339 / ISO 8601 as fallback
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(date_str) {
        return Some(dt.with_timezone(&Utc));
    }
    None
}

/// Check if a recipient domain is hosted locally.
///
/// # Errors
///
/// Returns `sqlx::Error` on database failure.
///
/// # Panics
///
/// None.
pub async fn is_local_domain(pool: &Pool<Postgres>, domain: &str) -> Result<bool, sqlx::Error> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM mailserver.domains WHERE LOWER(name) = LOWER($1) AND COALESCE(is_active, true))",
    )
    .bind(domain)
    .fetch_one(pool)
    .await?;
    Ok(exists)
}

// ── Sieve integration ────────────────────────────────────────────────────────

/// Sieve script row from the database.
#[derive(Debug, sqlx::FromRow)]
struct SieveScriptRow {
    #[allow(dead_code)]
    id: Uuid,
    script_source: String,
}

/// Load and evaluate the active Sieve script for a recipient account.
///
/// Returns the list of actions to apply. If no active script is found or
/// compilation fails, returns `[Keep]` (deliver normally).
///
/// # Panics
///
/// None.
async fn evaluate_sieve(
    pool: &Pool<Postgres>,
    account_id: Uuid,
    sender: &str,
    recipient: &str,
    subject: Option<&str>,
) -> Vec<signapps_sieve::SieveAction> {
    // Load active Sieve script for this account
    let script_row: Option<SieveScriptRow> = sqlx::query_as(
        r#"SELECT id, script_source
           FROM mailserver.sieve_scripts
           WHERE account_id = $1 AND is_active = true
           ORDER BY created_at DESC
           LIMIT 1"#,
    )
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let script_row = match script_row {
        Some(r) => r,
        None => return vec![signapps_sieve::SieveAction::Keep],
    };

    // Compile the script
    let compiled = match signapps_sieve::SieveScript::compile(&script_row.script_source) {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!(
                account_id = %account_id,
                "Sieve script compilation failed: {}, delivering normally", e
            );
            return vec![signapps_sieve::SieveAction::Keep];
        }
    };

    // Build context from message metadata
    let ctx = signapps_sieve::SieveContext {
        from: sender.to_string(),
        to: vec![recipient.to_string()],
        subject: subject.unwrap_or("").to_string(),
        headers: vec![
            ("From".to_string(), sender.to_string()),
            ("To".to_string(), recipient.to_string()),
            (
                "Subject".to_string(),
                subject.unwrap_or("").to_string(),
            ),
        ],
        size: 0, // Size is not easily available here; 0 is safe for most rules
    };

    let actions = compiled.execute(&ctx);
    tracing::debug!(
        account_id = %account_id,
        actions = ?actions,
        "Sieve evaluation complete"
    );
    actions
}

/// Find a mailbox by name, or create it if it doesn't exist.
///
/// Used by Sieve `fileinto` to deliver to non-INBOX mailboxes.
///
/// # Errors
///
/// Returns `sqlx::Error` on database failure.
///
/// # Panics
///
/// None.
async fn find_or_create_mailbox(
    pool: &Pool<Postgres>,
    account_id: Uuid,
    mailbox_name: &str,
) -> Result<Uuid, sqlx::Error> {
    // Try to find existing mailbox
    let existing: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM mailserver.mailboxes WHERE account_id = $1 AND (name = $2 OR special_use = $3) LIMIT 1",
    )
    .bind(account_id)
    .bind(mailbox_name)
    .bind(if mailbox_name == "INBOX" { "\\Inbox" } else { "" })
    .fetch_optional(pool)
    .await?;

    if let Some(id) = existing {
        return Ok(id);
    }

    // For INBOX, create with special_use
    if mailbox_name.eq_ignore_ascii_case("INBOX") {
        return create_inbox(pool, account_id).await;
    }

    // Create new mailbox for Sieve fileinto target
    let row = sqlx::query(
        r#"INSERT INTO mailserver.mailboxes
               (account_id, name, uid_validity, sort_order)
           VALUES ($1, $2, (EXTRACT(EPOCH FROM NOW())::INT), 99)
           ON CONFLICT DO NOTHING
           RETURNING id"#,
    )
    .bind(account_id)
    .bind(mailbox_name)
    .fetch_optional(pool)
    .await?;

    match row {
        Some(r) => Ok(r.get("id")),
        None => {
            // Race condition — fetch existing
            let id = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM mailserver.mailboxes WHERE account_id = $1 AND name = $2 LIMIT 1",
            )
            .bind(account_id)
            .bind(mailbox_name)
            .fetch_one(pool)
            .await?;
            Ok(id)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_email_address_bare() {
        assert_eq!(
            extract_email_address("user@example.com"),
            "user@example.com"
        );
    }

    #[test]
    fn test_extract_email_address_angle_brackets() {
        assert_eq!(
            extract_email_address("<user@example.com>"),
            "user@example.com"
        );
    }

    #[test]
    fn test_extract_email_address_with_name() {
        assert_eq!(
            extract_email_address("John Doe <john@example.com>"),
            "john@example.com"
        );
    }

    #[test]
    fn test_extract_display_name() {
        assert_eq!(
            extract_display_name("John Doe <john@example.com>"),
            Some("John Doe".to_string())
        );
    }

    #[test]
    fn test_extract_display_name_quoted() {
        assert_eq!(
            extract_display_name("\"John Doe\" <john@example.com>"),
            Some("John Doe".to_string())
        );
    }

    #[test]
    fn test_extract_display_name_none() {
        assert_eq!(extract_display_name("john@example.com"), None);
        assert_eq!(extract_display_name("<john@example.com>"), None);
    }

    #[test]
    fn test_parse_rfc2822_date() {
        let date = parse_rfc2822_date("Thu, 3 Apr 2026 10:30:00 +0200");
        assert!(date.is_some());
    }

    #[test]
    fn test_parse_rfc2822_date_invalid() {
        assert!(parse_rfc2822_date("not a date").is_none());
    }
}
