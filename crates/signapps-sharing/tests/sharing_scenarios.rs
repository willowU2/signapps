//! Integration test scenarios for the sharing/permission engine.
//!
//! These tests document the **14 critical scenarios** from the sharing engine
//! specification and validate them against a live PostgreSQL instance with the
//! `sharing.*` schema fully migrated.
//!
//! All tests are marked `#[ignore]` because they require a running database.
//! Run them with:
//!
//! ```bash
//! cargo test -p signapps-sharing --test sharing_scenarios -- --ignored
//! ```
//!
//! ## Scenario overview
//!
//! | # | Scenario | Expected outcome |
//! |---|----------|-----------------|
//! | 01 | No grants at all | `None` (denied) |
//! | 02 | SuperAdmin bypass | `Manager` with all caps |
//! | 03 | Resource owner bypass | `Manager` without a grant |
//! | 04 | Direct user grant | Role from grant |
//! | 05 | Group membership grant | Role from group |
//! | 06 | Org-node ancestry grant | Role from org hierarchy |
//! | 07 | Deny overrides everything | `None` despite positive grants |
//! | 08 | Most permissive across axes | Highest role wins |
//! | 09 | Everyone grant | All users see the resource |
//! | 10 | Vault entry + Everyone rejected | `BadRequest` error |
//! | 11 | can_reshare propagation | Only manager/reshare can grant |
//! | 12 | Template application | Multiple grants created in one call |
//! | 13 | Grant expiry | Expired grant treated as absent |
//! | 14 | Capability lookup | Actions match role's capability set |

use std::collections::HashMap;

use uuid::Uuid;

/// Build a plain `UserContext` for test purposes.
///
/// Requires `signapps_sharing::UserContext` to be reachable; this helper avoids
/// repeating the struct literal in every test.
fn make_ctx(
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
        group_roles: HashMap::new(),
        org_ancestors,
        system_role,
    }
}

// ─── Scenario 01 — No grants → access denied ─────────────────────────────────

#[tokio::test]
#[ignore = "requires PostgreSQL with sharing schema"]
async fn scenario_01_no_grants_returns_none() {
    // Setup:
    //   - Create a tenant and two users (alice, bob).
    //   - Create a File resource owned by alice.
    //   - Do NOT create any grant for bob on that file.
    //
    // Exercise:
    //   engine.effective_role(&bob_ctx, ResourceRef::file(file_id), None)
    //
    // Expected:
    //   Returns Ok(None) — bob has no access.

    let _pool = setup_pool().await;
    let _tenant_id = Uuid::new_v4();
    let _file_id = Uuid::new_v4();
    let _bob_ctx = make_ctx(Uuid::new_v4(), _tenant_id, vec![], vec![], 0);

    // Assertions (to fill in with live DB):
    // let result = engine.effective_role(&_bob_ctx, ResourceRef::file(_file_id), None).await.unwrap();
    // assert!(result.is_none(), "expected no access for bob");
    todo!("implement with live pool")
}

// ─── Scenario 02 — SuperAdmin bypass ─────────────────────────────────────────

#[tokio::test]
#[ignore = "requires PostgreSQL with sharing schema"]
async fn scenario_02_superadmin_gets_manager_on_any_resource() {
    // Setup:
    //   - Create a tenant and a superadmin user (system_role = 3).
    //   - Create a VaultEntry resource with NO grants.
    //
    // Exercise:
    //   engine.effective_role(&superadmin_ctx, ResourceRef::vault_entry(id), None)
    //
    // Expected:
    //   Returns Ok(Some(ep)) where ep.role == Role::Manager and ep.can_reshare == true.
    //   The ep.sources contains a single entry with axis = "superadmin".

    let _tenant_id = Uuid::new_v4();
    let _superadmin_ctx = make_ctx(Uuid::new_v4(), _tenant_id, vec![], vec![], 3);

    // assert!(superadmin_ctx.is_superadmin());
    // let ep = engine.effective_role(&superadmin_ctx, ResourceRef::vault_entry(Uuid::new_v4()), None).await.unwrap().unwrap();
    // assert_eq!(ep.role, Role::Manager);
    // assert!(ep.can_reshare);
    // assert_eq!(ep.sources[0].axis, "superadmin");
    todo!("implement with live pool")
}

// ─── Scenario 03 — Resource owner bypass ─────────────────────────────────────

