//! JMAP Email method handlers (RFC 8621 Section 4).
//!
//! Implements `Email/get`, `Email/query`, `Email/set`, and `Email/changes`.
//! Maps the internal `mail.emails` / `mail.folders` schema to JMAP Email
//! objects with standard properties and keywords.

use signapps_jmap::types::{
    ChangesRequest, ChangesResponse, GetRequest, GetResponse, QueryRequest, QueryResponse,
    SetRequest, SetResponse,
};
use sqlx::PgPool;
use uuid::Uuid;

/// Map internal boolean flags to JMAP keywords (RFC 8621 Section 4.1.1).
fn flags_to_keywords(
    is_read: Option<bool>,
    is_starred: Option<bool>,
    is_draft: Option<bool>,
    is_sent: Option<bool>,
) -> serde_json::Value {
    let mut kw = serde_json::Map::new();
    if is_read.unwrap_or(false) {
        kw.insert("$seen".to_string(), serde_json::Value::Bool(true));
    }
    if is_starred.unwrap_or(false) {
        kw.insert("$flagged".to_string(), serde_json::Value::Bool(true));
    }
    if is_draft.unwrap_or(false) {
        kw.insert("$draft".to_string(), serde_json::Value::Bool(true));
    }
    if is_sent.unwrap_or(false) {
        kw.insert("$answered".to_string(), serde_json::Value::Bool(true));
    }
    serde_json::Value::Object(kw)
}

/// Parse an email address string into a JMAP address array `[{name, email}]`.
fn parse_address_list(raw: &str) -> serde_json::Value {
    let addrs: Vec<serde_json::Value> = raw
        .split(',')
        .map(|a| a.trim())
        .filter(|a| !a.is_empty())
        .map(|a| serde_json::json!({"name": null, "email": a}))
        .collect();
    serde_json::Value::Array(addrs)
}

