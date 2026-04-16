use crate::handlers::categorize::{categorize_email, ensure_label_and_apply};
use crate::models::{MailAccount, MailFolder};
use chrono::Utc;
use mailparse::parse_mail;
use reqwest;
use signapps_common::pg_events::{NewEvent, PgEventBus};
use sqlx::{Pool, Postgres};
use tokio::time::Duration;
use uuid::Uuid;

/// Check whether to accept invalid TLS certificates (for dev/self-signed).
fn accept_invalid_certs() -> bool {
    std::env::var("IMAP_ACCEPT_INVALID_CERTS")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false)
}

/// TLS handshake timeout (seconds).
#[allow(dead_code)]
const TLS_CONNECT_TIMEOUT_SECS: u64 = 10;

/// Global sync_account timeout (seconds).
const SYNC_ACCOUNT_TIMEOUT_SECS: u64 = 120;

/// Build a native-tls connector for IMAP connections.
///
/// # Errors
///
/// Returns `native_tls::Error` if the underlying TLS library cannot load a
/// usable CA store or initialize the connector. Callers must handle this
/// rather than panic — the worker thread is long-lived and a panic would
/// take down all pending syncs.
pub fn build_native_tls_connector(
    accept_invalid: bool,
) -> Result<tokio_native_tls::TlsConnector, native_tls::Error> {
    let connector = native_tls::TlsConnector::builder()
        .danger_accept_invalid_certs(accept_invalid)
        .danger_accept_invalid_hostnames(accept_invalid)
        .build()?;
    Ok(tokio_native_tls::TlsConnector::from(connector))
}

/// Perform a TLS handshake with a timeout using native-tls.
///
/// Wraps the TLS connect in a timeout to prevent indefinite blocking.
pub async fn tls_connect(
    connector: &tokio_native_tls::TlsConnector,
    domain: &str,
    tcp_stream: tokio::net::TcpStream,
) -> Result<
    tokio_native_tls::TlsStream<tokio::net::TcpStream>,
    Box<dyn std::error::Error + Send + Sync>,
> {
    let tls_stream = tokio::time::timeout(
        Duration::from_secs(TLS_CONNECT_TIMEOUT_SECS),
        connector.connect(domain, tcp_stream),
    )
    .await
    .map_err(|_| {
        format!(
            "TLS handshake timed out after {}s for {}",
            TLS_CONNECT_TIMEOUT_SECS, domain
        )
    })?
    .map_err(|e| format!("TLS handshake failed for {}: {}", domain, e))?;
    Ok(tls_stream)
}

// ---------------------------------------------------------------------------
// XOAUTH2 authenticator for the synchronous `imap` crate (v2.x)
// ---------------------------------------------------------------------------

/// XOAUTH2 authenticator for use with the synchronous `imap` crate.
///
/// The SASL XOAUTH2 initial response is pre-built and base64-encoded.
/// The `process` method returns the raw bytes (the `imap` crate handles
/// base64 encoding internally, so we return the *decoded* auth string).
struct XOAuth2Auth {
    /// Raw XOAUTH2 auth string: `user=<email>\x01auth=Bearer <token>\x01\x01`
    auth_string: Vec<u8>,
}

impl imap::Authenticator for XOAuth2Auth {
    type Response = Vec<u8>;

    fn process(&self, _challenge: &[u8]) -> Self::Response {
        self.auth_string.clone()
    }
}

// ---------------------------------------------------------------------------
// Data structures for passing fetched mail data out of spawn_blocking
// ---------------------------------------------------------------------------

/// Represents a single fetched email message from IMAP (pre-parsed).
struct FetchedMessage {
    uid: u32,
    subject: Option<String>,
    from: Option<String>,
    to: Option<String>,
    cc: Option<String>,
    message_id: Option<String>,
    in_reply_to: Option<String>,
    sender_name: Option<String>,
    sender_email: Option<String>,
    body_text: Option<String>,
    body_html: Option<String>,
    snippet: Option<String>,
    is_read: bool,
    received_at: Option<chrono::DateTime<Utc>>,
    has_attachments: bool,
    attachments: Vec<AttachmentInfo>,
    list_unsubscribe: Option<String>,
    list_id: Option<String>,
}

