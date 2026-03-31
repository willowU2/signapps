//! Repositories for the `core` schema: persons, org trees, org nodes, assignments, sites,
//! permission profiles.

use crate::models::core_org::{
    Assignment, AssignmentHistory, CreateAssignment, CreateAssignmentHistory, CreateOrgNode,
    CreateOrgTree, CreatePerson, CreatePersonRole, CreateSite, EffectivePermissions, NodeSite,
    OrgChartNode, OrgClosure, OrgNode, OrgTree, PermissionProfile, Person, PersonRole, PersonSite,
    Site, UpdateAssignment, UpdateOrgNode, UpdatePerson, UpdateSite, UpsertPermissionProfile,
};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

// ============================================================================
// PersonRepository
// ============================================================================

/// Repository for person (Party Model) operations.
pub struct PersonRepository;

impl PersonRepository {
    /// List all active persons for a tenant with pagination.
    pub async fn list(
        pool: &PgPool,
        tenant_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Person>> {
        let persons = sqlx::query_as::<_, Person>(
            r#"
            SELECT * FROM core.persons
            WHERE tenant_id = $1 AND is_active = TRUE
            ORDER BY last_name, first_name
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(tenant_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(persons)
    }

    /// Create a new person record.
    pub async fn create(pool: &PgPool, input: CreatePerson) -> Result<Person> {
        let person = sqlx::query_as::<_, Person>(
            r#"
            INSERT INTO core.persons
                (tenant_id, first_name, last_name, email, phone, avatar_url, user_id, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, '{}'))
            RETURNING *
            "#,
        )
        .bind(input.tenant_id)
        .bind(&input.first_name)
        .bind(&input.last_name)
        .bind(&input.email)
        .bind(&input.phone)
        .bind(&input.avatar_url)
        .bind(input.user_id)
        .bind(&input.metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(person)
    }

    /// Update an existing person record using COALESCE patching.
    pub async fn update(pool: &PgPool, id: Uuid, input: UpdatePerson) -> Result<Person> {
        let person = sqlx::query_as::<_, Person>(
            r#"
            UPDATE core.persons SET
                first_name  = COALESCE($2, first_name),
                last_name   = COALESCE($3, last_name),
                email       = COALESCE($4, email),
                phone       = COALESCE($5, phone),
                avatar_url  = COALESCE($6, avatar_url),
                is_active   = COALESCE($7, is_active),
                metadata    = COALESCE($8, metadata),
                updated_at  = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.first_name)
        .bind(&input.last_name)
        .bind(&input.email)
        .bind(&input.phone)
        .bind(&input.avatar_url)
        .bind(input.is_active)
        .bind(&input.metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(person)
    }

    /// Find a person by primary key.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Person>> {
        let person = sqlx::query_as::<_, Person>("SELECT * FROM core.persons WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(person)
    }

    /// Find a person by their linked platform user account.
    pub async fn find_by_user_id(pool: &PgPool, user_id: Uuid) -> Result<Option<Person>> {
        let person =
            sqlx::query_as::<_, Person>("SELECT * FROM core.persons WHERE user_id = $1")
                .bind(user_id)
                .fetch_optional(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        Ok(person)
    }

    /// Full-text search over first name, last name and email (case-insensitive).
    pub async fn search(
        pool: &PgPool,
        tenant_id: Uuid,
        query: &str,
        limit: i64,
    ) -> Result<Vec<Person>> {
        let pattern = format!("%{}%", query.to_lowercase());
        let persons = sqlx::query_as::<_, Person>(
            r#"
            SELECT * FROM core.persons
            WHERE tenant_id = $1
              AND is_active = TRUE
              AND (
                  lower(first_name) LIKE $2
                  OR lower(last_name) LIKE $2
                  OR lower(COALESCE(email, '')) LIKE $2
              )
            ORDER BY last_name, first_name
            LIMIT $3
            "#,
        )
        .bind(tenant_id)
        .bind(&pattern)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(persons)
    }

    /// Add a role to a person (idempotent — unique constraint handles duplicates gracefully).
    pub async fn add_role(pool: &PgPool, input: CreatePersonRole) -> Result<PersonRole> {
        let role = sqlx::query_as::<_, PersonRole>(
            r#"
            INSERT INTO core.person_roles (person_id, role_type, metadata)
            VALUES ($1, $2::core.person_role_type, COALESCE($3, '{}'))
            ON CONFLICT (person_id, role_type) DO UPDATE SET is_active = TRUE
            RETURNING *
            "#,
        )
        .bind(input.person_id)
        .bind(&input.role_type)
        .bind(&input.metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(role)
    }

    /// Soft-remove a role from a person (sets is_active = FALSE).
    pub async fn remove_role(pool: &PgPool, person_id: Uuid, role_type: &str) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE core.person_roles SET is_active = FALSE
            WHERE person_id = $1 AND role_type = $2::core.person_role_type
            "#,
        )
        .bind(person_id)
        .bind(role_type)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Link a person record to a platform user account.
    pub async fn link_user(pool: &PgPool, person_id: Uuid, user_id: Uuid) -> Result<Person> {
        let person = sqlx::query_as::<_, Person>(
            "UPDATE core.persons SET user_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
        )
        .bind(person_id)
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(person)
    }

    /// Unlink a person record from its platform user account.
    pub async fn unlink_user(pool: &PgPool, person_id: Uuid) -> Result<Person> {
        let person = sqlx::query_as::<_, Person>(
            "UPDATE core.persons SET user_id = NULL, updated_at = NOW() WHERE id = $1 RETURNING *",
        )
        .bind(person_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(person)
    }

    /// List all active roles for a person.
    pub async fn list_roles(pool: &PgPool, person_id: Uuid) -> Result<Vec<PersonRole>> {
        let roles = sqlx::query_as::<_, PersonRole>(
            "SELECT * FROM core.person_roles WHERE person_id = $1 AND is_active = TRUE",
        )
        .bind(person_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(roles)
    }
}

// ============================================================================
// OrgTreeRepository
// ============================================================================

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
        let tree =
            sqlx::query_as::<_, OrgTree>("SELECT * FROM core.org_trees WHERE id = $1")
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

// ============================================================================
// OrgNodeRepository
// ============================================================================

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
        let node =
            sqlx::query_as::<_, OrgNode>("SELECT * FROM core.org_nodes WHERE id = $1")
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
    pub async fn move_node(pool: &PgPool, node_id: Uuid, new_parent_id: Option<Uuid>) -> Result<()> {
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
        sqlx::query(
            "UPDATE core.org_nodes SET parent_id = $2, updated_at = NOW() WHERE id = $1",
        )
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

// ============================================================================
// AssignmentRepository
// ============================================================================

/// Repository for person-to-node assignment operations including audit history.
pub struct AssignmentRepository;

impl AssignmentRepository {
    /// Create a new temporal assignment.
    pub async fn create(pool: &PgPool, input: CreateAssignment) -> Result<Assignment> {
        let assignment = sqlx::query_as::<_, Assignment>(
            r#"
            INSERT INTO core.assignments
                (person_id, node_id, assignment_type, responsibility_type,
                 start_date, end_date, fte_ratio, is_primary)
            VALUES ($1, $2,
                    COALESCE($3, 'holder')::core.assignment_type,
                    COALESCE($4, 'hierarchical')::core.responsibility_type,
                    COALESCE($5, CURRENT_DATE), $6,
                    COALESCE($7, 1.00), COALESCE($8, TRUE))
            RETURNING *
            "#,
        )
        .bind(input.person_id)
        .bind(input.node_id)
        .bind(&input.assignment_type)
        .bind(&input.responsibility_type)
        .bind(input.start_date)
        .bind(input.end_date)
        .bind(input.fte_ratio)
        .bind(input.is_primary)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(assignment)
    }

    /// Update mutable fields of an assignment.
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        input: UpdateAssignment,
    ) -> Result<Assignment> {
        let assignment = sqlx::query_as::<_, Assignment>(
            r#"
            UPDATE core.assignments SET
                assignment_type     = COALESCE($2::core.assignment_type, assignment_type),
                responsibility_type = COALESCE($3::core.responsibility_type, responsibility_type),
                end_date            = COALESCE($4, end_date),
                fte_ratio           = COALESCE($5, fte_ratio),
                is_primary          = COALESCE($6, is_primary),
                updated_at          = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.assignment_type)
        .bind(&input.responsibility_type)
        .bind(input.end_date)
        .bind(input.fte_ratio)
        .bind(input.is_primary)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(assignment)
    }

    /// End an assignment by setting its `end_date` to today (or a provided date).
    pub async fn end(
        pool: &PgPool,
        id: Uuid,
        end_date: Option<chrono::NaiveDate>,
    ) -> Result<Assignment> {
        let assignment = sqlx::query_as::<_, Assignment>(
            r#"
            UPDATE core.assignments
            SET end_date = COALESCE($2, CURRENT_DATE), updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(end_date)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(assignment)
    }

    /// List all assignments for a person (including historical).
    pub async fn list_by_person(pool: &PgPool, person_id: Uuid) -> Result<Vec<Assignment>> {
        let assignments = sqlx::query_as::<_, Assignment>(
            r#"
            SELECT * FROM core.assignments
            WHERE person_id = $1
            ORDER BY start_date DESC
            "#,
        )
        .bind(person_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(assignments)
    }

    /// List all assignments for an org node (including historical).
    pub async fn list_by_node(pool: &PgPool, node_id: Uuid) -> Result<Vec<Assignment>> {
        let assignments = sqlx::query_as::<_, Assignment>(
            r#"
            SELECT * FROM core.assignments
            WHERE node_id = $1
            ORDER BY start_date DESC
            "#,
        )
        .bind(node_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(assignments)
    }

    /// List currently active assignments (no end_date or end_date in the future).
    pub async fn list_active(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<Assignment>> {
        let assignments = sqlx::query_as::<_, Assignment>(
            r#"
            SELECT a.* FROM core.assignments a
            JOIN core.org_nodes n ON n.id = a.node_id
            JOIN core.org_trees t ON t.id = n.tree_id
            WHERE t.tenant_id = $1
              AND a.start_date <= CURRENT_DATE
              AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
            ORDER BY a.start_date DESC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(assignments)
    }

    /// Append a forensic audit entry to the assignment history.
    pub async fn log_history(
        pool: &PgPool,
        input: CreateAssignmentHistory,
    ) -> Result<AssignmentHistory> {
        let entry = sqlx::query_as::<_, AssignmentHistory>(
            r#"
            INSERT INTO core.assignment_history
                (assignment_id, action, changed_by, changes, reason, effective_date)
            VALUES ($1, $2::core.assignment_action, $3, COALESCE($4, '{}'), $5, $6)
            RETURNING *
            "#,
        )
        .bind(input.assignment_id)
        .bind(&input.action)
        .bind(input.changed_by)
        .bind(&input.changes)
        .bind(&input.reason)
        .bind(input.effective_date)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(entry)
    }

    /// Get the full audit trail for a single assignment, newest first.
    pub async fn get_history(
        pool: &PgPool,
        assignment_id: Uuid,
    ) -> Result<Vec<AssignmentHistory>> {
        let history = sqlx::query_as::<_, AssignmentHistory>(
            r#"
            SELECT * FROM core.assignment_history
            WHERE assignment_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(assignment_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(history)
    }

    /// Find an assignment by primary key.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Assignment>> {
        let a =
            sqlx::query_as::<_, Assignment>("SELECT * FROM core.assignments WHERE id = $1")
                .bind(id)
                .fetch_optional(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        Ok(a)
    }
}

// ============================================================================
// SiteRepository
// ============================================================================

/// Repository for geographic site operations and person/node attachments.
pub struct SiteRepository;

impl SiteRepository {
    /// List all active sites for a tenant.
    pub async fn list(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<Site>> {
        let sites = sqlx::query_as::<_, Site>(
            "SELECT * FROM core.sites WHERE tenant_id = $1 AND is_active = TRUE ORDER BY name",
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(sites)
    }

    /// Create a new site.
    pub async fn create(pool: &PgPool, input: CreateSite) -> Result<Site> {
        let site = sqlx::query_as::<_, Site>(
            r#"
            INSERT INTO core.sites
                (tenant_id, parent_id, site_type, name, address, city, country,
                 geo_lat, geo_lng, timezone, capacity)
            VALUES ($1, $2, $3::core.site_type, $4, $5, $6, $7, $8, $9,
                    COALESCE($10, 'Europe/Paris'), $11)
            RETURNING *
            "#,
        )
        .bind(input.tenant_id)
        .bind(input.parent_id)
        .bind(&input.site_type)
        .bind(&input.name)
        .bind(&input.address)
        .bind(&input.city)
        .bind(&input.country)
        .bind(input.geo_lat)
        .bind(input.geo_lng)
        .bind(&input.timezone)
        .bind(input.capacity)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(site)
    }

    /// Update an existing site.
    pub async fn update(pool: &PgPool, id: Uuid, input: UpdateSite) -> Result<Site> {
        let site = sqlx::query_as::<_, Site>(
            r#"
            UPDATE core.sites SET
                name      = COALESCE($2, name),
                address   = COALESCE($3, address),
                city      = COALESCE($4, city),
                country   = COALESCE($5, country),
                geo_lat   = COALESCE($6, geo_lat),
                geo_lng   = COALESCE($7, geo_lng),
                timezone  = COALESCE($8, timezone),
                capacity  = COALESCE($9, capacity),
                is_active = COALESCE($10, is_active),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.address)
        .bind(&input.city)
        .bind(&input.country)
        .bind(input.geo_lat)
        .bind(input.geo_lng)
        .bind(&input.timezone)
        .bind(input.capacity)
        .bind(input.is_active)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(site)
    }

    /// Find a site by primary key.
    pub async fn find(pool: &PgPool, id: Uuid) -> Result<Option<Site>> {
        let site = sqlx::query_as::<_, Site>("SELECT * FROM core.sites WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(site)
    }

    /// Attach an org node to a site.
    pub async fn attach_node(
        pool: &PgPool,
        node_id: Uuid,
        site_id: Uuid,
        is_primary: bool,
    ) -> Result<NodeSite> {
        let ns = sqlx::query_as::<_, NodeSite>(
            r#"
            INSERT INTO core.node_sites (node_id, site_id, is_primary)
            VALUES ($1, $2, $3)
            ON CONFLICT (node_id, site_id) DO UPDATE SET is_primary = EXCLUDED.is_primary
            RETURNING *
            "#,
        )
        .bind(node_id)
        .bind(site_id)
        .bind(is_primary)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(ns)
    }

    /// Detach an org node from a site.
    pub async fn detach_node(pool: &PgPool, node_id: Uuid, site_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM core.node_sites WHERE node_id = $1 AND site_id = $2")
            .bind(node_id)
            .bind(site_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Attach a person to a site for a given period.
    pub async fn attach_person(
        pool: &PgPool,
        person_id: Uuid,
        site_id: Uuid,
        is_primary: bool,
    ) -> Result<PersonSite> {
        let ps = sqlx::query_as::<_, PersonSite>(
            r#"
            INSERT INTO core.person_sites (person_id, site_id, is_primary)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(person_id)
        .bind(site_id)
        .bind(is_primary)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(ps)
    }

    /// End a person's site attachment (sets end_date to today).
    pub async fn detach_person(pool: &PgPool, person_site_id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE core.person_sites SET end_date = CURRENT_DATE WHERE id = $1",
        )
        .bind(person_site_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// List all persons currently assigned to a site (active attachments only).
    pub async fn list_persons(pool: &PgPool, site_id: Uuid) -> Result<Vec<Person>> {
        let persons = sqlx::query_as::<_, Person>(
            r#"
            SELECT p.* FROM core.persons p
            JOIN core.person_sites ps ON ps.person_id = p.id
            WHERE ps.site_id = $1
              AND (ps.end_date IS NULL OR ps.end_date >= CURRENT_DATE)
              AND p.is_active = TRUE
            ORDER BY p.last_name, p.first_name
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(persons)
    }

    /// List sites attached to a given org node.
    pub async fn list_by_node(pool: &PgPool, node_id: Uuid) -> Result<Vec<Site>> {
        let sites = sqlx::query_as::<_, Site>(
            r#"
            SELECT s.* FROM core.sites s
            JOIN core.node_sites ns ON ns.site_id = s.id
            WHERE ns.node_id = $1 AND s.is_active = TRUE
            ORDER BY ns.is_primary DESC, s.name
            "#,
        )
        .bind(node_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(sites)
    }
}

// ============================================================================
// PermissionProfileRepository
// ============================================================================

/// Repository for node-level permission profile operations, including
/// inherited permission resolution via the closure table.
pub struct PermissionProfileRepository;

impl PermissionProfileRepository {
    /// Retrieve the permission profile attached directly to a node.
    pub async fn get_by_node(pool: &PgPool, node_id: Uuid) -> Result<Option<PermissionProfile>> {
        let profile = sqlx::query_as::<_, PermissionProfile>(
            "SELECT * FROM core.permission_profiles WHERE node_id = $1",
        )
        .bind(node_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(profile)
    }

    /// Create or replace the permission profile for a node (upsert).
    pub async fn upsert(
        pool: &PgPool,
        node_id: Uuid,
        input: UpsertPermissionProfile,
    ) -> Result<PermissionProfile> {
        let profile = sqlx::query_as::<_, PermissionProfile>(
            r#"
            INSERT INTO core.permission_profiles
                (node_id, inherit, modules, max_role, custom_permissions)
            VALUES ($1, COALESCE($2, TRUE), COALESCE($3, '{}'), COALESCE($4, 'user'), COALESCE($5, '{}'))
            ON CONFLICT (node_id) DO UPDATE SET
                inherit            = COALESCE(EXCLUDED.inherit, permission_profiles.inherit),
                modules            = COALESCE(EXCLUDED.modules, permission_profiles.modules),
                max_role           = COALESCE(EXCLUDED.max_role, permission_profiles.max_role),
                custom_permissions = COALESCE(EXCLUDED.custom_permissions, permission_profiles.custom_permissions),
                updated_at         = NOW()
            RETURNING *
            "#,
        )
        .bind(node_id)
        .bind(input.inherit)
        .bind(&input.modules)
        .bind(&input.max_role)
        .bind(&input.custom_permissions)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(profile)
    }

    /// Compute the effective permissions for a node by walking the closure table.
    ///
    /// Profiles are collected from root (shallowest ancestor) to the target node
    /// (deepest), so that more-specific nodes override their ancestors per module.
    /// When a profile has `inherit = false`, the walk stops at that profile.
    pub async fn get_effective(
        pool: &PgPool,
        node_id: Uuid,
    ) -> Result<EffectivePermissions> {
        // Fetch all ancestor profiles ordered root-first (deepest depth = closest ancestor)
        let profiles = sqlx::query_as::<_, PermissionProfile>(
            r#"
            SELECT pp.*
            FROM core.permission_profiles pp
            JOIN core.org_closure c ON c.ancestor_id = pp.node_id
            WHERE c.descendant_id = $1
            ORDER BY c.depth DESC
            "#,
        )
        .bind(node_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        let mut merged_modules = serde_json::Value::Object(serde_json::Map::new());
        let mut merged_custom = serde_json::Value::Object(serde_json::Map::new());
        let mut max_role = String::from("user");
        let mut inherited_from: Vec<Uuid> = vec![];
        let mut stop_inheritance = false;

        for profile in &profiles {
            if stop_inheritance && profile.node_id != node_id {
                break;
            }
            inherited_from.push(profile.node_id);

            // Merge modules (child overrides parent per key)
            if let (
                serde_json::Value::Object(base),
                serde_json::Value::Object(overlay),
            ) = (&mut merged_modules, &profile.modules)
            {
                for (k, v) in overlay {
                    base.insert(k.clone(), v.clone());
                }
            }

            // Merge custom_permissions
            if let (
                serde_json::Value::Object(base),
                serde_json::Value::Object(overlay),
            ) = (&mut merged_custom, &profile.custom_permissions)
            {
                for (k, v) in overlay {
                    base.insert(k.clone(), v.clone());
                }
            }

            // Use the most restrictive max_role encountered (closest to root wins for security)
            if profile.max_role != "user" {
                max_role = profile.max_role.clone();
            }

            if !profile.inherit {
                stop_inheritance = true;
            }
        }

        Ok(EffectivePermissions {
            node_id,
            modules: merged_modules,
            max_role,
            custom_permissions: merged_custom,
            inherited_from,
        })
    }
}
