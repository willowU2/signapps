use crate::models::storage_tier2::{
    CreateTagRequest, FileTagResponse, FileVersion, Tag, UpdateTagRequest,
};
use sqlx::PgPool;
use uuid::Uuid;

pub struct StorageTier2Repository;

impl StorageTier2Repository {
    // ==========================================
    // TAGS MANAGEMENT
    // ==========================================

    /// Get all tags for a specific user
    pub async fn get_user_tags(pool: &PgPool, user_id: Uuid) -> Result<Vec<Tag>, sqlx::Error> {
        sqlx::query_as!(
            Tag,
            r#"
            SELECT id, user_id, name, color, created_at, updated_at
            FROM storage.tags
            WHERE user_id = $1
            ORDER BY name ASC
            "#,
            user_id
        )
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

        sqlx::query_as!(
            Tag,
            r#"
            INSERT INTO storage.tags (id, user_id, name, color)
            VALUES ($1, $2, $3, $4)
            RETURNING id, user_id, name, color, created_at, updated_at
            "#,
            Uuid::new_v4(),
            user_id,
            req.name,
            color
        )
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
        sqlx::query_as!(
            Tag,
            r#"
            UPDATE storage.tags
            SET
                name = COALESCE($1, name),
                color = COALESCE($2, color),
                updated_at = NOW()
            WHERE id = $3 AND user_id = $4
            RETURNING id, user_id, name, color, created_at, updated_at
            "#,
            req.name,
            req.color,
            tag_id,
            user_id
        )
        .fetch_one(pool)
        .await
    }

    /// Delete a tag
    pub async fn delete_tag(
        pool: &PgPool,
        tag_id: Uuid,
        user_id: Uuid,
    ) -> Result<u64, sqlx::Error> {
        let result = sqlx::query!(
            r#"
            DELETE FROM storage.tags
            WHERE id = $1 AND user_id = $2
            "#,
            tag_id,
            user_id
        )
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
        sqlx::query_as!(
            FileTagResponse,
            r#"
            SELECT t.id, t.name, t.color
            FROM storage.tags t
            INNER JOIN storage.file_tags ft ON t.id = ft.tag_id
            WHERE ft.file_id = $1
            ORDER BY t.name ASC
            "#,
            file_id
        )
        .fetch_all(pool)
        .await
    }

    /// Add a tag to a file
    pub async fn add_file_tag(
        pool: &PgPool,
        file_id: Uuid,
        tag_id: Uuid,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            r#"
            INSERT INTO storage.file_tags (file_id, tag_id)
            VALUES ($1, $2)
            ON CONFLICT (file_id, tag_id) DO NOTHING
            "#,
            file_id,
            tag_id
        )
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
        let result = sqlx::query!(
            r#"
            DELETE FROM storage.file_tags
            WHERE file_id = $1 AND tag_id = $2
            "#,
            file_id,
            tag_id
        )
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
        sqlx::query_as!(
            FileVersion,
            r#"
            SELECT id, file_id, version_number, size, content_type, storage_key, created_at
            FROM storage.file_versions
            WHERE file_id = $1
            ORDER BY version_number DESC
            "#,
            file_id
        )
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
        let next_version: i32 = sqlx::query_scalar!(
            r#"
            SELECT COALESCE(MAX(version_number), 0) + 1 as "next!"
            FROM storage.file_versions
            WHERE file_id = $1
            "#,
            file_id
        )
        .fetch_one(pool)
        .await?;

        sqlx::query_as!(
            FileVersion,
            r#"
            INSERT INTO storage.file_versions (id, file_id, version_number, size, content_type, storage_key)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, file_id, version_number, size, content_type, storage_key, created_at
            "#,
            Uuid::new_v4(),
            file_id,
            next_version,
            size,
            content_type,
            storage_key
        )
        .fetch_one(pool)
        .await
    }

    /// Get a specific version
    pub async fn get_version(pool: &PgPool, version_id: Uuid) -> Result<FileVersion, sqlx::Error> {
        sqlx::query_as!(
            FileVersion,
            r#"
            SELECT id, file_id, version_number, size, content_type, storage_key, created_at
            FROM storage.file_versions
            WHERE id = $1
            "#,
            version_id
        )
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
        let row = sqlx::query!(
            r#"
            SELECT bucket, key, size, content_type
            FROM storage.files
            WHERE id = $1
            "#,
            file_id
        )
        .fetch_one(pool)
        .await?;

        Ok((row.bucket, row.key, row.size, row.content_type))
    }

    /// Update file size and content type after restoration
    pub async fn update_file_metadata(
        pool: &PgPool,
        file_id: Uuid,
        size: i64,
        content_type: Option<String>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            r#"
            UPDATE storage.files
            SET size = $1, content_type = $2, updated_at = NOW()
            WHERE id = $3
            "#,
            size,
            content_type,
            file_id
        )
        .execute(pool)
        .await?;

        Ok(())
    }
}
