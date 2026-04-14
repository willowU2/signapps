//! End-to-end sign/verify roundtrip + failure modes for FlowState.

use signapps_oauth::{FlowState, OAuthPurpose, StateError};
use uuid::Uuid;

const SECRET: &[u8] = b"0123456789abcdef0123456789abcdef";

fn mk_state() -> FlowState {
    FlowState::new(
        Uuid::new_v4(),
        "google".to_string(),
        OAuthPurpose::Login,
        "nonce-abc-def-123".to_string(),
    )
}

#[test]
fn sign_verify_roundtrip() {
    let s = mk_state();
    let token = s.sign(SECRET);
    let back = FlowState::verify(&token, SECRET).expect("verify");
    assert_eq!(back.flow_id, s.flow_id);
    assert_eq!(back.provider_key, s.provider_key);
}

#[test]
fn verify_rejects_tampered_payload() {
    let s = mk_state();
    let token = s.sign(SECRET);
    // Flip one byte in the payload section using a Vec<u8>
    let mut bytes: Vec<u8> = token.into_bytes();
    bytes[5] ^= 0x01;
    let token = String::from_utf8(bytes).unwrap();
    let err = FlowState::verify(&token, SECRET).unwrap_err();
    // Tampered payload either fails signature check, base64 decode, or JSON decode
    assert!(
        matches!(
            err,
            StateError::BadSignature | StateError::InvalidPayload(_) | StateError::Malformed
        ),
        "unexpected error: {err}"
    );
}

#[test]
fn verify_rejects_tampered_signature() {
    let s = mk_state();
    let token = s.sign(SECRET);
    let dot_pos = token.rfind('.').expect("token has separator");
    let (payload, sig) = token.split_at(dot_pos);
    let sig = &sig[1..]; // skip the '.'
                         // Flip the last character of the sig (still valid base64url chars, different bytes)
    let mut sig_bytes: Vec<u8> = sig.bytes().collect();
    let last = sig_bytes.len() - 1;
    sig_bytes[last] = if sig_bytes[last] == b'A' { b'B' } else { b'A' };
    let tampered = format!("{}.{}", payload, std::str::from_utf8(&sig_bytes).unwrap());
    let err = FlowState::verify(&tampered, SECRET).unwrap_err();
    assert!(
        matches!(err, StateError::BadSignature),
        "unexpected error: {err}"
    );
}

#[test]
fn verify_rejects_malformed_token() {
    let err = FlowState::verify("no-separator-here", SECRET).unwrap_err();
    assert!(
        matches!(err, StateError::Malformed),
        "unexpected error: {err}"
    );

    let err = FlowState::verify("not_base64.also_not", SECRET).unwrap_err();
    assert!(
        matches!(err, StateError::Malformed | StateError::BadSignature),
        "unexpected error: {err}"
    );
}

#[test]
fn verify_rejects_wrong_secret() {
    let s = mk_state();
    let token = s.sign(SECRET);
    let wrong = b"wrong-secret-never-used-this-00";
    let err = FlowState::verify(&token, wrong).unwrap_err();
    assert!(
        matches!(err, StateError::BadSignature),
        "unexpected error: {err}"
    );
}

#[test]
fn verify_rejects_expired_state() {
    let mut s = mk_state();
    s.issued_at = 0;
    s.expires_at = 1; // 1970-01-01 — definitely expired
    let token = s.sign(SECRET);
    let err = FlowState::verify(&token, SECRET).unwrap_err();
    assert!(
        matches!(err, StateError::Expired),
        "unexpected error: {err}"
    );
}
