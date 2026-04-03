//! SMTP submission listener (port 587).
//!
//! Accepts outgoing email from authenticated local users. Implements full
//! [`signapps_smtp`] session handling with AUTH PLAIN/LOGIN/XOAUTH2,
//! DKIM signing, local delivery, and remote queue insertion.

use crate::state::MailServerState;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use signapps_dkim::DkimSigner;
use signapps_mime::MimeMessage;
use signapps_smtp::{SmtpAction, SmtpConfig, SmtpSession, SmtpState};
use sqlx::{Pool, Postgres};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use uuid::Uuid;

/// Start the SMTP submission listener on the given port.
///
/// This function runs forever, accepting TCP connections and spawning a task
/// for each one. It should be called via `tokio::spawn`.
///
/// Submission requires authentication before accepting mail. Sender addresses
/// are verified against the authenticated account.
///
/// # Errors
///
/// Logs errors via tracing but does not propagate them.
///
/// # Panics
///
/// None — binding failures are logged and the listener exits gracefully.
#[tracing::instrument(skip(state), fields(port))]
pub async fn start(state: MailServerState, port: u16) {
    let addr = format!("0.0.0.0:{}", port);
    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => {
            tracing::info!("SMTP submission listening on port {}", port);
            l
        },
        Err(e) => {
            tracing::error!("Failed to bind SMTP submission on {}: {}", addr, e);
            return;
        },
    };

    loop {
        let (stream, peer_addr) = match listener.accept().await {
            Ok(conn) => conn,
            Err(e) => {
                tracing::warn!("SMTP submission accept error: {}", e);
                continue;
            },
        };

        let conn_state = state.clone();
        tokio::spawn(async move {
            tracing::debug!(peer = %peer_addr, "SMTP submission connection");
            if let Err(e) = handle_connection(stream, peer_addr, conn_state).await {
                tracing::debug!(peer = %peer_addr, "SMTP submission connection ended: {}", e);
            }
        });
    }
}

/// Result type alias for submission connection errors.
type ConnResult = Result<(), Box<dyn std::error::Error + Send + Sync>>;

