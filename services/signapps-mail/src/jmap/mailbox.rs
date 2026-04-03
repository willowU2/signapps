//! JMAP Mailbox method handlers (RFC 8621 Section 2).
//!
//! Implements `Mailbox/get`, `Mailbox/set`, and `Mailbox/query`.
//! Maps the internal `mail.folders` table to JMAP Mailbox objects with
//! standard roles, counts, and hierarchy.

use signapps_jmap::types::{
    GetRequest, GetResponse, QueryRequest, QueryResponse, SetRequest, SetResponse,
};
use sqlx::PgPool;
use uuid::Uuid;

/// Internal row type for Mailbox/get queries.
#[derive(Debug, sqlx::FromRow)]
struct MailboxRow {
    id: Uuid,
    name: String,
    parent_id: Option<Uuid>,
    folder_type: String,
    unread_count: Option<i32>,
    total_count: Option<i32>,
}

/// Map internal `folder_type` to JMAP standard mailbox role (RFC 8621 Section 2).
fn folder_type_to_role(folder_type: &str) -> Option<&str> {
    match folder_type {
        "inbox" => Some("inbox"),
        "sent" => Some("sent"),
        "drafts" => Some("drafts"),
        "trash" => Some("trash"),
        "spam" | "junk" => Some("junk"),
        "archive" => Some("archive"),
        _ => None,
    }
}

/// Convert a `MailboxRow` to a JMAP Mailbox JSON object.
fn row_to_jmap_mailbox(row: &MailboxRow) -> serde_json::Value {
    serde_json::json!({
        "id": row.id.to_string(),
        "name": row.name,
        "parentId": row.parent_id.map(|p| p.to_string()),
        "role": folder_type_to_role(&row.folder_type),
        "sortOrder": match row.folder_type.as_str() {
            "inbox" => 1,
            "drafts" => 2,
            "sent" => 3,
            "archive" => 4,
            "spam" | "junk" => 5,
            "trash" => 6,
            _ => 10,
        },
        "totalEmails": row.total_count.unwrap_or(0),
        "unreadEmails": row.unread_count.unwrap_or(0),
        "totalThreads": row.total_count.unwrap_or(0),
        "unreadThreads": row.unread_count.unwrap_or(0),
        "myRights": {
            "mayReadItems": true,
            "mayAddItems": true,
            "mayRemoveItems": true,
            "maySetSeen": true,
            "maySetKeywords": true,
            "mayCreateChild": true,
            "mayRename": row.folder_type == "custom",
            "mayDelete": row.folder_type == "custom",
            "maySubmit": true,
        },
        "isSubscribed": true,
    })
}

/// Handle `Mailbox/get` — fetch mailboxes by ID or all.
///
/// Returns JMAP Mailbox objects with role, hierarchy, and message counts.
///
/// # Errors
///
/// Returns a `MethodError::server_fail` if the database query fails.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(pool))]
pub async fn mailbox_get(
    pool: &PgPool,
    user_id: Uuid,
    req: GetRequest,
) -> Result<GetResponse, signapps_jmap::MethodError> {
    let account_id = req.account_id.clone();
    let account_uuid = Uuid::parse_str(&req.account_id)
        .map_err(|_| signapps_jmap::MethodError::invalid_arguments("Invalid accountId format"))?;

    let rows: Vec<MailboxRow> = match &req.ids {
        Some(ids) if !ids.is_empty() => {
            let uuids: Vec<Uuid> = ids.iter().filter_map(|s| Uuid::parse_str(s).ok()).collect();

            sqlx::query_as(
                r#"
                SELECT f.id, f.name, f.parent_id, f.folder_type,
                       f.unread_count, f.total_count
                FROM mail.folders f
                JOIN mail.accounts a ON a.id = f.account_id
                WHERE a.user_id = $1
                  AND f.account_id = $2
                  AND f.id = ANY($3)
                "#,
            )
            .bind(user_id)
            .bind(account_uuid)
            .bind(&uuids)
            .fetch_all(pool)
            .await
            .map_err(|e| {
                tracing::error!(?e, "Mailbox/get query failed");
                signapps_jmap::MethodError::server_fail("Database query failed")
            })?
        },
        _ => sqlx::query_as(
            r#"
                SELECT f.id, f.name, f.parent_id, f.folder_type,
                       f.unread_count, f.total_count
                FROM mail.folders f
                JOIN mail.accounts a ON a.id = f.account_id
                WHERE a.user_id = $1
                  AND f.account_id = $2
                ORDER BY f.name
                "#,
        )
        .bind(user_id)
        .bind(account_uuid)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            tracing::error!(?e, "Mailbox/get (all) query failed");
            signapps_jmap::MethodError::server_fail("Database query failed")
        })?,
    };

    let found_ids: std::collections::HashSet<String> =
        rows.iter().map(|r| r.id.to_string()).collect();
    let not_found: Vec<String> = req
        .ids
        .as_ref()
        .map(|ids| {
            ids.iter()
                .filter(|id| !found_ids.contains(id.as_str()))
                .cloned()
                .collect()
        })
        .unwrap_or_default();

    let list: Vec<serde_json::Value> = rows.iter().map(row_to_jmap_mailbox).collect();

    Ok(GetResponse {
        account_id,
        state: uuid::Uuid::new_v4().to_string(),
        list,
        not_found,
    })
}

