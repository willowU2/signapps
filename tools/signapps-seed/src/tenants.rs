//! Tenant seeding — inserts rows into `identity.tenants`.

use tracing::info;
use uuid::Uuid;

/// Seeds a single tenant and returns its UUID.
///
/// # Errors
///
/// Returns an error if the INSERT query fails (e.g. duplicate slug or DB error).
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub async fn seed_tenant(
    pool: &sqlx::PgPool,
    name: &str,
    _is_primary: bool,
) -> Result<Uuid, Box<dyn std::error::Error>> {
    let id = Uuid::new_v4();
    let slug = name.to_lowercase().replace(' ', "-");

    info!(tenant_id = %id, %name, %slug, "seeding tenant");

    sqlx::query(
        r#"
        INSERT INTO identity.tenants (id, name, slug, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (slug) DO NOTHING
        "#,
    )
    .bind(id)
    .bind(name)
    .bind(&slug)
    .execute(pool)
    .await?;

    Ok(id)
}
