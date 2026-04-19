//! Global Search endpoints — unified search, suggestions, history, and saved searches.
//!
//! All search data is stored in the `search` schema. The global search endpoint
//! queries identity-local tables (users, groups, workspaces) and returns a
//! unified result set. Cross-module search is delegated to individual services
//! via the gateway.
//!
//! # Endpoints
//!
//! - `GET    /api/v1/search`             — global search across modules
//! - `GET    /api/v1/search/suggestions` — typeahead suggestions
//! - `GET    /api/v1/search/history`     — user's recent searches
//! - `DELETE /api/v1/search/history`     — clear search history
//! - `GET    /api/v1/search/saved`       — list saved searches
//! - `POST   /api/v1/search/saved`       — save a search
//! - `DELETE /api/v1/search/saved/:id`   — delete a saved search

use crate::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

// ── Types ────────────────────────────────────────────────────────────────────

/// A single search result item returned to the client.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct SearchResult {
    /// Unique identifier of the matched entity.
    pub id: Uuid,
    /// Module that owns the entity (e.g. "user", "group", "workspace", "file", "doc").
    pub entity_type: String,
    /// Human-readable title or name.
    pub title: String,
    /// Short text snippet around the match (optional).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snippet: Option<String>,
    /// Relative URL to navigate to the result.
    pub url: String,
    /// Relevance score (higher is more relevant).
    pub score: f64,
    /// Last update timestamp of the matched entity.
    pub updated_at: DateTime<Utc>,
}

/// Response envelope for the global search endpoint.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct SearchResponse {
    /// Matched results ordered by relevance.
    pub results: Vec<SearchResult>,
    /// Total number of results (may exceed `limit`).
    pub total: i64,
    /// Time taken to execute the search in milliseconds.
    pub took_ms: i64,
}

/// Query parameters for the global search endpoint.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
#[allow(dead_code)]
pub struct SearchParams {
    /// Full-text search query.
    pub q: String,
    /// Scope filter: "all", "users", "groups", "workspaces".
    #[serde(default = "default_scope")]
    pub scope: String,
    /// Entity type filter (optional further refinement).
    #[serde(rename = "type")]
    pub entity_type: Option<String>,
    /// Filter results updated after this date.
    pub date_from: Option<DateTime<Utc>>,
    /// Filter results updated before this date.
    pub date_to: Option<DateTime<Utc>>,
    /// Filter by author/owner UUID.
    pub author: Option<Uuid>,
    /// Maximum number of results to return (default 20, max 100).
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_scope() -> String {
    "all".to_string()
}

fn default_limit() -> i64 {
    20
}

/// A suggestion returned by the typeahead endpoint.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct SearchSuggestion {
    /// The suggested query text.
    pub text: String,
    /// Source: "history" or "popular".
    pub source: String,
}

/// Query parameters for the suggestions endpoint.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct SuggestionsParams {
    /// Partial query for typeahead.
    pub q: String,
    /// Maximum suggestions to return (default 10).
    #[serde(default = "default_suggestions_limit")]
    pub limit: i64,
}

fn default_suggestions_limit() -> i64 {
    10
}

/// A search history entry.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct SearchHistoryItem {
    /// Unique identifier.
    pub id: Uuid,
    /// The query that was searched.
    pub query: String,
    /// Scope used for the search.
    pub scope: String,
    /// Number of results returned.
    pub result_count: i32,
    /// When the search was performed.
    pub created_at: DateTime<Utc>,
}

/// A saved search entry.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct SavedSearch {
    /// Unique identifier.
    pub id: Uuid,
    /// User-assigned name for this saved search.
    pub name: String,
    /// The search query.
    pub query: String,
    /// Scope filter.
    pub scope: String,
    /// Additional filter criteria as JSON.
    pub filters: Value,
    /// When the search was saved.
    pub created_at: DateTime<Utc>,
}

