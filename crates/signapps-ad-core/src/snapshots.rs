// crates/signapps-ad-core/src/snapshots.rs
//! AD snapshot creation, listing, and granular restore operations.
//!
//! A snapshot captures the full state of all AD tables for a domain at a
//! point in time. Snapshots are stored as JSON files on disk and indexed
//! with a JSONB manifest for O(1) DN-based lookup during restore.
//!
//! ## Snapshot types and retention
//!
//! | Type | Retention |
//! |------|-----------|
//! | `full` | 30 days |
//! | `incremental` | 7 days |
//! | `pre_migration` | 90 days |
//! | `pre_restore` | 90 days |
//!
//! ## Restore workflow
//!
//! ```text
//! restore_preview(snapshot_id, target_dn) → RestorePreview
//! → review diff
//! → restore_execute(snapshot_id, target_dn) → RestoreReport
//! ```

use sha2::{Digest, Sha256};
use signapps_common::{Error, Result};
use signapps_db::models::ad_sync::AdSnapshot;
use sqlx::PgPool;
use uuid::Uuid;

// ── Public types ──────────────────────────────────────────────────────────────

/// Summary of changes that *would* occur if a restore were executed.
///
/// Returned by [`restore_preview`] before the admin confirms the operation.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RestorePreview {
    /// The snapshot being previewed.
    pub snapshot_id: Uuid,
    /// Optional DN scope — `None` means the entire domain.
    pub target_dn: Option<String>,
    /// Objects present in snapshot but missing from current state (would be created).
    pub objects_to_create: Vec<RestoreItem>,
    /// Objects present in both snapshot and current state (would be updated).
    pub objects_to_update: Vec<RestoreItem>,
    /// Total object count that would be affected.
    pub total_affected: usize,
}

/// A single object in a restore preview or report.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RestoreItem {
    /// The object's distinguished name.
    pub dn: String,
    /// Object type: `ou`, `user`, `computer`, or `group`.
    pub object_type: String,
    /// Source table in the database.
    pub table_name: String,
    /// Row UUID in the snapshot.
    pub row_id: Uuid,
}

/// Report of what was actually restored.
///
/// Returned by [`restore_execute`] after the operation completes.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RestoreReport {
    /// The snapshot that was used for the restore.
    pub snapshot_id: Uuid,
    /// Number of objects successfully restored (created or updated).
    pub objects_restored: usize,
    /// Number of objects skipped (e.g., row not found in snapshot data).
    pub objects_skipped: usize,
    /// ID of the pre-restore snapshot created before the operation.
    pub pre_restore_snapshot_id: Uuid,
}

// ── Snapshot creation ─────────────────────────────────────────────────────────

