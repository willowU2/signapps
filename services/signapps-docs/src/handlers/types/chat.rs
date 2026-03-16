use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info};
use uuid::Uuid;
use yrs::{ReadTxn, Transact};

use crate::AppState;

#[derive(Serialize, Deserialize)]
pub struct CreateChannelRequest {
    pub name: String,
    #[serde(default)]
    pub topic: Option<String>,
    #[serde(default)]
    pub is_private: bool,
}

#[derive(Serialize, Deserialize)]
pub struct ChannelResponse {
    pub id: String,
    pub name: String,
    pub topic: Option<String>,
    pub is_private: bool,
    pub created_at: String,
    pub created_by: String, // uuid
}

/// Create a new chat channel
pub async fn create_channel(
    State(state): State<AppState>,
    Json(payload): Json<CreateChannelRequest>,
) -> Result<(StatusCode, Json<ChannelResponse>), (StatusCode, String)> {
    let doc_id = Uuid::new_v4();
    let user_id: Option<Uuid> = None; // TODO: Get from auth middleware when available

    // Initialize empty Yjs document state
    let doc = yrs::Doc::new();
    let doc_binary = doc
        .transact()
        .encode_state_as_update_v1(&yrs::StateVector::default());

    // 1. Insert into documents table
    sqlx::query(
        "INSERT INTO documents (id, name, doc_type, doc_binary, created_by) VALUES ($1, $2, 'chat', $3, $4)",
    )
    .bind(doc_id)
    .bind(&payload.name)
    .bind(doc_binary)
    .bind(user_id)
    .execute(state.pool.inner())
    .await
    .map_err(|e| {
        error!("Failed to create channel document: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create channel: {}", e),
        )
    })?;

    // 2. Insert metadata (topic, is_private) into document_metadata
    let metadata = serde_json::json!({
        "topic": payload.topic,
        "is_private": payload.is_private
    });

    sqlx::query("INSERT INTO document_metadata (doc_id, metadata) VALUES ($1, $2)")
        .bind(doc_id)
        .bind(metadata)
        .execute(state.pool.inner())
        .await
        .map_err(|e| {
            error!("Failed to create channel metadata: {}", e);
            // Note: we might want to rollback the document creation here in a real transaction,
            // but for now we'll just log and return error.
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to create channel metadata".to_string(),
            )
        })?;

    info!(
        doc_id = %doc_id,
        name = %payload.name,
        "Created chat channel"
    );

    Ok((
        StatusCode::CREATED,
        Json(ChannelResponse {
            id: doc_id.to_string(),
            name: payload.name,
            topic: payload.topic,
            is_private: payload.is_private,
            created_at: chrono::Utc::now().to_rfc3339(),
            created_by: user_id.map(|id| id.to_string()).unwrap_or_default(),
        }),
    ))
}

#[derive(sqlx::FromRow, Serialize, Deserialize)]
pub struct ChannelRow {
    pub id: Uuid,
    pub name: String,
    pub topic: Option<String>,
    pub is_private: Option<bool>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub created_by: Option<Uuid>,
}

/// List all chat channels
pub async fn get_channels(
    State(state): State<AppState>,
) -> Result<Json<Vec<ChannelResponse>>, (StatusCode, String)> {
    let channels = sqlx::query_as::<_, ChannelRow>(
        r#"
        SELECT 
            d.id, 
            d.name, 
            (m.metadata->>'topic') as topic,
            COALESCE((m.metadata->>'is_private')::boolean, false) as is_private,
            d.created_at, 
            d.created_by 
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.doc_id
        WHERE d.doc_type = 'chat'
        ORDER BY d.created_at DESC
        "#,
    )
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| {
        error!("Failed to fetch channels: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch channels".to_string(),
        )
    })?;

    let response = channels
        .into_iter()
        .map(|row| ChannelResponse {
            id: row.id.to_string(),
            name: row.name,
            topic: row.topic,
            is_private: row.is_private.unwrap_or(false),
            created_at: row.created_at.to_rfc3339(),
            created_by: row.created_by.map(|id| id.to_string()).unwrap_or_default(),
        })
        .collect();

    Ok(Json(response))
}

