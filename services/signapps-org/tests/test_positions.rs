//! Integration tests for the SO1 positions API.
//!
//! These tests require a running Postgres with migrations applied.
//! They are `#[ignore]`d by default — opt in with:
//!
//! ```bash
//! export DATABASE_URL=postgres://signapps:signapps_dev@localhost:5432/signapps
//! cargo test -p signapps-org --test test_positions -- --ignored --nocapture
//! ```

#![allow(missing_docs)]

use signapps_db::create_pool;
use signapps_db::models::org::NodeKind;
use signapps_db::repositories::org::{NodeRepository, PositionRepository};
use uuid::Uuid;

async fn pool() -> sqlx::PgPool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://signapps:signapps_dev@localhost:5432/signapps".into()
    });
    create_pool(&url).await.expect("pg pool").inner().clone()
}

fn suffix() -> String {
    Uuid::new_v4().simple().to_string()
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn position_full_lifecycle_via_repository() {
    let p = pool().await;
    let tenant = Uuid::new_v4();
    let s = suffix();

    // Setup: node.
    let nodes = NodeRepository::new(&p);
    let node = nodes
        .create(
            tenant,
            NodeKind::Unit,
            None,
            &format!("test_{s}"),
            "Test Unit",
            Some("test"),
        )
        .await
        .expect("node");

    let repo = PositionRepository::new(&p);
    let pos = repo
        .create(
            tenant,
            node.id,
            "Senior Dev",
            2,
            serde_json::json!({"level": "senior"}),
        )
        .await
        .expect("create");

    // Read back
    let fetched = repo.get(pos.id).await.expect("get").expect("exists");
    assert_eq!(fetched.title, "Senior Dev");
    assert_eq!(fetched.head_count, 2);

    // Update
    let updated = repo
        .update(pos.id, Some("Staff Dev"), Some(3), None, None)
        .await
        .expect("update")
        .expect("exists");
    assert_eq!(updated.title, "Staff Dev");
    assert_eq!(updated.head_count, 3);

    // List by node
    let by_node = repo.list_by_node(node.id).await.expect("list");
    assert!(by_node.iter().any(|x| x.id == pos.id));

    // Occupancy (should be 0 filled / 3 hc).
    let (filled, hc) = repo.occupancy(pos.id).await.expect("occ");
    assert_eq!(filled, 0);
    assert_eq!(hc, 3);

    // Hard delete
    repo.delete(pos.id).await.expect("delete");
    assert!(repo.get(pos.id).await.expect("after del").is_none());
}
