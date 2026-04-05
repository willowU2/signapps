//! TCP listener for SMB connections (port 445).
//!
//! The SMB listener accepts TCP connections and dispatches to the
//! protocol handler. Full SMB2 session negotiation will be implemented
//! when GPO distribution is needed.

use std::net::SocketAddr;
use tokio::net::TcpListener;

/// SMB listener configuration.
#[derive(Debug, Clone)]
pub struct SmbListenerConfig {
    /// Address to bind (e.g., "0.0.0.0:445").
    pub addr: SocketAddr,
}

impl Default for SmbListenerConfig {
    fn default() -> Self {
        Self {
            addr: "0.0.0.0:445".parse().expect("valid address"),
        }
    }
}

/// SMB server listener.
pub struct SmbListener {
    config: SmbListenerConfig,
}

impl SmbListener {
    /// Create a new `SmbListener` with the given configuration.
    pub fn new(config: SmbListenerConfig) -> Self {
        Self { config }
    }

    /// Start listening for SMB connections.
    ///
    /// # Errors
    ///
    /// Returns an error if the TCP listener cannot bind to the configured address.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    pub async fn run(
        &self,
        shutdown: tokio::sync::watch::Receiver<bool>,
    ) -> anyhow::Result<()> {
        let listener = TcpListener::bind(self.config.addr).await?;
        tracing::info!(addr = %self.config.addr, "SMB listener started");

        let mut shutdown_rx = shutdown;

        loop {
            tokio::select! {
                result = listener.accept() => {
                    match result {
                        Ok((mut stream, addr)) => {
                            tracing::debug!(peer = %addr, "New SMB connection");
                            tokio::spawn(async move {
                                use tokio::io::{AsyncReadExt, AsyncWriteExt};
                                let mut buf = vec![0u8; 8192];

                                match stream.read(&mut buf).await {
                                    Ok(n) if n > 0 => {
                                        let data = &buf[..n];

                                        // Check for SMB2 magic (with or without NetBIOS header)
                                        let is_smb = data.len() >= 8
                                            && (super::protocol::Smb2Header::is_smb2(data)
                                                || (data[0] == 0x00
                                                    && data.len() > 4
                                                    && super::protocol::Smb2Header::is_smb2(
                                                        &data[4..],
                                                    ))
                                                || (data.len() >= 4
                                                    && data[0] == 0xFF
                                                    && data[1] == b'S'));

                                        if is_smb {
                                            match super::protocol::parse_negotiate_request(data) {
                                                Ok(dialects) => {
                                                    tracing::info!(
                                                        peer = %addr,
                                                        dialects = ?dialects,
                                                        "SMB Negotiate received"
                                                    );
                                                    let server_guid =
                                                        uuid::Uuid::new_v4().into_bytes();
                                                    let response =
                                                        super::protocol::build_negotiate_response(
                                                            &dialects,
                                                            &server_guid,
                                                        );
                                                    if let Err(e) =
                                                        stream.write_all(&response).await
                                                    {
                                                        tracing::warn!(
                                                            peer = %addr,
                                                            "SMB write error: {}",
                                                            e
                                                        );
                                                        return;
                                                    }

                                                    // After negotiate response sent, handle subsequent commands
                                                    loop {
                                                        let mut cmd_buf = vec![0u8; 8192];
                                                        match stream.read(&mut cmd_buf).await {
                                                            Ok(0) => break,
                                                            Ok(n) => {
                                                                let cmd_data = &cmd_buf[..n];
                                                                let off = if !cmd_data.is_empty() && cmd_data[0] == 0x00 { 4 } else { 0 };
                                                                if cmd_data.len() > off + 14 {
                                                                    let command = u16::from_le_bytes([
                                                                        cmd_data[off + 12],
                                                                        cmd_data[off + 13],
                                                                    ]);
                                                                    match command {
                                                                        0x0001 => { // SessionSetup
                                                                            match super::protocol::parse_session_setup_request(cmd_data) {
                                                                                Ok(info) => {
                                                                                    tracing::info!(
                                                                                        peer = %addr,
                                                                                        msg_id = info.message_id,
                                                                                        "SMB Session Setup"
                                                                                    );
                                                                                    let session_id = rand::random::<u64>();
                                                                                    let resp = super::protocol::build_session_setup_response(
                                                                                        info.message_id,
                                                                                        session_id,
                                                                                        super::protocol::NtStatus::MoreProcessingRequired,
                                                                                    );
                                                                                    let _ = stream.write_all(&resp).await;
                                                                                }
                                                                                Err(e) => {
                                                                                    tracing::debug!(
                                                                                        peer = %addr,
                                                                                        "Session Setup parse error: {}",
                                                                                        e
                                                                                    );
                                                                                }
                                                                            }
                                                                        }
                                                                        _ => {
                                                                            tracing::debug!(
                                                                                peer = %addr,
                                                                                command = command,
                                                                                "Unhandled SMB command"
                                                                            );
                                                                            break;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            Err(_) => break,
                                                        }
                                                    }
                                                }
                                                Err(e) => {
                                                    tracing::debug!(
                                                        peer = %addr,
                                                        "Not an SMB negotiate: {}",
                                                        e
                                                    );
                                                }
                                            }
                                        } else {
                                            tracing::debug!(
                                                peer = %addr,
                                                "Unknown protocol on SMB port"
                                            );
                                        }
                                    }
                                    Ok(_) => {
                                        tracing::debug!(
                                            peer = %addr,
                                            "SMB client disconnected immediately"
                                        )
                                    }
                                    Err(e) => {
                                        tracing::warn!(peer = %addr, "SMB read error: {}", e)
                                    }
                                }
                            });
                        }
                        Err(e) => tracing::error!("SMB accept error: {}", e),
                    }
                }
                _ = async {
                    loop {
                        shutdown_rx.changed().await.ok();
                        if *shutdown_rx.borrow() { break; }
                    }
                } => {
                    tracing::info!("SMB listener shutting down");
                    break;
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_port_445() {
        let cfg = SmbListenerConfig::default();
        assert_eq!(cfg.addr.port(), 445);
    }
}
