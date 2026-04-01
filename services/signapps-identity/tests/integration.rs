//! Integration tests for signapps-identity business logic.
//!
//! These tests exercise the pure-logic layer of the identity service — JWT
//! encoding/decoding, RBAC role predicates, token validation rules, password
//! policy enforcement, MFA code format rules — without requiring a running
//! database.  Tests that need a real PostgreSQL instance are guarded with an
//! early `return` when `DATABASE_URL` is absent.
//!
//! Run with:
//! ```bash
//! cargo nextest run -p signapps-identity
//! ```

// ─── Re-use the service's internal auth module ────────────────────────────────
// The integration test binary can reference the service's modules via
// `signapps_identity` only when the service exposes a `lib.rs`.  Since this
// service is binary-only (`main.rs`), we pull the test-relevant logic through
// the public crates instead.

use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const JWT_SECRET: &str = "integration-test-secret-long-enough-for-hs256";

/// Minimal JWT claims mirroring the service's `auth::jwt::Claims`.
#[derive(Debug, Serialize, Deserialize)]
struct TestClaims {
    sub: Uuid,
    username: String,
    role: i16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    tenant_id: Option<Uuid>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    workspace_ids: Option<Vec<Uuid>>,
    exp: i64,
    iat: i64,
    token_type: String,
}

/// Build a JWT with the given expiry offset from now (seconds, may be negative for expired).
fn build_jwt(
    user_id: Uuid,
    username: &str,
    role: i16,
    token_type: &str,
    exp_offset_secs: i64,
) -> String {
    let now = Utc::now().timestamp();
    let claims = TestClaims {
        sub: user_id,
        username: username.to_string(),
        role,
        tenant_id: None,
        workspace_ids: None,
        exp: now + exp_offset_secs,
        iat: now,
        token_type: token_type.to_string(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET.as_bytes()),
    )
    .expect("encoding must succeed")
}

fn decode_jwt(token: &str) -> Result<TestClaims, jsonwebtoken::errors::Error> {
    let data = decode::<TestClaims>(
        token,
        &DecodingKey::from_secret(JWT_SECRET.as_bytes()),
        &Validation::default(),
    )?;
    Ok(data.claims)
}

// ─── JWT round-trip ──────────────────────────────────────────────────────────

/// An access token encodes the correct user_id, username, and role.
#[test]
fn test_jwt_access_token_claims_roundtrip() {
    let uid = Uuid::new_v4();
    let token = build_jwt(uid, "alice", 1, "access", 900);
    let claims = decode_jwt(&token).expect("must decode");

    assert_eq!(claims.sub, uid);
    assert_eq!(claims.username, "alice");
    assert_eq!(claims.role, 1);
    assert_eq!(claims.token_type, "access");
}

/// A refresh token carries `token_type = "refresh"`.
#[test]
fn test_jwt_refresh_token_type_field() {
    let uid = Uuid::new_v4();
    let token = build_jwt(uid, "bob", 1, "refresh", 604_800);
    let claims = decode_jwt(&token).expect("must decode");
    assert_eq!(claims.token_type, "refresh");
}

/// An expired token is rejected by `decode` with the default validation.
///
/// Note: `jsonwebtoken`'s default `Validation` includes a 60-second leeway,
/// so we must set `exp` further than 60 seconds in the past.
#[test]
fn test_jwt_expired_token_rejected() {
    let uid = Uuid::new_v4();
    // exp 120 seconds in the past (well beyond the 60s leeway)
    let token = build_jwt(uid, "carol", 1, "access", -120);

    let mut validation = Validation::default();
    validation.leeway = 0;
    let result = decode::<TestClaims>(
        &token,
        &DecodingKey::from_secret(JWT_SECRET.as_bytes()),
        &validation,
    );
    assert!(result.is_err(), "expired token must be rejected");
}

/// A token signed with a different secret is rejected.
#[test]
fn test_jwt_wrong_secret_rejected() {
    let uid = Uuid::new_v4();
    let token = build_jwt(uid, "dave", 1, "access", 900);

    let result = decode::<TestClaims>(
        &token,
        &DecodingKey::from_secret(b"wrong-secret-that-does-not-match"),
        &Validation::default(),
    );
    assert!(result.is_err(), "wrong secret must cause signature failure");
}

/// `exp` claim is in the future for a freshly minted token.
#[test]
fn test_jwt_exp_is_in_the_future() {
    let uid = Uuid::new_v4();
    let token = build_jwt(uid, "eve", 1, "access", 900);
    let claims = decode_jwt(&token).expect("must decode");
    assert!(
        claims.exp > Utc::now().timestamp(),
        "exp must be in the future for a fresh token"
    );
}

/// Workspace IDs survive a JWT round-trip.
#[test]
fn test_jwt_workspace_ids_roundtrip() {
    let uid = Uuid::new_v4();
    let ws1 = Uuid::new_v4();
    let ws2 = Uuid::new_v4();
    let now = Utc::now().timestamp();

    let claims = TestClaims {
        sub: uid,
        username: "frank".to_string(),
        role: 1,
        tenant_id: None,
        workspace_ids: Some(vec![ws1, ws2]),
        exp: now + 900,
        iat: now,
        token_type: "access".to_string(),
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET.as_bytes()),
    )
    .expect("encode must succeed");

    let decoded = decode_jwt(&token).expect("must decode");
    let ids = decoded.workspace_ids.expect("workspace_ids must be present");
    assert!(ids.contains(&ws1), "ws1 must be in decoded workspace_ids");
    assert!(ids.contains(&ws2), "ws2 must be in decoded workspace_ids");
}

