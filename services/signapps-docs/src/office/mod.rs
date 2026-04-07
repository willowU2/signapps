//! Office conversion and import/export sub-service.
//!
//! Provides document conversion (Tiptap → DOCX/PDF/MD), import (DOCX/MD/HTML → Tiptap),
//! spreadsheet, PDF, presentation operations, and async job queue.
//! Originally `signapps-office` (port 3018), merged into `signapps-docs`.

pub mod api;
pub mod converter;
pub mod handlers;
pub mod importer;
pub mod pdf;
pub mod presentation;
pub mod spreadsheet;

use crate::office::handlers::jobs::JobStore;

/// Application state for the office sub-service (stateless document conversion).
#[derive(Clone)]
pub struct OfficeState {
    pub converter: converter::DocumentConverter,
    pub importer: importer::DocumentImporter,
    pub cache: signapps_cache::BinaryCacheService,
    /// In-memory async job queue for heavy document exports (MT-02)
    pub jobs: JobStore,
}

impl OfficeState {
    /// Create a new `OfficeState` with default values.
    pub fn new() -> Self {
        Self {
            converter: converter::DocumentConverter::new(),
            importer: importer::DocumentImporter::new(),
            cache: signapps_cache::BinaryCacheService::default_config(),
            jobs: handlers::jobs::new_job_store(),
        }
    }
}

impl Default for OfficeState {
    fn default() -> Self {
        Self::new()
    }
}
