//! Container repository for database operations.

use crate::models::container::{Container, CreateContainer, UpdateQuota, UserQuota};
use signapps_db_shared::DatabasePool;
use signapps_common::Result;
use uuid::Uuid;

/// Repository for container operations.
pub struct ContainerRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> ContainerRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find container by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<Container>> {
        let container =
            sqlx::query_as::<_, Container>("SELECT * FROM containers.managed WHERE id = $1")
                .bind(id)
                .fetch_optional(self.pool.inner())
                .await?;

        Ok(container)
    }

    /// Find container by Docker ID.
    pub async fn find_by_docker_id(&self, docker_id: &str) -> Result<Option<Container>> {
        let container =
            sqlx::query_as::<_, Container>("SELECT * FROM containers.managed WHERE docker_id = $1")
                .bind(docker_id)
                .fetch_optional(self.pool.inner())
                .await?;

        Ok(container)
    }

    /// List all containers.
    pub async fn list(&self, limit: i64, offset: i64) -> Result<Vec<Container>> {
        let containers = sqlx::query_as::<_, Container>(
            "SELECT * FROM containers.managed ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(containers)
    }

    /// List containers by owner.
    pub async fn list_by_owner(&self, owner_id: Uuid) -> Result<Vec<Container>> {
        let containers = sqlx::query_as::<_, Container>(
            "SELECT * FROM containers.managed WHERE owner_id = $1 ORDER BY created_at DESC",
        )
        .bind(owner_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(containers)
    }

    /// Create a new container record.
    pub async fn create(
        &self,
        container: CreateContainer,
        owner_id: Option<Uuid>,
    ) -> Result<Container> {
        let created = sqlx::query_as::<_, Container>(
            r#"
            INSERT INTO containers.managed (name, image, config, labels, auto_update, owner_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(&container.name)
        .bind(&container.image)
        .bind(&container.config)
        .bind(&container.labels)
        .bind(container.auto_update.unwrap_or(false))
        .bind(owner_id)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update container Docker ID and status.
    pub async fn update_docker_info(&self, id: Uuid, docker_id: &str, status: &str) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE containers.managed
            SET docker_id = $2, status = $3, updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(docker_id)
        .bind(status)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Update container status.
    pub async fn update_status(&self, id: Uuid, status: &str) -> Result<()> {
        sqlx::query("UPDATE containers.managed SET status = $2, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .bind(status)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }

    /// Delete a container record.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM containers.managed WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }

    // === Quotas ===

    /// Get user quota.
    pub async fn get_quota(&self, user_id: Uuid) -> Result<Option<UserQuota>> {
        let quota = sqlx::query_as::<_, UserQuota>(
            "SELECT * FROM containers.user_quotas WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(quota)
    }

    /// Create or update user quota.
    pub async fn upsert_quota(&self, user_id: Uuid, update: UpdateQuota) -> Result<UserQuota> {
        let quota = sqlx::query_as::<_, UserQuota>(
            r#"
            INSERT INTO containers.user_quotas (user_id, max_containers, max_cpu_cores, max_memory_mb, max_storage_gb)
            VALUES ($1, COALESCE($2, 10), COALESCE($3, 4.0), COALESCE($4, 8192), COALESCE($5, 100))
            ON CONFLICT (user_id) DO UPDATE SET
                max_containers = COALESCE($2, containers.user_quotas.max_containers),
                max_cpu_cores = COALESCE($3, containers.user_quotas.max_cpu_cores),
                max_memory_mb = COALESCE($4, containers.user_quotas.max_memory_mb),
                max_storage_gb = COALESCE($5, containers.user_quotas.max_storage_gb),
                updated_at = NOW()
            RETURNING *
            "#
        )
        .bind(user_id)
        .bind(update.max_containers)
        .bind(update.max_cpu_cores)
        .bind(update.max_memory_mb)
        .bind(update.max_storage_gb)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(quota)
    }

    /// Increment current usage.
    pub async fn increment_usage(
        &self,
        user_id: Uuid,
        containers: i32,
        cpu: f64,
        memory: i32,
        storage: i32,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE containers.user_quotas SET
                current_containers = current_containers + $2,
                current_cpu_cores = current_cpu_cores + $3,
                current_memory_mb = current_memory_mb + $4,
                current_storage_gb = current_storage_gb + $5,
                updated_at = NOW()
            WHERE user_id = $1
            "#,
        )
        .bind(user_id)
        .bind(containers)
        .bind(cpu)
        .bind(memory)
        .bind(storage)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }
}