/// Get a specific channel by ID
pub async fn get_channel(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
) -> Result<Json<ChannelResponse>, (StatusCode, String)> {
    let channel = sqlx::query_as::<_, ChannelRow>(
        r#"
        SELECT
            d.id,
            d.name,
            (m.metadata->>'topic') as topic,
            COALESCE((m.metadata->>'is_private')::boolean, false) as is_private,
            d.created_at,
            d.created_by
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.doc_id
        WHERE d.id = $1 AND d.doc_type = 'chat'
        "#,
    )
    .bind(channel_id)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        error!("Failed to fetch channel: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch channel".to_string(),
        )
    })?
    .ok_or((StatusCode::NOT_FOUND, "Channel not found".to_string()))?;

    Ok(Json(ChannelResponse {
        id: channel.id.to_string(),
        name: channel.name,
        topic: channel.topic,
        is_private: channel.is_private.unwrap_or(false),
        created_at: channel.created_at.to_rfc3339(),
        created_by: channel
            .created_by
            .map(|id| id.to_string())
            .unwrap_or_default(),
    }))
}

#[derive(Serialize, Deserialize)]
pub struct UpdateChannelRequest {
    pub name: Option<String>,
    pub topic: Option<String>,
    pub is_private: Option<bool>,
}

/// Update a channel
pub async fn update_channel(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<UpdateChannelRequest>,
) -> Result<Json<ChannelResponse>, (StatusCode, String)> {
    // Check channel exists
    let existing = sqlx::query_as::<_, ChannelRow>(
        r#"
        SELECT
            d.id,
            d.name,
            (m.metadata->>'topic') as topic,
            COALESCE((m.metadata->>'is_private')::boolean, false) as is_private,
            d.created_at,
            d.created_by
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.doc_id
        WHERE d.id = $1 AND d.doc_type = 'chat'
        "#,
    )
    .bind(channel_id)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        error!("Failed to fetch channel for update: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch channel".to_string(),
        )
    })?
    .ok_or((StatusCode::NOT_FOUND, "Channel not found".to_string()))?;

    // Update document name if provided
    if let Some(ref name) = payload.name {
        sqlx::query("UPDATE documents SET name = $1, updated_at = NOW() WHERE id = $2")
            .bind(name)
            .bind(channel_id)
            .execute(state.pool.inner())
            .await
            .map_err(|e| {
                error!("Failed to update channel name: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to update channel".to_string(),
                )
            })?;
    }

    // Update metadata (topic, is_private)
    let new_topic = payload.topic.or(existing.topic);
    let new_is_private = payload
        .is_private
        .unwrap_or(existing.is_private.unwrap_or(false));
    let metadata = serde_json::json!({
        "topic": new_topic,
        "is_private": new_is_private
    });

    sqlx::query(
        "INSERT INTO document_metadata (doc_id, metadata) VALUES ($1, $2)
         ON CONFLICT (doc_id) DO UPDATE SET metadata = $2",
    )
    .bind(channel_id)
    .bind(&metadata)
    .execute(state.pool.inner())
    .await
    .map_err(|e| {
        error!("Failed to update channel metadata: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to update channel metadata".to_string(),
        )
    })?;

    info!(channel_id = %channel_id, "Updated chat channel");

    Ok(Json(ChannelResponse {
        id: channel_id.to_string(),
        name: payload.name.unwrap_or(existing.name),
        topic: new_topic,
        is_private: new_is_private,
        created_at: existing.created_at.to_rfc3339(),
        created_by: existing
            .created_by
            .map(|id| id.to_string())
            .unwrap_or_default(),
    }))
}

