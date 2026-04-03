//! IMAP server stub (port 993).
//!
//! Accepts IMAP connections and responds with a greeting and basic capability
//! responses. This stub will be replaced by a full IMAP session handler in a
//! later sprint.

use crate::state::MailServerState;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

/// Start the IMAP server listener on the given port.
///
/// This function runs forever, accepting TCP connections and spawning a task
/// for each one. It should be called via `tokio::spawn`.
///
/// # Errors
///
/// Logs errors via tracing but does not propagate them.
///
/// # Panics
///
/// Panics if the TCP listener cannot bind to the specified port.
#[tracing::instrument(skip(state), fields(port))]
pub async fn start(state: MailServerState, port: u16) {
    let addr = format!("0.0.0.0:{}", port);
    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => {
            tracing::info!("IMAP server listening on port {}", port);
            l
        }
        Err(e) => {
            tracing::error!("Failed to bind IMAP server on {}: {}", addr, e);
            return;
        }
    };

    loop {
        let (stream, peer_addr) = match listener.accept().await {
            Ok(conn) => conn,
            Err(e) => {
                tracing::warn!("IMAP accept error: {}", e);
                continue;
            }
        };

        let _state = state.clone();
        tokio::spawn(async move {
            tracing::debug!(peer = %peer_addr, "IMAP connection");
            if let Err(e) = handle_connection(stream, peer_addr).await {
                tracing::debug!(peer = %peer_addr, "IMAP connection ended: {}", e);
            }
        });
    }
}

/// Handle a single IMAP connection.
///
/// Stub implementation: sends OK greeting, responds to CAPABILITY and LOGOUT,
/// returns BAD for anything else.
async fn handle_connection(
    stream: tokio::net::TcpStream,
    peer_addr: std::net::SocketAddr,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);

    // Send IMAP greeting
    writer
        .write_all(b"* OK signapps.local IMAP4rev1 ready\r\n")
        .await?;

    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) => {
                tracing::debug!(peer = %peer_addr, "IMAP: client disconnected");
                break;
            }
            Err(e) => {
                tracing::debug!(peer = %peer_addr, "IMAP read error: {}", e);
                break;
            }
            Ok(_) => {
                let trimmed = line.trim();
                // IMAP commands are prefixed with a tag: "a001 CAPABILITY"
                let mut parts = trimmed.splitn(2, ' ');
                let tag = parts.next().unwrap_or("*");
                let command = parts
                    .next()
                    .unwrap_or("")
                    .to_uppercase();

                if command.starts_with("CAPABILITY") {
                    writer
                        .write_all(
                            format!(
                                "* CAPABILITY IMAP4rev1 AUTH=PLAIN AUTH=XOAUTH2 IDLE\r\n\
                                 {} OK CAPABILITY completed\r\n",
                                tag
                            )
                            .as_bytes(),
                        )
                        .await?;
                } else if command.starts_with("LOGOUT") {
                    writer
                        .write_all(
                            format!(
                                "* BYE signapps.local closing connection\r\n\
                                 {} OK LOGOUT completed\r\n",
                                tag
                            )
                            .as_bytes(),
                        )
                        .await?;
                    break;
                } else if command.starts_with("NOOP") {
                    writer
                        .write_all(format!("{} OK NOOP completed\r\n", tag).as_bytes())
                        .await?;
                } else {
                    writer
                        .write_all(
                            format!("{} BAD Command not yet implemented\r\n", tag).as_bytes(),
                        )
                        .await?;
                }
            }
        }
    }

    Ok(())
}
