//! Job execution engine.

use signapps_common::{Error, Result};
use signapps_db::models::{Job, JobRunStatus};
use std::process::Stdio;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

/// Job executor for running scheduled commands.
#[derive(Clone)]
pub struct JobExecutor {
    timeout_seconds: u64,
}

impl JobExecutor {
    /// Create a new job executor.
    pub fn new(timeout_seconds: u64) -> Self {
        Self { timeout_seconds }
    }

    /// Execute a job and return the result.
    pub async fn execute(&self, job: &Job) -> ExecutionResult {
        let start = std::time::Instant::now();

        let result = match job.target_type.as_str() {
            "host" => self.execute_on_host(&job.command).await,
            "container" => {
                if let Some(ref container_id) = job.target_id {
                    self.execute_in_container(container_id, &job.command).await
                } else {
                    Err(Error::Validation(
                        "Container target_id required".to_string(),
                    ))
                }
            },
            _ => Err(Error::Validation(format!(
                "Unknown target type: {}",
                job.target_type
            ))),
        };

        let duration = start.elapsed();

        match result {
            Ok(output) => ExecutionResult {
                status: JobRunStatus::Success,
                output: Some(output),
                error: None,
                duration_ms: duration.as_millis() as u64,
            },
            Err(e) => ExecutionResult {
                status: if duration.as_secs() >= self.timeout_seconds {
                    JobRunStatus::Timeout
                } else {
                    JobRunStatus::Failed
                },
                output: None,
                error: Some(e.to_string()),
                duration_ms: duration.as_millis() as u64,
            },
        }
    }

    /// Execute command on host system.
    async fn execute_on_host(&self, command: &str) -> Result<String> {
        let timeout_duration = Duration::from_secs(self.timeout_seconds);

        let child = Command::new("sh")
            .arg("-c")
            .arg(command)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| Error::Internal(format!("Failed to spawn process: {}", e)))?;

        let output = timeout(timeout_duration, child.wait_with_output())
            .await
            .map_err(|_| Error::Internal("Job execution timed out".to_string()))?
            .map_err(|e| Error::Internal(format!("Failed to wait for process: {}", e)))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            Ok(stdout)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            Err(Error::Internal(format!(
                "Command failed with exit code {:?}: {}",
                output.status.code(),
                stderr
            )))
        }
    }

    /// Execute command inside a Docker container.
    async fn execute_in_container(&self, container_id: &str, command: &str) -> Result<String> {
        let timeout_duration = Duration::from_secs(self.timeout_seconds);

        let child = Command::new("docker")
            .args(["exec", container_id, "sh", "-c", command])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| Error::Docker(format!("Failed to exec in container: {}", e)))?;

        let output = timeout(timeout_duration, child.wait_with_output())
            .await
            .map_err(|_| Error::Internal("Job execution timed out".to_string()))?
            .map_err(|e| Error::Docker(format!("Failed to wait for docker exec: {}", e)))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            Ok(stdout)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            Err(Error::Docker(format!(
                "Docker exec failed with exit code {:?}: {}",
                output.status.code(),
                stderr
            )))
        }
    }
}

/// Result of job execution.
#[derive(Debug, Clone)]
pub struct ExecutionResult {
    pub status: JobRunStatus,
    pub output: Option<String>,
    pub error: Option<String>,
    pub duration_ms: u64,
}