/// Delete a channel
pub async fn delete_channel(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Check exists
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM documents WHERE id = $1 AND doc_type = 'chat')",
    )
    .bind(channel_id)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| {
        error!("Failed to check channel existence: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to check channel".to_string(),
        )
    })?;

    if !exists {
        return Err((StatusCode::NOT_FOUND, "Channel not found".to_string()));
    }

    // Delete metadata first (foreign key)
    sqlx::query("DELETE FROM document_metadata WHERE doc_id = $1")
        .bind(channel_id)
        .execute(state.pool.inner())
        .await
        .ok(); // Ignore if no metadata

    // Delete document updates
    sqlx::query("DELETE FROM document_updates WHERE doc_id = $1")
        .bind(channel_id)
        .execute(state.pool.inner())
        .await
        .ok();

    // Delete document presence
    sqlx::query("DELETE FROM document_presence WHERE doc_id = $1")
        .bind(channel_id)
        .execute(state.pool.inner())
        .await
        .ok();

    // Delete channel members
    sqlx::query("DELETE FROM channel_members WHERE channel_id = $1")
        .bind(channel_id)
        .execute(state.pool.inner())
        .await
        .ok();

    // Delete the document
    sqlx::query("DELETE FROM documents WHERE id = $1")
        .bind(channel_id)
        .execute(state.pool.inner())
        .await
        .map_err(|e| {
            error!("Failed to delete channel: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to delete channel".to_string(),
            )
        })?;

    info!(channel_id = %channel_id, "Deleted chat channel");

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// Channel Members
// ============================================================================

#[derive(Serialize, Deserialize)]
pub struct ChannelMember {
    pub user_id: String,
    pub username: String,
    pub role: String, // "owner", "admin", "member"
    pub joined_at: String,
}

#[derive(Serialize, Deserialize)]
pub struct AddMemberRequest {
    pub user_id: Uuid,
    #[serde(default = "default_role")]
    pub role: String,
}

fn default_role() -> String {
    "member".to_string()
}

/// Get channel members
pub async fn get_channel_members(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
) -> Result<Json<Vec<ChannelMember>>, (StatusCode, String)> {
    let members = sqlx::query_as::<_, (Uuid, String, String, chrono::DateTime<chrono::Utc>)>(
        r#"
        SELECT cm.user_id, u.username, cm.role, cm.joined_at
        FROM channel_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.channel_id = $1
        ORDER BY cm.joined_at
        "#,
    )
    .bind(channel_id)
    .fetch_all(state.pool.inner())
    .await
    .unwrap_or_default();

    let response: Vec<ChannelMember> = members
        .into_iter()
        .map(|(user_id, username, role, joined_at)| ChannelMember {
            user_id: user_id.to_string(),
            username,
            role,
            joined_at: joined_at.to_rfc3339(),
        })
        .collect();

    Ok(Json(response))
}

