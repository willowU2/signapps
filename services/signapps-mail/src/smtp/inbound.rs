//! SMTP inbound listener (port 25).
//!
//! Accepts incoming email from remote MTAs. Uses the [`signapps_smtp::SmtpSession`]
//! state machine to process SMTP commands and the [`delivery`](super::delivery)
//! module to persist messages into PostgreSQL.
//!
//! ## Protocol flow
//!
//! 1. Accept TCP connection, send 220 greeting.
//! 2. Feed each line into [`SmtpSession::feed_line`] / [`SmtpSession::feed_data_line`].
//! 3. Execute the returned [`SmtpAction`]s (write replies, deliver messages, etc.).
//! 4. On `DATA` completion: validate recipient domains, parse MIME, deliver locally.
//!
//! ## Recipient validation
//!
//! During `RCPT TO`, the session state machine accepts all recipients. Domain
//! validation happens at delivery time — unknown domains get a 550 error only
//! if *all* recipients are unknown. This avoids leaking information about which
//! addresses exist during the SMTP dialog (deferred validation).

use super::delivery::{self, RecipientResult};
use crate::state::MailServerState;
use signapps_smtp::{SmtpAction, SmtpConfig, SmtpSession, SmtpState};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

/// Maximum number of recipients per message (RFC 5321 recommends at least 100).
const MAX_RECIPIENTS: usize = 100;

/// Maximum SMTP line length in bytes (RFC 5321: 512 for commands, 998 for data).
const MAX_LINE_LENGTH: usize = 4096;

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
/// None — bind failures are logged and cause the function to return.
#[tracing::instrument(skip(state), fields(port))]
pub async fn start(state: MailServerState, port: u16) {
    let addr = format!("0.0.0.0:{}", port);
    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => {
            tracing::info!("SMTP inbound listening on port {}", port);
            l
        },
        Err(e) => {
            tracing::error!("Failed to bind SMTP inbound on {}: {}", addr, e);
            return;
        },
    };

    loop {
        let (stream, peer_addr) = match listener.accept().await {
            Ok(conn) => conn,
            Err(e) => {
                tracing::warn!("SMTP inbound accept error: {}", e);
                continue;
            },
        };

        let state = state.clone();
        tokio::spawn(async move {
            tracing::debug!(peer = %peer_addr, "SMTP inbound connection");
            if let Err(e) = handle_connection(stream, peer_addr, state).await {
                tracing::debug!(peer = %peer_addr, "SMTP inbound connection ended: {}", e);
            }
        });
    }
}

/// Handle a single SMTP inbound connection using the signapps_smtp state machine.
///
/// Reads lines from the client, feeds them into [`SmtpSession`], and writes
/// back the resulting replies. When a complete message is received, delegates
/// to [`delivery::deliver_local`] for persistence.
///
/// # Errors
///
/// Returns an error if an unrecoverable I/O error occurs.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(stream, state), fields(peer = %peer_addr))]
async fn handle_connection(
    stream: tokio::net::TcpStream,
    peer_addr: std::net::SocketAddr,
    state: MailServerState,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);

    // Build SMTP session with server config
    let hostname = std::env::var("MAIL_HOSTNAME").unwrap_or_else(|_| "signapps.local".into());
    let config = SmtpConfig {
        hostname,
        max_message_size: 50 * 1024 * 1024, // 50 MiB
        require_auth: false,                // Inbound: no auth required
        require_tls: false,                 // TLS not implemented yet
    };
    let mut session = SmtpSession::new(config);

    // Send initial greeting
    let greeting = session.greeting();
    write_action(&mut writer, &greeting).await?;

    // Track whether we are in DATA mode
    let mut in_data_mode = false;

    let mut line_buf = Vec::with_capacity(1024);

    loop {
        line_buf.clear();

        // Read a line (up to MAX_LINE_LENGTH)
        match read_line_limited(&mut reader, &mut line_buf, MAX_LINE_LENGTH).await {
            Ok(0) => {
                tracing::debug!("Client disconnected");
                break;
            },
            Ok(_) => {},
            Err(e) if e.kind() == std::io::ErrorKind::Other => {
                // Line too long
                tracing::warn!("Line too long from client, sending 500");
                writer.write_all(b"500 Line too long\r\n").await?;
                continue;
            },
            Err(e) => {
                tracing::debug!("Read error: {}", e);
                break;
            },
        }

        if in_data_mode {
            // Feed data line to session
            match session.feed_data_line(&line_buf) {
                None => {
                    // More data expected, continue reading
                    continue;
                },
                Some(action) => {
                    in_data_mode = false;
                    match &action {
                        SmtpAction::Deliver(envelope) => {
                            // Deliver the message locally
                            let outcome = delivery::deliver_local(&state.pool, envelope).await;

                            // Determine overall result
                            let all_ok = outcome
                                .results
                                .iter()
                                .all(|r| matches!(r, RecipientResult::Delivered { .. }));
                            let all_unknown = outcome.results.iter().all(|r| {
                                matches!(
                                    r,
                                    RecipientResult::UnknownDomain { .. }
                                        | RecipientResult::UnknownAccount { .. }
                                )
                            });
                            let any_temp_error = outcome
                                .results
                                .iter()
                                .any(|r| matches!(r, RecipientResult::TempError { .. }));

                            if all_ok {
                                writer.write_all(b"250 OK: message delivered\r\n").await?;
                            } else if all_unknown {
                                writer
                                    .write_all(b"550 All recipients rejected: no such user(s)\r\n")
                                    .await?;
                            } else if any_temp_error {
                                // Some delivered, some failed — report partial success
                                writer
                                    .write_all(
                                        b"250 OK: message accepted (some recipients may have failed)\r\n",
                                    )
                                    .await?;
                            } else {
                                // Mixed: some delivered, some unknown
                                writer
                                    .write_all(
                                        b"250 OK: message delivered to available recipients\r\n",
                                    )
                                    .await?;
                            }

                            // Log per-recipient results
                            for result in &outcome.results {
                                match result {
                                    RecipientResult::Delivered {
                                        address,
                                        account_id,
                                    } => {
                                        tracing::info!(
                                            recipient = %address,
                                            account_id = %account_id,
                                            "Delivered"
                                        );
                                    },
                                    RecipientResult::UnknownDomain { address, domain } => {
                                        tracing::info!(
                                            recipient = %address,
                                            domain = %domain,
                                            "Rejected: unknown domain"
                                        );
                                    },
                                    RecipientResult::UnknownAccount { address } => {
                                        tracing::info!(
                                            recipient = %address,
                                            "Rejected: unknown account"
                                        );
                                    },
                                    RecipientResult::TempError { address, reason } => {
                                        tracing::error!(
                                            recipient = %address,
                                            reason = %reason,
                                            "Temporary delivery failure"
                                        );
                                    },
                                }
                            }
                        },
                        _ => {
                            // Size exceeded or other error reply
                            write_action(&mut writer, &action).await?;
                        },
                    }
                },
            }
        } else {
            // Check recipient count before forwarding to session
            if let Ok(cmd_str) = std::str::from_utf8(&line_buf) {
                let upper = cmd_str.trim().to_uppercase();
                if upper.starts_with("RCPT TO:") {
                    if let SmtpState::RcptTo { recipients, .. } = session.state() {
                        if recipients.len() >= MAX_RECIPIENTS {
                            writer.write_all(b"452 Too many recipients\r\n").await?;
                            continue;
                        }
                    }
                }
            }

            // Feed command line to session
            let actions = session.feed_line(&line_buf);

            for action in &actions {
                match action {
                    SmtpAction::AcceptData => {
                        in_data_mode = true;
                    },
                    SmtpAction::StartTls => {
                        // STARTTLS not implemented for inbound yet
                        tracing::warn!(
                            peer = %peer_addr,
                            "STARTTLS requested but not implemented on inbound"
                        );
                        writer.write_all(b"454 TLS not available\r\n").await?;
                        continue;
                    },
                    SmtpAction::Close => {
                        write_action(&mut writer, action).await.ok();
                        return Ok(());
                    },
                    _ => {
                        write_action(&mut writer, action).await?;
                    },
                }
            }
        }
    }

    Ok(())
}