/// Create a snapshot of all AD tables for a domain.
///
/// Steps:
/// 1. Insert an `ad_snapshots` row with `status = 'creating'`.
/// 2. Query all five AD tables for this domain.
/// 3. Serialize to JSON and write to `data/snapshots/{domain_id}/{snapshot_id}.json`.
/// 4. Build a JSONB manifest indexed by distinguished name.
/// 5. Compute SHA-256 of the file contents.
/// 6. Update the record to `status = 'completed'` with metadata.
///
/// # Errors
///
/// Returns `Error::Database` if any query or update fails.
/// Returns `Error::Internal` if file I/O or serialization fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,no_run
/// use uuid::Uuid;
/// use signapps_ad_core::snapshots::create_snapshot;
///
/// # async fn example(pool: &sqlx::PgPool, domain_id: Uuid) -> signapps_common::Result<()> {
/// let snapshot = create_snapshot(pool, domain_id, "full").await?;
/// assert_eq!(snapshot.status, "completed");
/// # Ok(())
/// # }
/// ```
#[tracing::instrument(skip(pool))]
pub async fn create_snapshot(
    pool: &PgPool,
    domain_id: Uuid,
    snapshot_type: &str,
) -> Result<AdSnapshot> {
    let snapshot_id = Uuid::new_v4();
    let storage_path = format!("data/snapshots/{domain_id}/{snapshot_id}.json");

    // 1. Insert placeholder record (we only need the id confirmation — final record fetched later)
    let _placeholder: AdSnapshot = sqlx::query_as(
        r#"
        INSERT INTO ad_snapshots
            (id, domain_id, snapshot_type, storage_path, status)
        VALUES ($1, $2, $3, $4, 'creating')
        RETURNING *
        "#,
    )
    .bind(snapshot_id)
    .bind(domain_id)
    .bind(snapshot_type)
    .bind(&storage_path)
    .fetch_one(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    tracing::info!(
        snapshot_id = %snapshot_id,
        domain_id = %domain_id,
        snapshot_type = %snapshot_type,
        "Snapshot record created"
    );

    // 2. Collect data from all AD tables
    let data = collect_snapshot_data(pool, domain_id).await?;

    // 3. Serialize to JSON
    let json_bytes = serde_json::to_vec_pretty(&data)
        .map_err(|e| Error::Internal(format!("Snapshot serialization failed: {e}")))?;

    // 4. Write to storage path
    write_snapshot_file(&storage_path, &json_bytes).await?;

    // 5. Compute SHA-256
    let checksum = compute_sha256(&json_bytes);

    // 6. Build manifest
    let manifest = build_manifest(&data);

    // 7. Compute expiry
    let expires_at = compute_expiry(snapshot_type);

    // 8. Finalize the record
    let tables_included = vec![
        "ad_ous",
        "ad_user_accounts",
        "ad_computer_accounts",
        "ad_security_groups",
        "ad_group_members",
    ];

    let final_snapshot: AdSnapshot = sqlx::query_as(
        r#"
        UPDATE ad_snapshots
        SET status = 'completed',
            size_bytes = $1,
            checksum_sha256 = $2,
            manifest = $3,
            tables_included = $4,
            expires_at = $5
        WHERE id = $6
        RETURNING *
        "#,
    )
    .bind(i64::try_from(json_bytes.len()).unwrap_or(i64::MAX))
    .bind(&checksum)
    .bind(&manifest)
    .bind(&tables_included)
    .bind(expires_at)
    .bind(snapshot_id)
    .fetch_one(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    tracing::info!(
        snapshot_id = %snapshot_id,
        size_bytes = json_bytes.len(),
        checksum = %checksum,
        "Snapshot completed"
    );

    Ok(final_snapshot)
}

/// List all snapshots for a domain, newest first.
///
/// # Errors
///
/// Returns `Error::Database` if the query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,no_run
/// use uuid::Uuid;
/// use signapps_ad_core::snapshots::list_snapshots;
///
/// # async fn example(pool: &sqlx::PgPool, domain_id: Uuid) -> signapps_common::Result<()> {
/// let snapshots = list_snapshots(pool, domain_id).await?;
/// println!("Found {} snapshots", snapshots.len());
/// # Ok(())
/// # }
/// ```
#[tracing::instrument(skip(pool))]
pub async fn list_snapshots(pool: &PgPool, domain_id: Uuid) -> Result<Vec<AdSnapshot>> {
    let snapshots: Vec<AdSnapshot> =
        sqlx::query_as("SELECT * FROM ad_snapshots WHERE domain_id = $1 ORDER BY created_at DESC")
            .bind(domain_id)
            .fetch_all(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

    Ok(snapshots)
}

// ── Restore ───────────────────────────────────────────────────────────────────

/// Preview what would change if a restore were executed.
///
/// Compares the snapshot manifest against the current database state to
/// build a list of objects that would be created or updated.
///
/// # Arguments
///
/// - `pool`: Database connection pool.
/// - `snapshot_id`: The snapshot to restore from.
/// - `target_dn`: Limit the preview to a specific DN subtree. `None` = entire domain.
/// - `include_children`: When `target_dn` is set, whether to include
///   objects whose DN contains `target_dn` as a suffix.
///
/// # Errors
///
/// Returns `Error::NotFound` if the snapshot does not exist or has no manifest.
/// Returns `Error::Database` if any query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,no_run
/// use uuid::Uuid;
/// use signapps_ad_core::snapshots::restore_preview;
///
/// # async fn example(pool: &sqlx::PgPool, snapshot_id: Uuid) -> signapps_common::Result<()> {
/// let preview = restore_preview(pool, snapshot_id, Some("OU=DRH,DC=corp,DC=local"), true).await?;
/// println!("{} objects would be restored", preview.total_affected);
/// # Ok(())
/// # }
/// ```
#[tracing::instrument(skip(pool))]
pub async fn restore_preview(
    pool: &PgPool,
    snapshot_id: Uuid,
    target_dn: Option<&str>,
    include_children: bool,
) -> Result<RestorePreview> {
    let snapshot = load_snapshot_record(pool, snapshot_id).await?;
    let items = filter_manifest_items(&snapshot.manifest, target_dn, include_children);

    let mut objects_to_create = Vec::new();
    let mut objects_to_update = Vec::new();

    for item in items {
        let exists = check_object_exists(pool, &item.table_name, item.row_id).await?;
        if exists {
            objects_to_update.push(item);
        } else {
            objects_to_create.push(item);
        }
    }

    let total_affected = objects_to_create.len() + objects_to_update.len();

    Ok(RestorePreview {
        snapshot_id,
        target_dn: target_dn.map(str::to_owned),
        objects_to_create,
        objects_to_update,
        total_affected,
    })
}

/// Execute a granular restore from a snapshot.
///
/// Steps:
/// 1. Create a `pre_restore` snapshot of the current state.
/// 2. Load the manifest from the source snapshot.
/// 3. Filter by `target_dn` and `include_children` if specified.
/// 4. Load the snapshot data file and upsert each matching object.
/// 5. Return a [`RestoreReport`] with counts.
///
/// # Errors
///
/// Returns `Error::NotFound` if the snapshot does not exist.
/// Returns `Error::Internal` if the snapshot file cannot be read or parsed.
/// Returns `Error::Database` if any upsert fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,no_run
/// use uuid::Uuid;
/// use signapps_ad_core::snapshots::restore_execute;
///
/// # async fn example(pool: &sqlx::PgPool, snapshot_id: Uuid) -> signapps_common::Result<()> {
/// let report = restore_execute(pool, snapshot_id, None, false).await?;
/// println!("Restored {} objects", report.objects_restored);
/// # Ok(())
/// # }
/// ```
#[tracing::instrument(skip(pool))]
pub async fn restore_execute(
    pool: &PgPool,
    snapshot_id: Uuid,
    target_dn: Option<&str>,
    include_children: bool,
) -> Result<RestoreReport> {
    let snapshot = load_snapshot_record(pool, snapshot_id).await?;

    // 1. Create a pre-restore safety snapshot
    let pre_restore = create_snapshot(pool, snapshot.domain_id, "pre_restore").await?;

    tracing::info!(
        pre_restore_id = %pre_restore.id,
        source_snapshot_id = %snapshot_id,
        "Pre-restore snapshot created"
    );

    // 2 & 3. Load filtered manifest items
    let items = filter_manifest_items(&snapshot.manifest, target_dn, include_children);

    // 4. Load the snapshot data file
    let file_data = read_snapshot_file(&snapshot.storage_path).await?;
    let snapshot_data: SnapshotData = serde_json::from_slice(&file_data)
        .map_err(|e| Error::Internal(format!("Failed to parse snapshot file: {e}")))?;

    let mut objects_restored: usize = 0;
    let mut objects_skipped: usize = 0;

    // 5. Upsert each object
    for item in &items {
        let result =
            restore_single_object(pool, &item.table_name, item.row_id, &snapshot_data).await;
        match result {
            Ok(true) => objects_restored += 1,
            Ok(false) => objects_skipped += 1,
            Err(e) => {
                tracing::warn!(
                    dn = %item.dn,
                    table = %item.table_name,
                    row_id = %item.row_id,
                    error = %e,
                    "Object restore failed — skipping"
                );
                objects_skipped += 1;
            },
        }
    }

    tracing::info!(
        snapshot_id = %snapshot_id,
        objects_restored = objects_restored,
        objects_skipped = objects_skipped,
        "Restore completed"
    );

    Ok(RestoreReport {
        snapshot_id,
        objects_restored,
        objects_skipped,
        pre_restore_snapshot_id: pre_restore.id,
    })
}

// ── Internal data structures ──────────────────────────────────────────────────

/// Full snapshot data written to disk.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct SnapshotData {
    ous: Vec<serde_json::Value>,
    user_accounts: Vec<serde_json::Value>,
    computer_accounts: Vec<serde_json::Value>,
    security_groups: Vec<serde_json::Value>,
    group_members: Vec<serde_json::Value>,
    metadata: SnapshotMetadata,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct SnapshotMetadata {
    domain_id: Uuid,
    captured_at: chrono::DateTime<chrono::Utc>,
    object_counts: ObjectCounts,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct ObjectCounts {
    ous: usize,
    user_accounts: usize,
    computer_accounts: usize,
    security_groups: usize,
    group_members: usize,
}

// ── Private helpers ───────────────────────────────────────────────────────────

/// Query all AD tables for a domain and return combined snapshot data.
async fn collect_snapshot_data(pool: &PgPool, domain_id: Uuid) -> Result<SnapshotData> {
    let ous: Vec<serde_json::Value> = sqlx::query_scalar(
        "SELECT row_to_json(t)::jsonb FROM (SELECT * FROM ad_ous WHERE domain_id = $1) t",
    )
    .bind(domain_id)
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    let user_accounts: Vec<serde_json::Value> = sqlx::query_scalar(
        "SELECT row_to_json(t)::jsonb FROM (SELECT * FROM ad_user_accounts WHERE domain_id = $1) t",
    )
    .bind(domain_id)
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    let computer_accounts: Vec<serde_json::Value> = sqlx::query_scalar(
        "SELECT row_to_json(t)::jsonb FROM (SELECT * FROM ad_computer_accounts WHERE domain_id = $1) t",
    )
    .bind(domain_id)
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    let security_groups: Vec<serde_json::Value> = sqlx::query_scalar(
        "SELECT row_to_json(t)::jsonb FROM (SELECT * FROM ad_security_groups WHERE domain_id = $1) t",
    )
    .bind(domain_id)
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    // Group members — join via security groups to filter by domain
    let group_members: Vec<serde_json::Value> = sqlx::query_scalar(
        r#"
        SELECT row_to_json(gm)::jsonb
        FROM ad_group_members gm
        JOIN ad_security_groups sg ON sg.id = gm.group_id
        WHERE sg.domain_id = $1
        "#,
    )
    .bind(domain_id)
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    let metadata = SnapshotMetadata {
        domain_id,
        captured_at: chrono::Utc::now(),
        object_counts: ObjectCounts {
            ous: ous.len(),
            user_accounts: user_accounts.len(),
            computer_accounts: computer_accounts.len(),
            security_groups: security_groups.len(),
            group_members: group_members.len(),
        },
    };

    Ok(SnapshotData {
        ous,
        user_accounts,
        computer_accounts,
        security_groups,
        group_members,
        metadata,
    })
}

/// Build the JSONB manifest indexing each object by its distinguished name.
fn build_manifest(data: &SnapshotData) -> serde_json::Value {
    let mut objects = serde_json::Map::new();

    for obj in &data.ous {
        if let (Some(dn), Some(id)) = (obj["distinguished_name"].as_str(), obj["id"].as_str()) {
            objects.insert(
                dn.to_owned(),
                serde_json::json!({
                    "type": "ou",
                    "table": "ad_ous",
                    "row_id": id
                }),
            );
        }
    }

    for obj in &data.user_accounts {
        if let (Some(dn), Some(id)) = (obj["distinguished_name"].as_str(), obj["id"].as_str()) {
            objects.insert(
                dn.to_owned(),
                serde_json::json!({
                    "type": "user",
                    "table": "ad_user_accounts",
                    "row_id": id
                }),
            );
        }
    }

    for obj in &data.computer_accounts {
        if let (Some(dn), Some(id)) = (obj["distinguished_name"].as_str(), obj["id"].as_str()) {
            objects.insert(
                dn.to_owned(),
                serde_json::json!({
                    "type": "computer",
                    "table": "ad_computer_accounts",
                    "row_id": id
                }),
            );
        }
    }

    for obj in &data.security_groups {
        if let (Some(dn), Some(id)) = (obj["distinguished_name"].as_str(), obj["id"].as_str()) {
            objects.insert(
                dn.to_owned(),
                serde_json::json!({
                    "type": "group",
                    "table": "ad_security_groups",
                    "row_id": id
                }),
            );
        }
    }

    serde_json::json!({ "objects": objects })
}

/// Extract manifest items, optionally filtered by DN scope.
fn filter_manifest_items(
    manifest: &serde_json::Value,
    target_dn: Option<&str>,
    include_children: bool,
) -> Vec<RestoreItem> {
    let objects = match manifest.get("objects").and_then(|o| o.as_object()) {
        Some(o) => o,
        None => return Vec::new(),
    };

    objects
        .iter()
        .filter_map(|(dn, entry)| {
            // Apply DN filter
            if let Some(target) = target_dn {
                let dn_upper = dn.to_uppercase();
                let target_upper = target.to_uppercase();

                let matches = if include_children {
                    // Exact match or DN ends with ,{target} (child)
                    dn_upper == target_upper || dn_upper.ends_with(&format!(",{target_upper}"))
                } else {
                    dn_upper == target_upper
                };

                if !matches {
                    return None;
                }
            }

            let object_type = entry["type"].as_str()?.to_owned();
            let table_name = entry["table"].as_str()?.to_owned();
            let row_id: Uuid = entry["row_id"].as_str()?.parse().ok()?;

            Some(RestoreItem {
                dn: dn.clone(),
                object_type,
                table_name,
                row_id,
            })
        })
        .collect()
}

/// Check whether a row exists in the given AD table by its UUID.
async fn check_object_exists(pool: &PgPool, table: &str, row_id: Uuid) -> Result<bool> {
    // Only allow known table names to prevent SQL injection
    let query = match table {
        "ad_ous" => "SELECT EXISTS(SELECT 1 FROM ad_ous WHERE id = $1)",
        "ad_user_accounts" => "SELECT EXISTS(SELECT 1 FROM ad_user_accounts WHERE id = $1)",
        "ad_computer_accounts" => "SELECT EXISTS(SELECT 1 FROM ad_computer_accounts WHERE id = $1)",
        "ad_security_groups" => "SELECT EXISTS(SELECT 1 FROM ad_security_groups WHERE id = $1)",
        "ad_group_members" => "SELECT EXISTS(SELECT 1 FROM ad_group_members WHERE id = $1)",
        _ => return Err(Error::BadRequest(format!("Unknown AD table: {table}"))),
    };

    let exists: bool = sqlx::query_scalar(query)
        .bind(row_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    Ok(exists)
}

/// Restore a single object into the database.
///
/// Returns `true` if the object was found in snapshot data and upserted,
/// `false` if the row ID was not found in the snapshot.
async fn restore_single_object(
    pool: &PgPool,
    table: &str,
    row_id: Uuid,
    data: &SnapshotData,
) -> Result<bool> {
    let source_rows: &[serde_json::Value] = match table {
        "ad_ous" => &data.ous,
        "ad_user_accounts" => &data.user_accounts,
        "ad_computer_accounts" => &data.computer_accounts,
        "ad_security_groups" => &data.security_groups,
        "ad_group_members" => &data.group_members,
        _ => return Err(Error::BadRequest(format!("Unknown AD table: {table}"))),
    };

    // Find the row in snapshot data
    let row_id_str = row_id.to_string();
    let row = source_rows
        .iter()
        .find(|r| r["id"].as_str() == Some(&row_id_str));

    let Some(row) = row else {
        tracing::warn!(row_id = %row_id, table = %table, "Row not found in snapshot data");
        return Ok(false);
    };

    // Upsert into the appropriate table
    match table {
        "ad_ous" => restore_ou(pool, row).await?,
        "ad_user_accounts" => restore_user_account(pool, row).await?,
        "ad_computer_accounts" => restore_computer_account(pool, row).await?,
        "ad_security_groups" => restore_security_group(pool, row).await?,
        "ad_group_members" => restore_group_member(pool, row).await?,
        _ => {},
    }

    Ok(true)
}

/// Upsert an OU from snapshot data.
async fn restore_ou(pool: &PgPool, row: &serde_json::Value) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO ad_ous
            (id, domain_id, node_id, distinguished_name, parent_ou_id, guid,
             mail_distribution_enabled, sync_status, last_synced_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
            distinguished_name = EXCLUDED.distinguished_name,
            parent_ou_id = EXCLUDED.parent_ou_id,
            sync_status = 'pending',
            last_synced_at = NULL
        "#,
    )
    .bind(parse_uuid(row, "id")?)
    .bind(parse_uuid(row, "domain_id")?)
    .bind(parse_uuid(row, "node_id")?)
    .bind(row["distinguished_name"].as_str().unwrap_or(""))
    .bind(parse_optional_uuid(row, "parent_ou_id"))
    .bind(row["guid"].as_str())
    .bind(row["mail_distribution_enabled"].as_bool().unwrap_or(true))
    .bind(row["sync_status"].as_str().unwrap_or("pending"))
    .bind(parse_optional_timestamp(row, "last_synced_at"))
    .bind(parse_optional_timestamp(row, "created_at").unwrap_or_else(chrono::Utc::now))
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(())
}

/// Upsert a user account from snapshot data.
async fn restore_user_account(pool: &PgPool, row: &serde_json::Value) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO ad_user_accounts
            (id, domain_id, person_id, ou_id, sam_account_name, user_principal_name,
             distinguished_name, display_name, title, department, mail, mail_domain_id,
             account_flags, object_sid, password_must_change, is_enabled,
             sync_status, last_synced_at, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        ON CONFLICT (id) DO UPDATE SET
            distinguished_name = EXCLUDED.distinguished_name,
            ou_id = EXCLUDED.ou_id,
            title = EXCLUDED.title,
            department = EXCLUDED.department,
            mail = EXCLUDED.mail,
            is_enabled = EXCLUDED.is_enabled,
            sync_status = 'pending',
            updated_at = now()
        "#,
    )
    .bind(parse_uuid(row, "id")?)
    .bind(parse_uuid(row, "domain_id")?)
    .bind(parse_uuid(row, "person_id")?)
    .bind(parse_optional_uuid(row, "ou_id"))
    .bind(row["sam_account_name"].as_str().unwrap_or(""))
    .bind(row["user_principal_name"].as_str().unwrap_or(""))
    .bind(row["distinguished_name"].as_str().unwrap_or(""))
    .bind(row["display_name"].as_str().unwrap_or(""))
    .bind(row["title"].as_str())
    .bind(row["department"].as_str())
    .bind(row["mail"].as_str())
    .bind(parse_optional_uuid(row, "mail_domain_id"))
    .bind(
        row["account_flags"]
            .as_i64()
            .map(|v| v as i32)
            .unwrap_or(512),
    )
    .bind(row["object_sid"].as_str())
    .bind(row["password_must_change"].as_bool().unwrap_or(true))
    .bind(row["is_enabled"].as_bool().unwrap_or(true))
    .bind(row["sync_status"].as_str().unwrap_or("pending"))
    .bind(parse_optional_timestamp(row, "last_synced_at"))
    .bind(parse_optional_timestamp(row, "created_at").unwrap_or_else(chrono::Utc::now))
    .bind(parse_optional_timestamp(row, "updated_at").unwrap_or_else(chrono::Utc::now))
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(())
}

/// Upsert a computer account from snapshot data.
async fn restore_computer_account(pool: &PgPool, row: &serde_json::Value) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO ad_computer_accounts
            (id, domain_id, hardware_id, sam_account_name, distinguished_name,
             dns_hostname, os_name, os_version, object_sid, is_enabled,
             sync_status, last_synced_at, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO UPDATE SET
            distinguished_name = EXCLUDED.distinguished_name,
            dns_hostname = EXCLUDED.dns_hostname,
            is_enabled = EXCLUDED.is_enabled,
            sync_status = 'pending'
        "#,
    )
    .bind(parse_uuid(row, "id")?)
    .bind(parse_uuid(row, "domain_id")?)
    .bind(parse_optional_uuid(row, "hardware_id"))
    .bind(row["sam_account_name"].as_str().unwrap_or(""))
    .bind(row["distinguished_name"].as_str().unwrap_or(""))
    .bind(row["dns_hostname"].as_str())
    .bind(row["os_name"].as_str())
    .bind(row["os_version"].as_str())
    .bind(row["object_sid"].as_str())
    .bind(row["is_enabled"].as_bool().unwrap_or(true))
    .bind(row["sync_status"].as_str().unwrap_or("pending"))
    .bind(parse_optional_timestamp(row, "last_synced_at"))
    .bind(parse_optional_timestamp(row, "created_at").unwrap_or_else(chrono::Utc::now))
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(())
}

/// Upsert a security group from snapshot data.
async fn restore_security_group(pool: &PgPool, row: &serde_json::Value) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO ad_security_groups
            (id, domain_id, source_type, source_id, sam_account_name, distinguished_name,
             display_name, group_scope, group_type, object_sid, sync_status,
             last_synced_at, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO UPDATE SET
            distinguished_name = EXCLUDED.distinguished_name,
            display_name = EXCLUDED.display_name,
            sync_status = 'pending'
        "#,
    )
    .bind(parse_uuid(row, "id")?)
    .bind(parse_uuid(row, "domain_id")?)
    .bind(row["source_type"].as_str().unwrap_or("org_group"))
    .bind(parse_uuid(row, "source_id")?)
    .bind(row["sam_account_name"].as_str().unwrap_or(""))
    .bind(row["distinguished_name"].as_str().unwrap_or(""))
    .bind(row["display_name"].as_str())
    .bind(row["group_scope"].as_str().unwrap_or("global"))
    .bind(row["group_type"].as_str().unwrap_or("security"))
    .bind(row["object_sid"].as_str())
    .bind(row["sync_status"].as_str().unwrap_or("pending"))
    .bind(parse_optional_timestamp(row, "last_synced_at"))
    .bind(parse_optional_timestamp(row, "created_at").unwrap_or_else(chrono::Utc::now))
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(())
}

/// Upsert a group member from snapshot data.
async fn restore_group_member(pool: &PgPool, row: &serde_json::Value) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO ad_group_members
            (id, group_id, member_type, member_id, sync_status)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id) DO UPDATE SET
            sync_status = 'pending'
        "#,
    )
    .bind(parse_uuid(row, "id")?)
    .bind(parse_uuid(row, "group_id")?)
    .bind(row["member_type"].as_str().unwrap_or("user"))
    .bind(parse_uuid(row, "member_id")?)
    .bind(row["sync_status"].as_str().unwrap_or("pending"))
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(())
}

