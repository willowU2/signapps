//! Keep notes endpoints — Google Keep-style note management.
//!
//! Notes support titles, rich content, 12 color options, checklists, labels,
//! reminders, pinning, archiving, and soft-delete with restore.
//!
//! # Endpoints
//!
//! - `GET    /api/v1/keep/notes`              — list notes (filter: archived, label, search)
//! - `POST   /api/v1/keep/notes`              — create a note
//! - `PUT    /api/v1/keep/notes/:id`          — update a note
//! - `DELETE /api/v1/keep/notes/:id`          — soft-delete (set deleted_at)
//! - `POST   /api/v1/keep/notes/:id/restore`  — restore from trash
//! - `GET    /api/v1/keep/labels`             — list user's labels
//! - `POST   /api/v1/keep/labels`             — create a label
//! - `DELETE /api/v1/keep/labels/:id`         — delete a label

use crate::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

// ── Types ────────────────────────────────────────────────────────────────────

/// A single checklist item within a note.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct ChecklistItem {
    /// Unique item identifier.
    pub id: String,
    /// Item text.
    pub text: String,
    /// Whether the item is checked off.
    pub checked: bool,
    /// Display order.
    #[serde(default)]
    pub order: i32,
}

/// A Keep note returned to the client.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct NoteResponse {
    /// Unique note identifier.
    pub id: Uuid,
    /// Owner user identifier.
    pub owner_id: Uuid,
    /// Note title.
    pub title: String,
    /// Note content (plain text or markdown).
    pub content: String,
    /// Color theme identifier (one of 12 options).
    pub color: String,
    /// Whether the note is pinned to the top.
    pub pinned: bool,
    /// Whether the note is archived.
    pub archived: bool,
    /// Whether the note is in checklist mode.
    pub is_checklist: bool,
    /// Checklist items (empty if not a checklist note).
    pub checklist_items: Vec<ChecklistItem>,
    /// Labels attached to this note.
    pub labels: Vec<String>,
    /// Optional reminder timestamp.
    pub reminder_at: Option<DateTime<Utc>>,
    /// Soft-delete timestamp (non-null means trashed).
    pub deleted_at: Option<DateTime<Utc>>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request body for creating a note.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateNoteRequest {
    /// Note title.
    #[serde(default)]
    pub title: String,
    /// Note content.
    #[serde(default)]
    pub content: String,
    /// Color theme identifier.
    #[serde(default = "default_color")]
    pub color: String,
    /// Pin to top.
    #[serde(default)]
    pub pinned: bool,
    /// Checklist mode.
    #[serde(default)]
    pub is_checklist: bool,
    /// Initial checklist items.
    #[serde(default)]
    pub checklist_items: Vec<ChecklistItem>,
    /// Initial labels.
    #[serde(default)]
    pub labels: Vec<String>,
    /// Optional reminder.
    pub reminder_at: Option<DateTime<Utc>>,
}

/// Request body for updating a note.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateNoteRequest {
    /// Updated title.
    pub title: Option<String>,
    /// Updated content.
    pub content: Option<String>,
    /// Updated color.
    pub color: Option<String>,
    /// Updated pinned status.
    pub pinned: Option<bool>,
    /// Updated archived status.
    pub archived: Option<bool>,
    /// Updated checklist mode.
    pub is_checklist: Option<bool>,
    /// Updated checklist items.
    pub checklist_items: Option<Vec<ChecklistItem>>,
    /// Updated labels.
    pub labels: Option<Vec<String>>,
    /// Updated reminder.
    pub reminder_at: Option<Option<DateTime<Utc>>>,
}

/// Query parameters for listing notes.
#[derive(Debug, Deserialize)]
pub struct ListNotesQuery {
    /// Filter: if true show archived, if false show active, if absent show active.
    pub archived: Option<bool>,
    /// Filter: show trashed notes (deleted_at IS NOT NULL).
    pub trashed: Option<bool>,
    /// Filter by label name.
    pub label: Option<String>,
    /// Full-text search in title and content.
    pub search: Option<String>,
}

