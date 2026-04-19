//! CRUD + clone engine for `org_templates` — SO3 scale & power.
//!
//! Le clone reproduit l'arbo du spec sous un node existant, en créant :
//! - Les nodes enfants (LTREE path dérivé du parent cible),
//! - Les positions associées à chaque node.
//!
//! Transactionnel : en cas d'erreur, aucune ligne créée.

use std::collections::HashMap;

use anyhow::{Context, Result};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{
    template::template_spec::TemplateSpec, NodeKind, OrgNode, Position, Template,
};
use crate::repositories::org::node_repository::ORG_NODE_COLS;

/// Output du clone : nodes + positions créés.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CloneOutcome {
    /// Nodes créés sous le parent cible (ordre DFS).
    pub nodes: Vec<OrgNode>,
    /// Positions créées.
    pub positions: Vec<Position>,
}

/// Repository for the canonical `org_templates` table.
pub struct TemplateRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> TemplateRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// List every public template, optionally filtered by industry.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_public(&self, industry: Option<&str>) -> Result<Vec<Template>> {
        let rows = match industry {
            Some(ind) => sqlx::query_as::<_, Template>(
                "SELECT * FROM org_templates
                 WHERE is_public = TRUE AND industry = $1
                 ORDER BY name",
            )
            .bind(ind)
            .fetch_all(self.pool)
            .await?,
            None => sqlx::query_as::<_, Template>(
                "SELECT * FROM org_templates
                 WHERE is_public = TRUE
                 ORDER BY name",
            )
            .fetch_all(self.pool)
            .await?,
        };
        Ok(rows)
    }

    /// Fetch one template by slug.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Template>> {
        let row = sqlx::query_as::<_, Template>("SELECT * FROM org_templates WHERE slug = $1")
            .bind(slug)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    /// Create or update (by slug) a template — used by seed.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn upsert(
        &self,
        slug: &str,
        name: &str,
        description: Option<&str>,
        industry: Option<&str>,
        size_range: Option<&str>,
        spec_json: &serde_json::Value,
        is_public: bool,
        created_by_tenant_id: Option<Uuid>,
    ) -> Result<Template> {
        let row = sqlx::query_as::<_, Template>(
            "INSERT INTO org_templates
                (slug, name, description, industry, size_range, spec_json,
                 is_public, created_by_tenant_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (slug) DO UPDATE SET
                 name                 = EXCLUDED.name,
                 description          = EXCLUDED.description,
                 industry             = EXCLUDED.industry,
                 size_range           = EXCLUDED.size_range,
                 spec_json            = EXCLUDED.spec_json,
                 is_public            = EXCLUDED.is_public,
                 created_by_tenant_id = EXCLUDED.created_by_tenant_id
             RETURNING *",
        )
        .bind(slug)
        .bind(name)
        .bind(description)
        .bind(industry)
        .bind(size_range)
        .bind(spec_json)
        .bind(is_public)
        .bind(created_by_tenant_id)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Clone the template under `target_node_id`. Creates every node and
    /// position of the spec as children of the target.
    ///
    /// Each created node's LTREE path = `<parent.path>.<slug>` (and if the
    /// slug collides with a sibling an incremental suffix is appended).
    ///
    /// Runs inside a single transaction — any failure rolls back.
    ///
    /// # Errors
    ///
    /// Returns `anyhow::Error` on FK violations, invalid LTREE syntax,
    /// missing parent node, malformed spec_json, transaction failure.
    #[allow(clippy::too_many_lines)]
    pub async fn clone_to_node(
        &self,
        tenant_id: Uuid,
        target_node_id: Uuid,
        slug: &str,
    ) -> Result<CloneOutcome> {
        // 1) Load the template and parse its spec.
        let template = self
            .get_by_slug(slug)
            .await?
            .with_context(|| format!("template {slug} not found"))?;
        let spec: TemplateSpec =
            serde_json::from_value(template.spec_json.clone()).context("parse template spec")?;

        // 2) Load the target parent node to derive paths.
        let sql_parent = format!("SELECT {ORG_NODE_COLS} FROM org_nodes WHERE id = $1");
        let parent: OrgNode = sqlx::query_as(&sql_parent)
            .bind(target_node_id)
            .fetch_optional(self.pool)
            .await?
            .with_context(|| format!("target node {target_node_id} not found"))?;

        let mut tx = self.pool.begin().await?;

        // Map slug-du-template → UUID-créé pour remapper les positions.
        let mut slug_to_id: HashMap<String, Uuid> = HashMap::new();
        // Map slug-du-template → path-LTREE-créé (pour les enfants).
        let mut slug_to_path: HashMap<String, String> = HashMap::new();
        let mut created_nodes: Vec<OrgNode> = Vec::new();

        for tn in &spec.nodes {
            let parent_path = match &tn.parent_slug {
                None => parent.path.clone(),
                Some(p) => slug_to_path
                    .get(p)
                    .cloned()
                    .with_context(|| format!("parent_slug {p} not yet created (bad order?)"))?,
            };
            let parent_uuid = match &tn.parent_slug {
                None => Some(parent.id),
                Some(p) => Some(
                    *slug_to_id
                        .get(p)
                        .with_context(|| format!("parent_slug {p} id missing"))?,
                ),
            };
            let safe_slug = sanitize_ltree_segment(&tn.slug);
            let node_path = format!("{parent_path}.{safe_slug}");
            let kind = parse_node_kind(&tn.kind)?;

            let sql_insert = format!(
                "INSERT INTO org_nodes (tenant_id, kind, parent_id, path, name, slug)
                 VALUES ($1, $2, $3, $4::ltree, $5, $6)
                 RETURNING {ORG_NODE_COLS}"
            );
            let row = sqlx::query_as::<_, OrgNode>(&sql_insert)
                .bind(tenant_id)
                .bind(kind)
                .bind(parent_uuid)
                .bind(&node_path)
                .bind(&tn.name)
                .bind(Some(safe_slug.as_str()))
                .fetch_one(&mut *tx)
                .await?;

            slug_to_id.insert(tn.slug.clone(), row.id);
            slug_to_path.insert(tn.slug.clone(), row.path.clone());
            created_nodes.push(row);
        }

        let mut created_positions: Vec<Position> = Vec::new();
        for tp in &spec.positions {
            let node_id = *slug_to_id
                .get(&tp.node_slug)
                .with_context(|| format!("position refers to unknown node_slug {}", tp.node_slug))?;
            let pos = sqlx::query_as::<_, Position>(
                "INSERT INTO org_positions (tenant_id, node_id, title, head_count)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *",
            )
            .bind(tenant_id)
            .bind(node_id)
            .bind(&tp.title)
            .bind(tp.head_count)
            .fetch_one(&mut *tx)
            .await?;
            created_positions.push(pos);
        }

        tx.commit().await?;
        Ok(CloneOutcome {
            nodes: created_nodes,
            positions: created_positions,
        })
    }
}

/// LTREE accepte `[A-Za-z0-9_]+`. On remplace tout le reste par `_`.
fn sanitize_ltree_segment(raw: &str) -> String {
    raw.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn parse_node_kind(s: &str) -> Result<NodeKind> {
    match s {
        "root" => Ok(NodeKind::Root),
        "entity" => Ok(NodeKind::Entity),
        "unit" => Ok(NodeKind::Unit),
        "position" => Ok(NodeKind::Position),
        "role" => Ok(NodeKind::Role),
        other => anyhow::bail!("unknown node kind: {other}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_ltree_segment_replaces_special_chars() {
        assert_eq!(sanitize_ltree_segment("eng-platform"), "eng_platform");
        assert_eq!(sanitize_ltree_segment("abc123"), "abc123");
        assert_eq!(sanitize_ltree_segment("R&D"), "R_D");
    }

    #[test]
    fn parse_node_kind_maps_known_variants() {
        assert!(matches!(parse_node_kind("unit").unwrap(), NodeKind::Unit));
        assert!(matches!(parse_node_kind("root").unwrap(), NodeKind::Root));
        assert!(parse_node_kind("unknown").is_err());
    }
}
