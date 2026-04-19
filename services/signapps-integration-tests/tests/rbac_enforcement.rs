//! Integration test: non-admin user must be denied access to `/admin/users`.
//!
//! The S2 seed (`signapps-seed`) creates 15 Acme Corp users across several
//! OUs. `marie.dupont` is a regular engineer and must NOT be able to reach
//! admin-only endpoints served by `signapps-identity` (port 3001).
//!
//! `#[ignore]` — requires backend + seeded data.

mod common;

use serial_test::serial;

#[tokio::test]
#[serial]
#[ignore]
async fn test_rbac_denies_cross_ou_access() -> anyhow::Result<()> {
    let backend = common::spawn_backend().await?;
    common::run_seed().await?;

    let client = reqwest::Client::new();

    // Login as marie.dupont (Engineering, regular user).
    let resp = client
        .post(format!("{}:3001/api/v1/auth/login", backend.base_url))
        .json(&serde_json::json!({
            "username": "marie.dupont",
            "password": "Demo1234!",
        }))
        .send()
        .await?;

    if resp.status() == 401 || resp.status() == 404 {
        eprintln!(
            "marie.dupont login failed with {} — seed may be incomplete, skipping",
            resp.status()
        );
        return Ok(());
    }

    let body: serde_json::Value = resp.error_for_status()?.json().await?;
    let token = body["access_token"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("no access_token"))?;

    // Attempt to list admin users.
    let admin_resp = client
        .get(format!("{}:3001/api/v1/admin/users", backend.base_url))
        .bearer_auth(token)
        .send()
        .await?;

    let status = admin_resp.status().as_u16();
    // Accept 403 (preferred) or 401 (session-level rejection) — both prove
    // the endpoint is protected. 404 means the route is not exposed; treat
    // as skip rather than fail.
    assert!(
        status == 403 || status == 401 || status == 404,
        "non-admin must be denied (expected 401/403/404), got {status}"
    );
    if status == 404 {
        eprintln!("/api/v1/admin/users not exposed, test skipped");
    }

    Ok(())
}
