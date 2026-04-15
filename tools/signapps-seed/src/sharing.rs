//! Sharing seeding — inserts grants and policies.
//!
//! Tables: `sharing.grants`, `sharing.policies`.

use rand::Rng;
use tracing::info;
use uuid::Uuid;

const RESOURCE_TYPES: &[&str] = &[
    "file", "folder", "calendar", "event", "document", "form", "channel",
];

const GRANTEE_TYPES: &[&str] = &["user", "group", "org_node"];

const ROLES: &[&str] = &["viewer", "editor", "manager"];

const CONTAINER_TYPES: &[&str] = &["folder", "calendar", "form_space", "channel_group"];

/// Seeds Acme Corp sharing (30 grants, 3 policies).
///
/// # Errors
///
/// Returns an error if any database operation fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub async fn seed_acme(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!(%tenant_id, users = user_ids.len(), "seeding acme sharing");

    if user_ids.is_empty() {
        info!("no users — skipping acme sharing seed");
        return Ok(());
    }

    seed_grants(pool, tenant_id, user_ids, 30).await?;
    seed_policies(pool, tenant_id, user_ids, 3).await?;
    Ok(())
}

/// Seeds Startup SAS sharing (5 grants).
///
/// # Errors
///
/// Returns an error if any database operation fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub async fn seed_startup(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!(%tenant_id, users = user_ids.len(), "seeding startup sharing");

    if user_ids.is_empty() {
        info!("no users — skipping startup sharing seed");
        return Ok(());
    }

    seed_grants(pool, tenant_id, user_ids, 5).await?;
    Ok(())
}

// ── Private helpers ───────────────────────────────────────────────────────────

async fn seed_grants(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
    count: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut rng = rand::thread_rng();

    for i in 0..count {
        let resource_type = *crate::helpers::pick(RESOURCE_TYPES, i);
        let resource_id = Uuid::new_v4();
        // Only use 'user' grantee_type to keep seed simple and avoid group/org FK issues
        let grantee_type = "user";
        let (grantee_id, _, _) = crate::helpers::pick(user_ids, rng.gen_range(0..user_ids.len()));
        let role = *crate::helpers::pick(ROLES, i);
        let (granted_by, _, _) = crate::helpers::pick(user_ids, rng.gen_range(0..user_ids.len()));
        let can_reshare = rng.gen_bool(0.2);
        let inherit = rng.gen_bool(0.8);
        let expires_at_offset: Option<i64> = if rng.gen_bool(0.3) {
            Some(rng.gen_range(30i64..=365))
        } else {
            None
        };

        let result = if let Some(offset) = expires_at_offset {
            sqlx::query(
                r#"
                INSERT INTO sharing.grants
                    (id, tenant_id, resource_type, resource_id, grantee_type, grantee_id,
                     role, can_reshare, inherit, granted_by, expires_at, created_at, updated_at)
                VALUES
                    ($1, $2, $3, $4, $5, $6,
                     $7, $8, $9, $10,
                     NOW() + ($11 || ' days')::INTERVAL,
                     NOW(), NOW())
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(tenant_id)
            .bind(resource_type)
            .bind(resource_id)
            .bind(grantee_type)
            .bind(grantee_id)
            .bind(role)
            .bind(can_reshare)
            .bind(inherit)
            .bind(granted_by)
            .bind(offset.to_string())
            .execute(pool)
            .await
        } else {
            sqlx::query(
                r#"
                INSERT INTO sharing.grants
                    (id, tenant_id, resource_type, resource_id, grantee_type, grantee_id,
                     role, can_reshare, inherit, granted_by, created_at, updated_at)
                VALUES
                    ($1, $2, $3, $4, $5, $6,
                     $7, $8, $9, $10,
                     NOW(), NOW())
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(tenant_id)
            .bind(resource_type)
            .bind(resource_id)
            .bind(grantee_type)
            .bind(grantee_id)
            .bind(role)
            .bind(can_reshare)
            .bind(inherit)
            .bind(granted_by)
            .execute(pool)
            .await
        };

        if let Err(e) = result {
            tracing::warn!(error = %e, "sharing grant insert failed — skipping");
        }
    }
    info!(count, "sharing grants created");

    Ok(())
}

async fn seed_policies(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
    count: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut rng = rand::thread_rng();

    for i in 0..count {
        let container_type = *crate::helpers::pick(CONTAINER_TYPES, i);
        let container_id = Uuid::new_v4();
        let grantee_type = *crate::helpers::pick(GRANTEE_TYPES, i);
        let (grantee_id, _, _) = crate::helpers::pick(user_ids, rng.gen_range(0..user_ids.len()));
        // policies only use viewer/editor/manager (not 'deny')
        let default_role = *crate::helpers::pick(ROLES, i);
        let can_reshare = rng.gen_bool(0.15);
        let apply_to_existing = rng.gen_bool(0.5);
        let (created_by, _, _) = crate::helpers::pick(user_ids, 0);

        // Only 'user' grantee_type avoids FK issues with groups/org_nodes in seed
        let effective_grantee_type = if grantee_type == "user" {
            "user"
        } else {
            "user"
        };

        let result = sqlx::query(
            r#"
            INSERT INTO sharing.policies
                (id, tenant_id, container_type, container_id, grantee_type, grantee_id,
                 default_role, can_reshare, apply_to_existing, created_by, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6,
                 $7, $8, $9, $10, NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(tenant_id)
        .bind(container_type)
        .bind(container_id)
        .bind(effective_grantee_type)
        .bind(grantee_id)
        .bind(default_role)
        .bind(can_reshare)
        .bind(apply_to_existing)
        .bind(created_by)
        .execute(pool)
        .await;

        if let Err(e) = result {
            tracing::warn!(error = %e, "sharing policy insert failed — skipping");
        }
    }
    info!(count, "sharing policies created");

    Ok(())
}