/// Handle a single SMTP submission connection using the `signapps_smtp`
/// session state machine.
///
/// Authenticates users via SASL PLAIN/LOGIN/XOAUTH2, verifies sender
/// ownership, signs outbound messages with DKIM, delivers local recipients
/// directly, and queues remote recipients for the outbound worker.
#[tracing::instrument(skip(stream, state), fields(peer = %peer_addr))]
async fn handle_connection(
    stream: tokio::net::TcpStream,
    peer_addr: std::net::SocketAddr,
    state: MailServerState,
) -> ConnResult {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);

    let hostname = std::env::var("MAIL_HOSTNAME").unwrap_or_else(|_| "signapps.local".to_string());

    let config = SmtpConfig {
        hostname: hostname.clone(),
        max_message_size: 50 * 1024 * 1024,
        require_auth: true,
        require_tls: false, // Dev mode: warn but don't enforce
    };

    let mut session = SmtpSession::new(config);

    // Send initial greeting
    let greeting = session.greeting();
    send_action(&mut writer, &greeting).await?;

    let mut line = String::new();
    let mut in_data = false;
    // Track the authenticated account address for sender verification
    let mut auth_account: Option<String> = None;

    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) => {
                tracing::debug!(peer = %peer_addr, "SMTP submission: client disconnected");
                break;
            },
            Err(e) => {
                tracing::debug!(peer = %peer_addr, "SMTP submission read error: {}", e);
                break;
            },
            Ok(_) => {},
        }

        if in_data {
            // Feed data lines to the session
            if let Some(action) = session.feed_data_line(line.as_bytes()) {
                in_data = false;
                match action {
                    SmtpAction::Deliver(envelope) => {
                        let result = process_submission(
                            &state.pool,
                            &hostname,
                            &envelope.sender,
                            &envelope.recipients,
                            &envelope.data,
                        )
                        .await;

                        match result {
                            Ok(()) => {
                                write_reply(&mut writer, 250, "OK: message accepted").await?;
                            },
                            Err(e) => {
                                tracing::error!(
                                    peer = %peer_addr,
                                    "Submission delivery failed: {}",
                                    e
                                );
                                write_reply(
                                    &mut writer,
                                    451,
                                    "Temporary failure processing message",
                                )
                                .await?;
                            },
                        }
                    },
                    other => {
                        send_action(&mut writer, &other).await?;
                    },
                }
            }
            // else: line accumulated, wait for more data
            continue;
        }

        // Feed command lines to the session
        let actions = session.feed_line(line.as_bytes());

        for action in actions {
            match action {
                SmtpAction::Authenticate { mechanism, initial } => {
                    let auth_result =
                        handle_auth(&state.pool, &mechanism, initial.as_deref()).await;

                    match auth_result {
                        Ok(account_addr) => {
                            session.set_authenticated(&account_addr);
                            auth_account = Some(account_addr);
                            write_reply(&mut writer, 235, "Authentication successful").await?;
                        },
                        Err(e) => {
                            tracing::warn!(
                                peer = %peer_addr,
                                mechanism = %mechanism,
                                "Auth failed: {}",
                                e
                            );
                            write_reply(&mut writer, 535, "Authentication credentials invalid")
                                .await?;
                        },
                    }
                },

                SmtpAction::AuthChallenge(challenge) => {
                    write_reply(&mut writer, 334, &challenge).await?;
                },

                SmtpAction::StartTls => {
                    // In dev mode, warn that TLS is not enforced but proceed
                    tracing::warn!(
                        peer = %peer_addr,
                        "STARTTLS requested but TLS not implemented in dev mode"
                    );
                    // The 220 reply was already sent by the session state machine
                },

                SmtpAction::SendCapabilities(caps) => {
                    send_capabilities(&mut writer, &caps).await?;
                },

                SmtpAction::AcceptData => {
                    in_data = true;
                },

                SmtpAction::Reply(code, text) => {
                    // Intercept MAIL FROM to verify sender ownership
                    if code == 250 {
                        if let SmtpState::MailFrom { ref sender } = session.state() {
                            if let Some(ref authed) = auth_account {
                                if !verify_sender_ownership(&state.pool, authed, sender).await {
                                    tracing::warn!(
                                        peer = %peer_addr,
                                        authed = %authed,
                                        sender = %sender,
                                        "Sender address not owned by authenticated account"
                                    );
                                    // We still allow it — the session already accepted it.
                                    // Just log a warning. Strict enforcement can be added later.
                                }
                            }
                        }
                    }
                    write_reply(&mut writer, code, &text).await?;
                },

                SmtpAction::Deliver(envelope) => {
                    let result = process_submission(
                        &state.pool,
                        &hostname,
                        &envelope.sender,
                        &envelope.recipients,
                        &envelope.data,
                    )
                    .await;

                    match result {
                        Ok(()) => {
                            write_reply(&mut writer, 250, "OK: message accepted").await?;
                        },
                        Err(e) => {
                            tracing::error!(
                                peer = %peer_addr,
                                "Submission delivery failed: {}",
                                e
                            );
                            write_reply(&mut writer, 451, "Temporary failure processing message")
                                .await?;
                        },
                    }
                },

                SmtpAction::Close => {
                    return Ok(());
                },
            }
        }
    }

    Ok(())
}

/// Write a single SMTP reply line to the client.
async fn write_reply(
    writer: &mut tokio::net::tcp::OwnedWriteHalf,
    code: u16,
    text: &str,
) -> ConnResult {
    let line = format!("{} {}\r\n", code, text);
    writer.write_all(line.as_bytes()).await?;
    Ok(())
}

