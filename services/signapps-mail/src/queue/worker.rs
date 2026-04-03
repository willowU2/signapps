//! Outbound queue worker — delivers queued messages to remote SMTP servers.
//!
//! The worker runs as a background [`tokio::spawn`] task. Every 30 seconds it
//! polls `mailserver.queue` for messages with status `queued` or `deferred`
//! whose `next_retry_at` has passed, then attempts delivery.
//!
//! # Retry Strategy
//!
//! Temporary failures (SMTP 4xx) trigger exponential backoff:
//! - Retry 1: 1 minute
//! - Retry 2: 5 minutes
//! - Retry 3: 30 minutes
//! - Retry 4: 2 hours
//! - Retry 5: 12 hours
//! - Retry 6+: 24 hours
//!
//! After 72 hours from initial queuing, messages are marked as bounced.

use crate::state::MailServerState;
use sqlx::{Pool, Postgres};
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use trust_dns_resolver::config::{ResolverConfig, ResolverOpts};
use trust_dns_resolver::TokioAsyncResolver;

/// Queued message row from `mailserver.queue`.
#[derive(Debug, sqlx::FromRow)]
struct QueuedMessage {
    /// Unique identifier for the queued message.
    id: uuid::Uuid,
    /// Envelope sender address.
    from_address: String,
    /// JSON array of recipient addresses.
    recipients: serde_json::Value,
    /// Key into `mailserver.message_contents.content_hash` for the raw message.
    raw_message_key: Option<String>,
    /// Current retry count.
    retry_count: i32,
    /// When the message was first queued.
    created_at: chrono::DateTime<chrono::Utc>,
}

/// Start the outbound queue worker.
///
/// Runs in an infinite loop, polling every 30 seconds. Should be called via
/// `tokio::spawn(queue::worker::start(state))`.
///
/// # Errors
///
/// Logs errors via tracing but never propagates them. Individual message
/// delivery failures do not crash the worker.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(state))]
pub async fn start(state: MailServerState) {
    tracing::info!("Queue worker started");
    let mut interval = tokio::time::interval(Duration::from_secs(30));

    loop {
        interval.tick().await;
        if let Err(e) = process_queue(&state.pool).await {
            tracing::error!("Queue worker cycle failed: {}", e);
        }
    }
}

/// Process all eligible messages in the outbound queue.
///
/// Fetches messages with status `queued` or `deferred` whose `next_retry_at`
/// has passed, then attempts delivery for each.
async fn process_queue(pool: &Pool<Postgres>) -> Result<(), sqlx::Error> {
    let messages: Vec<QueuedMessage> = sqlx::query_as(
        "SELECT id, from_address, recipients, raw_message_key, retry_count, created_at \
         FROM mailserver.queue \
         WHERE status IN ('queued', 'deferred') \
           AND (next_retry_at IS NULL OR next_retry_at <= NOW()) \
         ORDER BY priority DESC, created_at ASC \
         LIMIT 50 \
         FOR UPDATE SKIP LOCKED",
    )
    .fetch_all(pool)
    .await?;

    if messages.is_empty() {
        return Ok(());
    }

    tracing::info!(count = messages.len(), "Processing queued messages");

    // Create DNS resolver once for the batch
    let resolver = TokioAsyncResolver::tokio(ResolverConfig::default(), ResolverOpts::default());

    for msg in messages {
        if let Err(e) = process_single_message(pool, &resolver, &msg).await {
            tracing::error!(
                queue_id = %msg.id,
                "Failed to process queued message: {}",
                e
            );
        }
    }

    Ok(())
}

