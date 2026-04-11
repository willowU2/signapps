//! Post-seed verification stubs — validates data integrity after seeding.

use tracing::info;

/// Runs integrity checks against seeded data.
///
/// # Errors
///
/// Returns an error if any integrity check fails.
pub async fn run(pool: &sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    info!("running seed verification");
    let _ = pool;
    Ok(())
}
