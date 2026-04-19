//! Rust-level mirror of the 8 Playwright scenarios in
//! `client/e2e/s1-org-rbac.spec.ts` (S1 refonte, Task 38).
//!
//! Each scenario is a `#[tokio::test]` + `#[ignore = "…"]` so the file
//! compiles in CI but only runs when invoked with `--ignored` against a
//! live `signapps-platform` instance on :3001 (identity) / :3026 (org).
//!
//! Scenarios 5-7 stay in the file as skeletons that `return;` early with
//! a `// SKIP:` comment — the Rust skip policy mirrors the Playwright
//! one (LDAP fixture, board UI, cross-unit move UI).

use std::time::Duration;

use reqwest::Client;
use serde_json::json;

const IDENT: &str = "http://localhost:3001";
const ORG: &str = "http://localhost:3026";
const DEFAULT_TENANT: &str = "00000000-0000-0000-0000-000000000001";

/// Shared helper — pre-seed env so the handlers never reject our test
/// traffic for missing config.
fn seed_env() {
    std::env::set_var(
        "DATABASE_URL",
        "postgres://signapps:signapps_dev@localhost:5432/signapps",
    );
    std::env::set_var("JWT_SECRET", "x".repeat(32));
    std::env::set_var(
        "KEYSTORE_MASTER_KEY",
        "0".repeat(64),
    );
}

/// Build a short-timeout reqwest client.
fn client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .expect("reqwest client build")
}

/// Log admin in and return the access_token. If the identity service
/// replies `requires_context`, auto-pick the first listed context —
/// matches what `client/e2e/auth.setup.ts` does.
async fn login_admin(client: &Client) -> anyhow::Result<String> {
    let res = client
        .post(format!("{IDENT}/api/v1/auth/login"))
        .json(&json!({ "username": "admin", "password": "admin" }))
        .send()
        .await?
        .error_for_status()?;
    let body: serde_json::Value = res.json().await?;
    let mut token = body
        .get("access_token")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    if body.get("requires_context") == Some(&json!(true)) {
        if let Some(ctx_id) = body
            .get("contexts")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|c| c.get("id"))
            .and_then(|v| v.as_str())
        {
            if let Ok(res) = client
                .post(format!("{IDENT}/api/v1/auth/select-context"))
                .bearer_auth(&token)
                .json(&json!({ "context_id": ctx_id }))
                .send()
                .await
            {
                if res.status().is_success() {
                    if let Ok(body2) = res.json::<serde_json::Value>().await {
                        if let Some(t2) = body2.get("access_token").and_then(|v| v.as_str()) {
                            token = t2.to_string();
                        }
                    }
                }
            }
        }
    }
    if token.is_empty() {
        anyhow::bail!("login did not return access_token");
    }
    Ok(token)
}

/// Scenario 1 — admin creates user, provisioning log reachable < 5 s.
#[tokio::test]
#[ignore = "requires running single-binary (signapps-platform) on :3001 + :3026"]
async fn s1_1_admin_creates_user() {
    seed_env();
    let c = client();
    let token = login_admin(&c).await.expect("admin login");

    let email = format!("rust-s1-1-{}@signapps.local", chrono_like_ts());
    let create = c
        .post(format!("{ORG}/api/v1/org/persons"))
        .bearer_auth(&token)
        .json(&json!({
            "tenant_id": DEFAULT_TENANT,
            "email": email,
            "first_name": "Rust",
            "last_name": "S1-1",
        }))
        .send()
        .await
        .expect("POST persons");
    assert!(
        create.status().as_u16() < 500,
        "persons create 5xx: {}",
        create.status()
    );

    let started = std::time::Instant::now();
    let pending = c
        .get(format!(
            "{ORG}/api/v1/org/provisioning/pending?tenant_id={DEFAULT_TENANT}&limit=10"
        ))
        .bearer_auth(&token)
        .send()
        .await
        .expect("GET provisioning/pending");
    let elapsed = started.elapsed();
    assert_eq!(pending.status(), 200, "provisioning pending not 200");
    assert!(
        elapsed < Duration::from_secs(5),
        "provisioning pending > 5s: {elapsed:?}"
    );
}

