//! Integration tests for the top-level Keystore struct.

use signapps_keystore::{Keystore, KeystoreBackend};
use std::sync::Arc;

const HEX: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/// Build a Keystore from a uniquely-named env var. The var is removed
/// after `init` returns, so concurrent tests do not interfere.
async fn new_keystore() -> Keystore {
    let var = format!(
        "CACHE_TEST_{}",
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
    ks
}

#[tokio::test]
async fn caches_same_dek_instance() {
    let ks = new_keystore().await;
    let a = ks.dek("oauth-tokens-v1");
    let b = ks.dek("oauth-tokens-v1");
    assert!(
        Arc::ptr_eq(&a, &b),
        "same info should return the same Arc (cache hit)"
    );
}

#[tokio::test]
async fn different_info_different_instances() {
    let ks = new_keystore().await;
    let a = ks.dek("oauth-tokens-v1");
    let b = ks.dek("saml-assertions-v1");
    assert!(
        !Arc::ptr_eq(&a, &b),
        "different info should return different Arcs (distinct cache entries)"
    );
}

#[tokio::test]
async fn dek_is_thread_safe() {
    let ks = Arc::new(new_keystore().await);
    let mut handles = vec![];
    // Spawn 10 concurrent tasks, all requesting the same DEK. DashMap::entry
    // guarantees atomic insert-if-absent, so exactly one derivation happens.
    for _ in 0..10 {
        let ks = ks.clone();
        handles.push(tokio::spawn(async move {
            let dek = ks.dek("oauth-tokens-v1");
            // Force the ref to be observed (prevent the compiler from
            // optimizing the whole task body away).
            assert_eq!(dek.expose_bytes().len(), 32);
        }));
    }
    for h in handles {
        h.await.unwrap();
    }
}

#[tokio::test]
async fn concurrent_different_infos_all_distinct() {
    let ks = Arc::new(new_keystore().await);
    let labels: &'static [&'static str] = &[
        "oauth-tokens-v1",
        "saml-assertions-v1",
        "extra-params-v1",
        "test-1",
        "test-2",
    ];
    let mut handles = vec![];
    for label in labels {
        let ks = ks.clone();
        let label = *label;
        handles.push(tokio::spawn(async move {
            let dek = ks.dek(label);
            dek.expose_bytes().to_vec()
        }));
    }
    let mut all_bytes: Vec<Vec<u8>> = vec![];
    for h in handles {
        all_bytes.push(h.await.unwrap());
    }
    // All DEKs should differ pairwise.
    for i in 0..all_bytes.len() {
        for j in (i + 1)..all_bytes.len() {
            assert_ne!(
                all_bytes[i], all_bytes[j],
                "DEKs for {} and {} must differ",
                labels[i], labels[j]
            );
        }
    }
}
