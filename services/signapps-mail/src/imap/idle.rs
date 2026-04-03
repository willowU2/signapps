//! IMAP IDLE implementation via PostgreSQL LISTEN/NOTIFY.
//!
//! When a client enters IDLE mode, the server starts a PostgreSQL LISTEN
//! on the `mailbox_changes` channel. When a notification is received
//! matching the current account and mailbox, the server sends EXISTS/RECENT
//! updates. The IDLE loop ends when the client sends "DONE" or after
//! 25 minutes (per RFC 2177 recommendation).
//!
//! # Protocol Flow
//!
//! ```text
//! C: a001 IDLE
//! S: + idling
//! ... (server sends unsent responses when mailbox changes)
//! S: * 23 EXISTS
//! C: DONE
//! S: a001 OK IDLE completed
//! ```

use super::session::ImapConnectionState;
use signapps_imap::response::{exists_response, recent_response, ImapResponse};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::tcp::{OwnedReadHalf, OwnedWriteHalf};
use tokio::time::{timeout, Duration};

/// Maximum IDLE duration: 25 minutes (RFC 2177 recommends < 30 min).
const IDLE_TIMEOUT: Duration = Duration::from_secs(25 * 60);

/// Handle the IDLE command: listen for mailbox changes via PG LISTEN/NOTIFY.
///
/// This function takes ownership of the reader/writer for the duration of
/// the IDLE session. It returns when the client sends "DONE", the timeout
/// expires, or an error occurs.
///
/// # Errors
///
/// Returns an error if the database listener fails or the connection drops.
///
/// # Panics
///
/// This function does not panic.
#[tracing::instrument(skip(conn, reader, writer))]
pub async fn handle_idle(
    conn: &ImapConnectionState,
    tag: &str,
    reader: &mut BufReader<OwnedReadHalf>,
    writer: &mut OwnedWriteHalf,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mailbox = match conn.selected_mailbox() {
        Some(m) => m,
        None => {
            let resp = ImapResponse::Tagged(tag.to_string(), "BAD No mailbox selected".to_string());
            writer.write_all(&resp.to_bytes()).await?;
            return Ok(());
        },
    };

    let account = match conn.account() {
        Some(a) => a,
        None => {
            let resp = ImapResponse::Tagged(tag.to_string(), "BAD Not authenticated".to_string());
            writer.write_all(&resp.to_bytes()).await?;
            return Ok(());
        },
    };

    // Send continuation response
    let cont = ImapResponse::Continue("idling".to_string());
    writer.write_all(&cont.to_bytes()).await?;

    let account_id = account.id;
    let mailbox_id = mailbox.id;
    let pool = conn.pool().clone();

    // Start PostgreSQL LISTEN
    let mut pg_listener = sqlx::postgres::PgListener::connect_with(&pool).await?;
    pg_listener.listen("mailbox_changes").await?;

    tracing::debug!(
        account_id = %account_id,
        mailbox_id = %mailbox_id,
        "IMAP IDLE: listening for changes"
    );

    let tag_owned = tag.to_string();

    // IDLE loop: wait for either client "DONE", PG notification, or timeout
    let result = timeout(IDLE_TIMEOUT, async {
        let mut line = String::new();
        loop {
            tokio::select! {
                // Client sends "DONE"
                read_result = reader.read_line(&mut line) => {
                    match read_result {
                        Ok(0) => {
                            tracing::debug!("IMAP IDLE: client disconnected");
                            return Ok(true); // connection closed
                        }
                        Ok(_) => {
                            if line.trim().eq_ignore_ascii_case("DONE") {
                                tracing::debug!("IMAP IDLE: client sent DONE");
                                return Ok(false); // normal exit
                            }
                            line.clear();
                        }
                        Err(e) => {
                            tracing::debug!("IMAP IDLE: read error: {}", e);
                            return Err(Box::new(e) as Box<dyn std::error::Error + Send + Sync>);
                        }
                    }
                }

                // PostgreSQL notification
                notification = pg_listener.recv() => {
                    match notification {
                        Ok(notif) => {
                            let payload = notif.payload();
                            // Expected payload format: "account_id:mailbox_id"
                            // Only send updates if they match our session
                            let should_notify = if let Some((notif_account, notif_mailbox)) = payload.split_once(':') {
                                notif_account == account_id.to_string()
                                    && notif_mailbox == mailbox_id.to_string()
                            } else {
                                // If format doesn't match, notify anyway for safety
                                true
                            };

                            if should_notify {
                                // Query current counts
                                let total: i64 = sqlx::query_scalar(
                                    "SELECT COUNT(*) FROM mailserver.message_mailboxes WHERE mailbox_id = $1"
                                )
                                .bind(mailbox_id)
                                .fetch_one(&pool)
                                .await
                                .unwrap_or(0);

                                let recent: i64 = sqlx::query_scalar(
                                    "SELECT COUNT(*) FROM mailserver.message_mailboxes \
                                     WHERE mailbox_id = $1 AND (flags & 32) != 0"
                                )
                                .bind(mailbox_id)
                                .fetch_one(&pool)
                                .await
                                .unwrap_or(0);

                                let exists = exists_response(total as u32);
                                writer.write_all(&exists.to_bytes()).await?;

                                if recent > 0 {
                                    let recent_resp = recent_response(recent as u32);
                                    writer.write_all(&recent_resp.to_bytes()).await?;
                                }

                                writer.flush().await?;
                                tracing::debug!(
                                    total = total,
                                    recent = recent,
                                    "IMAP IDLE: sent mailbox update"
                                );
                            }
                        }
                        Err(e) => {
                            tracing::warn!("IMAP IDLE: PG listener error: {}", e);
                            // Continue — transient errors are OK
                        }
                    }
                }
            }
        }
    })
    .await;

    // Send IDLE completion response
    match result {
        Ok(Ok(disconnected)) => {
            if !disconnected {
                let ok = ImapResponse::Tagged(tag_owned, "OK IDLE completed".to_string());
                writer.write_all(&ok.to_bytes()).await?;
            }
        },
        Ok(Err(e)) => {
            tracing::debug!("IMAP IDLE: ended with error: {}", e);
            let no = ImapResponse::Tagged(tag_owned, "NO IDLE failed".to_string());
            let _ = writer.write_all(&no.to_bytes()).await;
        },
        Err(_) => {
            // Timeout
            tracing::debug!("IMAP IDLE: timed out after 25 minutes");
            let bye = ImapResponse::Untagged("BYE IDLE timeout".to_string());
            let _ = writer.write_all(&bye.to_bytes()).await;
        },
    }

    Ok(())
}
