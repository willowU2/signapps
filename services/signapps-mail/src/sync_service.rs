use crate::models::MailAccount;
use chrono::Utc;
use futures_util::stream::StreamExt;
use mailparse::parse_mail;
use sqlx::{Pool, Postgres};

pub async fn start_sync_scheduler(pool: Pool<Postgres>) {
    // In a real application, tokio-cron-scheduler would be used to wake up every X minutes
    // and sync accounts.
    tracing::info!("Starting IMAP sync scheduler...");

    // For MVP, we will just spawn a loop that checks active accounts every 60 seconds
    loop {
        if let Err(e) = sync_all_accounts(&pool).await {
            tracing::error!("Error during sync cycle: {:?}", e);
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
    }
}

async fn sync_all_accounts(pool: &Pool<Postgres>) -> Result<(), Box<dyn std::error::Error>> {
    let accounts =
        sqlx::query_as::<_, MailAccount>("SELECT * FROM mail_accounts WHERE status = 'active'")
            .fetch_all(pool)
            .await?;

    for account in accounts {
        if let Err(e) = sync_account(pool, &account).await {
            tracing::error!("Failed to sync account {}: {:?}", account.email_address, e);
        }
    }

    Ok(())
}

async fn sync_account(
    pool: &Pool<Postgres>,
    account: &MailAccount,
) -> Result<(), Box<dyn std::error::Error>> {
    let imap_server = account.imap_server.as_deref().unwrap_or("127.0.0.1");
    let imap_port = account.imap_port.unwrap_or(143) as u16;
    let password = account.app_password.as_deref().unwrap_or("");

    if password.is_empty() {
        return Err("No password provided".into());
    }

    tracing::info!("Syncing account: {}", account.email_address);

    let tls = tokio_native_tls::TlsConnector::from(
        native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(true)
            .danger_accept_invalid_hostnames(true)
            .build()
            .unwrap(),
    );

    let tcp_stream = tokio::net::TcpStream::connect((imap_server, imap_port)).await?;
    let tls_stream = tls.connect(imap_server, tcp_stream).await?;
    let client = async_imap::Client::new(tls_stream);

    let mut session = client
        .login(&account.email_address, password)
        .await
        .map_err(|e| e.0)?;

    session.select("INBOX").await?;

    // Fetch UIDs of messages we don't have.
    // A robust implementation would store HIGHESTMODSEQ or track UIDs seen.
    // For MVP, we just fetch the last 10 messages.
    let mut uids_to_fetch = Vec::new();
    {
        let messages = session.fetch("1:*", "(RFC822.HEADER UID)").await?;
        let mut stream = messages;

        while let Some(msg) = stream.next().await {
            if let Ok(fetch) = msg {
                let uid = fetch.uid.unwrap_or(0);
                if uid > 0 {
                    let msg_id = format!("{}::{}", account.email_address, uid);
                    let exists: (i64,) =
                        sqlx::query_as("SELECT count(*) FROM emails WHERE message_id = $1")
                            .bind(&msg_id)
                            .fetch_one(pool)
                            .await?;

                    if exists.0 == 0 {
                        uids_to_fetch.push(uid);
                    }
                }
            }
        }
    }

    for uid in uids_to_fetch {
        let msg_id = format!("{}::{}", account.email_address, uid);
        let full_msg_stream = session.fetch(uid.to_string(), "(BODY.PEEK[])").await?;
        let mut fm_stream = full_msg_stream;

        if let Some(fm) = fm_stream.next().await {
            if let Ok(m) = fm {
                if let Some(body) = m.body() {
                    if let Ok(parsed) = parse_mail(body) {
                        let subject = parsed
                            .headers
                            .iter()
                            .find(|h| h.get_key() == "Subject")
                            .map(|h| h.get_value())
                            .unwrap_or_default();
                        let from = parsed
                            .headers
                            .iter()
                            .find(|h| h.get_key() == "From")
                            .map(|h| h.get_value())
                            .unwrap_or_default();
                        let to = parsed
                            .headers
                            .iter()
                            .find(|h| h.get_key() == "To")
                            .map(|h| h.get_value())
                            .unwrap_or_default();

                        let body_text = parsed.get_body().unwrap_or_default();

                        // MVP: Using a transaction or simple query. Let's just insert.
                        let _ = sqlx::query(
                            "INSERT INTO emails (account_id, sender, recipient, subject, body, message_id, is_read, folder, created_at)
                             VALUES ($1, $2, $3, $4, $5, $6, false, 'inbox', $7)"
                        )
                        .bind(account.id)
                        .bind(from)
                        .bind(to)
                        .bind(subject)
                        .bind(body_text)
                        .bind(&msg_id)
                        .bind(Utc::now())
                        .execute(pool)
                        .await;
                    }
                }
            }
        }
    }

    session.logout().await?;

    // Update last sync time
    sqlx::query("UPDATE mail_accounts SET last_sync_at = $1 WHERE id = $2")
        .bind(Utc::now())
        .bind(account.id)
        .execute(pool)
        .await?;

    Ok(())
}
