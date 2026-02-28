---
name: rust_tracing_logging
description: Rules for observability, structured logging, and tracing
---
# Observability: Tracing and Logging in Rust

1. **No `println!`**: Do not use `println!` or `eprintln!` inside the backend services. All output must be structured.
2. **Setup**: The project uses the `tracing` ecosystem. Ensure `tracing::info!`, `tracing::error!`, `tracing::warn!`, or `tracing::debug!` are used.
3. **Instrumenting**: For complex asynchronous functions, apply `#[tracing::instrument(skip(pool, state, ...))]` macro on the function declaration. Be sure to skip large payloads or sensitive credentials (passwords, JWTs).
4. **Context**: Pass contextual data as key-value pairs (e.g., `tracing::info!(user_id = %user.id, action = "login", "User successfully authenticated");`).
5. **Errors context**: When logging errors, attach the error implicitly: `tracing::error!(error = %e, "Failed to perform operation");`.
