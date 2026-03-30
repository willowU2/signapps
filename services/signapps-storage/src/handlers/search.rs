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
use uuid::Uuid;

use crate::AppState;

/// Search query parameters.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
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
/// SearchResult data transfer object.
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
/// SearchHighlight data transfer object.
pub struct SearchHighlight {
    pub field: String,
    pub snippet: String,
}

/// File preview info.
#[derive(Debug, Serialize)]
/// FilePreview data transfer object.
pub struct FilePreview {
    pub thumbnail_url: Option<String>,
    pub preview_text: Option<String>,
}

/// Search response.
#[derive(Debug, Serialize)]
/// Response for Search.
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub total: i64,
    pub query: String,
    pub facets: SearchFacets,
    pub took_ms: u64,
}

/// Search facets for filtering.
#[derive(Debug, Serialize)]
/// SearchFacets data transfer object.
pub struct SearchFacets {
    pub buckets: Vec<FacetCount>,
    pub file_types: Vec<FacetCount>,
    pub size_ranges: Vec<SizeRangeFacet>,
}

/// Facet count.
#[derive(Debug, Serialize)]
/// FacetCount data transfer object.
pub struct FacetCount {
    pub value: String,
    pub count: i64,
}

/// Size range facet.
#[derive(Debug, Serialize)]
/// SizeRangeFacet data transfer object.
pub struct SizeRangeFacet {
    pub label: String,
    pub min: Option<i64>,
    pub max: Option<i64>,
    pub count: i64,
}

/// Quick search query (simpler version).
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct QuickSearchQuery {
    pub q: String,
    pub limit: Option<i32>,
}

/// Quick search result.
#[derive(Debug, Serialize)]
/// QuickSearchResult data transfer object.
pub struct QuickSearchResult {
    pub bucket: String,
    pub key: String,
    pub filename: String,
    pub content_type: String,
    pub size: i64,
}

/// Quick search response.
#[derive(Debug, Serialize)]
/// Response for QuickSearch.
pub struct QuickSearchResponse {
    pub results: Vec<QuickSearchResult>,
    pub total: i64,
}

/// Extract filename from a storage key (last path component).
fn filename_from_key(key: &str) -> String {
    key.split('/').next_back().unwrap_or(key).to_string()
}

/// Map a PgRow from `storage.files` to a `SearchResult`.
fn row_to_search_result(row: &PgRow) -> SearchResult {
    let key: String = row.get("key");
    let bucket: String = row.get("bucket");
    let filename = filename_from_key(&key);
    let content_type: Option<String> = row.get("content_type");
    SearchResult {
        path: key.clone(),
        filename,
        bucket,
        key,
        size: row.get("size"),
        content_type: content_type.unwrap_or_else(|| "application/octet-stream".to_string()),
        modified_at: row.get("updated_at"),
        score: 1.0,
        highlights: vec![],
        preview: None,
    }
}

