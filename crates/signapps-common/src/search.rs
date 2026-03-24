//! # Global Search — Tantivy-backed full-text index
//!
//! Provides a lightweight [`SearchIndex`] that can be embedded in any service.
//! Each service writes its own shard under a per-service sub-directory; a future
//! gateway pass will merge results from all shards.
//!
//! ## Feature gate
//!
//! This module is compiled only when the `search` feature is enabled:
//!
//! ```toml
//! signapps-common = { path = "...", features = ["search"] }
//! ```

use std::path::Path;

use tantivy::{
    collector::TopDocs,
    doc,
    query::QueryParser,
    schema::{
        document::Value, Field, Schema, TextFieldIndexing, TextOptions, FAST, INDEXED, STORED,
        STRING,
    },
    Index, IndexWriter, ReloadPolicy, Searcher, TantivyDocument,
};
use thiserror::Error;

/// Errors produced by the search subsystem.
#[derive(Debug, Error)]
pub enum SearchError {
    #[error("tantivy error: {0}")]
    Tantivy(#[from] tantivy::TantivyError),

    #[error("query parse error: {0}")]
    QueryParse(#[from] tantivy::query::QueryParserError),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

pub type SearchResult = std::result::Result<Vec<SearchHit>, SearchError>;

/// A single search hit returned by [`SearchIndex::search`].
#[derive(Debug, Clone)]
pub struct SearchHit {
    /// Opaque document ID (e.g. UUID stored as string).
    pub id: String,
    /// Document title.
    pub title: String,
    /// Short excerpt from the body (first 200 chars).
    pub snippet: String,
    /// Originating service tag (docs / mail / calendar / contacts / files).
    pub service: String,
    /// Tantivy relevance score.
    pub score: f32,
}

/// Internal collection of schema fields.
struct Fields {
    id: Field,
    title: Field,
    body: Field,
    service: Field,
    created_at: Field,
}

/// Full-text search index wrapping a Tantivy [`Index`].
///
/// # Thread safety
///
/// `SearchIndex` is `Send + Sync`. The internal [`IndexWriter`] is protected by
/// a `std::sync::Mutex` to allow concurrent indexing calls.
pub struct SearchIndex {
    index: Index,
    fields: Fields,
    writer: std::sync::Mutex<IndexWriter>,
}

impl SearchIndex {
    /// Opens an existing index at `data_dir`, or creates a new one.
    ///
    /// The directory is created if it does not exist.
    pub fn new(data_dir: impl AsRef<Path>) -> Result<Self, SearchError> {
        let data_dir = data_dir.as_ref();
        std::fs::create_dir_all(data_dir)?;

        let schema = Self::build_schema();
        let index = if data_dir.join("meta.json").exists() {
            Index::open_in_dir(data_dir)?
        } else {
            Index::create_in_dir(data_dir, schema.clone())?
        };

        let fields = Self::resolve_fields(&schema);

        // 50 MB heap for the writer — adequate for small-to-medium service shards.
        let writer = index.writer(50_000_000)?;

        Ok(Self {
            index,
            fields,
            writer: std::sync::Mutex::new(writer),
        })
    }

    /// Adds (or re-indexes) a document.
    ///
    /// Tantivy does not support true upserts; call [`delete_document`] first if
    /// the document may already exist.
    pub fn index_document(
        &self,
        id: &str,
        title: &str,
        body: &str,
        service: &str,
    ) -> Result<(), SearchError> {
        let created_at = chrono::Utc::now().timestamp();
        let mut writer = self.writer.lock().expect("index writer mutex poisoned");
        writer.add_document(doc!(
            self.fields.id       => id,
            self.fields.title    => title,
            self.fields.body     => body,
            self.fields.service  => service,
            self.fields.created_at => created_at,
        ))?;
        writer.commit()?;
        Ok(())
    }

    /// Removes all documents whose `id` field matches `id`.
    pub fn delete_document(&self, id: &str) -> Result<(), SearchError> {
        let term = tantivy::Term::from_field_text(self.fields.id, id);
        let mut writer = self.writer.lock().expect("index writer mutex poisoned");
        writer.delete_term(term);
        writer.commit()?;
        Ok(())
    }

    /// Searches the index and returns up to `limit` ranked hits.
    ///
    /// The query string supports Tantivy's query syntax (e.g. `"invoice 2025"`,
    /// `title:budget`, `service:mail`).
    pub fn search(&self, query: &str, limit: usize) -> SearchResult {
        let reader = self
            .index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;

        let searcher: Searcher = reader.searcher();

        let query_parser = QueryParser::for_index(
            &self.index,
            vec![self.fields.title, self.fields.body, self.fields.service],
        );
        let parsed = query_parser.parse_query(query)?;

        let top_docs = searcher.search(&parsed, &TopDocs::with_limit(limit))?;

        let mut hits = Vec::with_capacity(top_docs.len());
        for (score, doc_addr) in top_docs {
            let retrieved: TantivyDocument = searcher.doc(doc_addr)?;

            let id = Self::get_text(&retrieved, self.fields.id);
            let title = Self::get_text(&retrieved, self.fields.title);
            let body = Self::get_text(&retrieved, self.fields.body);
            let service = Self::get_text(&retrieved, self.fields.service);

            let snippet = if body.len() > 200 {
                format!("{}…", &body[..200])
            } else {
                body
            };

            hits.push(SearchHit {
                id,
                title,
                snippet,
                service,
                score,
            });
        }

        Ok(hits)
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    fn build_schema() -> Schema {
        let mut builder = Schema::builder();

        // id: stored + indexed as an exact keyword (for deletion lookups).
        builder.add_text_field("id", STRING | STORED);

        // title: full-text + stored for display.
        let text_stored = TextOptions::default()
            .set_indexing_options(
                TextFieldIndexing::default()
                    .set_tokenizer("default")
                    .set_index_option(tantivy::schema::IndexRecordOption::WithFreqsAndPositions),
            )
            .set_stored();
        builder.add_text_field("title", text_stored.clone());

        // body: full-text + stored for snippet generation.
        builder.add_text_field("body", text_stored);

        // service: keyword + stored (e.g. "docs", "mail").
        builder.add_text_field("service", STRING | STORED);

        // created_at: Unix timestamp, fast field for future range filters.
        builder.add_i64_field("created_at", INDEXED | FAST | STORED);

        builder.build()
    }

    fn resolve_fields(schema: &Schema) -> Fields {
        Fields {
            id: schema.get_field("id").expect("field 'id' missing"),
            title: schema.get_field("title").expect("field 'title' missing"),
            body: schema.get_field("body").expect("field 'body' missing"),
            service: schema
                .get_field("service")
                .expect("field 'service' missing"),
            created_at: schema
                .get_field("created_at")
                .expect("field 'created_at' missing"),
        }
    }

    fn get_text(doc: &TantivyDocument, field: Field) -> String {
        doc.get_first(field)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_owned()
    }
}

#[cfg(test)]
#[cfg(feature = "search")]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn tmp_index() -> (TempDir, SearchIndex) {
        let dir = TempDir::new().unwrap();
        let idx = SearchIndex::new(dir.path()).unwrap();
        (dir, idx)
    }

    #[test]
    fn roundtrip_index_and_search() {
        let (_dir, idx) = tmp_index();
        idx.index_document("doc-1", "Budget Q1 2025", "Quarterly budget review", "docs")
            .unwrap();
        let hits = idx.search("budget", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].id, "doc-1");
        assert_eq!(hits[0].service, "docs");
    }

    #[test]
    fn delete_removes_document() {
        let (_dir, idx) = tmp_index();
        idx.index_document("doc-2", "Invoice March", "Payment due", "mail")
            .unwrap();
        idx.delete_document("doc-2").unwrap();
        let hits = idx.search("invoice", 10).unwrap();
        assert!(hits.is_empty());
    }
}
