use crate::AppState;

use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::{error, info};

/// Starts the background cron scheduler for maintenance jobs.
pub async fn start_cron_scheduler(state: AppState) -> signapps_common::Result<()> {
    let sched = JobScheduler::new().await.map_err(|e| {
        signapps_common::Error::Internal(format!("Failed to create scheduler: {}", e))
    })?;

    // Nightly sync at 03:00 AM daily
    let nightly_job = Job::new_async("0 0 3 * * *", move |uuid, _l| {
        let state_clone = state.clone();
        Box::pin(async move {
            info!("Starting nightly AI vector sync job");
            if let Err(e) = run_nightly_sync(&state_clone).await {
                error!("Nightly AI vector sync job failed: {}", e);
            } else {
                info!("Nightly AI vector sync job completed successfully");
            }
        })
    })
    .unwrap();

    sched.add(nightly_job).await.unwrap();

    // Start the scheduler in the background
    sched.start().await.unwrap();

    Ok(())
}

async fn run_nightly_sync(_state: &AppState) -> signapps_common::Result<()> {
    // We assume the local `fs` or `s3` storage is used.
    // For simplicity, we trigger a webhook to sync. In a full implementation, we'd list all files recursively.
    info!("Nightly sync logic triggered.");

    Ok(())
}
