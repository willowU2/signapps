//! GroupRepository — cross-functional group and membership operations.

use crate::models::org_groups::{
    AddGroupMember, CreateOrgGroup, OrgGroup, OrgGroupMember, OrgMemberOf, UpdateOrgGroup,
};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for cross-functional group and membership operations.
pub struct GroupRepository;

impl GroupRepository {
    /// List all active groups for a tenant.
    pub async fn list_groups(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<OrgGroup>> {
        let groups = sqlx::query_as::<_, OrgGroup>(
            r#"
            SELECT * FROM workforce_org_groups
            WHERE tenant_id = $1 AND is_active = true
            ORDER BY name
            "#,
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(groups)
    }

    /// Create a new org group.
    pub async fn create_group(
        pool: &PgPool,
        tenant_id: Uuid,
        input: CreateOrgGroup,
    ) -> Result<OrgGroup> {
        let group = sqlx::query_as::<_, OrgGroup>(
            r#"
            INSERT INTO workforce_org_groups
                (tenant_id, name, description, group_type, filter, managed_by,
                 valid_from, valid_until, attributes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, '{}'))
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.group_type)
        .bind(&input.filter)
        .bind(input.managed_by)
        .bind(input.valid_from)
        .bind(input.valid_until)
        .bind(&input.attributes)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(group)
    }

    /// Find a group by primary key, scoped to tenant.
    pub async fn get_group(pool: &PgPool, tenant_id: Uuid, id: Uuid) -> Result<Option<OrgGroup>> {
        let group = sqlx::query_as::<_, OrgGroup>(
            "SELECT * FROM workforce_org_groups WHERE id = $1 AND tenant_id = $2",
        )
        .bind(id)
        .bind(tenant_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(group)
    }

    /// Update an existing org group using COALESCE patching, scoped to tenant.
    pub async fn update_group(
        pool: &PgPool,
        tenant_id: Uuid,
        id: Uuid,
        input: UpdateOrgGroup,
    ) -> Result<OrgGroup> {
        let group = sqlx::query_as::<_, OrgGroup>(
            r#"
            UPDATE workforce_org_groups SET
                name        = COALESCE($3, name),
                description = COALESCE($4, description),
                group_type  = COALESCE($5, group_type),
                filter      = COALESCE($6, filter),
                managed_by  = COALESCE($7, managed_by),
                valid_from  = COALESCE($8, valid_from),
                valid_until = COALESCE($9, valid_until),
                is_active   = COALESCE($10, is_active),
                attributes  = COALESCE($11, attributes),
                updated_at  = NOW()
            WHERE id = $1 AND tenant_id = $2
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(tenant_id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.group_type)
        .bind(&input.filter)
        .bind(input.managed_by)
        .bind(input.valid_from)
        .bind(input.valid_until)
        .bind(input.is_active)
        .bind(&input.attributes)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(group)
    }

    /// Delete a group, scoped to tenant. The trigger handles memberof cleanup via ON DELETE CASCADE.
    pub async fn delete_group(pool: &PgPool, tenant_id: Uuid, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM workforce_org_groups WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(tenant_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Add a member (person, node, or group) to a group.
    pub async fn add_member(
        pool: &PgPool,
        group_id: Uuid,
        input: AddGroupMember,
    ) -> Result<OrgGroupMember> {
        let member = sqlx::query_as::<_, OrgGroupMember>(
            r#"
            INSERT INTO workforce_org_group_members
                (group_id, member_type, member_id, is_manual_override)
            VALUES ($1, $2, $3, COALESCE($4, false))
            ON CONFLICT (group_id, member_type, member_id) DO UPDATE
                SET is_manual_override = EXCLUDED.is_manual_override
            RETURNING *
            "#,
        )
        .bind(group_id)
        .bind(&input.member_type)
        .bind(input.member_id)
        .bind(input.is_manual_override)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(member)
    }

    /// Remove a member from a group by member record id.
    pub async fn remove_member(pool: &PgPool, group_id: Uuid, member_id: Uuid) -> Result<()> {
        sqlx::query(
            "DELETE FROM workforce_org_group_members WHERE group_id = $1 AND member_id = $2",
        )
        .bind(group_id)
        .bind(member_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// List all direct members of a group.
    pub async fn list_members(pool: &PgPool, group_id: Uuid) -> Result<Vec<OrgGroupMember>> {
        let members = sqlx::query_as::<_, OrgGroupMember>(
            r#"
            SELECT * FROM workforce_org_group_members
            WHERE group_id = $1
            ORDER BY member_type, added_at
            "#,
        )
        .bind(group_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(members)
    }

    /// List all effective person_ids in a group via the pre-computed memberof table.
    pub async fn list_effective_members(pool: &PgPool, group_id: Uuid) -> Result<Vec<Uuid>> {
        let rows = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT DISTINCT person_id
            FROM workforce_org_memberof
            WHERE group_id = $1
            ORDER BY person_id
            "#,
        )
        .bind(group_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }

    /// Get all groups a person belongs to via the pre-computed memberof table.
    pub async fn get_person_memberof(pool: &PgPool, person_id: Uuid) -> Result<Vec<OrgMemberOf>> {
        let rows = sqlx::query_as::<_, OrgMemberOf>(
            r#"
            SELECT * FROM workforce_org_memberof
            WHERE person_id = $1
            ORDER BY group_id
            "#,
        )
        .bind(person_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }
}