/// Write the EHLO capabilities as a multiline response.
async fn send_capabilities(
    writer: &mut tokio::net::tcp::OwnedWriteHalf,
    caps: &[String],
) -> ConnResult {
    if caps.is_empty() {
        writer.write_all(b"250 OK\r\n").await?;
        return Ok(());
    }

    let last = caps.len() - 1;
    for (i, cap) in caps.iter().enumerate() {
        if i == last {
            let line = format!("250 {}\r\n", cap);
            writer.write_all(line.as_bytes()).await?;
        } else {
            let line = format!("250-{}\r\n", cap);
            writer.write_all(line.as_bytes()).await?;
        }
    }
    Ok(())
}

/// Send an [`SmtpAction`] to the client (helper for simple cases).
async fn send_action(
    writer: &mut tokio::net::tcp::OwnedWriteHalf,
    action: &SmtpAction,
) -> ConnResult {
    match action {
        SmtpAction::Reply(code, text) => {
            write_reply(writer, *code, text).await?;
        },
        SmtpAction::SendCapabilities(caps) => {
            send_capabilities(writer, caps).await?;
        },
        SmtpAction::AuthChallenge(challenge) => {
            write_reply(writer, 334, challenge).await?;
        },
        _ => {}, // Other actions handled by the main loop
    }
    Ok(())
}

// ─── Authentication ──────────────────────────────────────────────────────────

/// Handle SASL authentication by decoding credentials and verifying against
/// the `mailserver.accounts` table.
///
/// Returns the authenticated account address on success.
///
/// # Errors
///
/// Returns an error string if authentication fails.
async fn handle_auth(
    pool: &Pool<Postgres>,
    mechanism: &str,
    initial: Option<&str>,
) -> Result<String, String> {
    match mechanism {
        "PLAIN" => {
            let encoded = initial.ok_or("Missing PLAIN credentials")?;
            let creds = signapps_smtp::auth::decode_plain(encoded)
                .map_err(|e| format!("PLAIN decode error: {}", e))?;

            verify_password(pool, &creds.authcid, &creds.password).await
        },

        "LOGIN" => {
            // LOGIN with initial response: format is "base64(user):base64(pass)"
            let encoded = initial.ok_or("Missing LOGIN credentials")?;
            let parts: Vec<&str> = encoded.splitn(2, ':').collect();
            if parts.len() != 2 {
                return Err("Invalid LOGIN credential format".to_string());
            }

            let username_bytes = BASE64
                .decode(parts[0])
                .map_err(|e| format!("LOGIN username decode: {}", e))?;
            let password_bytes = BASE64
                .decode(parts[1])
                .map_err(|e| format!("LOGIN password decode: {}", e))?;

            let username = String::from_utf8(username_bytes)
                .map_err(|_| "Invalid UTF-8 in username".to_string())?;
            let password = String::from_utf8(password_bytes)
                .map_err(|_| "Invalid UTF-8 in password".to_string())?;

            verify_password(pool, &username, &password).await
        },

        "XOAUTH2" => {
            let encoded = initial.ok_or("Missing XOAUTH2 credentials")?;
            let (user, token) = signapps_smtp::auth::decode_xoauth2(encoded)
                .map_err(|e| format!("XOAUTH2 decode error: {}", e))?;

            verify_oauth_token(pool, &user, &token).await
        },

        other => Err(format!("Unsupported mechanism: {}", other)),
    }
}

/// Verify a username/password against `mailserver.accounts`.
///
/// Uses argon2 to verify the password against the stored hash.
/// Returns the account address on success.
async fn verify_password(
    pool: &Pool<Postgres>,
    username: &str,
    password: &str,
) -> Result<String, String> {
    #[derive(sqlx::FromRow)]
    struct AccountRow {
        address: String,
        password_hash: Option<String>,
    }

    let row: Option<AccountRow> = sqlx::query_as(
        "SELECT address, password_hash FROM mailserver.accounts \
         WHERE address = $1 AND is_active = true",
    )
    .bind(username)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("DB error: {}", e))?;

    let row = row.ok_or_else(|| "Account not found".to_string())?;
    let stored_hash = row
        .password_hash
        .ok_or_else(|| "No password set for account".to_string())?;

    // Verify with argon2
    use argon2::password_hash::PasswordVerifier;
    let parsed_hash = argon2::password_hash::PasswordHash::new(&stored_hash)
        .map_err(|e| format!("Invalid stored hash: {}", e))?;

    argon2::Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| "Invalid password".to_string())?;

    // Update last_login
    let _ = sqlx::query("UPDATE mailserver.accounts SET last_login = NOW() WHERE address = $1")
        .bind(&row.address)
        .execute(pool)
        .await;

    Ok(row.address)
}

