//! Integration test scenarios for the sharing/permission engine.
//!
//! Implements the **14 critical scenarios** from the sharing engine specification
//! and validates them against a live PostgreSQL instance with the full migrations
//! applied.
//!
//! ## Running the tests
//!
//! The live-DB tests use `#[sqlx::test]`, which automatically provisions a
//! fresh database per test and tears it down afterwards.
//!
//! ```bash
//! # Run non-ignored tests (unit tests only — no DB needed):
//! cargo test -p signapps-sharing --test sharing_scenarios
//!
//! # Run all tests including the live-DB integration tests:
//! cargo test -p signapps-sharing --test sharing_scenarios -- --include-ignored
//! ```
//!
//! For `#[sqlx::test]` to work, `DATABASE_URL` (or `TEST_DATABASE_URL`) must
//! point to a running PostgreSQL instance.  The macro creates an isolated
//! database per test and drops it afterwards.
//!
//! ## Known issue — migration ordering bug
//!
//! Migration `048_update_drive_nodes_check_constraint.sql` references the
//! `'presentation'` enum value in `drive.node_type`, but that value is only
//! added by migration `058_add_presentation_node_type.sql`. Running migrations
//! from a clean slate therefore fails at step 048.
//!
//! **Workaround**: fix migration 048 to not reference `'presentation'` (the
//! constraint can be extended in migration 058 alongside the enum addition).
//! Until that is fixed, run with `--include-ignored` only against a database
//! that has already applied all migrations (i.e., use `DATABASE_URL` pointing
//! to your existing dev DB).
//!
//! ## Scenario overview
//!
//! | # | Scenario | Expected outcome | Status |
//! |---|----------|-----------------|--------|
//! | 01 | No grants at all | `None` (denied) | live DB |
//! | 02 | SuperAdmin bypass | `Manager` with all caps | live DB |
//! | 03 | Resource owner bypass | `Manager` without a grant | live DB |
//! | 04 | Direct user grant | Role from grant | live DB |
//! | 05 | Group membership grant | Role from group | live DB |
//! | 06 | Org-node ancestry grant | Role from org hierarchy | ignored (TODO) |
//! | 07 | Deny overrides everything | `None` despite positive grants | live DB |
//! | 08 | Most permissive across axes | Highest role wins | ignored (TODO) |
//! | 09 | Everyone grant | All users see the resource | ignored (TODO) |
//! | 10 | Vault entry + Everyone rejected | `BadRequest` error | live DB |
//! | 11 | can_reshare propagation | Only manager/reshare can grant | ignored (TODO) |
//! | 12 | Template application | Multiple grants created in one call | ignored (TODO) |
//! | 13 | Grant expiry | Expired grant treated as absent | ignored (TODO) |
//! | 14 | Capability lookup | Actions match role's capability set | ignored (TODO) |

use std::collections::HashMap;

use signapps_cache::CacheService;
use signapps_sharing::{
    engine::SharingEngine,
    models::{CreateGrant, UserContext},
    types::{GranteeType, ResourceRef, Role},
};
use sqlx::PgPool;
use uuid::Uuid;

// ─── Migrations ───────────────────────────────────────────────────────────────

/// All workspace migrations, applied automatically by `#[sqlx::test]`.
///
/// Path is relative to this crate's root directory
/// (`crates/signapps-sharing`), so `../../migrations` resolves to the
/// workspace-level migrations folder.
static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("../../migrations");

// ─── Test helpers ─────────────────────────────────────────────────────────────

mod helpers {
    use chrono::{DateTime, Utc};
    use sqlx::PgPool;
    use uuid::Uuid;

    /// IDs created by [`setup_tenant`] for a single test scenario.
    pub struct TestCtx {
        pub tenant_id: Uuid,
        pub admin_id: Uuid,
        pub alice_id: Uuid,
        pub bob_id: Uuid,
        pub group_id: Uuid,
    }