/// Write an SMTP action as a wire-protocol response to the client.
///
/// # Errors
///
/// Returns I/O errors from the underlying writer.
///
/// # Panics
///
/// None.
async fn write_action(
    writer: &mut (impl AsyncWriteExt + Unpin),
    action: &SmtpAction,
) -> Result<(), std::io::Error> {
    match action {
        SmtpAction::Reply(code, text) => {
            let line = format!("{} {}\r\n", code, text);
            writer.write_all(line.as_bytes()).await?;
        },
        SmtpAction::SendCapabilities(caps) => {
            // Multiline EHLO response: 250-line for all but last, 250 for last
            for (i, cap) in caps.iter().enumerate() {
                if i < caps.len() - 1 {
                    let line = format!("250-{}\r\n", cap);
                    writer.write_all(line.as_bytes()).await?;
                } else {
                    let line = format!("250 {}\r\n", cap);
                    writer.write_all(line.as_bytes()).await?;
                }
            }
        },
        SmtpAction::AuthChallenge(challenge) => {
            let line = format!("334 {}\r\n", challenge);
            writer.write_all(line.as_bytes()).await?;
        },
        SmtpAction::Close => {
            // The Reply with 221 should already have been written
        },
        SmtpAction::AcceptData | SmtpAction::Deliver(_) => {
            // Handled by the caller
        },
        SmtpAction::StartTls | SmtpAction::Authenticate { .. } => {
            // Handled by the caller
        },
    }
    Ok(())
}

/// Read a line from the reader, limited to `max_len` bytes.
///
/// Returns the number of bytes read (0 means EOF).
///
/// # Errors
///
/// Returns `ErrorKind::Other` if the line exceeds `max_len`.
///
/// # Panics
///
/// None.
async fn read_line_limited(
    reader: &mut (impl AsyncBufReadExt + Unpin),
    buf: &mut Vec<u8>,
    max_len: usize,
) -> std::io::Result<usize> {
    let mut total = 0;
    loop {
        let available = reader.fill_buf().await?;
        if available.is_empty() {
            return Ok(total); // EOF
        }

        if let Some(newline_pos) = available.iter().position(|&b| b == b'\n') {
            let to_consume = newline_pos + 1;
            if total + to_consume > max_len {
                reader.consume(to_consume);
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    "line too long",
                ));
            }
            buf.extend_from_slice(&available[..to_consume]);
            reader.consume(to_consume);
            total += to_consume;
            return Ok(total);
        }

        // No newline yet — consume all available bytes
        let len = available.len();
        if total + len > max_len {
            reader.consume(len);
            return Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                "line too long",
            ));
        }
        buf.extend_from_slice(available);
        reader.consume(len);
        total += len;
    }
}
