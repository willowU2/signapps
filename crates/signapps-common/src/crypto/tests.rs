use super::*;
use signapps_keystore::{Keystore, KeystoreBackend};
use std::sync::Arc;

const HEX: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/// Build a fresh keystore from a uniquely-named env var and return a DEK.
async fn test_dek() -> Arc<signapps_keystore::DataEncryptionKey> {
    let var = format!(
        "CRYPTO_TEST_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );
    std::env::set_var(&var, HEX);
    let ks = Keystore::init(KeystoreBackend::EnvVarNamed(var.clone()))
        .await
        .expect("init");
    std::env::remove_var(&var);
    ks.dek("test-v1")
}

#[tokio::test]
async fn roundtrip_short_plaintext() {
    let dek = test_dek().await;
    let pt = b"ya29.a0AfH6SMBxxx_short_token_here";
    let ct = <()>::encrypt(pt, &dek).expect("encrypt");
    let decrypted = <()>::decrypt(&ct, &dek).expect("decrypt");
    assert_eq!(decrypted, pt);
}

#[tokio::test]
async fn roundtrip_long_plaintext() {
    let dek = test_dek().await;
    let pt = vec![0xAAu8; 4096];
    let ct = <()>::encrypt(&pt, &dek).expect("encrypt");
    let decrypted = <()>::decrypt(&ct, &dek).expect("decrypt");
    assert_eq!(decrypted, pt);
}

#[tokio::test]
async fn roundtrip_empty_plaintext() {
    let dek = test_dek().await;
    let ct = <()>::encrypt(b"", &dek).expect("encrypt");
    let decrypted = <()>::decrypt(&ct, &dek).expect("decrypt");
    assert_eq!(decrypted, b"");
}

#[tokio::test]
async fn nonce_is_random() {
    let dek = test_dek().await;
    let pt = b"same plaintext";
    let ct1 = <()>::encrypt(pt, &dek).expect("encrypt");
    let ct2 = <()>::encrypt(pt, &dek).expect("encrypt");
    assert_ne!(ct1, ct2, "nonce reuse would be catastrophic; must be random");
}

#[tokio::test]
async fn version_byte_is_01() {
    let dek = test_dek().await;
    let ct = <()>::encrypt(b"test", &dek).expect("encrypt");
    assert_eq!(ct[0], 0x01);
}

#[tokio::test]
async fn ciphertext_length_equals_1_plus_12_plus_plaintext_plus_16() {
    let dek = test_dek().await;
    let pt_len = 128;
    let pt = vec![0u8; pt_len];
    let ct = <()>::encrypt(&pt, &dek).expect("encrypt");
    assert_eq!(ct.len(), 1 + 12 + pt_len + 16);
}

#[tokio::test]
async fn decrypt_rejects_too_short() {
    let dek = test_dek().await;
    let err = <()>::decrypt(&[0x01; 10], &dek).unwrap_err();
    assert!(matches!(err, CryptoError::TooShort(10)));
}

#[tokio::test]
async fn decrypt_rejects_unsupported_version() {
    let dek = test_dek().await;
    let fake = vec![0x99u8; 64];
    let err = <()>::decrypt(&fake, &dek).unwrap_err();
    assert!(matches!(err, CryptoError::UnsupportedVersion(0x99)));
}

#[tokio::test]
async fn decrypt_rejects_tampered_ciphertext() {
    let dek = test_dek().await;
    let mut ct = <()>::encrypt(b"original", &dek).expect("encrypt");
    let last = ct.len() - 1;
    ct[last] ^= 0x01;
    let err = <()>::decrypt(&ct, &dek).unwrap_err();
    assert!(matches!(err, CryptoError::AesGcm(_)));
}

#[tokio::test]
async fn decrypt_rejects_wrong_key() {
    let dek1 = test_dek().await;
    let ct = <()>::encrypt(b"payload", &dek1).expect("encrypt");

    // Different DEK (new keystore = different info will use same master,
    // but we use a different info label to get a distinct DEK).
    let var = format!(
        "CRYPTO_TEST_WRONG_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );
    std::env::set_var(&var, HEX);
    let ks = Keystore::init(KeystoreBackend::EnvVarNamed(var.clone()))
        .await
        .expect("init");
    std::env::remove_var(&var);
    let dek2 = ks.dek("different-v1");

    let err = <()>::decrypt(&ct, &dek2).unwrap_err();
    assert!(matches!(err, CryptoError::AesGcm(_)));
}
