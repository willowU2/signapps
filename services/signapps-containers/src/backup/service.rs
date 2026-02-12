//! Backup service for scheduling and running backups.

use super::restic::ResticClient;
use signapps_db::models::RetentionPolicy;
use signapps_db::repositories::BackupRepository;
use signapps_db::DatabasePool;

/// Run the backup scheduler background task.
/// Checks every 60 seconds for profiles that need to run based on their schedule.
pub async fn run_backup_scheduler(pool: DatabasePool) {
    let restic = ResticClient::new();
    let interval = std::time::Duration::from_secs(60);

    loop {
        tokio::time::sleep(interval).await;

        let repo = BackupRepository::new(&pool);
        let profiles = match repo.list_profiles().await {
            Ok(p) => p,
            Err(e) => {
                tracing::error!("Backup scheduler: failed to list profiles: {e}");
                continue;
            }
        };

        for profile in profiles {
            if !profile.enabled {
                continue;
            }

            let schedule = match &profile.schedule {
                Some(s) if !s.is_empty() => s.clone(),
                _ => continue,
            };

            // Simple schedule check: parse cron and see if we should run
            if !should_run_now(&schedule, profile.last_run_at) {
                continue;
            }

            tracing::info!(
                profile = %profile.name,
                "Backup scheduler: starting scheduled backup"
            );

            // Run backup
            if let Err(e) = run_backup(&pool, &restic, profile.id).await {
                tracing::error!(
                    profile = %profile.name,
                    "Backup scheduler: backup failed: {e}"
                );
            }
        }
    }
}

/// Check if a cron schedule should run now given the last run time.
fn should_run_now(
    schedule: &str,
    last_run: Option<chrono::DateTime<chrono::Utc>>,
) -> bool {
    // Simple interval-based scheduling: e.g. "every 6h", "every 24h", "every 1h"
    let interval_secs = parse_interval(schedule);
    if interval_secs == 0 {
        return false;
    }

    match last_run {
        None => true,
        Some(last) => {
            let elapsed = chrono::Utc::now()
                .signed_duration_since(last)
                .num_seconds();
            elapsed >= interval_secs
        }
    }
}

/// Parse a simple interval string like "every 6h", "every 24h", "every 30m".
fn parse_interval(schedule: &str) -> i64 {
    let s = schedule.trim().to_lowercase();
    let s = s.strip_prefix("every").unwrap_or(&s).trim();

    if let Some(h) = s.strip_suffix('h') {
        h.trim().parse::<i64>().unwrap_or(0) * 3600
    } else if let Some(m) = s.strip_suffix('m') {
        m.trim().parse::<i64>().unwrap_or(0) * 60
    } else if let Some(d) = s.strip_suffix('d') {
        d.trim().parse::<i64>().unwrap_or(0) * 86400
    } else {
        0
    }
}

/// Execute a backup for a given profile.
pub async fn run_backup(
    pool: &DatabasePool,
    restic: &ResticClient,
    profile_id: uuid::Uuid,
) -> anyhow::Result<()> {
    let repo = BackupRepository::new(pool);
    let profile = repo
        .find_profile(profile_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Profile not found"))?;

    let start = std::time::Instant::now();

    // Create a run record
    let run = repo.create_run(profile_id).await?;

    // Init repo (idempotent)
    if let Err(e) = restic
        .init(
            &profile.destination_type,
            &profile.destination_config,
            &profile.password_encrypted,
        )
        .await
    {
        let duration = start.elapsed().as_secs() as i32;
        let _ = repo
            .fail_run(run.id, &format!("Init failed: {e}"), duration)
            .await;
        return Err(e);
    }

    // Collect volume paths from container configs
    let container_repo =
        signapps_db::repositories::ContainerRepository::new(pool);
    let mut paths = Vec::new();
    let mut tags = vec![format!("profile:{}", profile.name)];

    for container_id in &profile.container_ids {
        if let Ok(Some(container)) = container_repo.find_by_id(*container_id).await {
            tags.push(format!("container:{}", container.name));

            // Extract volume mounts from container config
            if let Some(config) = &container.config {
                if let Some(volumes) = config.get("volumes").and_then(|v| v.as_array()) {
                    for vol in volumes {
                        if let Some(host_path) =
                            vol.get("host_path").and_then(|v| v.as_str())
                        {
                            paths.push(host_path.to_string());
                        }
                    }
                }
                // Also check bind mounts
                if let Some(binds) = config.get("binds").and_then(|v| v.as_array()) {
                    for bind in binds {
                        if let Some(bind_str) = bind.as_str() {
                            // Format is "host:container:mode"
                            if let Some(host) = bind_str.split(':').next() {
                                paths.push(host.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    if paths.is_empty() {
        let duration = start.elapsed().as_secs() as i32;
        let _ = repo
            .fail_run(run.id, "No volume paths found to backup", duration)
            .await;
        return Err(anyhow::anyhow!("No volume paths found to backup"));
    }

    // Run the backup
    match restic
        .backup(
            &profile.destination_type,
            &profile.destination_config,
            &profile.password_encrypted,
            &paths,
            &tags,
        )
        .await
    {
        Ok(summary) => {
            let duration = start.elapsed().as_secs() as i32;
            let _ = repo
                .complete_run(
                    run.id,
                    &summary.snapshot_id,
                    summary.data_added,
                    summary.files_new,
                    summary.files_changed,
                    duration,
                )
                .await;
            let _ = repo.update_last_run(profile_id).await;

            tracing::info!(
                profile = %profile.name,
                snapshot = %summary.snapshot_id,
                files_new = summary.files_new,
                files_changed = summary.files_changed,
                "Backup completed"
            );

            // Apply retention policy if configured
            if let Some(policy_val) = &profile.retention_policy {
                if let Ok(policy) =
                    serde_json::from_value::<RetentionPolicy>(policy_val.clone())
                {
                    if let Err(e) = restic
                        .forget(
                            &profile.destination_type,
                            &profile.destination_config,
                            &profile.password_encrypted,
                            policy.keep_last,
                            policy.keep_daily,
                            policy.keep_weekly,
                            policy.keep_monthly,
                        )
                        .await
                    {
                        tracing::warn!(
                            profile = %profile.name,
                            "Retention policy failed: {e}"
                        );
                    }
                }
            }

            Ok(())
        }
        Err(e) => {
            let duration = start.elapsed().as_secs() as i32;
            let _ = repo
                .fail_run(run.id, &e.to_string(), duration)
                .await;
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_interval() {
        assert_eq!(parse_interval("every 6h"), 21600);
        assert_eq!(parse_interval("every 24h"), 86400);
        assert_eq!(parse_interval("every 30m"), 1800);
        assert_eq!(parse_interval("every 1d"), 86400);
        assert_eq!(parse_interval("6h"), 21600);
        assert_eq!(parse_interval("invalid"), 0);
    }

    #[test]
    fn test_should_run_now_no_last_run() {
        assert!(should_run_now("every 6h", None));
    }

    #[test]
    fn test_should_run_now_recently_ran() {
        let last = chrono::Utc::now() - chrono::Duration::minutes(5);
        assert!(!should_run_now("every 6h", Some(last)));
    }

    #[test]
    fn test_should_run_now_overdue() {
        let last = chrono::Utc::now() - chrono::Duration::hours(7);
        assert!(should_run_now("every 6h", Some(last)));
    }
}