/// Request body for saving a search.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct SaveSearchRequest {
    /// User-assigned name for this saved search.
    pub name: String,
    /// The search query to save.
    pub query: String,
    /// Scope filter.
    #[serde(default = "default_scope")]
    pub scope: String,
    /// Additional filter criteria as JSON.
    #[serde(default = "default_filters")]
    pub filters: Value,
}

fn default_filters() -> Value {
    Value::Object(serde_json::Map::new())
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Ensure the search schema tables exist (idempotent).
async fn ensure_search_schema(pool: &signapps_db::DatabasePool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE SCHEMA IF NOT EXISTS search;

        CREATE TABLE IF NOT EXISTS search.history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            query TEXT NOT NULL,
            scope TEXT DEFAULT 'all',
            result_count INT DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS search.saved (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            name TEXT NOT NULL,
            query TEXT NOT NULL,
            scope TEXT DEFAULT 'all',
            filters JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        "#,
    )
    .execute(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("ensure search schema: {e}")))?;

    Ok(())
}

/// Record a search in history.
async fn record_search_history(
    pool: &signapps_db::DatabasePool,
    user_id: Uuid,
    query: &str,
    scope: &str,
    result_count: i32,
) -> Result<()> {
    sqlx::query(
        r#"INSERT INTO search.history (user_id, query, scope, result_count)
           VALUES ($1, $2, $3, $4)"#,
    )
    .bind(user_id)
    .bind(query)
    .bind(scope)
    .bind(result_count)
    .execute(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("record search history: {e}")))?;

    Ok(())
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/// `GET /api/v1/search` — global search across identity-local entities.
///
/// Searches users, groups, and workspaces using `ILIKE` matching.
/// Results are ordered by relevance (exact match > prefix > contains).
/// The search is automatically recorded in the user's history.
///
/// # Errors
///
/// Returns `Error::BadRequest` if the query is empty.
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    get,
    path = "/api/v1/search",
    tag = "search",
    security(("bearerAuth" = [])),
    params(SearchParams),
    responses(
        (status = 200, description = "Search results", body = SearchResponse),
        (status = 400, description = "Empty query"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id, query = %params.q, scope = %params.scope))]
