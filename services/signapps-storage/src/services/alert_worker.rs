//! Background alert worker for drive audit events.
//!
//! Runs every 60 seconds. For each enabled `AuditAlertConfig` it counts
//! recent audit log entries matching the alert type, then emits a
//! `tracing::warn!` if the count exceeds the configured threshold.
//!
//! Email delivery is a future TODO — the infrastructure for notification
//! emails will be wired in once the `signapps-mail` integration is ready.

use sqlx::PgPool;

/// Default polling interval in seconds.
const POLL_INTERVAL_SECS: u64 = 60;

/// Entry-point for the background alert worker.
///
/// Spawn with `tokio::spawn(alert_worker::run(pool))`.
/// The task runs forever (until the process exits).
pub async fn run(pool: PgPool) {
    tracing::info!("Drive alert worker started (interval: {POLL_INTERVAL_SECS}s)");

    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;

        if let Err(e) = check_alerts(&pool).await {
            tracing::error!(error = %e, "Drive alert worker encountered an error");
        }
    }
}

/// Run one alert-check cycle.
async fn check_alerts(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Fetch all enabled alert configurations (all orgs).
    let configs: Vec<AlertConfigRow> = sqlx::query_as(
        r#"SELECT id, org_id, alert_type, threshold, notify_emails
           FROM drive.audit_alert_config
           WHERE enabled = true"#,
    )
    .fetch_all(pool)
    .await?;

    if configs.is_empty() {
        return Ok(());
    }

    for config in configs {
        // Parse the threshold JSON: { "count": N, "window_minutes": M }
        let count_threshold = config
            .threshold
            .get("count")
            .and_then(|v| v.as_i64())
            .unwrap_or(100);

        let window_minutes = config
            .threshold
            .get("window_minutes")
            .and_then(|v| v.as_i64())
            .unwrap_or(60);

        // Count matching events in the time window
        let recent_count: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM drive.audit_log
               WHERE action::text = $1
                 AND created_at >= NOW() - ($2 || ' minutes')::interval"#,
        )
        .bind(&config.alert_type)
        .bind(window_minutes.to_string())
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        if recent_count >= count_threshold {
            tracing::warn!(
                alert_type = %config.alert_type,
                org_id = %config.org_id,
                count = recent_count,
                threshold = count_threshold,
                window_minutes = window_minutes,
                notify_emails = ?config.notify_emails,
                "Drive audit alert triggered — threshold exceeded \
                 (TODO: send notification email)"
            );
        }
    }

    Ok(())
}

// ============================================================================
// Minimal row struct for reading alert configs
// ============================================================================

#[derive(sqlx::FromRow)]
struct AlertConfigRow {
    #[allow(dead_code)]
    id: uuid::Uuid,
    org_id: uuid::Uuid,
    alert_type: String,
    threshold: serde_json::Value,
    notify_emails: Option<Vec<String>>,
}

// Suppress unused field warnings — `id` is kept for future use (e.g. logging).
#[allow(dead_code)]
const _: () = {
    fn _assert_fields(_: &AlertConfigRow) {
        // Compile-time check that fields are accessible
    }
};
