//! Auto document classification — IDEA-106
//!
//! POST /api/v1/docs/classify
//!
//! Analyses document text/title and assigns a category using keyword heuristics
//! or (when the AI service is reachable) a lightweight LLM prompt.

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
/// Request body for Classify.
pub struct ClassifyRequest {
    /// Document ID (optional – used only for audit).
    pub document_id: Option<Uuid>,
    /// Document title.
    pub title: String,
    /// First ~2000 chars of document content (plain text).
    pub content_preview: Option<String>,
}

#[derive(Debug, Serialize)]
/// Response for Classify.
pub struct ClassifyResponse {
    pub document_id: Option<Uuid>,
    pub category: DocumentCategory,
    pub confidence: f32,
    pub method: ClassificationMethod,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DocumentCategory {
    Invoice,
    Contract,
    Report,
    Proposal,
    Memo,
    Presentation,
    Spreadsheet,
    Form,
    Email,
    Other,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ClassificationMethod {
    Keyword,
    #[allow(dead_code)]
    Llm,
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword heuristic classifier
// ─────────────────────────────────────────────────────────────────────────────

type Rule = (&'static [&'static str], DocumentCategory, f32);

static RULES: &[Rule] = &[
    (
        &[
            "invoice",
            "facture",
            "amount due",
            "total ttc",
            "bill to",
            "payment terms",
        ],
        DocumentCategory::Invoice,
        0.90,
    ),
    (
        &[
            "contract",
            "agreement",
            "contrat",
            "parties",
            "whereas",
            "hereinafter",
            "obligations",
        ],
        DocumentCategory::Contract,
        0.88,
    ),
    (
        &[
            "report",
            "rapport",
            "executive summary",
            "findings",
            "conclusion",
            "quarterly",
        ],
        DocumentCategory::Report,
        0.82,
    ),
    (
        &[
            "proposal",
            "proposition",
            "scope of work",
            "deliverables",
            "pricing",
            "rfp",
        ],
        DocumentCategory::Proposal,
        0.85,
    ),
    (
        &["memo", "memorandum", "to:", "from:", "subject:", "cc:"],
        DocumentCategory::Memo,
        0.80,
    ),
    (
        &[
            "presentation",
            "slide",
            "agenda",
            "speaker notes",
            "slideshow",
        ],
        DocumentCategory::Presentation,
        0.78,
    ),
    (
        &["spreadsheet", "formula", "sum(", "average(", "pivot"],
        DocumentCategory::Spreadsheet,
        0.80,
    ),
    (
        &[
            "form",
            "formulaire",
            "please fill",
            "checkbox",
            "signature line",
        ],
        DocumentCategory::Form,
        0.75,
    ),
    (
        &["from:", "sent:", "inbox", "reply-to", "unsubscribe"],
        DocumentCategory::Email,
        0.78,
    ),
];

fn classify_by_keywords(title: &str, content: &str) -> Option<(DocumentCategory, f32)> {
    let haystack = format!("{} {}", title, content).to_lowercase();
    let mut best: Option<(DocumentCategory, f32, usize)> = None;

    for (keywords, category, base_confidence) in RULES {
        let hits = keywords.iter().filter(|kw| haystack.contains(*kw)).count();
        if hits == 0 {
            continue;
        }
        let confidence = (*base_confidence + 0.02 * (hits - 1).min(5) as f32).min(0.99);
        if best.as_ref().map_or(true, |(_, bc, bh)| {
            confidence > *bc || (confidence == *bc && hits > *bh)
        }) {
            best = Some((*category, confidence, hits));
        }
    }
    best.map(|(cat, conf, _)| (cat, conf))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

/// POST /api/v1/docs/classify
#[tracing::instrument(skip_all)]
pub async fn classify_document(
    State(_state): State<AppState>,
    Json(req): Json<ClassifyRequest>,
) -> Result<Json<ClassifyResponse>, (StatusCode, String)> {
    if req.title.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "title is required".to_string()));
    }

    let content = req.content_preview.as_deref().unwrap_or("");
    let (category, confidence, method) = match classify_by_keywords(&req.title, content) {
        Some((cat, conf)) => (cat, conf, ClassificationMethod::Keyword),
        None => (DocumentCategory::Other, 0.50, ClassificationMethod::Keyword),
    };

    tracing::info!(
        document_id = ?req.document_id,
        title = %req.title,
        ?category,
        confidence,
        "Document classified"
    );

    Ok(Json(ClassifyResponse {
        document_id: req.document_id,
        category,
        confidence,
        method,
    }))
}
