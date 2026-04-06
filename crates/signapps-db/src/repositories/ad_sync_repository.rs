// crates/signapps-db/src/repositories/ad_sync_repository.rs
//! Repository for AD sync queue and AD object CRUD.
//!
//! Provides three focused repositories:
//! - [`AdSyncQueueRepository`] — dequeue/mark/enqueue events
//! - [`AdOuRepository`] — CRUD for AD Organizational Units
//! - [`AdUserAccountRepository`] — CRUD for AD User Accounts

use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::ad_sync::{AdOu, AdSyncEvent, AdUserAccount};

// ── Sync Queue ────────────────────────────────────────────────────────────────

/// Repository for the AD sync event queue (`ad_sync_queue` table).
///
/// Events are inserted by PostgreSQL triggers on `core.org_nodes` and
/// `core.assignments`. Workers call [`Self::dequeue`] in a loop, process each
/// event, then call [`Self::mark_completed`] or [`Self::mark_retry`].
pub struct AdSyncQueueRepository;

impl AdSyncQueueRepository {
    /// Dequeue up to `batch_size` pending events (oldest first, by priority).
    ///
    /// Uses `FOR UPDATE SKIP LOCKED` to allow multiple worker instances.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    ///
    /// # Examples
    ///
    /// ```rust,ignore
    /// let events = AdSyncQueueRepository::dequeue(&pool, 10).await?;
    /// ```
    #[tracing::instrument(skip(pool))]
    pub async fn dequeue(pool: &PgPool, batch_size: i64) -> Result<Vec<AdSyncEvent>> {
        let events = sqlx::query_as::<_, AdSyncEvent>(
            r#"UPDATE ad_sync_queue
               SET status = 'processing'
               WHERE id IN (
                   SELECT id FROM ad_sync_queue
                   WHERE status IN ('pending', 'retry')
                     AND (next_retry_at IS NULL OR next_retry_at <= now())
                   ORDER BY priority ASC, created_at ASC
                   LIMIT $1
                   FOR UPDATE SKIP LOCKED
               )
               RETURNING *"#,
        )
        .bind(batch_size)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(events)
    }

