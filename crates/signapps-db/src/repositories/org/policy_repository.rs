//! CRUD for `org_policies` and `org_policy_bindings`.

use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{Policy, PolicyBinding};

/// Repository for the canonical `org_policies` + `org_policy_bindings`
/// tables.
pub struct PolicyRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> PolicyRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new policy.
    ///
    /// `permissions` is a JSONB array of `{ resource, actions[] }`
    /// objects; build it from `Vec<PermissionSpec>` via
    /// `serde_json::to_value`.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error if the insert fails.
    pub async fn create(
        &self,
        tenant_id: Uuid,
        name: &str,
        description: Option<&str>,
        permissions: serde_json::Value,
    ) -> Result<Policy> {
        let row = sqlx::query_as::<_, Policy>(
            "INSERT INTO org_policies (tenant_id, name, description, permissions)
             VALUES ($1, $2, $3, $4)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(name)
        .bind(description)
        .bind(permissions)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch a policy by primary key.
    pub async fn get(&self, id: Uuid) -> Result<Option<Policy>> {
        let row = sqlx::query_as::<_, Policy>("SELECT * FROM org_policies WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    /// Bind a policy to a node, optionally inheriting to descendants.
    pub async fn bind_to_node(
        &self,
        policy_id: Uuid,
        node_id: Uuid,
        inherit: bool,
    ) -> Result<PolicyBinding> {
        let row = sqlx::query_as::<_, PolicyBinding>(
            "INSERT INTO org_policy_bindings (policy_id, node_id, inherit)
             VALUES ($1, $2, $3)
             RETURNING *",
        )
        .bind(policy_id)
        .bind(node_id)
        .bind(inherit)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Remove a binding by primary key.
    pub async fn unbind(&self, binding_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM org_policy_bindings WHERE id = $1")
            .bind(binding_id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// List every binding that applies to a subtree rooted at `root_path`.
    ///
    /// The query considers a binding as applicable when:
    /// - the bound node lies on the subtree (`b.node_id IN ...`), OR
    /// - the binding inherits and the bound node is an ancestor
    ///   (the LTREE `@>` operator).
    pub async fn list_bindings_for_subtree(
        &self,
        root_path: &str,
    ) -> Result<Vec<PolicyBinding>> {
        let rows = sqlx::query_as::<_, PolicyBinding>(
            "SELECT b.*
               FROM org_policy_bindings b
               JOIN org_nodes n ON n.id = b.node_id
              WHERE n.path <@ $1::ltree
                 OR (b.inherit = true AND n.path @> $1::ltree)
              ORDER BY b.created_at",
        )
        .bind(root_path)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }
}
