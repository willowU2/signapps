//! JMAP Thread method handlers (RFC 8621 Section 3).
//!
//! Implements `Thread/get` and `Thread/changes`.
//! Threads are derived from the `thread_id` column on `mail.emails`.

use signapps_jmap::types::{ChangesRequest, ChangesResponse, GetRequest, GetResponse};
use sqlx::PgPool;
use uuid::Uuid;

/// Internal row type for thread email lookups.
#[derive(Debug, sqlx::FromRow)]
struct ThreadEmailRow {
    thread_id: Uuid,
    email_id: Uuid,
}

/// Handle `Thread/get` — fetch threads by ID.
///
/// Returns JMAP Thread objects containing the ordered list of `emailIds`
/// belonging to each thread.
///
/// # Errors
///
/// Returns a `MethodError::server_fail` if the database query fails.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(pool))]
pub async fn thread_get(
    pool: &PgPool,
    user_id: Uuid,
    req: GetRequest,
) -> Result<GetResponse, signapps_jmap::MethodError> {
    let account_id = req.account_id.clone();
    let account_uuid = Uuid::parse_str(&req.account_id)
        .map_err(|_| signapps_jmap::MethodError::invalid_arguments("Invalid accountId format"))?;

    let thread_uuids: Vec<Uuid> = req
        .ids
        .as_ref()
        .map(|ids| ids.iter().filter_map(|s| Uuid::parse_str(s).ok()).collect())
        .unwrap_or_default();

    if thread_uuids.is_empty() {
        return Ok(GetResponse {
            account_id,
            state: uuid::Uuid::new_v4().to_string(),
            list: vec![],
            not_found: req.ids.unwrap_or_default(),
        });
    }

    // Fetch all emails belonging to the requested threads
    let rows: Vec<ThreadEmailRow> = sqlx::query_as(
        r#"
        SELECT e.thread_id, e.id AS email_id
        FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1
          AND e.account_id = $2
          AND e.thread_id = ANY($3)
          AND COALESCE(e.is_deleted, false) = false
        ORDER BY COALESCE(e.received_at, e.created_at) ASC
        "#,
    )
    .bind(user_id)
    .bind(account_uuid)
    .bind(&thread_uuids)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "Thread/get query failed");
        signapps_jmap::MethodError::server_fail("Database query failed")
    })?;

    // Group by thread_id
    let mut thread_map: std::collections::HashMap<Uuid, Vec<String>> =
        std::collections::HashMap::new();
    for row in &rows {
        thread_map
            .entry(row.thread_id)
            .or_default()
            .push(row.email_id.to_string());
    }

    let found_ids: std::collections::HashSet<String> =
        thread_map.keys().map(|id| id.to_string()).collect();
    let not_found: Vec<String> = thread_uuids
        .iter()
        .map(|id| id.to_string())
        .filter(|id| !found_ids.contains(id))
        .collect();

    let list: Vec<serde_json::Value> = thread_map
        .iter()
        .map(|(tid, email_ids)| {
            serde_json::json!({
                "id": tid.to_string(),
                "emailIds": email_ids,
            })
        })
        .collect();

    Ok(GetResponse {
        account_id,
        state: uuid::Uuid::new_v4().to_string(),
        list,
        not_found,
    })
}

/// Handle `Thread/changes` — return thread IDs that changed since a given state.
///
/// # Errors
///
/// Returns a `MethodError::server_fail` if the database query fails.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(pool))]
pub async fn thread_changes(
    pool: &PgPool,
    user_id: Uuid,
    req: ChangesRequest,
) -> Result<ChangesResponse, signapps_jmap::MethodError> {
    let account_id = req.account_id.clone();
    let account_uuid = Uuid::parse_str(&req.account_id)
        .map_err(|_| signapps_jmap::MethodError::invalid_arguments("Invalid accountId format"))?;

    let max_changes = req.max_changes.unwrap_or(500).min(5000);

    // Find threads with recently changed emails
    let thread_ids: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT DISTINCT e.thread_id::text
        FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1
          AND e.account_id = $2
          AND e.thread_id IS NOT NULL
          AND COALESCE(e.updated_at, e.created_at) >= NOW() - INTERVAL '24 hours'
        LIMIT $3
        "#,
    )
    .bind(user_id)
    .bind(account_uuid)
    .bind(max_changes)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "Thread/changes query failed");
        signapps_jmap::MethodError::server_fail("Database query failed")
    })?;

    Ok(ChangesResponse {
        account_id,
        old_state: req.since_state,
        new_state: uuid::Uuid::new_v4().to_string(),
        has_more_changes: thread_ids.len() as i64 >= max_changes,
        created: vec![],
        updated: thread_ids,
        destroyed: vec![],
    })
}
