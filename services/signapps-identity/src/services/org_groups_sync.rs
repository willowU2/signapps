//! Auto-group sync service: keeps `identity.groups` in sync with `core.org_nodes`
//! and `identity.group_members` in sync with `core.assignments`.
//!
//! Called from org node / assignment handlers whenever org structure changes.

use signapps_common::Error;
use sqlx::PgPool;
use uuid::Uuid;

/// Called when an org node is created — creates a corresponding `identity.group`.
#[allow(dead_code)]
pub async fn on_node_created(
    pool: &PgPool,
    node_id: Uuid,
    node_name: &str,
    node_code: Option<&str>,
) -> Result<(), Error> {
    let group_name = format!("org:{}", node_code.unwrap_or(&node_id.to_string()));
    sqlx::query(
        "INSERT INTO identity.groups (name, description, source, external_id)
         VALUES ($1, $2, 'org', $3)
         ON CONFLICT DO NOTHING",
    )
    .bind(&group_name)
    .bind(format!("Auto-group for org node: {node_name}"))
    .bind(node_id.to_string())
    .execute(pool)
    .await
    .map_err(|e| Error::Internal(format!("Group sync: {e}")))?;
    Ok(())
}

/// Called when an org node is deleted — removes the corresponding `identity.group`.
#[allow(dead_code)]
pub async fn on_node_deleted(pool: &PgPool, node_id: Uuid) -> Result<(), Error> {
    sqlx::query("DELETE FROM identity.groups WHERE source = 'org' AND external_id = $1")
        .bind(node_id.to_string())
        .execute(pool)
        .await
        .map_err(|e| Error::Internal(format!("Group cleanup: {e}")))?;
    Ok(())
}

/// Called when an assignment is created — adds the user to the node's group and
/// all ancestor groups (via the closure table).
#[allow(dead_code)]
pub async fn on_assignment_created(
    pool: &PgPool,
    person_id: Uuid,
    node_id: Uuid,
) -> Result<(), Error> {
    // 1. Resolve person → user_id
    let user_id: Option<Uuid> =
        sqlx::query_scalar("SELECT user_id FROM core.persons WHERE id = $1")
            .bind(person_id)
            .fetch_optional(pool)
            .await
            .unwrap_or(None)
            .flatten();

    let user_id = match user_id {
        Some(id) => id,
        None => return Ok(()), // person has no platform account — skip
    };

    // 2. Get all ancestor nodes (closure table), including self (depth = 0)
    let ancestor_ids: Vec<Uuid> =
        sqlx::query_scalar("SELECT ancestor_id FROM core.org_closure WHERE descendant_id = $1")
            .bind(node_id)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

    // 3. For each ancestor, find its auto-group and add the user
    for ancestor_id in ancestor_ids {
        let group_id: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM identity.groups WHERE source = 'org' AND external_id = $1",
        )
        .bind(ancestor_id.to_string())
        .fetch_optional(pool)
        .await
        .unwrap_or(None);

        if let Some(gid) = group_id {
            sqlx::query(
                "INSERT INTO identity.group_members (group_id, user_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING",
            )
            .bind(gid)
            .bind(user_id)
            .execute(pool)
            .await
            .ok();
        }
    }

    Ok(())
}

/// Called when an assignment ends — removes the user from the node's group and
/// ancestor groups, but only when no other active assignment covers that ancestor.
#[allow(dead_code)]
pub async fn on_assignment_ended(
    pool: &PgPool,
    person_id: Uuid,
    node_id: Uuid,
) -> Result<(), Error> {
    let user_id: Option<Uuid> =
        sqlx::query_scalar("SELECT user_id FROM core.persons WHERE id = $1")
            .bind(person_id)
            .fetch_optional(pool)
            .await
            .unwrap_or(None)
            .flatten();

    let user_id = match user_id {
        Some(id) => id,
        None => return Ok(()),
    };

    // Get all ancestor IDs of the ended assignment's node
    let ancestor_ids: Vec<Uuid> =
        sqlx::query_scalar("SELECT ancestor_id FROM core.org_closure WHERE descendant_id = $1")
            .bind(node_id)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

    // For each ancestor, only remove if the user has no other active assignment
    // whose subtree still reaches that ancestor
    for ancestor_id in ancestor_ids {
        let still_assigned: bool = sqlx::query_scalar(
            "SELECT EXISTS(
                SELECT 1 FROM core.assignments a
                JOIN core.org_closure c ON c.descendant_id = a.node_id
                WHERE a.person_id = $1
                  AND c.ancestor_id = $2
                  AND a.end_date IS NULL
                  AND a.node_id != $3
            )",
        )
        .bind(person_id)
        .bind(ancestor_id)
        .bind(node_id)
        .fetch_one(pool)
        .await
        .unwrap_or(true); // default to true (keep membership) on error

        if !still_assigned {
            if let Some(gid) = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM identity.groups WHERE source = 'org' AND external_id = $1",
            )
            .bind(ancestor_id.to_string())
            .fetch_optional(pool)
            .await
            .unwrap_or(None)
            {
                sqlx::query(
                    "DELETE FROM identity.group_members WHERE group_id = $1 AND user_id = $2",
                )
                .bind(gid)
                .bind(user_id)
                .execute(pool)
                .await
                .ok();
            }
        }
    }

    Ok(())
}

/// Full re-sync: rebuilds all org auto-groups and memberships for the given tenant.
///
/// Returns the number of groups (re)created.
#[allow(dead_code)]
pub async fn full_resync(pool: &PgPool, tenant_id: Uuid) -> Result<u32, Error> {
    // 1. Delete all org auto-groups for this tenant's nodes
    sqlx::query(
        "DELETE FROM identity.groups
         WHERE source = 'org'
           AND id IN (
               SELECT g.id FROM identity.groups g
               JOIN core.org_nodes n ON g.external_id = n.id::text
               JOIN core.org_trees t ON n.tree_id = t.id
               WHERE t.tenant_id = $1
           )",
    )
    .bind(tenant_id)
    .execute(pool)
    .await
    .ok();

    // 2. Recreate groups for all active nodes in this tenant
    let created: Vec<i32> = sqlx::query_scalar(
        "INSERT INTO identity.groups (name, description, source, external_id)
         SELECT
             'org:' || COALESCE(n.code, n.id::text),
             'Auto-group: ' || n.name,
             'org',
             n.id::text
         FROM core.org_nodes n
         JOIN core.org_trees t ON n.tree_id = t.id
         WHERE t.tenant_id = $1 AND n.is_active = true
         ON CONFLICT DO NOTHING
         RETURNING 1",
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // 3. Re-add all active assignment users to their groups (via closure)
    sqlx::query(
        "INSERT INTO identity.group_members (group_id, user_id)
         SELECT g.id, p.user_id
         FROM core.assignments a
         JOIN core.persons p ON p.id = a.person_id
         JOIN core.org_closure c ON c.descendant_id = a.node_id
         JOIN identity.groups g
              ON g.source = 'org' AND g.external_id = c.ancestor_id::text
         WHERE a.end_date IS NULL AND p.user_id IS NOT NULL
         ON CONFLICT DO NOTHING",
    )
    .execute(pool)
    .await
    .ok();

    Ok(created.len() as u32)
}