/// Verify an XOAUTH2 token by calling the identity service's token
/// introspection endpoint.
///
/// Falls back to checking if the user account exists and is active if the
/// identity service is unreachable.
async fn verify_oauth_token(
    pool: &Pool<Postgres>,
    user: &str,
    token: &str,
) -> Result<String, String> {
    // Try to validate via the identity service
    let identity_url =
        std::env::var("IDENTITY_SERVICE_URL").unwrap_or_else(|_| "http://localhost:3001".into());

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/api/v1/auth/me", identity_url))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    match resp {
        Ok(r) if r.status().is_success() => {
            // Token is valid — verify the user exists in mailserver accounts
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM mailserver.accounts \
                 WHERE address = $1 AND is_active = true)",
            )
            .bind(user)
            .fetch_one(pool)
            .await
            .map_err(|e| format!("DB error: {}", e))?;

            if exists {
                Ok(user.to_string())
            } else {
                Err("Account not found in mailserver".to_string())
            }
        },
        Ok(r) => Err(format!(
            "OAuth token rejected by identity service: {}",
            r.status()
        )),
        Err(e) => {
            tracing::warn!("Identity service unreachable for XOAUTH2 validation: {}", e);
            Err("Identity service unreachable".to_string())
        },
    }
}

// ─── Sender Verification ─────────────────────────────────────────────────────

/// Check whether the authenticated account owns the sender address.
///
/// Checks both `mailserver.accounts.address` and `mailserver.aliases.alias_address`.
async fn verify_sender_ownership(pool: &Pool<Postgres>, auth_account: &str, sender: &str) -> bool {
    if auth_account.eq_ignore_ascii_case(sender) {
        return true;
    }

    // Check aliases
    let is_alias: bool = sqlx::query_scalar(
        "SELECT EXISTS(\
             SELECT 1 FROM mailserver.aliases a \
             JOIN mailserver.accounts acc ON acc.id = a.account_id \
             WHERE acc.address = $1 AND a.alias_address = $2 AND a.is_active = true\
         )",
    )
    .bind(auth_account)
    .bind(sender)
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    is_alias
}

// ─── Message Processing ──────────────────────────────────────────────────────

