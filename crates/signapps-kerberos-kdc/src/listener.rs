//! UDP + TCP listener for the Kerberos KDC.
//!
//! Kerberos primarily uses UDP (:88) for small messages.
//! TCP (:88) is used as fallback when messages exceed the MTU.
//! kpasswd uses TCP (:464).

use std::net::SocketAddr;
use std::sync::Arc;

use tokio::net::{TcpListener, UdpSocket};

/// KDC listener configuration.
#[derive(Debug, Clone)]
pub struct KdcListenerConfig {
    /// Bind address for the KDC (e.g., `"0.0.0.0:88"`).
    pub kdc_addr: SocketAddr,
    /// Bind address for kpasswd (e.g., `"0.0.0.0:464"`).
    pub kpasswd_addr: SocketAddr,
    /// Maximum UDP receive buffer size in bytes.
    pub max_udp_size: usize,
}

impl Default for KdcListenerConfig {
    fn default() -> Self {
        Self {
            kdc_addr: "0.0.0.0:88".parse().expect("valid address"),
            kpasswd_addr: "0.0.0.0:464".parse().expect("valid address"),
            max_udp_size: 65535,
        }
    }
}

/// Kerberos KDC listener (UDP + TCP on :88, TCP on :464).
pub struct KdcListener {
    config: KdcListenerConfig,
}

impl KdcListener {
    /// Create a new [`KdcListener`] with the given configuration.
    pub fn new(config: KdcListenerConfig) -> Self {
        Self { config }
    }

    /// Start the KDC listeners and run until `shutdown` signals `true`.
    ///
    /// Binds:
    /// - UDP :88 for KDC requests (primary Kerberos transport)
    /// - TCP :88 for KDC requests (large-message fallback)
    /// - TCP :464 for kpasswd (password-change service)
    ///
    /// Each incoming request is dispatched to a `tokio::spawn`ed task.
    /// The method returns once the shutdown signal fires.
    ///
    /// # Errors
    ///
    /// Returns an error if any socket bind fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// let listener = KdcListener::new(KdcListenerConfig::default());
    /// let (tx, rx) = tokio::sync::watch::channel(false);
    /// listener.run(pool, rx).await?;
    /// ```
    pub async fn run(
        &self,
        pool: sqlx::PgPool,
        shutdown: tokio::sync::watch::Receiver<bool>,
    ) -> anyhow::Result<()> {
        // UDP listener for KDC (wrapped in Arc for cross-task sharing)
        let udp_socket = Arc::new(UdpSocket::bind(self.config.kdc_addr).await?);
        tracing::info!(addr = %self.config.kdc_addr, "KDC UDP listener started");

        // TCP listener for KDC
        let tcp_listener = TcpListener::bind(self.config.kdc_addr).await?;
        tracing::info!(addr = %self.config.kdc_addr, "KDC TCP listener started");

        // TCP listener for kpasswd
        let kpasswd_listener = TcpListener::bind(self.config.kpasswd_addr).await?;
        tracing::info!(addr = %self.config.kpasswd_addr, "kpasswd listener started");

        let mut shutdown_rx = shutdown.clone();
        let mut buf = vec![0u8; self.config.max_udp_size];

        loop {
            tokio::select! {
                // UDP KDC requests
                result = udp_socket.recv_from(&mut buf) => {
                    match result {
                        Ok((len, addr)) => {
                            tracing::debug!(peer = %addr, bytes = len, "KDC UDP request received");
                            let data = buf[..len].to_vec();
                            let _pool = pool.clone();
                            let socket = Arc::clone(&udp_socket);
                            tokio::spawn(async move {
                                // Will be wired to as_req/tgs_req handlers
                                tracing::debug!(
                                    peer = %addr,
                                    bytes = data.len(),
                                    "KDC UDP handler placeholder"
                                );
                                let _ = socket; // will be used to send the response
                            });
                        }
                        Err(e) => tracing::error!(error = %e, "KDC UDP recv error"),
                    }
                }

                // TCP KDC requests
                result = tcp_listener.accept() => {
                    match result {
                        Ok((_stream, addr)) => {
                            tracing::debug!(peer = %addr, "KDC TCP connection accepted");
                            let _pool = pool.clone();
                            tokio::spawn(async move {
                                // Will be wired to as_req/tgs_req handlers
                                tracing::debug!(peer = %addr, "KDC TCP handler placeholder");
                            });
                        }
                        Err(e) => tracing::error!(error = %e, "KDC TCP accept error"),
                    }
                }

                // kpasswd TCP requests
                result = kpasswd_listener.accept() => {
                    match result {
                        Ok((_stream, addr)) => {
                            tracing::debug!(peer = %addr, "kpasswd connection accepted");
                            let _pool = pool.clone();
                            tokio::spawn(async move {
                                tracing::debug!(peer = %addr, "kpasswd handler placeholder");
                            });
                        }
                        Err(e) => tracing::error!(error = %e, "kpasswd accept error"),
                    }
                }

                // Shutdown signal
                _ = async {
                    loop {
                        shutdown_rx.changed().await.ok();
                        if *shutdown_rx.borrow() {
                            break;
                        }
                    }
                } => {
                    tracing::info!("KDC listeners shutting down");
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
    fn default_config_ports() {
        let cfg = KdcListenerConfig::default();
        assert_eq!(cfg.kdc_addr.port(), 88);
        assert_eq!(cfg.kpasswd_addr.port(), 464);
    }

    #[test]
    fn default_config_udp_size() {
        let cfg = KdcListenerConfig::default();
        assert_eq!(cfg.max_udp_size, 65535);
    }
}
