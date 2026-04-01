use crate::handlers::categorize::{categorize_email, ensure_label_and_apply};
use crate::models::{MailAccount, MailFolder};
use async_imap::extensions::idle::IdleResponse;
use async_imap::Authenticator;
use base64::Engine as _;
use chrono::Utc;
use futures_util::stream::StreamExt;
use mailparse::parse_mail;
use reqwest;
use signapps_common::pg_events::{NewEvent, PgEventBus};
use sqlx::{Pool, Postgres};
use tokio::time::Duration;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// XOAUTH2 authenticator for Gmail / Outlook IMAP OAuth2
// ---------------------------------------------------------------------------

struct XOAuth2Authenticator {
    response: String,
}

impl Authenticator for XOAuth2Authenticator {
    type Response = String;
    fn process(&mut self, _challenge: &[u8]) -> Self::Response {
        self.response.clone()
    }
}

/// Run the periodic IMAP sync loop (every 30 seconds).
///
/// This is the fallback sync mechanism for accounts that do not support
/// IMAP IDLE. It iterates over all active accounts and syncs those whose
/// `sync_interval_minutes` has elapsed since `last_sync_at`.
///
/// This function never returns -- it runs as a background Tokio task.
///
/// # Errors
///
/// Individual account sync failures are logged and recorded in the
/// `last_error` column; they do not stop the loop.
pub async fn start_sync_scheduler(pool: Pool<Postgres>, event_bus: PgEventBus) {
    tracing::info!("Starting IMAP sync scheduler...");

    // Sync accounts every 30 seconds (fallback for accounts without IDLE support)
    loop {
        if let Err(e) = sync_all_accounts(&pool, &event_bus).await {
            tracing::error!("Error during sync cycle: {:?}", e);
        }
        tokio::time::sleep(Duration::from_secs(30)).await;
    }
}