/// Handle `Mailbox/query` — query mailboxes with optional filter and sort.
///
/// # Errors
///
/// Returns a `MethodError::server_fail` if the database query fails.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(pool))]
pub async fn mailbox_query(
    pool: &PgPool,
    user_id: Uuid,
    req: QueryRequest,
) -> Result<QueryResponse, signapps_jmap::MethodError> {
    let account_id = req.account_id.clone();
    let account_uuid = Uuid::parse_str(&req.account_id)
        .map_err(|_| signapps_jmap::MethodError::invalid_arguments("Invalid accountId format"))?;

    let position = req.position.unwrap_or(0).max(0);
    let limit = req.limit.unwrap_or(100).min(500);

    let ids: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT f.id::text
        FROM mail.folders f
        JOIN mail.accounts a ON a.id = f.account_id
        WHERE a.user_id = $1
          AND f.account_id = $2
        ORDER BY f.name
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(user_id)
    .bind(account_uuid)
    .bind(limit)
    .bind(position)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "Mailbox/query failed");
        signapps_jmap::MethodError::server_fail("Database query failed")
    })?;

    Ok(QueryResponse {
        account_id,
        query_state: uuid::Uuid::new_v4().to_string(),
        can_calculate_changes: false,
        position,
        ids,
        total: None,
    })
}

