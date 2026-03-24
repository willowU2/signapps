use crate::models::entity_reference::EntityReference;
use sqlx::PgPool;
use uuid::Uuid;

pub struct EntityReferenceRepository {
    pool: PgPool,
}

impl EntityReferenceRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn link(
        &self,
        source_type: &str,
        source_id: Uuid,
        target_type: &str,
        target_id: Uuid,
        relation: &str,
        created_by: Option<Uuid>,
    ) -> Result<EntityReference, sqlx::Error> {
        sqlx::query_as::<_, EntityReference>(
            r#"INSERT INTO platform.entity_references (id, source_type, source_id, target_type, target_id, relation, created_by)
               VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5, $6)
               ON CONFLICT (source_type, source_id, target_type, target_id, relation) WHERE deleted_at IS NULL
               DO UPDATE SET deleted_at = NULL
               RETURNING *"#,
        )
        .bind(source_type)
        .bind(source_id)
        .bind(target_type)
        .bind(target_id)
        .bind(relation)
        .bind(created_by)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn unlink(&self, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE platform.entity_references SET deleted_at = now() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn find_links(
        &self,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<Vec<EntityReference>, sqlx::Error> {
        sqlx::query_as::<_, EntityReference>(
            r#"SELECT * FROM platform.entity_references
               WHERE deleted_at IS NULL
                 AND ((source_type = $1 AND source_id = $2) OR (target_type = $1 AND target_id = $2))
               ORDER BY created_at DESC"#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn find_links_by_type(
        &self,
        source_type: &str,
        source_id: Uuid,
        target_type: &str,
    ) -> Result<Vec<EntityReference>, sqlx::Error> {
        sqlx::query_as::<_, EntityReference>(
            r#"SELECT * FROM platform.entity_references
               WHERE deleted_at IS NULL AND source_type = $1 AND source_id = $2 AND target_type = $3
               ORDER BY created_at DESC"#,
        )
        .bind(source_type)
        .bind(source_id)
        .bind(target_type)
        .fetch_all(&self.pool)
        .await
    }
}