/// Attempt IMAP IDLE on INBOX for a single account.
///
/// When the server signals a change the function triggers an incremental sync
/// and then re-enters IDLE. If the server does not support IDLE the function
/// exits, leaving the periodic polling loop in [`start_sync_scheduler`] as the
/// sole sync mechanism.
///
/// Spawned once per active account by [`start_idle_listeners`].
///
/// # Errors
///
/// Connection and authentication failures are logged and retried after a
/// 60-second backoff. The function only returns (without error) when IDLE
/// is not supported by the server.
pub async fn idle_inbox(pool: Pool<Postgres>, event_bus: PgEventBus, account: MailAccount) {
    let imap_server = match account.imap_server.as_deref() {
        Some(s) => s.to_string(),
        None => {
            tracing::warn!("IDLE: account {} has no IMAP server", account.email_address);
            return;
        },
    };
    let imap_port = account.imap_port.unwrap_or(993) as u16;
    // Allow OAuth-only accounts (no app_password required when oauth_token is set)
    let password = account.app_password.as_deref().map(|s| s.to_string());
    if password.is_none() && account.oauth_token.is_none() {
        tracing::warn!(
            "IDLE: account {} has neither password nor OAuth token",
            account.email_address
        );
        return;
    }

    loop {
        // ---- connect --------------------------------------------------------
        let tcp_stream =
            match tokio::net::TcpStream::connect((&imap_server as &str, imap_port)).await {
                Ok(s) => s,
                Err(e) => {
                    tracing::warn!(
                        "IDLE: TCP connect failed for {}: {}",
                        account.email_address,
                        e
                    );
                    tokio::time::sleep(Duration::from_secs(60)).await;
                    continue;
                },
            };

        let accept_invalid = std::env::var("IMAP_ACCEPT_INVALID_CERTS")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false);
        let tls_connector = match native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(accept_invalid)
            .danger_accept_invalid_hostnames(accept_invalid)
            .build()
        {
            Ok(c) => tokio_native_tls::TlsConnector::from(c),
            Err(e) => {
                tracing::warn!("IDLE: TLS builder failed: {}", e);
                return;
            },
        };

        let tls_stream = match tls_connector.connect(&imap_server, tcp_stream).await {
            Ok(s) => s,
            Err(e) => {
                tracing::warn!(
                    "IDLE: TLS handshake failed for {}: {}",
                    account.email_address,
                    e
                );
                tokio::time::sleep(Duration::from_secs(60)).await;
                continue;
            },
        };

        let client = async_imap::Client::new(tls_stream);
        // Try XOAUTH2 first if OAuth token is available, otherwise fall back to password.
        let mut session = if let Some(ref oauth_token) = account.oauth_token {
            let auth_string = format!(
                "user={}\x01auth=Bearer {}\x01\x01",
                account.email_address, oauth_token
            );
            let encoded = base64::engine::general_purpose::STANDARD.encode(auth_string.as_bytes());
            match client
                .authenticate("XOAUTH2", XOAuth2Authenticator { response: encoded })
                .await
            {
                Ok(s) => {
                    tracing::info!(
                        "IDLE: XOAUTH2 login succeeded for {}",
                        account.email_address
                    );
                    s
                },
                Err((e, _c)) => {
                    tracing::warn!(
                        "IDLE: XOAUTH2 failed for {}, trying password: {}",
                        account.email_address,
                        e
                    );
                    // Reconnect for password fallback
                    let tcp2 =
                        match tokio::net::TcpStream::connect((&imap_server as &str, imap_port))
                            .await
                        {
                            Ok(s) => s,
                            Err(e) => {
                                tracing::warn!(
                                    "IDLE: reconnect failed for {}: {}",
                                    account.email_address,
                                    e
                                );
                                tokio::time::sleep(Duration::from_secs(60)).await;
                                continue;
                            },
                        };
                    let tls2_stream = match tls_connector.connect(&imap_server, tcp2).await {
                        Ok(s) => s,
                        Err(e) => {
                            tracing::warn!(
                                "IDLE: TLS reconnect failed for {}: {}",
                                account.email_address,
                                e
                            );
                            tokio::time::sleep(Duration::from_secs(60)).await;
                            continue;
                        },
                    };
                    let client2 = async_imap::Client::new(tls2_stream);
                    match password {
                        Some(ref pw) => match client2
                            .login(&account.email_address, pw)
                            .await
                            .map_err(|e| e.0)
                        {
                            Ok(s) => s,
                            Err(e) => {
                                tracing::warn!(
                                    "IDLE: password login also failed for {}: {}",
                                    account.email_address,
                                    e
                                );
                                tokio::time::sleep(Duration::from_secs(60)).await;
                                continue;
                            },
                        },
                        None => {
                            tracing::warn!(
                                "IDLE: XOAUTH2 failed and no password for {}",
                                account.email_address
                            );
                            tokio::time::sleep(Duration::from_secs(60)).await;
                            continue;
                        },
                    }
                },
            }
        } else {
            match password {
                Some(ref pw) => match client
                    .login(&account.email_address, pw)
                    .await
                    .map_err(|e| e.0)
                {
                    Ok(s) => s,
                    Err(e) => {
                        tracing::warn!("IDLE: login failed for {}: {}", account.email_address, e);
                        tokio::time::sleep(Duration::from_secs(60)).await;
                        continue;
                    },
                },
                None => {
                    tracing::warn!("IDLE: no credentials for {}", account.email_address);
                    tokio::time::sleep(Duration::from_secs(60)).await;
                    continue;
                },
            }
        };

        // ---- select INBOX (required before IDLE) ----------------------------
        if let Err(e) = session.select("INBOX").await {
            tracing::warn!(
                "IDLE: SELECT INBOX failed for {}: {}",
                account.email_address,
                e
            );
            let _ = session.logout().await;
            tokio::time::sleep(Duration::from_secs(60)).await;
            continue;
        }

        // ---- enter IDLE -----------------------------------------------------
        // `session.idle()` consumes the session and returns a Handle.
        let mut handle = session.idle();
        if let Err(e) = handle.init().await {
            // Server does not support IDLE — fall back gracefully to polling.
            tracing::warn!(
                "IDLE not supported for {} ({}); polling loop remains active",
                account.email_address,
                e
            );
            if let Ok(mut s) = handle.done().await {
                let _ = s.logout().await;
            }
            return; // Exit this task; start_sync_scheduler continues polling.
        }

        tracing::debug!("IDLE active on INBOX for {}", account.email_address);

        // Wait up to 25 minutes for a server notification (RFC 2177: < 29 min).
        let idle_timeout_mins: u64 = std::env::var("IMAP_IDLE_TIMEOUT_MINS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(25);
        let (wait_fut, _stop) =
            handle.wait_with_timeout(Duration::from_secs(idle_timeout_mins * 60));
        let idle_result = wait_fut.await;

        // ---- exit IDLE and recover session ----------------------------------
        let mut session = match handle.done().await {
            Ok(s) => s,
            Err(e) => {
                tracing::warn!("IDLE: DONE failed for {}: {}", account.email_address, e);
                tokio::time::sleep(Duration::from_secs(10)).await;
                continue;
            },
        };

        match idle_result {
            Ok(IdleResponse::NewData(_)) => {
                tracing::debug!(
                    "IDLE: server signalled change for {}, running incremental sync",
                    account.email_address
                );
                if let Err(e) = session.select("INBOX").await {
                    tracing::warn!("IDLE post-notification SELECT failed: {}", e);
                } else if let Err(e) = sync_account(&pool, &account, &event_bus).await {
                    tracing::warn!(
                        "IDLE post-notification sync failed for {}: {}",
                        account.email_address,
                        e
                    );
                }
            },
            Ok(IdleResponse::Timeout) => {
                tracing::debug!(
                    "IDLE 25-min timeout for {}, re-entering IDLE",
                    account.email_address
                );
            },
            Ok(IdleResponse::ManualInterrupt) | Err(_) => {
                tracing::debug!(
                    "IDLE interrupted for {}, reconnecting",
                    account.email_address
                );
            },
        }

        let _ = session.logout().await;
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}

/// Spawn one [`idle_inbox`] task per active mail account.
///
/// Called once at startup after the first successful sync round. Each task
/// maintains a long-lived IMAP IDLE connection for real-time push
/// notifications. Accounts whose servers do not support IDLE will silently
/// fall back to the periodic polling loop.
///
/// # Errors
///
/// If the initial account query fails, a warning is logged and no listeners
/// are started (the polling loop in [`start_sync_scheduler`] still works).
pub async fn start_idle_listeners(pool: Pool<Postgres>, event_bus: PgEventBus) {
    let accounts: Vec<MailAccount> =
        match sqlx::query_as("SELECT * FROM mail.accounts WHERE status = 'active'")
            .fetch_all(&pool)
            .await
        {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!("start_idle_listeners: failed to load accounts: {}", e);
                return;
            },
        };

    tracing::info!("Starting IDLE listeners for {} account(s)", accounts.len());
    for account in accounts {
        let pool2 = pool.clone();
        let bus2 = event_bus.clone();
        tokio::spawn(async move {
            idle_inbox(pool2, bus2, account).await;
        });
    }
}

