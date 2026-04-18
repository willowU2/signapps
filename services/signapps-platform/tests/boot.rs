//! End-to-end smoke test for the single-binary runtime.
//!
//! Launches `signapps-platform` as a subprocess, waits for every
//! health endpoint to return 200, and asserts that the total boot
//! time is under three seconds.

use std::time::{Duration, Instant};

#[tokio::test]
#[ignore = "requires postgres + built platform binary; run with `cargo test -- --ignored`"]
async fn platform_boots_in_under_three_seconds() {
    // When no services are wired yet (shell phase), the binary exits
    // immediately after migrations when `SIGNAPPS_PLATFORM_EXIT_AFTER_BOOT=1`
    // — this is a smoke test that migrations + shared state + supervisor
    // scaffolding all compile and run on a fresh process.
    let expected_ports: &[u16] = &[]; // extended as services are wired in later tasks

    let start = Instant::now();

    let mut child = std::process::Command::new(env!("CARGO_BIN_EXE_signapps-platform"))
        .env("SIGNAPPS_PLATFORM_EXIT_AFTER_BOOT", "1")
        .spawn()
        .expect("failed to launch signapps-platform");

    if expected_ports.is_empty() {
        // With the exit-after-boot flag and no services, the process
        // should terminate cleanly very quickly. Wait for it.
        let status = child.wait().expect("wait");
        assert!(status.success(), "platform exited non-zero: {status:?}");
    } else {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(500))
            .build()
            .unwrap();

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
        child.kill().ok();
        child.wait().ok();
    }

    let elapsed = start.elapsed();
    assert!(
        elapsed < Duration::from_secs(3),
        "single-binary boot/exit took {elapsed:?}, expected < 3s"
    );
}
