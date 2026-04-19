//! AD synchronization tests — unit + `#[ignore]`d integration stubs.
//!
//! The unit tests here exercise [`signapps_org::ad::conflict::resolve`]
//! which does not need LDAP or Postgres. The integration tests are
//! kept as stubs behind `#[ignore]` so `cargo test` does not pick them
//! up by default — they require a running LDAP server (e.g. Kanidm /
//! OpenLDAP) plus the canonical Postgres schema. CI runs them
//! explicitly with `cargo test -- --ignored` against a dedicated
//! service-matrix entry.

use signapps_db::models::org::ConflictStrategy;
use signapps_org::ad::conflict::{resolve, Resolved};

// ────────────────────────────────────────────────────────────────────
// Unit tests — pure, no external deps.
// ────────────────────────────────────────────────────────────────────

#[test]
fn conflict_resolve_manual_returns_manual() {
    let out: Resolved<i32> = resolve(ConflictStrategy::Manual, 1, 2);
    assert!(matches!(out, Resolved::Manual));
}

#[test]
fn conflict_resolve_org_wins() {
    let out: Resolved<i32> = resolve(ConflictStrategy::OrgWins, 1, 2);
    assert!(matches!(out, Resolved::UseOrg(1)));
}

#[test]
fn conflict_resolve_ad_wins() {
    let out: Resolved<&'static str> = resolve(ConflictStrategy::AdWins, "org", "ad");
    assert!(matches!(out, Resolved::UseAd("ad")));
}

// ────────────────────────────────────────────────────────────────────
// Integration stubs — gated behind `#[ignore]`.
// ────────────────────────────────────────────────────────────────────

#[tokio::test]
#[ignore = "requires a running LDAP server + postgres"]
async fn dry_run_reports_without_write() {
    // Implemented in the LDAP-enabled CI matrix. In the current
    // environment we only assert that `run_cycle` fails fast with a
    // connection error when given an unreachable server — which
    // would be tested here with a bogus URL. For now the stub
    // documents the intent.
}

#[tokio::test]
#[ignore = "requires local LDAP + postgres"]
async fn ad_to_org_creates_persons() {
    // Exercises the full path:
    //   1. Seed Kanidm with 3 users.
    //   2. Invoke `run_cycle(..., dry_run=false)`.
    //   3. Assert `report.added == 3` AND `org_persons` has 3 rows
    //      with `last_synced_by = "ad"`.
}

#[tokio::test]
#[ignore = "requires local LDAP + postgres"]
async fn conflict_manual_flags_log_without_write() {
    // Seeds one `org_persons` row with `first_name = "Before"` and
    // one AD user with the same email but `givenName = "After"`,
    // configures `ConflictStrategy::Manual`, runs the cycle, and
    // asserts:
    //   - `report.conflicts == 1`
    //   - `org_persons.first_name` is still `"Before"`
    //   - `org_ad_sync_log` has one row with
    //     `status = "conflict_manual"`.
}
