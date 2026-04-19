//! CRUD + subtree queries for `org_nodes`.

use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{NodeKind, OrgNode};

/// Repository for the canonical `org_nodes` table.
pub struct NodeRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> NodeRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new node.
    ///
    /// `path` MUST be a valid LTREE expression
    /// (lowercase letters, digits, underscores, dot-separated segments).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error if the insert fails (FK
    /// violation, invalid LTREE syntax, ...).
    pub async fn create(
        &self,
        tenant_id: Uuid,
        kind: NodeKind,
        parent_id: Option<Uuid>,
        path: &str,
        name: &str,
        slug: Option<&str>,
    ) -> Result<OrgNode> {
        let row = sqlx::query_as::<_, OrgNode>(
            "INSERT INTO org_nodes (tenant_id, kind, parent_id, path, name, slug)
             VALUES ($1, $2, $3, $4::ltree, $5, $6)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(kind)
        .bind(parent_id)
        .bind(path)
        .bind(name)
        .bind(slug)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch one node by primary key, `Ok(None)` if not found.
    pub async fn get(&self, id: Uuid) -> Result<Option<OrgNode>> {
        let row = sqlx::query_as::<_, OrgNode>("SELECT * FROM org_nodes WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    /// List every active node for a tenant, ordered by LTREE path.
    pub async fn list_by_tenant(&self, tenant_id: Uuid) -> Result<Vec<OrgNode>> {
        let rows = sqlx::query_as::<_, OrgNode>(
            "SELECT * FROM org_nodes
             WHERE tenant_id = $1 AND active = true
             ORDER BY path",
        )
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Return every active descendant of `root_path` (inclusive).
    ///
    /// Uses the LTREE `<@` operator on the GIST index, O(log n).
    pub async fn subtree(&self, root_path: &str) -> Result<Vec<OrgNode>> {
        let rows = sqlx::query_as::<_, OrgNode>(
            "SELECT * FROM org_nodes
             WHERE path <@ $1::ltree AND active = true
             ORDER BY path",
        )
        .bind(root_path)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Soft-delete a node (sets `active = false`).
    pub async fn archive(&self, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE org_nodes SET active = false, updated_at = now() WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}
