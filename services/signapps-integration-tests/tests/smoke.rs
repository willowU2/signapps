//! Placeholder smoke test — compiles the common helpers module.
//!
//! Each real integration test lives in its own file (`provisioning_flow.rs`,
//! `grants_redirect.rs`, etc.) and declares `mod common;` to pull in the
//! shared spawn/seed/auth helpers.

mod common;

#[test]
fn smoke_common_module_compiles() {
    // This test is purely to ensure `common` compiles. Real scenarios are
    // `#[ignore]` and require a live backend.
}
