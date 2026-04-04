//! Repository for governance boards — CRUD and effective-board resolution.

use crate::models::org_boards::{
    CreateBoardMember, EffectiveBoard, OrgBoard, OrgBoardMember, UpdateBoardMember,
};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for org governance board operations.
pub struct BoardRepository;

impl BoardRepository {
    /// Retrieve the board attached to a specific node, if any.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn get_board_by_node(pool: &PgPool, node_id: Uuid) -> Result<Option<OrgBoard>> {
        let board = sqlx::query_as::<_, OrgBoard>(
            "SELECT * FROM workforce_org_boards WHERE node_id = $1",
        )
        .bind(node_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(board)
    }

    /// Create a new board for the given node.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the node already has a board (UNIQUE violation)
    /// or if the query fails.
    pub async fn create_board(pool: &PgPool, node_id: Uuid) -> Result<OrgBoard> {
        let board = sqlx::query_as::<_, OrgBoard>(
            r#"
            INSERT INTO workforce_org_boards (node_id)
            VALUES ($1)
            RETURNING *
            "#,
        )
        .bind(node_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(board)
    }

    /// Delete the board attached to a node.
    ///
    /// Board members are cascade-deleted by the database.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn delete_board(pool: &PgPool, node_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM workforce_org_boards WHERE node_id = $1")
            .bind(node_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// List all members of a board.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn list_board_members(
        pool: &PgPool,
        board_id: Uuid,
    ) -> Result<Vec<OrgBoardMember>> {
        let members = sqlx::query_as::<_, OrgBoardMember>(
            r#"
            SELECT * FROM workforce_org_board_members
            WHERE board_id = $1
            ORDER BY sort_order, role
            "#,
        )
        .bind(board_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(members)
    }

    /// Add a member to a board.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the person is already a member (UNIQUE violation)
    /// or if the query fails.
    pub async fn add_board_member(
        pool: &PgPool,
        board_id: Uuid,
        input: CreateBoardMember,
    ) -> Result<OrgBoardMember> {
        let member = sqlx::query_as::<_, OrgBoardMember>(
            r#"
            INSERT INTO workforce_org_board_members
                (board_id, person_id, role, is_decision_maker, sort_order, start_date, end_date)
            VALUES ($1, $2, $3, COALESCE($4, false), COALESCE($5, 0), $6, $7)
            RETURNING *
            "#,
        )
        .bind(board_id)
        .bind(input.person_id)
        .bind(&input.role)
        .bind(input.is_decision_maker)
        .bind(input.sort_order)
        .bind(input.start_date)
        .bind(input.end_date)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(member)
    }

    /// Update an existing board member.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the member does not exist or the query fails.
    pub async fn update_board_member(
        pool: &PgPool,
        member_id: Uuid,
        input: UpdateBoardMember,
    ) -> Result<OrgBoardMember> {
        let member = sqlx::query_as::<_, OrgBoardMember>(
            r#"
            UPDATE workforce_org_board_members SET
                role              = COALESCE($2, role),
                is_decision_maker = COALESCE($3, is_decision_maker),
                sort_order        = COALESCE($4, sort_order),
                end_date          = COALESCE($5, end_date)
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(member_id)
        .bind(&input.role)
        .bind(input.is_decision_maker)
        .bind(input.sort_order)
        .bind(input.end_date)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(member)
    }

    /// Remove a member from a board.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn remove_board_member(pool: &PgPool, member_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM workforce_org_board_members WHERE id = $1")
            .bind(member_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Resolve the effective board for a node by walking up the parent chain.
    ///
    /// If the node has its own board, returns it directly. Otherwise, walks up
    /// via `parent_id` until a board is found. Returns the board along with
    /// inheritance metadata.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if any query fails.
    /// Returns `Error::NotFound` if no board exists anywhere in the ancestor chain.
    pub async fn get_effective_board(pool: &PgPool, node_id: Uuid) -> Result<EffectiveBoard> {
        // Walk up the parent chain looking for a board.
        // Uses a recursive CTE to traverse the hierarchy.
        let row: Option<(Uuid, Uuid, String)> = sqlx::query_as(
            r#"
            WITH RECURSIVE ancestors AS (
                SELECT id, parent_id, name, 0 AS depth
                FROM workforce_org_nodes WHERE id = $1
                UNION ALL
                SELECT n.id, n.parent_id, n.name, a.depth + 1
                FROM workforce_org_nodes n
                INNER JOIN ancestors a ON a.parent_id = n.id
            )
            SELECT b.node_id, a.id AS ancestor_id, a.name AS ancestor_name
            FROM ancestors a
            INNER JOIN workforce_org_boards b ON b.node_id = a.id
            ORDER BY a.depth ASC
            LIMIT 1
            "#,
        )
        .bind(node_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        let (board_node_id, ancestor_id, ancestor_name) = row.ok_or_else(|| {
            Error::NotFound("No board found in ancestor chain".to_string())
        })?;

        let board = Self::get_board_by_node(pool, board_node_id)
            .await?
            .ok_or_else(|| Error::NotFound("Board disappeared".to_string()))?;

        let members = Self::list_board_members(pool, board.id).await?;

        let (inherited_from_node_id, inherited_from_node_name) = if ancestor_id != node_id {
            (Some(ancestor_id), Some(ancestor_name))
        } else {
            (None, None)
        };

        Ok(EffectiveBoard {
            board,
            members,
            inherited_from_node_id,
            inherited_from_node_name,
        })
    }
}