/// Process a single queued message — resolve MX, connect, deliver.
async fn process_single_message(
    pool: &Pool<Postgres>,
    resolver: &TokioAsyncResolver,
    msg: &QueuedMessage,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Check 72-hour expiry
    let age = chrono::Utc::now() - msg.created_at;
    if age > chrono::Duration::hours(72) {
        mark_bounced(pool, msg.id, "Message expired after 72 hours of retries").await?;
        return Ok(());
    }

    // Load raw message data
    let raw_data = load_raw_message(pool, msg.raw_message_key.as_deref()).await?;

    // Parse recipients
    let recipients: Vec<String> = msg
        .recipients
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    if recipients.is_empty() {
        mark_bounced(pool, msg.id, "No valid recipients").await?;
        return Ok(());
    }

    // Group recipients by domain
    let mut by_domain: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for rcpt in &recipients {
        let domain = rcpt.rsplit('@').next().unwrap_or("").to_lowercase();
        by_domain.entry(domain).or_default().push(rcpt.clone());
    }

    let mut all_success = true;
    let mut permanent_failure = false;
    let mut last_error = String::new();

    for (domain, domain_recipients) in &by_domain {
        match deliver_to_domain(
            resolver,
            &msg.from_address,
            domain_recipients,
            domain,
            &raw_data,
        )
        .await
        {
            Ok(()) => {
                tracing::info!(
                    queue_id = %msg.id,
                    domain = %domain,
                    "Delivered to domain successfully"
                );
            },
            Err(SmtpDeliveryError::Permanent(e)) => {
                tracing::error!(
                    queue_id = %msg.id,
                    domain = %domain,
                    "Permanent delivery failure: {}",
                    e
                );
                permanent_failure = true;
                last_error = e;
                all_success = false;
            },
            Err(SmtpDeliveryError::Temporary(e)) => {
                tracing::warn!(
                    queue_id = %msg.id,
                    domain = %domain,
                    "Temporary delivery failure: {}",
                    e
                );
                last_error = e;
                all_success = false;
            },
            Err(SmtpDeliveryError::Connection(e)) => {
                tracing::warn!(
                    queue_id = %msg.id,
                    domain = %domain,
                    "Connection error: {}",
                    e
                );
                last_error = e;
                all_success = false;
            },
        }
    }

    if all_success {
        mark_sent(pool, msg.id).await?;
    } else if permanent_failure {
        mark_bounced(pool, msg.id, &last_error).await?;
    } else {
        defer_message(pool, msg.id, msg.retry_count, &last_error).await?;
    }

    Ok(())
}

/// Errors that can occur during SMTP delivery to a remote server.
#[derive(Debug)]
enum SmtpDeliveryError {
    /// Permanent failure (5xx) — do not retry.
    Permanent(String),
    /// Temporary failure (4xx) — retry later.
    Temporary(String),
    /// Connection-level error — retry later.
    Connection(String),
}

/// Deliver a message to all recipients at a single domain.
///
/// Resolves MX records, connects to the highest-priority MX host on port 25,
/// and sends the message via SMTP.
async fn deliver_to_domain(
    resolver: &TokioAsyncResolver,
    sender: &str,
    recipients: &[String],
    domain: &str,
    raw_data: &[u8],
) -> Result<(), SmtpDeliveryError> {
    // Resolve MX records
    let mx_hosts = resolve_mx(resolver, domain).await?;

    if mx_hosts.is_empty() {
        return Err(SmtpDeliveryError::Permanent(format!(
            "No MX records found for domain: {}",
            domain
        )));
    }

    // Try each MX host in priority order
    for mx_host in &mx_hosts {
        match try_deliver_to_host(mx_host, sender, recipients, raw_data).await {
            Ok(()) => return Ok(()),
            Err(SmtpDeliveryError::Permanent(e)) => {
                return Err(SmtpDeliveryError::Permanent(e));
            },
            Err(e) => {
                tracing::debug!(
                    mx_host = %mx_host,
                    "MX host delivery failed, trying next: {:?}",
                    e
                );
                continue;
            },
        }
    }

    Err(SmtpDeliveryError::Temporary(format!(
        "All MX hosts for {} failed",
        domain
    )))
}

/// Resolve MX records for a domain, returning hostnames sorted by priority.
async fn resolve_mx(
    resolver: &TokioAsyncResolver,
    domain: &str,
) -> Result<Vec<String>, SmtpDeliveryError> {
    match resolver.mx_lookup(domain).await {
        Ok(mx_response) => {
            let mut mx_list: Vec<(u16, String)> = mx_response
                .iter()
                .map(|mx| {
                    let host = mx.exchange().to_ascii();
                    // Remove trailing dot
                    let host = host.trim_end_matches('.').to_string();
                    (mx.preference(), host)
                })
                .collect();

            mx_list.sort_by_key(|(prio, _)| *prio);
            Ok(mx_list.into_iter().map(|(_, host)| host).collect())
        },
        Err(e) => {
            // If no MX record, try the domain itself (per RFC 5321 section 5.1)
            tracing::debug!(
                domain = %domain,
                "MX lookup failed ({}), falling back to domain A record",
                e
            );
            Ok(vec![domain.to_string()])
        },
    }
}

