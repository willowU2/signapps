//! Search handlers.

use axum::{
    extract::{Extension, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::Result;
use uuid::Uuid;

use crate::AppState;

/// Search query parameters.
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    /// Search query text.
    pub q: String,
    /// Maximum number of results.
    pub limit: Option<u64>,
    /// Minimum similarity score.
    #[allow(dead_code)]
    pub threshold: Option<f32>,
    /// Filter by collection.
    pub collection: Option<String>,
}

/// Search result item.
#[derive(Debug, Serialize)]
pub struct SearchResultItem {
    pub id: Uuid,
    pub document_id: Uuid,
    pub content: String,
    pub filename: String,
    pub score: f32,
}

/// Search response.
#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub query: String,
    pub results: Vec<SearchResultItem>,
    pub count: usize,
}

/// Semantic search endpoint.
#[tracing::instrument(skip(state, claims))]
pub async fn search(
    State(state): State<AppState>,
    Extension(claims): Extension<signapps_common::auth::Claims>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<SearchResponse>> {
    // Generate the security filter based on the user's claims
    let tags_filter = serde_json::json!({
        "organization_id": claims.sub
    });

    let results = state
        .rag
        .search(
            &query.q,
            query.limit,
            query.collection.as_deref(),
            Some(&tags_filter),
        )
        .await?;

    let items: Vec<SearchResultItem> = results
        .into_iter()
        .map(|r| SearchResultItem {
            id: r.id,
            document_id: r.document_id,
            content: r.content,
            filename: r.filename,
            score: r.score,
        })
        .collect();

    let count = items.len();

    Ok(Json(SearchResponse {
        query: query.q,
        results: items,
        count,
    }))
}
