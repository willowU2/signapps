//! Tenant seeding — inserts rows into `identity.tenants`.

use tracing::info;
use uuid::Uuid;

/// Seeds a single tenant by name and returns its UUID.
///
/// Uses a deterministic slug derived from the name. On conflict (slug already
/// exists) the existing row is left unchanged and the function still returns
/// the freshly-generated UUID.  Callers that need the canonical UUID for an
/// existing tenant should query for it separately; for seed scenarios where
/// `--reset` is used, the table will have been cleared first.
///
/// # Errors
///
/// Returns an error if the INSERT query fails for any reason other than a
/// duplicate slug.
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
    let slug = name
        .to_lowercase()
        .replace(' ', "-")
        .replace(['\'', '\''], "");

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
