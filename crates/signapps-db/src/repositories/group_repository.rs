//! Group repository for RBAC operations.

use crate::models::{
    CreateGroup, CreateRole, CreateWebhook, Group, GroupMember, GroupMemberWithUser, Role, Webhook,
};
use crate::DatabasePool;
use signapps_common::Result;
use uuid::Uuid;

/// Repository for group and RBAC operations.
pub struct GroupRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> GroupRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    // === Groups ===

    /// Find group by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<Group>> {
        let group = sqlx::query_as::<_, Group>("SELECT * FROM identity.groups WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool.inner())
            .await?;

        Ok(group)
    }

    /// List all groups.
    pub async fn list(&self, limit: i64, offset: i64) -> Result<Vec<Group>> {
        let groups = sqlx::query_as::<_, Group>(
            "SELECT * FROM identity.groups ORDER BY name LIMIT $1 OFFSET $2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(groups)
    }

    /// Create a new group.
    pub async fn create(&self, group: CreateGroup) -> Result<Group> {
        let created = sqlx::query_as::<_, Group>(
            r#"
            INSERT INTO identity.groups (name, description, parent_id)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(&group.name)
        .bind(&group.description)
        .bind(group.parent_id)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update an existing group.
    pub async fn update(&self, id: Uuid, group: CreateGroup) -> Result<Group> {
        let updated = sqlx::query_as::<_, Group>(
            r#"
            UPDATE identity.groups
            SET name = $2, description = $3, parent_id = $4, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&group.name)
        .bind(&group.description)
        .bind(group.parent_id)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Delete a group.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM identity.groups WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }

    /// Add member to group.
    pub async fn add_member(&self, group_id: Uuid, user_id: Uuid, role: &str) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO identity.group_members (group_id, user_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (group_id, user_id) DO UPDATE SET role = $3
            "#,
        )
        .bind(group_id)
        .bind(user_id)
        .bind(role)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Remove member from group.
    pub async fn remove_member(&self, group_id: Uuid, user_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM identity.group_members WHERE group_id = $1 AND user_id = $2")
            .bind(group_id)
            .bind(user_id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }

    /// List group members.
    pub async fn list_members(&self, group_id: Uuid) -> Result<Vec<GroupMember>> {
        let members = sqlx::query_as::<_, GroupMember>(
            "SELECT * FROM identity.group_members WHERE group_id = $1",
        )
        .bind(group_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(members)
    }

    /// List group members with user details.
    pub async fn list_members_with_users(
        &self,
        group_id: Uuid,
    ) -> Result<Vec<GroupMemberWithUser>> {
        let members = sqlx::query_as::<_, GroupMemberWithUser>(
            r#"
            SELECT gm.user_id, u.username, u.email, u.full_name, gm.role, gm.added_at
            FROM identity.group_members gm
            INNER JOIN identity.users u ON gm.user_id = u.id
            WHERE gm.group_id = $1
            ORDER BY gm.added_at DESC
            "#,
        )
        .bind(group_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(members)
    }

    /// Count members in a group.
    pub async fn count_members(&self, group_id: Uuid) -> Result<i32> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM identity.group_members WHERE group_id = $1")
                .bind(group_id)
                .fetch_one(self.pool.inner())
                .await?;

        Ok(count.0 as i32)
    }

    /// Count members for multiple groups in a single query.
    pub async fn count_members_batch(
        &self,
        group_ids: &[Uuid],
    ) -> Result<std::collections::HashMap<Uuid, i32>> {
        let rows: Vec<(Uuid, i64)> = sqlx::query_as(
            "SELECT group_id, COUNT(*) FROM identity.group_members \
             WHERE group_id = ANY($1) GROUP BY group_id",
        )
        .bind(group_ids)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(rows
            .into_iter()
            .map(|(id, count)| (id, count as i32))
            .collect())
    }

    /// Get user's groups.
    pub async fn get_user_groups(&self, user_id: Uuid) -> Result<Vec<Group>> {
        let groups = sqlx::query_as::<_, Group>(
            r#"
            SELECT g.* FROM identity.groups g
            INNER JOIN identity.group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = $1
            "#,
        )
        .bind(user_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(groups)
    }

    // === Roles ===

    /// Find role by ID.
    pub async fn find_role(&self, id: Uuid) -> Result<Option<Role>> {
        let role = sqlx::query_as::<_, Role>("SELECT * FROM identity.roles WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool.inner())
            .await?;

        Ok(role)
    }

    /// List all roles.
    pub async fn list_roles(&self) -> Result<Vec<Role>> {
        let roles = sqlx::query_as::<_, Role>("SELECT * FROM identity.roles ORDER BY name")
            .fetch_all(self.pool.inner())
            .await?;

        Ok(roles)
    }

    /// Create a new role.
    pub async fn create_role(&self, role: CreateRole) -> Result<Role> {
        let created = sqlx::query_as::<_, Role>(
            r#"
            INSERT INTO identity.roles (name, description, permissions)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(&role.name)
        .bind(&role.description)
        .bind(&role.permissions)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update an existing role (non-system only).
    pub async fn update_role(&self, id: Uuid, role: CreateRole) -> Result<Role> {
        let updated = sqlx::query_as::<_, Role>(
            r#"
            UPDATE identity.roles
            SET name = $2, description = $3, permissions = $4
            WHERE id = $1 AND is_system = FALSE
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&role.name)
        .bind(&role.description)
        .bind(&role.permissions)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Delete a role (non-system only).
    pub async fn delete_role(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM identity.roles WHERE id = $1 AND is_system = FALSE")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }

    // === Webhooks ===

    /// Find webhook by ID.
    pub async fn find_webhook(&self, id: Uuid) -> Result<Option<Webhook>> {
        let webhook = sqlx::query_as::<_, Webhook>("SELECT * FROM identity.webhooks WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool.inner())
            .await?;

        Ok(webhook)
    }

    /// List all webhooks.
    pub async fn list_webhooks(&self) -> Result<Vec<Webhook>> {
        let webhooks =
            sqlx::query_as::<_, Webhook>("SELECT * FROM identity.webhooks ORDER BY name")
                .fetch_all(self.pool.inner())
                .await?;

        Ok(webhooks)
    }

    /// Create a new webhook.
    pub async fn create_webhook(&self, webhook: CreateWebhook) -> Result<Webhook> {
        let created = sqlx::query_as::<_, Webhook>(
            r#"
            INSERT INTO identity.webhooks (name, url, secret, events, headers, enabled)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(&webhook.name)
        .bind(&webhook.url)
        .bind(&webhook.secret)
        .bind(&webhook.events)
        .bind(webhook.headers.unwrap_or_default())
        .bind(webhook.enabled)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update an existing webhook.
    pub async fn update_webhook(
        &self,
        id: Uuid,
        name: &str,
        url: &str,
        events: &[String],
        enabled: bool,
        secret: Option<&String>,
        headers: Option<&serde_json::Value>,
    ) -> Result<Webhook> {
        let updated = sqlx::query_as::<_, Webhook>(
            r#"
            UPDATE identity.webhooks
            SET name = $2, url = $3, events = $4, enabled = $5, secret = $6, headers = COALESCE($7, headers), updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#
        )
        .bind(id)
        .bind(name)
        .bind(url)
        .bind(events)
        .bind(enabled)
        .bind(secret)
        .bind(headers)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Update webhook status after test/trigger.
    pub async fn update_webhook_status(&self, id: Uuid, status_code: i32) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE identity.webhooks
            SET last_triggered = NOW(), last_status = $2, updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(status_code)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Delete a webhook.
    pub async fn delete_webhook(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM identity.webhooks WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}
