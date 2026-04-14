use super::*;

const VALID_HEX: &str =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

#[test]
fn parses_valid_hex() {
    let key = MasterKey::from_hex(VALID_HEX).expect("valid hex");
    assert_eq!(key.0.len(), 32);
    assert_eq!(key.0[0], 0x01);
    assert_eq!(key.0[31], 0xef);
}

#[test]
fn accepts_surrounding_whitespace() {
    let padded = format!("  {}\n", VALID_HEX);
    let key = MasterKey::from_hex(&padded).expect("trimmed hex");
    assert_eq!(key.0[0], 0x01);
}

#[test]
fn rejects_invalid_hex() {
    let bad = "zzzz56789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0";
    let err = MasterKey::from_hex(bad).unwrap_err();
    assert!(matches!(err, KeystoreError::InvalidHex(_)));
}

#[test]
fn rejects_wrong_length() {
    let short = "0123456789abcdef"; // 8 bytes
    let err = MasterKey::from_hex(short).unwrap_err();
    assert!(matches!(err, KeystoreError::InvalidLength(8)));
}
