//! End-to-end smoke: spawn signapps-platform, login as admin, fetch /me.
//!
//! Requires postgres running AND the identity seed binary must have been
//! executed previously (`cargo run --bin seed_db -p signapps-identity`)
//! so that admin@signapps.local / admin credentials exist.

use std::time::{Duration, Instant};

use reqwest::Client;
use serde_json::json;

#[tokio::test]
#[ignore = "requires postgres seeded with admin user; run with `cargo test -- --ignored`"]
async fn login_and_fetch_me_against_single_binary() {
    std::env::set_var(
        "DATABASE_URL",
        "postgres://signapps:signapps_dev@localhost:5432/signapps",
    );
    std::env::set_var("JWT_SECRET", "x".repeat(32));
    std::env::set_var(
        "KEYSTORE_MASTER_KEY",
        "0000000000000000000000000000000000000000000000000000000000000000",
    );
    // Disable privileged listeners for the test.
    std::env::set_var("PROXY_ENABLED", "false");
    std::env::set_var("PXE_ENABLE_TFTP", "false");
    std::env::set_var("PXE_ENABLE_PROXY_DHCP", "false");
    std::env::set_var("PXE_ENABLE_DC", "false");
    std::env::set_var("CONTAINERS_ENABLED", "false");
    std::env::set_var("MAIL_PROTOCOLS_ENABLED", "false");
    std::env::set_var("DEPLOY_API_ENABLED", "false");
    std::env::set_var("SCHEDULER_TICK_ENABLED", "false");

    let mut child = std::process::Command::new(env!("CARGO_BIN_EXE_signapps-platform"))
        .spawn()
        .expect("failed to launch signapps-platform");

    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .expect("build reqwest client");

    // Wait for identity /health
    let deadline = Instant::now() + Duration::from_secs(30);
    loop {
        if client
            .get("http://127.0.0.1:3001/health")
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
        {
            break;
        }
        if Instant::now() >= deadline {
            child.kill().ok();
            panic!("identity did not come up in 30s");
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }

    let result: anyhow::Result<()> = async {
        let login = client
            .post("http://127.0.0.1:3001/api/v1/auth/login")
            .json(&json!({
                "email": "admin@signapps.local",
                "password": "admin",
            }))
            .send()
            .await?
            .error_for_status()?;

        let token = login
            .json::<serde_json::Value>()
            .await?
            .get("access_token")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| anyhow::anyhow!("no access_token in login response"))?;

        let me = client
            .get("http://127.0.0.1:3001/api/v1/auth/me")
            .bearer_auth(&token)
            .send()
            .await?
            .error_for_status()?;

        assert_eq!(me.status(), 200);
        Ok(())
    }
    .await;

    child.kill().ok();
    child.wait().ok();

    if let Err(e) = result {
        panic!("E2E failed: {e:?}");
    }
}
