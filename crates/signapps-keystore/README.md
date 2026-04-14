<!-- cargo-rdme start -->

Master key management and per-usage DEK derivation for SignApps services.

# Overview

`signapps-keystore` loads a 32-byte master key at service boot from one of
three backends (env var, file, or remote KMS), then derives per-usage
[`DataEncryptionKey`]s on demand using HKDF-SHA256. Each DEK is cached in
an internal `DashMap` keyed by its `info` label, so derivation happens at
most once per unique usage.

# Why per-usage DEKs?

Deriving one DEK per usage (e.g. `"oauth-tokens-v1"`, `"saml-assertions-v1"`,
`"extra-params-v1"`) means compromise of one domain's DEK does not expose
the others. The info label is essentially a namespace for key material.

# Example

```rust
use signapps_keystore::{Keystore, KeystoreBackend, KeystoreError};

let ks = Keystore::init(KeystoreBackend::EnvVar).await?;
let dek = ks.dek("oauth-tokens-v1");
// Pass `dek` to signapps_common::crypto::EncryptedField::encrypt(...)
```

# Format of encrypted fields

The actual encryption is implemented by the `EncryptedField` trait in
`signapps-common::crypto`. Ciphertext format:

```text
version(1 byte) || nonce(12 bytes) || aes_gcm(plaintext, dek) || tag(16 bytes)
```

The version byte enables key rotation without downtime: future code can
try multiple DEKs in version order.

<!-- cargo-rdme end -->
