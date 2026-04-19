//! Integration tests for SO1 repositories (positions, audit, delegations).
//!
//! Each test is `#[ignore]`-gated because it requires a running
//! PostgreSQL with migrations applied. Run with:
//!
//! ```bash
//! cargo test -p signapps-db --test so1_repos -- --ignored --nocapture
//! ```

#![allow(missing_docs)]

use chrono::{Duration, Utc};
use signapps_db::create_pool;
use signapps_db::models::org::{DelegationScope, NodeKind};
use signapps_db::repositories::org::{
    AuditRepository, DelegationRepository, NodeRepository, PersonRepository, PositionRepository,
};
use uuid::Uuid;

async fn pool() -> sqlx::PgPool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://signapps:signapps_dev@localhost:5432/signapps".into()
    });
    create_pool(&url).await.expect("pg pool").inner().clone()
}

fn unique_suffix() -> String {
    Uuid::new_v4().simple().to_string()
}

// ─── Positions ──────────────────────────────────────────────────────

#[tokio::test]
#[ignore = "requires postgres"]
async fn position_create_and_list() {
    let p = pool().await;
    let tenant = Uuid::new_v4();
    let suffix = unique_suffix();

    // Setup: node + person.
    let nodes = NodeRepository::new(&p);
    let node = nodes
        .create(
            tenant,
            NodeKind::Unit,
            None,
            &format!("acme_{suffix}"),
            "Acme",
            Some("acme"),
        )
        .await
        .expect("node");

    let repo = PositionRepository::new(&p);
    let pos = repo
        .create(tenant, node.id, "Senior Dev", 3, serde_json::json!({}))
        .await
        .expect("create position");
    assert_eq!(pos.title, "Senior Dev");
    assert_eq!(pos.head_count, 3);

    let listed = repo.list_by_node(node.id).await.expect("list");
    assert!(listed.iter().any(|x| x.id == pos.id));
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn position_incumbent_assign_and_revoke() {
    let p = pool().await;
    let tenant = Uuid::new_v4();
    let suffix = unique_suffix();

    let nodes = NodeRepository::new(&p);
    let node = nodes
        .create(
            tenant,
            NodeKind::Unit,
            None,
            &format!("acme2_{suffix}"),
            "Acme2",
            Some("acme2"),
        )
        .await
        .expect("node");

    let persons = PersonRepository::new(&p);
    let person = persons
        .create(
            tenant,
            &format!("alice-{suffix}@example.com"),
            Some("Alice"),
            Some("Admin"),
            None,
        )
        .await
        .expect("person");

    let repo = PositionRepository::new(&p);
    let pos = repo
        .create(tenant, node.id, "Dev Lead", 1, serde_json::json!({}))
        .await
        .expect("create position");

    let inc = repo
        .add_incumbent(tenant, pos.id, person.id, None)
        .await
        .expect("add incumbent");
    assert!(inc.active);

    let (filled, hc) = repo.occupancy(pos.id).await.expect("occupancy");
    assert_eq!(filled, 1);
    assert_eq!(hc, 1);

    let revoked = repo
        .revoke_incumbent(inc.id, None)
        .await
        .expect("revoke")
        .expect("row exists");
    assert!(!revoked.active);

    let (filled_after, _) = repo.occupancy(pos.id).await.expect("occupancy after");
    assert_eq!(filled_after, 0);
}

// ─── Delegations ────────────────────────────────────────────────────

#[tokio::test]
#[ignore = "requires postgres"]
async fn delegation_create_list_revoke_expire() {
    let p = pool().await;
    let tenant = Uuid::new_v4();
    let suffix = unique_suffix();

    let persons = PersonRepository::new(&p);
    let delegator = persons
        .create(
            tenant,
            &format!("boss-{suffix}@example.com"),
            Some("Boss"),
            Some("Mgr"),
            None,
        )
        .await
        .expect("delegator");
    let delegate = persons
        .create(
            tenant,
            &format!("alice-{suffix}@example.com"),
            Some("Alice"),
            Some("Eng"),
            None,
        )
        .await
        .expect("delegate");

    let repo = DelegationRepository::new(&p);
    let now = Utc::now();
    let d = repo
        .create(
            tenant,
            delegator.id,
            delegate.id,
            None,
            DelegationScope::Manager,
            now - Duration::hours(1),
            now + Duration::days(7),
            Some("Vacation"),
            None,
        )
        .await
        .expect("create delegation");
    assert!(d.active);

    let actives = repo
        .list_active_for_delegate(delegate.id)
        .await
        .expect("list");
    assert_eq!(actives.len(), 1);

    // Revoke
    let revoked = repo.revoke(d.id).await.expect("revoke").expect("exists");
    assert!(!revoked.active);

    // Create one already-expired to test expire_due.
    let _expired = repo
        .create(
            tenant,
            delegator.id,
            delegate.id,
            None,
            DelegationScope::Rbac,
            now - Duration::days(10),
            now - Duration::days(1),
            Some("Past"),
            None,
        )
        .await
        .expect("create expired");
    let ids = repo.expire_due(Utc::now()).await.expect("expire");
    assert!(!ids.is_empty(), "expire_due should have flipped at least one");
}

// ─── Audit ──────────────────────────────────────────────────────────

#[tokio::test]
#[ignore = "requires postgres"]
async fn audit_list_for_entity_after_update() {
    let p = pool().await;
    let tenant = Uuid::new_v4();
    let suffix = unique_suffix();

    let nodes = NodeRepository::new(&p);
    let node = nodes
        .create(
            tenant,
            NodeKind::Unit,
            None,
            &format!("audit_{suffix}"),
            "A",
            Some("a"),
        )
        .await
        .expect("node");

    // Trigger an UPDATE so we have 2 audit rows (1 insert + 1 update).
    nodes.archive(node.id).await.expect("archive");

    let repo = AuditRepository::new(&p);
    let entries = repo
        .list_for_entity("org_nodes", node.id, 10)
        .await
        .expect("list audit");
    // 1 insert + 1 update = 2 entries.
    assert!(entries.len() >= 2, "expected >= 2 audit entries, got {}", entries.len());
    assert!(entries.iter().any(|e| e.action == "insert"));
    assert!(entries.iter().any(|e| e.action == "update"));
}
