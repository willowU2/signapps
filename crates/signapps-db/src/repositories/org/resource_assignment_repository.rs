//! CRUD for `org_resource_assignments` — SO9 multi-assign.
//!
//! Write pattern : pour chaque assignment update, on "close" la row
//! existante (UPDATE `end_at = now()`) puis INSERT une nouvelle row — ce
//! qui préserve l'historique. Le seul cas où on DELETE hard est en
//! tests / admin-tooling.

use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{AssignmentRole, AssignmentSubjectType, ResourceAssignment};

/// Repository for `org_resource_assignments`.
pub struct ResourceAssignmentRepository<'a> {
    pool: &'a PgPool,
}

/// Payload pour créer un assignment.
#[derive(Debug, Clone)]
pub struct NewResourceAssignment {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Ressource cible.
    pub resource_id: Uuid,
    /// Type de sujet.
    pub subject_type: AssignmentSubjectType,
    /// UUID du sujet.
    pub subject_id: Uuid,
    /// Rôle.
    pub role: AssignmentRole,
    /// Marqueur primaire (UX).
    pub is_primary: bool,
    /// Début de validité (défaut = now).
    pub start_at: Option<DateTime<Utc>>,
    /// Fin de validité (optionnel).
    pub end_at: Option<DateTime<Utc>>,
    /// Raison libre.
    pub reason: Option<String>,
    /// User qui crée l'assignment.
    pub created_by_user_id: Option<Uuid>,
}

impl<'a> ResourceAssignmentRepository<'a> {
    /// Bind to a pool.
    #[must_use]
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new assignment row.
    ///
    /// Le caller est responsable de :
    /// - fermer l'ancien owner actif via [`Self::end`] avant d'assigner un
    ///   nouveau `owner` (sinon violation unique).
    /// - désactiver `is_primary = true` sur les autres `primary_user` si
    ///   nécessaire.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error (FK, unique violation, …).
    pub async fn create(&self, input: NewResourceAssignment) -> Result<ResourceAssignment> {
        let row = sqlx::query_as::<_, ResourceAssignment>(
            r"
            INSERT INTO org_resource_assignments
              (tenant_id, resource_id, subject_type, subject_id, role,
               is_primary, start_at, end_at, reason, created_by_user_id)
            VALUES
              ($1, $2, $3, $4, $5, $6, COALESCE($7, now()), $8, $9, $10)
            RETURNING *
            ",
        )
        .bind(input.tenant_id)
        .bind(input.resource_id)
        .bind(input.subject_type.as_str())
        .bind(input.subject_id)
        .bind(input.role.as_str())
        .bind(input.is_primary)
        .bind(input.start_at)
        .bind(input.end_at)
        .bind(&input.reason)
        .bind(input.created_by_user_id)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Close an active assignment (sets `end_at = now()` if still active).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn end(&self, id: Uuid) -> Result<Option<ResourceAssignment>> {
        let row = sqlx::query_as::<_, ResourceAssignment>(
            r"
            UPDATE org_resource_assignments
               SET end_at = now()
             WHERE id = $1 AND end_at IS NULL
             RETURNING *
            ",
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Close the active owner on a resource if any.
    ///
    /// Returns the row that was closed, if any.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn end_active_owner(&self, resource_id: Uuid) -> Result<Option<ResourceAssignment>> {
        let row = sqlx::query_as::<_, ResourceAssignment>(
            r"
            UPDATE org_resource_assignments
               SET end_at = now()
             WHERE resource_id = $1 AND role = 'owner' AND end_at IS NULL
             RETURNING *
            ",
        )
        .bind(resource_id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// List all active assignments on a resource.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_active_for_resource(
        &self,
        resource_id: Uuid,
    ) -> Result<Vec<ResourceAssignment>> {
        let rows = sqlx::query_as::<_, ResourceAssignment>(
            "SELECT * FROM org_resource_assignments
              WHERE resource_id = $1 AND end_at IS NULL
              ORDER BY role, created_at",
        )
        .bind(resource_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Complete history of a resource's assignments.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_history_for_resource(
        &self,
        resource_id: Uuid,
    ) -> Result<Vec<ResourceAssignment>> {
        let rows = sqlx::query_as::<_, ResourceAssignment>(
            "SELECT * FROM org_resource_assignments
              WHERE resource_id = $1
              ORDER BY start_at DESC",
        )
        .bind(resource_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// List active assignments where a given subject is involved.
    ///
    /// Used by `/me/inventory` enrichissement and by the RBAC inheritance
    /// rules.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_active_for_subject(
        &self,
        subject_type: AssignmentSubjectType,
        subject_id: Uuid,
    ) -> Result<Vec<ResourceAssignment>> {
        let rows = sqlx::query_as::<_, ResourceAssignment>(
            "SELECT * FROM org_resource_assignments
              WHERE subject_type = $1 AND subject_id = $2 AND end_at IS NULL
              ORDER BY created_at DESC",
        )
        .bind(subject_type.as_str())
        .bind(subject_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Fetch one assignment by id.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get(&self, id: Uuid) -> Result<Option<ResourceAssignment>> {
        let row = sqlx::query_as::<_, ResourceAssignment>(
            "SELECT * FROM org_resource_assignments WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Count active assignments grouped by role on a tenant.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn count_active_by_role(&self, tenant_id: Uuid) -> Result<Vec<(String, i64)>> {
        let rows: Vec<(String, i64)> = sqlx::query_as(
            "SELECT role, COUNT(*)::BIGINT FROM org_resource_assignments
              WHERE tenant_id = $1 AND end_at IS NULL
              GROUP BY role ORDER BY role",
        )
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }
}