    /// Insert a minimal tenant + three users + one group + alice in that group.
    ///
    /// All names are suffixed with a random UUID to prevent unique-key
    /// collisions when tests run in parallel on the same database.
    ///
    /// Uses dynamic `sqlx::query` (not `sqlx::query!`) so no compile-time
    /// schema verification is required (avoids the need for an offline cache).
    pub async fn setup_tenant(pool: &PgPool) -> TestCtx {
        let tenant_id = Uuid::new_v4();
        let admin_id = Uuid::new_v4();
        let alice_id = Uuid::new_v4();
        let bob_id = Uuid::new_v4();
        let group_id = Uuid::new_v4();
        let suffix = Uuid::new_v4();

        // Tenant — only required columns: id, name, slug
        sqlx::query(
            r#"INSERT INTO identity.tenants (id, name, slug) VALUES ($1, $2, $3)"#,
        )
        .bind(tenant_id)
        .bind(format!("Test Tenant {suffix}"))
        .bind(format!("test-{suffix}"))
        .execute(pool)
        .await
        .expect("failed to insert tenant");

        // Users: admin, alice, bob
        for (uid, uname) in [
            (admin_id, format!("admin-{suffix}")),
            (alice_id, format!("alice-{suffix}")),
            (bob_id, format!("bob-{suffix}")),
        ] {
            sqlx::query(
                r#"INSERT INTO identity.users (id, username, tenant_id, role)
                   VALUES ($1, $2, $3, 1)"#,
            )
            .bind(uid)
            .bind(uname)
            .bind(tenant_id)
            .execute(pool)
            .await
            .expect("failed to insert user");
        }

        // Group (unique name per test run)
        sqlx::query(
            r#"INSERT INTO identity.groups (id, name) VALUES ($1, $2)"#,
        )
        .bind(group_id)
        .bind(format!("editors-group-{suffix}"))
        .execute(pool)
        .await
        .expect("failed to insert group");

        // Alice is a member of the group
        sqlx::query(
            r#"INSERT INTO identity.group_members (group_id, user_id) VALUES ($1, $2)"#,
        )
        .bind(group_id)
        .bind(alice_id)
        .execute(pool)
        .await
        .expect("failed to insert group member");

        TestCtx { tenant_id, admin_id, alice_id, bob_id, group_id }
    }

    /// Build a [`signapps_sharing::UserContext`] for a test user.
    pub fn make_ctx(
        user_id: Uuid,
        tenant_id: Uuid,
        group_ids: Vec<Uuid>,
        org_ancestors: Vec<Uuid>,
        system_role: i16,
    ) -> signapps_sharing::UserContext {
        signapps_sharing::UserContext {
            user_id,
            tenant_id,
            group_ids,
            group_roles: std::collections::HashMap::new(),
            org_ancestors,
            system_role,
        }
    }

