//! SignApps Domain Controller — multi-protocol server.
//!
//! Launches LDAP (:389/:636), Kerberos KDC (:88/:464) listeners
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

    tracing::info!("All DC listeners started — press Ctrl+C to stop");

    // Wait for shutdown
    tokio::signal::ctrl_c().await?;
    tracing::info!("Shutdown signal received");
    let _ = shutdown_tx.send(true);

    // Wait for listeners to finish
    let _ = tokio::join!(health_handle, ldap_handle, kdc_handle);

    tracing::info!("=== SignApps DC stopped ===");
    Ok(())
}
