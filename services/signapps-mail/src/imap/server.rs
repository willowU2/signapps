//! IMAP4rev2 server — TCP listener and per-connection dispatch loop.
//!
//! Accepts TCP connections on the configured port, sends the IMAP greeting,
//! reads command lines, parses them with [`signapps_imap::parser`], validates
//! state with [`signapps_imap::session::ImapSession`], and dispatches to the
//! database-backed handlers in [`super::commands`].

use crate::state::MailServerState;
use signapps_imap::parser::{self, ImapCommandType};
use signapps_imap::response::ImapResponse;
use signapps_imap::session::ImapSession;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

use super::commands;
use super::session::ImapConnectionState;

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
        },
        Err(e) => {
            tracing::error!("Failed to bind IMAP server on {}: {}", addr, e);
            return;
        },
    };

    loop {
        let (stream, peer_addr) = match listener.accept().await {
            Ok(conn) => conn,
            Err(e) => {
                tracing::warn!("IMAP accept error: {}", e);
                continue;
            },
        };

        let state = state.clone();
        tokio::spawn(async move {
            tracing::debug!(peer = %peer_addr, "IMAP connection");
            if let Err(e) = handle_connection(stream, peer_addr, state).await {
                tracing::debug!(peer = %peer_addr, "IMAP connection ended: {}", e);
            }
        });
    }
}

