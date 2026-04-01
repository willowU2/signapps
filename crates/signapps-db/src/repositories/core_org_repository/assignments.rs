//! AssignmentRepository — person-to-node assignment operations including audit history.

use crate::models::core_org::{
    Assignment, AssignmentHistory, CreateAssignment, CreateAssignmentHistory, UpdateAssignment,
};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for person-to-node assignment operations including audit history.
pub struct AssignmentRepository;

impl AssignmentRepository {
    /// Create a new temporal assignment.
    pub async fn create(pool: &PgPool, input: CreateAssignment) -> Result<Assignment> {
        let assignment = sqlx::query_as::<_, Assignment>(
            r#"
            INSERT INTO core.assignments
                (person_id, node_id, assignment_type, responsibility_type,
                 start_date, end_date, fte_ratio, is_primary)
            VALUES ($1, $2,
                    COALESCE($3, 'holder')::core.assignment_type,
                    COALESCE($4, 'hierarchical')::core.responsibility_type,
                    COALESCE($5, CURRENT_DATE), $6,
                    COALESCE($7, 1.00), COALESCE($8, TRUE))
            RETURNING *
            "#,
        )
        .bind(input.person_id)
        .bind(input.node_id)
        .bind(&input.assignment_type)
        .bind(&input.responsibility_type)
        .bind(input.start_date)
        .bind(input.end_date)
        .bind(input.fte_ratio)
        .bind(input.is_primary)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(assignment)
    }

    /// Update mutable fields of an assignment.
    pub async fn update(pool: &PgPool, id: Uuid, input: UpdateAssignment) -> Result<Assignment> {
        let assignment = sqlx::query_as::<_, Assignment>(
            r#"
            UPDATE core.assignments SET
                assignment_type     = COALESCE($2::core.assignment_type, assignment_type),
                responsibility_type = COALESCE($3::core.responsibility_type, responsibility_type),
                end_date            = COALESCE($4, end_date),
                fte_ratio           = COALESCE($5, fte_ratio),
                is_primary          = COALESCE($6, is_primary),
                updated_at          = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.assignment_type)
        .bind(&input.responsibility_type)
        .bind(input.end_date)
        .bind(input.fte_ratio)
        .bind(input.is_primary)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(assignment)
    }

    /// End an assignment by setting its `end_date` to today (or a provided date).
    pub async fn end(
        pool: &PgPool,
        id: Uuid,
        end_date: Option<chrono::NaiveDate>,
    ) -> Result<Assignment> {
        let assignment = sqlx::query_as::<_, Assignment>(
            r#"
            UPDATE core.assignments
            SET end_date = COALESCE($2, CURRENT_DATE), updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(end_date)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(assignment)
    }

    /// List all assignments for a person (including historical).
    pub async fn list_by_person(pool: &PgPool, person_id: Uuid) -> Result<Vec<Assignment>> {
        let assignments = sqlx::query_as::<_, Assignment>(
            r#"
            SELECT * FROM core.assignments
            WHERE person_id = $1
            ORDER BY start_date DESC
            "#,
        )
        .bind(person_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(assignments)
    }

    /// List all assignments for an org node (including historical).
    pub async fn list_by_node(pool: &PgPool, node_id: Uuid) -> Result<Vec<Assignment>> {
        let assignments = sqlx::query_as::<_, Assignment>(
            r#"
            SELECT * FROM core.assignments
            WHERE node_id = $1
            ORDER BY start_date DESC
            "#,
        )
        .bind(node_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(assignments)
    }

    /// List currently active assignments (no end_date or end_date in the future).
    pub async fn list_active(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<Assignment>> {
        let assignments = sqlx::query_as::<_, Assignment>(
            r#"
            SELECT a.* FROM core.assignments a
            JOIN core.org_nodes n ON n.id = a.node_id
            JOIN core.org_trees t ON t.id = n.tree_id
            WHERE t.tenant_id = $1
              AND a.start_date <= CURRENT_DATE
              AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
            ORDER BY a.start_date DESC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(assignments)
    }

    /// Append a forensic audit entry to the assignment history.
    pub async fn log_history(
        pool: &PgPool,
        input: CreateAssignmentHistory,
    ) -> Result<AssignmentHistory> {
        let entry = sqlx::query_as::<_, AssignmentHistory>(
            r#"
            INSERT INTO core.assignment_history
                (assignment_id, action, changed_by, changes, reason, effective_date)
            VALUES ($1, $2::core.assignment_action, $3, COALESCE($4, '{}'), $5, $6)
            RETURNING *
            "#,
        )
        .bind(input.assignment_id)
        .bind(&input.action)
        .bind(input.changed_by)
        .bind(&input.changes)
        .bind(&input.reason)
        .bind(input.effective_date)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(entry)
    }

    /// Get the full audit trail for a single assignment, newest first.
    pub async fn get_history(pool: &PgPool, assignment_id: Uuid) -> Result<Vec<AssignmentHistory>> {
        let history = sqlx::query_as::<_, AssignmentHistory>(
            r#"
            SELECT * FROM core.assignment_history
            WHERE assignment_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(assignment_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(history)
    }

    /// Find an assignment by primary key.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Assignment>> {
        let a = sqlx::query_as::<_, Assignment>("SELECT * FROM core.assignments WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(a)
    }
}