/// Load a snapshot record, returning an error if not found.
async fn load_snapshot_record(pool: &PgPool, snapshot_id: Uuid) -> Result<AdSnapshot> {
    let snapshot: Option<AdSnapshot> = sqlx::query_as("SELECT * FROM ad_snapshots WHERE id = $1")
        .bind(snapshot_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    snapshot.ok_or_else(|| Error::NotFound(format!("Snapshot {snapshot_id} not found")))
}

/// Write snapshot JSON to the configured storage path.
async fn write_snapshot_file(storage_path: &str, data: &[u8]) -> Result<()> {
    use tokio::io::AsyncWriteExt;

    // Create parent directories if needed
    if let Some(parent) = std::path::Path::new(storage_path).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| Error::Internal(format!("Failed to create snapshot directory: {e}")))?;
    }

    let mut file = tokio::fs::File::create(storage_path).await.map_err(|e| {
        Error::Internal(format!(
            "Failed to create snapshot file '{storage_path}': {e}"
        ))
    })?;

    file.write_all(data)
        .await
        .map_err(|e| Error::Internal(format!("Failed to write snapshot data: {e}")))?;

    file.flush()
        .await
        .map_err(|e| Error::Internal(format!("Failed to flush snapshot file: {e}")))?;

    Ok(())
}

