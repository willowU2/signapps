use crate::models::activity::Activity;
use sqlx::PgPool;
use uuid::Uuid;

pub struct ActivityRepository {
    pool: PgPool,
}

impl ActivityRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn log(
        &self,
        actor_id: Uuid,
        action: &str,
        entity_type: &str,
        entity_id: Uuid,
        entity_title: Option<&str>,
        metadata: serde_json::Value,
        workspace_id: Option<Uuid>,
    ) -> Result<Activity, sqlx::Error> {
        sqlx::query_as::<_, Activity>(
            r#"INSERT INTO platform.activities (id, actor_id, action, entity_type, entity_id, entity_title, metadata, workspace_id)
               VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5, $6, $7)
               RETURNING *"#,
        )
        .bind(actor_id)
        .bind(action)
        .bind(entity_type)
        .bind(entity_id)
        .bind(entity_title)
        .bind(&metadata)
        .bind(workspace_id)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn get_feed(
        &self,
        workspace_id: Option<Uuid>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Activity>, sqlx::Error> {
        if let Some(ws) = workspace_id {
            sqlx::query_as::<_, Activity>(
                "SELECT * FROM platform.activities WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            )
            .bind(ws)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
        } else {
            sqlx::query_as::<_, Activity>(
                "SELECT * FROM platform.activities ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
        }
    }

    pub async fn get_entity_history(
        &self,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<Vec<Activity>, sqlx::Error> {
        sqlx::query_as::<_, Activity>(
            "SELECT * FROM platform.activities WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC",
        )
        .bind(entity_type)
        .bind(entity_id)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_user_recent(
        &self,
        actor_id: Uuid,
        limit: i64,
    ) -> Result<Vec<Activity>, sqlx::Error> {
        sqlx::query_as::<_, Activity>(
            "SELECT * FROM platform.activities WHERE actor_id = $1 ORDER BY created_at DESC LIMIT $2",
        )
        .bind(actor_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }
}
