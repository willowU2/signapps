//! End-to-end smoke test for the single-binary runtime.

use std::time::{Duration, Instant};

#[tokio::test]
#[ignore = "requires postgres + env + built platform binary; run with `cargo test -- --ignored`"]
async fn platform_boots_in_under_three_seconds() {
    std::env::set_var(
        "DATABASE_URL",
        "postgres://signapps:signapps_dev@localhost:5432/signapps",
    );
    std::env::set_var("JWT_SECRET", "x".repeat(32));
    std::env::set_var(
        "KEYSTORE_MASTER_KEY",
        "0000000000000000000000000000000000000000000000000000000000000000",
    );
    // Disable the integrated proxy engine for the smoke test — its
    // :80 / :443 listeners require elevated privileges (root on Linux,
    // Administrator on Windows) and the smoke test only validates the
    // admin :3003 endpoint.
    std::env::set_var("PROXY_ENABLED", "false");

    // Ports that every batch up to and including W2.T12 (batch #2) must
    // bind on a clean process. Note: collaboration historically binds
    // :3034 (the spec's mention of :3013 referred to a service that
    // does not yet exist in the codebase).
    let expected_ports: &[u16] = &[
        3001, // identity
        3003, // proxy (admin only — engine disabled for the test)
        3004, // storage
        3006, // securelink
        3009, // media
        3014, // meet
        3015, // forms
        3020, // chat
        3021, // contacts
        3034, // collaboration
        8095, // notifications
    ];
    let start = Instant::now();

    let mut child = std::process::Command::new(env!("CARGO_BIN_EXE_signapps-platform"))
        .spawn()
        .expect("failed to launch signapps-platform");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(500))
        .build()
        .expect("build reqwest client");

    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        assert!(Instant::now() < deadline, "boot timed out");
        let mut all_up = true;
        for port in expected_ports {
            let url = format!("http://127.0.0.1:{port}/health");
            match client.get(&url).send().await {
                Ok(resp) if resp.status().is_success() => continue,
                _ => {
                    all_up = false;
                    break;
                },
            }
        }
        if all_up {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }

    let elapsed = start.elapsed();
    child.kill().ok();
    child.wait().ok();

    assert!(
        elapsed < Duration::from_secs(3),
        "single-binary boot took {elapsed:?}, expected < 3s"
    );
}
