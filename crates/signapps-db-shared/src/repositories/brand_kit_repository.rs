//! BrandKitRepository -- CRUD for `core.brand_kits` (per-tenant visual identity).

use crate::models::brand_kit::{BrandKit, UpdateBrandKit};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for per-tenant brand kit management.
pub struct BrandKitRepository;

impl BrandKitRepository {
    /// Ensure a default brand kit exists for a tenant.
    ///
    /// Uses `INSERT ... ON CONFLICT DO NOTHING` so it is safe to call
    /// multiple times concurrently.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn ensure_exists(pool: &PgPool, tenant_id: Uuid) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO core.brand_kits (tenant_id)
               VALUES ($1)
               ON CONFLICT (tenant_id) DO NOTHING"#,
        )
        .bind(tenant_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Get the brand kit for a tenant, creating a default one if it does not exist.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    /// Returns `Error::NotFound` if the insert + select still yields no row
    /// (should not happen under normal conditions).
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn get(pool: &PgPool, tenant_id: Uuid) -> Result<BrandKit> {
        // Ensure a row exists (idempotent)
        Self::ensure_exists(pool, tenant_id).await?;

        let row = sqlx::query_as::<_, BrandKit>(
            "SELECT * FROM core.brand_kits WHERE tenant_id = $1",
        )
        .bind(tenant_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        row.ok_or_else(|| Error::NotFound(format!("BrandKit for tenant {tenant_id}")))
    }

    /// Update the brand kit for a tenant using the COALESCE pattern.
    ///
    /// Only non-`None` fields in `input` are applied; all other columns keep
    /// their current value.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no brand kit exists for the tenant.
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn update(
        pool: &PgPool,
        tenant_id: Uuid,
        input: UpdateBrandKit,
    ) -> Result<BrandKit> {
        // Ensure a row exists before updating
        Self::ensure_exists(pool, tenant_id).await?;

        let row = sqlx::query_as::<_, BrandKit>(
            r#"UPDATE core.brand_kits SET
                name            = COALESCE($2, name),
                primary_color   = COALESCE($3, primary_color),
                secondary_color = COALESCE($4, secondary_color),
                accent_color    = COALESCE($5, accent_color),
                danger_color    = COALESCE($6, danger_color),
                success_color   = COALESCE($7, success_color),
                colors          = COALESCE($8, colors),
                fonts           = COALESCE($9, fonts),
                logos            = COALESCE($10, logos),
                guidelines      = COALESCE($11, guidelines),
                updated_at      = NOW()
               WHERE tenant_id = $1
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(&input.name)
        .bind(&input.primary_color)
        .bind(&input.secondary_color)
        .bind(&input.accent_color)
        .bind(&input.danger_color)
        .bind(&input.success_color)
        .bind(&input.colors)
        .bind(&input.fonts)
        .bind(&input.logos)
        .bind(&input.guidelines)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if e.to_string().contains("no rows") {
                Error::NotFound(format!("BrandKit for tenant {tenant_id}"))
            } else {
                Error::Database(e.to_string())
            }
        })?;
        Ok(row)
    }
}