/// Internal row type for Email/get queries.
#[derive(Debug, sqlx::FromRow)]
struct EmailRow {
    id: Uuid,
    thread_id: Option<Uuid>,
    folder_id: Option<Uuid>,
    sender: String,
    sender_name: Option<String>,
    recipient: String,
    cc: Option<String>,
    subject: Option<String>,
    snippet: Option<String>,
    is_read: Option<bool>,
    is_starred: Option<bool>,
    is_draft: Option<bool>,
    is_sent: Option<bool>,
    has_attachments: Option<bool>,
    size_bytes: Option<i32>,
    received_at: Option<chrono::DateTime<chrono::Utc>>,
    sent_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Convert an `EmailRow` to a JMAP Email JSON object.
fn row_to_jmap_email(row: &EmailRow) -> serde_json::Value {
    let mut mailbox_ids = serde_json::Map::new();
    if let Some(fid) = row.folder_id {
        mailbox_ids.insert(fid.to_string(), serde_json::Value::Bool(true));
    }

    serde_json::json!({
        "id": row.id.to_string(),
        "blobId": row.id.to_string(),
        "threadId": row.thread_id.map(|t| t.to_string()).unwrap_or_else(|| row.id.to_string()),
        "mailboxIds": mailbox_ids,
        "from": [{
            "name": row.sender_name.as_deref().unwrap_or(""),
            "email": row.sender,
        }],
        "to": parse_address_list(&row.recipient),
        "cc": row.cc.as_deref().map(parse_address_list),
        "subject": row.subject,
        "sentAt": row.sent_at,
        "receivedAt": row.received_at,
        "size": row.size_bytes.unwrap_or(0),
        "preview": row.snippet,
        "hasAttachment": row.has_attachments.unwrap_or(false),
        "keywords": flags_to_keywords(row.is_read, row.is_starred, row.is_draft, row.is_sent),
    })
}

/// Handle `Email/get` — fetch emails by ID.
///
/// # Errors
///
/// Returns a `MethodError::server_fail` if the database query fails.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(pool))]
pub async fn email_get(
    pool: &PgPool,
    user_id: Uuid,
    req: GetRequest,
) -> Result<GetResponse, signapps_jmap::MethodError> {
    let account_id = req.account_id.clone();
    let account_uuid = Uuid::parse_str(&req.account_id)
        .map_err(|_| signapps_jmap::MethodError::invalid_arguments("Invalid accountId format"))?;

    match &req.ids {
        Some(ids) if !ids.is_empty() => {
            let uuids: Vec<Uuid> = ids.iter().filter_map(|s| Uuid::parse_str(s).ok()).collect();

            let rows: Vec<EmailRow> = sqlx::query_as(
                r#"
                SELECT e.id, e.thread_id, e.folder_id, e.sender, e.sender_name,
                       e.recipient, e.cc, e.subject, e.snippet,
                       e.is_read, e.is_starred, e.is_draft, e.is_sent,
                       e.has_attachments, e.size_bytes, e.received_at, e.sent_at
                FROM mail.emails e
                JOIN mail.accounts a ON a.id = e.account_id
                WHERE a.user_id = $1
                  AND e.account_id = $2
                  AND e.id = ANY($3)
                  AND COALESCE(e.is_deleted, false) = false
                "#,
            )
            .bind(user_id)
            .bind(account_uuid)
            .bind(&uuids)
            .fetch_all(pool)
            .await
            .map_err(|e| {
                tracing::error!(?e, "Email/get query failed");
                signapps_jmap::MethodError::server_fail("Database query failed")
            })?;

            let found_ids: std::collections::HashSet<String> =
                rows.iter().map(|r| r.id.to_string()).collect();
            let not_found: Vec<String> = ids
                .iter()
                .filter(|id| !found_ids.contains(id.as_str()))
                .cloned()
                .collect();

            let list: Vec<serde_json::Value> = rows.iter().map(row_to_jmap_email).collect();

            Ok(GetResponse {
                account_id,
                state: uuid::Uuid::new_v4().to_string(),
                list,
                not_found,
            })
        },
        _ => {
            // No IDs specified — return all (with a reasonable limit)
            let rows: Vec<EmailRow> = sqlx::query_as(
                r#"
                SELECT e.id, e.thread_id, e.folder_id, e.sender, e.sender_name,
                       e.recipient, e.cc, e.subject, e.snippet,
                       e.is_read, e.is_starred, e.is_draft, e.is_sent,
                       e.has_attachments, e.size_bytes, e.received_at, e.sent_at
                FROM mail.emails e
                JOIN mail.accounts a ON a.id = e.account_id
                WHERE a.user_id = $1
                  AND e.account_id = $2
                  AND COALESCE(e.is_deleted, false) = false
                ORDER BY COALESCE(e.received_at, e.created_at) DESC
                LIMIT 500
                "#,
            )
            .bind(user_id)
            .bind(account_uuid)
            .fetch_all(pool)
            .await
            .map_err(|e| {
                tracing::error!(?e, "Email/get (all) query failed");
                signapps_jmap::MethodError::server_fail("Database query failed")
            })?;

            let list: Vec<serde_json::Value> = rows.iter().map(row_to_jmap_email).collect();

            Ok(GetResponse {
                account_id,
                state: uuid::Uuid::new_v4().to_string(),
                list,
                not_found: vec![],
            })
        },
    }
}

/// Handle `Email/query` — search emails with JMAP filters and sorting.
///
/// Supported filter properties: `inMailbox`, `from`, `to`, `subject`, `text`,
/// `hasKeyword`, `before`, `after`.
///
/// Supported sort properties: `receivedAt`, `sentAt`, `from`, `subject`, `size`.
///
/// # Errors
///
/// Returns a `MethodError::server_fail` if the database query fails.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(pool))]
pub async fn email_query(
    pool: &PgPool,
    user_id: Uuid,
    req: QueryRequest,
) -> Result<QueryResponse, signapps_jmap::MethodError> {
    let account_id = req.account_id.clone();
    let account_uuid = Uuid::parse_str(&req.account_id)
        .map_err(|_| signapps_jmap::MethodError::invalid_arguments("Invalid accountId format"))?;

    // Build dynamic WHERE clauses from the filter
    let mut conditions = vec![
        "a.user_id = $1".to_string(),
        "e.account_id = $2".to_string(),
        "COALESCE(e.is_deleted, false) = false".to_string(),
    ];
    let mut bind_index = 3u32;

    // We'll collect bind values to pass via raw query
    // Since sqlx doesn't support fully dynamic queries easily,
    // we build the SQL string and use query_scalar for IDs.
    let filter = req.filter.as_ref().and_then(|f| f.as_object());

    let mut extra_binds: Vec<String> = Vec::new();

    if let Some(filter) = filter {
        if let Some(mailbox_id) = filter.get("inMailbox").and_then(|v| v.as_str()) {
            conditions.push(format!("e.folder_id::text = ${bind_index}"));
            extra_binds.push(mailbox_id.to_string());
            bind_index += 1;
        }
        if let Some(from) = filter.get("from").and_then(|v| v.as_str()) {
            conditions.push(format!("e.sender ILIKE ${bind_index}"));
            extra_binds.push(format!("%{from}%"));
            bind_index += 1;
        }
        if let Some(to) = filter.get("to").and_then(|v| v.as_str()) {
            conditions.push(format!("e.recipient ILIKE ${bind_index}"));
            extra_binds.push(format!("%{to}%"));
            bind_index += 1;
        }
        if let Some(subject) = filter.get("subject").and_then(|v| v.as_str()) {
            conditions.push(format!("e.subject ILIKE ${bind_index}"));
            extra_binds.push(format!("%{subject}%"));
            bind_index += 1;
        }
        if let Some(text) = filter.get("text").and_then(|v| v.as_str()) {
            conditions.push(format!(
                "(e.subject ILIKE ${bi} OR e.body_text ILIKE ${bi})",
                bi = bind_index,
            ));
            extra_binds.push(format!("%{text}%"));
            bind_index += 1;
        }
        if let Some(keyword) = filter.get("hasKeyword").and_then(|v| v.as_str()) {
            match keyword {
                "$seen" => conditions.push("COALESCE(e.is_read, false) = true".to_string()),
                "$flagged" => conditions.push("COALESCE(e.is_starred, false) = true".to_string()),
                "$draft" => conditions.push("COALESCE(e.is_draft, false) = true".to_string()),
                "$answered" => conditions.push("COALESCE(e.is_sent, false) = true".to_string()),
                _ => {},
            }
        }
        if let Some(before) = filter.get("before").and_then(|v| v.as_str()) {
            conditions.push(format!(
                "COALESCE(e.received_at, e.created_at) < ${bind_index}::timestamptz"
            ));
            extra_binds.push(before.to_string());
            bind_index += 1;
        }
        if let Some(after) = filter.get("after").and_then(|v| v.as_str()) {
            conditions.push(format!(
                "COALESCE(e.received_at, e.created_at) >= ${bind_index}::timestamptz"
            ));
            extra_binds.push(after.to_string());
            // bind_index not incremented because it's the last possible filter
            let _ = bind_index;
        }
    }

    // Build sort clause
    let order_by = if let Some(sort) = &req.sort {
        sort.iter()
            .map(|s| {
                let col = match s.property.as_str() {
                    "receivedAt" => "COALESCE(e.received_at, e.created_at)",
                    "sentAt" => "e.sent_at",
                    "from" => "e.sender",
                    "subject" => "e.subject",
                    "size" => "e.size_bytes",
                    _ => "COALESCE(e.received_at, e.created_at)",
                };
                let dir = if s.is_ascending { "ASC" } else { "DESC" };
                format!("{col} {dir}")
            })
            .collect::<Vec<_>>()
            .join(", ")
    } else {
        "COALESCE(e.received_at, e.created_at) DESC".to_string()
    };

    let position = req.position.unwrap_or(0).max(0);
    let limit = req.limit.unwrap_or(50).min(1000);
    let calculate_total = req.calculate_total.unwrap_or(false);

    let where_clause = conditions.join(" AND ");

    let sql = format!(
        r#"
        SELECT e.id::text
        FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE {where_clause}
        ORDER BY {order_by}
        LIMIT {limit} OFFSET {position}
        "#,
    );

    let mut query = sqlx::query_scalar::<_, String>(&sql)
        .bind(user_id)
        .bind(account_uuid);

    for val in &extra_binds {
        query = query.bind(val);
    }

    let ids = query.fetch_all(pool).await.map_err(|e| {
        tracing::error!(?e, "Email/query failed");
        signapps_jmap::MethodError::server_fail("Database query failed")
    })?;

    // Calculate total if requested
    let total = if calculate_total {
        let count_sql = format!(
            r#"
            SELECT COUNT(*)
            FROM mail.emails e
            JOIN mail.accounts a ON a.id = e.account_id
            WHERE {where_clause}
            "#,
        );
        let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql)
            .bind(user_id)
            .bind(account_uuid);
        for val in &extra_binds {
            count_query = count_query.bind(val);
        }
        count_query.fetch_one(pool).await.ok()
    } else {
        None
    };

