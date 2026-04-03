//! SMTP inbound listener (port 25).
//!
//! Accepts incoming email from remote MTAs. This is a stub implementation
//! that responds to basic SMTP commands (EHLO, QUIT) and will be extended
//! with full [`signapps_smtp`] session handling in a later sprint.

use crate::state::MailServerState;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

/// Start the SMTP inbound listener on the given port.
///
/// This function runs forever, accepting TCP connections and spawning a task
/// for each one. It should be called via `tokio::spawn`.
///
/// # Errors
///
/// Logs errors via tracing but does not propagate them — individual connection
/// failures do not bring down the listener.
///
/// # Panics
///
/// Panics if the TCP listener cannot bind to the specified port.
#[tracing::instrument(skip(state), fields(port))]
pub async fn start(state: MailServerState, port: u16) {
    let addr = format!("0.0.0.0:{}", port);
    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => {
            tracing::info!("SMTP inbound listening on port {}", port);
            l
        }
        Err(e) => {
            tracing::error!("Failed to bind SMTP inbound on {}: {}", addr, e);
            return;
        }
    };

    loop {
        let (stream, peer_addr) = match listener.accept().await {
            Ok(conn) => conn,
            Err(e) => {
                tracing::warn!("SMTP inbound accept error: {}", e);
                continue;
            }
        };

        let _state = state.clone();
        tokio::spawn(async move {
            tracing::debug!(peer = %peer_addr, "SMTP inbound connection");
            if let Err(e) = handle_connection(stream, peer_addr).await {
                tracing::debug!(peer = %peer_addr, "SMTP inbound connection ended: {}", e);
            }
        });
    }
}

/// Handle a single SMTP inbound connection.
///
/// Stub implementation: sends greeting, responds to EHLO/HELO with capabilities,
/// and closes on QUIT. All other commands get a generic 250 OK.
async fn handle_connection(
    stream: tokio::net::TcpStream,
    peer_addr: std::net::SocketAddr,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);

    // Send greeting
    writer
        .write_all(b"220 signapps.local ESMTP ready\r\n")
        .await?;

    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) => {
                tracing::debug!(peer = %peer_addr, "SMTP inbound: client disconnected");
                break;
            }
            Err(e) => {
                tracing::debug!(peer = %peer_addr, "SMTP inbound read error: {}", e);
                break;
            }
            Ok(_) => {
                let trimmed = line.trim().to_uppercase();
                if trimmed.starts_with("QUIT") {
                    writer.write_all(b"221 Bye\r\n").await?;
                    break;
                } else if trimmed.starts_with("EHLO") || trimmed.starts_with("HELO") {
                    writer
                        .write_all(
                            b"250-signapps.local\r\n\
                              250-SIZE 52428800\r\n\
                              250-8BITMIME\r\n\
                              250-PIPELINING\r\n\
                              250-ENHANCEDSTATUSCODES\r\n\
                              250 OK\r\n",
                        )
                        .await?;
                } else if trimmed.starts_with("DATA") {
                    writer
                        .write_all(b"354 Start mail input; end with <CRLF>.<CRLF>\r\n")
                        .await?;
                    // Read until lone dot
                    loop {
                        line.clear();
                        match reader.read_line(&mut line).await {
                            Ok(0) | Err(_) => return Ok(()),
                            Ok(_) => {
                                if line.trim() == "." {
                                    writer.write_all(b"250 OK\r\n").await?;
                                    break;
                                }
                            }
                        }
                    }
                } else {
                    writer.write_all(b"250 OK\r\n").await?;
                }
            }
        }
    }

    Ok(())
}
