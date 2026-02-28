---
name: rust_error_handling
description: Best practices for robust error handling in Rust services
---
# Rust Error Handling Conventions

1. **Never Panic**: Do NOT use `.unwrap()`, `.expect()`, or `panic!()` in business logic or handlers. It crashes the multi-threaded Tokio runtime.
2. **Use `?` Operator**: Propagate errors upward using the `?` operator.
3. **The Common Error Type**: The project exposes a centralized `signapps_common::Error` (implementing RFC 7807 Problem Details). Use it.
4. **Mapping Errors**: When dealing with external libraries (e.g., `sqlx::Error`, `reqwest::Error`), leverage type coercion (`impl From`) or map specific errors meaningfully.
   ```rust
   use signapps_common::{Error, Result};
   
   // Good
   let user = repo.find_by_id(&pool, id).await?
       .ok_or(Error::NotFound("User not found".to_string()))?;
   ```
5. **Anyhow**: `anyhow::Result` is acceptable **ONLY** in CLI tools, scripts, or internal startup routines (e.g., `main.rs` setup). It MUST NOT be exposed on an HTTP API response.