/// Attempt to deliver a message to a specific MX host via SMTP on port 25.
///
/// Implements a simple SMTP client: EHLO, MAIL FROM, RCPT TO, DATA.
async fn try_deliver_to_host(
    host: &str,
    sender: &str,
    recipients: &[String],
    raw_data: &[u8],
) -> Result<(), SmtpDeliveryError> {
    let addr = format!("{}:25", host);

    // Connect with a 30-second timeout
    let stream = match tokio::time::timeout(
        Duration::from_secs(30),
        tokio::net::TcpStream::connect(&addr),
    )
    .await
    {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => {
            return Err(SmtpDeliveryError::Connection(format!(
                "Failed to connect to {}: {}",
                addr, e
            )));
        },
        Err(_) => {
            return Err(SmtpDeliveryError::Connection(format!(
                "Connection to {} timed out",
                addr
            )));
        },
    };

    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);

    // Read greeting
    let greeting = read_response(&mut reader).await?;
    if !greeting.starts_with('2') {
        return Err(SmtpDeliveryError::Permanent(format!(
            "Bad greeting from {}: {}",
            host, greeting
        )));
    }

    // Send EHLO
    let my_hostname =
        std::env::var("MAIL_HOSTNAME").unwrap_or_else(|_| "signapps.local".to_string());
    send_command(&mut writer, &format!("EHLO {}", my_hostname)).await?;
    let ehlo_resp = read_response(&mut reader).await?;
    if !ehlo_resp.starts_with('2') {
        // Fallback to HELO
        send_command(&mut writer, &format!("HELO {}", my_hostname)).await?;
        let helo_resp = read_response(&mut reader).await?;
        if !helo_resp.starts_with('2') {
            return Err(SmtpDeliveryError::Temporary(format!(
                "HELO rejected by {}: {}",
                host, helo_resp
            )));
        }
    }

    // MAIL FROM
    send_command(&mut writer, &format!("MAIL FROM:<{}>", sender)).await?;
    let mail_resp = read_response(&mut reader).await?;
    check_response(&mail_resp, host, "MAIL FROM")?;

    // RCPT TO for each recipient
    for rcpt in recipients {
        send_command(&mut writer, &format!("RCPT TO:<{}>", rcpt)).await?;
        let rcpt_resp = read_response(&mut reader).await?;
        check_response(&rcpt_resp, host, "RCPT TO")?;
    }

    // DATA
    send_command(&mut writer, "DATA").await?;
    let data_resp = read_response(&mut reader).await?;
    if !data_resp.starts_with('3') {
        return Err(classify_error(&data_resp, host, "DATA"));
    }

    // Send message body with dot-stuffing
    for line in raw_data.split(|&b| b == b'\n') {
        let line_str = if line.ends_with(b"\r") {
            &line[..line.len() - 1]
        } else {
            line
        };

        // Dot-stuffing: lines starting with "." get an extra "." prepended
        if line_str.starts_with(b".") {
            writer
                .write_all(b".")
                .await
                .map_err(|e| SmtpDeliveryError::Connection(format!("Write error: {}", e)))?;
        }
        writer
            .write_all(line_str)
            .await
            .map_err(|e| SmtpDeliveryError::Connection(format!("Write error: {}", e)))?;
        writer
            .write_all(b"\r\n")
            .await
            .map_err(|e| SmtpDeliveryError::Connection(format!("Write error: {}", e)))?;
    }

    // End of data
    writer
        .write_all(b".\r\n")
        .await
        .map_err(|e| SmtpDeliveryError::Connection(format!("Write error: {}", e)))?;
    writer
        .flush()
        .await
        .map_err(|e| SmtpDeliveryError::Connection(format!("Flush error: {}", e)))?;

    let end_resp = read_response(&mut reader).await?;
    check_response(&end_resp, host, "end-of-data")?;

    // QUIT (best-effort)
    let _ = send_command(&mut writer, "QUIT").await;
    let _ = read_response(&mut reader).await;

    Ok(())
}

/// Send an SMTP command line.
async fn send_command(
    writer: &mut tokio::net::tcp::OwnedWriteHalf,
    command: &str,
) -> Result<(), SmtpDeliveryError> {
    let line = format!("{}\r\n", command);
    writer
        .write_all(line.as_bytes())
        .await
        .map_err(|e| SmtpDeliveryError::Connection(format!("Write error: {}", e)))?;
    writer
        .flush()
        .await
        .map_err(|e| SmtpDeliveryError::Connection(format!("Flush error: {}", e)))?;
    Ok(())
}

