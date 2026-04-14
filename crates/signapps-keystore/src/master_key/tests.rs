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

#[test]
fn accepts_uppercase_hex() {
    let upper = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";
    let key = MasterKey::from_hex(upper).expect("uppercase hex");
    assert_eq!(key.0[0], 0x01);
    assert_eq!(key.0[31], 0xef);
}

#[test]
fn rejects_empty_string() {
    let err = MasterKey::from_hex("").unwrap_err();
    // Empty string decodes to 0 bytes, which fails the length check.
    assert!(matches!(err, KeystoreError::InvalidLength(0)));
}

#[test]
fn parses_via_fromstr() {
    let hex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    let key: MasterKey = hex.parse().expect("FromStr impl works");
    assert_eq!(key.0[0], 0x01);
}
