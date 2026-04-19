//! CRUD for `org_groups` + `org_group_members` — SO7.
//!
//! The resolution of a group's members depends on its
//! [`GroupKind`](crate::models::org::GroupKind) :
//!
//! - `Static`    : union des rows `org_group_members.kind = 'include'`.
//! - `Dynamic`   : repository returns raw `rule_json` — evaluation is
//!   done by the matcher in `signapps-org::groups::matcher` which
//!   builds a single SQL WHERE clause on `org_persons`.
//! - `Hybrid`    : matcher eval + union includes - excludes (this repo
//!   exposes `list_includes`/`list_excludes` helpers).
//! - `Derived`   : persons assigned on `axis = 'structure'` to any node
//!   under `source_node_id.path` (LTREE `<@`). Implemented here via
//!   a recursive SQL helper.

use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{GroupKind, MembershipKind, OrgGroup, OrgGroupMember, Person};

/// Repository for `org_groups` + `org_group_members`.
pub struct GroupRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> GroupRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new group row.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error (FK violation, unique clash...).
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        &self,
        tenant_id: Uuid,
        slug: &str,
        name: &str,
        description: Option<&str>,
        kind: GroupKind,
        rule_json: Option<serde_json::Value>,
        source_node_id: Option<Uuid>,
        attributes: serde_json::Value,
        created_by_user_id: Option<Uuid>,
    ) -> Result<OrgGroup> {
        let row = sqlx::query_as::<_, OrgGroup>(
            r#"INSERT INTO org_groups
                (tenant_id, slug, name, description, kind, rule_json,
                 source_node_id, attributes, created_by_user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(slug)
        .bind(name)
        .bind(description)
        .bind(kind.as_str())
        .bind(rule_json)
        .bind(source_node_id)
        .bind(attributes)
        .bind(created_by_user_id)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch one group by id.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get(&self, id: Uuid) -> Result<Option<OrgGroup>> {
        let row = sqlx::query_as::<_, OrgGroup>("SELECT * FROM org_groups WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    /// Fetch one group by slug.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get_by_slug(&self, tenant_id: Uuid, slug: &str) -> Result<Option<OrgGroup>> {
        let row = sqlx::query_as::<_, OrgGroup>(
            "SELECT * FROM org_groups WHERE tenant_id = $1 AND slug = $2",
        )
        .bind(tenant_id)
        .bind(slug)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// List active (non-archived) groups for a tenant, optionally
    /// filtered by kind.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_by_tenant(
        &self,
        tenant_id: Uuid,
        kind: Option<GroupKind>,
    ) -> Result<Vec<OrgGroup>> {
        let rows = if let Some(k) = kind {
            sqlx::query_as::<_, OrgGroup>(
                "SELECT * FROM org_groups
                 WHERE tenant_id = $1 AND kind = $2 AND NOT archived
                 ORDER BY name",
            )
            .bind(tenant_id)
            .bind(k.as_str())
            .fetch_all(self.pool)
            .await?
        } else {
            sqlx::query_as::<_, OrgGroup>(
                "SELECT * FROM org_groups
                 WHERE tenant_id = $1 AND NOT archived
                 ORDER BY name",
            )
            .bind(tenant_id)
            .fetch_all(self.pool)
            .await?
        };
        Ok(rows)
    }

    /// Update a group. All fields can be updated; rules are swapped
    /// wholesale.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn update(
        &self,
        id: Uuid,
        name: &str,
        description: Option<&str>,
        rule_json: Option<serde_json::Value>,
        source_node_id: Option<Uuid>,
        attributes: serde_json::Value,
    ) -> Result<Option<OrgGroup>> {
        let row = sqlx::query_as::<_, OrgGroup>(
            r#"UPDATE org_groups
                SET name = $2,
                    description = $3,
                    rule_json = $4,
                    source_node_id = $5,
                    attributes = $6,
                    updated_at = now()
              WHERE id = $1
              RETURNING *"#,
        )
        .bind(id)
        .bind(name)
        .bind(description)
        .bind(rule_json)
        .bind(source_node_id)
        .bind(attributes)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Soft-delete a group (archived = true).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn archive(&self, id: Uuid) -> Result<bool> {
        let res = sqlx::query(
            "UPDATE org_groups SET archived = true, updated_at = now() WHERE id = $1",
        )
        .bind(id)
        .execute(self.pool)
        .await?;
        Ok(res.rows_affected() > 0)
    }

    /// Upsert a membership row (include OR exclude).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn upsert_member(
        &self,
        group_id: Uuid,
        person_id: Uuid,
        kind: MembershipKind,
    ) -> Result<OrgGroupMember> {
        let kind_s = match kind {
            MembershipKind::Include => "include",
            MembershipKind::Exclude => "exclude",
        };
        let row = sqlx::query_as::<_, OrgGroupMember>(
            r#"INSERT INTO org_group_members (group_id, person_id, kind)
                VALUES ($1, $2, $3)
                ON CONFLICT (group_id, person_id) DO UPDATE
                    SET kind = EXCLUDED.kind
                RETURNING *"#,
        )
        .bind(group_id)
        .bind(person_id)
        .bind(kind_s)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Remove a membership row.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn remove_member(&self, group_id: Uuid, person_id: Uuid) -> Result<bool> {
        let res = sqlx::query(
            "DELETE FROM org_group_members WHERE group_id = $1 AND person_id = $2",
        )
        .bind(group_id)
        .bind(person_id)
        .execute(self.pool)
        .await?;
        Ok(res.rows_affected() > 0)
    }

    /// List explicit memberships of a group.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_members(&self, group_id: Uuid) -> Result<Vec<OrgGroupMember>> {
        let rows = sqlx::query_as::<_, OrgGroupMember>(
            "SELECT * FROM org_group_members WHERE group_id = $1 ORDER BY created_at",
        )
        .bind(group_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Convenience: list the person ids explicitly included in a group.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_includes(&self, group_id: Uuid) -> Result<Vec<Uuid>> {
        let rows: Vec<(Uuid,)> = sqlx::query_as(
            "SELECT person_id FROM org_group_members
              WHERE group_id = $1 AND kind = 'include'",
        )
        .bind(group_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows.into_iter().map(|(p,)| p).collect())
    }

    /// Convenience: list the person ids explicitly excluded from a group.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_excludes(&self, group_id: Uuid) -> Result<Vec<Uuid>> {
        let rows: Vec<(Uuid,)> = sqlx::query_as(
            "SELECT person_id FROM org_group_members
              WHERE group_id = $1 AND kind = 'exclude'",
        )
        .bind(group_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows.into_iter().map(|(p,)| p).collect())
    }

    /// Resolve a static group — returns all persons explicitly included.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn resolve_static(&self, group_id: Uuid) -> Result<Vec<Person>> {
        let rows = sqlx::query_as::<_, Person>(
            r#"SELECT p.*
                 FROM org_persons p
                 JOIN org_group_members m ON m.person_id = p.id
                WHERE m.group_id = $1
                  AND m.kind = 'include'
                  AND p.active
                ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST"#,
        )
        .bind(group_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Resolve a derived group — returns every active person with a
    /// structure-axis assignment under the group's source subtree.
    ///
    /// Uses the LTREE `<@` operator against `source_node_id.path`, so the
    /// query is O(log n) on the GIST index.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error (or `Ok(vec![])` if the source
    /// node is missing or the group has no `source_node_id`).
    pub async fn resolve_derived(&self, group: &OrgGroup) -> Result<Vec<Person>> {
        let Some(src_id) = group.source_node_id else {
            return Ok(Vec::new());
        };
        let rows = sqlx::query_as::<_, Person>(
            r#"SELECT DISTINCT p.*
                 FROM org_persons p
                 JOIN org_assignments a ON a.person_id = p.id
                 JOIN org_nodes n  ON n.id = a.node_id
                 JOIN org_nodes r  ON r.id = $1
                WHERE a.axis = 'structure'
                  AND n.path <@ r.path
                  AND (a.end_date IS NULL OR a.end_date > CURRENT_DATE)
                  AND p.active
                ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST"#,
        )
        .bind(src_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Unsafe helper: run an arbitrary SQL WHERE snippet against
    /// `org_persons` for a given tenant. Used by the matcher after it
    /// compiled a rule_json into a parameterless fragment.
    ///
    /// The caller MUST pre-validate the WHERE clause — we only append
    /// the tenant filter and active = true. Raw template strings are not
    /// allowed here; see `signapps-org::groups::matcher::RuleMatcher`
    /// which builds a params-safe fragment via `sqlx::QueryBuilder`.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_all_active_persons(&self, tenant_id: Uuid) -> Result<Vec<Person>> {
        let rows = sqlx::query_as::<_, Person>(
            "SELECT * FROM org_persons WHERE tenant_id = $1 AND active
             ORDER BY first_name NULLS LAST, last_name NULLS LAST",
        )
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn group_kind_parse_and_str_roundtrip() {
        for raw in ["static", "dynamic", "hybrid", "derived"] {
            let k = GroupKind::parse(raw).unwrap();
            assert_eq!(k.as_str(), raw);
        }
        assert!(GroupKind::parse("bogus").is_err());
    }
}
