//! Integration tests for SO2 repositories (raci + board decisions/votes).
//!
//! Each test is `#[ignore]`-gated because it requires a running
//! PostgreSQL with migrations applied. Run with:
//!
//! ```bash
//! cargo test -p signapps-db --test so2_repos -- --ignored --nocapture
//! ```

#![allow(missing_docs)]

use signapps_db::create_pool;
use signapps_db::models::org::{DecisionStatus, NodeKind, RaciRole, VoteKind};
use signapps_db::repositories::org::{
    BoardDecisionRepository, BoardRepository, NodeRepository, PersonRepository, RaciRepository,
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

// ─── RACI ────────────────────────────────────────────────────────────

#[tokio::test]
#[ignore = "requires postgres"]
async fn raci_create_list_delete() {
    let p = pool().await;
    let tenant = Uuid::new_v4();
    let suffix = unique_suffix();

    let nodes = NodeRepository::new(&p);
    let project = nodes
        .create(
            tenant,
            NodeKind::Unit,
            None,
            &format!("project_phx_{suffix}"),
            "Project Phoenix",
            Some("project_phx"),
        )
        .await
        .expect("create project node");

    let persons = PersonRepository::new(&p);
    let marie = persons
        .create(
            tenant,
            &format!("marie-{suffix}@example.com"),
            Some("Marie"),
            Some("Durand"),
            None,
        )
        .await
        .expect("marie");

    let repo = RaciRepository::new(&p);
    let row = repo
        .create(tenant, project.id, marie.id, RaciRole::Accountable)
        .await
        .expect("create accountable");
    assert_eq!(row.role, RaciRole::Accountable);

    let all = repo.list_by_project(project.id).await.expect("list");
    assert!(all.iter().any(|r| r.id == row.id));

    repo.delete(row.id).await.expect("delete");
    let after = repo.list_by_project(project.id).await.expect("list after");
    assert!(after.iter().all(|r| r.id != row.id));
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn raci_unique_accountable_constraint() {
    let p = pool().await;
    let tenant = Uuid::new_v4();
    let suffix = unique_suffix();

    let nodes = NodeRepository::new(&p);
    let project = nodes
        .create(
            tenant,
            NodeKind::Unit,
            None,
            &format!("project_a_{suffix}"),
            "Proj",
            Some("proj"),
        )
        .await
        .expect("node");

    let persons = PersonRepository::new(&p);
    let marie = persons
        .create(
            tenant,
            &format!("marie-{suffix}@example.com"),
            Some("Marie"),
            Some("D"),
            None,
        )
        .await
        .expect("marie");
    let jean = persons
        .create(
            tenant,
            &format!("jean-{suffix}@example.com"),
            Some("Jean"),
            Some("P"),
            None,
        )
        .await
        .expect("jean");

    let repo = RaciRepository::new(&p);
    repo.create(tenant, project.id, marie.id, RaciRole::Accountable)
        .await
        .expect("first A");
    // Second accountable must fail due to partial unique index.
    let second = repo
        .create(tenant, project.id, jean.id, RaciRole::Accountable)
        .await;
    assert!(second.is_err(), "expected unique violation on 2nd A");
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn raci_bulk_set_replaces_roles() {
    let p = pool().await;
    let tenant = Uuid::new_v4();
    let suffix = unique_suffix();

    let nodes = NodeRepository::new(&p);
    let project = nodes
        .create(
            tenant,
            NodeKind::Unit,
            None,
            &format!("project_b_{suffix}"),
            "Proj",
            Some("proj"),
        )
        .await
        .expect("node");

    let persons = PersonRepository::new(&p);
    let person = persons
        .create(
            tenant,
            &format!("sam-{suffix}@example.com"),
            Some("Sam"),
            Some("S"),
            None,
        )
        .await
        .expect("person");

    let repo = RaciRepository::new(&p);
    // First set: C + I
    let first = repo
        .bulk_set(
            tenant,
            project.id,
            person.id,
            &[RaciRole::Consulted, RaciRole::Informed],
        )
        .await
        .expect("bulk first");
    assert_eq!(first.len(), 2);

    // Replace with R only.
    let second = repo
        .bulk_set(tenant, project.id, person.id, &[RaciRole::Responsible])
        .await
        .expect("bulk second");
    assert_eq!(second.len(), 1);
    assert_eq!(second[0].role, RaciRole::Responsible);

    let all = repo.list_by_project(project.id).await.expect("list");
    let mine: Vec<_> = all.iter().filter(|r| r.person_id == person.id).collect();
    assert_eq!(mine.len(), 1);
}

// ─── Decisions ────────────────────────────────────────────────────────

#[tokio::test]
#[ignore = "requires postgres"]
async fn decision_create_list_update_status() {
    let p = pool().await;
    let tenant = Uuid::new_v4();
    let suffix = unique_suffix();

    // Setup: node + board.
    let nodes = NodeRepository::new(&p);
    let node = nodes
        .create(
            tenant,
            NodeKind::Unit,
            None,
            &format!("dec_{suffix}"),
            "Root",
            Some("root"),
        )
        .await
        .expect("node");
    let boards = BoardRepository::new(&p);
    let board = boards.upsert_board(node.id).await.expect("board");

    let repo = BoardDecisionRepository::new(&p);
    let decision = repo
        .create(
            tenant,
            board.id,
            "Hire 3 SRE",
            Some("Q2 2026 plan"),
            serde_json::json!({}),
        )
        .await
        .expect("create decision");
    assert_eq!(decision.status, DecisionStatus::Proposed);

    let all = repo.list_by_board(board.id, None).await.expect("list");
    assert!(all.iter().any(|d| d.id == decision.id));

    // Approve.
    let persons = PersonRepository::new(&p);
    let chair = persons
        .create(
            tenant,
            &format!("chair-{suffix}@example.com"),
            Some("Chair"),
            Some("C"),
            None,
        )
        .await
        .expect("chair");

    let approved = repo
        .update_status(decision.id, DecisionStatus::Approved, Some(chair.id))
        .await
        .expect("update")
        .expect("exists");
    assert_eq!(approved.status, DecisionStatus::Approved);
    assert!(approved.decided_at.is_some());
    assert_eq!(approved.decided_by_person_id, Some(chair.id));
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn vote_upsert_idempotent_per_person() {
    let p = pool().await;
    let tenant = Uuid::new_v4();
    let suffix = unique_suffix();

    let nodes = NodeRepository::new(&p);
    let node = nodes
        .create(
            tenant,
            NodeKind::Unit,
            None,
            &format!("vote_{suffix}"),
            "Root",
            Some("root"),
        )
        .await
        .expect("node");
    let boards = BoardRepository::new(&p);
    let board = boards.upsert_board(node.id).await.expect("board");

    let repo = BoardDecisionRepository::new(&p);
    let decision = repo
        .create(tenant, board.id, "Motion", None, serde_json::json!({}))
        .await
        .expect("decision");

    let persons = PersonRepository::new(&p);
    let voter = persons
        .create(
            tenant,
            &format!("voter-{suffix}@example.com"),
            Some("Voter"),
            Some("V"),
            None,
        )
        .await
        .expect("voter");

    // First vote: for.
    let v1 = repo
        .upsert_vote(tenant, decision.id, voter.id, VoteKind::For, Some("yes"))
        .await
        .expect("first vote");
    assert_eq!(v1.vote, VoteKind::For);

    // Change mind: against.
    let v2 = repo
        .upsert_vote(
            tenant,
            decision.id,
            voter.id,
            VoteKind::Against,
            Some("changed"),
        )
        .await
        .expect("upsert vote");
    assert_eq!(v2.vote, VoteKind::Against);
    assert_eq!(v2.id, v1.id, "upsert must keep same row id");

    let votes = repo.list_votes(decision.id).await.expect("list");
    assert_eq!(votes.len(), 1);
}
