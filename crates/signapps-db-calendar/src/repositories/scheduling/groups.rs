//! TimeItemGroupRepository — group participant operations on time items.

use crate::models::{AddTimeItemGroup, TimeItemGroup};
use signapps_common::Result;
use signapps_db_shared::DatabasePool;
use uuid::Uuid;

/// Repository for managing group participants on time items.
pub struct TimeItemGroupRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> TimeItemGroupRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// List all groups for a time item.
    pub async fn list_groups(&self, time_item_id: Uuid) -> Result<Vec<TimeItemGroup>> {
        let groups = sqlx::query_as::<_, TimeItemGroup>(
            "SELECT * FROM scheduling.time_item_groups WHERE time_item_id = $1 ORDER BY created_at",
        )
        .bind(time_item_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(groups)
    }

    /// Add a group to a time item.
    pub async fn add_group(
        &self,
        time_item_id: Uuid,
        group: AddTimeItemGroup,
    ) -> Result<TimeItemGroup> {
        let added = sqlx::query_as::<_, TimeItemGroup>(
            r#"
            INSERT INTO scheduling.time_item_groups (time_item_id, group_id, role)
            VALUES ($1, $2, COALESCE($3, 'participant'))
            ON CONFLICT (time_item_id, group_id) DO UPDATE SET
                role = COALESCE($3, time_item_groups.role)
            RETURNING *
            "#,
        )
        .bind(time_item_id)
        .bind(group.group_id)
        .bind(&group.role)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(added)
    }

    /// Remove a group from a time item.
    pub async fn remove_group(&self, time_item_id: Uuid, group_id: Uuid) -> Result<()> {
        sqlx::query(
            "DELETE FROM scheduling.time_item_groups WHERE time_item_id = $1 AND group_id = $2",
        )
        .bind(time_item_id)
        .bind(group_id)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }
}
