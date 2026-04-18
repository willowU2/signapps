//! Asserts that booting `signapps-platform` twice in a row emits zero
//! migration warnings on the second run (confirms idempotence of every
//! migration file).

use std::process::Command;

#[test]
#[ignore = "requires clean postgres; run with `cargo test -- --ignored`"]
fn double_boot_emits_no_migration_warnings() {
    for round in 1..=2 {
        let out = Command::new(env!("CARGO_BIN_EXE_signapps-platform"))
            .env("RUST_LOG", "warn")
            .env("SIGNAPPS_PLATFORM_EXIT_AFTER_BOOT", "1")
            .env(
                "DATABASE_URL",
                "postgres://signapps:signapps_dev@localhost:5432/signapps",
            )
            .env("JWT_SECRET", "x".repeat(32))
            .env(
                "KEYSTORE_MASTER_KEY",
                "0000000000000000000000000000000000000000000000000000000000000000",
            )
            .output()
            .expect("run platform");
        let stderr = String::from_utf8_lossy(&out.stderr);
        if round == 2 {
            assert!(
                !stderr.contains("already exists"),
                "migration warning detected on second boot:\n{stderr}"
            );
        }
    }
}
