//! TemplateVariableRepository -- CRUD for template variables, datasets,
//! and social-media presets.

use crate::models::template_variable::{
    CreateDataset, CreateTemplateVariable, SocialPreset, TemplateDataset, TemplateVariable,
};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for template variables, datasets, and social presets.
pub struct TemplateVariableRepository;

impl TemplateVariableRepository {
    // ========================================================================
    // Variables
    // ========================================================================

    /// List all variables for a given template.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn list_variables(
        pool: &PgPool,
        template_id: Uuid,
    ) -> Result<Vec<TemplateVariable>> {
        sqlx::query_as::<_, TemplateVariable>(
            r#"SELECT * FROM core.template_variables
               WHERE template_id = $1
               ORDER BY name"#,
        )
        .bind(template_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Create a new template variable.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on constraint violations (e.g. duplicate
    /// name within the same template).
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn create_variable(
        pool: &PgPool,
        tenant_id: Uuid,
        template_id: Uuid,
        input: CreateTemplateVariable,
    ) -> Result<TemplateVariable> {
        sqlx::query_as::<_, TemplateVariable>(
            r#"INSERT INTO core.template_variables
                (tenant_id, template_id, name, variable_type, default_value, description, required)
               VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, false))
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(template_id)
        .bind(&input.name)
        .bind(&input.variable_type)
        .bind(&input.default_value)
        .bind(&input.description)
        .bind(input.required)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Delete a template variable by ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no variable with this ID exists.
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn delete_variable(pool: &PgPool, variable_id: Uuid) -> Result<()> {
        let result = sqlx::query("DELETE FROM core.template_variables WHERE id = $1")
            .bind(variable_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!(
                "Template variable {variable_id} not found"
            )));
        }
        Ok(())
    }

    // ========================================================================
    // Datasets
    // ========================================================================

    /// List all datasets for a given template.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn list_datasets(
        pool: &PgPool,
        template_id: Uuid,
    ) -> Result<Vec<TemplateDataset>> {
        sqlx::query_as::<_, TemplateDataset>(
            r#"SELECT * FROM core.template_datasets
               WHERE template_id = $1
               ORDER BY name"#,
        )
        .bind(template_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Create a new template dataset.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on constraint violations.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn create_dataset(
        pool: &PgPool,
        tenant_id: Uuid,
        template_id: Uuid,
        input: CreateDataset,
    ) -> Result<TemplateDataset> {
        sqlx::query_as::<_, TemplateDataset>(
            r#"INSERT INTO core.template_datasets
                (tenant_id, template_id, name, data)
               VALUES ($1, $2, $3, $4)
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(template_id)
        .bind(&input.name)
        .bind(&input.data)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Delete a template dataset by ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no dataset with this ID exists.
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn delete_dataset(pool: &PgPool, dataset_id: Uuid) -> Result<()> {
        let result = sqlx::query("DELETE FROM core.template_datasets WHERE id = $1")
            .bind(dataset_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!(
                "Template dataset {dataset_id} not found"
            )));
        }
        Ok(())
    }

    // ========================================================================
    // Social Presets
    // ========================================================================

    /// List all social media presets.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn list_social_presets(pool: &PgPool) -> Result<Vec<SocialPreset>> {
        sqlx::query_as::<_, SocialPreset>(
            "SELECT * FROM core.social_presets ORDER BY platform, format_name",
        )
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// List social media presets filtered by platform.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn list_social_presets_by_platform(
        pool: &PgPool,
        platform: &str,
    ) -> Result<Vec<SocialPreset>> {
        sqlx::query_as::<_, SocialPreset>(
            r#"SELECT * FROM core.social_presets
               WHERE platform = $1
               ORDER BY format_name"#,
        )
        .bind(platform)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }
}
