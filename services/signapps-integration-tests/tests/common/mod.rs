//! Helpers partagés pour les tests d'intégration cross-services.
//!
//! Ce module fournit trois utilitaires :
//! - [`spawn_backend`] : lance `signapps-platform` (single binary) avec configuration
//!   minimale et attend l'apparition de `/health` sur le port 3001.
//! - [`admin_token`] : récupère un JWT admin (credentials `admin`/`admin`).
//! - [`run_seed`] : invoque le seeder Rust `signapps-seed` programmatiquement.
//!
//! Les tests qui utilisent ces helpers doivent être marqués `#[ignore]` et
//! exécutés explicitement via `cargo test -- --ignored` car ils exigent un
//! PostgreSQL disponible et démarrent un vrai backend.

#![allow(dead_code)]

use std::process::{Child, Command, Stdio};
use std::time::Duration;

/// Handle to a running `signapps-platform` process used during a test.
///
/// Drops kill the backend process so the next test starts from a clean state.
pub struct TestBackend {
    process: Child,
    pub base_url: String,
}

impl Drop for TestBackend {
    fn drop(&mut self) {
        let _ = self.process.kill();
        let _ = self.process.wait();
    }
}

/// Spawn `signapps-platform` with most heavy subsystems disabled.
///
/// # Errors
///
/// Returns an error if the binary cannot be spawned or if `/health` does not
/// respond on `http://127.0.0.1:3001` within 30 seconds.
pub async fn spawn_backend() -> anyhow::Result<TestBackend> {
    // Kill any stale instance first (Windows specific).
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("powershell")
            .args([
                "-Command",
                "Stop-Process -Name signapps-platform -Force -ErrorAction SilentlyContinue",
            ])
            .status();
    }
    tokio::time::sleep(Duration::from_secs(2)).await;

    let exe = option_env!("CARGO_BIN_EXE_signapps-platform")
        .map(std::string::ToString::to_string)
        .or_else(|| std::env::var("SIGNAPPS_PLATFORM_BIN").ok())
        .ok_or_else(|| {
            anyhow::anyhow!(
                "signapps-platform binary not found. Build with `cargo build -p signapps-platform` and set SIGNAPPS_PLATFORM_BIN."
            )
        })?;

    let process = Command::new(exe)
        .env("PROXY_ENABLED", "false")
        .env("PXE_ENABLE_TFTP", "false")
        .env("PXE_ENABLE_PROXY_DHCP", "false")
        .env("CONTAINERS_ENABLED", "false")
        .env("MAIL_PROTOCOLS_ENABLED", "false")
        .env("SCHEDULER_TICK_ENABLED", "false")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;

    // Wait up to 30s for /health on :3001.
    let deadline = tokio::time::Instant::now() + Duration::from_secs(30);
    let client = reqwest::Client::new();
    loop {
        if tokio::time::Instant::now() > deadline {
            anyhow::bail!("backend didn't come up in 30s");
        }
        if client
            .get("http://127.0.0.1:3001/health")
            .timeout(Duration::from_millis(500))
            .send()
            .await
            .ok()
            .map(|r| r.status().is_success())
            .unwrap_or(false)
        {
            break;
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }

    Ok(TestBackend {
        process,
        base_url: "http://127.0.0.1".to_string(),
    })
}

/// Login as `admin`/`admin` and return the access token.
///
/// # Errors
///
/// Returns an error if the login HTTP call fails or if the response does not
/// contain an `access_token` field.
pub async fn admin_token(base_url: &str) -> anyhow::Result<String> {
    let client = reqwest::Client::new();
    let resp: serde_json::Value = client
        .post(format!("{}:3001/api/v1/auth/login", base_url))
        .json(&serde_json::json!({"username": "admin", "password": "admin"}))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let token = resp
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("no access_token in response"))?
        .to_string();
    Ok(token)
}

/// Invoke the seeder directly via its library API (idempotent).
///
/// # Errors
///
/// Propagates errors from [`signapps_seed::run_seed`] (DB connection, schema,
/// etc.).
pub async fn run_seed() -> anyhow::Result<()> {
    signapps_seed::run_seed(signapps_seed::SeedArgs {
        database_url: std::env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgres://signapps:signapps_dev@localhost:5432/signapps".to_string()
        }),
        force: false,
        reset: false,
        dry_run: false,
        only: None,
    })
    .await
}
