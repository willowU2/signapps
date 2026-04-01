//! Email priority scoring — IDEA-107
//!
//! POST /api/v1/mail/emails/:id/priority-score
//! POST /api/v1/mail/priority-score/batch   — score multiple emails at once
//!
//! Returns a score 1-5 (5 = most urgent) based on sender, subject, content.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
/// Request body for ScoreEmail.
pub struct ScoreEmailRequest {
    pub from: String,
    pub subject: String,
    pub body_preview: Option<String>,
}

#[derive(Debug, Deserialize)]
/// Request body for BatchScore.
pub struct BatchScoreRequest {
    pub emails: Vec<BatchEmailItem>,
}

#[derive(Debug, Deserialize)]
/// BatchEmailItem data transfer object.
pub struct BatchEmailItem {
    pub id: Uuid,
    pub from: String,
    pub subject: String,
    pub body_preview: Option<String>,
}

#[derive(Debug, Serialize)]
/// PriorityScore data transfer object.
pub struct PriorityScore {
    pub score: u8,           // 1-5
    pub label: &'static str, // "low" | "normal" | "high" | "urgent" | "critical"
    pub factors: Vec<String>,
}

#[derive(Debug, Serialize)]
/// Response for BatchScore.
pub struct BatchScoreResponse {
    pub results: Vec<BatchScoreResult>,
}

#[derive(Debug, Serialize)]
/// BatchScoreResult data transfer object.
pub struct BatchScoreResult {
    pub id: Uuid,
    pub score: u8,
    pub label: &'static str,
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring heuristics
// ─────────────────────────────────────────────────────────────────────────────

const HIGH_PRIORITY_SENDERS: &[&str] = &[
    "ceo",
    "cto",
    "cfo",
    "president",
    "director",
    "manager",
    "boss",
    "patron",
    "pdg",
    "directeur",
];

const URGENT_KEYWORDS: &[&str] = &[
    "urgent",
    "asap",
    "immediately",
    "critical",
    "deadline",
    "action required",
    "immédiat",
    "urgence",
    "critique",
    "impératif",
    "réponse requise",
    "overdue",
    "final notice",
    "payment due",
    "escalation",
];

const LOW_PRIORITY_KEYWORDS: &[&str] = &[
    "newsletter",
    "unsubscribe",
    "no-reply",
    "noreply",
    "promotional",
    "promo",
    "offer",
    "deal",
    "discount",
    "update only",
    "fyi",
];

fn score_email(from: &str, subject: &str, body: &str) -> (u8, Vec<String>) {
    let from_lc = from.to_lowercase();
    let subj_lc = subject.to_lowercase();
    let body_lc = body.to_lowercase();
    let combined = format!("{} {}", subj_lc, body_lc);

    let mut score: i32 = 2; // baseline
    let mut factors: Vec<String> = Vec::new();

    // High-priority sender signal (+1)
    if HIGH_PRIORITY_SENDERS.iter().any(|kw| from_lc.contains(kw)) {
        score += 1;
        factors.push("high-priority sender".to_string());
    }

    // No-reply / newsletter penalty (-1)
    if LOW_PRIORITY_KEYWORDS
        .iter()
        .any(|kw| from_lc.contains(kw) || combined.contains(kw))
    {
        score -= 1;
        factors.push("newsletter / promotional".to_string());
    }

    // Urgent keyword in subject (+2) or in body (+1)
    let urgent_in_subject = URGENT_KEYWORDS.iter().any(|kw| subj_lc.contains(kw));
    let urgent_in_body = URGENT_KEYWORDS.iter().any(|kw| body_lc.contains(kw));
    if urgent_in_subject {
        score += 2;
        factors.push("urgent keyword in subject".to_string());
    } else if urgent_in_body {
        score += 1;
        factors.push("urgent keyword in body".to_string());
    }

    // Direct name mention (+1 heuristic for short subjects with question marks)
    if subject.contains('?') && subject.len() < 60 {
        score += 1;
        factors.push("direct question in subject".to_string());
    }

    let clamped = score.clamp(1, 5) as u8;
    (clamped, factors)
}

fn label_for_score(score: u8) -> &'static str {
    match score {
        1 => "low",
        2 => "normal",
        3 => "high",
        4 => "urgent",
        _ => "critical",
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

/// POST /api/v1/mail/emails/:id/priority-score
#[tracing::instrument(skip_all)]
pub async fn score_single(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
    Json(req): Json<ScoreEmailRequest>,
) -> Json<PriorityScore> {
    let body = req.body_preview.as_deref().unwrap_or("");
    let (score, factors) = score_email(&req.from, &req.subject, body);
    Json(PriorityScore {
        score,
        label: label_for_score(score),
        factors,
    })
}

/// POST /api/v1/mail/priority-score/batch
#[tracing::instrument(skip_all)]
pub async fn score_batch(
    State(_state): State<AppState>,
    Json(req): Json<BatchScoreRequest>,
) -> Result<Json<BatchScoreResponse>, (StatusCode, String)> {
    if req.emails.len() > 200 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Batch too large (max 200)".to_string(),
        ));
    }
    let results = req
        .emails
        .iter()
        .map(|e| {
            let body = e.body_preview.as_deref().unwrap_or("");
            let (score, _) = score_email(&e.from, &e.subject, body);
            BatchScoreResult {
                id: e.id,
                score,
                label: label_for_score(score),
            }
        })
        .collect();
    Ok(Json(BatchScoreResponse { results }))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
