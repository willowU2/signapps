//! SignApps Domain Controller — multi-protocol server.
//!
//! Launches LDAP (:389/:636), Kerberos KDC (:88/:464), and NTP (:10123) listeners
//! on a shared tokio runtime with a single PostgreSQL connection pool.
//! DNS is delegated to signapps-securelink.

mod config;
mod health;

use signapps_common::bootstrap::{env_or, init_tracing, load_env};
use tokio::sync::watch;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_dc");
    load_env();

    tracing::info!("=== SignApps Domain Controller ===");

    let config = config::DcConfig::from_env();
    tracing::info!(
        domain = %config.domain,
        realm = %config.realm,
        ldap_port = config.ldap_port,
        kdc_port = config.kdc_port,
        "DC configuration loaded"
    );

    // Database pool (shared with identity service)
    let database_url =
        env_or("DATABASE_URL", "postgres://signapps:password@localhost:5432/signapps");
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(20)
        .connect(&database_url)
        .await?;

    tracing::info!("Database connected");

    // Shutdown signal
    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    // Health endpoint (Axum HTTP on a separate port)
    let health_port = config.health_port;
    let health_pool = pool.clone();
    let health_handle = tokio::spawn(async move {
        if let Err(e) = health::run_health_server(health_pool, health_port).await {
            tracing::error!("Health server error: {}", e);
        }
    });

    // LDAP listener
    let ldap_config = signapps_ldap_server::listener::LdapListenerConfig {
        ldap_addr: format!("0.0.0.0:{}", config.ldap_port).parse()?,
        ldaps_addr: Some(format!("0.0.0.0:{}", config.ldaps_port).parse()?),
        max_connections: 1024,
    };
    let ldap_listener = signapps_ldap_server::listener::LdapListener::new(ldap_config);
    let ldap_pool = pool.clone();
    let ldap_shutdown = shutdown_rx.clone();
    let ldap_handle = tokio::spawn(async move {
        if let Err(e) = ldap_listener.run(ldap_pool, ldap_shutdown).await {
            tracing::error!("LDAP listener error: {}", e);
        }
    });

    // Kerberos KDC listener
    let kdc_config = signapps_kerberos_kdc::listener::KdcListenerConfig {
        kdc_addr: format!("0.0.0.0:{}", config.kdc_port).parse()?,
        kpasswd_addr: format!("0.0.0.0:{}", config.kpasswd_port).parse()?,
        max_udp_size: 65535,
    };
    let kdc_listener = signapps_kerberos_kdc::listener::KdcListener::new(kdc_config);
    let kdc_pool = pool.clone();
    let kdc_shutdown = shutdown_rx.clone();
    let kdc_handle = tokio::spawn(async move {
        if let Err(e) = kdc_listener.run(kdc_pool, kdc_shutdown).await {
            tracing::error!("KDC listener error: {}", e);
        }
    });

    // NTP listener
    let ntp_port = config.ntp_port;
    let ntp_shutdown = shutdown_rx.clone();
    let ntp_handle = tokio::spawn(async move {
        use signapps_dns_server::ntp::NtpPacket;
        use tokio::net::UdpSocket;

        let socket = match UdpSocket::bind(format!("0.0.0.0:{}", ntp_port)).await {
            Ok(s) => {
                tracing::info!(port = ntp_port, "NTP server started");
                s
            }
            Err(e) => {
                tracing::error!(port = ntp_port, "NTP bind failed: {}", e);
                return;
            }
        };

        let mut buf = [0u8; 48];
        let mut shutdown_rx = ntp_shutdown;

        loop {
            tokio::select! {
                result = socket.recv_from(&mut buf) => {
                    match result {
                        Ok((len, addr)) if len >= 48 => {
                            if let Some(client_pkt) = NtpPacket::from_bytes(&buf[..len]) {
                                let response = NtpPacket::server_response(client_pkt.transmit_timestamp, 3);
                                let resp_bytes = response.to_bytes();
                                if let Err(e) = socket.send_to(&resp_bytes, addr).await {
                                    tracing::warn!(peer = %addr, "NTP send error: {}", e);
                                }
                            }
                        }
                        Ok((len, addr)) => {
                            tracing::debug!(peer = %addr, len = len, "NTP packet too short");
                        }
                        Err(e) => {
                            tracing::error!("NTP recv error: {}", e);
                        }
                    }
                }
                _ = async {
                    loop {
                        shutdown_rx.changed().await.ok();
                        if *shutdown_rx.borrow() { break; }
                    }
                } => {
                    tracing::info!("NTP server shutting down");
                    break;
                }
            }
        }
    });

    tracing::info!("All DC listeners started — press Ctrl+C to stop");

    // Wait for shutdown
    tokio::signal::ctrl_c().await?;
    tracing::info!("Shutdown signal received");
    let _ = shutdown_tx.send(true);

    // Wait for listeners to finish
    let _ = tokio::join!(health_handle, ldap_handle, kdc_handle, ntp_handle);

    tracing::info!("=== SignApps DC stopped ===");
    Ok(())
}