    /// Mark an event as successfully completed.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the update fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    #[tracing::instrument(skip(pool))]
    pub async fn mark_completed(pool: &PgPool, event_id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE ad_sync_queue \
             SET status = 'completed', processed_at = now() \
             WHERE id = $1",
        )
        .bind(event_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Mark an event for retry with exponential backoff.
    ///
    /// Transitions to `dead` when `attempts >= max_attempts`.
    /// Backoff: `5 * 2^attempts` seconds (capped at attempt 10).
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the update fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    #[tracing::instrument(skip(pool))]
    pub async fn mark_retry(pool: &PgPool, event_id: Uuid, error: &str) -> Result<()> {
        sqlx::query(
            r#"UPDATE ad_sync_queue SET
                status = CASE WHEN attempts + 1 >= max_attempts THEN 'dead' ELSE 'retry' END,
                attempts = attempts + 1,
                error_message = $2,
                next_retry_at = now() + make_interval(secs => power(2, LEAST(attempts + 1, 10)) * 5)
            WHERE id = $1"#,
        )
        .bind(event_id)
        .bind(error)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Enqueue a new sync event manually (triggers do this automatically for org changes).
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the insert fails.
    ///
    /// # Examples
    ///
    /// ```rust,ignore
    /// let id = AdSyncQueueRepository::enqueue(
    ///     &pool,
    ///     domain_id,
    ///     "ou_create",
    ///     serde_json::json!({ "node_id": node_id }),
    ///     3,
    /// ).await?;
    /// ```
    #[tracing::instrument(skip(pool, payload))]
    pub async fn enqueue(
        pool: &PgPool,
        domain_id: Uuid,
        event_type: &str,
        payload: serde_json::Value,
        priority: i32,
    ) -> Result<Uuid> {
        let (id,): (Uuid,) = sqlx::query_as(
            r#"INSERT INTO ad_sync_queue (domain_id, event_type, payload, priority)
               VALUES ($1, $2, $3, $4) RETURNING id"#,
        )
        .bind(domain_id)
        .bind(event_type)
        .bind(&payload)
        .bind(priority)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(id)
    }

    /// Get queue statistics for a domain.
    ///
    /// Returns a JSON object with counts per status.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    #[tracing::instrument(skip(pool))]
    pub async fn stats(pool: &PgPool, domain_id: Uuid) -> Result<serde_json::Value> {
        let row: (i64, i64, i64, i64, i64) = sqlx::query_as(
            r#"SELECT
                COUNT(*) FILTER (WHERE status = 'pending'),
                COUNT(*) FILTER (WHERE status = 'processing'),
                COUNT(*) FILTER (WHERE status = 'completed'),
                COUNT(*) FILTER (WHERE status = 'failed' OR status = 'dead'),
                COUNT(*) FILTER (WHERE status = 'retry')
            FROM ad_sync_queue WHERE domain_id = $1"#,
        )
        .bind(domain_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(serde_json::json!({
            "pending": row.0,
            "processing": row.1,
            "completed": row.2,
            "failed": row.3,
            "retry": row.4,
        }))
    }
}

// ── AD OUs ────────────────────────────────────────────────────────────────────

/// Repository for AD Organizational Units (`ad_ous` table).
///
/// Each OU maps one-to-one to a `core.org_nodes` row within a domain.
/// The `distinguished_name` follows RFC 4514 format.
pub struct AdOuRepository;

impl AdOuRepository {
    /// Create an AD OU mapping for an org node.
    ///
    /// Sets `sync_status = 'synced'` on creation.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on constraint violations (duplicate `(domain_id, node_id)`).
    ///
    /// # Examples
    ///
    /// ```rust,ignore
    /// let ou = AdOuRepository::create(&pool, domain_id, node_id, "OU=HR,DC=corp,DC=local", None).await?;
    /// ```
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    #[tracing::instrument(skip(pool))]
    pub async fn create(
        pool: &PgPool,
        domain_id: Uuid,
        node_id: Uuid,
        distinguished_name: &str,
        parent_ou_id: Option<Uuid>,
    ) -> Result<AdOu> {
        let ou = sqlx::query_as::<_, AdOu>(
            r#"INSERT INTO ad_ous (domain_id, node_id, distinguished_name, parent_ou_id, sync_status)
               VALUES ($1, $2, $3, $4, 'synced')
               RETURNING *"#,
        )
        .bind(domain_id)
        .bind(node_id)
        .bind(distinguished_name)
        .bind(parent_ou_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(ou)
    }

    /// Find OU by org node within a domain.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    #[tracing::instrument(skip(pool))]
    pub async fn find_by_node(
        pool: &PgPool,
        domain_id: Uuid,
        node_id: Uuid,
    ) -> Result<Option<AdOu>> {
        let ou = sqlx::query_as::<_, AdOu>(
            "SELECT * FROM ad_ous WHERE domain_id = $1 AND node_id = $2",
        )
        .bind(domain_id)
        .bind(node_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(ou)
    }

    /// List all OUs for a domain, ordered by distinguished name.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    #[tracing::instrument(skip(pool))]
    pub async fn list_by_domain(pool: &PgPool, domain_id: Uuid) -> Result<Vec<AdOu>> {
        let ous = sqlx::query_as::<_, AdOu>(
            "SELECT * FROM ad_ous WHERE domain_id = $1 ORDER BY distinguished_name",
        )
        .bind(domain_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(ous)
    }

    /// Delete an OU mapping by id.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the delete fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    #[tracing::instrument(skip(pool))]
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM ad_ous WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}

// ── AD User Accounts ──────────────────────────────────────────────────────────

/// Repository for AD User Accounts (`ad_user_accounts` table).
///
/// Each user account maps one-to-one to a `core.persons` row within a domain.
pub struct AdUserAccountRepository;

impl AdUserAccountRepository {
    /// Create an AD user account for a provisioned person.
    ///
    /// Sets `sync_status = 'synced'` on creation.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on constraint violations
    /// (duplicate `(domain_id, sam_account_name)` or `(domain_id, person_id)`).
    ///
    /// # Examples
    ///
    /// ```rust,ignore
    /// let account = AdUserAccountRepository::create(
    ///     &pool, domain_id, person_id, Some(ou_id),
    ///     "j.dupont", "j.dupont@corp.local", "CN=Jean Dupont,OU=HR,DC=corp,DC=local",
    ///     "Jean Dupont", Some("Developer"), Some("IT"), Some("j.dupont@corp.local"), Some(domain_id),
    /// ).await?;
    /// ```
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    #[allow(clippy::too_many_arguments)]
    #[tracing::instrument(skip(pool))]
    pub async fn create(
        pool: &PgPool,
        domain_id: Uuid,
        person_id: Uuid,
        ou_id: Option<Uuid>,
        sam_account_name: &str,
        user_principal_name: &str,
        distinguished_name: &str,
        display_name: &str,
        title: Option<&str>,
        department: Option<&str>,
        mail: Option<&str>,
        mail_domain_id: Option<Uuid>,
    ) -> Result<AdUserAccount> {
        let user = sqlx::query_as::<_, AdUserAccount>(
            r#"INSERT INTO ad_user_accounts (
                domain_id, person_id, ou_id, sam_account_name, user_principal_name,
                distinguished_name, display_name, title, department, mail, mail_domain_id,
                sync_status
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'synced')
            RETURNING *"#,
        )
        .bind(domain_id)
        .bind(person_id)
        .bind(ou_id)
        .bind(sam_account_name)
        .bind(user_principal_name)
        .bind(distinguished_name)
        .bind(display_name)
        .bind(title)
        .bind(department)
        .bind(mail)
        .bind(mail_domain_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(user)
    }

    /// Find an AD user account by person within a domain.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    #[tracing::instrument(skip(pool))]
    pub async fn find_by_person(
        pool: &PgPool,
        domain_id: Uuid,
        person_id: Uuid,
    ) -> Result<Option<AdUserAccount>> {
        let user = sqlx::query_as::<_, AdUserAccount>(
            "SELECT * FROM ad_user_accounts WHERE domain_id = $1 AND person_id = $2",
        )
        .bind(domain_id)
        .bind(person_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(user)
    }

    /// List all enabled user accounts for a domain, ordered by display name.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    #[tracing::instrument(skip(pool))]
    pub async fn list_enabled(pool: &PgPool, domain_id: Uuid) -> Result<Vec<AdUserAccount>> {
        let users = sqlx::query_as::<_, AdUserAccount>(
            "SELECT * FROM ad_user_accounts \
             WHERE domain_id = $1 AND is_enabled = true \
             ORDER BY display_name",
        )
        .bind(domain_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(users)
    }

    /// Disable a user account (sets `is_enabled = false`, `sync_status = 'disabled'`).
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the update fails.
    ///
    /// # Panics
    ///
    /// No panics possible — all errors are propagated via `Result`.
    #[tracing::instrument(skip(pool))]
    pub async fn disable(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE ad_user_accounts \
             SET is_enabled = false, sync_status = 'disabled', updated_at = now() \
             WHERE id = $1",
        )
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    /// Compilation smoke test — repository structs are zero-size unit types.
    #[test]
    fn repositories_are_unit_types() {
        use super::{AdOuRepository, AdSyncQueueRepository, AdUserAccountRepository};
        // Zero-size: stack allocation is a no-op
        let _q = std::mem::size_of::<AdSyncQueueRepository>();
        let _o = std::mem::size_of::<AdOuRepository>();
        let _u = std::mem::size_of::<AdUserAccountRepository>();
        assert_eq!(std::mem::size_of::<AdSyncQueueRepository>(), 0);
        assert_eq!(std::mem::size_of::<AdOuRepository>(), 0);
        assert_eq!(std::mem::size_of::<AdUserAccountRepository>(), 0);
    }
}
