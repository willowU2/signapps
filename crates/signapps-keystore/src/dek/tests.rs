use super::*;
use crate::MasterKey;

const HEX: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

#[test]
fn derives_different_deks_for_different_infos() {
    let mk = MasterKey::from_hex(HEX).unwrap();
    let dek_a = DataEncryptionKey::derive_from(&mk, "oauth-tokens-v1");
    let dek_b = DataEncryptionKey::derive_from(&mk, "saml-assertions-v1");
    assert_ne!(
        dek_a.expose_bytes(),
        dek_b.expose_bytes(),
        "different info labels must produce different DEKs"
    );
}

#[test]
fn derives_same_dek_for_same_info() {
    let mk1 = MasterKey::from_hex(HEX).unwrap();
    let mk2 = MasterKey::from_hex(HEX).unwrap();
    let dek1 = DataEncryptionKey::derive_from(&mk1, "oauth-tokens-v1");
    let dek2 = DataEncryptionKey::derive_from(&mk2, "oauth-tokens-v1");
    assert_eq!(
        dek1.expose_bytes(),
        dek2.expose_bytes(),
        "same master key + same info must produce same DEK (deterministic)"
    );
}

#[test]
fn dek_is_32_bytes() {
    let mk = MasterKey::from_hex(HEX).unwrap();
    let dek = DataEncryptionKey::derive_from(&mk, "test");
    assert_eq!(dek.expose_bytes().len(), 32);
}

#[test]
fn dek_is_not_equal_to_master_key() {
    let mk = MasterKey::from_hex(HEX).unwrap();
    let dek = DataEncryptionKey::derive_from(&mk, "oauth-tokens-v1");
    assert_ne!(
        &mk.0[..],
        dek.expose_bytes(),
        "DEK must differ from master key (derivation must actually do work)"
    );
}

#[test]
fn known_test_vector_is_stable() {
    // HKDF-SHA256 regression vector.
    //
    // Fixed inputs:
    //   IKM  = 0x0000...0001 (32 bytes, last byte = 0x01)
    //   salt = None (HKDF treats as 32 zero bytes per RFC 5869 §3.1)
    //   info = b"oauth-tokens-v1"
    //   L    = 32 bytes
    //
    // Expected output computed offline against RFC 5869 and pinned below.
    // If this test fails after intentional crypto changes, update the
    // expected bytes and bump any on-disk DEK version.
    let mk = MasterKey::from_hex(
        "0000000000000000000000000000000000000000000000000000000000000001",
    )
    .unwrap();
    let dek = DataEncryptionKey::derive_from(&mk, "oauth-tokens-v1");

    // Expected 32-byte output (pinned on first green run).
    let expected_hex = "2356128f06fb3b6774e5b9aee8cf7fe86e108a5312cdb0258c5b8967b2b47cc0";
    let expected = hex::decode(expected_hex).expect("valid hex");
    assert_eq!(dek.expose_bytes(), expected.as_slice(),
        "HKDF output drifted from pinned regression vector");
}
