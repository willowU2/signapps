//! Drive SP3 Backup worker — polls every 60 s for due plans and runs them.

use chrono::Utc;
use signapps_db::{repositories::DriveBackupRepository, DatabasePool};

/// Polling interval in seconds.
const POLL_INTERVAL_SECS: u64 = 60;

/// Entry-point for the backup worker.
///
/// Spawn with `tokio::spawn(backup_worker::run(pool))`.
pub async fn run(pool: DatabasePool) {
    tracing::info!("Drive backup worker started (interval: {POLL_INTERVAL_SECS}s)");

    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;

        if let Err(e) = tick(&pool).await {
            tracing::error!(error = %e, "Drive backup worker error");
        }
    }
}

/// One poll cycle — run all due plans.
async fn tick(pool: &DatabasePool) -> Result<(), signapps_common::Error> {
    let repo = DriveBackupRepository::new(pool);
    let due_plans = repo.list_due_plans().await?;

    if due_plans.is_empty() {
        return Ok(());
    }

    tracing::info!(count = due_plans.len(), "Running due backup plans");

    for plan in due_plans {
        let storage_path = format!("backups/{}/{}", plan.id, Utc::now().timestamp());
        let snapshot = match repo
            .create_snapshot(plan.id, &plan.backup_type, Some(&storage_path))
            .await
        {
            Ok(s) => s,
            Err(e) => {
                tracing::error!(plan_id = %plan.id, error = %e, "Failed to create snapshot");
                continue;
            },
        };

        let (files_count, total_size) =
            match run_backup(pool, snapshot.id, &plan.backup_type, &plan.include_paths).await {
                Ok(result) => result,
                Err(e) => {
                    let _ = repo.fail_snapshot(snapshot.id, &e.to_string()).await;
                    tracing::error!(
                        snapshot_id = %snapshot.id, plan_id = %plan.id,
                        error = %e, "Backup run failed"
                    );
                    continue;
                },
            };

        if let Err(e) = repo
            .complete_snapshot(snapshot.id, files_count, total_size)
            .await
        {
            tracing::error!(snapshot_id = %snapshot.id, error = %e, "Failed to complete snapshot");
            continue;
        }

        if let Err(e) = repo.mark_plan_run(plan.id).await {
            tracing::warn!(plan_id = %plan.id, error = %e, "Failed to mark plan run");
        }

        if let Err(e) = repo
            .cleanup_old_snapshots(plan.id, plan.max_snapshots)
            .await
        {
            tracing::warn!(plan_id = %plan.id, error = %e, "Failed to cleanup old snapshots");
        }

        tracing::info!(
            plan_id = %plan.id,
            snapshot_id = %snapshot.id,
            files = files_count,
            total_size = total_size,
            "Backup plan completed"
        );
    }

    Ok(())
}

/// Run backup for a snapshot: iterate drive.nodes, create entries.
async fn run_backup(
    pool: &DatabasePool,
    snapshot_id: uuid::Uuid,
    _backup_type: &str,
    _include_paths: &[String],
) -> Result<(i32, i64), signapps_common::Error> {
    let repo = DriveBackupRepository::new(pool);

    let nodes: Vec<(uuid::Uuid, String, Option<i64>)> = sqlx::query_as(
        r#"SELECT id, name, size FROM drive.nodes
           WHERE deleted_at IS NULL AND node_type != 'folder'
           LIMIT 5000"#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let mut files_count: i32 = 0;
    let mut total_size: i64 = 0;

    for (node_id, node_path, size) in &nodes {
        let file_size = size.unwrap_or(0);
        let backup_key = format!("backups/{}/{}", snapshot_id, node_id);

        repo.create_entry(
            snapshot_id,
            Some(*node_id),
            node_path,
            None,
            file_size,
            &backup_key,
        )
        .await?;

        files_count += 1;
        total_size += file_size;
    }

    Ok((files_count, total_size))
}