async fn sync_all_accounts(
    pool: &Pool<Postgres>,
    event_bus: &PgEventBus,
) -> Result<(), Box<dyn std::error::Error>> {
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
            if let Err(e) = sync_account(pool, &account, event_bus).await {
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

/// Map a raw IMAP folder name to a canonical folder_type string.
fn imap_name_to_folder_type(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    // Strip any namespace prefix like "[Gmail]/" or "INBOX."
    let base = lower
        .rsplit('/')
        .next()
        .unwrap_or(&lower)
        .rsplit('.')
        .next()
        .unwrap_or(&lower);

    match base {
        "inbox" => "inbox",
        "sent" | "sent items" | "sent messages" | "sent mail" => "sent",
        "drafts" | "draft" => "drafts",
        "trash" | "deleted items" | "deleted messages" => "trash",
        "junk" | "spam" | "junk e-mail" | "junk email" => "spam",
        "archive" | "archived" | "all mail" | "all messages" => "archive",
        _ => "custom",
    }
}

/// Display name for a folder given its type + raw IMAP name.
fn folder_display_name(folder_type: &str, imap_name: &str) -> String {
    match folder_type {
        "inbox" => "Inbox".to_string(),
        "sent" => "Sent".to_string(),
        "drafts" => "Drafts".to_string(),
        "trash" => "Trash".to_string(),
        "spam" => "Junk".to_string(),
        "archive" => "Archive".to_string(),
        _ => imap_name.to_string(),
    }
}

/// Refresh a Google OAuth2 access token using the stored refresh token.
/// Returns (new_access_token, new_expiry).
async fn refresh_google_token(
    refresh_token: &str,
) -> Result<(String, chrono::DateTime<Utc>), Box<dyn std::error::Error + Send + Sync>> {
    let client_id = std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default();
    let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default();

    let http = reqwest::Client::new();
    let resp = http
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("refresh_token", refresh_token),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    let new_token = resp["access_token"]
        .as_str()
        .ok_or("Missing access_token in refresh response")?
        .to_string();
    let expires_in = resp["expires_in"].as_i64().unwrap_or(3600);
    let new_expiry = Utc::now() + chrono::Duration::seconds(expires_in);

    Ok((new_token, new_expiry))
}

/// Perform a full IMAP sync for a single mail account.
///
/// Connects to the IMAP server, lists all folders, and fetches new messages
/// since `last_synced_uid` for each folder. OAuth tokens are refreshed
/// automatically if expired. Downloaded emails are categorized and persisted
/// to the database, and a real-time event is emitted via `event_bus`.
///
/// # Errors
///
/// Returns an error if:
/// - The IMAP server is not configured on the account.
/// - No authentication credentials are available (password or OAuth token).
/// - The TLS/IMAP connection or authentication fails.
/// - A database write fails during folder or email upsert.
#[tracing::instrument(skip(pool, event_bus), fields(account = %account.email_address))]
pub async fn sync_account(
    pool: &Pool<Postgres>,
    account: &MailAccount,
    event_bus: &PgEventBus,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let imap_server = account
        .imap_server
        .as_deref()
        .ok_or("IMAP server not configured")?;
    let imap_port = account.imap_port.unwrap_or(993) as u16;

    // -------------------------------------------------------------------------
    // Part 4: Refresh OAuth token if expired before attempting IMAP connection
    // -------------------------------------------------------------------------
    let effective_oauth_token: Option<String> = if let (Some(ref token), Some(expires)) =
        (&account.oauth_token, account.oauth_expires_at)
    {
        if expires < Utc::now() {
            tracing::info!(
                "OAuth token expired for {}, attempting refresh",
                account.email_address
            );
            if let Some(ref refresh_token) = account.oauth_refresh_token {
                match refresh_google_token(refresh_token).await {
                    Ok((new_token, new_expires)) => {
                        let _ = sqlx::query(
                                "UPDATE mail.accounts SET oauth_token = $1, oauth_expires_at = $2, updated_at = NOW() WHERE id = $3",
                            )
                            .bind(&new_token)
                            .bind(new_expires)
                            .bind(account.id)
                            .execute(pool)
                            .await;
                        tracing::info!("OAuth token refreshed for {}", account.email_address);
                        Some(new_token)
                    },
                    Err(e) => {
                        tracing::error!(
                            "Token refresh failed for {}: {}",
                            account.email_address,
                            e
                        );
                        Some(token.clone()) // try with the expired token anyway
                    },
                }
            } else {
                Some(token.clone())
            }
        } else {
            Some(token.clone())
        }
    } else {
        account.oauth_token.clone()
    };

    // Require at least one auth mechanism
    if effective_oauth_token.is_none() && account.app_password.is_none() {
        return Err("No authentication credentials (password or OAuth token)".into());
    }

    tracing::info!("Syncing account: {}", account.email_address);

    // Connect to IMAP
    let accept_invalid = std::env::var("IMAP_ACCEPT_INVALID_CERTS")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);
    let tls = tokio_native_tls::TlsConnector::from(
        native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(accept_invalid)
            .danger_accept_invalid_hostnames(accept_invalid)
            .build()?,
    );

    let connect_timeout = Duration::from_secs(
        std::env::var("IMAP_CONNECT_TIMEOUT_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30),
    );
    let tcp_stream = match tokio::time::timeout(
        connect_timeout,
        tokio::net::TcpStream::connect((imap_server, imap_port)),
    )
    .await
    {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => return Err(format!("TCP connect failed: {}", e).into()),
        Err(_) => return Err("IMAP connection timed out".into()),
    };
    let tls_stream = tls.connect(imap_server, tcp_stream).await?;
    let client = async_imap::Client::new(tls_stream);

    // -------------------------------------------------------------------------
    // Part 1: Try XOAUTH2 first if token available, fall back to password
    // -------------------------------------------------------------------------
    let mut session = if let Some(ref oauth_token) = effective_oauth_token {
        let auth_string = format!(
            "user={}\x01auth=Bearer {}\x01\x01",
            account.email_address, oauth_token
        );
        let encoded = base64::engine::general_purpose::STANDARD.encode(auth_string.as_bytes());

        match client
            .authenticate("XOAUTH2", XOAuth2Authenticator { response: encoded })
            .await
        {
            Ok(s) => {
                tracing::info!("XOAUTH2 login succeeded for {}", account.email_address);
                s
            },
            Err((e, _client)) => {
                tracing::warn!(
                    "XOAUTH2 failed for {}, trying password: {}",
                    account.email_address,
                    e
                );
                // Reconnect and try password
                let tcp2 = tokio::net::TcpStream::connect((imap_server, imap_port)).await?;
                let tls_stream2 = tls.connect(imap_server, tcp2).await?;
                let client2 = async_imap::Client::new(tls_stream2);
                let pw = account
                    .app_password
                    .as_deref()
                    .ok_or("XOAUTH2 failed and no password fallback available")?;
                client2
                    .login(&account.email_address, pw)
                    .await
                    .map_err(|e| e.0)?
            },
        }
    } else {
        let pw = account.app_password.as_deref().ok_or("No password set")?;
        client
            .login(&account.email_address, pw)
            .await
            .map_err(|e| e.0)?
    };

    // -------------------------------------------------------------------------
    // Bug 5: List ALL folders from IMAP server
    // -------------------------------------------------------------------------
    let folder_list = session.list(Some(""), Some("*")).await?;
    let mut imap_folders: Vec<String> = Vec::new();
    let mut fl_stream = folder_list;
    while let Some(name_result) = fl_stream.next().await {
        match name_result {
            Ok(name) => {
                imap_folders.push(name.name().to_string());
            },
            Err(e) => {
                tracing::warn!("Error listing folder: {:?}", e);
            },
        }
    }
    drop(fl_stream);

    // Ensure INBOX is always present
    if imap_folders.is_empty() {
        imap_folders.push("INBOX".to_string());
    }

    tracing::info!(
        "Found {} IMAP folders for {}",
        imap_folders.len(),
        account.email_address
    );

    let mut total_new_messages = 0usize;

    // -------------------------------------------------------------------------
    // Sync each folder
    // -------------------------------------------------------------------------
    for imap_path in &imap_folders {
        let folder_type = imap_name_to_folder_type(imap_path);
        let display_name = folder_display_name(folder_type, imap_path);

        // Get or create the folder record in DB
        let folder = match get_or_create_folder_by_path(
            pool,
            account.id,
            folder_type,
            &display_name,
            imap_path,
        )
        .await
        {
            Ok(f) => f,
            Err(e) => {
                tracing::warn!("Failed to get/create folder '{}': {:?}", imap_path, e);
                continue;
            },
        };

        // Try selecting the folder; some may not be selectable (e.g. \Noselect)
        if let Err(e) = session.select(imap_path).await {
            tracing::debug!("Skipping unselectable folder '{}': {:?}", imap_path, e);
            continue;
        }

        // -----------------------------------------------------------------------
        // Idea 50: Incremental IMAP sync — only fetch UIDs we haven't seen yet.
        // On first sync (no last_synced_uid), fall back to fetching sequence 1:50.
        // -----------------------------------------------------------------------
        let last_uid = folder.last_synced_uid;

        let uids_to_fetch: Vec<u32> = if let Some(last) = last_uid {
            // Ask the server for all UIDs > last_synced_uid
            let search_range = format!("{}:*", last + 1);
            let uid_set = match session.uid_search(search_range).await {
                Ok(s) => s,
                Err(e) => {
                    tracing::warn!("UID SEARCH failed on '{}': {:?}", imap_path, e);
                    continue;
                },
            };
            // Filter out the sentinel UID the server echoes when the range is empty
            uid_set
                .into_iter()
                .filter(|&uid| uid as i64 > last)
                .collect()
        } else {
            // First sync: fetch the last 50 messages by sequence number and collect their UIDs
            let messages = match session.fetch("1:50", "(RFC822.HEADER UID FLAGS)").await {
                Ok(m) => m,
                Err(e) => {
                    tracing::warn!("Failed to fetch from '{}': {:?}", imap_path, e);
                    continue;
                },
            };
            let mut stream = messages;
            let mut header_uids: Vec<u32> = Vec::new();
            while let Some(msg) = stream.next().await {
                if let Ok(fetch) = msg {
                    let uid = fetch.uid.unwrap_or(0);
                    if uid > 0 {
                        header_uids.push(uid);
                    }
                }
            }
            drop(stream);

            // Exclude UIDs already stored in DB (safety net for the first-run case)
            let mut new_uids = Vec::new();
            for uid in header_uids {
                let exists: (i64,) = match sqlx::query_as(
                    "SELECT COUNT(*) FROM mail.emails WHERE account_id = $1 AND imap_uid = $2",
                )
                .bind(account.id)
                .bind(uid as i64)
                .fetch_one(pool)
                .await
                {
                    Ok(r) => r,
                    Err(e) => {
                        tracing::warn!("DB error checking UID {}: {:?}", uid, e);
                        continue;
                    },
                };
                if exists.0 == 0 {
                    new_uids.push(uid);
                }
            }
            new_uids
        };

        // Track the highest UID we process so we can update last_synced_uid afterwards
        let mut max_uid_this_sync: Option<i64> = None;

        // Fetch full messages for new UIDs (limit 20 per folder per sync).
        // Always use uid_fetch so the set refers to IMAP UIDs, not sequence numbers.
        let batch_size: usize = std::env::var("IMAP_SYNC_BATCH_SIZE")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(20);
        for uid in uids_to_fetch.iter().take(batch_size) {
            let full_msg_stream = match session
                .uid_fetch(uid.to_string(), "(BODY.PEEK[] FLAGS)")
                .await
            {
                Ok(s) => s,
                Err(e) => {
                    tracing::warn!("Failed to uid_fetch UID {} body: {:?}", uid, e);
                    continue;
                },
            };
            let mut fm_stream = full_msg_stream;

            if let Some(Ok(m)) = fm_stream.next().await {
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
                        let is_read = m
                            .flags()
                            .any(|f| matches!(f, async_imap::types::Flag::Seen));

                        // Parse received date
                        let received_at = date_str
                            .and_then(|d| chrono::DateTime::parse_from_rfc2822(&d).ok())
                            .map(|d| d.with_timezone(&Utc));

                        // Collect attachments before insert
                        let attachments = extract_attachments(&parsed);
                        let has_attachments = !attachments.is_empty();

                        // Insert email
                        let inserted: Option<(Uuid,)> = sqlx::query_as(
                            r#"
                            INSERT INTO mail.emails (
                                account_id, folder_id, imap_uid, message_id, in_reply_to,
                                sender, sender_name, recipient, cc, subject,
                                body_text, body_html, snippet, is_read, received_at, has_attachments
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                            ON CONFLICT DO NOTHING
                            RETURNING id
                            "#,
                        )
                        .bind(account.id)
                        .bind(folder.id)
                        .bind(*uid as i64)
                        .bind(&message_id)
                        .bind(&in_reply_to)
                        .bind(sender_email.clone().unwrap_or(from.clone().unwrap_or_default()))
                        .bind(&sender_name)
                        .bind(&to)
                        .bind(&cc)
                        .bind(&subject)
                        .bind(&body_text)
                        .bind(&body_html)
                        .bind(&snippet)
                        .bind(is_read)
                        .bind(received_at)
                        .bind(has_attachments)
                        .fetch_optional(pool)
                        .await
                        .unwrap_or(None);

                        if let Some((email_id,)) = inserted {
                            total_new_messages += 1;

                            // Idea #33: Auto-label on incoming emails using keyword categorization
                            {
                                let category = categorize_email(
                                    sender_email
                                        .as_deref()
                                        .unwrap_or_else(|| from.as_deref().unwrap_or("")),
                                    subject.as_deref().unwrap_or(""),
                                    body_text.as_deref().unwrap_or(""),
                                );
                                if let Err(e) =
                                    ensure_label_and_apply(pool, email_id, &[], &category).await
                                {
                                    tracing::warn!(
                                        "Auto-label failed for email {}: {:?}",
                                        email_id,
                                        e
                                    );
                                }
                            }

                            // Track highest UID for incremental sync (Idea 50)
                            let uid_i64 = *uid as i64;
                            max_uid_this_sync = Some(
                                max_uid_this_sync.map_or(uid_i64, |prev: i64| prev.max(uid_i64)),
                            );

                            // -------------------------------------------------
                            // Bug 6: Insert attachments into mail.attachments
                            // -------------------------------------------------
                            for att in attachments {
                                let _ = sqlx::query(
                                    r#"
                                    INSERT INTO mail.attachments
                                        (email_id, filename, mime_type, size_bytes, is_inline, content_id)
                                    VALUES ($1, $2, $3, $4, $5, $6)
                                    "#,
                                )
                                .bind(email_id)
                                .bind(&att.filename)
                                .bind(&att.content_type)
                                .bind(att.size_bytes)
                                .bind(att.is_inline)
                                .bind(&att.content_id)
                                .execute(pool)
                                .await;
                            }

                            let _ = event_bus
                                .publish(NewEvent {
                                    event_type: "mail.received".into(),
                                    aggregate_id: Some(email_id),
                                    payload: serde_json::json!({
                                        "account_id": account.id,
                                        "subject": subject,
                                        "folder": imap_path,
                                    }),
                                })
                                .await;
                        }
                    }
                }
            }
            drop(fm_stream);
        }

        // Idea 50: Persist last_synced_uid so the next cycle only fetches new messages
        if let Some(max_uid) = max_uid_this_sync {
            let _ = sqlx::query(
                "UPDATE mail.folders SET last_synced_uid = $1, updated_at = NOW() WHERE id = $2",
            )
            .bind(max_uid)
            .bind(folder.id)
            .execute(pool)
            .await;
        }

        // Update folder counts
        if let Err(e) = update_folder_counts(pool, folder.id).await {
            tracing::warn!(
                "Failed to update counts for folder '{}': {:?}",
                imap_path,
                e
            );
        }
    }

    session.logout().await?;

    // Update last sync time
    sqlx::query(
        "UPDATE mail.accounts SET last_sync_at = NOW(), last_error = NULL, status = 'active', updated_at = NOW() WHERE id = $1",
    )
    .bind(account.id)
    .execute(pool)
    .await?;

    tracing::info!(
        "Sync complete for {}: {} new messages across {} folders",
        account.email_address,
        total_new_messages,
        imap_folders.len()
    );

    Ok(())
}

async fn get_or_create_folder_by_path(
    pool: &Pool<Postgres>,
    account_id: Uuid,
    folder_type: &str,
    display_name: &str,
    imap_path: &str,
) -> Result<MailFolder, Box<dyn std::error::Error + Send + Sync>> {
    // Look up by imap_path (unique constraint: account_id, imap_path)
    let folder = sqlx::query_as::<_, MailFolder>(
        "SELECT * FROM mail.folders WHERE account_id = $1 AND imap_path = $2",
    )
    .bind(account_id)
    .bind(imap_path)
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
    .bind(display_name)
    .bind(folder_type)
    .bind(imap_path)
    .fetch_one(pool)
    .await?;

    Ok(folder)
}

// Keep the old helper for compatibility (used nowhere else now, but kept to avoid breakage)
#[allow(dead_code)]
async fn get_or_create_folder(
    pool: &Pool<Postgres>,
    account_id: Uuid,
    folder_type: &str,
    imap_path: &str,
) -> Result<MailFolder, Box<dyn std::error::Error + Send + Sync>> {
    let display_name = folder_display_name(folder_type, imap_path);
    get_or_create_folder_by_path(pool, account_id, folder_type, &display_name, imap_path).await
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
            return (if name.is_empty() { None } else { Some(name) }, Some(email));
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
        let content_type = parsed.ctype.mimetype.to_lowercase();

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
            if !part.subparts.is_empty() {
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

/// Represents an attachment extracted from a MIME part.
struct AttachmentInfo {
    filename: String,
    content_type: String,
    size_bytes: i64,
    is_inline: bool,
    content_id: Option<String>,
}

/// Bug 6: Recursively extract attachment metadata from MIME parts.
/// Parts with content-type text/plain or text/html are skipped (they're body parts).
fn extract_attachments(parsed: &mailparse::ParsedMail) -> Vec<AttachmentInfo> {
    let mut attachments = Vec::new();
    collect_attachments(parsed, &mut attachments);
    attachments
}

fn collect_attachments(part: &mailparse::ParsedMail, out: &mut Vec<AttachmentInfo>) {
    let content_type = part.ctype.mimetype.to_lowercase();

    if !part.subparts.is_empty() {
        // Recurse into multipart
        for sub in &part.subparts {
            collect_attachments(sub, out);
        }
        return;
    }

    // Skip text bodies
    if content_type.contains("text/plain") || content_type.contains("text/html") {
        return;
    }

    // Determine Content-Disposition
    let disposition_header = part
        .headers
        .iter()
        .find(|h| h.get_key().eq_ignore_ascii_case("Content-Disposition"))
        .map(|h| h.get_value())
        .unwrap_or_default();

    let is_inline = disposition_header
        .to_lowercase()
        .trim_start()
        .starts_with("inline");

    // Extract filename from Content-Disposition or Content-Type params
    let filename = extract_filename_from_disposition(&disposition_header)
        .or_else(|| part.ctype.params.get("name").cloned())
        .unwrap_or_else(|| "attachment".to_string());

    // Extract Content-ID (for inline images)
    let content_id = part
        .headers
        .iter()
        .find(|h| h.get_key().eq_ignore_ascii_case("Content-ID"))
        .map(|h| {
            let v = h.get_value();
            // Strip angle brackets: <id@domain> → id@domain
            v.trim().trim_matches('<').trim_matches('>').to_string()
        });

    // Calculate size from raw body bytes
    let size_bytes = part.raw_bytes.len() as i64;

    out.push(AttachmentInfo {
        filename,
        content_type: part.ctype.mimetype.clone(),
        size_bytes,
        is_inline,
        content_id,
    });
}

/// Extract filename= parameter from a Content-Disposition header value.
fn extract_filename_from_disposition(disposition: &str) -> Option<String> {
    // e.g.: "attachment; filename=\"report.pdf\""
    for param in disposition.split(';') {
        let param = param.trim();
        if let Some(rest) = param.strip_prefix("filename*=") {
            // RFC 5987 encoded — best effort: grab value after ''
            let val = rest.splitn(3, '\'').nth(2).unwrap_or(rest);
            return Some(val.trim_matches('"').to_string());
        }
        if let Some(rest) = param.strip_prefix("filename=") {
            return Some(rest.trim_matches('"').to_string());
        }
    }
    None
}