    /// Insert one grant row directly (bypass engine for test setup).
    ///
    /// Uses dynamic `sqlx::query` so no offline cache is required.
    #[allow(clippy::too_many_arguments)]
    pub async fn insert_grant(
        pool: &PgPool,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        grantee_type: &str,
        grantee_id: Option<Uuid>,
        role: &str,
        granted_by: Uuid,
        can_reshare: bool,
        expires_at: Option<DateTime<Utc>>,
    ) {
        sqlx::query(
            r#"
            INSERT INTO sharing.grants
                (tenant_id, resource_type, resource_id, grantee_type,
                 grantee_id, role, granted_by, can_reshare, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .bind(grantee_type)
        .bind(grantee_id)
        .bind(role)
        .bind(granted_by)
        .bind(can_reshare)
        .bind(expires_at)
        .execute(pool)
        .await
        .expect("failed to insert grant");
    }
}

// ─── Scenario 01 — No grants → access denied ─────────────────────────────────

/// Scenario 01: When no grants exist on a resource, `effective_role` returns `None`.
#[sqlx::test(migrator = "MIGRATOR")]
#[ignore = "requires PostgreSQL; see migration ordering note in module-level docs"]
async fn scenario_01_no_grants_returns_none(pool: PgPool) {
    let ctx = helpers::setup_tenant(&pool).await;
    let engine = SharingEngine::new(pool.clone(), CacheService::default_config());

    let bob_ctx = helpers::make_ctx(ctx.bob_id, ctx.tenant_id, vec![], vec![], 0);
    let file_id = Uuid::new_v4();

    let result = engine
        .effective_role(&bob_ctx, ResourceRef::file(file_id), None)
        .await
        .expect("effective_role should not fail with a valid pool");

    assert!(
        result.is_none(),
        "expected no access for bob when no grants exist, got {result:?}"
    );
}

// ─── Scenario 02 — SuperAdmin bypass ─────────────────────────────────────────

/// Scenario 02: SuperAdmin users bypass all permission checks and always
/// receive `Manager` role with `can_reshare = true` from the `superadmin` axis.
///
/// This is step 1 of the 6-step resolver — evaluated before any DB access — but
/// the capability lookup (step 6) still queries the DB, so a live pool is needed.
#[sqlx::test(migrator = "MIGRATOR")]
#[ignore = "requires PostgreSQL; see migration ordering note in module-level docs"]
async fn scenario_02_superadmin_gets_manager_on_any_resource(pool: PgPool) {
    let ctx = helpers::setup_tenant(&pool).await;
    let engine = SharingEngine::new(pool.clone(), CacheService::default_config());

    let superadmin_ctx =
        helpers::make_ctx(ctx.admin_id, ctx.tenant_id, vec![], vec![], 3);

    let ep = engine
        .effective_role(
            &superadmin_ctx,
            ResourceRef::vault_entry(Uuid::new_v4()),
            None,
        )
        .await
        .expect("effective_role should not fail for superadmin")
        .expect("superadmin must always receive a non-None permission");

    assert_eq!(ep.role, Role::Manager, "superadmin must receive Manager role");
    assert!(ep.can_reshare, "superadmin must have can_reshare = true");
    assert!(
        ep.sources.iter().any(|s| s.axis == "superadmin"),
        "sources must include superadmin axis; got: {:?}",
        ep.sources
    );
}

// ─── Scenario 03 — Resource owner bypass ─────────────────────────────────────

/// Scenario 03: When `owner_id` matches `user_id`, the user receives Manager
/// without any grant row existing.
#[sqlx::test(migrator = "MIGRATOR")]
#[ignore = "requires PostgreSQL; see migration ordering note in module-level docs"]
async fn scenario_03_resource_owner_gets_manager_without_grant(pool: PgPool) {
    let ctx = helpers::setup_tenant(&pool).await;
    let engine = SharingEngine::new(pool.clone(), CacheService::default_config());

    let alice_ctx = helpers::make_ctx(ctx.alice_id, ctx.tenant_id, vec![], vec![], 0);
    let file_id = Uuid::new_v4();

    let ep = engine
        .effective_role(&alice_ctx, ResourceRef::file(file_id), Some(ctx.alice_id))
        .await
        .expect("effective_role should not fail")
        .expect("owner must always receive a non-None permission");

    assert_eq!(ep.role, Role::Manager, "owner must receive Manager role");
    assert!(
        ep.sources.iter().any(|s| s.axis == "owner"),
        "sources must include 'owner' axis; got: {:?}",
        ep.sources
    );
}

// ─── Scenario 04 — Direct user grant ─────────────────────────────────────────

/// Scenario 04: A direct `grantee_type = "user"` grant gives bob the assigned
/// role on the file and surfaces in the `"user"` source axis.
#[sqlx::test(migrator = "MIGRATOR")]
#[ignore = "requires PostgreSQL; see migration ordering note in module-level docs"]
async fn scenario_04_direct_user_grant_resolved(pool: PgPool) {
    let ctx = helpers::setup_tenant(&pool).await;
    let engine = SharingEngine::new(pool.clone(), CacheService::default_config());

    let file_id = Uuid::new_v4();

    helpers::insert_grant(
        &pool,
        ctx.tenant_id,
        "file",
        file_id,
        "user",
        Some(ctx.bob_id),
        "editor",
        ctx.admin_id,
        false,
        None,
    )
    .await;

    let bob_ctx = helpers::make_ctx(ctx.bob_id, ctx.tenant_id, vec![], vec![], 0);

    let ep = engine
        .effective_role(&bob_ctx, ResourceRef::file(file_id), None)
        .await
        .expect("effective_role should not fail")
        .expect("bob must have access via direct grant");

    assert_eq!(
        ep.role,
        Role::Editor,
        "bob must receive Editor role from the direct grant"
    );
    assert!(
        ep.sources.iter().any(|s| s.axis == "user"),
        "sources must include 'user' axis; got: {:?}",
        ep.sources
    );
}

// ─── Scenario 05 — Group membership grant ────────────────────────────────────

/// Scenario 05: A grant targeting a group propagates to alice who is a member
/// of that group (via `alice_ctx.group_ids`).
#[sqlx::test(migrator = "MIGRATOR")]
#[ignore = "requires PostgreSQL; see migration ordering note in module-level docs"]
async fn scenario_05_group_grant_applies_to_member(pool: PgPool) {
    let ctx = helpers::setup_tenant(&pool).await;
    let engine = SharingEngine::new(pool.clone(), CacheService::default_config());

    let doc_id = Uuid::new_v4();

    helpers::insert_grant(
        &pool,
        ctx.tenant_id,
        "document",
        doc_id,
        "group",
        Some(ctx.group_id),
        "editor",
        ctx.admin_id,
        false,
        None,
    )
    .await;

    // alice_ctx includes group_id so the group axis resolves the grant
    let alice_ctx =
        helpers::make_ctx(ctx.alice_id, ctx.tenant_id, vec![ctx.group_id], vec![], 0);

    let ep = engine
        .effective_role(&alice_ctx, ResourceRef::document(doc_id), None)
        .await
        .expect("effective_role should not fail")
        .expect("alice must have access via group grant");

    assert_eq!(
        ep.role,
        Role::Editor,
        "alice must receive Editor role from the group grant"
    );
    assert!(
        ep.sources.iter().any(|s| s.axis == "group"),
        "sources must include 'group' axis; got: {:?}",
        ep.sources
    );
}

// ─── Scenario 06 — Org-node ancestry grant ───────────────────────────────────

#[tokio::test]
#[ignore = "TODO: implement with live pool — needs org_node setup in identity schema"]
async fn scenario_06_org_node_grant_applies_to_descendant() {
    // Setup:
    //   - Create an org-node tree: root → engineering → backend.
    //   - Grant "engineering" org-node Role::Viewer on an asset.
    //
    // Exercise:
    //   engine.effective_role(&diana_ctx, ResourceRef::asset(asset_id), None)
    //   where diana_ctx.org_ancestors = [backend_id, engineering_id, root_id].
    //
    // Expected:
    //   Returns Ok(Some(ep)) where ep.role == Role::Viewer.
    //   ep.sources contains an entry with axis = "org_node".
    //
    // Implementation notes:
    //   - Insert a grant with grantee_type = 'org_node', grantee_id = engineering_id.
    //   - Build diana_ctx with org_ancestors = [backend_id, engineering_id, root_id].
    //   - The resolver fetches grants for any ID in org_ancestors.

    todo!("implement with live pool")
}

// ─── Scenario 07 — Deny overrides positive grants ────────────────────────────

/// Scenario 07: An explicit deny on the user axis overrides a positive group
/// grant, even when alice is a member of the group.
///
/// The resolver's step 3 checks for any deny across all axes and immediately
/// returns `None` when found.
#[sqlx::test(migrator = "MIGRATOR")]
#[ignore = "requires PostgreSQL; see migration ordering note in module-level docs"]
async fn scenario_07_deny_overrides_positive_grant_on_any_axis(pool: PgPool) {
    let ctx = helpers::setup_tenant(&pool).await;
    let engine = SharingEngine::new(pool.clone(), CacheService::default_config());

    let file_id = Uuid::new_v4();

    // Positive grant via group (alice is a member)
    helpers::insert_grant(
        &pool,
        ctx.tenant_id,
        "file",
        file_id,
        "group",
        Some(ctx.group_id),
        "editor",
        ctx.admin_id,
        false,
        None,
    )
    .await;

    // Explicit deny directly on alice (user axis)
    helpers::insert_grant(
        &pool,
        ctx.tenant_id,
        "file",
        file_id,
        "user",
        Some(ctx.alice_id),
        "deny",
        ctx.admin_id,
        false,
        None,
    )
    .await;

    // alice is in the group (has a positive group grant) but also has a deny
    let alice_ctx =
        helpers::make_ctx(ctx.alice_id, ctx.tenant_id, vec![ctx.group_id], vec![], 0);

    let result = engine
        .effective_role(&alice_ctx, ResourceRef::file(file_id), None)
        .await
        .expect("effective_role should not fail");

    assert!(
        result.is_none(),
        "deny must override the positive group grant; got {result:?}"
    );
}

// ─── Scenario 08 — Most permissive across axes ───────────────────────────────

#[tokio::test]
#[ignore = "TODO: implement with live pool"]
async fn scenario_08_most_permissive_wins_across_axes() {
    // Setup:
    //   - Grant bob Role::Viewer via the "everyone" axis.
    //   - Grant bob Role::Editor directly (user axis).
    //
    // Exercise:
    //   engine.effective_role(&bob_ctx, ResourceRef::calendar(cal_id), None)
    //
    // Expected:
    //   Returns Ok(Some(ep)) where ep.role == Role::Editor (editor > viewer).
    //   ep.sources has two entries (one per axis).
    //
    // Implementation:
    //   helpers::insert_grant(..., "everyone", None, "viewer", ...)
    //   helpers::insert_grant(..., "user", Some(bob_id), "editor", ...)
    //   assert_eq!(ep.role, Role::Editor);
    //   assert_eq!(ep.sources.len(), 2);

    todo!("implement with live pool")
}

// ─── Scenario 09 — Everyone grant ────────────────────────────────────────────

#[tokio::test]
#[ignore = "TODO: implement with live pool"]
async fn scenario_09_everyone_grant_applies_to_any_user() {
    // Setup:
    //   - Grant "everyone" Role::Viewer on a channel.
    //   - bob (no groups, no org nodes) queries the channel.
    //
    // Exercise:
    //   engine.effective_role(&bob_ctx, ResourceRef::channel(channel_id), None)
    //
    // Expected:
    //   Returns Ok(Some(ep)) where ep.role == Role::Viewer.
    //   ep.sources contains an entry with axis = "everyone".
    //
    // Implementation:
    //   helpers::insert_grant(..., "everyone", None, "viewer", ...)
    //   assert_eq!(ep.role, Role::Viewer);
    //   assert!(ep.sources.iter().any(|s| s.axis == "everyone"));

    todo!("implement with live pool")
}

// ─── Scenario 10 — Vault entry + Everyone is rejected ────────────────────────

/// Scenario 10: `engine.grant()` rejects `grantee_type = Everyone` on
/// `VaultEntry` before any DB access (pure business-logic guard).
///
/// The DB constraint `chk_vault_no_everyone` also enforces this at the
/// database level, but the engine validates first and returns a typed
/// `BadRequest` error with a helpful message.
#[sqlx::test(migrator = "MIGRATOR")]
#[ignore = "requires PostgreSQL; see migration ordering note in module-level docs"]
async fn scenario_10_vault_entry_everyone_grant_rejected(pool: PgPool) {
    let ctx = helpers::setup_tenant(&pool).await;
    let engine = SharingEngine::new(pool.clone(), CacheService::default_config());

    // admin_ctx has system_role = 2 (admin), so permission check passes
    let admin_ctx = helpers::make_ctx(ctx.admin_id, ctx.tenant_id, vec![], vec![], 2);

    let result = engine
        .grant(
            &admin_ctx,
            ResourceRef::vault_entry(Uuid::new_v4()),
            None,
            CreateGrant {
                grantee_type: GranteeType::Everyone,
                grantee_id: None,
                role: Role::Viewer,
                can_reshare: None,
                expires_at: None,
            },
        )
        .await;

    assert!(
        result.is_err(),
        "expected Err(BadRequest) for vault_entry + everyone combination, got Ok"
    );

    let err_str = format!("{:?}", result.unwrap_err());
    assert!(
        err_str.contains("vault_entry") || err_str.contains("everyone"),
        "error message should mention 'vault_entry' or 'everyone'; got: {err_str}"
    );
}

// ─── Scenario 11 — can_reshare propagation ───────────────────────────────────

#[tokio::test]
#[ignore = "TODO: implement with live pool"]
async fn scenario_11_can_reshare_allows_non_manager_to_grant() {
    // Setup:
    //   - Grant alice Role::Editor with can_reshare = true on a file.
    //   - alice tries to grant bob Role::Viewer on the same resource.
    //
    // Exercise:
    //   engine.grant(&alice_ctx, resource, None, CreateGrant { role: Viewer, grantee: bob, .. })
    //
    // Expected (can_reshare = true):
    //   Returns Ok(grant) — alice's can_reshare flag allows the re-grant.
    //
    // Counter-test (can_reshare = false):
    //   Insert the alice grant with can_reshare = false.
    //   engine.grant(&alice_ctx, ...) → Err(Forbidden)
    //
    // Implementation:
    //   helpers::insert_grant(..., "editor", ..., can_reshare: true)
    //   let grant = engine.grant(&alice_ctx, ...).await.unwrap();
    //   assert_eq!(grant.role, "viewer");
    //   // then repeat with can_reshare = false → Err

    todo!("implement with live pool")
}

// ─── Scenario 12 — Template application ──────────────────────────────────────

#[tokio::test]
#[ignore = "TODO: requires engine.apply_template() method to be implemented"]
async fn scenario_12_template_applies_multiple_grants() {
    // Setup:
    //   - Insert a sharing template with two grant descriptors:
    //     1. {grantee_type: "everyone", role: "viewer"}
    //     2. {grantee_type: "user", grantee_id: <admin_id>, role: "manager"}
    //   - Create a calendar resource.
    //   - Apply the template as an admin.
    //
    // Exercise:
    //   engine.apply_template(&admin_ctx, ResourceRef::calendar(cal_id), None, template_id)
    //
    // Expected:
    //   Returns Ok(2) — two grants were created.
    //   Subsequent listing shows both rows.

    todo!("implement once apply_template() is added to SharingEngine")
}

// ─── Scenario 13 — Expired grant is not effective ────────────────────────────

#[tokio::test]
#[ignore = "TODO: implement with live pool — straightforward insert with past expires_at"]
async fn scenario_13_expired_grant_is_not_applied() {
    // Setup:
    //   - helpers::insert_grant(..., "editor", ..., expires_at = Utc::now() - Duration::hours(1))
    //
    // Exercise:
    //   engine.effective_role(&jack_ctx, ResourceRef::document(doc_id), None)
    //
    // Expected:
    //   Returns Ok(None) — the SQL filter `expires_at IS NULL OR expires_at > NOW()`
    //   excludes the expired row.
    //
    // Implementation:
    //   use chrono::{Utc, Duration};
    //   let expired_at = Utc::now() - Duration::hours(1);
    //   helpers::insert_grant(..., Some(expired_at)).await;
    //   let result = engine.effective_role(...).await.unwrap();
    //   assert!(result.is_none(), "expired grant must not grant access");

    todo!("implement with live pool")
}

// ─── Scenario 14 — Capability lookup ─────────────────────────────────────────

#[tokio::test]
#[ignore = "TODO: implement with live pool — capabilities are seeded by migration 232"]
async fn scenario_14_capabilities_match_role() {
    // The sharing.capabilities table is pre-populated by migration 232 for all
    // resource types.  No additional setup is needed beyond inserting a grant.
    //
    // Setup:
    //   - Grant kate Role::Viewer on a file.
    //
    // Exercise:
    //   engine.effective_role(&kate_ctx, ResourceRef::file(file_id), None)
    //
    // Expected:
    //   ep.role == Role::Viewer
    //   ep.capabilities contains "read", "preview", "download"
    //   ep.capabilities does NOT contain "write"
    //
    // Counter-check:
    //   engine.check(&kate_ctx, ResourceRef::file(file_id), Action::write(), None)
    //   → Err(Forbidden) because "write" is not in viewer's capabilities for files.
    //
    // Implementation:
    //   helpers::insert_grant(..., "viewer", ...)
    //   let ep = engine.effective_role(...).await.unwrap().unwrap();
    //   assert!(ep.capabilities.contains(&"read".to_string()));
    //   assert!(!ep.capabilities.contains(&"write".to_string()));
    //   let write_check = engine.check(&kate_ctx, ..., Action::write(), None).await;
    //   assert!(matches!(write_check, Err(_)));

    todo!("implement with live pool")
}

// ─── Unused in live tests, referenced from ignored tests ─────────────────────

#[allow(dead_code)]
fn make_ctx_simple(
    user_id: Uuid,
    tenant_id: Uuid,
    group_ids: Vec<Uuid>,
    org_ancestors: Vec<Uuid>,
    system_role: i16,
) -> UserContext {
    UserContext {
        user_id,
        tenant_id,
        group_ids,
        group_roles: HashMap::new(),
        org_ancestors,
        system_role,
    }
}