/// A label belonging to a user.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct LabelResponse {
    /// Unique label identifier.
    pub id: Uuid,
    /// Owner user identifier.
    pub owner_id: Uuid,
    /// Label name.
    pub name: String,
}

/// Request body for creating a label.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateLabelRequest {
    /// Label name.
    pub name: String,
}

fn default_color() -> String {
    "default".to_string()
}

// ── Internal row types ───────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct NoteRow {
    id: Uuid,
    owner_id: Uuid,
    title: String,
    content: String,
    color: String,
    pinned: bool,
    archived: bool,
    is_checklist: bool,
    checklist_items: Value,
    labels: Vec<String>,
    reminder_at: Option<DateTime<Utc>>,
    deleted_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<NoteRow> for NoteResponse {
    fn from(r: NoteRow) -> Self {
        let checklist_items: Vec<ChecklistItem> =
            serde_json::from_value(r.checklist_items).unwrap_or_default();
        NoteResponse {
            id: r.id,
            owner_id: r.owner_id,
            title: r.title,
            content: r.content,
            color: r.color,
            pinned: r.pinned,
            archived: r.archived,
            is_checklist: r.is_checklist,
            checklist_items,
            labels: r.labels,
            reminder_at: r.reminder_at,
            deleted_at: r.deleted_at,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[derive(sqlx::FromRow)]
struct LabelRow {
    id: Uuid,
    owner_id: Uuid,
    name: String,
}

// ── Note handlers ────────────────────────────────────────────────────────────

/// `GET /api/v1/keep/notes` — list notes for the authenticated user.
///
/// By default returns non-archived, non-trashed notes ordered by pinned status
/// then recency. Use query parameters to filter archived, trashed, by label,
/// or search in title/content.
///
/// # Errors
///
/// Returns `Error::Internal` if the database query fails.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/keep/notes",
    tag = "keep",
    security(("bearerAuth" = [])),
    params(
        ("archived" = Option<bool>, Query, description = "Show archived notes"),
        ("trashed" = Option<bool>, Query, description = "Show trashed notes"),
        ("label" = Option<String>, Query, description = "Filter by label"),
        ("search" = Option<String>, Query, description = "Search in title/content"),
    ),
    responses(
        (status = 200, description = "List of notes", body = Vec<NoteResponse>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn list_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListNotesQuery>,
) -> Result<Json<Vec<NoteResponse>>> {
    let trashed = q.trashed.unwrap_or(false);
    let archived = q.archived.unwrap_or(false);

    // Build dynamic conditions
    let mut conditions = vec!["owner_id = $1".to_string()];
    let mut param_idx = 2u32;

    if trashed {
        conditions.push("deleted_at IS NOT NULL".to_string());
    } else {
        conditions.push("deleted_at IS NULL".to_string());
        if archived {
            conditions.push("archived = true".to_string());
        } else {
            conditions.push("archived = false".to_string());
        }
    }

    if let Some(ref label) = q.label {
        conditions.push(format!("${param_idx} = ANY(labels)"));
        let _ = label; // used below in bind
        param_idx += 1;
    }

    if q.search.is_some() {
        conditions.push(format!(
            "(title ILIKE '%' || ${param_idx} || '%' OR content ILIKE '%' || ${param_idx} || '%')"
        ));
        param_idx += 1;
    }

    let _ = param_idx; // suppress unused warning

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        "SELECT id, owner_id, title, content, color, pinned, archived, is_checklist, \
         checklist_items, labels, reminder_at, deleted_at, created_at, updated_at \
         FROM keep.notes WHERE {where_clause} \
         ORDER BY pinned DESC, updated_at DESC \
         LIMIT 500"
    );

    let mut query = sqlx::query_as::<_, NoteRow>(&sql).bind(claims.sub);

    if let Some(ref label) = q.label {
        query = query.bind(label);
    }
    if let Some(ref search) = q.search {
        query = query.bind(search);
    }

    let rows = query
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| Error::Internal(format!("list keep notes: {e}")))?;

    let notes: Vec<NoteResponse> = rows.into_iter().map(NoteResponse::from).collect();
    Ok(Json(notes))
}

/// `POST /api/v1/keep/notes` — create a new note.
///
/// # Errors
///
/// Returns `Error::Internal` if the database insert fails.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/keep/notes",
    tag = "keep",
    security(("bearerAuth" = [])),
    request_body = CreateNoteRequest,
    responses(
        (status = 201, description = "Note created", body = NoteResponse),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn create_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateNoteRequest>,
) -> Result<(StatusCode, Json<NoteResponse>)> {
    let checklist_json = serde_json::to_value(&body.checklist_items)
        .map_err(|e| Error::Internal(format!("serialize checklist: {e}")))?;

    let row = sqlx::query_as::<_, NoteRow>(
        r#"INSERT INTO keep.notes
            (owner_id, title, content, color, pinned, is_checklist,
             checklist_items, labels, reminder_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, owner_id, title, content, color, pinned, archived,
                     is_checklist, checklist_items, labels, reminder_at,
                     deleted_at, created_at, updated_at"#,
    )
    .bind(claims.sub)
    .bind(&body.title)
    .bind(&body.content)
    .bind(&body.color)
    .bind(body.pinned)
    .bind(body.is_checklist)
    .bind(&checklist_json)
    .bind(&body.labels)
    .bind(body.reminder_at)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("create keep note: {e}")))?;

    tracing::info!(note_id = %row.id, "keep note created");
    Ok((StatusCode::CREATED, Json(NoteResponse::from(row))))
}

/// `PUT /api/v1/keep/notes/:id` — update a note.
///
/// Only supplied fields are updated (partial update). The caller must own
/// the note.
///
/// # Errors
///
/// Returns `Error::NotFound` if the note does not exist or is not owned by the user.
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    put,
    path = "/api/v1/keep/notes/{id}",
    tag = "keep",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Note UUID")),
    request_body = UpdateNoteRequest,
    responses(
        (status = 200, description = "Note updated", body = NoteResponse),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Note not found"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub, note_id = %id))]
pub async fn update_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateNoteRequest>,
) -> Result<Json<NoteResponse>> {
    // Fetch the existing note to verify ownership
    let existing = sqlx::query_as::<_, NoteRow>(
        r#"SELECT id, owner_id, title, content, color, pinned, archived,
                  is_checklist, checklist_items, labels, reminder_at,
                  deleted_at, created_at, updated_at
           FROM keep.notes WHERE id = $1 AND owner_id = $2"#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("fetch keep note: {e}")))?;

    let existing = match existing {
        Some(n) => n,
        None => return Err(Error::NotFound("Note not found".to_string())),
    };

    // Apply partial updates
    let title = body.title.unwrap_or(existing.title);
    let content = body.content.unwrap_or(existing.content);
    let color = body.color.unwrap_or(existing.color);
    let pinned = body.pinned.unwrap_or(existing.pinned);
    let archived = body.archived.unwrap_or(existing.archived);
    let is_checklist = body.is_checklist.unwrap_or(existing.is_checklist);
    let checklist_items = match body.checklist_items {
        Some(items) => serde_json::to_value(&items)
            .map_err(|e| Error::Internal(format!("serialize checklist: {e}")))?,
        None => existing.checklist_items,
    };
    let labels = body.labels.unwrap_or(existing.labels);
    let reminder_at = match body.reminder_at {
        Some(r) => r,
        None => existing.reminder_at,
    };

    let row = sqlx::query_as::<_, NoteRow>(
        r#"UPDATE keep.notes SET
            title = $3, content = $4, color = $5, pinned = $6,
            archived = $7, is_checklist = $8, checklist_items = $9,
            labels = $10, reminder_at = $11, updated_at = NOW()
           WHERE id = $1 AND owner_id = $2
           RETURNING id, owner_id, title, content, color, pinned, archived,
                     is_checklist, checklist_items, labels, reminder_at,
                     deleted_at, created_at, updated_at"#,
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&title)
    .bind(&content)
    .bind(&color)
    .bind(pinned)
    .bind(archived)
    .bind(is_checklist)
    .bind(&checklist_items)
    .bind(&labels)
    .bind(reminder_at)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("update keep note: {e}")))?;

    tracing::info!("keep note updated");
    Ok(Json(NoteResponse::from(row)))
}

