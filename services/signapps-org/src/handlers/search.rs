//! SO3 global search (omnibox ⌘K).
//!
//! Endpoint :
//! - `GET /api/v1/org/search?q=X&tenant_id=Y&limit=20` — cross-entity full-text.
//!
//! Stratégie :
//! - `to_tsvector` GIN indexes sur persons + nodes (migration 502).
//! - `ts_rank` pour ordonnancer, prefix-match (`ILIKE '%q%'`) en fallback
//!   pour les queries courtes (< 3 chars).
//! - Skills matchés par `ILIKE` simple (pas de GIN dessus — le catalog
//!   est de taille modeste, ~100 rows par tenant).
//!
//! Shape de réponse :
//! ```json
//! { "persons": [...], "nodes": [...], "skills": [...], "total": 42 }
//! ```

use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::models::org::Skill;
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;

/// Build the search router (nested at `/api/v1/org/search`).
pub fn routes() -> Router<AppState> {
    Router::new().route("/", get(search))
}

// ─── DTOs ───────────────────────────────────────────────────────────

/// Query params for `GET /api/v1/org/search`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct SearchQuery {
    /// Full-text query (any length).
    pub q: String,
    /// Tenant UUID — scope persons + nodes.
    pub tenant_id: Uuid,
    /// Max results per bucket. Default 20.
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    20
}

/// A person match (compact).
#[derive(Debug, Serialize, FromRow)]
#[derive(utoipa::ToSchema)]
pub struct PersonMatch {
    /// Person ID.
    pub id: Uuid,
    /// First name.
    pub first_name: String,
    /// Last name.
    pub last_name: String,
    /// Email.
    pub email: Option<String>,
}

/// A node match (compact).
#[derive(Debug, Serialize, FromRow)]
#[derive(utoipa::ToSchema)]
pub struct NodeMatch {
    /// Node ID.
    pub id: Uuid,
    /// Name.
    pub name: String,
    /// Slug.
    pub slug: Option<String>,
    /// Kind as text.
    pub kind: String,
}

/// Aggregated response.
#[derive(Debug, Serialize)]
#[derive(utoipa::ToSchema)]
pub struct SearchResponse {
    /// Persons matching the query.
    pub persons: Vec<PersonMatch>,
    /// Nodes matching the query.
    pub nodes: Vec<NodeMatch>,
    /// Skills matching the query.
    pub skills: Vec<Skill>,
    /// Total count across all buckets.
    pub total: usize,
}

// ─── Handler ───────────────────────────────────────────────────────

/// GET /api/v1/org/search — omnibox query.
#[utoipa::path(
    get,
    path = "/api/v1/org/search",
    tag = "Org",
    params(SearchQuery),
    responses(
        (status = 200, description = "Cross-entity matches", body = SearchResponse),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn search(
    State(st): State<AppState>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<SearchResponse>> {
    let query = q.q.trim().to_string();
    if query.is_empty() {
        return Ok(Json(SearchResponse {
            persons: vec![],
            nodes: vec![],
            skills: vec![],
            total: 0,
        }));
    }

    let use_fts = query.len() >= 3;
    let like_pattern = format!("%{}%", query.replace('%', "\\%"));
    let limit = q.limit.clamp(1, 100);

    let pool = st.pool.inner();

    // Persons
    let persons: Vec<PersonMatch> = if use_fts {
        let ts_query = to_plainto_tsquery(&query);
        sqlx::query_as::<_, PersonMatch>(
            "SELECT p.id, p.first_name, p.last_name, p.email
             FROM org_persons p
             WHERE p.tenant_id = $1
               AND p.active = true
               AND (
                   to_tsvector('simple',
                       coalesce(p.first_name, '') || ' ' ||
                       coalesce(p.last_name, '')  || ' ' ||
                       coalesce(p.email, '')
                   ) @@ plainto_tsquery('simple', $2)
                   OR (p.first_name ILIKE $3 OR p.last_name ILIKE $3 OR p.email ILIKE $3)
               )
             ORDER BY ts_rank(
                 to_tsvector('simple',
                     coalesce(p.first_name, '') || ' ' ||
                     coalesce(p.last_name, '')  || ' ' ||
                     coalesce(p.email, '')
                 ),
                 plainto_tsquery('simple', $2)
             ) DESC, p.last_name ASC
             LIMIT $4",
        )
        .bind(q.tenant_id)
        .bind(&ts_query)
        .bind(&like_pattern)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(format!("search persons: {e}")))?
    } else {
        sqlx::query_as::<_, PersonMatch>(
            "SELECT p.id, p.first_name, p.last_name, p.email
             FROM org_persons p
             WHERE p.tenant_id = $1
               AND p.active = true
               AND (p.first_name ILIKE $2 OR p.last_name ILIKE $2 OR p.email ILIKE $2)
             ORDER BY p.last_name ASC
             LIMIT $3",
        )
        .bind(q.tenant_id)
        .bind(&like_pattern)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(format!("search persons like: {e}")))?
    };

    // Nodes
    let nodes: Vec<NodeMatch> = if use_fts {
        let ts_query = to_plainto_tsquery(&query);
        sqlx::query_as::<_, NodeMatch>(
            "SELECT n.id, n.name, n.slug, n.kind::text AS kind
             FROM org_nodes n
             WHERE n.tenant_id = $1
               AND n.active = true
               AND (
                   to_tsvector('simple',
                       coalesce(n.name, '') || ' ' || coalesce(n.slug, '')
                   ) @@ plainto_tsquery('simple', $2)
                   OR (n.name ILIKE $3 OR n.slug ILIKE $3)
               )
             ORDER BY ts_rank(
                 to_tsvector('simple',
                     coalesce(n.name, '') || ' ' || coalesce(n.slug, '')
                 ),
                 plainto_tsquery('simple', $2)
             ) DESC
             LIMIT $4",
        )
        .bind(q.tenant_id)
        .bind(&ts_query)
        .bind(&like_pattern)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(format!("search nodes: {e}")))?
    } else {
        sqlx::query_as::<_, NodeMatch>(
            "SELECT n.id, n.name, n.slug, n.kind::text AS kind
             FROM org_nodes n
             WHERE n.tenant_id = $1
               AND n.active = true
               AND (n.name ILIKE $2 OR n.slug ILIKE $2)
             ORDER BY n.name ASC
             LIMIT $3",
        )
        .bind(q.tenant_id)
        .bind(&like_pattern)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(format!("search nodes like: {e}")))?
    };

    // Skills (global + tenant), simple ILIKE — catalog is modest.
    let skills: Vec<Skill> = sqlx::query_as::<_, Skill>(
        "SELECT * FROM org_skills
         WHERE (tenant_id IS NULL OR tenant_id = $1)
           AND (name ILIKE $2 OR slug ILIKE $2)
         ORDER BY name ASC
         LIMIT $3",
    )
    .bind(q.tenant_id)
    .bind(&like_pattern)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Database(format!("search skills: {e}")))?;

    let total = persons.len() + nodes.len() + skills.len();
    Ok(Json(SearchResponse {
        persons,
        nodes,
        skills,
        total,
    }))
}

/// Escape single quotes / tokenize for `plainto_tsquery`. Postgres' own
/// `plainto_tsquery` handles most of the parsing; we just clean up.
fn to_plainto_tsquery(q: &str) -> String {
    q.chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || *c == '@' || *c == '.' || *c == '-')
        .collect()
}
