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
                        Ok((_stream, addr)) => {
                            tracing::debug!(peer = %addr, "New SMB connection");
                            tokio::spawn(async move {
                                // Read first 4 bytes to check for SMB2 magic
                                tracing::debug!(peer = %addr, "SMB handler placeholder");
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
