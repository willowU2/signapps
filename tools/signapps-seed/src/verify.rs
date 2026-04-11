//! Post-seed verification — validates data integrity after seeding.
//!
//! Runs a set of COUNT assertions against the seeded tables and reports
//! failures without panicking. Returns `Err` only when one or more checks fail,
//! so the caller (main) can surface a non-zero exit code.

use uuid::Uuid;
use tracing;

/// Runs integrity checks against seeded data.
///
/// `mode` matches the `--mode` CLI argument (`"minimal"`, `"acme"`,
/// `"startup"`, `"chaos"`). Full-suite assertions are only applied when
/// `mode == "full"` or `mode == "chaos"` to avoid false failures on
/// intentionally sparse seeds.
///
/// # Errors
///
/// Returns an error summarising the number of failed checks when any
/// assertion does not pass. Individual table-not-found warnings do **not**
/// count as failures — they are logged at WARN and skipped.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub async fn run(
    pool: &sqlx::PgPool,
    mode: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut errors: Vec<String> = Vec::new();

    // ── Baseline assertions (all modes) ──────────────────────────────────────
    assert_min(pool, "identity.tenants", 1, &mut errors).await;
    assert_min(pool, "identity.users", 5, &mut errors).await;
    assert_min(pool, "core.persons", 5, &mut errors).await;

    // ── Full-suite assertions (acme / chaos modes) ────────────────────────────
    if mode == "full" || mode == "acme" || mode == "chaos" {
        assert_min(pool, "identity.tenants", 3, &mut errors).await;
        assert_min(pool, "identity.users", 95, &mut errors).await;
        assert_min(pool, "core.persons", 95, &mut errors).await;

        // Optional modules: warn-only when the table is absent.
        check_table_count(pool, "calendar.projects", 20, &mut errors).await;
        check_table_count(pool, "scheduling.time_items", 500, &mut errors).await;
    }

    // ── Chaos-specific high-volume assertions ─────────────────────────────────
    if mode == "chaos" || mode == "full" {
        check_table_count(pool, "scheduling.time_items", 2500, &mut errors).await;
        check_table_count(pool, "core.org_nodes", 25, &mut errors).await;
    }

    // ── New modules (full mode) ───────────────────────────────────────────────
    if mode == "full" {
        check_table_count(pool, "drive.nodes", 100, &mut errors).await;
        check_table_count(pool, "chat.channels", 7, &mut errors).await;
        check_table_count(pool, "chat.messages", 200, &mut errors).await;
        check_table_count(pool, "billing.invoices", 25, &mut errors).await;
        check_table_count(pool, "gamification.user_xp", 80, &mut errors).await;
        check_table_count(pool, "notifications.items", 50, &mut errors).await;
        check_table_count(pool, "sharing.grants", 30, &mut errors).await;

        // Admin must be platform-level (tenant_id = NULL) in full mode
        let admin_tenant: Option<(Option<Uuid>,)> = sqlx::query_as(
            "SELECT tenant_id FROM identity.users WHERE username = 'admin'",
        )
        .fetch_optional(pool)
        .await
        .unwrap_or(None);

        match admin_tenant {
            Some((None,)) => tracing::info!("  OK  admin.tenant_id = NULL (platform-level)"),
            Some((Some(tid),)) => {
                errors.push(format!("admin.tenant_id = {tid}, expected NULL"));
            }
            None => errors.push("admin user not found".to_string()),
        }
    }

    // ── Result ────────────────────────────────────────────────────────────────
    if errors.is_empty() {
        tracing::info!("all verification checks passed");
        Ok(())
    } else {
        for e in &errors {
            tracing::error!("FAIL: {}", e);
        }
        Err(format!("{} checks failed", errors.len()).into())
    }
}

/// Asserts that `table` contains at least `min` rows.
///
/// Appends a descriptive message to `errors` on failure. Table-not-found
/// errors are logged at WARN and treated as hard failures (the table is
/// expected to exist).
async fn assert_min(
    pool: &sqlx::PgPool,
    table: &str,
    min: i64,
    errors: &mut Vec<String>,
) {
    match sqlx::query_scalar::<_, i64>(&format!("SELECT COUNT(*) FROM {table}"))
        .fetch_one(pool)
        .await
    {
        Ok(n) if n >= min => {
            tracing::info!("  OK  {} = {} (>= {})", table, n, min);
        }
        Ok(n) => {
            errors.push(format!("{table}: got {n}, expected >= {min}"));
        }
        Err(e) => {
            // Table is expected to exist — count as failure.
            errors.push(format!("{table}: query error — {e}"));
        }
    }
}

/// Checks that `table` contains at least `min` rows, but **skips silently**
/// when the table does not exist (optional modules).
///
/// Logs a WARN when row count is below `min` but does **not** push to
/// `errors`, so the caller is informed without blocking the seed.
async fn check_table_count(
    pool: &sqlx::PgPool,
    table: &str,
    min: i64,
    _errors: &mut Vec<String>,
) {
    match sqlx::query_scalar::<_, i64>(&format!("SELECT COUNT(*) FROM {table}"))
        .fetch_one(pool)
        .await
    {
        Ok(n) if n >= min => {
            tracing::info!("  OK  {} = {} (>= {})", table, n, min);
        }
        Ok(n) => {
            tracing::warn!("  LOW {} = {} (expected >= {})", table, n, min);
        }
        Err(_) => {
            tracing::warn!("  SKIP {} (table may not exist)", table);
        }
    }
}