#[tokio::test]
#[ignore = "requires PostgreSQL with sharing schema"]
async fn scenario_03_resource_owner_gets_manager_without_grant() {
    // Setup:
    //   - Create a file resource; pass owner_id = alice's user ID.
    //   - Do NOT create any grant row.
    //
    // Exercise:
    //   engine.effective_role(&alice_ctx, ResourceRef::file(file_id), Some(alice_id))
    //
    // Expected:
    //   Returns Ok(Some(ep)) where ep.role == Role::Manager.
    //   ep.sources contains axis = "owner".

    let _alice_id = Uuid::new_v4();
    let _tenant_id = Uuid::new_v4();
    let _alice_ctx = make_ctx(_alice_id, _tenant_id, vec![], vec![], 0);

    // let ep = engine.effective_role(&alice_ctx, ResourceRef::file(Uuid::new_v4()), Some(_alice_id)).await.unwrap().unwrap();
    // assert_eq!(ep.role, Role::Manager);
    // assert_eq!(ep.sources[0].axis, "owner");
    todo!("implement with live pool")
}

// ─── Scenario 04 — Direct user grant ─────────────────────────────────────────

#[tokio::test]
#[ignore = "requires PostgreSQL with sharing schema"]
async fn scenario_04_direct_user_grant_resolved() {
    // Setup:
    //   - Create a file resource.
    //   - Grant bob Role::Editor directly (grantee_type = "user").
    //
    // Exercise:
    //   engine.effective_role(&bob_ctx, ResourceRef::file(file_id), None)
    //
    // Expected:
    //   Returns Ok(Some(ep)) where ep.role == Role::Editor.
    //   ep.sources contains an entry with axis = "user" and via = "direct grant".

    let _bob_id = Uuid::new_v4();
    let _tenant_id = Uuid::new_v4();
    let _bob_ctx = make_ctx(_bob_id, _tenant_id, vec![], vec![], 0);

    // INSERT INTO sharing.grants ... role = 'editor', grantee_type = 'user', grantee_id = bob_id
    // let ep = engine.effective_role(&bob_ctx, ResourceRef::file(file_id), None).await.unwrap().unwrap();
    // assert_eq!(ep.role, Role::Editor);
    // assert!(ep.sources.iter().any(|s| s.axis == "user"));
    todo!("implement with live pool")
}

// ─── Scenario 05 — Group membership grant ────────────────────────────────────

#[tokio::test]
#[ignore = "requires PostgreSQL with sharing schema"]
async fn scenario_05_group_grant_applies_to_member() {
    // Setup:
    //   - Create a group "editors-group".
    //   - Add charlie to the group.
    //   - Grant "editors-group" Role::Editor on a document.
    //
    // Exercise:
    //   engine.effective_role(&charlie_ctx, ResourceRef::document(doc_id), None)
    //   where charlie_ctx.group_ids contains editors-group's UUID.
    //
    // Expected:
    //   Returns Ok(Some(ep)) where ep.role == Role::Editor.
    //   ep.sources contains an entry with axis = "group".

    let _group_id = Uuid::new_v4();
    let _charlie_id = Uuid::new_v4();
    let _tenant_id = Uuid::new_v4();
    let _charlie_ctx = make_ctx(_charlie_id, _tenant_id, vec![_group_id], vec![], 0);

    // INSERT INTO sharing.grants ... grantee_type = 'group', grantee_id = group_id, role = 'editor'
    // let ep = engine.effective_role(&charlie_ctx, ResourceRef::document(doc_id), None).await.unwrap().unwrap();
    // assert_eq!(ep.role, Role::Editor);
    // assert!(ep.sources.iter().any(|s| s.axis == "group"));
    todo!("implement with live pool")
}

// ─── Scenario 06 — Org-node ancestry grant ───────────────────────────────────

