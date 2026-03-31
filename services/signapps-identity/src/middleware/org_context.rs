//! Org context computation for the current authenticated user.
//!
//! This is a service helper (not an Axum middleware layer) that handlers call
//! when they need the full org context of the requesting user.

use serde::Serialize;
use signapps_db::DatabasePool;
use uuid::Uuid;

/// Active assignment details included in an `OrgContext`.
#[derive(Debug, Clone, Serialize)]
pub struct OrgAssignmentInfo {
    /// Primary key of the assignment record.
    pub assignment_id: Uuid,
    /// Org node the person is assigned to.
    pub node_id: Uuid,
    /// Human-readable name of the org node.
    pub node_name: String,
    /// Node type discriminator (e.g. `"department"`, `"team"`).
    pub node_type: String,
    /// Assignment type (e.g. `"holder"`, `"interim"`, `"deputy"`).
    pub assignment_type: String,
    /// Responsibility dimension (e.g. `"hierarchical"`, `"functional"`).
    pub responsibility_type: String,
}

/// Resolved org context for a user: their person record, active assignments,
/// auto-group memberships, effective module permissions, and max role.
#[derive(Debug, Clone, Serialize)]
pub struct OrgContext {
    /// Identity-linked person record UUID (if the user has one).
    pub person_id: Option<Uuid>,
    /// All currently active org assignments.
    pub active_assignments: Vec<OrgAssignmentInfo>,
    /// UUIDs of all `identity.groups` the user belongs to via org membership.
    pub org_group_ids: Vec<Uuid>,
    /// Merged module-level permissions across all assigned positions.
    pub effective_modules: serde_json::Value,
    /// Highest `max_role` value found across all relevant permission profiles.
    pub max_role: String,
}

/// Compute the org context for the given `user_id`.
///
/// This function never returns an error; on any DB failure it returns a
/// zeroed-out context so callers can continue without crashing.
pub async fn get_org_context(pool: &DatabasePool, user_id: Uuid) -> OrgContext {
    // Deref DatabasePool → PgPool for sqlx compatibility
    let pg: &sqlx::PgPool = &**pool;

    // 1. Find person linked to this user
    let person_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM core.persons WHERE user_id = $1 AND is_active = true LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(pg)
    .await
    .unwrap_or(None);

    let empty = OrgContext {
        person_id,
        active_assignments: vec![],
        org_group_ids: vec![],
        effective_modules: serde_json::json!({}),
        max_role: "viewer".to_string(),
    };

    let person_id = match person_id {
        Some(pid) => pid,
        None => return empty,
    };

    // 2. Active assignments with node metadata
    #[derive(sqlx::FromRow)]
    struct AssignmentRow {
        assignment_id: Uuid,
        node_id: Uuid,
        node_name: String,
        node_type: String,
        assignment_type: String,
        responsibility_type: String,
    }

    let assignments: Vec<AssignmentRow> = sqlx::query_as::<_, AssignmentRow>(
        "SELECT
             a.id            AS assignment_id,
             a.node_id,
             n.name          AS node_name,
             n.node_type,
             a.assignment_type::text,
             a.responsibility_type::text
         FROM core.assignments a
         JOIN core.org_nodes n ON n.id = a.node_id
         WHERE a.person_id = $1 AND a.end_date IS NULL",
    )
    .bind(person_id)
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    let active_assignments: Vec<OrgAssignmentInfo> = assignments
        .iter()
        .map(|r| OrgAssignmentInfo {
            assignment_id: r.assignment_id,
            node_id: r.node_id,
            node_name: r.node_name.clone(),
            node_type: r.node_type.clone(),
            assignment_type: r.assignment_type.clone(),
            responsibility_type: r.responsibility_type.clone(),
        })
        .collect();

    // 3. Org group IDs the user belongs to (from identity.group_members)
    let org_group_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT DISTINCT gm.group_id
         FROM identity.group_members gm
         JOIN identity.groups g ON g.id = gm.group_id
         WHERE gm.user_id = $1 AND g.source = 'org'",
    )
    .bind(user_id)
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    // 4. Collect all node IDs from active assignments
    let node_ids: Vec<Uuid> = assignments.iter().map(|r| r.node_id).collect();

    // 5. Gather permission profiles from all ancestor nodes and merge them.
    //    Most-specific (deepest) node overrides ancestors per module key.
    #[derive(sqlx::FromRow)]
    struct ProfileRow {
        modules: serde_json::Value,
        max_role: String,
    }

    let profiles: Vec<ProfileRow> = if node_ids.is_empty() {
        vec![]
    } else {
        sqlx::query_as::<_, ProfileRow>(
            "SELECT pp.modules, pp.max_role
             FROM core.permission_profiles pp
             JOIN core.org_closure c ON c.ancestor_id = pp.node_id
             WHERE c.descendant_id = ANY($1)
             ORDER BY c.depth DESC",
        )
        .bind(&node_ids[..])
        .fetch_all(pg)
        .await
        .unwrap_or_default()
    };

    // Merge modules: earlier entries (deeper/more-specific) take precedence
    let mut merged_modules = serde_json::json!({});
    let mut max_role = "viewer".to_string();
    for profile in &profiles {
        if let (Some(base), Some(overlay)) = (
            merged_modules.as_object_mut(),
            profile.modules.as_object(),
        ) {
            for (k, v) in overlay {
                base.entry(k).or_insert_with(|| v.clone());
            }
        }
        if role_rank(&profile.max_role) > role_rank(&max_role) {
            max_role = profile.max_role.clone();
        }
    }

    OrgContext {
        person_id: Some(person_id),
        active_assignments,
        org_group_ids,
        effective_modules: merged_modules,
        max_role,
    }
}

/// Simple ordinal rank for role strings so we can find the "highest" role.
fn role_rank(role: &str) -> u8 {
    match role {
        "admin" | "superadmin" => 100,
        "manager" => 80,
        "editor" => 60,
        "member" => 40,
        "viewer" => 20,
        _ => 0,
    }
}