/// Read a complete SMTP response (may be multiline).
///
/// Multiline responses use `code-text` for continuation lines and `code text`
/// for the final line.
async fn read_response(
    reader: &mut BufReader<tokio::net::tcp::OwnedReadHalf>,
) -> Result<String, SmtpDeliveryError> {
    let mut full_response = String::new();
    let mut line = String::new();

    loop {
        line.clear();
        match tokio::time::timeout(Duration::from_secs(60), reader.read_line(&mut line)).await {
            Ok(Ok(0)) => {
                return Err(SmtpDeliveryError::Connection(
                    "Server closed connection".to_string(),
                ));
            },
            Ok(Ok(_)) => {
                full_response.push_str(&line);
                // Check if this is the last line (code followed by space, not dash)
                if line.len() >= 4 && line.as_bytes()[3] == b' ' {
                    break;
                }
                // Continuation line (code followed by dash)
                if line.len() >= 4 && line.as_bytes()[3] == b'-' {
                    continue;
                }
                // Malformed response — treat as complete
                break;
            },
            Ok(Err(e)) => {
                return Err(SmtpDeliveryError::Connection(format!("Read error: {}", e)));
            },
            Err(_) => {
                return Err(SmtpDeliveryError::Connection(
                    "Response read timed out (60s)".to_string(),
                ));
            },
        }
    }

    Ok(full_response.trim().to_string())
}

/// Classify an SMTP response as success, temporary, or permanent failure.
fn check_response(response: &str, host: &str, command: &str) -> Result<(), SmtpDeliveryError> {
    if response.starts_with('2') {
        Ok(())
    } else {
        Err(classify_error(response, host, command))
    }
}

/// Classify an SMTP error response code.
fn classify_error(response: &str, host: &str, command: &str) -> SmtpDeliveryError {
    let code = response
        .chars()
        .take(3)
        .collect::<String>()
        .parse::<u16>()
        .unwrap_or(0);

    let msg = format!("{} rejected {} at {}: {}", host, command, host, response);

    if (500..600).contains(&code) {
        SmtpDeliveryError::Permanent(msg)
    } else {
        SmtpDeliveryError::Temporary(msg)
    }
}

// ─── Database Operations ─────────────────────────────────────────────────────

/// Load raw message data from `mailserver.message_contents` by content hash.
async fn load_raw_message(
    pool: &Pool<Postgres>,
    content_hash: Option<&str>,
) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
    let hash = content_hash.ok_or("Missing raw_message_key")?;

    let body: Option<String> = sqlx::query_scalar(
        "SELECT body_text FROM mailserver.message_contents WHERE content_hash = $1",
    )
    .bind(hash)
    .fetch_optional(pool)
    .await?;

    let body = body.ok_or_else(|| format!("Message content not found for hash: {}", hash))?;
    Ok(body.into_bytes())
}

/// Mark a queued message as successfully sent.
async fn mark_sent(pool: &Pool<Postgres>, queue_id: uuid::Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE mailserver.queue SET status = 'sent', sent_at = NOW() WHERE id = $1")
        .bind(queue_id)
        .execute(pool)
        .await?;

    tracing::info!(queue_id = %queue_id, "Message marked as sent");
    Ok(())
}

/// Mark a queued message as bounced (permanent failure).
async fn mark_bounced(
    pool: &Pool<Postgres>,
    queue_id: uuid::Uuid,
    reason: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE mailserver.queue SET status = 'bounced', sent_at = NOW() WHERE id = $1")
        .bind(queue_id)
        .execute(pool)
        .await?;

    tracing::warn!(
        queue_id = %queue_id,
        reason = %reason,
        "Message bounced"
    );

    // TODO: Generate bounce notification email back to sender

    Ok(())
}

/// Defer a message for later retry with exponential backoff.
///
/// Backoff schedule:
/// - Retry 1: 1 minute
/// - Retry 2: 5 minutes
/// - Retry 3: 30 minutes
/// - Retry 4: 2 hours
/// - Retry 5: 12 hours
/// - Retry 6+: 24 hours
async fn defer_message(
    pool: &Pool<Postgres>,
    queue_id: uuid::Uuid,
    current_retry: i32,
    error: &str,
) -> Result<(), sqlx::Error> {
    let delay_seconds: i64 = match current_retry {
        0 => 60,    // 1 minute
        1 => 300,   // 5 minutes
        2 => 1800,  // 30 minutes
        3 => 7200,  // 2 hours
        4 => 43200, // 12 hours
        _ => 86400, // 24 hours
    };

    let next_retry = chrono::Utc::now() + chrono::Duration::seconds(delay_seconds);

    sqlx::query(
        "UPDATE mailserver.queue \
         SET status = 'deferred', \
             retry_count = retry_count + 1, \
             next_retry_at = $2 \
         WHERE id = $1",
    )
    .bind(queue_id)
    .bind(next_retry)
    .execute(pool)
    .await?;

    tracing::info!(
        queue_id = %queue_id,
        retry = current_retry + 1,
        next_retry = %next_retry,
        error = %error,
        "Message deferred for retry"
    );

    Ok(())
}