#[tokio::test]
#[ignore = "requires PostgreSQL with sharing schema"]
async fn scenario_06_org_node_grant_applies_to_descendant() {
    // Setup:
    //   - Create an org-node tree: root → engineering → backend.
    //   - Assign diana to "backend" node.
    //   - Grant "engineering" org-node Role::Viewer on an asset.
    //
    // Exercise:
    //   engine.effective_role(&diana_ctx, ResourceRef::asset(asset_id), None)
    //   where diana_ctx.org_ancestors = [backend_id, engineering_id, root_id].
    //
    // Expected:
    //   Returns Ok(Some(ep)) where ep.role == Role::Viewer.
    //   ep.sources contains an entry with axis = "org_node".

    let _engineering_id = Uuid::new_v4();
    let _diana_id = Uuid::new_v4();
    let _tenant_id = Uuid::new_v4();
    let _diana_ctx =
        make_ctx(_diana_id, _tenant_id, vec![], vec![_engineering_id, Uuid::new_v4()], 0);

    // INSERT INTO sharing.grants ... grantee_type = 'org_node', grantee_id = engineering_id, role = 'viewer'
    // let ep = engine.effective_role(&diana_ctx, ResourceRef::asset(asset_id), None).await.unwrap().unwrap();
    // assert_eq!(ep.role, Role::Viewer);
    // assert!(ep.sources.iter().any(|s| s.axis == "org_node"));
    todo!("implement with live pool")
}

// ─── Scenario 07 — Deny overrides positive grants ────────────────────────────

#[tokio::test]
#[ignore = "requires PostgreSQL with sharing schema"]
async fn scenario_07_deny_overrides_positive_grant_on_any_axis() {
    // Setup:
    //   - Grant eve Role::Editor via a group.
    //   - Also add a deny grant directly on eve (grantee_type = "user", role = "deny").
    //
    // Exercise:
    //   engine.effective_role(&eve_ctx, ResourceRef::file(file_id), None)
    //
    // Expected:
    //   Returns Ok(None) — the deny on the user axis overrides the positive group grant.
    //
    // Note:
    //   The resolver step 3 issues a `has_deny` query that checks all four axes.
    //   A single deny on any axis triggers an immediate return of None.

    let _eve_id = Uuid::new_v4();
    let _group_id = Uuid::new_v4();
    let _tenant_id = Uuid::new_v4();
    let _eve_ctx = make_ctx(_eve_id, _tenant_id, vec![_group_id], vec![], 0);

    // INSERT INTO sharing.grants ... grantee_type = 'group', grantee_id = group_id, role = 'editor'
    // INSERT INTO sharing.grants ... grantee_type = 'user', grantee_id = eve_id, role = 'deny'
    //
    // let result = engine.effective_role(&eve_ctx, ResourceRef::file(file_id), None).await.unwrap();
    // assert!(result.is_none(), "deny must override the positive group grant");
    todo!("implement with live pool")
}

// ─── Scenario 08 — Most permissive across axes ───────────────────────────────

#[tokio::test]
#[ignore = "requires PostgreSQL with sharing schema"]
async fn scenario_08_most_permissive_wins_across_axes() {
    // Setup:
    //   - Grant frank Role::Viewer via the "everyone" axis.
    //   - Grant frank Role::Editor directly (user axis).
    //
    // Exercise:
    //   engine.effective_role(&frank_ctx, ResourceRef::calendar(cal_id), None)
    //
    // Expected:
    //   Returns Ok(Some(ep)) where ep.role == Role::Editor (editor > viewer).
    //   ep.sources has two entries (one per axis).

    let _frank_id = Uuid::new_v4();
    let _tenant_id = Uuid::new_v4();
    let _frank_ctx = make_ctx(_frank_id, _tenant_id, vec![], vec![], 0);

    // INSERT INTO sharing.grants ... grantee_type = 'everyone', role = 'viewer'
    // INSERT INTO sharing.grants ... grantee_type = 'user', grantee_id = frank_id, role = 'editor'
    //
    // let ep = engine.effective_role(&frank_ctx, ResourceRef::calendar(cal_id), None).await.unwrap().unwrap();
    // assert_eq!(ep.role, Role::Editor);
    // assert_eq!(ep.sources.len(), 2);
    todo!("implement with live pool")
}

// ─── Scenario 09 — Everyone grant ────────────────────────────────────────────

