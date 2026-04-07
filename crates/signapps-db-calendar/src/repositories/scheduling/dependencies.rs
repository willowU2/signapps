//! TimeItemDependencyRepository — dependency operations between time items.

use crate::models::{AddDependency, TimeItemDependency};
use signapps_db_shared::DatabasePool;
use signapps_common::Result;
use uuid::Uuid;

/// Repository for managing scheduling dependencies between time items.
pub struct TimeItemDependencyRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> TimeItemDependencyRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// List all dependencies for a time item.
    pub async fn list_dependencies(&self, time_item_id: Uuid) -> Result<Vec<TimeItemDependency>> {
        let deps = sqlx::query_as::<_, TimeItemDependency>(
            "SELECT * FROM scheduling.time_item_dependencies WHERE time_item_id = $1 ORDER BY created_at",
        )
        .bind(time_item_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(deps)
    }

    /// List items that depend on a given item (dependents).
    pub async fn list_dependents(&self, time_item_id: Uuid) -> Result<Vec<TimeItemDependency>> {
        let deps = sqlx::query_as::<_, TimeItemDependency>(
            "SELECT * FROM scheduling.time_item_dependencies WHERE depends_on_id = $1 ORDER BY created_at",
        )
        .bind(time_item_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(deps)
    }

    /// Add a dependency.
    pub async fn add_dependency(
        &self,
        time_item_id: Uuid,
        dep: AddDependency,
    ) -> Result<TimeItemDependency> {
        let added = sqlx::query_as::<_, TimeItemDependency>(
            r#"
            INSERT INTO scheduling.time_item_dependencies (time_item_id, depends_on_id, dependency_type, lag_minutes)
            VALUES ($1, $2, COALESCE($3, 'finish_to_start'), COALESCE($4, 0))
            RETURNING *
            "#,
        )
        .bind(time_item_id)
        .bind(dep.depends_on_id)
        .bind(&dep.dependency_type)
        .bind(dep.lag_minutes)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(added)
    }

    /// Remove a dependency.
    pub async fn remove_dependency(&self, time_item_id: Uuid, depends_on_id: Uuid) -> Result<()> {
        sqlx::query(
            "DELETE FROM scheduling.time_item_dependencies WHERE time_item_id = $1 AND depends_on_id = $2",
        )
        .bind(time_item_id)
        .bind(depends_on_id)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }
}