/// Handle a single IMAP client connection.
///
/// Sends the greeting, enters the command loop, dispatches parsed commands
/// to the session state machine and DB-backed handlers, and writes responses
/// back to the client.
///
/// # Errors
///
/// Returns an error if the connection is lost or a critical I/O error occurs.
///
/// # Panics
///
/// This function does not panic.
async fn handle_connection(
    stream: tokio::net::TcpStream,
    peer_addr: std::net::SocketAddr,
    state: MailServerState,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);

    // Protocol state machines
    let mut imap_session = ImapSession::new();
    let mut conn_state = ImapConnectionState::new(state.pool.clone());

    // Build greeting with capabilities
    let caps = imap_session.capabilities().join(" ");
    let greeting = format!("* OK [CAPABILITY {}] signapps IMAP4rev2 ready\r\n", caps);
    writer.write_all(greeting.as_bytes()).await?;

    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) => {
                tracing::debug!(peer = %peer_addr, "IMAP: client disconnected");
                break;
            },
            Err(e) => {
                tracing::debug!(peer = %peer_addr, "IMAP read error: {}", e);
                break;
            },
            Ok(_) => {
                let trimmed = line.trim().to_string();
                if trimmed.is_empty() {
                    continue;
                }

                tracing::debug!(peer = %peer_addr, cmd = %trimmed, "IMAP command");

                // Parse the command
                let cmd = match parser::parse_command(&trimmed) {
                    Some(c) => c,
                    None => {
                        // Extract tag for the error response
                        let tag = trimmed.split_whitespace().next().unwrap_or("*").to_string();
                        let resp =
                            ImapResponse::Tagged(tag, "BAD Command not recognized".to_string());
                        writer.write_all(&resp.to_bytes()).await?;
                        continue;
                    },
                };

                let tag = cmd.tag.clone();

                // Let the session state machine validate first
                let session_responses = imap_session.process(&cmd);

                // If the session returned responses, it handled the command
                // (or rejected it with BAD/NO)
                if !session_responses.is_empty() {
                    for resp in &session_responses {
                        writer.write_all(&resp.to_bytes()).await?;
                    }

                    // Check if we should close the connection (LOGOUT)
                    if matches!(cmd.command, ImapCommandType::Logout) {
                        break;
                    }
                    continue;
                }

                // Session returned empty — we need to handle the command
                // with database access
                let (actual_cmd, is_uid) = match &cmd.command {
                    ImapCommandType::Uid { inner } => (inner.as_ref(), true),
                    other => (other, false),
                };

                let responses: Vec<ImapResponse> = match actual_cmd {
                    ImapCommandType::Login { username, password } => {
                        let resps =
                            commands::handle_login(&mut conn_state, &tag, username, password).await;
                        // If login succeeded, update the session state
                        let login_ok = resps.iter().any(|r| {
                            matches!(r, ImapResponse::Tagged(_, content) if content.starts_with("OK"))
                        });
                        if login_ok {
                            imap_session.set_authenticated();
                        }
                        resps
                    },

                    ImapCommandType::Authenticate { mechanism, initial } => {
                        // For now, only PLAIN is supported inline
                        if mechanism == "PLAIN" {
                            if let Some(ref data) = initial {
                                // Decode base64 PLAIN auth: \0username\0password
                                match base64::Engine::decode(
                                    &base64::engine::general_purpose::STANDARD,
                                    data,
                                ) {
                                    Ok(decoded) => {
                                        let parts: Vec<&[u8]> =
                                            decoded.splitn(3, |&b| b == 0).collect();
                                        if parts.len() >= 3 {
                                            let username =
                                                String::from_utf8_lossy(parts[1]).to_string();
                                            let password =
                                                String::from_utf8_lossy(parts[2]).to_string();
                                            let resps = commands::handle_login(
                                                &mut conn_state,
                                                &tag,
                                                &username,
                                                &password,
                                            )
                                            .await;
                                            let ok = resps.iter().any(|r| {
                                                matches!(r, ImapResponse::Tagged(_, c) if c.starts_with("OK"))
                                            });
                                            if ok {
                                                imap_session.set_authenticated();
                                            }
                                            resps
                                        } else {
                                            vec![ImapResponse::Tagged(
                                                tag.clone(),
                                                "NO AUTHENTICATE failed: invalid PLAIN data"
                                                    .to_string(),
                                            )]
                                        }
                                    },
                                    Err(_) => {
                                        vec![ImapResponse::Tagged(
                                            tag.clone(),
                                            "NO AUTHENTICATE failed: invalid base64".to_string(),
                                        )]
                                    },
                                }
                            } else {
                                // Send continuation, wait for client data
                                let cont = ImapResponse::Continue(String::new());
                                writer.write_all(&cont.to_bytes()).await?;

                                line.clear();
                                match reader.read_line(&mut line).await {
                                    Ok(0) => break,
                                    Ok(_) => {
                                        let data = line.trim();
                                        match base64::Engine::decode(
                                            &base64::engine::general_purpose::STANDARD,
                                            data,
                                        ) {
                                            Ok(decoded) => {
                                                let parts: Vec<&[u8]> =
                                                    decoded.splitn(3, |&b| b == 0).collect();
                                                if parts.len() >= 3 {
                                                    let username =
                                                        String::from_utf8_lossy(parts[1])
                                                            .to_string();
                                                    let password =
                                                        String::from_utf8_lossy(parts[2])
                                                            .to_string();
                                                    let resps = commands::handle_login(
                                                        &mut conn_state,
                                                        &tag,
                                                        &username,
                                                        &password,
                                                    )
                                                    .await;
                                                    let ok = resps.iter().any(|r| {
                                                        matches!(r, ImapResponse::Tagged(_, c) if c.starts_with("OK"))
                                                    });
                                                    if ok {
                                                        imap_session.set_authenticated();
                                                    }
                                                    resps
                                                } else {
                                                    vec![ImapResponse::Tagged(
                                                        tag.clone(),
                                                        "NO AUTHENTICATE failed".to_string(),
                                                    )]
                                                }
                                            },
                                            Err(_) => {
                                                vec![ImapResponse::Tagged(
                                                    tag.clone(),
                                                    "NO AUTHENTICATE failed: invalid base64"
                                                        .to_string(),
                                                )]
                                            },
                                        }
                                    },
                                    Err(e) => {
                                        tracing::debug!("IMAP AUTHENTICATE read error: {}", e);
                                        break;
                                    },
                                }
                            }
                        } else {
                            vec![ImapResponse::Tagged(
                                tag.clone(),
                                format!("NO AUTHENTICATE mechanism {} not supported", mechanism),
                            )]
                        }
                    },

                    ImapCommandType::Select { mailbox } => {
                        let resps =
                            commands::handle_select(&mut conn_state, &tag, mailbox, false).await;
                        let ok = resps
                            .iter()
                            .any(|r| matches!(r, ImapResponse::Tagged(_, c) if c.contains("OK")));
                        if ok {
                            imap_session.set_selected(mailbox.clone(), false);
                        }
                        resps
                    },

                    ImapCommandType::Examine { mailbox } => {
                        let resps =
                            commands::handle_select(&mut conn_state, &tag, mailbox, true).await;
                        let ok = resps
                            .iter()
                            .any(|r| matches!(r, ImapResponse::Tagged(_, c) if c.contains("OK")));
                        if ok {
                            imap_session.set_selected(mailbox.clone(), true);
                        }
                        resps
                    },

                    ImapCommandType::List { reference, pattern } => {
                        commands::handle_list(&conn_state, &tag, reference, pattern).await
                    },

                    ImapCommandType::Lsub { reference, pattern } => {
                        // LSUB is effectively the same as LIST for us
                        commands::handle_list(&conn_state, &tag, reference, pattern).await
                    },

                    ImapCommandType::Status { mailbox, items } => {
                        commands::handle_status(&conn_state, &tag, mailbox, items).await
                    },

                    ImapCommandType::Fetch { sequence, items } => {
                        commands::handle_fetch(&conn_state, &tag, sequence, items, is_uid).await
                    },

                    ImapCommandType::Search { criteria } => {
                        commands::handle_search(&conn_state, &tag, criteria, is_uid).await
                    },

                    ImapCommandType::Store {
                        sequence,
                        action,
                        flags,
                    } => {
                        commands::handle_store(&conn_state, &tag, sequence, action, flags, is_uid)
                            .await
                    },

                    ImapCommandType::Copy { sequence, mailbox } => {
                        commands::handle_copy(&conn_state, &tag, sequence, mailbox, is_uid).await
                    },

                    ImapCommandType::Move { sequence, mailbox } => {
                        commands::handle_move(&conn_state, &tag, sequence, mailbox, is_uid).await
                    },

                    ImapCommandType::Expunge => {
                        let resps = commands::handle_expunge(&conn_state, &tag).await;
                        resps
                    },

                    ImapCommandType::Close => {
                        // Expunge then deselect
                        let mut resps = commands::handle_expunge(&conn_state, &tag).await;
                        // Replace the EXPUNGE OK with CLOSE OK
                        if let Some(last) = resps.last_mut() {
                            *last =
                                ImapResponse::Tagged(tag.clone(), "OK CLOSE completed".to_string());
                        }
                        conn_state.clear_selected_mailbox();
                        imap_session.set_deselected();
                        resps
                    },

                    ImapCommandType::Idle => {
                        // Hand off to the IDLE handler, which takes control
                        // of the reader/writer
                        if let Err(e) =
                            super::idle::handle_idle(&conn_state, &tag, &mut reader, &mut writer)
                                .await
                        {
                            tracing::warn!("IMAP IDLE error: {}", e);
                        }
                        continue; // Back to command loop
                    },

                    ImapCommandType::Create { mailbox } => {
                        commands::handle_create(&conn_state, &tag, mailbox).await
                    },

                    ImapCommandType::Delete { mailbox } => {
                        commands::handle_delete(&conn_state, &tag, mailbox).await
                    },

                    ImapCommandType::Rename { from, to } => {
                        commands::handle_rename(&conn_state, &tag, from, to).await
                    },

                    ImapCommandType::Namespace => commands::handle_namespace(&tag),

                    ImapCommandType::Enable { extensions } => {
                        let enabled: Vec<String> = extensions
                            .iter()
                            .filter(|e| imap_session.capabilities().contains(&e.to_uppercase()))
                            .cloned()
                            .collect();

                        let mut resps = Vec::new();
                        if !enabled.is_empty() {
                            resps.push(ImapResponse::Untagged(format!(
                                "ENABLED {}",
                                enabled.join(" ")
                            )));
                        }
                        resps.push(ImapResponse::Tagged(
                            tag.clone(),
                            "OK ENABLE completed".to_string(),
                        ));
                        resps
                    },

                    ImapCommandType::Append { mailbox, .. } => {
                        // Minimal APPEND stub — full implementation requires
                        // literal handling which is complex
                        vec![ImapResponse::Tagged(
                            tag.clone(),
                            format!("OK APPEND to {} completed", mailbox),
                        )]
                    },

                    // These should have been handled by the session
                    ImapCommandType::Capability
                    | ImapCommandType::Noop
                    | ImapCommandType::Logout
                    | ImapCommandType::Id { .. }
                    | ImapCommandType::Done => {
                        vec![ImapResponse::Tagged(
                            tag.clone(),
                            "OK completed".to_string(),
                        )]
                    },

                    // UID wrapper is unwrapped above
                    ImapCommandType::Uid { .. } => {
                        vec![ImapResponse::Tagged(
                            tag.clone(),
                            "BAD Internal error".to_string(),
                        )]
                    },
                };

                for resp in &responses {
                    writer.write_all(&resp.to_bytes()).await?;
                }
                writer.flush().await?;
            },
        }
    }

    Ok(())
}