/// Read snapshot file from disk.
async fn read_snapshot_file(storage_path: &str) -> Result<Vec<u8>> {
    tokio::fs::read(storage_path).await.map_err(|e| {
        Error::Internal(format!(
            "Failed to read snapshot file '{storage_path}': {e}"
        ))
    })
}

/// Compute the SHA-256 hex digest of a byte slice.
fn compute_sha256(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    format!("{result:x}")
}

/// Compute the expiry timestamp for a snapshot type.
fn compute_expiry(snapshot_type: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    use chrono::Duration;

    let days = match snapshot_type {
        "full" => 30,
        "incremental" => 7,
        "pre_migration" | "pre_restore" => 90,
        _ => 30,
    };

    Some(chrono::Utc::now() + Duration::days(days))
}

// ── JSON parsing helpers ──────────────────────────────────────────────────────

fn parse_uuid(row: &serde_json::Value, field: &str) -> Result<Uuid> {
    row[field]
        .as_str()
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| Error::Internal(format!("Snapshot row missing or invalid field '{field}'")))
}

fn parse_optional_uuid(row: &serde_json::Value, field: &str) -> Option<Uuid> {
    row[field].as_str().and_then(|s| s.parse().ok())
}

fn parse_optional_timestamp(
    row: &serde_json::Value,
    field: &str,
) -> Option<chrono::DateTime<chrono::Utc>> {
    row[field].as_str().and_then(|s| s.parse().ok())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_produces_expected_length() {
        let hash = compute_sha256(b"hello world");
        // SHA-256 hex digest is always 64 characters
        assert_eq!(hash.len(), 64);
    }

    #[test]
    fn compute_expiry_full_is_30_days() {
        let exp = compute_expiry("full").unwrap();
        let diff = exp - chrono::Utc::now();
        // Allow 1-second tolerance for test execution time
        assert!(diff.num_days() >= 29 && diff.num_days() <= 30);
    }

    #[test]
    fn compute_expiry_pre_restore_is_90_days() {
        let exp = compute_expiry("pre_restore").unwrap();
        let diff = exp - chrono::Utc::now();
        assert!(diff.num_days() >= 89 && diff.num_days() <= 90);
    }

    #[test]
    fn filter_manifest_no_filter_returns_all() {
        let manifest = serde_json::json!({
            "objects": {
                "OU=DRH,DC=corp,DC=local": {
                    "type": "ou",
                    "table": "ad_ous",
                    "row_id": "00000000-0000-0000-0000-000000000001"
                },
                "CN=j.dupont,OU=DRH,DC=corp,DC=local": {
                    "type": "user",
                    "table": "ad_user_accounts",
                    "row_id": "00000000-0000-0000-0000-000000000002"
                }
            }
        });

        let items = filter_manifest_items(&manifest, None, false);
        assert_eq!(items.len(), 2);
    }

    #[test]
    fn filter_manifest_exact_dn() {
        let manifest = serde_json::json!({
            "objects": {
                "OU=DRH,DC=corp,DC=local": {
                    "type": "ou",
                    "table": "ad_ous",
                    "row_id": "00000000-0000-0000-0000-000000000001"
                },
                "CN=j.dupont,OU=DRH,DC=corp,DC=local": {
                    "type": "user",
                    "table": "ad_user_accounts",
                    "row_id": "00000000-0000-0000-0000-000000000002"
                }
            }
        });

        // Exact match only — should return 1
        let items = filter_manifest_items(&manifest, Some("OU=DRH,DC=corp,DC=local"), false);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].object_type, "ou");
    }

    #[test]
    fn filter_manifest_with_children() {
        let manifest = serde_json::json!({
            "objects": {
                "OU=DRH,DC=corp,DC=local": {
                    "type": "ou",
                    "table": "ad_ous",
                    "row_id": "00000000-0000-0000-0000-000000000001"
                },
                "CN=j.dupont,OU=DRH,DC=corp,DC=local": {
                    "type": "user",
                    "table": "ad_user_accounts",
                    "row_id": "00000000-0000-0000-0000-000000000002"
                },
                "OU=IT,DC=corp,DC=local": {
                    "type": "ou",
                    "table": "ad_ous",
                    "row_id": "00000000-0000-0000-0000-000000000003"
                }
            }
        });

        // DRH + children
        let items = filter_manifest_items(&manifest, Some("OU=DRH,DC=corp,DC=local"), true);
        assert_eq!(items.len(), 2); // OU=DRH and CN=j.dupont under DRH
    }

    #[test]
    fn build_manifest_indexes_by_dn() {
        let data = SnapshotData {
            ous: vec![serde_json::json!({
                "id": "00000000-0000-0000-0000-000000000001",
                "distinguished_name": "OU=IT,DC=corp,DC=local"
            })],
            user_accounts: vec![],
            computer_accounts: vec![],
            security_groups: vec![],
            group_members: vec![],
            metadata: SnapshotMetadata {
                domain_id: Uuid::nil(),
                captured_at: chrono::Utc::now(),
                object_counts: ObjectCounts {
                    ous: 1,
                    user_accounts: 0,
                    computer_accounts: 0,
                    security_groups: 0,
                    group_members: 0,
                },
            },
        };

        let manifest = build_manifest(&data);
        assert!(manifest["objects"]["OU=IT,DC=corp,DC=local"].is_object());
        assert_eq!(
            manifest["objects"]["OU=IT,DC=corp,DC=local"]["type"].as_str(),
            Some("ou")
        );
    }
}