/// Search files with full options (ILIKE-based, filters on type/date/size/bucket).
///
/// Strategy:
///  - Match on the last path segment (filename) via ILIKE `%q%`
///  - Optional filters: bucket, content_type prefix, size range, date range
///  - Sorting: name / size / modified_at (default: modified_at DESC)
///  - Pagination via LIMIT / OFFSET
///  - Facets computed separately for buckets and file-type categories.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn search(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<SearchResponse>> {
    let start = std::time::Instant::now();

    let limit = query.limit.unwrap_or(50).clamp(1, 200) as i64;
    let offset = query.offset.unwrap_or(0).max(0) as i64;

    // ---- Build WHERE clauses dynamically (sqlx doesn't support truly dynamic
    // queries, so we use a fixed parameterised query and handle optionals with
    // Postgres conditional expressions).  We rely on Postgres short-circuit:
    // ($N IS NULL OR expr) always evaluates to TRUE when $N is NULL.
    let rows = sqlx::query(
        r#"
        SELECT bucket, key, size, content_type, updated_at
        FROM storage.files
        WHERE user_id = $1
          AND ($2::text IS NULL OR key ILIKE '%' || $2 || '%')
          AND ($3::text IS NULL OR bucket = $3)
          AND ($4::text IS NULL OR key LIKE $4 || '%')
          AND ($5::text IS NULL OR content_type ILIKE $5 || '%')
          AND ($6::bigint IS NULL OR size >= $6)
          AND ($7::bigint IS NULL OR size <= $7)
          AND ($8::timestamptz IS NULL OR updated_at >= $8)
          AND ($9::timestamptz IS NULL OR updated_at <= $9)
        ORDER BY
          CASE WHEN $10 = 'name'     AND $11 = 'asc'  THEN key END ASC,
          CASE WHEN $10 = 'name'     AND $11 = 'desc' THEN key END DESC,
          CASE WHEN $10 = 'size'     AND $11 = 'asc'  THEN size END ASC,
          CASE WHEN $10 = 'size'     AND $11 = 'desc' THEN size END DESC,
          CASE WHEN $10 = 'modified' AND $11 = 'asc'  THEN updated_at END ASC,
          updated_at DESC
        LIMIT $12 OFFSET $13
        "#,
    )
    .bind(user_id)
    .bind(if query.q.is_empty() {
        None
    } else {
        Some(&query.q)
    })
    .bind(query.bucket.as_deref())
    .bind(query.prefix.as_deref())
    .bind(query.content_type.as_deref())
    .bind(query.min_size)
    .bind(query.max_size)
    .bind(query.modified_after)
    .bind(query.modified_before)
    .bind(
        query
            .sort_by
            .as_ref()
            .map(|s| match s {
                SearchSortField::Name => "name",
                SearchSortField::Size => "size",
                SearchSortField::Modified => "modified",
                SearchSortField::Relevance => "modified",
            })
            .unwrap_or("modified"),
    )
    .bind(
        query
            .sort_order
            .as_ref()
            .map(|o| match o {
                SortOrder::Asc => "asc",
                SortOrder::Desc => "desc",
            })
            .unwrap_or("desc"),
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    // ---- Count total matching rows ----
    let total_row = sqlx::query(
        r#"
        SELECT COUNT(*) AS cnt
        FROM storage.files
        WHERE user_id = $1
          AND ($2::text IS NULL OR key ILIKE '%' || $2 || '%')
          AND ($3::text IS NULL OR bucket = $3)
          AND ($4::text IS NULL OR key LIKE $4 || '%')
          AND ($5::text IS NULL OR content_type ILIKE $5 || '%')
          AND ($6::bigint IS NULL OR size >= $6)
          AND ($7::bigint IS NULL OR size <= $7)
          AND ($8::timestamptz IS NULL OR updated_at >= $8)
          AND ($9::timestamptz IS NULL OR updated_at <= $9)
        "#,
    )
    .bind(user_id)
    .bind(if query.q.is_empty() {
        None
    } else {
        Some(&query.q)
    })
    .bind(query.bucket.as_deref())
    .bind(query.prefix.as_deref())
    .bind(query.content_type.as_deref())
    .bind(query.min_size)
    .bind(query.max_size)
    .bind(query.modified_after)
    .bind(query.modified_before)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let total: i64 = total_row.get("cnt");

    // ---- Build facets: per-bucket counts ----
    let bucket_rows = sqlx::query(
        r#"
        SELECT bucket, COUNT(*) AS cnt
        FROM storage.files
        WHERE user_id = $1
          AND ($2::text IS NULL OR key ILIKE '%' || $2 || '%')
        GROUP BY bucket
        ORDER BY cnt DESC
        LIMIT 20
        "#,
    )
    .bind(user_id)
    .bind(if query.q.is_empty() {
        None
    } else {
        Some(&query.q)
    })
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let bucket_facets: Vec<FacetCount> = bucket_rows
        .iter()
        .map(|r| FacetCount {
            value: r.get("bucket"),
            count: r.get("cnt"),
        })
        .collect();

    // ---- Build facets: per-file-type counts ----
    let type_rows = sqlx::query(
        r#"
        SELECT content_type, COUNT(*) AS cnt
        FROM storage.files
        WHERE user_id = $1
          AND ($2::text IS NULL OR key ILIKE '%' || $2 || '%')
          AND content_type IS NOT NULL
        GROUP BY content_type
        ORDER BY cnt DESC
        LIMIT 20
        "#,
    )
    .bind(user_id)
    .bind(if query.q.is_empty() {
        None
    } else {
        Some(&query.q)
    })
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    // Aggregate by category
    let mut type_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for r in &type_rows {
        let ct: String = r.get("content_type");
        let cnt: i64 = r.get("cnt");
        let category = get_file_type(&ct);
        *type_map.entry(category).or_insert(0) += cnt;
    }
    let mut file_type_facets: Vec<FacetCount> = type_map
        .into_iter()
        .map(|(value, count)| FacetCount { value, count })
        .collect();
    file_type_facets.sort_by(|a, b| b.count.cmp(&a.count));

    // ---- Build facets: size ranges ----
    let size_ranges = build_size_range_facets(&rows);

    let results: Vec<SearchResult> = rows.iter().map(row_to_search_result).collect();

    let took_ms = start.elapsed().as_millis() as u64;

    Ok(Json(SearchResponse {
        results,
        total,
        query: query.q,
        facets: SearchFacets {
            buckets: bucket_facets,
            file_types: file_type_facets,
            size_ranges,
        },
        took_ms,
    }))
}

