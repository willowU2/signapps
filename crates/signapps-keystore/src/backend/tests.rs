use super::*;

#[tokio::test]
async fn envvar_loads_valid_key() {
    let hex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    // Unique env var per test to avoid cross-test interference in parallel runs.
    let var = format!(
        "TEST_KEYSTORE_KEY_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );
    std::env::set_var(&var, hex);

    let key = KeystoreBackend::EnvVarNamed(var.clone())
        .load()
        .await
        .expect("load succeeds");
    assert_eq!(key.0[0], 0x01);
    assert_eq!(key.0[31], 0xef);

    std::env::remove_var(&var);
}

#[tokio::test]
async fn envvar_rejects_missing_var() {
    let var = "TEST_KEYSTORE_DEFINITELY_UNSET_1234567890";
    std::env::remove_var(var);
    let err = KeystoreBackend::EnvVarNamed(var.into())
        .load()
        .await
        .unwrap_err();
    assert!(matches!(err, KeystoreError::EnvVarNotSet));
}

#[tokio::test]
async fn envvar_rejects_empty_string() {
    let var = format!(
        "TEST_KEYSTORE_EMPTY_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );
    std::env::set_var(&var, "");
    let err = KeystoreBackend::EnvVarNamed(var.clone())
        .load()
        .await
        .unwrap_err();
    assert!(matches!(err, KeystoreError::EnvVarNotSet));
    std::env::remove_var(&var);
}
