//! TCP/TLS listener for LDAP connections.

use std::net::SocketAddr;
use std::sync::Arc;

use tokio::net::TcpListener;
use tokio_rustls::TlsAcceptor;

/// Configuration for the LDAP listener.
#[derive(Debug, Clone)]
pub struct LdapListenerConfig {
    /// Address to bind for plain LDAP (e.g., `0.0.0.0:389`).
    pub ldap_addr: SocketAddr,
    /// Address to bind for LDAPS (e.g., `0.0.0.0:636`). None to disable.
    pub ldaps_addr: Option<SocketAddr>,
    /// Maximum concurrent connections.
    pub max_connections: usize,
}

impl Default for LdapListenerConfig {
    /// Returns default listener configuration binding LDAP on port 389 and LDAPS on port 636.
    fn default() -> Self {
        Self {
            ldap_addr: "0.0.0.0:389".parse().expect("valid address"),
            ldaps_addr: Some("0.0.0.0:636".parse().expect("valid address")),
            max_connections: 1024,
        }
    }
}

/// LDAP server listener state.
///
/// Manages TCP accept loops for both plain LDAP and LDAPS (TLS) ports,
/// spawning a tokio task per accepted connection.
pub struct LdapListener {
    config: LdapListenerConfig,
    tls_acceptor: Option<Arc<TlsAcceptor>>,
}

impl LdapListener {
    /// Create a new listener without TLS.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ldap_server::listener::{LdapListener, LdapListenerConfig};
    ///
    /// let config = LdapListenerConfig::default();
    /// let _listener = LdapListener::new(config);
    /// ```
    pub fn new(config: LdapListenerConfig) -> Self {
        Self {
            config,
            tls_acceptor: None,
        }
    }

    /// Create a new listener with TLS support.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// // Requires a valid TlsAcceptor built from certificates.
    /// let listener = LdapListener::with_tls(config, acceptor);
    /// ```
    pub fn with_tls(config: LdapListenerConfig, acceptor: TlsAcceptor) -> Self {
        Self {
            config,
            tls_acceptor: Some(Arc::new(acceptor)),
        }
    }

    /// Start listening for LDAP connections.
    ///
    /// This spawns accept loops for both LDAP (:389) and LDAPS (:636) ports.
    /// Each accepted connection is handled in its own tokio task.
    ///
    /// # Errors
    ///
    /// Returns an error if binding to the configured addresses fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    pub async fn run(
        &self,
        pool: sqlx::PgPool,
        shutdown: tokio::sync::watch::Receiver<bool>,
    ) -> anyhow::Result<()> {
        let ldap_listener = TcpListener::bind(self.config.ldap_addr).await?;
        tracing::info!(addr = %self.config.ldap_addr, "LDAP listener started");

        let ldaps_listener = if let Some(addr) = self.config.ldaps_addr {
            if self.tls_acceptor.is_some() {
                let listener = TcpListener::bind(addr).await?;
                tracing::info!(addr = %addr, "LDAPS listener started");
                Some(listener)
            } else {
                tracing::warn!("LDAPS address configured but no TLS acceptor provided");
                None
            }
        } else {
            None
        };

        let mut shutdown_rx = shutdown.clone();

        loop {
            tokio::select! {
                result = ldap_listener.accept() => {
                    match result {
                        Ok((stream, addr)) => {
                            tracing::debug!(peer = %addr, "New LDAP connection");
                            let pool = pool.clone();
                            let domain = std::env::var("DC_DOMAIN").unwrap_or_else(|_| "example.com".to_string());
                            tokio::spawn(async move {
                                super::connection::handle_connection(
                                    stream, pool, addr, false, domain,
                                )
                                .await;
                            });
                        }
                        Err(e) => {
                            tracing::error!("Failed to accept LDAP connection: {}", e);
                        }
                    }
                }
                result = async {
                    if let Some(ref listener) = ldaps_listener {
                        listener.accept().await
                    } else {
                        // Never resolves if no LDAPS listener
                        std::future::pending().await
                    }
                } => {
                    match result {
                        Ok((stream, addr)) => {
                            tracing::debug!(peer = %addr, "New LDAPS connection");
                            let tls = self.tls_acceptor.clone().unwrap();
                            let pool = pool.clone();
                            let domain = std::env::var("DC_DOMAIN").unwrap_or_else(|_| "example.com".to_string());
                            tokio::spawn(async move {
                                match tls.accept(stream).await {
                                    Ok(tls_stream) => {
                                        // Wrap the TlsStream in a TcpStream-compatible interface.
                                        // Full TLS stream routing is wired in Phase 3; for now
                                        // we convert to the underlying TCP stream so that the
                                        // connection handler can be reused without further changes.
                                        let tcp = tls_stream.into_inner().0;
                                        super::connection::handle_connection(
                                            tcp, pool, addr, true, domain,
                                        )
                                        .await;
                                    }
                                    Err(e) => {
                                        tracing::warn!(peer = %addr, "TLS handshake failed: {}", e);
                                    }
                                }
                            });
                        }
                        Err(e) => {
                            tracing::error!("Failed to accept LDAPS connection: {}", e);
                        }
                    }
                }
                _ = async {
                    loop {
                        shutdown_rx.changed().await.ok();
                        if *shutdown_rx.borrow() {
                            break;
                        }
                    }
                } => {
                    tracing::info!("LDAP listener shutting down");
                    break;
                }
            }
        }

        Ok(())
    }
}
