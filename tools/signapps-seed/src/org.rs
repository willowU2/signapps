//! Organisational structure seeding stubs.

use tracing::info;
use uuid::Uuid;

/// Seeds Acme Corp org structure (departments, teams, hierarchy).
///
/// # Errors
///
/// Returns an error if the database operation fails.
pub async fn seed_acme(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!(%tenant_id, users = user_ids.len(), "seeding acme org structure");
    let _ = pool;
    Ok(())
}
