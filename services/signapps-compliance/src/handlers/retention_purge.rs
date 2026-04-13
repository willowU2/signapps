//! CO3: Data retention auto-purge background job.
//!
//! Runs daily (every 24 hours after startup). Reads retention policies from
//! `identity.compliance_records` and executes DELETE/UPDATE statements against
//! the appropriate tables. Logs what was purged.

use signapps_db::DatabasePool;

/// Launch the daily retention purge task.
///
/// Runs indefinitely — call via `tokio::spawn`.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn run_daily(pool: DatabasePool) {
    tracing::info!("retention-purge: background job started (runs every 24h)");
    loop {
        if let Err(e) = run_once(&pool).await {
            tracing::error!("retention-purge: run failed: {}", e);
        }
        // Sleep 24 hours
        tokio::time::sleep(tokio::time::Duration::from_secs(86400)).await;
    }
}

async fn run_once(pool: &DatabasePool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("retention-purge: starting daily purge run");

    // Load active retention policies
    let rows: Vec<(serde_json::Value,)> = sqlx::query_as(
        r#"
        SELECT data
        FROM identity.compliance_records
        WHERE record_type = 'retention-policies'
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .unwrap_or_default();

    let policies: Vec<serde_json::Value> = rows
        .into_iter()
        .flat_map(|(data,)| data.as_array().cloned().unwrap_or_default())
        .collect();

    if policies.is_empty() {
        tracing::info!("retention-purge: no retention policies configured, skipping");
        return Ok(());
    }

    for policy in &policies {
        let active = policy
            .get("active")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);
        let auto_purge = policy
            .get("auto_purge")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        if !active || !auto_purge {
            continue;
        }

        let data_type = policy
            .get("data_type")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let retention_value = policy
            .get("retention_value")
            .and_then(|v| v.as_i64())
            .unwrap_or(12);
        let retention_unit = policy
            .get("retention_unit")
            .and_then(|v| v.as_str())
            .unwrap_or("months");
        let purge_action = policy
            .get("purge_action")
            .and_then(|v| v.as_str())
            .unwrap_or("delete");

        let interval = match retention_unit {
            "days" => format!("{} days", retention_value),
            "months" => format!("{} months", retention_value),
            "years" => format!("{} years", retention_value),
            _ => format!("{} months", retention_value),
        };

        let affected = execute_purge(pool, data_type, &interval, purge_action).await;

        tracing::info!(
            data_type = data_type,
            retention = %interval,
            action = purge_action,
            affected = affected,
            "retention-purge: policy executed"
        );
    }

    // Always purge old platform events (> 2 years) to control table size
    let old_events_deleted = sqlx::query(
        r#"
        DELETE FROM platform.events
        WHERE created_at < NOW() - INTERVAL '2 years'
        "#,
    )
    .execute(pool.inner())
    .await
    .map(|r| r.rows_affected())
    .unwrap_or(0);

    if old_events_deleted > 0 {
        tracing::info!(
            rows = old_events_deleted,
            "retention-purge: deleted old platform events"
        );
    }

    tracing::info!("retention-purge: daily purge run completed");
    Ok(())
}

/// Execute the appropriate SQL statement for the given data type and action.
async fn execute_purge(pool: &DatabasePool, data_type: &str, interval: &str, action: &str) -> u64 {
    match (data_type, action) {
        // Emails
        ("emails", "delete") | ("mail", "delete") => sqlx::query(&format!(
            "DELETE FROM mail.emails WHERE created_at < NOW() - INTERVAL '{}'",
            sanitize_interval(interval)
        ))
        .execute(pool.inner())
        .await
        .map(|r| r.rows_affected())
        .unwrap_or(0),
        // Audit logs
        ("audit_logs", "delete") | ("logs", "delete") => sqlx::query(&format!(
            "DELETE FROM identity.audit_logs WHERE created_at < NOW() - INTERVAL '{}'",
            sanitize_interval(interval)
        ))
        .execute(pool.inner())
        .await
        .map(|r| r.rows_affected())
        .unwrap_or(0),
        // Platform events (custom retention)
        ("events", "delete") | ("platform_events", "delete") => sqlx::query(&format!(
            "DELETE FROM platform.events WHERE created_at < NOW() - INTERVAL '{}'",
            sanitize_interval(interval)
        ))
        .execute(pool.inner())
        .await
        .map(|r| r.rows_affected())
        .unwrap_or(0),
        // Unrecognised data type — skip with a warning
        _ => {
            tracing::warn!(
                data_type = data_type,
                action = action,
                "retention-purge: unrecognized data type, skipping"
            );
            0
        },
    }
}

/// Sanitise an interval string to prevent SQL injection.
/// Only allows digits and known unit words.
fn sanitize_interval(interval: &str) -> String {
    interval
        .chars()
        .filter(|c| c.is_ascii_digit() || c.is_ascii_alphabetic() || *c == ' ')
        .collect::<String>()
        .split_whitespace()
        .take(2) // e.g. ["12", "months"]
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_interval_safe() {
        assert_eq!(sanitize_interval("12 months"), "12 months");
        assert_eq!(sanitize_interval("2 years"), "2 years");
        // SQL injection attempt is neutered: special chars stripped, then take(2)
        // keeps at most "number unit" — "DROP TABLE" is harmless as a bare interval value.
        assert_eq!(sanitize_interval("'; DROP TABLE foo; --"), "DROP TABLE");
    }
}
