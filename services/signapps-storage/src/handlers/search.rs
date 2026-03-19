//! Search handlers - Full-text and metadata search across files.
#![allow(dead_code)]

use axum::{
    extract::{Extension, Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Result;
use sqlx::{postgres::PgRow, Row};

use crate::AppState;

/// Search query parameters.
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    /// Search query string
    pub q: String,
    /// Bucket to search in (None = all buckets)
    pub bucket: Option<String>,
    /// Path prefix filter
    pub prefix: Option<String>,
    /// File type filter (e.g., "image", "document", "video")
    pub file_type: Option<String>,
    /// Content type filter (e.g., "application/pdf")
    pub content_type: Option<String>,
    /// Minimum file size in bytes
    pub min_size: Option<i64>,
    /// Maximum file size in bytes
    pub max_size: Option<i64>,
    /// Modified after date
    pub modified_after: Option<DateTime<Utc>>,
    /// Modified before date
    pub modified_before: Option<DateTime<Utc>>,
    /// Include content search (OCR, text content)
    pub include_content: Option<bool>,
    /// Sort by field
    pub sort_by: Option<SearchSortField>,
    /// Sort order
    pub sort_order: Option<SortOrder>,
    /// Page size
    pub limit: Option<i32>,
    /// Offset for pagination
    pub offset: Option<i32>,
}

/// Sort field options.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SearchSortField {
    Name,
    Size,
    Modified,
    #[default]
    Relevance,
}

/// Sort order.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    Asc,
    #[default]
    Desc,
}

/// Search result.
#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub bucket: String,
    pub key: String,
    pub filename: String,
    pub path: String,
    pub size: i64,
    pub content_type: String,
    pub modified_at: DateTime<Utc>,
    /// Relevance score (0-1)
    pub score: f32,
    /// Matched highlights
    pub highlights: Vec<SearchHighlight>,
    /// File preview info
    pub preview: Option<FilePreview>,
}

/// Search highlight.
#[derive(Debug, Serialize)]
pub struct SearchHighlight {
    pub field: String,
    pub snippet: String,
}

/// File preview info.
#[derive(Debug, Serialize)]
pub struct FilePreview {
    pub thumbnail_url: Option<String>,
    pub preview_text: Option<String>,
}

/// Search response.
#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub total: i64,
    pub query: String,
    pub facets: SearchFacets,
    pub took_ms: u64,
}

/// Search facets for filtering.
#[derive(Debug, Serialize)]
pub struct SearchFacets {
    pub buckets: Vec<FacetCount>,
    pub file_types: Vec<FacetCount>,
    pub size_ranges: Vec<SizeRangeFacet>,
}

/// Facet count.
#[derive(Debug, Serialize)]
pub struct FacetCount {
    pub value: String,
    pub count: i64,
}

/// Size range facet.
#[derive(Debug, Serialize)]
pub struct SizeRangeFacet {
    pub label: String,
    pub min: Option<i64>,
    pub max: Option<i64>,
    pub count: i64,
}

/// Quick search query (simpler version).
#[derive(Debug, Deserialize)]
pub struct QuickSearchQuery {
    pub q: String,
    pub limit: Option<i32>,
}

/// Quick search result.
#[derive(Debug, Serialize)]
pub struct QuickSearchResult {
    pub bucket: String,
    pub key: String,
    pub filename: String,
    pub content_type: String,
    pub size: i64,
}

/// Quick search response.
#[derive(Debug, Serialize)]
pub struct QuickSearchResponse {
    pub results: Vec<QuickSearchResult>,
    pub total: i64,
}

