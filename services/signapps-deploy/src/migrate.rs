//! Database migration runner.
//!
//! Phase 1 policy: migrations are not automatically applied. The orchestrator
//! reports the list of pending migration files; an operator applies them
//! during a maintenance window. Future phases may add automatic application
//! for small, backward-compatible migrations.

use anyhow::{Context, Result};
use sqlx::PgPool;
use std::fs;
use std::path::{Path, PathBuf};

/// Return the list of migration file names (e.g. `305_deployments.sql`) that
/// exist on disk but are NOT yet recorded in `_sqlx_migrations`.
///
/// The `migrations_dir` should be an absolute or repo-relative path to the
/// `migrations/` directory.
pub async fn pending_migrations(pool: &PgPool, migrations_dir: &Path) -> Result<Vec<String>> {
    let mut on_disk: Vec<String> = Vec::new();
    for entry in fs::read_dir(migrations_dir).context("read migrations dir")? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.ends_with(".sql") && !name.starts_with('_') {
            on_disk.push(name);
        }
    }
    on_disk.sort();

    // The `_sqlx_migrations` table may not exist on a fresh DB. Tolerate that.
    let tracked: Vec<i64> = sqlx::query_scalar("SELECT version FROM _sqlx_migrations")
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    // sqlx stores version as a numeric prefix (i64). Strip the prefix on disk
    // to match. Files that don't start with digits are considered always
    // pending (they likely need manual review).
    let tracked_set: std::collections::HashSet<i64> = tracked.into_iter().collect();
    let pending: Vec<String> = on_disk
        .into_iter()
        .filter(|name| match extract_version_prefix(name) {
            Some(v) => !tracked_set.contains(&v),
            None => true,
        })
        .collect();

    Ok(pending)
}

/// Apply a single `.sql` file to the database in a single transaction, without
/// updating `_sqlx_migrations`. This is used when the orchestrator knows a
/// migration is safe to apply inline (e.g. the deploy's own migration 305).
///
/// Returns the file's basename (for audit logging).
pub async fn apply_file(pool: &PgPool, path: &Path) -> Result<String> {
    let sql = fs::read_to_string(path).with_context(|| format!("read {}", path.display()))?;
    sqlx::raw_sql(&sql)
        .execute(pool)
        .await
        .with_context(|| format!("apply {}", path.display()))?;
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("<unknown>")
        .to_string();
    tracing::info!(file = %name, "applied migration file");
    Ok(name)
}

fn extract_version_prefix(name: &str) -> Option<i64> {
    let digits: String = name.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse().ok()
}

/// Convenience: run pending migrations by listing + applying them in order.
/// Returns the list of applied file names.
///
/// In Phase 1 this is NOT called automatically by every deploy — only when
/// the operator explicitly opts in.
pub async fn run_pending(pool: &PgPool, migrations_dir: &Path) -> Result<Vec<String>> {
    let pending = pending_migrations(pool, migrations_dir).await?;
    let mut applied = Vec::new();
    for name in &pending {
        let full = PathBuf::from(migrations_dir).join(name);
        apply_file(pool, &full).await?;
        applied.push(name.clone());
    }
    if !applied.is_empty() {
        tracing::info!(count = applied.len(), "migrations applied");
    }
    Ok(applied)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_version_prefix_handles_normal_and_odd_names() {
        assert_eq!(extract_version_prefix("305_deployments.sql"), Some(305));
        assert_eq!(extract_version_prefix("001_initial_schema.sql"), Some(1));
        assert_eq!(extract_version_prefix("no_prefix.sql"), None);
        assert_eq!(
            extract_version_prefix("2026032401_weird.sql"),
            Some(2026032401)
        );
    }
}
