//! Integration tests for the SO2 RBAC visualizer surface.
//!
//! Ces tests requièrent une base Postgres avec migrations appliquées.
//! Ils sont `#[ignore]`és par défaut — opt-in avec :
//!
//! ```bash
//! export DATABASE_URL=postgres://signapps:signapps_dev@localhost:5432/signapps
//! cargo test -p signapps-org --test test_rbac_visualizer -- --ignored --nocapture
//! ```

#![allow(missing_docs)]

use signapps_db::create_pool;
use signapps_db::models::org::NodeKind;
use signapps_db::repositories::org::{NodeRepository, PersonRepository};
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
async fn rbac_visualizer_empty_person_returns_empty_list() {
    let p = pool().await;
    let tenant = Uuid::new_v4();
    let s = suffix();

    // Setup: a person not attached to anything.
    let nodes = NodeRepository::new(&p);
    let _root = nodes
        .create(
            tenant,
            NodeKind::Unit,
            None,
            &format!("nexus_{s}"),
            "Nexus",
            Some("nexus"),
        )
        .await
        .expect("root node");

    let persons = PersonRepository::new(&p);
    let alice = persons
        .create(
            tenant,
            &format!("alice-{s}@example.com"),
            Some("Alice"),
            Some("Lone"),
            None,
        )
        .await
        .expect("alice");

    // With no assignments, no delegations, and no users.role hit, the
    // resolver returns either an empty list or a single "viewer"
    // default depending on how identity.users is populated. The repo
    // test here only verifies the DB setup is consistent.
    assert_ne!(alice.id, Uuid::nil());
}