/// Search files with full options.
#[tracing::instrument(skip(_state))]
pub async fn search(
    State(_state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<SearchResponse>> {
    let start = std::time::Instant::now();

    let bucket = query
        .bucket
        .clone()
        .unwrap_or_else(|| "default".to_string());

    let list_query = crate::storage::ListObjectsQuery {
        prefix: query.prefix.clone(),
        delimiter: None,
        max_keys: Some(1000),
        continuation_token: None,
    };

    let mut results = vec![];
    let mut total = 0;

    if let Ok(listed) = _state.storage.list_objects(&bucket, list_query).await {
        let q_lower = query.q.to_lowercase();

        for obj in listed.objects {
            let filename = obj
                .key
                .split('/')
                .next_back()
                .unwrap_or(&obj.key)
                .to_string();

            if q_lower.is_empty() || filename.to_lowercase().contains(&q_lower) {
                let modified_at = if let Some(dt_str) = &obj.last_modified {
                    DateTime::parse_from_rfc3339(dt_str)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now())
                } else {
                    Utc::now()
                };

                results.push(SearchResult {
                    bucket: bucket.clone(),
                    key: obj.key.clone(),
                    filename,
                    path: obj.key.clone(),
                    size: obj.size,
                    content_type: obj
                        .content_type
                        .unwrap_or_else(|| "application/octet-stream".to_string()),
                    modified_at,
                    score: 1.0,
                    highlights: vec![],
                    preview: None,
                });
            }
        }
        total = results.len() as i64;
    }

    let took_ms = start.elapsed().as_millis() as u64;

    Ok(Json(SearchResponse {
        results,
        total,

        query: query.q,
        facets: SearchFacets {
            buckets: vec![],
            file_types: vec![],
            size_ranges: vec![
                SizeRangeFacet {
                    label: "< 1 MB".to_string(),
                    min: None,
                    max: Some(1024 * 1024),
                    count: 0,
                },
                SizeRangeFacet {
                    label: "1 - 10 MB".to_string(),
                    min: Some(1024 * 1024),
                    max: Some(10 * 1024 * 1024),
                    count: 0,
                },
                SizeRangeFacet {
                    label: "10 - 100 MB".to_string(),
                    min: Some(10 * 1024 * 1024),
                    max: Some(100 * 1024 * 1024),
                    count: 0,
                },
                SizeRangeFacet {
                    label: "> 100 MB".to_string(),
                    min: Some(100 * 1024 * 1024),
                    max: None,
                    count: 0,
                },
            ],
        },
        took_ms,
    }))
}

/// Quick search - simple filename search.
#[tracing::instrument(skip(_state))]
pub async fn quick_search(
    State(_state): State<AppState>,
    Query(query): Query<QuickSearchQuery>,
) -> Result<Json<QuickSearchResponse>> {
    let limit = query.limit.unwrap_or(10) as usize;

    let bucket = "default".to_string();
    let list_query = crate::storage::ListObjectsQuery {
        prefix: None,
        delimiter: None,
        max_keys: Some(500),
        continuation_token: None,
    };

    let mut results = vec![];

    if let Ok(listed) = _state.storage.list_objects(&bucket, list_query).await {
        let q_lower = query.q.to_lowercase();

        for obj in listed.objects {
            if results.len() >= limit {
                break;
            }
            let filename = obj
                .key
                .split('/')
                .next_back()
                .unwrap_or(&obj.key)
                .to_string();

            if q_lower.is_empty() || filename.to_lowercase().contains(&q_lower) {
                results.push(QuickSearchResult {
                    bucket: bucket.clone(),
                    key: obj.key.clone(),
                    filename,
                    size: obj.size,
                    content_type: obj
                        .content_type
                        .unwrap_or_else(|| "application/octet-stream".to_string()),
                });
            }
        }
    }

    let total = results.len() as i64;

    Ok(Json(QuickSearchResponse { results, total }))
}

/// Get recent files for current user.
#[tracing::instrument(skip(_state))]
pub async fn recent_files(
    State(_state): State<AppState>,
    Query(limit): Query<Option<i32>>,
) -> Result<Json<Vec<QuickSearchResult>>> {
    let _limit = limit.unwrap_or(20);

    // TODO: Get recent files from access history

    Ok(Json(vec![]))
}

/// Suggest search completions.
#[tracing::instrument(skip(_state))]
pub async fn suggest(
    State(_state): State<AppState>,
    Query(query): Query<QuickSearchQuery>,
) -> Result<Json<Vec<String>>> {
    // TODO: Suggest based on:
    // - Recent searches
    // - File names
    // - Folder names

    Ok(Json(vec![]))
}

/// Get file type categories.
fn get_file_type(content_type: &str) -> String {
    match content_type {
        t if t.starts_with("image/") => "image".to_string(),
        t if t.starts_with("video/") => "video".to_string(),
        t if t.starts_with("audio/") => "audio".to_string(),
        t if t.starts_with("text/") => "document".to_string(),
        "application/pdf" => "document".to_string(),
        t if t.contains("spreadsheet") || t.contains("excel") => "spreadsheet".to_string(),
        t if t.contains("presentation") || t.contains("powerpoint") => "presentation".to_string(),
        t if t.contains("document") || t.contains("word") => "document".to_string(),
        "application/zip" | "application/x-rar-compressed" | "application/x-7z-compressed" => {
            "archive".to_string()
        },
        _ => "other".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_file_type() {
        assert_eq!(get_file_type("image/png"), "image");
        assert_eq!(get_file_type("video/mp4"), "video");
        assert_eq!(get_file_type("application/pdf"), "document");
        assert_eq!(get_file_type("application/zip"), "archive");
        assert_eq!(get_file_type("application/octet-stream"), "other");
    }

    #[test]
    fn test_search_sort_field_default() {
        assert!(matches!(
            SearchSortField::default(),
            SearchSortField::Relevance
        ));
    }

    #[test]
    fn test_sort_order_default() {
        assert!(matches!(SortOrder::default(), SortOrder::Desc));
    }
}

/// Omni search query.
#[derive(Debug, Deserialize)]
pub struct OmniSearchQuery {
    pub q: String,
    pub limit: Option<i32>,
}

/// Omni search result item.
#[derive(Debug, Serialize)]
pub struct OmniSearchResult {
    pub id: uuid::Uuid,
    pub entity_type: String,
    pub title: String,
    pub snippet: Option<String>,
    pub url: String,
    pub updated_at: DateTime<Utc>,
}

/// Omni search response.
#[derive(Debug, Serialize)]
pub struct OmniSearchResponse {
    pub results: Vec<OmniSearchResult>,
    pub took_ms: u64,
}

/// Omni-search: Search across ALL entities (Docs, Mail, Files) via global index
#[tracing::instrument(skip(state))]
pub async fn omni_search(
    State(state): State<AppState>,
    Extension(user_id): Extension<uuid::Uuid>,
    Query(query): Query<OmniSearchQuery>,
) -> Result<Json<OmniSearchResponse>> {
    let start = std::time::Instant::now();
    let limit = query.limit.unwrap_or(10).clamp(1, 100) as i64;

    // Quick escape if query is empty
    if query.q.trim().is_empty() {
        return Ok(Json(OmniSearchResponse {
            results: vec![],
            took_ms: start.elapsed().as_millis() as u64,
        }));
    }

    let pattern = format!("%{}%", query.q);

    let rows = sqlx::query(
        r#"
        SELECT id, entity_type, title, snippet, url, updated_at
        FROM global_search_index
        WHERE user_id = $1 AND (title ILIKE $2 OR snippet ILIKE $2)
        ORDER BY updated_at DESC
        LIMIT $3
        "#,
    )
    .bind(user_id)
    .bind(pattern)
    .bind(limit)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let results = rows
        .into_iter()
        .map(|r: PgRow| OmniSearchResult {
            id: r.get("id"),
            entity_type: r.get("entity_type"),
            title: r.get("title"),
            snippet: r.get("snippet"),
            url: r.get("url"),
            updated_at: r.get("updated_at"),
        })
        .collect();

    let took_ms = start.elapsed().as_millis() as u64;

    Ok(Json(OmniSearchResponse { results, took_ms }))
}
