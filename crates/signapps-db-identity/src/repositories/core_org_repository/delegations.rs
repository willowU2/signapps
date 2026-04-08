//! DelegationRepository — scoped delegation chain operations.

use crate::models::org_delegations::{CreateDelegation, OrgDelegation, UpdateDelegation};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for scoped delegation chain operations.
pub struct DelegationRepository;

impl DelegationRepository {
    /// List all active delegations for a tenant.
    pub async fn list_delegations(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<OrgDelegation>> {
        let delegations = sqlx::query_as::<_, OrgDelegation>(
            r#"
            SELECT * FROM workforce_org_delegations
            WHERE tenant_id = $1 AND is_active = true
            ORDER BY created_at DESC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(delegations)
    }

    /// Create a new delegation.
    ///
    /// If a `parent_delegation_id` is provided, the depth is automatically
    /// computed as parent.depth + 1.
    pub async fn create_delegation(
        pool: &PgPool,
        tenant_id: Uuid,
        input: CreateDelegation,
    ) -> Result<OrgDelegation> {
        let delegation = sqlx::query_as::<_, OrgDelegation>(
            r#"
            INSERT INTO workforce_org_delegations
                (tenant_id, delegator_id, delegate_type, delegate_id,
                 scope_node_id, permissions, parent_delegation_id, expires_at,
                 depth)
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                COALESCE(
                    (SELECT d.depth + 1 FROM workforce_org_delegations d WHERE d.id = $7),
                    0
                )
            )
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(input.delegator_id)
        .bind(&input.delegate_type)
        .bind(input.delegate_id)
        .bind(input.scope_node_id)
        .bind(&input.permissions)
        .bind(input.parent_delegation_id)
        .bind(input.expires_at)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(delegation)
    }

    /// Revoke a delegation by setting `is_active = false`, scoped to tenant.
    pub async fn revoke_delegation(pool: &PgPool, tenant_id: Uuid, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE workforce_org_delegations SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
        )
        .bind(id)
        .bind(tenant_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Update an existing delegation, scoped to tenant.
    pub async fn update_delegation(
        pool: &PgPool,
        tenant_id: Uuid,
        id: Uuid,
        input: UpdateDelegation,
    ) -> Result<OrgDelegation> {
        let delegation = sqlx::query_as::<_, OrgDelegation>(
            r#"
            UPDATE workforce_org_delegations SET
                permissions = COALESCE($3, permissions),
                expires_at  = COALESCE($4, expires_at),
                is_active   = COALESCE($5, is_active),
                updated_at  = NOW()
            WHERE id = $1 AND tenant_id = $2
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(tenant_id)
        .bind(&input.permissions)
        .bind(input.expires_at)
        .bind(input.is_active)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(delegation)
    }

    /// Get all active delegations where a person is the delegate.
    pub async fn get_delegations_for_person(
        pool: &PgPool,
        person_id: Uuid,
    ) -> Result<Vec<OrgDelegation>> {
        let delegations = sqlx::query_as::<_, OrgDelegation>(
            r#"
            SELECT * FROM workforce_org_delegations
            WHERE delegate_type = 'person'
              AND delegate_id = $1
              AND is_active = true
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC
            "#,
        )
        .bind(person_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(delegations)
    }

    /// Get all active delegations granted by a person.
    pub async fn get_delegations_granted_by(
        pool: &PgPool,
        person_id: Uuid,
    ) -> Result<Vec<OrgDelegation>> {
        let delegations = sqlx::query_as::<_, OrgDelegation>(
            r#"
            SELECT * FROM workforce_org_delegations
            WHERE delegator_id = $1
              AND is_active = true
            ORDER BY created_at DESC
            "#,
        )
        .bind(person_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(delegations)
    }

    /// Walk the `parent_delegation_id` chain and return the depth.
    ///
    /// Returns the delegation's own depth field (pre-computed on insert).
    pub async fn check_delegation_depth(pool: &PgPool, delegation_id: Uuid) -> Result<i32> {
        let depth = sqlx::query_scalar::<_, i32>(
            "SELECT depth FROM workforce_org_delegations WHERE id = $1",
        )
        .bind(delegation_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(depth)
    }
}
