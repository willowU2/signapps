---
name: rust_api_endpoint
description: How to create a new Rust Axum API endpoint in the services directory
---
# Creating a Rust API Endpoint

1. **Location**: Add handlers in `services/*/src/handlers/`.
2. **DTOs**: 
   - Request DTOs: `*Request` struct with `#[derive(Deserialize, Validate)]`
   - Response DTOs: `*Response` struct with `#[derive(Serialize)]`
3. **Function Signature**: 
   ```rust
   pub async fn handle_name(
       State(state): State<AppState>,
       Extension(claims): Extension<Claims>, // if auth required
       Json(payload): Json<MyRequest> // or Option<Query<MyQuery>>
   ) -> Result<Json<MyResponse>>
   ```
4. **Error Handling**: Return `Result<T, AppError>` (from `signapps_common::Error`). Do NOT use `unwrap()` or `expect()`. Use `?` operator.
5. **Database**: Use injected `state.pool` or similar to call Repositories in `crates/signapps-db/src/repositories/`.
6. **Naming**: Use `snake_case` (e.g., `list_users`, `create_container`).
