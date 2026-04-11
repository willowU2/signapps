//! Chaos seeding stubs — high-volume randomised data for stress testing.

use tracing::info;

/// Seeds a large volume of randomised data across all domains.
///
/// # Errors
///
/// Returns an error if any database operation fails.
pub async fn seed_chaos(pool: &sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding chaos data");
    let _ = pool;
    Ok(())
}
