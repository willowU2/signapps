//! User seeding stubs — inserts users for each scenario.

use tracing::info;
use uuid::Uuid;

/// Seeds the minimal set of users (admin only) for a tenant.
///
/// Returns a list of `(user_id, tenant_id)` pairs.
///
/// # Errors
///
/// Returns an error if the database operation fails.
pub async fn seed_minimal(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
) -> Result<Vec<(Uuid, Uuid)>, Box<dyn std::error::Error>> {
    info!(%tenant_id, "seeding minimal users");
    let _ = pool;
    Ok(vec![(Uuid::new_v4(), tenant_id)])
}

/// Seeds the Acme Corp user set (admin + managers + employees).
///
/// Returns a list of `(user_id, tenant_id)` pairs.
///
/// # Errors
///
/// Returns an error if the database operation fails.
pub async fn seed_acme(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
) -> Result<Vec<(Uuid, Uuid)>, Box<dyn std::error::Error>> {
    info!(%tenant_id, "seeding acme users");
    let _ = pool;
    Ok(vec![
        (Uuid::new_v4(), tenant_id),
        (Uuid::new_v4(), tenant_id),
        (Uuid::new_v4(), tenant_id),
    ])
}

/// Seeds the Startup user set (small team).
///
/// Returns a list of `(user_id, tenant_id)` pairs.
///
/// # Errors
///
/// Returns an error if the database operation fails.
pub async fn seed_startup(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
) -> Result<Vec<(Uuid, Uuid)>, Box<dyn std::error::Error>> {
    info!(%tenant_id, "seeding startup users");
    let _ = pool;
    Ok(vec![(Uuid::new_v4(), tenant_id), (Uuid::new_v4(), tenant_id)])
}
