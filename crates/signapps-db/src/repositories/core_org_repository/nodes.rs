//! OrgNodeRepository — org node and closure-table operations.

use crate::models::core_org::{CreateOrgNode, OrgChartNode, OrgClosure, OrgNode, UpdateOrgNode};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for org node and closure-table operations.
pub struct OrgNodeRepository;

impl OrgNodeRepository {
    /// Create a new org node.
    ///
    /// The closure trigger (`trg_org_nodes_closure`) automatically populates
    /// `core.org_closure` after the INSERT.
    pub async fn create(pool: &PgPool, input: CreateOrgNode) -> Result<OrgNode> {
        let node = sqlx::query_as::<_, OrgNode>(
            r#"
            INSERT INTO core.org_nodes
                (tree_id, parent_id, node_type, name, code, description, config, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, '{}'), COALESCE($8, 0))
            RETURNING *
            "#,
        )
        .bind(input.tree_id)
        .bind(input.parent_id)
        .bind(&input.node_type)
        .bind(&input.name)
        .bind(&input.code)
        .bind(&input.description)
        .bind(&input.config)
        .bind(input.sort_order)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(node)
    }

    /// Update fields on an existing org node.
    pub async fn update(pool: &PgPool, id: Uuid, input: UpdateOrgNode) -> Result<OrgNode> {
        let node = sqlx::query_as::<_, OrgNode>(
            r#"
            UPDATE core.org_nodes SET
                name        = COALESCE($2, name),
                code        = COALESCE($3, code),
                description = COALESCE($4, description),
                config      = COALESCE($5, config),
                sort_order  = COALESCE($6, sort_order),
                is_active   = COALESCE($7, is_active),
                updated_at  = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.code)
        .bind(&input.description)
        .bind(&input.config)
        .bind(input.sort_order)
        .bind(input.is_active)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(node)
    }

    /// Delete an org node and cascade (assignments, closure rows, children via ON DELETE SET NULL).
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM core.org_nodes WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Find an org node by primary key.
    pub async fn find(pool: &PgPool, id: Uuid) -> Result<Option<OrgNode>> {
        let node = sqlx::query_as::<_, OrgNode>("SELECT * FROM core.org_nodes WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(node)
    }

    /// Get direct children of a node ordered by sort_order.
    pub async fn get_children(pool: &PgPool, parent_id: Uuid) -> Result<Vec<OrgNode>> {
        let children = sqlx::query_as::<_, OrgNode>(
            r#"
            SELECT * FROM core.org_nodes
            WHERE parent_id = $1 AND is_active = TRUE
            ORDER BY sort_order, name
            "#,
        )
        .bind(parent_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(children)
    }

    /// Get all descendants of a node via the closure table (ordered by depth).
    pub async fn get_descendants(pool: &PgPool, ancestor_id: Uuid) -> Result<Vec<OrgNode>> {
        let nodes = sqlx::query_as::<_, OrgNode>(
            r#"
            SELECT n.*
            FROM core.org_nodes n
            JOIN core.org_closure c ON c.descendant_id = n.id
            WHERE c.ancestor_id = $1 AND c.depth > 0
            ORDER BY c.depth, n.sort_order, n.name
            "#,
        )
        .bind(ancestor_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(nodes)
    }

    /// Get all ancestors of a node via the closure table (ordered by depth descending = root first).
    pub async fn get_ancestors(pool: &PgPool, descendant_id: Uuid) -> Result<Vec<OrgNode>> {
        let nodes = sqlx::query_as::<_, OrgNode>(
            r#"
            SELECT n.*
            FROM core.org_nodes n
            JOIN core.org_closure c ON c.ancestor_id = n.id
            WHERE c.descendant_id = $1 AND c.depth > 0
            ORDER BY c.depth DESC
            "#,
        )
        .bind(descendant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(nodes)
    }

    /// Move a node to a new parent by rebuilding the affected closure rows.
    ///
    /// Algorithm:
    /// 1. Delete all closure rows where the descendant is the node or its subtree,
    ///    and the ancestor is NOT in the subtree (removes old upward links).
    /// 2. Re-insert links from the new parent's ancestors to all descendants of the moved node.
    pub async fn move_node(
        pool: &PgPool,
        node_id: Uuid,
        new_parent_id: Option<Uuid>,
    ) -> Result<()> {
        // Step 1 – detach from old parent ancestry
        sqlx::query(
            r#"
            DELETE FROM core.org_closure
            WHERE descendant_id IN (
                SELECT descendant_id FROM core.org_closure WHERE ancestor_id = $1
            )
            AND ancestor_id NOT IN (
                SELECT descendant_id FROM core.org_closure WHERE ancestor_id = $1
            )
            "#,
        )
        .bind(node_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        // Step 2 – attach to new parent (if any)
        if let Some(parent_id) = new_parent_id {
            sqlx::query(
                r#"
                INSERT INTO core.org_closure (ancestor_id, descendant_id, depth)
                SELECT p.ancestor_id, c.descendant_id, p.depth + c.depth + 1
                FROM core.org_closure p
                CROSS JOIN core.org_closure c
                WHERE p.descendant_id = $1 AND c.ancestor_id = $2
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(parent_id)
            .bind(node_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        }

        // Update parent_id on the node itself
        sqlx::query("UPDATE core.org_nodes SET parent_id = $2, updated_at = NOW() WHERE id = $1")
            .bind(node_id)
            .bind(new_parent_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }

    /// Fetch all nodes for a tree and assemble them into a hierarchical [`OrgChartNode`] tree.
    ///
    /// Returns a list of root-level nodes (nodes without a parent in the result set).
    pub async fn get_full_tree(pool: &PgPool, tree_id: Uuid) -> Result<Vec<OrgChartNode>> {
        let nodes = sqlx::query_as::<_, OrgNode>(
            "SELECT * FROM core.org_nodes WHERE tree_id = $1 ORDER BY sort_order, name",
        )
        .bind(tree_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(build_org_chart(nodes))
    }

    /// List all closure entries for a given node (all ancestor-descendant pairs it participates in).
    pub async fn get_closure(pool: &PgPool, node_id: Uuid) -> Result<Vec<OrgClosure>> {
        let rows = sqlx::query_as::<_, OrgClosure>(
            r#"
            SELECT * FROM core.org_closure
            WHERE ancestor_id = $1 OR descendant_id = $1
            ORDER BY depth
            "#,
        )
        .bind(node_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }
}

/// Build a nested [`OrgChartNode`] tree from a flat sorted list of nodes.
fn build_org_chart(nodes: Vec<OrgNode>) -> Vec<OrgChartNode> {
    use std::collections::HashMap;

    let mut chart_nodes: HashMap<Uuid, OrgChartNode> = nodes
        .iter()
        .map(|n| {
            (
                n.id,
                OrgChartNode {
                    node: n.clone(),
                    children: vec![],
                },
            )
        })
        .collect();

    let mut roots: Vec<OrgChartNode> = vec![];

    // Stable insertion order
    let ordered_ids: Vec<Uuid> = nodes.iter().map(|n| n.id).collect();

    for id in &ordered_ids {
        let node = chart_nodes.remove(id).unwrap();
        if let Some(parent_id) = node.node.parent_id {
            if let Some(parent) = chart_nodes.get_mut(&parent_id) {
                parent.children.push(node);
                continue;
            }
        }
        roots.push(node);
    }

    roots
}
