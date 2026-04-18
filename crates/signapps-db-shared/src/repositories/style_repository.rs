//! StyleRepository -- CRUD + cascade resolution for `core.style_definitions`
//! and `core.template_styles`.

use crate::models::style::{CreateStyle, ResolvedStyle, StyleDefinition, UpdateStyle};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for style definitions with cascade inheritance support.
pub struct StyleRepository;

impl StyleRepository {
    // ========================================================================
    // Listing
    // ========================================================================

    /// List styles for a tenant, optionally filtered by type and scope.
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
        style_type: Option<&str>,
        scope: Option<&str>,
    ) -> Result<Vec<StyleDefinition>> {
        let rows = sqlx::query_as::<_, StyleDefinition>(
            r#"SELECT * FROM core.style_definitions
               WHERE tenant_id = $1
                 AND ($2::text IS NULL OR style_type = $2)
                 AND ($3::text IS NULL OR scope = $3)
               ORDER BY is_builtin DESC, name"#,
        )
        .bind(tenant_id)
        .bind(style_type)
        .bind(scope)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }

    /// List styles associated with a specific template.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn list_for_template(
        pool: &PgPool,
        template_id: Uuid,
    ) -> Result<Vec<StyleDefinition>> {
        let rows = sqlx::query_as::<_, StyleDefinition>(
            r#"SELECT sd.* FROM core.style_definitions sd
               JOIN core.template_styles ts ON ts.style_id = sd.id
               WHERE ts.template_id = $1
               ORDER BY sd.name"#,
        )
        .bind(template_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }

    // ========================================================================
    // Lookup
    // ========================================================================

    /// Find a style by its ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<StyleDefinition>> {
        let row = sqlx::query_as::<_, StyleDefinition>(
            "SELECT * FROM core.style_definitions WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    /// Find a style by name within a tenant, preferring document > template > global scope.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn find_by_name(
        pool: &PgPool,
        tenant_id: Uuid,
        name: &str,
        style_type: &str,
    ) -> Result<Option<StyleDefinition>> {
        let row = sqlx::query_as::<_, StyleDefinition>(
            r#"SELECT * FROM core.style_definitions
               WHERE tenant_id = $1 AND name = $2 AND style_type = $3
               ORDER BY scope = 'document' DESC, scope = 'template' DESC, scope = 'global' DESC
               LIMIT 1"#,
        )
        .bind(tenant_id)
        .bind(name)
        .bind(style_type)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    // ========================================================================
    // Create / Update / Delete
    // ========================================================================

    /// Create a new style definition.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on constraint violations (e.g. duplicate name
    /// within the same tenant/scope/document).
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        input: CreateStyle,
    ) -> Result<StyleDefinition> {
        let row = sqlx::query_as::<_, StyleDefinition>(
            r#"INSERT INTO core.style_definitions
                (tenant_id, name, style_type, parent_id, properties, scope, document_id)
               VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'global'), $7)
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(&input.name)
        .bind(&input.style_type)
        .bind(input.parent_id)
        .bind(&input.properties)
        .bind(&input.scope)
        .bind(input.document_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    /// Update a style (non-builtin only).
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no matching non-builtin style exists.
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn update(pool: &PgPool, id: Uuid, input: UpdateStyle) -> Result<StyleDefinition> {
        let row = sqlx::query_as::<_, StyleDefinition>(
            r#"UPDATE core.style_definitions SET
                name = COALESCE($2, name),
                parent_id = COALESCE($3, parent_id),
                properties = COALESCE($4, properties),
                updated_at = NOW()
               WHERE id = $1 AND is_builtin = FALSE
               RETURNING *"#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(input.parent_id)
        .bind(&input.properties)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if e.to_string().contains("no rows") {
                Error::NotFound(format!("Style {id} (or is builtin)"))
            } else {
                Error::Database(e.to_string())
            }
        })?;
        Ok(row)
    }

    /// Delete a non-builtin style.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no matching non-builtin style exists.
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        let result = sqlx::query(
            "DELETE FROM core.style_definitions WHERE id = $1 AND is_builtin = FALSE",
        )
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!("Style {id} (or is builtin)")));
        }
        Ok(())
    }

    // ========================================================================
    // Cascade Resolution
    // ========================================================================

    /// Resolve a style by walking the parent chain and merging properties.
    ///
    /// Uses a recursive CTE to collect the full inheritance chain, then merges
    /// properties root-first so that child properties override parent values
    /// (like CSS cascade).
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if the style ID does not exist.
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn resolve(pool: &PgPool, id: Uuid) -> Result<ResolvedStyle> {
        // Recursive CTE walks the chain from leaf to root
        let rows = sqlx::query_as::<_, StyleDefinition>(
            r#"WITH RECURSIVE chain AS (
                SELECT * FROM core.style_definitions WHERE id = $1
                UNION ALL
                SELECT sd.* FROM core.style_definitions sd
                JOIN chain c ON sd.id = c.parent_id
            )
            SELECT * FROM chain"#,
        )
        .bind(id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        if rows.is_empty() {
            return Err(Error::NotFound(format!("Style {id}")));
        }

        // Merge properties: start from root (last in chain), override with child
        let mut merged = serde_json::Map::new();
        let mut chain_ids = Vec::new();

        // rows are ordered child-first; iterate root-first for proper cascade
        for row in rows.iter().rev() {
            chain_ids.push(row.id);
            if let serde_json::Value::Object(props) = &row.properties {
                for (key, value) in props {
                    merged.insert(key.clone(), value.clone());
                }
            }
        }

        // Reverse chain_ids back to child-first order
        chain_ids.reverse();

        let first = &rows[0];
        Ok(ResolvedStyle {
            id: first.id,
            name: first.name.clone(),
            style_type: first.style_type.clone(),
            properties: serde_json::Value::Object(merged),
            inheritance_chain: chain_ids,
        })
    }

    // ========================================================================
    // Template Associations
    // ========================================================================

    /// Associate a style with a template.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on constraint violations.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn add_to_template(pool: &PgPool, template_id: Uuid, style_id: Uuid) -> Result<()> {
        sqlx::query(
            "INSERT INTO core.template_styles (template_id, style_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        )
        .bind(template_id)
        .bind(style_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Remove a style from a template.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn remove_from_template(
        pool: &PgPool,
        template_id: Uuid,
        style_id: Uuid,
    ) -> Result<()> {
        sqlx::query(
            "DELETE FROM core.template_styles WHERE template_id = $1 AND style_id = $2",
        )
        .bind(template_id)
        .bind(style_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}
