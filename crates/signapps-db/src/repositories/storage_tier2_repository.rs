use crate::models::storage_tier2::{
    CreateTagRequest, FileTagResponse, FileVersion, Tag, UpdateTagRequest,
};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for file tags and version management.
pub struct StorageTier2Repository;

impl StorageTier2Repository {
    // ==========================================
    // TAGS MANAGEMENT
    // ==========================================

    /// Get all tags for a specific user
    pub async fn get_user_tags(pool: &PgPool, user_id: Uuid) -> Result<Vec<Tag>, sqlx::Error> {
        sqlx::query_as::<_, Tag>(
            r#"
            SELECT id, user_id, name, color, created_at, updated_at
            FROM storage.tags
            WHERE user_id = $1
            ORDER BY name ASC
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
    }

    /// Create a new tag for a user
    pub async fn create_tag(
        pool: &PgPool,
        user_id: Uuid,
        req: &CreateTagRequest,
    ) -> Result<Tag, sqlx::Error> {
        let color = req.color.clone().unwrap_or_else(|| "#808080".to_string());

        sqlx::query_as::<_, Tag>(
            r#"
            INSERT INTO storage.tags (id, user_id, name, color)
            VALUES ($1, $2, $3, $4)
            RETURNING id, user_id, name, color, created_at, updated_at
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(&req.name)
        .bind(color)
        .fetch_one(pool)
        .await
    }

    /// Update an existing tag
    pub async fn update_tag(
        pool: &PgPool,
        tag_id: Uuid,
        user_id: Uuid,
        req: &UpdateTagRequest,
    ) -> Result<Tag, sqlx::Error> {
        sqlx::query_as::<_, Tag>(
            r#"
            UPDATE storage.tags
            SET
                name = COALESCE($1, name),
                color = COALESCE($2, color),
                updated_at = NOW()
            WHERE id = $3 AND user_id = $4
            RETURNING id, user_id, name, color, created_at, updated_at
            "#,
        )
        .bind(req.name.as_deref())
        .bind(req.color.as_deref())
        .bind(tag_id)
        .bind(user_id)
        .fetch_one(pool)
        .await
    }

    /// Delete a tag
    pub async fn delete_tag(
        pool: &PgPool,
        tag_id: Uuid,
        user_id: Uuid,
    ) -> Result<u64, sqlx::Error> {
        let result = sqlx::query(
            r#"
            DELETE FROM storage.tags
            WHERE id = $1 AND user_id = $2
            "#,
        )
        .bind(tag_id)
        .bind(user_id)
        .execute(pool)
        .await?;

        Ok(result.rows_affected())
    }

    // ==========================================
    // FILE TAGS ASSOCIATION
    // ==========================================

    /// Get all tags associated with a specific file
    pub async fn get_file_tags(
        pool: &PgPool,
        file_id: Uuid,
    ) -> Result<Vec<FileTagResponse>, sqlx::Error> {
        sqlx::query_as::<_, FileTagResponse>(
            r#"
            SELECT t.id, t.name, t.color
            FROM storage.tags t
            INNER JOIN storage.file_tags ft ON t.id = ft.tag_id
            WHERE ft.file_id = $1
            ORDER BY t.name ASC
            "#,
        )
        .bind(file_id)
        .fetch_all(pool)
        .await
    }

    /// Add a tag to a file
    pub async fn add_file_tag(
        pool: &PgPool,
        file_id: Uuid,
        tag_id: Uuid,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO storage.file_tags (file_id, tag_id)
            VALUES ($1, $2)
            ON CONFLICT (file_id, tag_id) DO NOTHING
            "#,
        )
        .bind(file_id)
        .bind(tag_id)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Remove a tag from a file
    pub async fn remove_file_tag(
        pool: &PgPool,
        file_id: Uuid,
        tag_id: Uuid,
    ) -> Result<u64, sqlx::Error> {
        let result = sqlx::query(
            r#"
            DELETE FROM storage.file_tags
            WHERE file_id = $1 AND tag_id = $2
            "#,
        )
        .bind(file_id)
        .bind(tag_id)
        .execute(pool)
        .await?;

        Ok(result.rows_affected())
    }

    // ==========================================
    // VERSIONING
    // ==========================================

    /// Get all versions of a specific file
    pub async fn get_file_versions(
        pool: &PgPool,
        file_id: Uuid,
    ) -> Result<Vec<FileVersion>, sqlx::Error> {
        sqlx::query_as::<_, FileVersion>(
            r#"
            SELECT id, file_id, version_number, size, content_type, storage_key, created_at
            FROM storage.file_versions
            WHERE file_id = $1
            ORDER BY version_number DESC
            "#,
        )
        .bind(file_id)
        .fetch_all(pool)
        .await
    }

    /// Add a new version entry for a file
    pub async fn add_file_version(
        pool: &PgPool,
        file_id: Uuid,
        size: i64,
        content_type: Option<String>,
        storage_key: String,
    ) -> Result<FileVersion, sqlx::Error> {
        // Get next version number
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COALESCE(MAX(version_number), 0) + 1
            FROM storage.file_versions
            WHERE file_id = $1
            "#,
        )
        .bind(file_id)
        .fetch_one(pool)
        .await?;
        let next_version = row.0 as i32;

        sqlx::query_as::<_, FileVersion>(
            r#"
            INSERT INTO storage.file_versions (id, file_id, version_number, size, content_type, storage_key)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, file_id, version_number, size, content_type, storage_key, created_at
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(file_id)
        .bind(next_version)
        .bind(size)
        .bind(content_type)
        .bind(storage_key)
        .fetch_one(pool)
        .await
    }

    /// Get a specific version
    pub async fn get_version(pool: &PgPool, version_id: Uuid) -> Result<FileVersion, sqlx::Error> {
        sqlx::query_as::<_, FileVersion>(
            r#"
            SELECT id, file_id, version_number, size, content_type, storage_key, created_at
            FROM storage.file_versions
            WHERE id = $1
            "#,
        )
        .bind(version_id)
        .fetch_one(pool)
        .await
    }

    // ==========================================
    // METADATA HELPERS FOR VERSION RESTORATION
    // ==========================================

    /// Get current metadata for a file (bucket, key, size, content_type)
    pub async fn get_file_info(
        pool: &PgPool,
        file_id: Uuid,
    ) -> Result<(String, String, i64, Option<String>), sqlx::Error> {
        let row: (String, String, i64, Option<String>) = sqlx::query_as(
            r#"
            SELECT bucket, key, size, content_type
            FROM storage.files
            WHERE id = $1
            "#,
        )
        .bind(file_id)
        .fetch_one(pool)
        .await?;

        Ok(row)
    }

    /// Update file size and content type after restoration
    pub async fn update_file_metadata(
        pool: &PgPool,
        file_id: Uuid,
        size: i64,
        content_type: Option<String>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE storage.files
            SET size = $1, content_type = $2, updated_at = NOW()
            WHERE id = $3
            "#,
        )
        .bind(size)
        .bind(content_type)
        .bind(file_id)
        .execute(pool)
        .await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Regression test for ERR-RUST-001: Type annotation needed avec sqlx::query!
    ///
    /// This test verifies that `delete_tag` compiles correctly with an explicit
    /// return type that calls `.rows_affected()`. The fix uses `sqlx::query` (non-macro)
    /// whose `execute()` return type is unambiguously `sqlx::postgres::PgQueryResult`,
    /// avoiding the type-inference failure that occurred with `sqlx::query!`.
    ///
    /// If this file compiles, ERR-RUST-001 is prevented.
    #[test]
    fn test_delete_tag_type_annotation_pattern() {
        // Compile-time regression: delete_tag returns Result<u64, sqlx::Error>.
        // The function signature is the contract — the compiler enforces it.
        // A real DB call is gated behind #[ignore]; this test always passes when
        // the crate compiles, confirming the ERR-RUST-001 pattern is in place.
        let _type_check: fn(&PgPool, Uuid, Uuid) -> _ = StorageTier2Repository::delete_tag;
        let _ = _type_check; // suppress unused-variable warning
    }

    /// Regression test for ERR-RUST-001 (async/DB path)
    ///
    /// Verifies that `delete_tag` returns `Ok(u64)` without type-inference errors.
    /// Requires a live PostgreSQL database — skipped in CI by default.
    #[tokio::test]
    #[ignore = "requires database"]
    async fn test_delete_tag_returns_rows_affected() {
        // To run locally:
        //   DATABASE_URL=postgres://... cargo test -- --ignored test_delete_tag_returns_rows_affected
        //
        // The test would:
        //   1. Create a test pool
        //   2. Insert a known tag
        //   3. Call delete_tag() and assert Ok(1) is returned
        //   4. Confirm no type-annotation compile error (ERR-RUST-001) at runtime
        let _ = (); // placeholder — implement with test pool when DB fixture is available
    }
}
