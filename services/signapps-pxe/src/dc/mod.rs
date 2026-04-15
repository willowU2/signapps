//! Domain Controller protocol listeners — LDAP, Kerberos KDC, NTP.
//!
//! These listeners are spawned as background tokio tasks from the merged
//! `signapps-pxe` main process.  The HTTP REST API and health endpoint
//! continue to be served by the parent Axum router on port 3016.

pub mod config;

use signapps_db::DatabasePool;
use tokio::sync::watch;

/// Spawn all DC protocol listeners onto the current tokio runtime.
///
/// Each listener runs as an independent background task.  A listener failure
/// is logged but does NOT kill the parent process — PXE REST API stays up.
///
/// # Errors
///
/// Returns `Err` only if the `DcConfig` cannot be constructed (env parse
/// errors) or if address parsing fails — not on runtime listener errors.
pub async fn spawn_dc_listeners(
    pool: DatabasePool,
    shutdown_rx: watch::Receiver<bool>,
) -> anyhow::Result<()> {
    // Extract inner PgPool for crates that expect sqlx::PgPool directly.
    let pool: sqlx::PgPool = pool.inner().clone();
    let config = config::DcConfig::from_env();

    tracing::info!(
        domain = %config.domain,
        realm  = %config.realm,
        ldap_port = config.ldap_port,
        kdc_port  = config.kdc_port,
        "DC configuration loaded"
    );

    // ── Load domain config from registry (if available) ────────────────────
    let domain_config_query: Option<(String, Option<String>, Option<String>, serde_json::Value)> =
        sqlx::query_as(
            "SELECT dns_name, realm, domain_sid, config \
             FROM infrastructure.domains \
             WHERE dns_name = $1 AND is_active = true \
             LIMIT 1",
        )
        .bind(&config.domain)
        .fetch_optional(&pool)
        .await
        .ok()
        .flatten();

    if let Some((dns_name, realm, sid, db_config)) = domain_config_query {
        tracing::info!(
            domain = %dns_name,
            realm  = ?realm,
            sid    = ?sid,
            "Loaded domain config from registry"
        );
        if let Some(ntp) = db_config.get("ntp") {
            tracing::info!(ntp = %ntp, "NTP configuration loaded");
        }
    } else {
        tracing::warn!(
            domain = %config.domain,
            "Domain not found in infrastructure registry — using env defaults"
        );
    }

    // ── LDAP listener ────────────────────────────────────────────────────────
    let ldap_config = signapps_ldap_server::listener::LdapListenerConfig {
        ldap_addr: format!("0.0.0.0:{}", config.ldap_port).parse()?,
        ldaps_addr: Some(format!("0.0.0.0:{}", config.ldaps_port).parse()?),
        max_connections: 1024,
    };
    let ldap_listener = signapps_ldap_server::listener::LdapListener::new(ldap_config);
    let ldap_pool = pool.clone();
    let ldap_shutdown = shutdown_rx.clone();
    tokio::spawn(async move {
        if let Err(e) = ldap_listener.run(ldap_pool, ldap_shutdown).await {
            tracing::error!("LDAP listener error: {}", e);
        }
    });
    tracing::info!(
        port = config.ldap_port,
        ldaps_port = config.ldaps_port,
        "LDAP listener spawned"
    );

    // ── Kerberos KDC listener ────────────────────────────────────────────────
    let kdc_config = signapps_kerberos_kdc::listener::KdcListenerConfig {
        kdc_addr: format!("0.0.0.0:{}", config.kdc_port).parse()?,
        kpasswd_addr: format!("0.0.0.0:{}", config.kpasswd_port).parse()?,
        max_udp_size: 65535,
    };
    let kdc_listener = signapps_kerberos_kdc::listener::KdcListener::new(kdc_config);
    let kdc_pool = pool.clone();
    let kdc_shutdown = shutdown_rx.clone();
    tokio::spawn(async move {
        if let Err(e) = kdc_listener.run(kdc_pool, kdc_shutdown).await {
            tracing::error!("KDC listener error: {}", e);
        }
    });
    tracing::info!(
        port = config.kdc_port,
        kpasswd_port = config.kpasswd_port,
        "KDC listener spawned"
    );

    // ── NTP listener ─────────────────────────────────────────────────────────
    let ntp_port = config.ntp_port;
    let ntp_shutdown = shutdown_rx.clone();
    tokio::spawn(async move {
        use signapps_dns_server::ntp::NtpPacket;
        use tokio::net::UdpSocket;

        let socket = match UdpSocket::bind(format!("0.0.0.0:{}", ntp_port)).await {
            Ok(s) => {
                tracing::info!(port = ntp_port, "NTP server started");
                s
            },
            Err(e) => {
                tracing::error!(port = ntp_port, "NTP bind failed: {}", e);
                return;
            },
        };

        let mut buf = [0u8; 48];
        let mut shutdown = ntp_shutdown;

        loop {
            tokio::select! {
                result = socket.recv_from(&mut buf) => {
                    match result {
                        Ok((len, addr)) if len >= 48 => {
                            if let Some(client_pkt) = NtpPacket::from_bytes(&buf[..len]) {
                                let response = NtpPacket::server_response(
                                    client_pkt.transmit_timestamp,
                                    3,
                                );
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
                        shutdown.changed().await.ok();
                        if *shutdown.borrow() { break; }
                    }
                } => {
                    tracing::info!("NTP server shutting down");
                    break;
                }
            }
        }
    });
    tracing::info!(port = ntp_port, "NTP listener spawned");

    // ── AD Sync worker ────────────────────────────────────────────────────────
    let sync_pool = pool.clone();
    tokio::spawn(async move {
        signapps_ad_core::sync_worker::run_sync_worker(sync_pool).await;
    });
    tracing::info!("AD sync worker spawned");

    // ── AD Reconciliation cron (every 15 min) ─────────────────────────────────
    let recon_pool = pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(900));
        loop {
            interval.tick().await;
            match signapps_ad_core::reconciliation::reconcile(&recon_pool).await {
                Ok(report) => {
                    tracing::info!(?report, "AD reconciliation completed");
                },
                Err(e) => {
                    tracing::error!("AD reconciliation failed: {}", e);
                },
            }
        }
    });
    tracing::info!("AD reconciliation cron spawned (interval = 15 min)");

    Ok(())
}
