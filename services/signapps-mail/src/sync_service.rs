use crate::models::{MailAccount, MailFolder};
use chrono::Utc;
use futures_util::stream::StreamExt;
use mailparse::parse_mail;
use sqlx::{Pool, Postgres};
use uuid::Uuid;

pub async fn start_sync_scheduler(pool: Pool<Postgres>) {
    tracing::info!("Starting IMAP sync scheduler...");

    // Sync accounts every 60 seconds
    loop {
        if let Err(e) = sync_all_accounts(&pool).await {
            tracing::error!("Error during sync cycle: {:?}", e);
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
    }
}

async fn sync_all_accounts(pool: &Pool<Postgres>) -> Result<(), Box<dyn std::error::Error>> {
    let accounts =
        sqlx::query_as::<_, MailAccount>("SELECT * FROM mail.accounts WHERE status = 'active'")
            .fetch_all(pool)
            .await?;

    for account in accounts {
        // Check if it's time to sync based on interval
        let should_sync = account.last_sync_at.map_or(true, |last| {
            let interval = account.sync_interval_minutes.unwrap_or(5) as i64;
            Utc::now().signed_duration_since(last).num_minutes() >= interval
        });

        if should_sync {
            if let Err(e) = sync_account(pool, &account).await {
                tracing::error!("Failed to sync account {}: {:?}", account.email_address, e);
                // Update account with error
                let _ = sqlx::query(
                    "UPDATE mail.accounts SET last_error = $1, status = 'error', updated_at = NOW() WHERE id = $2"
                )
                .bind(e.to_string())
                .bind(account.id)
                .execute(pool)
                .await;
            }
        }
    }

    Ok(())
}

pub async fn sync_account(
    pool: &Pool<Postgres>,
    account: &MailAccount,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let imap_server = account
        .imap_server
        .as_deref()
        .ok_or("IMAP server not configured")?;
    let imap_port = account.imap_port.unwrap_or(993) as u16;
    let password = account.app_password.as_deref().ok_or("No password set")?;

    tracing::info!("Syncing account: {}", account.email_address);

    // Connect to IMAP
    let tls = tokio_native_tls::TlsConnector::from(
        native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(true)
            .danger_accept_invalid_hostnames(true)
            .build()?,
    );

    let tcp_stream = tokio::net::TcpStream::connect((imap_server, imap_port)).await?;
    let tls_stream = tls.connect(imap_server, tcp_stream).await?;
    let client = async_imap::Client::new(tls_stream);

    let mut session = client
        .login(&account.email_address, password)
        .await
        .map_err(|e| e.0)?;

    // Get or create inbox folder
    let inbox_folder = get_or_create_folder(pool, account.id, "inbox", "INBOX").await?;

    // Select INBOX
    session.select("INBOX").await?;

    // Fetch recent messages (last 50)
    let messages = session.fetch("1:50", "(RFC822.HEADER UID FLAGS)").await?;
    let mut stream = messages;

    let mut uids_to_fetch = Vec::new();

    while let Some(msg) = stream.next().await {
        if let Ok(fetch) = msg {
            let uid = fetch.uid.unwrap_or(0) as i64;
            if uid > 0 {
                // Check if we already have this message
                let exists: (i64,) = sqlx::query_as(
                    "SELECT COUNT(*) FROM mail.emails WHERE account_id = $1 AND imap_uid = $2",
                )
                .bind(account.id)
                .bind(uid)
                .fetch_one(pool)
                .await?;

                if exists.0 == 0 {
                    uids_to_fetch.push(uid as u32);
                }
            }
        }
    }

    // Fetch full messages for new UIDs
    for uid in uids_to_fetch.iter().take(20) {
        // Limit to 20 per sync
        let full_msg_stream = session.fetch(uid.to_string(), "(BODY.PEEK[] FLAGS)").await?;
        let mut fm_stream = full_msg_stream;

        if let Some(fm) = fm_stream.next().await {
            if let Ok(m) = fm {
                if let Some(body) = m.body() {
                    if let Ok(parsed) = parse_mail(body) {
                        let subject = get_header(&parsed, "Subject");
                        let from = get_header(&parsed, "From");
                        let to = get_header(&parsed, "To");
                        let cc = get_header(&parsed, "Cc");
                        let message_id = get_header(&parsed, "Message-ID");
                        let in_reply_to = get_header(&parsed, "In-Reply-To");
                        let date_str = get_header(&parsed, "Date");

                        // Parse sender name from "Name <email>" format
                        let (sender_name, sender_email) = parse_address(&from);

                        // Get body content
                        let (body_text, body_html) = extract_body(&parsed);

                        // Create snippet
                        let snippet = body_text
                            .as_ref()
                            .map(|t| t.chars().take(200).collect::<String>());

                        // Check if read (from FLAGS)
                        let is_read = m.flags().iter().any(|f| matches!(f, async_imap::types::Flag::Seen));

                        // Parse received date
                        let received_at = date_str
                            .and_then(|d| chrono::DateTime::parse_from_rfc2822(&d).ok())
                            .map(|d| d.with_timezone(&Utc));

                        // Insert email
                        let _ = sqlx::query(
                            r#"
                            INSERT INTO mail.emails (
                                account_id, folder_id, imap_uid, message_id, in_reply_to,
                                sender, sender_name, recipient, cc, subject,
                                body_text, body_html, snippet, is_read, received_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                            ON CONFLICT DO NOTHING
                            "#,
                        )
                        .bind(account.id)
                        .bind(inbox_folder.id)
                        .bind(*uid as i64)
                        .bind(&message_id)
                        .bind(&in_reply_to)
                        .bind(&sender_email.unwrap_or(from.clone().unwrap_or_default()))
                        .bind(&sender_name)
                        .bind(&to)
                        .bind(&cc)
                        .bind(&subject)
                        .bind(&body_text)
                        .bind(&body_html)
                        .bind(&snippet)
                        .bind(is_read)
                        .bind(received_at)
                        .execute(pool)
                        .await;
                    }
                }
            }
        }
    }

    session.logout().await?;

    // Update folder counts
    update_folder_counts(pool, inbox_folder.id).await?;

    // Update last sync time
    sqlx::query(
        "UPDATE mail.accounts SET last_sync_at = NOW(), last_error = NULL, status = 'active', updated_at = NOW() WHERE id = $1",
    )
    .bind(account.id)
    .execute(pool)
    .await?;

    tracing::info!(
        "Sync complete for {}: {} new messages",
        account.email_address,
        uids_to_fetch.len().min(20)
    );

    Ok(())
}

async fn get_or_create_folder(
    pool: &Pool<Postgres>,
    account_id: Uuid,
    folder_type: &str,
    imap_path: &str,
) -> Result<MailFolder, Box<dyn std::error::Error + Send + Sync>> {
    let folder = sqlx::query_as::<_, MailFolder>(
        "SELECT * FROM mail.folders WHERE account_id = $1 AND folder_type = $2",
    )
    .bind(account_id)
    .bind(folder_type)
    .fetch_optional(pool)
    .await?;

    if let Some(f) = folder {
        return Ok(f);
    }

    // Create folder
    let folder = sqlx::query_as::<_, MailFolder>(
        "INSERT INTO mail.folders (account_id, name, folder_type, imap_path) VALUES ($1, $2, $3, $4) RETURNING *",
    )
    .bind(account_id)
    .bind(folder_type.to_uppercase())
    .bind(folder_type)
    .bind(imap_path)
    .fetch_one(pool)
    .await?;

    Ok(folder)
}

async fn update_folder_counts(
    pool: &Pool<Postgres>,
    folder_id: Uuid,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    sqlx::query(
        r#"
        UPDATE mail.folders SET
            total_count = (SELECT COUNT(*) FROM mail.emails WHERE folder_id = $1 AND COALESCE(is_deleted, false) = false),
            unread_count = (SELECT COUNT(*) FROM mail.emails WHERE folder_id = $1 AND COALESCE(is_read, false) = false AND COALESCE(is_deleted, false) = false),
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(folder_id)
    .execute(pool)
    .await?;

    Ok(())
}

fn get_header(parsed: &mailparse::ParsedMail, name: &str) -> Option<String> {
    parsed
        .headers
        .iter()
        .find(|h| h.get_key().eq_ignore_ascii_case(name))
        .map(|h| h.get_value())
}

fn parse_address(addr: &Option<String>) -> (Option<String>, Option<String>) {
    let Some(addr) = addr else {
        return (None, None);
    };

    // Try to parse "Name <email>" format
    if let Some(start) = addr.find('<') {
        if let Some(end) = addr.find('>') {
            let name = addr[..start].trim().trim_matches('"').to_string();
            let email = addr[start + 1..end].trim().to_string();
            return (
                if name.is_empty() { None } else { Some(name) },
                Some(email),
            );
        }
    }

    // Just an email
    (None, Some(addr.clone()))
}

fn extract_body(parsed: &mailparse::ParsedMail) -> (Option<String>, Option<String>) {
    let mut text_body = None;
    let mut html_body = None;

    if parsed.subparts.is_empty() {
        // Single part message
        let content_type = parsed
            .ctype
            .mimetype
            .to_lowercase();

        if let Ok(body) = parsed.get_body() {
            if content_type.contains("text/html") {
                html_body = Some(body);
            } else {
                text_body = Some(body);
            }
        }
    } else {
        // Multipart message
        for part in &parsed.subparts {
            let content_type = part.ctype.mimetype.to_lowercase();

            if content_type.contains("text/plain") && text_body.is_none() {
                if let Ok(body) = part.get_body() {
                    text_body = Some(body);
                }
            } else if content_type.contains("text/html") && html_body.is_none() {
                if let Ok(body) = part.get_body() {
                    html_body = Some(body);
                }
            }

            // Recurse into nested multipart
            if part.subparts.len() > 0 {
                let (nested_text, nested_html) = extract_body(part);
                if text_body.is_none() {
                    text_body = nested_text;
                }
                if html_body.is_none() {
                    html_body = nested_html;
                }
            }
        }
    }

    (text_body, html_body)
}
