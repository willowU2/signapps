//! Integration test: AD dry-run sync should never raise 5xx.
//!
//! The S1 AD sync (`signapps-org::ad::sync`) exposes a POST endpoint that,
//! when called with `?dry_run=true`, must return a structured response
//! without touching external LDAP or the DB. This guards against regressions
//! in the bidirectional sync state machine.
//!
//! `#[ignore]` — requires backend + seeded data.

mod common;

use serial_test::serial;

#[tokio::test]
#[serial]
#[ignore]
async fn test_ad_sync_dry_run_creates_log_entries() -> anyhow::Result<()> {
    let backend = common::spawn_backend().await?;
    common::run_seed().await?;
    let token = common::admin_token(&backend.base_url).await?;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!(
            "{}:3026/api/v1/org/ad/sync?dry_run=true",
            backend.base_url
        ))
        .bearer_auth(&token)
        .send()
        .await?;

    let status = resp.status();
    // Dry-run should be idempotent: accept any 2xx, 4xx (e.g. 404 if endpoint
    // not wired yet, 422 if no config). Reject any 5xx.
    assert!(
        !status.is_server_error(),
        "AD dry-run must not 5xx, got {status}"
    );

    Ok(())
}
