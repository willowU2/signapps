//! ProjectRepository — project and project member operations.

use crate::models::{CreateProject, Project, ProjectMember, ProjectWithStats, UpdateProject};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for project operations.
pub struct ProjectRepository;

impl ProjectRepository {
    /// Find project by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Project>> {
        let project = sqlx::query_as::<_, Project>(
            "SELECT * FROM calendar.projects WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(project)
    }

    /// List projects for a tenant with stats.
    pub async fn list_with_stats(
        pool: &PgPool,
        tenant_id: Uuid,
        workspace_id: Option<Uuid>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<ProjectWithStats>> {
        let projects = if let Some(ws_id) = workspace_id {
            sqlx::query_as::<_, ProjectWithStats>(
                r#"
                SELECT p.id, p.tenant_id, p.workspace_id, p.name, p.description, p.color,
                       p.status, p.start_date, p.due_date, p.owner_id, p.created_at,
                       COALESCE(COUNT(t.id), 0) as total_tasks,
                       COALESCE(COUNT(t.id) FILTER (WHERE t.status = 'completed'), 0) as completed_tasks
                FROM calendar.projects p
                LEFT JOIN calendar.tasks t ON p.id = t.project_id
                WHERE p.tenant_id = $1 AND p.workspace_id = $2 AND p.deleted_at IS NULL
                GROUP BY p.id
                ORDER BY p.created_at DESC
                LIMIT $3 OFFSET $4
                "#,
            )
            .bind(tenant_id)
            .bind(ws_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, ProjectWithStats>(
                r#"
                SELECT p.id, p.tenant_id, p.workspace_id, p.name, p.description, p.color,
                       p.status, p.start_date, p.due_date, p.owner_id, p.created_at,
                       COALESCE(COUNT(t.id), 0) as total_tasks,
                       COALESCE(COUNT(t.id) FILTER (WHERE t.status = 'completed'), 0) as completed_tasks
                FROM calendar.projects p
                LEFT JOIN calendar.tasks t ON p.id = t.project_id
                WHERE p.tenant_id = $1 AND p.deleted_at IS NULL
                GROUP BY p.id
                ORDER BY p.created_at DESC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(tenant_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(projects)
    }

    /// Create a new project.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        owner_id: Uuid,
        project: CreateProject,
    ) -> Result<Project> {
        let created = sqlx::query_as::<_, Project>(
            r#"
            INSERT INTO calendar.projects (
                tenant_id, workspace_id, name, description, color, icon,
                status, start_date, due_date, template_id, owner_id
            )
            VALUES ($1, $2, $3, $4, COALESCE($5, '#3B82F6'), $6,
                    COALESCE($7, 'planning'), $8, $9, $10, $11)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(project.workspace_id)
        .bind(&project.name)
        .bind(&project.description)
        .bind(&project.color)
        .bind(&project.icon)
        .bind(&project.status)
        .bind(project.start_date)
        .bind(project.due_date)
        .bind(project.template_id)
        .bind(owner_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Update a project.
    pub async fn update(pool: &PgPool, id: Uuid, update: UpdateProject) -> Result<Project> {
        let updated = sqlx::query_as::<_, Project>(
            r#"
            UPDATE calendar.projects
            SET workspace_id = COALESCE($2, workspace_id),
                name = COALESCE($3, name),
                description = COALESCE($4, description),
                color = COALESCE($5, color),
                icon = COALESCE($6, icon),
                status = COALESCE($7, status),
                start_date = COALESCE($8, start_date),
                due_date = COALESCE($9, due_date),
                metadata = COALESCE($10, metadata),
                updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(update.workspace_id)
        .bind(&update.name)
        .bind(&update.description)
        .bind(&update.color)
        .bind(&update.icon)
        .bind(&update.status)
        .bind(update.start_date)
        .bind(update.due_date)
        .bind(&update.metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }

    /// Soft delete a project.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE calendar.projects SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Add member to project.
    pub async fn add_member(
        pool: &PgPool,
        project_id: Uuid,
        user_id: Uuid,
        role: &str,
    ) -> Result<ProjectMember> {
        let created = sqlx::query_as::<_, ProjectMember>(
            r#"
            INSERT INTO calendar.project_members (project_id, user_id, role)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(project_id)
        .bind(user_id)
        .bind(role)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Remove member from project.
    pub async fn remove_member(pool: &PgPool, project_id: Uuid, user_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.project_members WHERE project_id = $1 AND user_id = $2")
            .bind(project_id)
            .bind(user_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}
