//! CRUD for `org_acl` — SO9 ACL universelle.

use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{Acl, AclEffect, AclSubjectType};

/// Repository for `org_acl`.
pub struct AclRepository<'a> {
    pool: &'a PgPool,
}

/// Payload pour créer une ACL.
#[derive(Debug, Clone)]
pub struct NewAcl {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Type de sujet.
    pub subject_type: AclSubjectType,
    /// UUID du sujet (requis pour person/group, None sinon).
    pub subject_id: Option<Uuid>,
    /// Référence rôle (requise pour subject_type=role).
    pub subject_ref: Option<String>,
    /// Action (`read`, `update`, ... ou `*`).
    pub action: String,
    /// Resource type (`resource`, `site`, ... ou `*`).
    pub resource_type: String,
    /// Resource UUID (None = wildcard toutes les ressources du type).
    pub resource_id: Option<Uuid>,
    /// Effect.
    pub effect: AclEffect,
    /// Raison libre.
    pub reason: Option<String>,
    /// Début de validité.
    pub valid_from: Option<DateTime<Utc>>,
    /// Fin de validité.
    pub valid_until: Option<DateTime<Utc>>,
    /// User qui crée la règle.
    pub created_by_user_id: Option<Uuid>,
}

/// Filters pour [`AclRepository::list`].
#[derive(Debug, Default, Clone)]
pub struct AclListFilters {
    /// Tenant.
    pub tenant_id: Uuid,
    /// Filter par subject_type.
    pub subject_type: Option<AclSubjectType>,
    /// Filter par subject_id (person/group uniquement).
    pub subject_id: Option<Uuid>,
    /// Filter par resource_type.
    pub resource_type: Option<String>,
    /// Filter par resource_id.
    pub resource_id: Option<Uuid>,
    /// Filter par action.
    pub action: Option<String>,
}

impl<'a> AclRepository<'a> {
    /// Bind to a pool.
    #[must_use]
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new ACL row.
    ///
    /// Validates the subject_type vs subject_id consistency before insert.
    ///
    /// # Errors
    ///
    /// Returns an error if the shape of the row violates CHECK constraints
    /// on the DB, or a sqlx error.
    pub async fn create(&self, input: NewAcl) -> Result<Acl> {
        if input.subject_type.requires_subject_id() && input.subject_id.is_none() {
            anyhow::bail!("subject_id required for subject_type={}", input.subject_type.as_str());
        }
        if !input.subject_type.requires_subject_id() && input.subject_id.is_some() {
            anyhow::bail!(
                "subject_id must be NULL for subject_type={}",
                input.subject_type.as_str()
            );
        }
        let row = sqlx::query_as::<_, Acl>(
            r"
            INSERT INTO org_acl
              (tenant_id, subject_type, subject_id, subject_ref,
               action, resource_type, resource_id, effect, reason,
               valid_from, valid_until, created_by_user_id)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
            ",
        )
        .bind(input.tenant_id)
        .bind(input.subject_type.as_str())
        .bind(input.subject_id)
        .bind(&input.subject_ref)
        .bind(&input.action)
        .bind(&input.resource_type)
        .bind(input.resource_id)
        .bind(input.effect.as_str())
        .bind(&input.reason)
        .bind(input.valid_from)
        .bind(input.valid_until)
        .bind(input.created_by_user_id)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch one ACL by id.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get(&self, id: Uuid) -> Result<Option<Acl>> {
        let row = sqlx::query_as::<_, Acl>("SELECT * FROM org_acl WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    /// Delete an ACL row.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn delete(&self, id: Uuid) -> Result<bool> {
        let res = sqlx::query("DELETE FROM org_acl WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(res.rows_affected() > 0)
    }

    /// List ACL rows matching filters.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list(&self, filters: AclListFilters) -> Result<Vec<Acl>> {
        let subj_type = filters.subject_type.map(|t| t.as_str().to_string());
        let rows = sqlx::query_as::<_, Acl>(
            r"
            SELECT * FROM org_acl
             WHERE tenant_id = $1
               AND ($2::text IS NULL OR subject_type = $2)
               AND ($3::uuid IS NULL OR subject_id = $3)
               AND ($4::text IS NULL OR resource_type = $4)
               AND ($5::uuid IS NULL OR resource_id = $5)
               AND ($6::text IS NULL OR action = $6)
             ORDER BY created_at DESC
             LIMIT 1000
            ",
        )
        .bind(filters.tenant_id)
        .bind(subj_type)
        .bind(filters.subject_id)
        .bind(filters.resource_type)
        .bind(filters.resource_id)
        .bind(filters.action)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// List all ACLs applicable to a (tenant, resource_type, optional resource_id).
    ///
    /// Collects rows that target either an exact UUID or a wildcard
    /// (`resource_id IS NULL`), and either an exact resource_type or `'*'`.
    /// Temporal validity is filtered in-memory by the caller (avoids
    /// having to pass `now` to SQL).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_applicable(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Option<Uuid>,
    ) -> Result<Vec<Acl>> {
        let rows = sqlx::query_as::<_, Acl>(
            r"
            SELECT * FROM org_acl
             WHERE tenant_id = $1
               AND (resource_type = $2 OR resource_type = '*')
               AND (resource_id IS NULL OR resource_id = $3)
            ",
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Count ACL rows per subject_type on a tenant.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn count_by_subject_type(
        &self,
        tenant_id: Uuid,
    ) -> Result<Vec<(String, i64)>> {
        let rows: Vec<(String, i64)> = sqlx::query_as(
            "SELECT subject_type, COUNT(*)::BIGINT FROM org_acl
              WHERE tenant_id = $1
              GROUP BY subject_type ORDER BY subject_type",
        )
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }
}
