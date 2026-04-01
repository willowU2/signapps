//! TimeItemUserRepository — user participant operations on time items.

use crate::models::{AddTimeItemUser, TimeItemUser};
use crate::DatabasePool;
use signapps_common::Result;
use uuid::Uuid;

/// Repository for managing user participants on time items.
pub struct TimeItemUserRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> TimeItemUserRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// List all users for a time item.
    pub async fn list_users(&self, time_item_id: Uuid) -> Result<Vec<TimeItemUser>> {
        let users = sqlx::query_as::<_, TimeItemUser>(
            "SELECT * FROM scheduling.time_item_users WHERE time_item_id = $1 ORDER BY created_at",
        )
        .bind(time_item_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(users)
    }

    /// Add a user to a time item.
    pub async fn add_user(
        &self,
        time_item_id: Uuid,
        user: AddTimeItemUser,
    ) -> Result<TimeItemUser> {
        let added = sqlx::query_as::<_, TimeItemUser>(
            r#"
            INSERT INTO scheduling.time_item_users (time_item_id, user_id, role)
            VALUES ($1, $2, COALESCE($3, 'participant'))
            ON CONFLICT (time_item_id, user_id) DO UPDATE SET
                role = COALESCE($3, time_item_users.role)
            RETURNING *
            "#,
        )
        .bind(time_item_id)
        .bind(user.user_id)
        .bind(&user.role)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(added)
    }

    /// Update RSVP status for a user.
    pub async fn update_rsvp(
        &self,
        time_item_id: Uuid,
        user_id: Uuid,
        status: &str,
    ) -> Result<TimeItemUser> {
        let updated = sqlx::query_as::<_, TimeItemUser>(
            "UPDATE scheduling.time_item_users SET rsvp_status = $3, rsvp_at = NOW() WHERE time_item_id = $1 AND user_id = $2 RETURNING *",
        )
        .bind(time_item_id)
        .bind(user_id)
        .bind(status)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Remove a user from a time item.
    pub async fn remove_user(&self, time_item_id: Uuid, user_id: Uuid) -> Result<()> {
        sqlx::query(
            "DELETE FROM scheduling.time_item_users WHERE time_item_id = $1 AND user_id = $2",
        )
        .bind(time_item_id)
        .bind(user_id)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }
}