/// Represents a folder's sync results from IMAP.
struct FolderSyncResult {
    imap_path: String,
    folder_type: String,
    display_name: String,
    messages: Vec<FetchedMessage>,
    /// UIDs fetched during initial sync (first sync, no last_synced_uid).
    initial_uids: Vec<u32>,
}

/// Result of the IMAP operations performed inside `spawn_blocking`.
struct ImapSyncResult {
    folders: Vec<FolderSyncResult>,
}

// ---------------------------------------------------------------------------
// IMAP IDLE outcome for the sync crate
// ---------------------------------------------------------------------------

/// Outcome from an IDLE wait inside `spawn_blocking`.
enum IdleOutcome {
    /// Mailbox changed — trigger incremental sync.
    MailboxChanged,
    /// IDLE timed out — re-enter IDLE.
    TimedOut,
    /// IDLE not supported — fall back to polling.
    NotSupported,
    /// An error occurred.
    Error(String),
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

/// Attempt IMAP IDLE on INBOX for a single account using the synchronous
/// `imap` crate inside `spawn_blocking`.
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
        // Refresh OAuth token if needed before connecting
        let effective_oauth_token: Option<String> = if let (Some(ref token), Some(expires)) =
            (&account.oauth_token, account.oauth_expires_at)
        {
            if expires < Utc::now() {
                tracing::info!(
                    "IDLE: OAuth token expired for {}, attempting refresh",
                    account.email_address
                );
                if let Some(ref refresh_token) = account.oauth_refresh_token {
                    let provider = if account.provider.is_empty() {
                        "google"
                    } else {
                        &account.provider
                    };
                    match refresh_oauth_token(provider, refresh_token).await {
                        Ok((new_token, new_expires)) => {
                            let _ = sqlx::query(
                                    "UPDATE mail.accounts SET oauth_token = $1, oauth_expires_at = $2, updated_at = NOW() WHERE id = $3",
                                )
                                .bind(&new_token)
                                .bind(new_expires)
                                .bind(account.id)
                                .execute(&pool)
                                .await;
                            tracing::info!(
                                "IDLE: OAuth token refreshed for {}",
                                account.email_address
                            );
                            Some(new_token)
                        },
                        Err(e) => {
                            tracing::error!(
                                "IDLE: Token refresh failed for {}: {}",
                                account.email_address,
                                e
                            );
                            Some(token.clone())
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

        // Clone values for the spawn_blocking closure
        let server = imap_server.clone();
        let email = account.email_address.clone();
        let pw = password.clone();
        let oauth = effective_oauth_token.clone();
        let invalid_certs = accept_invalid_certs();
        let idle_timeout_mins: u64 = std::env::var("IMAP_IDLE_TIMEOUT_MINS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(25);

        // ---- Run synchronous IMAP IDLE inside spawn_blocking --------------------
        let idle_result = tokio::task::spawn_blocking(move || -> IdleOutcome {
            // Build sync TLS connector
            let tls = native_tls::TlsConnector::builder()
                .danger_accept_invalid_certs(invalid_certs)
                .danger_accept_invalid_hostnames(invalid_certs)
                .build()
                .map_err(|e| format!("TLS builder error: {e}"));
            let tls = match tls {
                Ok(t) => t,
                Err(e) => return IdleOutcome::Error(e),
            };

            // Connect
            let client = match imap::connect((&server as &str, imap_port), &server, &tls) {
                Ok(c) => c,
                Err(e) => {
                    return IdleOutcome::Error(format!("IDLE: IMAP connect failed: {e}"));
                },
            };

            // Authenticate
            let mut session = if let Some(ref oauth_token) = oauth {
                let auth_string = format!("user={}\x01auth=Bearer {}\x01\x01", email, oauth_token);
                let auth = XOAuth2Auth {
                    auth_string: auth_string.into_bytes(),
                };
                match client.authenticate("XOAUTH2", &auth) {
                    Ok(s) => s,
                    Err((e, client2)) => {
                        // Try password fallback
                        if let Some(ref pw_str) = pw {
                            match client2.login(&email, pw_str) {
                                Ok(s) => s,
                                Err((e2, _)) => {
                                    return IdleOutcome::Error(format!(
                                        "IDLE: XOAUTH2 failed ({e}), password also failed: {e2}"
                                    ));
                                },
                            }
                        } else {
                            return IdleOutcome::Error(format!(
                                "IDLE: XOAUTH2 failed and no password: {e}"
                            ));
                        }
                    },
                }
            } else if let Some(ref pw_str) = pw {
                match client.login(&email, pw_str) {
                    Ok(s) => s,
                    Err((e, _)) => {
                        return IdleOutcome::Error(format!("IDLE: login failed: {e}"));
                    },
                }
            } else {
                return IdleOutcome::Error("IDLE: no credentials".to_string());
            };

            // Select INBOX
            if let Err(e) = session.select("INBOX") {
                let _ = session.logout();
                return IdleOutcome::Error(format!("IDLE: SELECT INBOX failed: {e}"));
            }

            // Enter IDLE
            let idle_handle = match session.idle() {
                Ok(h) => h,
                Err(_e) => {
                    return IdleOutcome::NotSupported;
                },
            };

            // Wait with timeout
            let outcome = match idle_handle
                .wait_with_timeout(std::time::Duration::from_secs(idle_timeout_mins * 60))
            {
                Ok(imap::extensions::idle::WaitOutcome::MailboxChanged) => {
                    IdleOutcome::MailboxChanged
                },
                Ok(imap::extensions::idle::WaitOutcome::TimedOut) => IdleOutcome::TimedOut,
                Err(e) => IdleOutcome::Error(format!("IDLE wait error: {e}")),
            };

            // wait_with_timeout consumes the handle and returns the session
            // (implicitly via Drop), so we don't need to call logout here.
            // The session is dropped and the connection closed.

            outcome
        })
        .await;

        match idle_result {
            Ok(IdleOutcome::MailboxChanged) => {
                tracing::debug!(
                    "IDLE: server signalled change for {}, running incremental sync",
                    account.email_address
                );
                match tokio::time::timeout(
                    Duration::from_secs(SYNC_ACCOUNT_TIMEOUT_SECS),
                    sync_account(&pool, &account, &event_bus),
                )
                .await
                {
                    Ok(Err(e)) => {
                        tracing::warn!(
                            "IDLE post-notification sync failed for {}: {}",
                            account.email_address,
                            e
                        );
                    },
                    Err(_) => {
                        tracing::error!(
                            "IDLE post-notification sync timed out after {}s for {}",
                            SYNC_ACCOUNT_TIMEOUT_SECS,
                            account.email_address
                        );
                    },
                    Ok(Ok(())) => {},
                }
            },
            Ok(IdleOutcome::TimedOut) => {
                tracing::debug!(
                    "IDLE 25-min timeout for {}, re-entering IDLE",
                    account.email_address
                );
            },
            Ok(IdleOutcome::NotSupported) => {
                tracing::warn!(
                    "IDLE not supported for {}; polling loop remains active",
                    account.email_address
                );
                return; // Exit this task; start_sync_scheduler continues polling.
            },
            Ok(IdleOutcome::Error(msg)) => {
                tracing::warn!("IDLE error for {}: {}", account.email_address, msg);
                tokio::time::sleep(Duration::from_secs(60)).await;
            },
            Err(join_err) => {
                tracing::error!(
                    "IDLE spawn_blocking panicked for {}: {}",
                    account.email_address,
                    join_err
                );
                tokio::time::sleep(Duration::from_secs(60)).await;
            },
        }

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
            let sync_result = tokio::time::timeout(
                Duration::from_secs(SYNC_ACCOUNT_TIMEOUT_SECS),
                sync_account(pool, &account, event_bus),
            )
            .await;
            let err_msg = match sync_result {
                Ok(Ok(())) => None,
                Ok(Err(e)) => {
                    tracing::error!("Failed to sync account {}: {:?}", account.email_address, e);
                    Some(e.to_string())
                },
                Err(_) => {
                    tracing::error!(
                        "Sync timed out after {}s for account {}",
                        SYNC_ACCOUNT_TIMEOUT_SECS,
                        account.email_address
                    );
                    Some(format!(
                        "Sync timed out after {}s",
                        SYNC_ACCOUNT_TIMEOUT_SECS
                    ))
                },
            };
            if let Some(msg) = err_msg {
                let _ = sqlx::query(
                    "UPDATE mail.accounts SET last_error = $1, status = 'error', updated_at = NOW() WHERE id = $2"
                )
                .bind(msg)
                .bind(account.id)
                .execute(pool)
                .await;
            }
        }
    }

    Ok(())
}

/// Map a raw IMAP folder name to a canonical folder_type string.
///
/// Handles Gmail labels (English, French, German, Spanish, Italian, Portuguese),
/// Outlook/Exchange, and generic IMAP servers. The `[Gmail]/` prefix is stripped
/// before matching, and IMAP UTF-7 modified encoding (`&AOk-` = é) is decoded.
fn imap_name_to_folder_type(name: &str) -> &'static str {
    let lower = name.to_lowercase();

    // Decode common IMAP modified-UTF7 sequences found in French Gmail
    let decoded = lower
        .replace("&aok-", "é")
        .replace("&aek-", "è")
        .replace("&amk-", "é"); // alternate encoding

    // Strip namespace prefixes: "[Gmail]/", "[Google Mail]/", "INBOX.", "[Zoom Mail]/"
    let base = decoded
        .strip_prefix("[gmail]/")
        .or_else(|| decoded.strip_prefix("[google mail]/"))
        .unwrap_or(&decoded);

    // Also try splitting on last '/' or '.' for other namespaces
    let leaf = base.rsplit('/').next().unwrap_or(base);
    let leaf = leaf.rsplit('.').next().unwrap_or(leaf);

    // Match against known folder names in multiple languages
    match leaf {
        // Inbox
        "inbox"
        | "boîte de réception"
        | "posteingang"
        | "bandeja de entrada"
        | "posta in arrivo"
        | "caixa de entrada" => "inbox",

        // Sent
        "sent"
        | "sent items"
        | "sent messages"
        | "sent mail"
        | "messages envoyés"
        | "envoyés"
        | "éléments envoyés"
        | "gesendet"
        | "gesendete elemente"
        | "enviados"
        | "elementi inviati"
        | "itens enviados" => "sent",

        // Drafts
        "drafts" | "draft" | "brouillons" | "brouillon" | "entwürfe" | "borradores" | "bozze"
        | "rascunhos" => "drafts",

        // Trash
        "trash"
        | "deleted items"
        | "deleted messages"
        | "corbeille"
        | "éléments supprimés"
        | "papierkorb"
        | "papelera"
        | "cestino"
        | "lixeira" => "trash",

        // Spam / Junk
        "junk"
        | "spam"
        | "junk e-mail"
        | "junk email"
        | "courrier indésirable"
        | "indésirables"
        | "pourriel"
        | "spamverdacht" => "spam",

        // Starred / Flagged
        "starred" | "flagged" | "suivis" | "messages suivis" | "markiert" | "destacados"
        | "speciali" | "com estrela" => "starred",

        // Important (Gmail specific)
        "important" | "wichtig" | "importantes" | "importanti" => "important",

        // Archive / All Mail
        "archive" | "archived" | "all mail" | "all messages" | "tous les messages" | "archiv"
        | "alle nachrichten" | "todos los correos" | "tutti i messaggi" | "todos os e-mails" => {
            "archive"
        },

        _ => "custom",
    }
}

/// Display name for a folder given its type + raw IMAP name.
fn folder_display_name(folder_type: &str, imap_name: &str) -> String {
    match folder_type {
        "inbox" => "Boîte de réception".to_string(),
        "sent" => "Messages envoyés".to_string(),
        "drafts" => "Brouillons".to_string(),
        "trash" => "Corbeille".to_string(),
        "spam" => "Spam".to_string(),
        "starred" => "Messages suivis".to_string(),
        "important" => "Important".to_string(),
        "archive" => "Tous les messages".to_string(),
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

/// Refresh a Microsoft OAuth2 access token using the stored refresh token.
/// Returns (new_access_token, new_expiry).
///
/// Posts to the Microsoft identity platform token endpoint with
/// `grant_type=refresh_token`. Uses `MICROSOFT_CLIENT_ID` and
/// `MICROSOFT_CLIENT_SECRET` environment variables.
///
/// # Errors
///
/// Returns an error if the HTTP request fails, the response cannot be
/// parsed, or the response does not contain an `access_token`.
async fn refresh_microsoft_token(
    refresh_token: &str,
) -> Result<(String, chrono::DateTime<Utc>), Box<dyn std::error::Error + Send + Sync>> {
    let client_id = std::env::var("MICROSOFT_CLIENT_ID").unwrap_or_default();
    let client_secret = std::env::var("MICROSOFT_CLIENT_SECRET").unwrap_or_default();

    let http = reqwest::Client::new();
    let resp = http
        .post("https://login.microsoftonline.com/common/oauth2/v2.0/token")
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
        .ok_or("Missing access_token in Microsoft refresh response")?
        .to_string();
    let expires_in = resp["expires_in"].as_i64().unwrap_or(3600);
    let new_expiry = Utc::now() + chrono::Duration::seconds(expires_in);

    Ok((new_token, new_expiry))
}

/// Refresh an OAuth2 access token for the given provider.
///
/// Dispatches to the provider-specific refresh function based on the
/// account's `provider` field. Supports `"google"`, `"gmail"`,
/// `"microsoft"`, and `"outlook"`.
///
/// # Errors
///
/// Returns an error if the provider is not recognized or if the
/// underlying refresh call fails.
async fn refresh_oauth_token(
    provider: &str,
    refresh_token: &str,
) -> Result<(String, chrono::DateTime<Utc>), Box<dyn std::error::Error + Send + Sync>> {
    match provider {
        "microsoft" | "outlook" => refresh_microsoft_token(refresh_token).await,
        _ => refresh_google_token(refresh_token).await,
    }
}

/// Perform a full IMAP sync for a single mail account.
///
/// Uses the synchronous `imap` crate inside `tokio::task::spawn_blocking`
/// to avoid the async-imap XOAUTH2 blocking bug on Windows. IMAP
/// operations (connect, auth, folder listing, message fetching) run
/// synchronously, then database writes happen in the async context.
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
                let provider = if account.provider.is_empty() {
                    "google"
                } else {
                    &account.provider
                };
                match refresh_oauth_token(provider, refresh_token).await {
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

    // -------------------------------------------------------------------------
    // Load existing folders from DB to get last_synced_uid for incremental sync
    // -------------------------------------------------------------------------
    let db_folders: Vec<MailFolder> =
        sqlx::query_as("SELECT * FROM mail.folders WHERE account_id = $1")
            .bind(account.id)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

    // Build a map: imap_path -> last_synced_uid
    let folder_uid_map: std::collections::HashMap<String, Option<i64>> = db_folders
        .iter()
        .filter_map(|f| f.imap_path.as_ref().map(|p| (p.clone(), f.last_synced_uid)))
        .collect();

    // -------------------------------------------------------------------------
    // Clone data for spawn_blocking
    // -------------------------------------------------------------------------
    let server = imap_server.to_string();
    let email = account.email_address.clone();
    let pw = account.app_password.clone();
    let oauth = effective_oauth_token.clone();
    let invalid_certs = accept_invalid_certs();
    let batch_size: usize = std::env::var("IMAP_SYNC_BATCH_SIZE")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(20);

    // -------------------------------------------------------------------------
    // Run all IMAP operations synchronously inside spawn_blocking
    // -------------------------------------------------------------------------
    let connect_timeout_secs: u64 = std::env::var("IMAP_CONNECT_TIMEOUT_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(15);

    tracing::info!(
        "Connecting to IMAP {}:{} (timeout {}s)",
        server,
        imap_port,
        connect_timeout_secs
    );

    let imap_result: Result<ImapSyncResult, String> = tokio::task::spawn_blocking(move || {
        // Build sync TLS connector
        let tls = native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(invalid_certs)
            .danger_accept_invalid_hostnames(invalid_certs)
            .build()
            .map_err(|e| format!("TLS builder error: {e}"))?;

        // Connect with a TCP-level timeout using std::net
        let addr = format!("{}:{}", server, imap_port);
        let tcp_stream = std::net::TcpStream::connect_timeout(
            &addr
                .parse::<std::net::SocketAddr>()
                .or_else(|_| {
                    // Resolve hostname manually
                    use std::net::ToSocketAddrs;
                    addr.to_socket_addrs()
                        .map_err(|e| format!("DNS resolution failed for {addr}: {e}"))?
                        .next()
                        .ok_or_else(|| format!("No addresses found for {addr}"))
                })
                .map_err(|e| format!("Address parse error: {e}"))?,
            std::time::Duration::from_secs(connect_timeout_secs),
        )
        .map_err(|e| format!("TCP connect failed to {addr}: {e}"))?;

        // Set read/write timeouts on the TCP stream
        let _ = tcp_stream.set_read_timeout(Some(std::time::Duration::from_secs(30)));
        let _ = tcp_stream.set_write_timeout(Some(std::time::Duration::from_secs(30)));

        // TLS handshake
        let tls_stream = tls
            .connect(&server, tcp_stream)
            .map_err(|e| format!("TLS handshake failed for {server}: {e}"))?;

        // Build IMAP client from TLS stream
        let client = imap::Client::new(tls_stream);

        // Authenticate
        let mut session = if let Some(ref oauth_token) = oauth {
            let auth_string = format!("user={}\x01auth=Bearer {}\x01\x01", email, oauth_token);
            let auth = XOAuth2Auth {
                auth_string: auth_string.into_bytes(),
            };
            match client.authenticate("XOAUTH2", &auth) {
                Ok(s) => {
                    // Log success from inside spawn_blocking (tracing works across threads)
                    tracing::info!("XOAUTH2 login succeeded for {}", email);
                    s
                },
                Err((e, client2)) => {
                    tracing::warn!("XOAUTH2 failed for {}, trying password: {}", email, e);
                    // Try password fallback with the same client (no reconnect needed
                    // since sync imap crate returns the client on auth failure)
                    if let Some(ref pw_str) = pw {
                        client2.login(&email, pw_str).map_err(|(e2, _)| {
                            format!("XOAUTH2 failed ({e}), password also failed for {email}: {e2}")
                        })?
                    } else {
                        return Err(format!(
                            "XOAUTH2 failed and no password fallback for {email}: {e}"
                        ));
                    }
                },
            }
        } else if let Some(ref pw_str) = pw {
            tracing::info!("Attempting password login for {}", email);
            client
                .login(&email, pw_str)
                .map_err(|(e, _)| format!("Password login failed for {email}: {e}"))?
        } else {
            return Err(format!("No credentials for {email}"));
        };

        // List all folders
        let folder_names = session
            .list(Some(""), Some("*"))
            .map_err(|e| format!("LIST folders failed: {e}"))?;
        let mut imap_folders: Vec<String> =
            folder_names.iter().map(|n| n.name().to_string()).collect();

        if imap_folders.is_empty() {
            imap_folders.push("INBOX".to_string());
        }

        tracing::info!("Found {} IMAP folders for {}", imap_folders.len(), email);

        // Sync each folder
        let mut folders_result: Vec<FolderSyncResult> = Vec::new();

        for imap_path in &imap_folders {
            let folder_type = imap_name_to_folder_type(imap_path);
            let display_name = folder_display_name(folder_type, imap_path);

            // Try selecting the folder; some may not be selectable
            if let Err(e) = session.select(imap_path) {
                tracing::debug!("Skipping unselectable folder '{}': {:?}", imap_path, e);
                continue;
            }

            // Determine last_synced_uid from the pre-loaded DB data
            let last_uid: Option<i64> = folder_uid_map.get(imap_path).copied().flatten();

            let mut folder_result = FolderSyncResult {
                imap_path: imap_path.clone(),
                folder_type: folder_type.to_string(),
                display_name,
                messages: Vec::new(),
                initial_uids: Vec::new(),
            };

            let uids_to_fetch: Vec<u32> = if let Some(last) = last_uid {
                // Incremental: fetch UIDs > last_synced_uid
                let search_range = format!("{}:*", last + 1);
                let uid_set = match session.uid_search(search_range) {
                    Ok(s) => s,
                    Err(e) => {
                        tracing::warn!("UID SEARCH failed on '{}': {:?}", imap_path, e);
                        continue;
                    },
                };
                uid_set
                    .into_iter()
                    .filter(|&uid| uid as i64 > last)
                    .collect()
            } else {
                // First sync: fetch the last 50 messages by sequence number
                let messages = match session.fetch("1:50", "(RFC822.HEADER UID FLAGS)") {
                    Ok(m) => m,
                    Err(e) => {
                        tracing::warn!("Failed to fetch from '{}': {:?}", imap_path, e);
                        continue;
                    },
                };
                let header_uids: Vec<u32> = messages
                    .iter()
                    .filter_map(|f| f.uid.filter(|&u| u > 0))
                    .collect();
                // Store these UIDs for DB dedup check later
                folder_result.initial_uids = header_uids.clone();
                header_uids
            };

            // Fetch full messages for new UIDs (limit batch_size per folder per sync)
            for uid in uids_to_fetch.iter().take(batch_size) {
                let fetched = match session.uid_fetch(uid.to_string(), "(BODY.PEEK[] FLAGS)") {
                    Ok(s) => s,
                    Err(e) => {
                        tracing::warn!("Failed to uid_fetch UID {} body: {:?}", uid, e);
                        continue;
                    },
                };

                if let Some(m) = fetched.iter().next() {
                    if let Some(body) = m.body() {
                        if let Ok(parsed) = parse_mail(body) {
                            let subject = get_header(&parsed, "Subject");
                            let from = get_header(&parsed, "From");
                            let to = get_header(&parsed, "To");
                            let cc = get_header(&parsed, "Cc");
                            let message_id = get_header(&parsed, "Message-ID");
                            let in_reply_to = get_header(&parsed, "In-Reply-To");
                            let date_str = get_header(&parsed, "Date");

                            let (sender_name, sender_email) = parse_address(&from);
                            let (body_text, body_html) = extract_body(&parsed);

                            let snippet = body_text
                                .as_ref()
                                .map(|t| t.chars().take(200).collect::<String>());

                            let is_read = m
                                .flags()
                                .iter()
                                .any(|f| matches!(f, imap::types::Flag::Seen));

                            let received_at = date_str
                                .and_then(|d| chrono::DateTime::parse_from_rfc2822(&d).ok())
                                .map(|d| d.with_timezone(&Utc));

                            let attachments = extract_attachments(&parsed);
                            let has_attachments = !attachments.is_empty();

                            // Extract mailing list headers (RFC 2369 / RFC 2919)
                            let list_unsubscribe = get_header(&parsed, "List-Unsubscribe");
                            let list_id = get_header(&parsed, "List-Id");

                            folder_result.messages.push(FetchedMessage {
                                uid: *uid,
                                subject,
                                from,
                                to,
                                cc,
                                message_id,
                                in_reply_to,
                                sender_name,
                                sender_email,
                                body_text,
                                body_html,
                                snippet,
                                is_read,
                                received_at,
                                has_attachments,
                                attachments,
                                list_unsubscribe,
                                list_id,
                            });
                        }
                    }
                }
            }

            folders_result.push(folder_result);
        }

        // Logout
        let _ = session.logout();

        Ok(ImapSyncResult {
            folders: folders_result,
        })
    })
    .await
    .map_err(|e| -> Box<dyn std::error::Error + Send + Sync> {
        format!("IMAP spawn_blocking panicked: {e}").into()
    })?;

    let sync_result =
        imap_result.map_err(|e| -> Box<dyn std::error::Error + Send + Sync> { e.into() })?;

    // -------------------------------------------------------------------------
    // Process fetched data in async context (database writes)
    // -------------------------------------------------------------------------
    let mut total_new_messages = 0usize;

    for folder_data in &sync_result.folders {
        // Get or create the folder record in DB
        let folder = match get_or_create_folder_by_path(
            pool,
            account.id,
            &folder_data.folder_type,
            &folder_data.display_name,
            &folder_data.imap_path,
        )
        .await
        {
            Ok(f) => f,
            Err(e) => {
                tracing::warn!(
                    "Failed to get/create folder '{}': {:?}",
                    folder_data.imap_path,
                    e
                );
                continue;
            },
        };

        // For initial sync, filter out UIDs already in DB
        let initial_uid_filter: std::collections::HashSet<u32> =
            if !folder_data.initial_uids.is_empty() {
                let mut new_uids = std::collections::HashSet::new();
                for uid in &folder_data.initial_uids {
                    let exists: (i64,) = match sqlx::query_as(
                        "SELECT COUNT(*) FROM mail.emails WHERE account_id = $1 AND imap_uid = $2",
                    )
                    .bind(account.id)
                    .bind(*uid as i64)
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
                        new_uids.insert(*uid);
                    }
                }
                new_uids
            } else {
                // For incremental sync, all UIDs are new
                folder_data.messages.iter().map(|m| m.uid).collect()
            };

        let mut max_uid_this_sync: Option<i64> = None;

        for msg in &folder_data.messages {
            // Skip UIDs that are already in DB (for initial sync)
            if !initial_uid_filter.contains(&msg.uid) {
                continue;
            }

            // Insert email
            let inserted: Option<(Uuid,)> = sqlx::query_as(
                r#"
                INSERT INTO mail.emails (
                    account_id, folder_id, imap_uid, message_id, in_reply_to,
                    sender, sender_name, recipient, cc, subject,
                    body_text, body_html, snippet, is_read, received_at,
                    has_attachments, list_unsubscribe, list_id
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18
                )
                ON CONFLICT DO NOTHING
                RETURNING id
                "#,
            )
            .bind(account.id)
            .bind(folder.id)
            .bind(msg.uid as i64)
            .bind(&msg.message_id)
            .bind(&msg.in_reply_to)
            .bind(
                msg.sender_email
                    .clone()
                    .unwrap_or(msg.from.clone().unwrap_or_default()),
            )
            .bind(&msg.sender_name)
            .bind(&msg.to)
            .bind(&msg.cc)
            .bind(&msg.subject)
            .bind(&msg.body_text)
            .bind(&msg.body_html)
            .bind(&msg.snippet)
            .bind(msg.is_read)
            .bind(msg.received_at)
            .bind(msg.has_attachments)
            .bind(&msg.list_unsubscribe)
            .bind(&msg.list_id)
            .fetch_optional(pool)
            .await
            .unwrap_or(None);

            if let Some((email_id,)) = inserted {
                total_new_messages += 1;

                // Auto-label on incoming emails using keyword categorization
                {
                    let category = categorize_email(
                        msg.sender_email
                            .as_deref()
                            .unwrap_or(msg.from.as_deref().unwrap_or("")),
                        msg.subject.as_deref().unwrap_or(""),
                        msg.body_text.as_deref().unwrap_or(""),
                    );
                    if let Err(e) = ensure_label_and_apply(pool, email_id, &[], &category).await {
                        tracing::warn!("Auto-label failed for email {}: {:?}", email_id, e);
                    }
                }

                // Track highest UID for incremental sync
                let uid_i64 = msg.uid as i64;
                max_uid_this_sync =
                    Some(max_uid_this_sync.map_or(uid_i64, |prev: i64| prev.max(uid_i64)));

                // Insert attachments
                for att in &msg.attachments {
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
                            "subject": msg.subject,
                            "folder": folder_data.imap_path,
                        }),
                    })
                    .await;
            }
        }

        // Persist last_synced_uid so the next cycle only fetches new messages
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
                folder_data.imap_path,
                e
            );
        }
    }

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
        sync_result.folders.len()
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
            // Strip angle brackets: <id@domain> -> id@domain
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
            // RFC 5987 encoded -- best effort: grab value after ''
            let val = rest.splitn(3, '\'').nth(2).unwrap_or(rest);
            return Some(val.trim_matches('"').to_string());
        }
        if let Some(rest) = param.strip_prefix("filename=") {
            return Some(rest.trim_matches('"').to_string());
        }
    }
    None
}