/// Add a member to a channel
pub async fn add_channel_member(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<AddMemberRequest>,
) -> Result<(StatusCode, Json<ChannelMember>), (StatusCode, String)> {
    // Check channel exists
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM documents WHERE id = $1 AND doc_type = 'chat')",
    )
    .bind(channel_id)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !exists {
        return Err((StatusCode::NOT_FOUND, "Channel not found".to_string()));
    }

    // Get username
    let username = sqlx::query_scalar::<_, String>("SELECT username FROM users WHERE id = $1")
        .bind(payload.user_id)
        .fetch_optional(state.pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    let joined_at = chrono::Utc::now();

    // Insert member (upsert)
    sqlx::query(
        r#"
        INSERT INTO channel_members (channel_id, user_id, role, joined_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (channel_id, user_id) DO UPDATE SET role = $3
        "#,
    )
    .bind(channel_id)
    .bind(payload.user_id)
    .bind(&payload.role)
    .bind(joined_at)
    .execute(state.pool.inner())
    .await
    .map_err(|e| {
        error!("Failed to add channel member: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to add member".to_string(),
        )
    })?;

    info!(channel_id = %channel_id, user_id = %payload.user_id, "Added member to channel");

    Ok((
        StatusCode::CREATED,
        Json(ChannelMember {
            user_id: payload.user_id.to_string(),
            username,
            role: payload.role,
            joined_at: joined_at.to_rfc3339(),
        }),
    ))
}

/// Remove a member from a channel
pub async fn remove_channel_member(
    State(state): State<AppState>,
    Path((channel_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2")
        .bind(channel_id)
        .bind(user_id)
        .execute(state.pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Member not found".to_string()));
    }

    info!(channel_id = %channel_id, user_id = %user_id, "Removed member from channel");

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// Direct Messages
// ============================================================================

#[derive(Serialize, Deserialize)]
pub struct DirectMessage {
    pub id: String,
    pub participants: Vec<DmParticipant>,
    pub created_at: String,
    pub last_message_at: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct DmParticipant {
    pub user_id: String,
    pub username: String,
}

#[derive(Serialize, Deserialize)]
pub struct CreateDmRequest {
    pub participant_ids: Vec<Uuid>,
}

/// Get direct messages for current user
pub async fn get_direct_messages(
    State(state): State<AppState>,
    // TODO: Get user_id from auth middleware
) -> Result<Json<Vec<DirectMessage>>, (StatusCode, String)> {
    // For now, return all DMs (doc_type = 'dm')
    // In production, filter by current user's DMs
    let dms = sqlx::query_as::<_, (Uuid, chrono::DateTime<chrono::Utc>)>(
        r#"
        SELECT d.id, d.created_at
        FROM documents d
        WHERE d.doc_type = 'dm'
        ORDER BY d.updated_at DESC
        "#,
    )
    .fetch_all(state.pool.inner())
    .await
    .unwrap_or_default();

    let mut response = Vec::new();
    for (dm_id, created_at) in dms {
        // Get participants
        let participants = sqlx::query_as::<_, (Uuid, String)>(
            r#"
            SELECT cm.user_id, u.username
            FROM channel_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.channel_id = $1
            "#,
        )
        .bind(dm_id)
        .fetch_all(state.pool.inner())
        .await
        .unwrap_or_default();

        response.push(DirectMessage {
            id: dm_id.to_string(),
            participants: participants
                .into_iter()
                .map(|(user_id, username)| DmParticipant {
                    user_id: user_id.to_string(),
                    username,
                })
                .collect(),
            created_at: created_at.to_rfc3339(),
            last_message_at: None, // TODO: Track last message
        });
    }

    Ok(Json(response))
}

/// Create a direct message conversation
pub async fn create_direct_message(
    State(state): State<AppState>,
    Json(payload): Json<CreateDmRequest>,
) -> Result<(StatusCode, Json<DirectMessage>), (StatusCode, String)> {
    if payload.participant_ids.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "At least one participant required".to_string(),
        ));
    }

    let dm_id = Uuid::new_v4();

    // Initialize empty Yjs document
    let doc = yrs::Doc::new();
    let doc_binary = doc
        .transact()
        .encode_state_as_update_v1(&yrs::StateVector::default());

    // Create DM document
    sqlx::query("INSERT INTO documents (id, name, doc_type, doc_binary) VALUES ($1, $2, 'dm', $3)")
        .bind(dm_id)
        .bind("Direct Message")
        .bind(doc_binary)
        .execute(state.pool.inner())
        .await
        .map_err(|e| {
            error!("Failed to create DM: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to create DM".to_string(),
            )
        })?;

    let created_at = chrono::Utc::now();
    let mut participants = Vec::new();

    // Add participants
    for user_id in &payload.participant_ids {
        let username = sqlx::query_scalar::<_, String>("SELECT username FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(state.pool.inner())
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| format!("User {}", user_id));

        sqlx::query(
            "INSERT INTO channel_members (channel_id, user_id, role, joined_at) VALUES ($1, $2, 'member', $3)",
        )
        .bind(dm_id)
        .bind(user_id)
        .bind(created_at)
        .execute(state.pool.inner())
        .await
        .ok();

        participants.push(DmParticipant {
            user_id: user_id.to_string(),
            username,
        });
    }

    info!(dm_id = %dm_id, "Created direct message");

    Ok((
        StatusCode::CREATED,
        Json(DirectMessage {
            id: dm_id.to_string(),
            participants,
            created_at: created_at.to_rfc3339(),
            last_message_at: None,
        }),
    ))
}

// ============================================================================
// Channel Read Status (Unread Count)
// ============================================================================

#[derive(Serialize, Deserialize)]
pub struct ChannelReadStatus {
    pub channel_id: String,
    pub user_id: String,
    pub unread_count: i32,
    pub last_read_at: String,
}

/// Get read status for a channel (unread count)
pub async fn get_channel_read_status(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
    axum::Extension(user_id): axum::Extension<Uuid>,
) -> Result<Json<ChannelReadStatus>, (StatusCode, String)> {
    // Try to get existing read status
    let status = sqlx::query_as::<_, (i32, chrono::DateTime<chrono::Utc>)>(
        r#"
        SELECT unread_count, last_read_at
        FROM channel_read_status
        WHERE channel_id = $1 AND user_id = $2
        "#,
    )
    .bind(channel_id)
    .bind(user_id)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        error!("Failed to get read status: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get read status".to_string())
    })?;

    let (unread_count, last_read_at) = status.unwrap_or((0, chrono::Utc::now()));

    Ok(Json(ChannelReadStatus {
        channel_id: channel_id.to_string(),
        user_id: user_id.to_string(),
        unread_count,
        last_read_at: last_read_at.to_rfc3339(),
    }))
}

