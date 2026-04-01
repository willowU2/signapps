//! WorkspaceRepository — workspace and workspace member operations.

use crate::models::{
    AddWorkspaceMember, CreateWorkspace, UpdateWorkspace, Workspace, WorkspaceMember,
    WorkspaceMemberWithUser,
};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for workspace operations.
pub struct WorkspaceRepository;

impl WorkspaceRepository {
    /// Find workspace by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Workspace>> {
        let workspace =
            sqlx::query_as::<_, Workspace>("SELECT * FROM identity.workspaces WHERE id = $1")
                .bind(id)
                .fetch_optional(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        Ok(workspace)
    }

    /// List workspaces for a tenant.
    pub async fn list_by_tenant(
        pool: &PgPool,
        tenant_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Workspace>> {
        let workspaces = sqlx::query_as::<_, Workspace>(
            "SELECT * FROM identity.workspaces WHERE tenant_id = $1 ORDER BY name LIMIT $2 OFFSET $3",
        )
        .bind(tenant_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(workspaces)
    }

    /// List workspaces a user is member of.
    pub async fn list_by_user(pool: &PgPool, user_id: Uuid) -> Result<Vec<Workspace>> {
        let workspaces = sqlx::query_as::<_, Workspace>(
            r#"
            SELECT w.* FROM identity.workspaces w
            INNER JOIN identity.workspace_members wm ON w.id = wm.workspace_id
            WHERE wm.user_id = $1
            ORDER BY w.name
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(workspaces)
    }

    /// Create a new workspace.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        created_by: Uuid,
        workspace: CreateWorkspace,
    ) -> Result<Workspace> {
        let created = sqlx::query_as::<_, Workspace>(
            r#"
            INSERT INTO identity.workspaces (tenant_id, name, description, color, icon, is_default, created_by)
            VALUES ($1, $2, $3, COALESCE($4, '#3B82F6'), $5, COALESCE($6, FALSE), $7)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(&workspace.name)
        .bind(&workspace.description)
        .bind(&workspace.color)
        .bind(&workspace.icon)
        .bind(workspace.is_default)
        .bind(created_by)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Update a workspace.
    pub async fn update(pool: &PgPool, id: Uuid, update: UpdateWorkspace) -> Result<Workspace> {
        let updated = sqlx::query_as::<_, Workspace>(
            r#"
            UPDATE identity.workspaces
            SET name = COALESCE($2, name),
                description = COALESCE($3, description),
                color = COALESCE($4, color),
                icon = COALESCE($5, icon),
                is_default = COALESCE($6, is_default),
                settings = COALESCE($7, settings),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&update.name)
        .bind(&update.description)
        .bind(&update.color)
        .bind(&update.icon)
        .bind(update.is_default)
        .bind(&update.settings)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }

    /// Delete a workspace.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM identity.workspaces WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Add member to workspace.
    pub async fn add_member(
        pool: &PgPool,
        workspace_id: Uuid,
        member: AddWorkspaceMember,
    ) -> Result<WorkspaceMember> {
        let created = sqlx::query_as::<_, WorkspaceMember>(
            r#"
            INSERT INTO identity.workspace_members (workspace_id, user_id, role)
            VALUES ($1, $2, COALESCE($3, 'member'))
            RETURNING *
            "#,
        )
        .bind(workspace_id)
        .bind(member.user_id)
        .bind(&member.role)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// AQ-NP1Q: Batch-add a user to multiple workspaces in a single query.
    /// Uses unnest() to avoid N individual INSERT calls.
    pub async fn add_member_to_workspaces(
        pool: &PgPool,
        user_id: Uuid,
        workspace_ids: &[Uuid],
        role: &str,
    ) -> Result<()> {
        if workspace_ids.is_empty() {
            return Ok(());
        }
        // Build a single INSERT … SELECT unnest(…) statement
        sqlx::query(
            r#"
            INSERT INTO identity.workspace_members (workspace_id, user_id, role)
            SELECT unnest($1::uuid[]), $2, $3
            ON CONFLICT (workspace_id, user_id) DO NOTHING
            "#,
        )
        .bind(workspace_ids)
        .bind(user_id)
        .bind(role)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Remove member from workspace.
    pub async fn remove_member(pool: &PgPool, workspace_id: Uuid, user_id: Uuid) -> Result<()> {
        sqlx::query(
            "DELETE FROM identity.workspace_members WHERE workspace_id = $1 AND user_id = $2",
        )
        .bind(workspace_id)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// List workspace members with user details.
    pub async fn list_members(
        pool: &PgPool,
        workspace_id: Uuid,
    ) -> Result<Vec<WorkspaceMemberWithUser>> {
        let members = sqlx::query_as::<_, WorkspaceMemberWithUser>(
            r#"
            SELECT wm.id, wm.workspace_id, wm.user_id, u.username, u.email,
                   u.display_name, u.avatar_url, wm.role, wm.joined_at
            FROM identity.workspace_members wm
            INNER JOIN identity.users u ON wm.user_id = u.id
            WHERE wm.workspace_id = $1
            ORDER BY wm.joined_at
            "#,
        )
        .bind(workspace_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(members)
    }

    /// Update member role.
    pub async fn update_member_role(
        pool: &PgPool,
        workspace_id: Uuid,
        user_id: Uuid,
        role: &str,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE identity.workspace_members SET role = $3 WHERE workspace_id = $1 AND user_id = $2",
        )
        .bind(workspace_id)
        .bind(user_id)
        .bind(role)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}