#[tokio::test]
#[ignore = "requires PostgreSQL with sharing schema"]
async fn scenario_09_everyone_grant_applies_to_any_user() {
    // Setup:
    //   - Grant "everyone" Role::Viewer on a channel.
    //   - Create grace (a new user with no groups, no org nodes).
    //
    // Exercise:
    //   engine.effective_role(&grace_ctx, ResourceRef::channel(channel_id), None)
    //
    // Expected:
    //   Returns Ok(Some(ep)) where ep.role == Role::Viewer.
    //   ep.sources contains an entry with axis = "everyone".

    let _grace_id = Uuid::new_v4();
    let _tenant_id = Uuid::new_v4();
    let _grace_ctx = make_ctx(_grace_id, _tenant_id, vec![], vec![], 0);

    // INSERT INTO sharing.grants ... grantee_type = 'everyone', grantee_id = NULL, role = 'viewer'
    //
    // let ep = engine.effective_role(&grace_ctx, ResourceRef::channel(channel_id), None).await.unwrap().unwrap();
    // assert_eq!(ep.role, Role::Viewer);
    // assert!(ep.sources.iter().any(|s| s.axis == "everyone"));
    todo!("implement with live pool")
}

// ─── Scenario 10 — Vault entry + Everyone is rejected ────────────────────────

#[tokio::test]
#[ignore = "requires PostgreSQL with sharing schema"]
async fn scenario_10_vault_entry_everyone_grant_rejected() {
    // Setup:
    //   - Create a VaultEntry resource.
    //   - Attempt to grant "everyone" any role on it via engine.grant().
    //
    // Exercise:
    //   engine.grant(&admin_ctx, ResourceRef::vault_entry(vault_id), None, CreateGrant {
    //     grantee_type: GranteeType::Everyone, grantee_id: None, role: Role::Viewer, ..
    //   })
    //
    // Expected:
    //   Returns Err(Error::BadRequest("vault_entry resources cannot be granted to 'everyone'")).
    //
    // Note:
    //   This validation is performed in engine.grant() BEFORE any DB access.

    let _admin_id = Uuid::new_v4();
    let _tenant_id = Uuid::new_v4();
    let _admin_ctx = make_ctx(_admin_id, _tenant_id, vec![], vec![], 2);

    // let result = engine.grant(
    //     &admin_ctx,
    //     ResourceRef::vault_entry(Uuid::new_v4()),
    //     None,
    //     CreateGrant {
    //         grantee_type: GranteeType::Everyone,
    //         grantee_id: None,
    //         role: Role::Viewer,
    //         can_reshare: None,
    //         expires_at: None,
    //     },
    // ).await;
    // assert!(matches!(result, Err(Error::BadRequest(_))));
    todo!("implement with live pool")
}

// ─── Scenario 11 — can_reshare propagation ───────────────────────────────────

#[tokio::test]
#[ignore = "requires PostgreSQL with sharing schema"]
async fn scenario_11_can_reshare_allows_non_manager_to_grant() {
    // Setup:
    //   - Grant henry Role::Editor with can_reshare = true.
    //   - Henry tries to grant irene Role::Viewer on the same resource.
    //
    // Exercise:
    //   engine.grant(&henry_ctx, resource, None, CreateGrant { role: Viewer, grantee: irene, .. })
    //
    // Expected:
    //   Returns Ok(grant) — henry's can_reshare flag allows the re-grant.
    //
    // Counter-test (can_reshare = false):
    //   engine.grant(&henry_ctx_no_reshare, ...) → Err(Forbidden)

    let _henry_id = Uuid::new_v4();
    let _irene_id = Uuid::new_v4();
    let _tenant_id = Uuid::new_v4();
    let _henry_ctx = make_ctx(_henry_id, _tenant_id, vec![], vec![], 0);

    // INSERT INTO sharing.grants ... role = 'editor', grantee = henry, can_reshare = true
    //
    // let grant = engine.grant(&henry_ctx, resource, None, CreateGrant {
    //     grantee_type: GranteeType::User,
    //     grantee_id: Some(irene_id),
    //     role: Role::Viewer,
    //     can_reshare: None,
    //     expires_at: None,
    // }).await.unwrap();
    // assert_eq!(grant.role, "viewer");
    todo!("implement with live pool")
}

// ─── Scenario 12 — Template application ──────────────────────────────────────