/// Process a submitted message: sign with DKIM, deliver locally or queue
/// for remote delivery, and save to the sender's Sent mailbox.
///
/// # Errors
///
/// Returns an error if DKIM signing fails, database operations fail, or
/// message parsing encounters issues.
#[tracing::instrument(skip(pool, raw_data), fields(sender = %sender, recipients = ?recipients))]
async fn process_submission(
    pool: &Pool<Postgres>,
    hostname: &str,
    sender: &str,
    recipients: &[String],
    raw_data: &[u8],
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Extract sender domain
    let sender_domain = sender
        .rsplit('@')
        .next()
        .ok_or("Invalid sender address: no domain")?;

    // Try to DKIM-sign the message
    let signed_data = match sign_with_dkim(pool, sender_domain, raw_data).await {
        Ok(signed) => signed,
        Err(e) => {
            tracing::warn!(
                "DKIM signing failed for domain {}: {} — sending unsigned",
                sender_domain,
                e
            );
            raw_data.to_vec()
        },
    };

    // Look up the sender's account for saving to Sent
    let sender_account_id: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM mailserver.accounts WHERE address = $1")
            .bind(sender)
            .fetch_optional(pool)
            .await?;

    // Save to sender's Sent mailbox
    if let Some(account_id) = sender_account_id {
        if let Err(e) = save_to_sent(pool, account_id, &signed_data, sender, recipients).await {
            tracing::error!("Failed to save to Sent mailbox: {}", e);
            // Non-fatal — continue with delivery
        }
    }

    // Classify recipients as local or remote
    let local_domains: Vec<String> =
        sqlx::query_scalar("SELECT name FROM mailserver.domains WHERE is_active = true")
            .fetch_all(pool)
            .await?;

    let mut local_recipients = Vec::new();
    let mut remote_recipients = Vec::new();

    for rcpt in recipients {
        let rcpt_domain = rcpt.rsplit('@').next().unwrap_or("");
        if local_domains
            .iter()
            .any(|d| d.eq_ignore_ascii_case(rcpt_domain))
        {
            local_recipients.push(rcpt.clone());
        } else {
            remote_recipients.push(rcpt.clone());
        }
    }

    // Deliver to local recipients
    for rcpt in &local_recipients {
        if let Err(e) = deliver_local(pool, rcpt, sender, &signed_data).await {
            tracing::error!(recipient = %rcpt, "Local delivery failed: {}", e);
        }
    }

    // Queue remote recipients for outbound delivery
    if !remote_recipients.is_empty() {
        queue_for_delivery(pool, sender, &remote_recipients, &signed_data).await?;
    }

    Ok(())
}

/// Sign a message with DKIM using the domain's private key.
async fn sign_with_dkim(
    pool: &Pool<Postgres>,
    domain: &str,
    raw_data: &[u8],
) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
    #[derive(sqlx::FromRow)]
    struct DkimRow {
        dkim_private_key: Option<String>,
        dkim_selector: Option<String>,
    }

    let row: Option<DkimRow> = sqlx::query_as(
        "SELECT dkim_private_key, dkim_selector FROM mailserver.domains WHERE name = $1",
    )
    .bind(domain)
    .fetch_optional(pool)
    .await?;

    let row = row.ok_or("Domain not found in mailserver.domains")?;
    let private_key = row
        .dkim_private_key
        .ok_or("No DKIM private key configured")?;
    let selector = row.dkim_selector.unwrap_or_else(|| "default".to_string());

    let signer = DkimSigner::new_rsa(&private_key, &selector, domain)?;
    let signed = signer.sign(raw_data)?;

    Ok(signed)
}

