//! Integration tests for the canonical org repositories.
//!
//! Each test is `#[ignore]`-gated because it requires a running
//! PostgreSQL with the `signapps` database, the LTREE extension and
//! migrations 400-409 applied. Run with:
//!
//! ```bash
//! just db-start
//! cargo test -p signapps-db --test org_crud -- --ignored --nocapture
//! ```

#![allow(missing_docs)]

use chrono::Utc;
use signapps_db::create_pool;
use signapps_db::models::org::{AdSyncMode, Axis, ConflictStrategy, NodeKind};
use signapps_db::repositories::org::{
    AccessGrantRepository, AdConfigRepository, AdSyncLogRepository, AssignmentRepository,
    BoardRepository, NodeRepository, PersonRepository, PolicyRepository,
    ProvisioningLogRepository,
};
use uuid::Uuid;

/// Build a sqlx pool against the `DATABASE_URL` env var with the same
/// fallback the rest of the codebase uses for local dev.
async fn pool() -> sqlx::PgPool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://signapps:signapps_dev@localhost:5432/signapps".into()
    });
    create_pool(&url).await.expect("pg pool").inner().clone()
}

/// Generate a unique slug fragment so concurrent test runs do not
/// collide on UNIQUE indexes.
fn unique_suffix() -> String {
    Uuid::new_v4().simple().to_string()
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn node_create_then_subtree() {
    let p = pool().await;
    let repo = NodeRepository::new(&p);
    let tenant = Uuid::new_v4();
    let suffix = unique_suffix();
    let root_path = format!("acme_{suffix}");
    let child_path = format!("{root_path}.rd");

    let root = repo
        .create(tenant, NodeKind::Root, None, &root_path, "Acme", Some("acme"))
        .await
        .expect("root");
    let child = repo
        .create(
            tenant,
            NodeKind::Unit,
            Some(root.id),
            &child_path,
            "R&D",
            Some("rd"),
        )
        .await
        .expect("child");

    let subtree = repo.subtree(&root_path).await.expect("subtree");
    assert!(subtree.iter().any(|n| n.id == root.id), "root in subtree");
    assert!(subtree.iter().any(|n| n.id == child.id), "child in subtree");

    let listed = repo.list_by_tenant(tenant).await.expect("list");
    assert_eq!(listed.len(), 2, "tenant lists exactly two nodes");
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn person_get_by_email() {
    let p = pool().await;
    let repo = PersonRepository::new(&p);
    let tenant = Uuid::new_v4();
    let email = format!("alice-{}@example.com", unique_suffix());

    let created = repo
        .create(tenant, &email, Some("Alice"), Some("Wonder"), None)
        .await
        .expect("create");
    let found = repo
        .get_by_email(tenant, &email)
        .await
        .expect("query");
    assert_eq!(found.map(|p| p.id), Some(created.id));
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn assignment_create_and_list() {
    let p = pool().await;
    let nodes = NodeRepository::new(&p);
    let persons = PersonRepository::new(&p);
    let assignments = AssignmentRepository::new(&p);

    let tenant = Uuid::new_v4();
    let suffix = unique_suffix();
    let node = nodes
        .create(
            tenant,
            NodeKind::Unit,
            None,
            &format!("unit_{suffix}"),
            "Unit",
            Some("unit"),
        )
        .await
        .expect("node");
    let email = format!("bob-{suffix}@example.com");
    let person = persons
        .create(tenant, &email, Some("Bob"), Some("Builder"), None)
        .await
        .expect("person");

    let _structure = assignments
        .create(tenant, person.id, node.id, Axis::Structure, Some("Lead"), true, None, None)
        .await
        .expect("structure");
    let _focus = assignments
        .create(tenant, person.id, node.id, Axis::Focus, Some("Migration"), false, None, None)
        .await
        .expect("focus");

    let all = assignments
        .list_by_person(person.id, None)
        .await
        .expect("all");
    assert_eq!(all.len(), 2, "two assignments listed");

    let only_focus = assignments
        .list_by_person(person.id, Some(Axis::Focus))
        .await
        .expect("focus only");
    assert_eq!(only_focus.len(), 1);
    assert_eq!(only_focus[0].axis, Axis::Focus);

    let by_node = assignments.list_by_node(node.id).await.expect("by node");
    assert_eq!(by_node.len(), 2, "both assignments referenced from node");
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn policy_bind_and_query_subtree() {
    let p = pool().await;
    let nodes = NodeRepository::new(&p);
    let policies = PolicyRepository::new(&p);

    let tenant = Uuid::new_v4();
    let suffix = unique_suffix();
    let root_path = format!("policy_{suffix}");
    let root = nodes
        .create(tenant, NodeKind::Root, None, &root_path, "Root", None)
        .await
        .expect("root");
    let child = nodes
        .create(
            tenant,
            NodeKind::Unit,
            Some(root.id),
            &format!("{root_path}.team"),
            "Team",
            Some("team"),
        )
        .await
        .expect("child");

    let permissions = serde_json::json!([{ "resource": "drive", "actions": ["read"] }]);
    let policy = policies
        .create(tenant, "drive-read", None, permissions)
        .await
        .expect("policy");
    let binding = policies
        .bind_to_node(policy.id, root.id, true)
        .await
        .expect("bind");

    let listed = policies
        .list_bindings_for_subtree(&format!("{root_path}.team"))
        .await
        .expect("subtree bindings");
    assert!(
        listed.iter().any(|b| b.id == binding.id),
        "inheriting binding visible from descendant"
    );
    let _ = child;

    policies.unbind(binding.id).await.expect("unbind");
    let after = policies
        .list_bindings_for_subtree(&format!("{root_path}.team"))
        .await
        .expect("after unbind");
    assert!(after.iter().all(|b| b.id != binding.id));
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn board_upsert_with_decision_maker() {
    let p = pool().await;
    let nodes = NodeRepository::new(&p);
    let persons = PersonRepository::new(&p);
    let boards = BoardRepository::new(&p);

    let tenant = Uuid::new_v4();
    let suffix = unique_suffix();
    let node = nodes
        .create(
            tenant,
            NodeKind::Unit,
            None,
            &format!("board_{suffix}"),
            "Board node",
            None,
        )
        .await
        .expect("node");
    let chair = persons
        .create(
            tenant,
            &format!("chair-{suffix}@example.com"),
            Some("Chair"),
            None,
            None,
        )
        .await
        .expect("chair");

    let board = boards.upsert_board(node.id).await.expect("upsert");
    let board_again = boards.upsert_board(node.id).await.expect("upsert idem");
    assert_eq!(board.id, board_again.id, "upsert is idempotent");

    let member = boards
        .add_member(board.id, chair.id, "chair", true, 0)
        .await
        .expect("add member");
    let (b, members) = boards
        .get_by_node(node.id)
        .await
        .expect("get board")
        .expect("present");
    assert_eq!(b.id, board.id);
    assert_eq!(members.len(), 1);

    let dm = boards
        .decision_maker_for_node(node.id)
        .await
        .expect("dm")
        .expect("present");
    assert_eq!(dm.id, member.id);
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn access_grant_create_and_verify() {
    let p = pool().await;
    let persons = PersonRepository::new(&p);
    let grants = AccessGrantRepository::new(&p);

    let tenant = Uuid::new_v4();
    let suffix = unique_suffix();
    let granter = persons
        .create(
            tenant,
            &format!("granter-{suffix}@example.com"),
            Some("Granter"),
            None,
            None,
        )
        .await
        .expect("granter");
    let token_hash = format!("sha256:{suffix}");
    let resource_id = Uuid::new_v4();

    let grant = grants
        .create(
            tenant,
            granter.id,
            None,
            "drive.file",
            resource_id,
            serde_json::json!({"actions":["read"]}),
            &token_hash,
            None,
        )
        .await
        .expect("create");

    let by_token = grants
        .get_by_token(&token_hash)
        .await
        .expect("by token")
        .expect("present");
    assert_eq!(by_token.id, grant.id);

    let listed = grants
        .list_for_resource("drive.file", resource_id)
        .await
        .expect("list");
    assert!(listed.iter().any(|g| g.id == grant.id));

    grants.bump_last_used(grant.id).await.expect("bump");
    grants.revoke(grant.id).await.expect("revoke");
    let after_revoke = grants
        .list_for_resource("drive.file", resource_id)
        .await
        .expect("post revoke list");
    assert!(after_revoke.iter().all(|g| g.id != grant.id));
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn ad_config_upsert() {
    let p = pool().await;
    let cfgs = AdConfigRepository::new(&p);
    let tenant = Uuid::new_v4();

    let inserted = cfgs
        .upsert(
            tenant,
            AdSyncMode::Pull,
            Some("ldap://dc.example.com"),
            Some("CN=svc,DC=example,DC=com"),
            Some(b"\x00\x01\x02".as_slice()),
            Some("DC=example,DC=com"),
            None,
            None,
            300,
            ConflictStrategy::OrgWins,
        )
        .await
        .expect("upsert");
    assert_eq!(inserted.mode, AdSyncMode::Pull);

    let updated = cfgs
        .upsert(
            tenant,
            AdSyncMode::Bidirectional,
            Some("ldaps://dc.example.com"),
            Some("CN=svc,DC=example,DC=com"),
            None,
            Some("DC=example,DC=com"),
            None,
            None,
            600,
            ConflictStrategy::AdWins,
        )
        .await
        .expect("upsert again");
    assert_eq!(updated.mode, AdSyncMode::Bidirectional);
    assert_eq!(updated.sync_interval_sec, 600);
    assert_eq!(updated.conflict_strategy, ConflictStrategy::AdWins);

    let fetched = cfgs.get(tenant).await.expect("get").expect("present");
    assert_eq!(fetched.mode, AdSyncMode::Bidirectional);
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn ad_sync_log_insert_and_provisioning_lifecycle() {
    let p = pool().await;
    let logs = AdSyncLogRepository::new(&p);
    let persons = PersonRepository::new(&p);
    let prov = ProvisioningLogRepository::new(&p);

    let tenant = Uuid::new_v4();
    let run_id = Uuid::new_v4();
    let dn_ok = format!("CN=Ok,OU=U,DC=ex-{}", unique_suffix());
    let dn_err = format!("CN=Err,OU=U,DC=ex-{}", unique_suffix());

    let _ok = logs
        .insert(
            tenant,
            run_id,
            &dn_ok,
            "pull",
            "ok",
            serde_json::json!({"after":{}}),
            None,
        )
        .await
        .expect("ok log");
    let _err = logs
        .insert(
            tenant,
            run_id,
            &dn_err,
            "pull",
            "error",
            serde_json::json!({}),
            Some("boom"),
        )
        .await
        .expect("err log");

    let by_run = logs.list_by_run(run_id).await.expect("by run");
    assert_eq!(by_run.len(), 2);
    let pending = logs
        .list_pending_retry(tenant)
        .await
        .expect("pending retry");
    assert!(pending.iter().any(|l| l.entry_dn == dn_err));

    // Provisioning lifecycle
    let suffix = unique_suffix();
    let person = persons
        .create(
            tenant,
            &format!("prov-{suffix}@example.com"),
            Some("Prov"),
            None,
            None,
        )
        .await
        .expect("person");
    let initial = prov
        .insert(
            tenant,
            person.id,
            "org.person.provisioning_requested",
            "mail",
            "pending",
            None,
        )
        .await
        .expect("insert prov");
    assert_eq!(initial.attempts, 1);
    assert_eq!(initial.status, "pending");

    let bumped = prov.bump_attempts(initial.id).await.expect("bump");
    assert_eq!(bumped.attempts, 2);

    let marked = prov
        .mark_status(initial.id, "ok", None)
        .await
        .expect("mark");
    assert_eq!(marked.status, "ok");
    assert!(marked.error.is_none());
    assert!(marked.updated_at >= Utc::now() - chrono::Duration::seconds(60));
}
