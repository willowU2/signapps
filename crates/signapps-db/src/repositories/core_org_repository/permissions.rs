//! PermissionProfileRepository — node-level permission profile operations.

use crate::models::core_org::{EffectivePermissions, PermissionProfile, UpsertPermissionProfile};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

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
    pub async fn get_effective(pool: &PgPool, node_id: Uuid) -> Result<EffectivePermissions> {
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
            if let (serde_json::Value::Object(base), serde_json::Value::Object(overlay)) =
                (&mut merged_modules, &profile.modules)
            {
                for (k, v) in overlay {
                    base.insert(k.clone(), v.clone());
                }
            }

            // Merge custom_permissions
            if let (serde_json::Value::Object(base), serde_json::Value::Object(overlay)) =
                (&mut merged_custom, &profile.custom_permissions)
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
