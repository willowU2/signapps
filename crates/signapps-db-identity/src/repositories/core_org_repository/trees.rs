//! OrgTreeRepository — org-tree operations.

use crate::models::core_org::{CreateOrgTree, OrgTree};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for org-tree (internal / clients / suppliers) operations.
pub struct OrgTreeRepository;

impl OrgTreeRepository {
    /// List all org trees for a tenant.
    pub async fn list_by_tenant(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<OrgTree>> {
        let trees = sqlx::query_as::<_, OrgTree>(
            "SELECT * FROM core.org_trees WHERE tenant_id = $1 ORDER BY tree_type",
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(trees)
    }

    /// Create a new org tree for a tenant.
    pub async fn create(pool: &PgPool, input: CreateOrgTree) -> Result<OrgTree> {
        let tree = sqlx::query_as::<_, OrgTree>(
            r#"
            INSERT INTO core.org_trees (tenant_id, tree_type, name)
            VALUES ($1, $2::core.tree_type, $3)
            RETURNING *
            "#,
        )
        .bind(input.tenant_id)
        .bind(&input.tree_type)
        .bind(&input.name)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tree)
    }

    /// Find the org tree for a given tenant and tree type.
    pub async fn find_by_type(
        pool: &PgPool,
        tenant_id: Uuid,
        tree_type: &str,
    ) -> Result<Option<OrgTree>> {
        let tree = sqlx::query_as::<_, OrgTree>(
            "SELECT * FROM core.org_trees WHERE tenant_id = $1 AND tree_type = $2::core.tree_type",
        )
        .bind(tenant_id)
        .bind(tree_type)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tree)
    }

    /// Find an org tree by primary key.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<OrgTree>> {
        let tree = sqlx::query_as::<_, OrgTree>("SELECT * FROM core.org_trees WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tree)
    }

    /// Set the root node of a tree (called after the first node is inserted).
    pub async fn set_root_node(
        pool: &PgPool,
        tree_id: Uuid,
        root_node_id: Uuid,
    ) -> Result<OrgTree> {
        let tree = sqlx::query_as::<_, OrgTree>(
            "UPDATE core.org_trees SET root_node_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
        )
        .bind(tree_id)
        .bind(root_node_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tree)
    }
}
