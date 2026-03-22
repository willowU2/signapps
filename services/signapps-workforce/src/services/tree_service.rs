//! Tree Service
//!
//! Organizational tree operations using closure table pattern.
//! Provides efficient ancestor/descendant queries and tree mutations.

use sqlx::PgPool;
use uuid::Uuid;

use signapps_common::Result;

/// Service for organizational tree operations
#[derive(Clone)]
#[allow(dead_code)] // TODO: wire up to handlers
pub struct TreeService {
    pool: PgPool,
}

#[allow(dead_code)] // TODO: wire up to handlers
impl TreeService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Get all ancestors of a node (path to root)
    pub async fn get_ancestors(&self, node_id: Uuid) -> Result<Vec<Uuid>> {
        let ancestors: Vec<Uuid> = sqlx::query_scalar(
            r#"
            SELECT ancestor_id FROM workforce_org_closure
            WHERE descendant_id = $1 AND depth > 0
            ORDER BY depth DESC
            "#,
        )
        .bind(node_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(ancestors)
    }

    /// Get all descendants of a node
    pub async fn get_descendants(&self, node_id: Uuid) -> Result<Vec<Uuid>> {
        let descendants: Vec<Uuid> = sqlx::query_scalar(
            r#"
            SELECT descendant_id FROM workforce_org_closure
            WHERE ancestor_id = $1 AND depth > 0
            ORDER BY depth ASC
            "#,
        )
        .bind(node_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(descendants)
    }

    /// Get direct children of a node
    pub async fn get_children(&self, node_id: Uuid) -> Result<Vec<Uuid>> {
        let children: Vec<Uuid> = sqlx::query_scalar(
            r#"
            SELECT id FROM workforce_org_nodes
            WHERE parent_id = $1 AND is_active = true
            ORDER BY sort_order, name
            "#,
        )
        .bind(node_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(children)
    }

    /// Get depth of a node in the tree
    pub async fn get_depth(&self, node_id: Uuid) -> Result<i32> {
        let depth: Option<i32> = sqlx::query_scalar(
            r#"
            SELECT MAX(depth) FROM workforce_org_closure
            WHERE descendant_id = $1
            "#,
        )
        .bind(node_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(depth.unwrap_or(0))
    }

    /// Check if node_a is an ancestor of node_b
    pub async fn is_ancestor(&self, node_a: Uuid, node_b: Uuid) -> Result<bool> {
        let is_ancestor: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM workforce_org_closure
                WHERE ancestor_id = $1 AND descendant_id = $2 AND depth > 0
            )
            "#,
        )
        .bind(node_a)
        .bind(node_b)
        .fetch_one(&self.pool)
        .await?;

        Ok(is_ancestor)
    }

    /// Check if node_a is a descendant of node_b
    pub async fn is_descendant(&self, node_a: Uuid, node_b: Uuid) -> Result<bool> {
        self.is_ancestor(node_b, node_a).await
    }

    /// Get the lowest common ancestor of two nodes
    pub async fn get_lca(&self, node_a: Uuid, node_b: Uuid) -> Result<Option<Uuid>> {
        let lca: Option<Uuid> = sqlx::query_scalar(
            r#"
            SELECT c1.ancestor_id
            FROM workforce_org_closure c1
            INNER JOIN workforce_org_closure c2 ON c1.ancestor_id = c2.ancestor_id
            WHERE c1.descendant_id = $1 AND c2.descendant_id = $2
            ORDER BY c1.depth ASC
            LIMIT 1
            "#,
        )
        .bind(node_a)
        .bind(node_b)
        .fetch_optional(&self.pool)
        .await?;

        Ok(lca)
    }

    /// Count employees under a node (including descendants)
    pub async fn count_employees(&self, node_id: Uuid, tenant_id: Uuid) -> Result<i64> {
        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM workforce_employees e
            INNER JOIN workforce_org_closure c ON c.descendant_id = e.org_node_id
            WHERE c.ancestor_id = $1 AND e.tenant_id = $2 AND e.status = 'active'
            "#,
        )
        .bind(node_id)
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count)
    }

    /// Get subtree size (number of nodes)
    pub async fn get_subtree_size(&self, node_id: Uuid) -> Result<i64> {
        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM workforce_org_closure
            WHERE ancestor_id = $1
            "#,
        )
        .bind(node_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count)
    }
}