pub async fn global_search(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<SearchParams>,
) -> Result<Json<SearchResponse>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    let query = params.q.trim().to_string();
    if query.is_empty() {
        return Err(Error::BadRequest(
            "Search query cannot be empty".to_string(),
        ));
    }

    let limit = params.limit.clamp(1, 100);
    let pattern = format!("%{query}%");
    let start = std::time::Instant::now();

    if let Err(e) = ensure_search_schema(&state.pool).await {
        tracing::warn!("search schema ensure failed: {e}");
    }

    let mut results: Vec<SearchResult> = Vec::new();

    // Search users (unless scope excludes them)
    if params.scope == "all" || params.scope == "users" {
        let user_rows = sqlx::query_as::<_, (Uuid, String, String, DateTime<Utc>)>(
            r#"SELECT id, display_name, email, updated_at
               FROM identity.users
               WHERE display_name ILIKE $1 OR email ILIKE $1
               ORDER BY
                   CASE WHEN display_name ILIKE $2 THEN 0
                        WHEN display_name ILIKE $3 THEN 1
                        ELSE 2 END,
                   display_name
               LIMIT $4"#,
        )
        .bind(&pattern)
        .bind(&query)                         // exact
        .bind(format!("{query}%"))            // prefix
        .bind(limit)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| Error::Internal(format!("search users: {e}")))?;

        for row in user_rows {
            let is_exact = row.1.to_lowercase() == query.to_lowercase();
            let is_prefix = row.1.to_lowercase().starts_with(&query.to_lowercase());
            let score = if is_exact {
                1.0
            } else if is_prefix {
                0.8
            } else {
                0.5
            };
            results.push(SearchResult {
                id: row.0,
                entity_type: "user".to_string(),
                title: row.1,
                snippet: Some(row.2),
                url: format!("/admin/users/{}", row.0),
                score,
                updated_at: row.3,
            });
        }
    }

    // Search groups
    if params.scope == "all" || params.scope == "groups" {
        let group_rows = sqlx::query_as::<_, (Uuid, String, Option<String>, DateTime<Utc>)>(
            r#"SELECT id, name, description, updated_at
               FROM identity.groups
               WHERE name ILIKE $1 OR COALESCE(description, '') ILIKE $1
               ORDER BY
                   CASE WHEN name ILIKE $2 THEN 0
                        WHEN name ILIKE $3 THEN 1
                        ELSE 2 END,
                   name
               LIMIT $4"#,
        )
        .bind(&pattern)
        .bind(&query)
        .bind(format!("{query}%"))
        .bind(limit)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| Error::Internal(format!("search groups: {e}")))?;

        for row in group_rows {
            let is_exact = row.1.to_lowercase() == query.to_lowercase();
            let is_prefix = row.1.to_lowercase().starts_with(&query.to_lowercase());
            let score = if is_exact {
                1.0
            } else if is_prefix {
                0.8
            } else {
                0.5
            };
            results.push(SearchResult {
                id: row.0,
                entity_type: "group".to_string(),
                title: row.1,
                snippet: row.2,
                url: format!("/admin/groups/{}", row.0),
                score,
                updated_at: row.3,
            });
        }
    }

    // Search workspaces
    if params.scope == "all" || params.scope == "workspaces" {
        let ws_rows = sqlx::query_as::<_, (Uuid, String, Option<String>, DateTime<Utc>)>(
            r#"SELECT id, name, description, updated_at
               FROM identity.workspaces
               WHERE name ILIKE $1 OR COALESCE(description, '') ILIKE $1
               ORDER BY
                   CASE WHEN name ILIKE $2 THEN 0
                        WHEN name ILIKE $3 THEN 1
                        ELSE 2 END,
                   name
               LIMIT $4"#,
        )
        .bind(&pattern)
        .bind(&query)
        .bind(format!("{query}%"))
        .bind(limit)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| Error::Internal(format!("search workspaces: {e}")))?;

        for row in ws_rows {
            let is_exact = row.1.to_lowercase() == query.to_lowercase();
            let is_prefix = row.1.to_lowercase().starts_with(&query.to_lowercase());
            let score = if is_exact {
                1.0
            } else if is_prefix {
                0.8
            } else {
                0.5
            };
            results.push(SearchResult {
                id: row.0,
                entity_type: "workspace".to_string(),
                title: row.1,
                snippet: row.2,
                url: format!("/workspaces/{}", row.0),
                score,
                updated_at: row.3,
            });
        }
    }

    // Sort by score descending, then by title ascending
    results.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.title.cmp(&b.title))
    });

    let total = results.len() as i64;

    // Truncate to requested limit
    results.truncate(limit as usize);

    let took_ms = start.elapsed().as_millis() as i64;

    // Record in history (best-effort — don't fail the response)
    if let Err(e) =
        record_search_history(&state.pool, claims.sub, &query, &params.scope, total as i32).await
    {
        tracing::warn!("failed to record search history: {e}");
    }

    tracing::info!(total, took_ms, "search completed");

    Ok(Json(SearchResponse {
        results,
        total,
        took_ms,
    }))
}

/// `GET /api/v1/search/suggestions` — typeahead suggestions.
///
/// Returns suggestions based on the user's search history and popular queries
/// across all users. Deduplicates and sorts by frequency.
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    get,
    path = "/api/v1/search/suggestions",
    tag = "search",
    security(("bearerAuth" = [])),
    params(SuggestionsParams),
    responses(
        (status = 200, description = "Suggestions list", body = Vec<SearchSuggestion>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id, prefix = %params.q))]
