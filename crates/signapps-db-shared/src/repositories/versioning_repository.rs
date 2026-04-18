//! VersioningRepository -- event-sourced command log and snapshots for documents.

use crate::models::versioning::{
    AppendCommand, CreateSnapshot, DiffEntry, DocumentCommand, DocumentSnapshot,
};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for document versioning (command log + snapshots).
pub struct VersioningRepository;

impl VersioningRepository {
    // ========================================================================
    // Command log
    // ========================================================================

    /// Append a mutation command to the document command log.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    pub async fn append_command(
        pool: &PgPool,
        document_id: Uuid,
        user_id: Uuid,
        input: AppendCommand,
    ) -> Result<DocumentCommand> {
        sqlx::query_as::<_, DocumentCommand>(
            r#"INSERT INTO content.document_commands
                (document_id, user_id, command_type, target_path, before_value, after_value)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING *"#,
        )
        .bind(document_id)
        .bind(user_id)
        .bind(&input.command_type)
        .bind(&input.target_path)
        .bind(&input.before_value)
        .bind(&input.after_value)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// List commands for a document, optionally starting after a given ID.
    ///
    /// Returns up to `limit` commands ordered by ascending ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    pub async fn list_commands(
        pool: &PgPool,
        document_id: Uuid,
        since_id: Option<i64>,
        limit: i64,
    ) -> Result<Vec<DocumentCommand>> {
        let since = since_id.unwrap_or(0);
        sqlx::query_as::<_, DocumentCommand>(
            r#"SELECT * FROM content.document_commands
               WHERE document_id = $1 AND id > $2
               ORDER BY id ASC
               LIMIT $3"#,
        )
        .bind(document_id)
        .bind(since)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Count commands recorded since the last snapshot was taken.
    ///
    /// If no snapshot exists, counts all commands for the document.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    pub async fn count_commands_since_snapshot(
        pool: &PgPool,
        document_id: Uuid,
    ) -> Result<i64> {
        let row: (i64,) = sqlx::query_as(
            r#"SELECT COUNT(*)
               FROM content.document_commands c
               WHERE c.document_id = $1
                 AND c.created_at > COALESCE(
                     (SELECT MAX(s.created_at)
                      FROM content.document_snapshots s
                      WHERE s.document_id = $1),
                     '1970-01-01T00:00:00Z'::timestamptz
                 )"#,
        )
        .bind(document_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(row.0)
    }

    /// Fetch the last command issued by a specific user on a document.
    ///
    /// The caller can use the returned `before_value` to apply an undo.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure or `Error::NotFound` when
    /// no command exists for this user on the document.
    pub async fn undo_last_command(
        pool: &PgPool,
        document_id: Uuid,
        user_id: Uuid,
    ) -> Result<DocumentCommand> {
        sqlx::query_as::<_, DocumentCommand>(
            r#"SELECT * FROM content.document_commands
               WHERE document_id = $1 AND user_id = $2
               ORDER BY id DESC
               LIMIT 1"#,
        )
        .bind(document_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound("No command found for this user on this document".into()))
    }

    /// Delete commands with IDs strictly less than `before_id` for a document.
    ///
    /// Typically called after creating a snapshot to reclaim storage.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    pub async fn compact_commands(
        pool: &PgPool,
        document_id: Uuid,
        before_id: i64,
    ) -> Result<u64> {
        let result = sqlx::query(
            r#"DELETE FROM content.document_commands
               WHERE document_id = $1 AND id < $2"#,
        )
        .bind(document_id)
        .bind(before_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result.rows_affected())
    }

    // ========================================================================
    // Snapshots
    // ========================================================================

    /// Create a new snapshot with an auto-incremented version number.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure or constraint violations.
    pub async fn create_snapshot(
        pool: &PgPool,
        document_id: Uuid,
        user_id: Uuid,
        input: CreateSnapshot,
    ) -> Result<DocumentSnapshot> {
        sqlx::query_as::<_, DocumentSnapshot>(
            r#"INSERT INTO content.document_snapshots
                (document_id, version, content, label, created_by)
               VALUES (
                   $1,
                   (SELECT COALESCE(MAX(version), 0) + 1
                    FROM content.document_snapshots
                    WHERE document_id = $1),
                   $2, $3, $4
               )
               RETURNING *"#,
        )
        .bind(document_id)
        .bind(&input.content)
        .bind(&input.label)
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// List all snapshots for a document, most recent first.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    pub async fn list_snapshots(
        pool: &PgPool,
        document_id: Uuid,
    ) -> Result<Vec<DocumentSnapshot>> {
        sqlx::query_as::<_, DocumentSnapshot>(
            r#"SELECT * FROM content.document_snapshots
               WHERE document_id = $1
               ORDER BY version DESC"#,
        )
        .bind(document_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Fetch a single snapshot by its ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure or `Error::NotFound` when
    /// the snapshot does not exist.
    pub async fn get_snapshot(
        pool: &PgPool,
        snapshot_id: Uuid,
    ) -> Result<DocumentSnapshot> {
        sqlx::query_as::<_, DocumentSnapshot>(
            "SELECT * FROM content.document_snapshots WHERE id = $1",
        )
        .bind(snapshot_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Snapshot {snapshot_id} not found")))
    }

    /// Fetch the most recent snapshot for a document.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure or `Error::NotFound` when
    /// no snapshot exists for the document.
    pub async fn get_latest_snapshot(
        pool: &PgPool,
        document_id: Uuid,
    ) -> Result<DocumentSnapshot> {
        sqlx::query_as::<_, DocumentSnapshot>(
            r#"SELECT * FROM content.document_snapshots
               WHERE document_id = $1
               ORDER BY version DESC
               LIMIT 1"#,
        )
        .bind(document_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| {
            Error::NotFound(format!("No snapshot found for document {document_id}"))
        })
    }

    /// Return the content of a specific snapshot for restore purposes.
    ///
    /// The caller is responsible for applying the restored content to the
    /// live document (e.g. via Yjs state replacement).
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure or `Error::NotFound` when
    /// the snapshot does not exist.
    pub async fn restore_snapshot(
        pool: &PgPool,
        _document_id: Uuid,
        snapshot_id: Uuid,
    ) -> Result<DocumentSnapshot> {
        Self::get_snapshot(pool, snapshot_id).await
    }

    /// Compute a top-level JSON diff between two snapshots.
    ///
    /// Compares the JSONB content of snapshot A and snapshot B key-by-key
    /// at the top level. Returns a list of diff entries indicating added,
    /// removed, or changed keys.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure or `Error::NotFound` when
    /// either snapshot does not exist.
    pub async fn diff_snapshots(
        pool: &PgPool,
        snapshot_id_a: Uuid,
        snapshot_id_b: Uuid,
    ) -> Result<Vec<DiffEntry>> {
        let snap_a = Self::get_snapshot(pool, snapshot_id_a).await?;
        let snap_b = Self::get_snapshot(pool, snapshot_id_b).await?;

        let obj_a = snap_a
            .content
            .as_object()
            .cloned()
            .unwrap_or_default();
        let obj_b = snap_b
            .content
            .as_object()
            .cloned()
            .unwrap_or_default();

        let mut entries = Vec::new();

        // Keys in A but not in B => removed
        for (key, val_a) in &obj_a {
            match obj_b.get(key) {
                None => {
                    entries.push(DiffEntry {
                        path: key.clone(),
                        change_type: "removed".to_string(),
                        old_value: Some(val_a.clone()),
                        new_value: None,
                    });
                }
                Some(val_b) if val_a != val_b => {
                    entries.push(DiffEntry {
                        path: key.clone(),
                        change_type: "changed".to_string(),
                        old_value: Some(val_a.clone()),
                        new_value: Some(val_b.clone()),
                    });
                }
                _ => {}
            }
        }

        // Keys in B but not in A => added
        for (key, val_b) in &obj_b {
            if !obj_a.contains_key(key) {
                entries.push(DiffEntry {
                    path: key.clone(),
                    change_type: "added".to_string(),
                    old_value: None,
                    new_value: Some(val_b.clone()),
                });
            }
        }

        // Sort for deterministic output
        entries.sort_by(|a, b| a.path.cmp(&b.path));

        Ok(entries)
    }
}
