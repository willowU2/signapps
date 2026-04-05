//! Integration tests for Kerberos KDC components.

use signapps_ad_core::SecurityIdentifier;
use signapps_kerberos_kdc::{
    crypto::{aes_cts, checksum, key_derivation, rc4_hmac},
    pac::Pac,
};

#[test]
fn crypto_aes_cts_roundtrip() {
    let key = [0x42u8; 32];
    let plaintext = b"Kerberos TGT payload with session key and authorization data";

    let encrypted = aes_cts::encrypt(&key, plaintext);
    let decrypted = aes_cts::decrypt(&key, &encrypted).unwrap();

    assert_eq!(decrypted.as_slice(), plaintext.as_slice());
}

#[test]
fn crypto_rc4_hmac_roundtrip() {
    let key = key_derivation::nt_hash("TestPassword123");
    let plaintext = b"Service ticket data";

    let encrypted = rc4_hmac::encrypt(&key, 7, plaintext);
    let decrypted = rc4_hmac::decrypt(&key, 7, &encrypted).unwrap();

    assert_eq!(decrypted.as_slice(), plaintext.as_slice());
}

#[test]
fn crypto_key_derivation_deterministic() {
    let k1 = key_derivation::aes256_string_to_key("password", "EXAMPLE.COMadmin");
    let k2 = key_derivation::aes256_string_to_key("password", "EXAMPLE.COMadmin");
    assert_eq!(k1, k2);

    let k3 = key_derivation::aes256_string_to_key("different", "EXAMPLE.COMadmin");
    assert_ne!(k1, k3);
}

#[test]
fn pac_build_contains_groups() {
    let domain_sid = SecurityIdentifier::parse("S-1-5-21-100-200-300").unwrap();
    let pac = Pac::build(
        "admin",
        "Domain Admin",
        1000,
        &[512, 513, 519],
        &domain_sid,
        "EXAMPLE",
        "DC01",
        "admin@example.com",
        "example.com",
    );

    assert_eq!(pac.logon_info.effective_name, "admin");
    assert_eq!(pac.logon_info.group_ids.len(), 3);
    assert_eq!(pac.logon_info.primary_group_id, 513);
}

#[test]
fn checksum_hmac_sha1_96_is_12_bytes() {
    let key = [0x42u8; 32];
    let result = checksum::hmac_sha1_96_aes256(&key, b"test data");
    assert_eq!(result.len(), 12);
}