/// `DELETE /api/v1/keep/notes/:id` — soft-delete a note (move to trash).
///
/// Sets `deleted_at` to the current timestamp. The note can be restored later.
///
/// # Errors
///
/// Returns `Error::NotFound` if the note does not exist or is not owned by the user.
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    delete,
    path = "/api/v1/keep/notes/{id}",
    tag = "keep",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Note UUID")),
    responses(
        (status = 204, description = "Note moved to trash"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Note not found"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub, note_id = %id))]
pub async fn delete_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let result = sqlx::query(
        r#"UPDATE keep.notes SET deleted_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL"#,
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("soft-delete keep note: {e}")))?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound("Note not found".to_string()));
    }

    tracing::info!("keep note soft-deleted");
    Ok(StatusCode::NO_CONTENT)
}

/// `POST /api/v1/keep/notes/:id/restore` — restore a note from trash.
///
/// Clears the `deleted_at` timestamp, making the note visible again.
///
/// # Errors
///
/// Returns `Error::NotFound` if the note does not exist or is not trashed.
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/keep/notes/{id}/restore",
    tag = "keep",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Note UUID")),
    responses(
        (status = 200, description = "Note restored", body = NoteResponse),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Note not found in trash"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub, note_id = %id))]
pub async fn restore_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<NoteResponse>> {
    let row = sqlx::query_as::<_, NoteRow>(
        r#"UPDATE keep.notes SET deleted_at = NULL, updated_at = NOW()
           WHERE id = $1 AND owner_id = $2 AND deleted_at IS NOT NULL
           RETURNING id, owner_id, title, content, color, pinned, archived,
                     is_checklist, checklist_items, labels, reminder_at,
                     deleted_at, created_at, updated_at"#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("restore keep note: {e}")))?;

    match row {
        Some(r) => {
            tracing::info!("keep note restored");
            Ok(Json(NoteResponse::from(r)))
        }
        None => Err(Error::NotFound("Note not found in trash".to_string())),
    }
}

// ── Label handlers ───────────────────────────────────────────────────────────

/// `GET /api/v1/keep/labels` — list labels for the authenticated user.
///
/// # Errors
///
/// Returns `Error::Internal` if the database query fails.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/keep/labels",
    tag = "keep",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of labels", body = Vec<LabelResponse>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn list_labels(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LabelResponse>>> {
    let rows = sqlx::query_as::<_, LabelRow>(
        "SELECT id, owner_id, name FROM keep.labels WHERE owner_id = $1 ORDER BY name",
    )
    .bind(claims.sub)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("list keep labels: {e}")))?;

    let labels: Vec<LabelResponse> = rows
        .into_iter()
        .map(|r| LabelResponse {
            id: r.id,
            owner_id: r.owner_id,
            name: r.name,
        })
        .collect();

    Ok(Json(labels))
}