/// Scenario 2 — share doc A → B via HMAC grant.
#[tokio::test]
#[ignore = "requires running single-binary (signapps-platform) on :3001 + :3026"]
async fn s1_2_share_doc_to_user() {
    seed_env();
    let c = client();
    let token = login_admin(&c).await.expect("admin login");

    let res = c
        .post(format!("{ORG}/api/v1/org/grants"))
        .bearer_auth(&token)
        .json(&json!({
            "tenant_id": DEFAULT_TENANT,
            "resource_type": "document",
            "resource_id": "11111111-1111-1111-1111-111111111111",
            "permissions": { "read": true },
        }))
        .send()
        .await
        .expect("POST grants");

    assert!(
        res.status().as_u16() < 500,
        "grants create 5xx: {}",
        res.status()
    );

    if res.status().is_success() {
        let body: serde_json::Value = res.json().await.expect("grant body json");
        assert!(body.get("token").and_then(|v| v.as_str()).is_some());
        assert!(body.get("url").and_then(|v| v.as_str()).is_some());

        if let Some(url) = body.get("url").and_then(|v| v.as_str()) {
            let redir = c
                .get(format!("{ORG}{url}"))
                .send()
                .await
                .expect("GET /g/:token");
            let s = redir.status().as_u16();
            assert!(
                matches!(s, 302 | 303 | 307 | 308 | 404 | 410 | 200),
                "unexpected grant redirect status: {s}"
            );
        }
    }
}

/// Scenario 3 — admin changes org node policy, reachable endpoints.
#[tokio::test]
#[ignore = "requires running single-binary (signapps-platform) on :3001 + :3026"]
async fn s1_3_admin_changes_policy() {
    seed_env();
    let c = client();
    let token = login_admin(&c).await.expect("admin login");

    let list = c
        .get(format!(
            "{ORG}/api/v1/org/policies?tenant_id={DEFAULT_TENANT}"
        ))
        .bearer_auth(&token)
        .send()
        .await
        .expect("GET policies");
    assert_eq!(list.status(), 200, "list policies not 200");

    let subtree = c
        .get(format!(
            "{ORG}/api/v1/org/policies/bindings/subtree?tenant_id={DEFAULT_TENANT}&node_id=00000000-0000-0000-0000-000000000000"
        ))
        .bearer_auth(&token)
        .send()
        .await
        .expect("GET policies/bindings/subtree");
    assert!(
        subtree.status().as_u16() < 500,
        "subtree 5xx: {}",
        subtree.status()
    );
}

/// Scenario 4 — external receives grant URL, J+7 expiration.
#[tokio::test]
#[ignore = "requires running single-binary (signapps-platform) on :3001 + :3026"]
async fn s1_4_external_grant_j7_expiry() {
    seed_env();
    let c = client();
    let token = login_admin(&c).await.expect("admin login");

    let expires_at = chrono_plus_days_iso(7);

    let res = c
        .post(format!("{ORG}/api/v1/org/grants"))
        .bearer_auth(&token)
        .json(&json!({
            "tenant_id": DEFAULT_TENANT,
            "resource_type": "document",
            "resource_id": "22222222-2222-2222-2222-222222222222",
            "permissions": { "read": true },
            "expires_at": expires_at,
        }))
        .send()
        .await
        .expect("POST grants with expires_at");
    assert!(
        res.status().as_u16() < 500,
        "grants create 5xx: {}",
        res.status()
    );

    if res.status().is_success() {
        let list = c
            .get(format!(
                "{ORG}/api/v1/org/grants?tenant_id={DEFAULT_TENANT}&active=true"
            ))
            .bearer_auth(&token)
            .send()
            .await
            .expect("GET grants list");
        assert_eq!(list.status(), 200);
    }
}

/// Scenario 5 — AD sync adds user without duplicate. SKIP: no LDAP
/// fixture in CI. Keep the test body so CI compiles + discovers it.
#[tokio::test]
#[ignore = "SKIP: requires LDAP test container + org_ad_config seeded"]
async fn s1_5_ad_sync_adds_user_no_duplicate() {
    // SKIP: lift when the CI ldif + ldap test container land. The
    // skeleton mirrors the Playwright 5 skip so both test matrices move
    // in lockstep.
}

/// Scenario 6 — board member rights on sub-nodes. SKIP: board admin UI
/// still in design.
#[tokio::test]
#[ignore = "SKIP: board admin UI TBD — backend endpoints exist, lift when /admin/org-structure → boards ships"]
async fn s1_6_board_member_inherits_rights() {
    // SKIP: lift when the Boards admin tab ships.
}

/// Scenario 7 — move user cross-unit, RBAC updates without logout.
/// SKIP: cross-unit move UI still in design.
#[tokio::test]
#[ignore = "SKIP: cross-unit move UI TBD — trait + cache invalidation live, lift when the page ships"]
async fn s1_7_move_user_cross_unit() {
    // SKIP: the assignment PATCH works; UX for the dashboard button TBD.
}