/// Mark channel as read (reset unread count)
pub async fn mark_channel_read(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
    axum::Extension(user_id): axum::Extension<Uuid>,
) -> Result<Json<ChannelReadStatus>, (StatusCode, String)> {
    let now = chrono::Utc::now();

    // Upsert read status with unread_count = 0
    sqlx::query(
        r#"
        INSERT INTO channel_read_status (channel_id, user_id, unread_count, last_read_at)
        VALUES ($1, $2, 0, $3)
        ON CONFLICT (channel_id, user_id)
        DO UPDATE SET unread_count = 0, last_read_at = $3
        "#,
    )
    .bind(channel_id)
    .bind(user_id)
    .bind(now)
    .execute(state.pool.inner())
    .await
    .map_err(|e| {
        error!("Failed to mark channel read: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to mark as read".to_string())
    })?;

    info!(channel_id = %channel_id, user_id = %user_id, "Marked channel as read");

    Ok(Json(ChannelReadStatus {
        channel_id: channel_id.to_string(),
        user_id: user_id.to_string(),
        unread_count: 0,
        last_read_at: now.to_rfc3339(),
    }))
}

/// Increment unread count for all channel members except sender
/// (Called when a new message is sent)
pub async fn increment_unread_count(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
    axum::Extension(sender_id): axum::Extension<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Increment unread for all members except the sender
    sqlx::query(
        r#"
        INSERT INTO channel_read_status (channel_id, user_id, unread_count, last_read_at)
        SELECT $1, cm.user_id, 1, NOW()
        FROM channel_members cm
        WHERE cm.channel_id = $1 AND cm.user_id != $2
        ON CONFLICT (channel_id, user_id)
        DO UPDATE SET unread_count = channel_read_status.unread_count + 1
        "#,
    )
    .bind(channel_id)
    .bind(sender_id)
    .execute(state.pool.inner())
    .await
    .map_err(|e| {
        error!("Failed to increment unread count: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update unread".to_string())
    })?;

    Ok(StatusCode::OK)
}

/// Get unread counts for all channels for a user
pub async fn get_all_unread_counts(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
) -> Result<Json<Vec<ChannelReadStatus>>, (StatusCode, String)> {
    let statuses = sqlx::query_as::<_, (Uuid, i32, chrono::DateTime<chrono::Utc>)>(
        r#"
        SELECT channel_id, unread_count, last_read_at
        FROM channel_read_status
        WHERE user_id = $1 AND unread_count > 0
        "#,
    )
    .bind(user_id)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| {
        error!("Failed to get unread counts: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get unread counts".to_string())
    })?;

    let response: Vec<ChannelReadStatus> = statuses
        .into_iter()
        .map(|(channel_id, unread_count, last_read_at)| ChannelReadStatus {
            channel_id: channel_id.to_string(),
            user_id: user_id.to_string(),
            unread_count,
            last_read_at: last_read_at.to_rfc3339(),
        })
        .collect();

    Ok(Json(response))
}
