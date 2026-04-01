//! TenantTaskRepository — tenant task (project task) operations.

use crate::models::{CreateTenantTask, TenantTask};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for tenant task operations.
pub struct TenantTaskRepository;

impl TenantTaskRepository {
    /// Find task by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<TenantTask>> {
        let task = sqlx::query_as::<_, TenantTask>(
            "SELECT * FROM calendar.tasks WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(task)
    }

    /// List tasks for a project.
    pub async fn list_by_project(pool: &PgPool, project_id: Uuid) -> Result<Vec<TenantTask>> {
        let tasks = sqlx::query_as::<_, TenantTask>(
            r#"
            SELECT * FROM calendar.tasks
            WHERE project_id = $1 AND deleted_at IS NULL
            ORDER BY position, created_at
            "#,
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tasks)
    }

    /// List subtasks for a parent task.
    pub async fn list_subtasks(pool: &PgPool, parent_task_id: Uuid) -> Result<Vec<TenantTask>> {
        let tasks = sqlx::query_as::<_, TenantTask>(
            r#"
            SELECT * FROM calendar.tasks
            WHERE parent_task_id = $1 AND deleted_at IS NULL
            ORDER BY position, created_at
            "#,
        )
        .bind(parent_task_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tasks)
    }

    /// Create a new task.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        created_by: Uuid,
        task: CreateTenantTask,
    ) -> Result<TenantTask> {
        let created = sqlx::query_as::<_, TenantTask>(
            r#"
            INSERT INTO calendar.tasks (
                tenant_id, calendar_id, project_id, parent_task_id, title, description,
                priority, position, due_date, estimated_hours, assigned_to, template_id, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 0), COALESCE($8, 0),
                    $9, $10, $11, $12, $13)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(task.calendar_id)
        .bind(task.project_id)
        .bind(task.parent_task_id)
        .bind(&task.title)
        .bind(&task.description)
        .bind(task.priority)
        .bind(task.position)
        .bind(task.due_date)
        .bind(task.estimated_hours)
        .bind(task.assigned_to)
        .bind(task.template_id)
        .bind(created_by)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Update task status.
    pub async fn update_status(pool: &PgPool, id: Uuid, status: &str) -> Result<TenantTask> {
        let completed_at = if status == "completed" {
            "NOW()"
        } else {
            "NULL"
        };

        let updated = sqlx::query_as::<_, TenantTask>(&format!(
            r#"
            UPDATE calendar.tasks
            SET status = $2,
                completed_at = {},
                updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
            "#,
            completed_at
        ))
        .bind(id)
        .bind(status)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }

    /// Update task position (for drag & drop).
    pub async fn update_position(pool: &PgPool, id: Uuid, position: i32) -> Result<()> {
        sqlx::query("UPDATE calendar.tasks SET position = $2, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .bind(position)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Soft delete a task.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE calendar.tasks SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}
