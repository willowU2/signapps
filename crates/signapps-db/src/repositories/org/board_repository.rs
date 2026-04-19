//! CRUD for `org_boards` and `org_board_members`.

use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{Board, BoardMember};

/// Repository for the canonical `org_boards` + `org_board_members`
/// tables.
pub struct BoardRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> BoardRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Get-or-create the board attached to a node (UNIQUE node_id).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error if the upsert fails.
    pub async fn upsert_board(&self, node_id: Uuid) -> Result<Board> {
        let row = sqlx::query_as::<_, Board>(
            "INSERT INTO org_boards (node_id)
             VALUES ($1)
             ON CONFLICT (node_id) DO UPDATE SET node_id = EXCLUDED.node_id
             RETURNING *",
        )
        .bind(node_id)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Insert a member into a board.
    pub async fn add_member(
        &self,
        board_id: Uuid,
        person_id: Uuid,
        role: &str,
        is_decision_maker: bool,
        sort_order: i32,
    ) -> Result<BoardMember> {
        let row = sqlx::query_as::<_, BoardMember>(
            "INSERT INTO org_board_members
                (board_id, person_id, role, is_decision_maker, sort_order)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *",
        )
        .bind(board_id)
        .bind(person_id)
        .bind(role)
        .bind(is_decision_maker)
        .bind(sort_order)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Remove a member by primary key.
    pub async fn remove_member(&self, member_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM org_board_members WHERE id = $1")
            .bind(member_id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Fetch the board for a node, plus its members ordered by
    /// `sort_order`. Returns `Ok(None)` when no board exists.
    pub async fn get_by_node(&self, node_id: Uuid) -> Result<Option<(Board, Vec<BoardMember>)>> {
        let board = sqlx::query_as::<_, Board>("SELECT * FROM org_boards WHERE node_id = $1")
            .bind(node_id)
            .fetch_optional(self.pool)
            .await?;
        let Some(board) = board else { return Ok(None) };
        let members = sqlx::query_as::<_, BoardMember>(
            "SELECT * FROM org_board_members
             WHERE board_id = $1
             ORDER BY sort_order, id",
        )
        .bind(board.id)
        .fetch_all(self.pool)
        .await?;
        Ok(Some((board, members)))
    }

    /// Fetch the unique decision-maker for a node's board, if any.
    pub async fn decision_maker_for_node(&self, node_id: Uuid) -> Result<Option<BoardMember>> {
        let row = sqlx::query_as::<_, BoardMember>(
            "SELECT m.*
               FROM org_board_members m
               JOIN org_boards b ON b.id = m.board_id
              WHERE b.node_id = $1 AND m.is_decision_maker = true
              LIMIT 1",
        )
        .bind(node_id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }
}