/// Handle `Mailbox/set` — create, rename, or destroy mailboxes.
///
/// Only custom mailboxes can be renamed or destroyed; standard roles
/// (inbox, sent, drafts, trash, spam) are protected.
///
/// # Errors
///
/// Returns a `MethodError::server_fail` if database operations fail.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(pool))]
pub async fn mailbox_set(
    pool: &PgPool,
    user_id: Uuid,
    req: SetRequest,
) -> Result<SetResponse, signapps_jmap::MethodError> {
    let account_id = req.account_id.clone();
    let account_uuid = Uuid::parse_str(&req.account_id)
        .map_err(|_| signapps_jmap::MethodError::invalid_arguments("Invalid accountId format"))?;

    let old_state = uuid::Uuid::new_v4().to_string();
    let new_state = uuid::Uuid::new_v4().to_string();

    let mut created = serde_json::Map::new();
    let mut not_created = serde_json::Map::new();
    let mut updated = serde_json::Map::new();
    let mut not_updated = serde_json::Map::new();
    let mut destroyed_ids: Vec<String> = Vec::new();
    let mut not_destroyed = serde_json::Map::new();

    // ── Create ────────────────────────────────────────────────────────────────
    if let Some(create_map) = &req.create {
        for (creation_id, obj) in create_map {
            let name = obj
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("New Folder");
            let parent_id: Option<Uuid> = obj
                .get("parentId")
                .and_then(|v| v.as_str())
                .and_then(|s| Uuid::parse_str(s).ok());

            let new_id = Uuid::new_v4();
            let result = sqlx::query(
                r#"
                INSERT INTO mail.folders (id, account_id, name, folder_type, parent_id)
                VALUES ($1, $2, $3, 'custom', $4)
                "#,
            )
            .bind(new_id)
            .bind(account_uuid)
            .bind(name)
            .bind(parent_id)
            .execute(pool)
            .await;

            match result {
                Ok(_) => {
                    created.insert(
                        creation_id.clone(),
                        serde_json::json!({"id": new_id.to_string()}),
                    );
                },
                Err(e) => {
                    tracing::error!(?e, creation_id, "Mailbox/set create failed");
                    not_created.insert(
                        creation_id.clone(),
                        serde_json::json!({
                            "type": "serverFail",
                            "description": "Failed to create mailbox"
                        }),
                    );
                },
            }
        }
    }

    // ── Update (rename) ───────────────────────────────────────────────────────
    if let Some(update_map) = &req.update {
        for (id_str, patch) in update_map {
            let folder_id = match Uuid::parse_str(id_str) {
                Ok(id) => id,
                Err(_) => {
                    not_updated.insert(
                        id_str.clone(),
                        serde_json::json!({
                            "type": "invalidArguments",
                            "description": "Invalid mailbox ID"
                        }),
                    );
                    continue;
                },
            };

            if let Some(new_name) = patch.get("name").and_then(|v| v.as_str()) {
                let result = sqlx::query(
                    r#"
                    UPDATE mail.folders
                    SET name = $1, updated_at = NOW()
                    WHERE id = $2 AND account_id = $3 AND folder_type = 'custom'
                    "#,
                )
                .bind(new_name)
                .bind(folder_id)
                .bind(account_uuid)
                .execute(pool)
                .await;

                match result {
                    Ok(r) if r.rows_affected() > 0 => {
                        updated.insert(id_str.clone(), serde_json::Value::Null);
                    },
                    Ok(_) => {
                        not_updated.insert(
                            id_str.clone(),
                            serde_json::json!({
                                "type": "forbidden",
                                "description": "Cannot rename system mailbox"
                            }),
                        );
                    },
                    Err(e) => {
                        tracing::error!(?e, id = id_str, "Mailbox/set update failed");
                        not_updated.insert(
                            id_str.clone(),
                            serde_json::json!({
                                "type": "serverFail",
                                "description": "Failed to update mailbox"
                            }),
                        );
                    },
                }
            }
        }
    }

    // ── Destroy ───────────────────────────────────────────────────────────────
    if let Some(destroy_list) = &req.destroy {
        for id_str in destroy_list {
            let folder_id = match Uuid::parse_str(id_str) {
                Ok(id) => id,
                Err(_) => {
                    not_destroyed.insert(
                        id_str.clone(),
                        serde_json::json!({
                            "type": "notFound",
                            "description": "Invalid mailbox ID"
                        }),
                    );
                    continue;
                },
            };

            // Only allow deleting custom folders
            let result = sqlx::query(
                r#"
                DELETE FROM mail.folders
                WHERE id = $1 AND account_id = $2 AND folder_type = 'custom'
                "#,
            )
            .bind(folder_id)
            .bind(account_uuid)
            .execute(pool)
            .await;

            match result {
                Ok(r) if r.rows_affected() > 0 => {
                    destroyed_ids.push(id_str.clone());
                },
                Ok(_) => {
                    not_destroyed.insert(
                        id_str.clone(),
                        serde_json::json!({
                            "type": "forbidden",
                            "description": "Cannot destroy system mailbox"
                        }),
                    );
                },
                Err(e) => {
                    tracing::error!(?e, id = id_str, "Mailbox/set destroy failed");
                    not_destroyed.insert(
                        id_str.clone(),
                        serde_json::json!({
                            "type": "serverFail",
                            "description": "Failed to destroy mailbox"
                        }),
                    );
                },
            }
        }
    }

    Ok(SetResponse {
        account_id,
        old_state,
        new_state,
        created: if created.is_empty() {
            None
        } else {
            Some(created)
        },
        updated: if updated.is_empty() {
            None
        } else {
            Some(updated)
        },
        destroyed: if destroyed_ids.is_empty() {
            None
        } else {
            Some(destroyed_ids)
        },
        not_created: if not_created.is_empty() {
            None
        } else {
            Some(not_created)
        },
        not_updated: if not_updated.is_empty() {
            None
        } else {
            Some(not_updated)
        },
        not_destroyed: if not_destroyed.is_empty() {
            None
        } else {
            Some(not_destroyed)
        },
    })
}