pub async fn suggestions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<SuggestionsParams>,
) -> Result<Json<Vec<SearchSuggestion>>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    let prefix = params.q.trim().to_string();
    let limit = params.limit.clamp(1, 50);

    if let Err(e) = ensure_search_schema(&state.pool).await {
        tracing::warn!("search schema ensure failed: {e}");
    }

    let mut suggestions: Vec<SearchSuggestion> = Vec::new();

    // User's own history matching the prefix
    let history_rows = sqlx::query_as::<_, (String,)>(
        r#"SELECT DISTINCT query
           FROM search.history
           WHERE user_id = $1 AND query ILIKE $2
           ORDER BY query
           LIMIT $3"#,
    )
    .bind(claims.sub)
    .bind(format!("{prefix}%"))
    .bind(limit)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("search suggestions (history): {e}")))?;

    for row in history_rows {
        suggestions.push(SearchSuggestion {
            text: row.0,
            source: "history".to_string(),
        });
    }

    // Popular queries across all users (excluding already-suggested)
    let existing: Vec<String> = suggestions.iter().map(|s| s.text.clone()).collect();
    let remaining = (limit - suggestions.len() as i64).max(0);

    if remaining > 0 {
        let popular_rows = sqlx::query_as::<_, (String, i64)>(
            r#"SELECT query, COUNT(*) as cnt
               FROM search.history
               WHERE query ILIKE $1
               GROUP BY query
               ORDER BY cnt DESC
               LIMIT $2"#,
        )
        .bind(format!("{prefix}%"))
        .bind(remaining + existing.len() as i64)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| Error::Internal(format!("search suggestions (popular): {e}")))?;

        for row in popular_rows {
            if !existing.contains(&row.0) && suggestions.len() < limit as usize {
                suggestions.push(SearchSuggestion {
                    text: row.0,
                    source: "popular".to_string(),
                });
            }
        }
    }

    Ok(Json(suggestions))
}

/// `GET /api/v1/search/history` — user's recent searches (last 20).
///
/// Returns the authenticated user's most recent search queries, ordered by
/// creation date descending.
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    get,
    path = "/api/v1/search/history",
    tag = "search",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Recent search history", body = Vec<SearchHistoryItem>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id))]
pub async fn list_history(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SearchHistoryItem>>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    if let Err(e) = ensure_search_schema(&state.pool).await {
        tracing::warn!("search schema ensure failed: {e}");
    }

    let rows = sqlx::query_as::<_, (Uuid, String, String, i32, DateTime<Utc>)>(
        r#"SELECT id, query, scope, result_count, created_at
           FROM search.history
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 20"#,
    )
    .bind(claims.sub)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("list search history: {e}")))?;

    let items = rows
        .into_iter()
        .map(|r| SearchHistoryItem {
            id: r.0,
            query: r.1,
            scope: r.2,
            result_count: r.3,
            created_at: r.4,
        })
        .collect();

    Ok(Json(items))
}

/// `DELETE /api/v1/search/history` — clear the user's search history.
///
/// Deletes all search history entries for the authenticated user. Idempotent.
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    delete,
    path = "/api/v1/search/history",
    tag = "search",
    security(("bearerAuth" = [])),
    responses(
        (status = 204, description = "History cleared"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id))]
pub async fn clear_history(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<StatusCode> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    if let Err(e) = ensure_search_schema(&state.pool).await {
        tracing::warn!("search schema ensure failed: {e}");
    }

    sqlx::query("DELETE FROM search.history WHERE user_id = $1")
        .bind(claims.sub)
        .execute(&*state.pool)
        .await
        .map_err(|e| Error::Internal(format!("clear search history: {e}")))?;

    tracing::info!("search history cleared");
    Ok(StatusCode::NO_CONTENT)
}

/// `GET /api/v1/search/saved` — list the user's saved searches.
///
/// Returns all saved searches for the authenticated user, ordered by creation
/// date descending.
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    get,
    path = "/api/v1/search/saved",
    tag = "search",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of saved searches", body = Vec<SavedSearch>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id))]
