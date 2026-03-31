//! Forensic audit chain: SHA-256 linked log entries for drive operations.

use sha2::{Digest, Sha256};
use signapps_common::{Error, Result};
use signapps_db::models::drive_acl::ChainVerification;
use sqlx::PgPool;
use uuid::Uuid;

/// Compute a SHA-256 hash for a single chain link.
///
/// The hash covers: previous hash, action, actor UUID, optional node UUID,
/// and the Unix timestamp (seconds).  Changing any field invalidates the
/// chain from this entry onwards.
fn compute_hash(prev: &str, action: &str, actor: &Uuid, node: Option<&Uuid>, ts: i64) -> String {
    let mut hasher = Sha256::new();
    hasher.update(prev.as_bytes());
    hasher.update(action.as_bytes());
    hasher.update(actor.to_string().as_bytes());
    if let Some(n) = node {
        hasher.update(n.to_string().as_bytes());
    }
    hasher.update(ts.to_string().as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Append a new forensic audit event to the drive audit log.
///
/// This function:
/// 1. Fetches the `log_hash` of the most recent entry (or uses `"GENESIS"`).
/// 2. Computes a new SHA-256 hash chaining the previous hash.
/// 3. Inserts the new entry atomically.
#[allow(clippy::too_many_arguments)]
pub async fn log_audit(
    pool: &PgPool,
    node_id: Option<Uuid>,
    node_path: &str,
    action: &str,
    actor_id: Uuid,
    actor_ip: Option<&str>,
    file_hash: Option<&str>,
    details: Option<serde_json::Value>,
) -> Result<()> {
    // Fetch the most recent chain hash (or genesis sentinel)
    let prev_hash: String =
        sqlx::query_scalar("SELECT log_hash FROM drive.audit_log ORDER BY created_at DESC LIMIT 1")
            .fetch_optional(pool)
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| "GENESIS".into());

    let now = chrono::Utc::now();
    let log_hash = compute_hash(
        &prev_hash,
        action,
        &actor_id,
        node_id.as_ref(),
        now.timestamp(),
    );

    sqlx::query(
        r#"INSERT INTO drive.audit_log
               (node_id, node_path, action, actor_id, actor_ip, actor_geo,
                file_hash, details, prev_log_hash, log_hash, created_at)
           VALUES ($1, $2, $3::drive.audit_action, $4, $5::inet, $6,
                   $7, $8, $9, $10, $11)"#,
    )
    .bind(node_id)
    .bind(node_path)
    .bind(action)
    .bind(actor_id)
    .bind(actor_ip)
    .bind(Option::<String>::None) // geo-lookup placeholder (TODO)
    .bind(file_hash)
    .bind(details)
    .bind(&prev_hash)
    .bind(&log_hash)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| Error::Database(format!("Audit log insert failed: {e}")))?;

    Ok(())
}

/// Verify the integrity of the entire audit chain.
///
/// Iterates through every entry in chronological order, recomputing each
/// hash and verifying it matches the stored value.  Also checks that each
/// entry's `prev_log_hash` points to the immediately preceding entry.
///
/// Returns [`ChainVerification`] indicating whether the chain is intact and,
/// if not, the index of the first corrupted entry.
pub async fn verify_chain(pool: &PgPool) -> Result<ChainVerification> {
    // Fetch all entries ordered oldest-first for sequential verification
    let logs: Vec<(String, Option<String>, String, Uuid, Option<Uuid>, i64)> = sqlx::query_as(
        r#"SELECT log_hash,
                      prev_log_hash,
                      action::text,
                      actor_id,
                      node_id,
                      EXTRACT(EPOCH FROM created_at)::bigint
               FROM drive.audit_log
               ORDER BY created_at ASC"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    let total = logs.len() as i64;
    let mut expected_prev = "GENESIS".to_string();

    for (i, (stored_hash, prev, action, actor, node, ts)) in logs.iter().enumerate() {
        // Verify the back-link is correct
        let prev_str = prev.as_deref().unwrap_or("GENESIS");
        if prev_str != expected_prev {
            return Ok(ChainVerification {
                valid: false,
                total_entries: total,
                first_corrupt_index: Some(i as i64),
            });
        }

        // Recompute and compare
        let recomputed = compute_hash(&expected_prev, action, actor, node.as_ref(), *ts);
        if recomputed != *stored_hash {
            return Ok(ChainVerification {
                valid: false,
                total_entries: total,
                first_corrupt_index: Some(i as i64),
            });
        }

        expected_prev = stored_hash.clone();
    }

    Ok(ChainVerification {
        valid: true,
        total_entries: total,
        first_corrupt_index: None,
    })
}

// ============================================================================
// Unit tests (pure, no DB)
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compute_hash_is_deterministic() {
        let actor = Uuid::new_v4();
        let node = Uuid::new_v4();
        let h1 = compute_hash("GENESIS", "upload", &actor, Some(&node), 1_700_000_000);
        let h2 = compute_hash("GENESIS", "upload", &actor, Some(&node), 1_700_000_000);
        assert_eq!(h1, h2);
    }

    #[test]
    fn compute_hash_differs_on_action_change() {
        let actor = Uuid::new_v4();
        let h1 = compute_hash("GENESIS", "upload", &actor, None, 1_000);
        let h2 = compute_hash("GENESIS", "delete", &actor, None, 1_000);
        assert_ne!(h1, h2);
    }

    #[test]
    fn compute_hash_differs_on_prev_change() {
        let actor = Uuid::new_v4();
        let h1 = compute_hash("GENESIS", "view", &actor, None, 1_000);
        let h2 = compute_hash("DIFFERENT", "view", &actor, None, 1_000);
        assert_ne!(h1, h2);
    }

    #[test]
    fn compute_hash_output_is_hex_string_of_64_chars() {
        let actor = Uuid::new_v4();
        let h = compute_hash("GENESIS", "upload", &actor, None, 0);
        assert_eq!(h.len(), 64, "SHA-256 hex is always 64 characters");
        assert!(h.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn node_none_vs_some_produce_different_hashes() {
        let actor = Uuid::new_v4();
        let node = Uuid::new_v4();
        let h_none = compute_hash("GENESIS", "upload", &actor, None, 1_000);
        let h_some = compute_hash("GENESIS", "upload", &actor, Some(&node), 1_000);
        assert_ne!(h_none, h_some);
    }
}
