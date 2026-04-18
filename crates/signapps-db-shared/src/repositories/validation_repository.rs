//! `ValidationRepository` — CRUD for `core.validation_rules`.

use crate::models::validation_rule::{CreateValidationRule, UpdateValidationRule, ValidationRule};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for design validation rules.
pub struct ValidationRepository;

impl ValidationRepository {
    // ========================================================================
    // Listing
    // ========================================================================

    /// List validation rules for a tenant, optionally filtered to active-only.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn list(
        pool: &PgPool,
        tenant_id: Uuid,
        active_only: bool,
    ) -> Result<Vec<ValidationRule>> {
        let rows = sqlx::query_as::<_, ValidationRule>(
            r#"SELECT * FROM core.validation_rules
               WHERE tenant_id = $1
                 AND ($2::bool = FALSE OR is_active = TRUE)
               ORDER BY created_at"#,
        )
        .bind(tenant_id)
        .bind(active_only)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }

    // ========================================================================
    // Lookup
    // ========================================================================

    /// Find a validation rule by its ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<ValidationRule>> {
        let row = sqlx::query_as::<_, ValidationRule>(
            "SELECT * FROM core.validation_rules WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    // ========================================================================
    // Create
    // ========================================================================

    /// Create a new validation rule for a tenant.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on constraint violations.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        input: CreateValidationRule,
    ) -> Result<ValidationRule> {
        let row = sqlx::query_as::<_, ValidationRule>(
            r#"INSERT INTO core.validation_rules
                (tenant_id, name, rule_type, config, severity, applies_to)
               VALUES ($1, $2, $3, $4, COALESCE($5, 'warning'), COALESCE($6, '{document,spreadsheet,presentation}'))
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(&input.name)
        .bind(&input.rule_type)
        .bind(&input.config)
        .bind(&input.severity)
        .bind(&input.applies_to)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    // ========================================================================
    // Update
    // ========================================================================

    /// Update an existing validation rule.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no matching rule exists.
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        input: UpdateValidationRule,
    ) -> Result<ValidationRule> {
        let row = sqlx::query_as::<_, ValidationRule>(
            r#"UPDATE core.validation_rules SET
                name = COALESCE($2, name),
                config = COALESCE($3, config),
                severity = COALESCE($4, severity),
                is_active = COALESCE($5, is_active),
                applies_to = COALESCE($6, applies_to)
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.config)
        .bind(&input.severity)
        .bind(input.is_active)
        .bind(&input.applies_to)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if e.to_string().contains("no rows") {
                Error::NotFound(format!("Validation rule {id}"))
            } else {
                Error::Database(e.to_string())
            }
        })?;
        Ok(row)
    }

    // ========================================================================
    // Delete
    // ========================================================================

    /// Delete a validation rule.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no matching rule exists.
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        let result = sqlx::query("DELETE FROM core.validation_rules WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!("Validation rule {id}")));
        }
        Ok(())
    }
}