pub async fn list_saved(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SavedSearch>>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    if let Err(e) = ensure_search_schema(&state.pool).await {
        tracing::warn!("search schema ensure failed: {e}");
    }

    let rows = sqlx::query_as::<_, (Uuid, String, String, String, Value, DateTime<Utc>)>(
        r#"SELECT id, name, query, scope, filters, created_at
           FROM search.saved
           WHERE user_id = $1
           ORDER BY created_at DESC"#,
    )
    .bind(claims.sub)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("list saved searches: {e}")))?;

    let items = rows
        .into_iter()
        .map(|r| SavedSearch {
            id: r.0,
            name: r.1,
            query: r.2,
            scope: r.3,
            filters: r.4,
            created_at: r.5,
        })
        .collect();

    Ok(Json(items))
}

/// `POST /api/v1/search/saved` — save a search for later reuse.
///
/// Creates a new saved search entry for the authenticated user.
///
/// # Errors
///
/// Returns `Error::BadRequest` if the name or query is empty.
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    post,
    path = "/api/v1/search/saved",
    tag = "search",
    security(("bearerAuth" = [])),
    request_body = SaveSearchRequest,
    responses(
        (status = 201, description = "Search saved", body = SavedSearch),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id))]
pub async fn create_saved(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SaveSearchRequest>,
) -> Result<(StatusCode, Json<SavedSearch>)> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    if body.name.trim().is_empty() {
        return Err(Error::BadRequest("Name cannot be empty".to_string()));
    }
    if body.query.trim().is_empty() {
        return Err(Error::BadRequest("Query cannot be empty".to_string()));
    }

    if let Err(e) = ensure_search_schema(&state.pool).await {
        tracing::warn!("search schema ensure failed: {e}");
    }

    let row = sqlx::query_as::<_, (Uuid, String, String, String, Value, DateTime<Utc>)>(
        r#"INSERT INTO search.saved (user_id, name, query, scope, filters)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, name, query, scope, filters, created_at"#,
    )
    .bind(claims.sub)
    .bind(body.name.trim())
    .bind(body.query.trim())
    .bind(&body.scope)
    .bind(&body.filters)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("save search: {e}")))?;

    tracing::info!(saved_id = %row.0, "search saved");

    Ok((
        StatusCode::CREATED,
        Json(SavedSearch {
            id: row.0,
            name: row.1,
            query: row.2,
            scope: row.3,
            filters: row.4,
            created_at: row.5,
        }),
    ))
}

/// `DELETE /api/v1/search/saved/:id` — delete a saved search.
///
/// Removes a saved search entry. Only the owner can delete their own saved searches.
///
/// # Errors
///
/// Returns `Error::NotFound` if the saved search does not exist or belongs to another user.
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    delete,
    path = "/api/v1/search/saved/{id}",
    tag = "search",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Saved search UUID")),
    responses(
        (status = 204, description = "Saved search deleted"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Saved search not found"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id, saved_id = %id))]
pub async fn delete_saved(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    if let Err(e) = ensure_search_schema(&state.pool).await {
        tracing::warn!("search schema ensure failed: {e}");
    }

    let result = sqlx::query("DELETE FROM search.saved WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&*state.pool)
        .await
        .map_err(|e| Error::Internal(format!("delete saved search: {e}")))?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound("Saved search not found".to_string()));
    }

    tracing::info!("saved search deleted");
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_compiles() {
        // Placeholder: ensures the module compiles.
        let _ = module_path!();
    }

    #[test]
    fn default_scope_is_all() {
        assert_eq!(default_scope(), "all");
    }

    #[test]
    fn default_limit_is_20() {
        assert_eq!(default_limit(), 20);
    }

    #[test]
    fn default_suggestions_limit_is_10() {
        assert_eq!(default_suggestions_limit(), 10);
    }

    #[test]
    fn default_filters_is_empty_object() {
        assert_eq!(default_filters(), Value::Object(serde_json::Map::new()));
    }
}