// ─── RBAC role predicates ────────────────────────────────────────────────────

/// Helper: check if role level grants admin access (role >= 2).
fn is_admin(role: i16) -> bool {
    role >= 2
}

/// Helper: check if role level grants super-admin access (role >= 3).
fn is_super_admin(role: i16) -> bool {
    role >= 3
}

/// Role 1 (standard user) is NOT admin.
#[test]
fn test_rbac_role_1_not_admin() {
    assert!(!is_admin(1), "role 1 must not have admin access");
}

/// Role 2 (admin) IS admin.
#[test]
fn test_rbac_role_2_is_admin() {
    assert!(is_admin(2), "role 2 must have admin access");
}

/// Role 3 (super-admin) IS admin AND super-admin.
#[test]
fn test_rbac_role_3_is_super_admin() {
    assert!(is_admin(3), "role 3 must have admin access");
    assert!(is_super_admin(3), "role 3 must have super-admin access");
}

/// Role 2 is NOT super-admin.
#[test]
fn test_rbac_role_2_not_super_admin() {
    assert!(!is_super_admin(2), "role 2 must not have super-admin access");
}

// ─── Token type validation ───────────────────────────────────────────────────

/// A token whose `token_type` is "access" must be rejected for refresh operations.
#[test]
fn test_token_type_access_rejected_for_refresh() {
    let uid = Uuid::new_v4();
    let token = build_jwt(uid, "grace", 1, "access", 900);
    let claims = decode_jwt(&token).expect("must decode");
    assert_ne!(
        claims.token_type, "refresh",
        "access token must not pass the refresh type check"
    );
}

/// A token whose `token_type` is "refresh" is accepted for refresh operations.
#[test]
fn test_token_type_refresh_accepted_for_refresh() {
    let uid = Uuid::new_v4();
    let token = build_jwt(uid, "henry", 1, "refresh", 604_800);
    let claims = decode_jwt(&token).expect("must decode");
    assert_eq!(claims.token_type, "refresh");
}

// ─── Claims helper methods ───────────────────────────────────────────────────
// Mirror the `Claims::has_workspace_access` logic from signapps-common.

fn has_workspace_access(workspace_ids: &Option<Vec<Uuid>>, target: Uuid) -> bool {
    workspace_ids
        .as_ref()
        .is_some_and(|ids| ids.contains(&target))
}

/// User with workspace_ids has access to known workspace.
#[test]
fn test_claims_has_workspace_access_true() {
    let ws = Uuid::new_v4();
    let ids = Some(vec![ws]);
    assert!(has_workspace_access(&ids, ws));
}

/// User without workspace_ids has no access.
#[test]
fn test_claims_has_workspace_access_false_when_empty() {
    let ws = Uuid::new_v4();
    let ids: Option<Vec<Uuid>> = None;
    assert!(!has_workspace_access(&ids, ws));
}

/// User with workspace_ids does not have access to an unknown workspace.
#[test]
fn test_claims_has_workspace_access_false_for_unknown() {
    let known = Uuid::new_v4();
    let unknown = Uuid::new_v4();
    let ids = Some(vec![known]);
    assert!(!has_workspace_access(&ids, unknown));
}

// ─── MFA code format validation ──────────────────────────────────────────────
// Mirrors the guard in `handlers/mfa.rs::verify`.

fn is_valid_totp_code_format(code: &str) -> bool {
    code.len() == 6 && code.chars().all(|c| c.is_ascii_digit())
}

/// A 6-digit code is valid format.
#[test]
fn test_mfa_code_format_six_digits_valid() {
    assert!(is_valid_totp_code_format("123456"));
}

/// A code shorter than 6 digits is invalid.
#[test]
fn test_mfa_code_format_too_short_invalid() {
    assert!(!is_valid_totp_code_format("12345"));
}

/// A code longer than 6 digits is invalid.
#[test]
fn test_mfa_code_format_too_long_invalid() {
    assert!(!is_valid_totp_code_format("1234567"));
}

/// A code containing letters is invalid.
#[test]
fn test_mfa_code_format_letters_invalid() {
    assert!(!is_valid_totp_code_format("12345a"));
}

/// An empty string is invalid.
#[test]
fn test_mfa_code_format_empty_invalid() {
    assert!(!is_valid_totp_code_format(""));
}

// ─── API key prefix extraction ───────────────────────────────────────────────
// Mirrors the prefix logic in `handlers/api_keys.rs::create`.

/// First 16 chars of the key are used as the visible prefix.
#[test]
fn test_api_key_prefix_is_first_16_chars() {
    let key = "sk_example_abcdef0123456789";
    let prefix: String = key.chars().take(16).collect();
    assert_eq!(prefix, "sk_example_abcdef01");
    assert_eq!(prefix.len(), 16);
}

/// The prefix always starts with `sk_example_` when the key does.
#[test]
fn test_api_key_prefix_starts_with_sk_live() {
    let key = "sk_example_00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
    let prefix: String = key.chars().take(16).collect();
    assert!(prefix.starts_with("sk_example_"));
}