    Ok(QueryResponse {
        account_id,
        query_state: uuid::Uuid::new_v4().to_string(),
        can_calculate_changes: false,
        position,
        ids,
        total,
    })
}

/// Handle `Email/set` — create, update, and destroy emails.
///
/// - **create**: Inserts a new email (draft/append) into the specified mailbox.
/// - **update**: Changes `mailboxIds` (move) or `keywords` (flag changes).
/// - **destroy**: Soft-deletes emails by setting `is_deleted = true`.
///
/// # Errors
///
/// Returns a `MethodError::server_fail` if database operations fail.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(pool))]
pub async fn email_set(
    pool: &PgPool,
    user_id: Uuid,
    req: SetRequest,
) -> Result<SetResponse, signapps_jmap::MethodError> {
    let account_id = req.account_id.clone();
    let account_uuid = Uuid::parse_str(&req.account_id)
        .map_err(|_| signapps_jmap::MethodError::invalid_arguments("Invalid accountId format"))?;

    // Verify account ownership
    let owns: Option<bool> = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM mail.accounts WHERE id = $1 AND user_id = $2)",
    )
    .bind(account_uuid)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "Email/set ownership check failed");
        signapps_jmap::MethodError::server_fail("Database query failed")
    })?;

    if owns != Some(true) {
        return Err(signapps_jmap::MethodError::account_not_found());
    }

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
            let subject = obj.get("subject").and_then(|v| v.as_str()).unwrap_or("");
            let sender = obj
                .get("from")
                .and_then(|v| v.as_array())
                .and_then(|a| a.first())
                .and_then(|v| v.get("email"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let recipient = obj
                .get("to")
                .and_then(|v| v.as_array())
                .and_then(|a| a.first())
                .and_then(|v| v.get("email"))
                .and_then(|v| v.as_str())
                .unwrap_or("");

            // Determine target folder from mailboxIds
            let folder_id: Option<Uuid> = obj
                .get("mailboxIds")
                .and_then(|v| v.as_object())
                .and_then(|m| m.keys().next())
                .and_then(|k| Uuid::parse_str(k).ok());

            // Parse keywords to flags
            let keywords = obj.get("keywords").and_then(|v| v.as_object());
            let is_read = keywords.map(|k| k.contains_key("$seen")).unwrap_or(false);
            let is_starred = keywords
                .map(|k| k.contains_key("$flagged"))
                .unwrap_or(false);
            let is_draft = keywords.map(|k| k.contains_key("$draft")).unwrap_or(false);

            let new_id = Uuid::new_v4();
            let result = sqlx::query(
                r#"
                INSERT INTO mail.emails
                    (id, account_id, folder_id, sender, recipient, subject,
                     is_read, is_starred, is_draft, is_sent, is_deleted)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, false)
                "#,
            )
            .bind(new_id)
            .bind(account_uuid)
            .bind(folder_id)
            .bind(sender)
            .bind(recipient)
            .bind(subject)
            .bind(is_read)
            .bind(is_starred)
            .bind(is_draft)
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
                    tracing::error!(?e, creation_id, "Email/set create failed");
                    not_created.insert(
                        creation_id.clone(),
                        serde_json::json!({
                            "type": "serverFail",
                            "description": "Failed to create email"
                        }),
                    );
                },
            }
        }
    }

    // ── Update ────────────────────────────────────────────────────────────────
    if let Some(update_map) = &req.update {
        for (id_str, patch) in update_map {
            let email_id = match Uuid::parse_str(id_str) {
                Ok(id) => id,
                Err(_) => {
                    not_updated.insert(
                        id_str.clone(),
                        serde_json::json!({
                            "type": "invalidArguments",
                            "description": "Invalid email ID format"
                        }),
                    );
                    continue;
                },
            };

            let patch = match patch.as_object() {
                Some(p) => p,
                None => {
                    not_updated.insert(
                        id_str.clone(),
                        serde_json::json!({
                            "type": "invalidArguments",
                            "description": "Patch must be an object"
                        }),
                    );
                    continue;
                },
            };

            // Handle mailboxIds change (move to folder)
            if let Some(mailbox_ids) = patch.get("mailboxIds").and_then(|v| v.as_object()) {
                if let Some(folder_id_str) = mailbox_ids.keys().next() {
                    if let Ok(folder_id) = Uuid::parse_str(folder_id_str) {
                        let _ = sqlx::query(
                            "UPDATE mail.emails SET folder_id = $1, updated_at = NOW() WHERE id = $2 AND account_id = $3",
                        )
                        .bind(folder_id)
                        .bind(email_id)
                        .bind(account_uuid)
                        .execute(pool)
                        .await;
                    }
                }
            }

            // Handle keywords change (flag updates)
            if let Some(keywords) = patch.get("keywords").and_then(|v| v.as_object()) {
                let is_read = keywords.contains_key("$seen");
                let is_starred = keywords.contains_key("$flagged");
                let is_draft = keywords.contains_key("$draft");

                let _ = sqlx::query(
                    r#"
                    UPDATE mail.emails
                    SET is_read = $1, is_starred = $2, is_draft = $3, updated_at = NOW()
                    WHERE id = $4 AND account_id = $5
                    "#,
                )
                .bind(is_read)
                .bind(is_starred)
                .bind(is_draft)
                .bind(email_id)
                .bind(account_uuid)
                .execute(pool)
                .await;
            }

            // Handle individual keyword/$prop patches (e.g. "keywords/$seen" = true)
            for (key, val) in patch {
                match key.as_str() {
                    "keywords/$seen" => {
                        let _ = sqlx::query(
                            "UPDATE mail.emails SET is_read = $1, updated_at = NOW() WHERE id = $2 AND account_id = $3",
                        )
                        .bind(val.as_bool().unwrap_or(false))
                        .bind(email_id)
                        .bind(account_uuid)
                        .execute(pool)
                        .await;
                    },
                    "keywords/$flagged" => {
                        let _ = sqlx::query(
                            "UPDATE mail.emails SET is_starred = $1, updated_at = NOW() WHERE id = $2 AND account_id = $3",
                        )
                        .bind(val.as_bool().unwrap_or(false))
                        .bind(email_id)
                        .bind(account_uuid)
                        .execute(pool)
                        .await;
                    },
                    "keywords/$draft" => {
                        let _ = sqlx::query(
                            "UPDATE mail.emails SET is_draft = $1, updated_at = NOW() WHERE id = $2 AND account_id = $3",
                        )
                        .bind(val.as_bool().unwrap_or(false))
                        .bind(email_id)
                        .bind(account_uuid)
                        .execute(pool)
                        .await;
                    },
                    _ => {},
                }
            }

            updated.insert(id_str.clone(), serde_json::Value::Null);
        }
    }

    // ── Destroy ───────────────────────────────────────────────────────────────
    if let Some(destroy_list) = &req.destroy {
        for id_str in destroy_list {
            let email_id = match Uuid::parse_str(id_str) {
                Ok(id) => id,
                Err(_) => {
                    not_destroyed.insert(
                        id_str.clone(),
                        serde_json::json!({
                            "type": "notFound",
                            "description": "Invalid email ID format"
                        }),
                    );
                    continue;
                },
            };

            let result = sqlx::query(
                r#"
                UPDATE mail.emails
                SET is_deleted = true, updated_at = NOW()
                WHERE id = $1 AND account_id = $2
                "#,
            )
            .bind(email_id)
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
                            "type": "notFound",
                            "description": "Email not found"
                        }),
                    );
                },
                Err(e) => {
                    tracing::error!(?e, id = id_str, "Email/set destroy failed");
                    not_destroyed.insert(
                        id_str.clone(),
                        serde_json::json!({
                            "type": "serverFail",
                            "description": "Failed to destroy email"
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

/// Handle `Email/changes` — return IDs of emails changed since a given state.
///
/// Since we don't yet track per-object change states, this returns recent
/// changes based on `updated_at` timestamp as a practical approximation.
///
/// # Errors
///
/// Returns a `MethodError::server_fail` if the database query fails.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(pool))]
pub async fn email_changes(
    pool: &PgPool,
    user_id: Uuid,
    req: ChangesRequest,
) -> Result<ChangesResponse, signapps_jmap::MethodError> {
    let account_id = req.account_id.clone();
    let account_uuid = Uuid::parse_str(&req.account_id)
        .map_err(|_| signapps_jmap::MethodError::invalid_arguments("Invalid accountId format"))?;

    let max_changes = req.max_changes.unwrap_or(500).min(5000);

    // Use updated_at as a proxy for change tracking
    // In a production system, we'd have a proper change log
    let changed_rows: Vec<(Uuid, Option<bool>, Option<chrono::DateTime<chrono::Utc>>)> =
        sqlx::query_as(
            r#"
            SELECT e.id, e.is_deleted, e.created_at
            FROM mail.emails e
            JOIN mail.accounts a ON a.id = e.account_id
            WHERE a.user_id = $1
              AND e.account_id = $2
              AND COALESCE(e.updated_at, e.created_at) >= NOW() - INTERVAL '24 hours'
            ORDER BY COALESCE(e.updated_at, e.created_at) DESC
            LIMIT $3
            "#,
        )
        .bind(user_id)
        .bind(account_uuid)
        .bind(max_changes)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            tracing::error!(?e, "Email/changes query failed");
            signapps_jmap::MethodError::server_fail("Database query failed")
        })?;

    let mut created_ids = Vec::new();
    let mut updated_ids = Vec::new();
    let mut destroyed_ids = Vec::new();

    let now = chrono::Utc::now();
    for (id, is_deleted, created_at) in &changed_rows {
        let id_str = id.to_string();
        if is_deleted.unwrap_or(false) {
            destroyed_ids.push(id_str);
        } else if let Some(ca) = created_at {
            // If created within the last 24h, treat as "created"
            if (now - *ca).num_hours() < 24 {
                created_ids.push(id_str);
            } else {
                updated_ids.push(id_str);
            }
        } else {
            updated_ids.push(id_str);
        }
    }

    Ok(ChangesResponse {
        account_id,
        old_state: req.since_state,
        new_state: uuid::Uuid::new_v4().to_string(),
        has_more_changes: changed_rows.len() as i64 >= max_changes,
        created: created_ids,
        updated: updated_ids,
        destroyed: destroyed_ids,
    })
}
