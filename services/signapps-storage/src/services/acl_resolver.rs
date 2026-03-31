//! ACL resolver: tree-walk permission inheritance for drive nodes.

use signapps_common::{Error, Result};
use signapps_db::models::drive_acl::{DriveAcl, EffectiveAcl};
use sqlx::PgPool;
use uuid::Uuid;

/// Role ordering for comparison (weakest → strongest).
const ROLE_ORDER: &[&str] = &["viewer", "downloader", "editor", "contributor", "manager"];

/// Return the numeric rank of a role string (higher = more privileged).
/// Unknown roles return -1.
fn role_rank(role: &str) -> i32 {
    ROLE_ORDER
        .iter()
        .position(|&r| r == role)
        .map(|p| p as i32)
        .unwrap_or(-1)
}

/// Resolve the effective role for a user on a drive node.
///
/// Algorithm:
/// 1. If the user owns the node → immediate `manager` (no DB walk needed).
/// 2. Collect the user's group memberships.
/// 3. Walk up the node tree collecting matching ACL grants until a node
///    with `inherit_permissions = false` is reached (or the root).
/// 4. Return the highest-ranked role found across all collected grants.
pub async fn resolve_effective_role(
    pool: &PgPool,
    user_id: Uuid,
    node_id: Uuid,
) -> Result<EffectiveAcl> {
    // 1. Check if user is owner of this node
    let node: Option<(Uuid, Option<Uuid>, Option<bool>)> =
        sqlx::query_as("SELECT id, owner_id, inherit_permissions FROM drive.nodes WHERE id = $1")
            .bind(node_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

    let (nid, owner_id, _inherit) = match node {
        Some(n) => n,
        None => return Err(Error::NotFound(format!("Drive node {node_id} not found"))),
    };

    let is_owner = owner_id == Some(user_id);
    if is_owner {
        return Ok(EffectiveAcl {
            node_id: nid,
            user_id,
            role: Some("manager".into()),
            is_owner: true,
            inherited_from: None,
            grants: vec![],
        });
    }

    // 2. Get the user's group memberships
    let groups: Vec<Uuid> =
        sqlx::query_scalar("SELECT group_id FROM identity.group_members WHERE user_id = $1")
            .bind(user_id)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

    // 3. Walk up the node tree, collecting matching ACL grants
    let mut current_id: Option<Uuid> = Some(node_id);
    let mut collected: Vec<DriveAcl> = vec![];
    let mut inherited_from: Option<Uuid> = None;

    while let Some(cid) = current_id {
        // Fetch ACLs for the current node (only non-expired)
        let acls: Vec<DriveAcl> = sqlx::query_as(
            r#"SELECT * FROM drive.acl
               WHERE node_id = $1
                 AND (expires_at IS NULL OR expires_at > NOW())"#,
        )
        .bind(cid)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        for acl in &acls {
            let matches = match acl.grantee_type.as_str() {
                "everyone" => true,
                "user" => acl.grantee_id == Some(user_id),
                "group" => acl.grantee_id.map(|g| groups.contains(&g)).unwrap_or(false),
                _ => false,
            };
            if matches {
                collected.push(acl.clone());
                // Record the first ancestor that contributed a grant
                if cid != node_id && inherited_from.is_none() {
                    inherited_from = Some(cid);
                }
            }
        }

        // Fetch parent node and inheritance flag
        let node_info: Option<(Option<Uuid>, Option<bool>)> =
            sqlx::query_as("SELECT parent_id, inherit_permissions FROM drive.nodes WHERE id = $1")
                .bind(cid)
                .fetch_optional(pool)
                .await
                .unwrap_or(None);

        match node_info {
            Some((parent, inh)) => {
                // Stop inheriting if the ancestor explicitly disables it
                if inh == Some(false) && cid != node_id {
                    break;
                }
                current_id = parent;
            },
            None => break,
        }
    }

    // 4. Find the highest-ranked role across all collected grants
    let best_role = collected
        .iter()
        .map(|a| a.role.as_str())
        .max_by_key(|r| role_rank(r))
        .map(String::from);

    Ok(EffectiveAcl {
        node_id,
        user_id,
        role: best_role,
        is_owner: false,
        inherited_from,
        grants: collected,
    })
}

/// Check if a user has at least the required role on a node.
///
/// Returns `true` if the user's effective role is at least as privileged as
/// `required_role`. Returns `false` if the user has no grants at all.
pub async fn check_permission(
    pool: &PgPool,
    user_id: Uuid,
    node_id: Uuid,
    required_role: &str,
) -> Result<bool> {
    let effective = resolve_effective_role(pool, user_id, node_id).await?;
    let allowed = match &effective.role {
        Some(role) => role_rank(role) >= role_rank(required_role),
        None => false,
    };
    Ok(allowed)
}

// ============================================================================
// Unit tests (pure, no DB)
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_rank_ordering_is_correct() {
        assert!(role_rank("viewer") < role_rank("downloader"));
        assert!(role_rank("downloader") < role_rank("editor"));
        assert!(role_rank("editor") < role_rank("contributor"));
        assert!(role_rank("contributor") < role_rank("manager"));
    }

    #[test]
    fn unknown_role_returns_minus_one() {
        assert_eq!(role_rank("superadmin"), -1);
        assert_eq!(role_rank(""), -1);
    }

    #[test]
    fn manager_outranks_all_others() {
        for role in &["viewer", "downloader", "editor", "contributor"] {
            assert!(role_rank("manager") > role_rank(role));
        }
    }
}
