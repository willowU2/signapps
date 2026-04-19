//! CRUD for `org_board_decisions` + `org_board_votes`.

use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{BoardDecision, BoardVote, DecisionStatus, VoteKind};

/// Repository for `org_board_decisions` + `org_board_votes`.
pub struct BoardDecisionRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> BoardDecisionRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    // ---- decisions ------------------------------------------------------

    /// List every decision of a board (optionally filtered by status).
    pub async fn list_by_board(
        &self,
        board_id: Uuid,
        status_filter: Option<DecisionStatus>,
    ) -> Result<Vec<BoardDecision>> {
        let rows = if let Some(status) = status_filter {
            sqlx::query_as::<_, BoardDecision>(
                "SELECT * FROM org_board_decisions
                 WHERE board_id = $1 AND status = $2
                 ORDER BY created_at DESC",
            )
            .bind(board_id)
            .bind(status)
            .fetch_all(self.pool)
            .await?
        } else {
            sqlx::query_as::<_, BoardDecision>(
                "SELECT * FROM org_board_decisions
                 WHERE board_id = $1
                 ORDER BY created_at DESC",
            )
            .bind(board_id)
            .fetch_all(self.pool)
            .await?
        };
        Ok(rows)
    }

    /// Fetch one decision.
    pub async fn get(&self, id: Uuid) -> Result<Option<BoardDecision>> {
        let row = sqlx::query_as::<_, BoardDecision>(
            "SELECT * FROM org_board_decisions WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Insert a new decision (default status = `proposed`).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn create(
        &self,
        tenant_id: Uuid,
        board_id: Uuid,
        title: &str,
        description: Option<&str>,
        attributes: serde_json::Value,
    ) -> Result<BoardDecision> {
        let row = sqlx::query_as::<_, BoardDecision>(
            "INSERT INTO org_board_decisions
                (tenant_id, board_id, title, description, attributes)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(board_id)
        .bind(title)
        .bind(description)
        .bind(attributes)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Update the status of a decision (and stamp decided_at/by when
    /// closing to approved/rejected/deferred).
    pub async fn update_status(
        &self,
        id: Uuid,
        status: DecisionStatus,
        decided_by_person_id: Option<Uuid>,
    ) -> Result<Option<BoardDecision>> {
        let now = Utc::now();
        // Only stamp decided_at when moving out of `proposed`.
        let decided_at: Option<DateTime<Utc>> =
            if matches!(status, DecisionStatus::Proposed) {
                None
            } else {
                Some(now)
            };
        let row = sqlx::query_as::<_, BoardDecision>(
            "UPDATE org_board_decisions
                SET status = $2,
                    decided_at = $3,
                    decided_by_person_id = $4,
                    updated_at = now()
              WHERE id = $1
              RETURNING *",
        )
        .bind(id)
        .bind(status)
        .bind(decided_at)
        .bind(decided_by_person_id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Hard-delete one decision (cascade deletes votes).
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM org_board_decisions WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    // ---- votes ----------------------------------------------------------

    /// List every vote cast on a decision.
    pub async fn list_votes(&self, decision_id: Uuid) -> Result<Vec<BoardVote>> {
        let rows = sqlx::query_as::<_, BoardVote>(
            "SELECT * FROM org_board_votes
             WHERE decision_id = $1
             ORDER BY voted_at",
        )
        .bind(decision_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Upsert a vote (one per person per decision). When the same
    /// `(decision_id, person_id)` votes again the existing row is
    /// updated in-place.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn upsert_vote(
        &self,
        tenant_id: Uuid,
        decision_id: Uuid,
        person_id: Uuid,
        vote: VoteKind,
        rationale: Option<&str>,
    ) -> Result<BoardVote> {
        let row = sqlx::query_as::<_, BoardVote>(
            "INSERT INTO org_board_votes
                (tenant_id, decision_id, person_id, vote, rationale)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (decision_id, person_id) DO UPDATE
                SET vote = EXCLUDED.vote,
                    rationale = EXCLUDED.rationale,
                    voted_at = now()
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(decision_id)
        .bind(person_id)
        .bind(vote)
        .bind(rationale)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Hard-delete a single vote.
    pub async fn delete_vote(&self, vote_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM org_board_votes WHERE id = $1")
            .bind(vote_id)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}