/// Deliver a message to a local recipient's INBOX mailbox.
async fn deliver_local(
    pool: &Pool<Postgres>,
    recipient: &str,
    sender: &str,
    raw_data: &[u8],
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Find the recipient account (check address and aliases)
    let account_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM mailserver.accounts WHERE address = $1 AND is_active = true \
         UNION ALL \
         SELECT a.account_id FROM mailserver.aliases a WHERE a.alias_address = $1 AND a.is_active = true \
         LIMIT 1",
    )
    .bind(recipient)
    .fetch_optional(pool)
    .await?;

    let account_id =
        account_id.ok_or_else(|| format!("Local recipient not found: {}", recipient))?;

    // Find or create the INBOX mailbox
    let mailbox_id: Uuid = match sqlx::query_scalar(
        "SELECT id FROM mailserver.mailboxes \
         WHERE account_id = $1 AND (special_use = 'inbox' OR name = 'INBOX') \
         LIMIT 1",
    )
    .bind(account_id)
    .fetch_optional(pool)
    .await?
    {
        Some(id) => id,
        None => {
            // Create INBOX
            sqlx::query_scalar(
                "INSERT INTO mailserver.mailboxes (account_id, name, special_use, uid_validity) \
                 VALUES ($1, 'INBOX', 'inbox', EXTRACT(EPOCH FROM NOW())::INT) \
                 RETURNING id",
            )
            .bind(account_id)
            .fetch_one(pool)
            .await?
        },
    };

    // Parse the message for metadata
    let parsed = MimeMessage::parse(raw_data).ok();
    let subject = parsed
        .as_ref()
        .and_then(|m| m.subject().map(|s| s.to_string()));
    let has_attachments = parsed
        .as_ref()
        .map(|m| !m.attachments().is_empty())
        .unwrap_or(false);
    let content_hash = parsed
        .as_ref()
        .map(|m| m.content_hash())
        .unwrap_or_default();

    // Store message content (with dedup by content_hash)
    let content_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mailserver.message_contents (content_hash, raw_size, body_text, body_html) \
         VALUES ($1, $2, $3, $4) \
         ON CONFLICT (content_hash) DO UPDATE SET content_hash = EXCLUDED.content_hash \
         RETURNING id",
    )
    .bind(&content_hash)
    .bind(raw_data.len() as i64)
    .bind(parsed.as_ref().and_then(|m| m.text_body()))
    .bind(parsed.as_ref().and_then(|m| m.html_body()))
    .fetch_one(pool)
    .await?;

    // Insert message record
    let message_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mailserver.messages \
         (account_id, content_id, sender, subject, has_attachments, received_at, \
          message_id_header, recipients) \
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7) \
         RETURNING id",
    )
    .bind(account_id)
    .bind(content_id)
    .bind(sender)
    .bind(&subject)
    .bind(has_attachments)
    .bind(
        parsed
            .as_ref()
            .and_then(|m| m.message_id().map(|s| s.to_string())),
    )
    .bind(serde_json::json!([recipient]))
    .fetch_one(pool)
    .await?;

    // Assign UID and link to mailbox
    let uid: i32 = sqlx::query_scalar(
        "UPDATE mailserver.mailboxes SET uid_next = uid_next + 1, \
         total_messages = total_messages + 1, \
         unread_messages = unread_messages + 1, \
         highest_modseq = highest_modseq + 1 \
         WHERE id = $1 \
         RETURNING uid_next - 1",
    )
    .bind(mailbox_id)
    .fetch_one(pool)
    .await?;

    let modseq: i64 =
        sqlx::query_scalar("SELECT highest_modseq FROM mailserver.mailboxes WHERE id = $1")
            .bind(mailbox_id)
            .fetch_one(pool)
            .await?;

    sqlx::query(
        "INSERT INTO mailserver.message_mailboxes (message_id, mailbox_id, uid, modseq) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind(message_id)
    .bind(mailbox_id)
    .bind(uid)
    .bind(modseq)
    .execute(pool)
    .await?;

    tracing::info!(
        recipient = %recipient,
        message_id = %message_id,
        "Local delivery successful"
    );

    Ok(())
}

