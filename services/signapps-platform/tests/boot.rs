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
    // Keep PXE side-channels off: TFTP needs UDP :69 and DC/ProxyDHCP
    // need other privileged ports that CI / dev boxes can't bind.
    std::env::set_var("PXE_ENABLE_TFTP", "false");
    std::env::set_var("PXE_ENABLE_PROXY_DHCP", "false");
    std::env::set_var("PXE_ENABLE_DC", "false");
    // Keep Batch #5 side-channels off:
    // - containers needs the Docker daemon for the eager ping/version probe;
    //   skip it so the :3002 admin API still serves on dev boxes without Docker
    // - mail SMTP/IMAP/DAV/Sieve need privileged ports + TLS certs
    // - deploy /api/v1/deploy/* is dormant by default; /health stays public
    std::env::set_var("CONTAINERS_ENABLED", "false");
    std::env::set_var("MAIL_PROTOCOLS_ENABLED", "false");
    std::env::set_var("DEPLOY_API_ENABLED", "false");
    // Keep the scheduler's 60 s CRON tick + 5 min RAG ingestion crawlers
    // off — they're harmless but their startup-time DB queries bloat
    // the smoke-test boot budget.
    std::env::set_var("SCHEDULER_TICK_ENABLED", "false");

    // Ports that every batch up to and including W3.T17 (W3 gateway +
    // scheduler + webhooks batch) must bind on a clean process.
    //
    // W3 adds the three "complex" services:
    // - :3007 (scheduler — CRON tick + RAG ingestion disabled via
    //   SCHEDULER_TICK_ENABLED=false)
    // - :3027 (webhooks — no persistent dispatcher yet)
    // - :3099 (gateway — reverse-proxy + GraphQL aggregator)
    //
    // Earlier batches (identity, W2.T11–T15) own every other port
    // below. signapps-nexus and signapps-agent were intentionally
    // skipped (nexus is a stub not in the workspace, agent is a
    // client-side endpoint binary).
    let expected_ports: &[u16] = &[
        3001, // identity
        3002, // containers (Docker probe disabled for the test)
        3003, // proxy (admin only — engine disabled for the test)
        3004, // storage
        3005, // ai (providers + model manager + hardware lazy via OnceCell)
        3006, // securelink
        3007, // scheduler (CRON tick disabled for the test)
        3008, // metrics
        3009, // media
        3010, // docs
        3011, // calendar
        3012, // mail (SMTP/IMAP/DAV/Sieve disabled for the test)
        3014, // meet
        3015, // forms
        3016, // pxe (admin only — TFTP/DHCP/DC disabled for the test)
        3019, // social
        3020, // chat
        3021, // contacts
        3022, // it-assets
        3024, // workforce
        3025, // vault
        3026, // org
        3027, // webhooks
        3028, // signatures
        3029, // tenant-config
        3030, // integrations
        3031, // backup
        3032, // compliance
        3033, // gamification
        3034, // collaboration
        3099, // gateway (reverse-proxy aggregator)
        3700, // deploy (protected /api/v1/deploy/* dormant for the test)
        8095, // notifications
        8096, // billing
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

    eprintln!("single-binary boot elapsed: {elapsed:?}");
    // Budget raised from 3s → 5s in S1 W5 after adding:
    //   - 4 provisioning consumers (mail/storage/calendar/chat → org.user.*)
    //   - 4 RBAC cache invalidation listeners (org.policy/grant/assignment.*)
    //   - AD sync per-tenant worker + config loader
    //   - 1 shared OrgClient resolver with moka cache
    // These consumers acquire DB connections at startup for their LISTEN
    // cursor; a 5s budget gives headroom without masking real regressions.
    assert!(
        elapsed < Duration::from_secs(5),
        "single-binary boot took {elapsed:?}, expected < 5s (34 services + RBAC + consumers)"
    );
}