/// `POST /api/v1/keep/labels` — create a new label.
///
/// Label names are unique per user (case-sensitive).
///
/// # Errors
///
/// Returns `Error::BadRequest` if a label with the same name already exists.
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/keep/labels",
    tag = "keep",
    security(("bearerAuth" = [])),
    request_body = CreateLabelRequest,
    responses(
        (status = 201, description = "Label created", body = LabelResponse),
        (status = 400, description = "Duplicate label name"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub, label_name = %body.name))]
pub async fn create_label(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateLabelRequest>,
) -> Result<(StatusCode, Json<LabelResponse>)> {
    let row = sqlx::query_as::<_, LabelRow>(
        r#"INSERT INTO keep.labels (owner_id, name)
           VALUES ($1, $2)
           RETURNING id, owner_id, name"#,
    )
    .bind(claims.sub)
    .bind(&body.name)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("duplicate key")
            || e.to_string().contains("unique constraint")
        {
            Error::BadRequest(format!("Label '{}' already exists", body.name))
        } else {
            Error::Internal(format!("create keep label: {e}"))
        }
    })?;

    tracing::info!(label_id = %row.id, "keep label created");
    Ok((
        StatusCode::CREATED,
        Json(LabelResponse {
            id: row.id,
            owner_id: row.owner_id,
            name: row.name,
        }),
    ))
}

