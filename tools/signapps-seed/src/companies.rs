//! Company seeding stubs.

use tracing::info;
use uuid::Uuid;

/// Seeds Acme Corp company data.
///
/// # Errors
///
/// Returns an error if the database operation fails.
pub async fn seed_acme(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    info!(%tenant_id, "seeding acme companies");
    let _ = pool;
    Ok(())
}