/// Compute size-range facet counts from a result slice.
fn build_size_range_facets(rows: &[PgRow]) -> Vec<SizeRangeFacet> {
    let mut tiny = 0i64;
    let mut small = 0i64;
    let mut medium = 0i64;
    let mut large = 0i64;

    for row in rows {
        let size: i64 = row.get("size");
        if size < 1024 * 1024 {
            tiny += 1;
        } else if size < 10 * 1024 * 1024 {
            small += 1;
        } else if size < 100 * 1024 * 1024 {
            medium += 1;
        } else {
            large += 1;
        }
    }

    vec![
        SizeRangeFacet {
            label: "< 1 MB".to_string(),
            min: None,
            max: Some(1024 * 1024),
            count: tiny,
        },
        SizeRangeFacet {
            label: "1 - 10 MB".to_string(),
            min: Some(1024 * 1024),
            max: Some(10 * 1024 * 1024),
            count: small,
        },
        SizeRangeFacet {
            label: "10 - 100 MB".to_string(),
            min: Some(10 * 1024 * 1024),
            max: Some(100 * 1024 * 1024),
            count: medium,
        },
        SizeRangeFacet {
            label: "> 100 MB".to_string(),
            min: Some(100 * 1024 * 1024),
            max: None,
            count: large,
        },
    ]
}

/// Quick search - simple ILIKE on the key (filename).
///
/// Returns up to `limit` files (default 10, max 50) whose key contains the
/// query string (case-insensitive).  Searches all buckets for the user.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn quick_search(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Query(query): Query<QuickSearchQuery>,
) -> Result<Json<QuickSearchResponse>> {
    let limit = query.limit.unwrap_or(10).clamp(1, 50) as i64;
    let pattern = format!("%{}%", query.q);

    let rows = sqlx::query(
        r#"
        SELECT bucket, key, size, content_type
        FROM storage.files
        WHERE user_id = $1
          AND key ILIKE $2
        ORDER BY updated_at DESC
        LIMIT $3
        "#,
    )
    .bind(user_id)
    .bind(&pattern)
    .bind(limit)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let total = rows.len() as i64;

    let results: Vec<QuickSearchResult> = rows
        .iter()
        .map(|r| {
            let key: String = r.get("key");
            let filename = filename_from_key(&key);
            let content_type: Option<String> = r.get("content_type");
            QuickSearchResult {
                bucket: r.get("bucket"),
                key,
                filename,
                size: r.get("size"),
                content_type: content_type
                    .unwrap_or_else(|| "application/octet-stream".to_string()),
            }
        })
        .collect();

    Ok(Json(QuickSearchResponse { results, total }))
}

/// Recent files query (for the optional `limit` query param).
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct RecentFilesQuery {
    pub limit: Option<i32>,
}

/// Get the 20 most recently updated files for the current user.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn recent_files(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Query(query): Query<RecentFilesQuery>,
) -> Result<Json<Vec<QuickSearchResult>>> {
    let limit = query.limit.unwrap_or(20).clamp(1, 100) as i64;

    let rows = sqlx::query(
        r#"
        SELECT bucket, key, size, content_type
        FROM storage.files
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT $2
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let results: Vec<QuickSearchResult> = rows
        .iter()
        .map(|r| {
            let key: String = r.get("key");
            let filename = filename_from_key(&key);
            let content_type: Option<String> = r.get("content_type");
            QuickSearchResult {
                bucket: r.get("bucket"),
                key,
                filename,
                size: r.get("size"),
                content_type: content_type
                    .unwrap_or_else(|| "application/octet-stream".to_string()),
            }
        })
        .collect();

    Ok(Json(results))
}

/// Suggest search completions — returns the top 5 matching filenames.
///
/// Matches the last path component (filename) using ILIKE, returns distinct
/// filenames sorted alphabetically.  Useful for autocomplete dropdowns.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn suggest(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Query(query): Query<QuickSearchQuery>,
) -> Result<Json<Vec<String>>> {
    if query.q.trim().is_empty() {
        return Ok(Json(vec![]));
    }

    let pattern = format!("%{}%", query.q);

    // Extract the filename (last path segment) in SQL using split_part / reverse trick:
    // reverse(split_part(reverse(key), '/', 1)) gives us the last component.
    let rows = sqlx::query(
        r#"
        SELECT DISTINCT reverse(split_part(reverse(key), '/', 1)) AS filename
        FROM storage.files
        WHERE user_id = $1
          AND key ILIKE $2
        ORDER BY filename
        LIMIT 5
        "#,
    )
    .bind(user_id)
    .bind(&pattern)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let suggestions: Vec<String> = rows.iter().map(|r| r.get("filename")).collect();

    Ok(Json(suggestions))
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

    #[test]
    fn test_filename_from_key() {
        assert_eq!(filename_from_key("folder/sub/file.pdf"), "file.pdf");
        assert_eq!(filename_from_key("file.txt"), "file.txt");
        assert_eq!(filename_from_key("a/b/c/d.mp4"), "d.mp4");
    }
}

/// Omni search query.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct OmniSearchQuery {
    pub q: String,
    pub limit: Option<i32>,
}

/// Omni search result item.
#[derive(Debug, Serialize)]
/// OmniSearchResult data transfer object.
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
/// Response for OmniSearch.
pub struct OmniSearchResponse {
    pub results: Vec<OmniSearchResult>,
    pub took_ms: u64,
}

/// Omni-search: Search across ALL entities (Docs, Mail, Files) via global index
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn omni_search(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
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