/// `DELETE /api/v1/keep/labels/:id` — delete a label.
///
/// Removes the label record. Does **not** remove the label string from
/// existing notes (the frontend can handle stale label cleanup).
///
/// # Errors
///
/// Returns `Error::NotFound` if the label does not exist or is not owned by the user.
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    delete,
    path = "/api/v1/keep/labels/{id}",
    tag = "keep",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Label UUID")),
    responses(
        (status = 204, description = "Label deleted"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Label not found"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub, label_id = %id))]
pub async fn delete_label(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let result = sqlx::query(
        "DELETE FROM keep.labels WHERE id = $1 AND owner_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("delete keep label: {e}")))?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound("Label not found".to_string()));
    }

    tracing::info!("keep label deleted");
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }

    #[test]
    fn default_color_is_default() {
        assert_eq!(default_color(), "default");
    }

    #[test]
    fn note_row_to_response_empty_checklist() {
        let row = NoteRow {
            id: Uuid::new_v4(),
            owner_id: Uuid::new_v4(),
            title: "Test".to_string(),
            content: "Body".to_string(),
            color: "coral".to_string(),
            pinned: false,
            archived: false,
            is_checklist: false,
            checklist_items: serde_json::json!([]),
            labels: vec!["work".to_string()],
            reminder_at: None,
            deleted_at: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let resp = NoteResponse::from(row);
        assert_eq!(resp.color, "coral");
        assert!(resp.checklist_items.is_empty());
        assert_eq!(resp.labels, vec!["work"]);
    }

    #[test]
    fn note_row_to_response_with_checklist() {
        let items = serde_json::json!([
            {"id": "1", "text": "Buy milk", "checked": false, "order": 0},
            {"id": "2", "text": "Walk dog", "checked": true, "order": 1},
        ]);
        let row = NoteRow {
            id: Uuid::new_v4(),
            owner_id: Uuid::new_v4(),
            title: "".to_string(),
            content: "".to_string(),
            color: "default".to_string(),
            pinned: true,
            archived: false,
            is_checklist: true,
            checklist_items: items,
            labels: vec![],
            reminder_at: None,
            deleted_at: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let resp = NoteResponse::from(row);
        assert!(resp.is_checklist);
        assert_eq!(resp.checklist_items.len(), 2);
        assert_eq!(resp.checklist_items[0].text, "Buy milk");
        assert!(resp.checklist_items[1].checked);
    }

    #[test]
    fn create_note_request_defaults() {
        let json = r#"{"title":"Test"}"#;
        let req: CreateNoteRequest = serde_json::from_str(json).expect("parse");
        assert_eq!(req.color, "default");
        assert!(!req.pinned);
        assert!(!req.is_checklist);
        assert!(req.checklist_items.is_empty());
        assert!(req.labels.is_empty());
    }
}