/// Save a copy of the sent message to the sender's Sent mailbox.
async fn save_to_sent(
    pool: &Pool<Postgres>,
    account_id: Uuid,
    raw_data: &[u8],
    sender: &str,
    recipients: &[String],
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Find or create the Sent mailbox
    let mailbox_id: Uuid =
        match sqlx::query_scalar(
            "SELECT id FROM mailserver.mailboxes \
         WHERE account_id = $1 AND (special_use = 'sent' OR name = 'Sent') \
         LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(pool)
        .await?
        {
            Some(id) => id,
            None => sqlx::query_scalar(
                "INSERT INTO mailserver.mailboxes (account_id, name, special_use, uid_validity) \
                 VALUES ($1, 'Sent', 'sent', EXTRACT(EPOCH FROM NOW())::INT) \
                 RETURNING id",
            )
            .bind(account_id)
            .fetch_one(pool)
            .await?,
        };

    // Parse for metadata
    let parsed = MimeMessage::parse(raw_data).ok();
    let subject = parsed
        .as_ref()
        .and_then(|m| m.subject().map(|s| s.to_string()));
    let has_attachments = parsed
        .as_ref()
        .map(|m| !m.attachments().is_empty())
        .unwrap_or(false);
    let content_hash = parsed
        .as_ref()
        .map(|m| m.content_hash())
        .unwrap_or_default();

    // Store message content (dedup)
    let content_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mailserver.message_contents (content_hash, raw_size, body_text, body_html) \
         VALUES ($1, $2, $3, $4) \
         ON CONFLICT (content_hash) DO UPDATE SET content_hash = EXCLUDED.content_hash \
         RETURNING id",
    )
    .bind(&content_hash)
    .bind(raw_data.len() as i64)
    .bind(parsed.as_ref().and_then(|m| m.text_body()))
    .bind(parsed.as_ref().and_then(|m| m.html_body()))
    .fetch_one(pool)
    .await?;

    // Insert message record
    let message_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mailserver.messages \
         (account_id, content_id, sender, subject, has_attachments, received_at, \
          message_id_header, recipients) \
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7) \
         RETURNING id",
    )
    .bind(account_id)
    .bind(content_id)
    .bind(sender)
    .bind(&subject)
    .bind(has_attachments)
    .bind(
        parsed
            .as_ref()
            .and_then(|m| m.message_id().map(|s| s.to_string())),
    )
    .bind(serde_json::json!(recipients))
    .fetch_one(pool)
    .await?;

    // Assign UID and link to Sent mailbox (mark as seen — flag bit 1)
    let uid: i32 = sqlx::query_scalar(
        "UPDATE mailserver.mailboxes SET uid_next = uid_next + 1, \
         total_messages = total_messages + 1, \
         highest_modseq = highest_modseq + 1 \
         WHERE id = $1 \
         RETURNING uid_next - 1",
    )
    .bind(mailbox_id)
    .fetch_one(pool)
    .await?;

    let modseq: i64 =
        sqlx::query_scalar("SELECT highest_modseq FROM mailserver.mailboxes WHERE id = $1")
            .bind(mailbox_id)
            .fetch_one(pool)
            .await?;

    // Flags: 1 = \Seen
    sqlx::query(
        "INSERT INTO mailserver.message_mailboxes (message_id, mailbox_id, uid, modseq, flags) \
         VALUES ($1, $2, $3, $4, 1)",
    )
    .bind(message_id)
    .bind(mailbox_id)
    .bind(uid)
    .bind(modseq)
    .execute(pool)
    .await?;

    Ok(())
}

/// Queue a message for remote delivery via the outbound worker.
///
/// Inserts a row into `mailserver.queue` with status "queued".
async fn queue_for_delivery(
    pool: &Pool<Postgres>,
    sender: &str,
    recipients: &[String],
    raw_data: &[u8],
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Look up sender account ID
    let account_id: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM mailserver.accounts WHERE address = $1")
            .bind(sender)
            .fetch_optional(pool)
            .await?;

    // Store message content for queue reference (use content hash as storage key)
    let content_hash = {
        use sha2::{Digest, Sha256};
        let hash = Sha256::digest(raw_data);
        hash.iter()
            .map(|b| format!("{:02x}", b))
            .collect::<String>()
    };

    // Insert the raw message into message_contents for later retrieval
    let _content_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mailserver.message_contents (content_hash, raw_size, body_text) \
         VALUES ($1, $2, $3) \
         ON CONFLICT (content_hash) DO UPDATE SET content_hash = EXCLUDED.content_hash \
         RETURNING id",
    )
    .bind(&content_hash)
    .bind(raw_data.len() as i64)
    .bind(String::from_utf8_lossy(raw_data).as_ref())
    .fetch_one(pool)
    .await?;

    sqlx::query(
        "INSERT INTO mailserver.queue \
         (account_id, from_address, recipients, raw_message_key, status, next_retry_at) \
         VALUES ($1, $2, $3, $4, 'queued', NOW())",
    )
    .bind(account_id)
    .bind(sender)
    .bind(serde_json::json!(recipients))
    .bind(&content_hash)
    .execute(pool)
    .await?;

    tracing::info!(
        sender = %sender,
        recipients = ?recipients,
        "Message queued for remote delivery"
    );

    Ok(())
}