#[tokio::test]
#[ignore = "requires PostgreSQL with sharing schema"]
async fn scenario_12_template_applies_multiple_grants() {
    // Setup:
    //   - Create a sharing template with two grant descriptors:
    //     1. {grantee_type: "everyone", role: "viewer"}
    //     2. {grantee_type: "user", grantee_id: <manager_id>, role: "manager"}
    //   - Create a calendar resource.
    //   - Apply the template as an admin.
    //
    // Exercise:
    //   engine.apply_template(&admin_ctx, ResourceRef::calendar(cal_id), None, template_id)
    //
    // Expected:
    //   Returns Ok(2) — two grants were created.
    //   Subsequent listing of grants on the calendar shows both rows.

    let _admin_id = Uuid::new_v4();
    let _tenant_id = Uuid::new_v4();
    let _admin_ctx = make_ctx(_admin_id, _tenant_id, vec![], vec![], 2);

    // INSERT INTO sharing.templates (grants = '[...]')
    //
    // let count = engine.apply_template(&admin_ctx, ResourceRef::calendar(cal_id), None, template_id).await.unwrap();
    // assert_eq!(count, 2);
    // let grants = engine.list_grants(&admin_ctx, ResourceRef::calendar(cal_id)).await.unwrap();
    // assert_eq!(grants.len(), 2);
    todo!("implement with live pool")
}

// ─── Scenario 13 — Expired grant is not effective ────────────────────────────

#[tokio::test]
#[ignore = "requires PostgreSQL with sharing schema"]
async fn scenario_13_expired_grant_is_not_applied() {
    // Setup:
    //   - Grant jack Role::Editor with expires_at = NOW() - 1 hour.
    //
    // Exercise:
    //   engine.effective_role(&jack_ctx, ResourceRef::document(doc_id), None)
    //
    // Expected:
    //   Returns Ok(None) — expired grant is ignored by the repository query
    //   (the SQL WHERE clause filters `expires_at IS NULL OR expires_at > NOW()`).

    let _jack_id = Uuid::new_v4();
    let _tenant_id = Uuid::new_v4();
    let _jack_ctx = make_ctx(_jack_id, _tenant_id, vec![], vec![], 0);

    // INSERT INTO sharing.grants ... role = 'editor', expires_at = NOW() - interval '1 hour'
    //
    // let result = engine.effective_role(&jack_ctx, ResourceRef::document(doc_id), None).await.unwrap();
    // assert!(result.is_none(), "expired grant must not grant access");
    todo!("implement with live pool")
}

// ─── Scenario 14 — Capability lookup ─────────────────────────────────────────

#[tokio::test]
#[ignore = "requires PostgreSQL with sharing schema"]
async fn scenario_14_capabilities_match_role() {
    // Setup:
    //   - Seed `sharing.capabilities` with (resource_type="file", role="viewer", actions=["read","list"]).
    //   - Grant kate Role::Viewer on a file.
    //
    // Exercise:
    //   engine.effective_role(&kate_ctx, ResourceRef::file(file_id), None)
    //
    // Expected:
    //   Returns Ok(Some(ep)) where:
    //     - ep.role == Role::Viewer
    //     - ep.capabilities == ["read", "list"]
    //
    // Counter-check:
    //   engine.check(&kate_ctx, ResourceRef::file(file_id), Action::write(), None)
    //   → Err(Forbidden) because "write" is not in Viewer's capabilities.

    let _kate_id = Uuid::new_v4();
    let _tenant_id = Uuid::new_v4();
    let _kate_ctx = make_ctx(_kate_id, _tenant_id, vec![], vec![], 0);

    // INSERT INTO sharing.capabilities (resource_type, role, actions) VALUES ('file', 'viewer', ARRAY['read','list'])
    // INSERT INTO sharing.grants ... role = 'viewer', grantee = kate
    //
    // let ep = engine.effective_role(&kate_ctx, ResourceRef::file(file_id), None).await.unwrap().unwrap();
    // assert_eq!(ep.role, Role::Viewer);
    // assert!(ep.capabilities.contains(&"read".to_string()));
    // assert!(!ep.capabilities.contains(&"write".to_string()));
    //
    // let write_check = engine.check(&kate_ctx, ResourceRef::file(file_id), Action::write(), None).await;
    // assert!(matches!(write_check, Err(Error::Forbidden(_))));
    todo!("implement with live pool")
}

// ─── Helper (placeholder) ─────────────────────────────────────────────────────

/// Returns a database pool for integration tests.
///
/// Reads `DATABASE_URL` from the environment. Panics if the variable is not set
/// or the connection cannot be established.
async fn setup_pool() -> sqlx::PgPool {
    let url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set for integration tests");
    sqlx::PgPool::connect(&url).await.expect("failed to connect to PostgreSQL")
}
