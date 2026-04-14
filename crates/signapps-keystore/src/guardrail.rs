//! Boot-time guardrails for services that store encrypted tokens.

use sqlx::PgPool;
use thiserror::Error;
use tracing::warn;

/// Errors from boot-time guardrail checks.
#[derive(Debug, Error)]
pub enum GuardrailError {
    /// Database query failed.
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    /// One or more rows still hold plaintext tokens.
    #[error("{rows} plaintext token rows in {table}.{text_col} (no {enc_col}) — refusing to start; run scripts/migrate-oauth-tokens.sh")]
    PlaintextDetected {
        /// Schema-qualified table name.
        table: &'static str,
        /// Plaintext column.
        text_col: &'static str,
        /// Encrypted column that should hold the migrated value.
        enc_col: &'static str,
        /// Number of rows with plaintext but no ciphertext.
        rows: i64,
    },
}

/// Spec of a column to check.
#[derive(Debug, Clone, Copy)]
pub struct TokenColumnSpec {
    /// Schema-qualified table.
    pub table: &'static str,
    /// Plaintext source column (TEXT).
    pub text_col: &'static str,
    /// Encrypted target column (BYTEA).
    pub enc_col: &'static str,
}

/// Verify that no row in the listed columns has plaintext without a
/// matching ciphertext.
///
/// Call this at service boot **before** the HTTP layer accepts traffic.
/// If any plaintext is detected, returns [`GuardrailError::PlaintextDetected`]
/// and the service should exit non-zero.
///
/// # Errors
///
/// Returns [`GuardrailError::Database`] for connection / query failures.
/// Returns [`GuardrailError::PlaintextDetected`] for any unencrypted row.
pub async fn assert_tokens_encrypted(
    pool: &PgPool,
    specs: &[TokenColumnSpec],
) -> Result<(), GuardrailError> {
    for spec in specs {
        let rows: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {} WHERE {} IS NOT NULL AND {} IS NULL",
            spec.table, spec.text_col, spec.enc_col
        ))
        .fetch_one(pool)
        .await?;
        if rows > 0 {
            warn!(
                table = spec.table,
                text_col = spec.text_col,
                rows,
                "plaintext OAuth tokens detected — service refusing to start"
            );
            return Err(GuardrailError::PlaintextDetected {
                table: spec.table,
                text_col: spec.text_col,
                enc_col: spec.enc_col,
                rows,
            });
        }
    }
    Ok(())
}