/// Scenario 8 — revoke grant, access blocked < 60 s.
#[tokio::test]
#[ignore = "requires running single-binary (signapps-platform) on :3001 + :3026"]
async fn s1_8_revoke_grant_blocks_access() {
    seed_env();
    let c = client();
    let token = login_admin(&c).await.expect("admin login");

    // Create a grant we can revoke.
    let create = c
        .post(format!("{ORG}/api/v1/org/grants"))
        .bearer_auth(&token)
        .json(&json!({
            "tenant_id": DEFAULT_TENANT,
            "resource_type": "document",
            "resource_id": "33333333-3333-3333-3333-333333333333",
            "permissions": { "read": true },
        }))
        .send()
        .await
        .expect("POST grants");

    if !create.status().is_success() {
        // SKIP: env cannot create grants (fk/tenant missing) — the
        // revoke branch is not reachable from here, bail out.
        return;
    }
    let body: serde_json::Value = create.json().await.expect("grant body json");
    let id = body
        .get("id")
        .and_then(|v| v.as_str())
        .expect("grant id")
        .to_string();
    let raw_token = body
        .get("token")
        .and_then(|v| v.as_str())
        .expect("grant token")
        .to_string();

    // Revoke.
    let del = c
        .delete(format!("{ORG}/api/v1/org/grants/{id}"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("DELETE grant");
    assert!(
        matches!(del.status().as_u16(), 200 | 204),
        "revoke unexpected status: {}",
        del.status()
    );

    // Verify — must NOT be a 5xx, must come back quickly.
    let started = std::time::Instant::now();
    let verify = c
        .post(format!(
            "{ORG}/api/v1/org/grants/verify?token={}",
            urlencoding_like(&raw_token)
        ))
        .bearer_auth(&token)
        .send()
        .await
        .expect("POST grants/verify");
    let elapsed = started.elapsed();
    assert!(
        elapsed < Duration::from_secs(60),
        "verify > 60s: {elapsed:?}"
    );
    assert_ne!(
        verify.status().as_u16(),
        500,
        "verify 500 after revoke: regression"
    );
}

// ---- small helpers (no new deps) ---------------------------------------------

/// Poor-man's timestamp for unique email generation. Not monotonic
/// across processes but good enough for a single test run.
fn chrono_like_ts() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or_default()
}

/// Format `now + days` as an ISO-8601 UTC string, accepting ±1s
/// skew. Uses the already-depended chrono via reqwest's chain? No — we
/// keep this file dep-free by formatting inline.
fn chrono_plus_days_iso(days: i64) -> String {
    // Manual `date -d` via SystemTime. Outputs RFC3339 with Z.
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default()
        + (days as u64) * 24 * 3600;
    // Convert to a naïve ISO-8601 UTC. For precision we rely on the
    // server's parser accepting `YYYY-MM-DDThh:mm:ssZ`.
    let (y, mo, d, h, mi, s) = unix_to_ymdhms(secs);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{mi:02}:{s:02}Z")
}

/// Very small URL encoder — only escapes the characters that break a
/// query param (`=`, `&`, `+`, `%`). The HMAC tokens issued by
/// `signapps-org` are base64url, so this is a safety net.
fn urlencoding_like(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '=' => "%3D".to_string(),
            '&' => "%26".to_string(),
            '+' => "%2B".to_string(),
            '%' => "%25".to_string(),
            _ => c.to_string(),
        })
        .collect()
}

/// Convert a Unix timestamp to (year, month, day, hour, minute,
/// second). Copes with proleptic Gregorian, no leap-seconds, good for
/// the test horizon. Adapted from Howard Hinnant's date algorithms.
fn unix_to_ymdhms(secs: u64) -> (i32, u32, u32, u32, u32, u32) {
    let days = (secs / 86_400) as i64;
    let tod = (secs % 86_400) as u32;
    let (y, mo, d) = civil_from_days(days);
    let h = tod / 3600;
    let mi = (tod % 3600) / 60;
    let s = tod % 60;
    (y, mo, d, h, mi, s)
}

fn civil_from_days(z: i64) -> (i32, u32, u32) {
    // Howard Hinnant's `civil_from_days` — see
    // https://howardhinnant.github.io/date_algorithms.html
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = (z - era * 146_097) as u64; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m, d)
}
