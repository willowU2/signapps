//! AI Inbox Categorization — Ideas #31 & #33
//!
//! POST /api/v1/mail/emails/categorize
//!   Categorizes the last 50 unread emails for the authenticated user's accounts
//!   using keyword heuristics, optionally persisting the category label to the DB.
//!
//! POST /api/v1/mail/emails/categorize/settings
//!   Saves per-account categorization preferences in mail.accounts.metadata JSONB.

use axum::{extract::State, http::StatusCode, Extension, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;
use signapps_common::Claims;

// ─────────────────────────────────────────────────────────────────────────────
// Category definitions & keyword heuristics
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum EmailCategory {
    Factures,
    Newsletters,
    Social,
    Promotions,
    Personnel,
    Travail,
}

impl EmailCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            EmailCategory::Factures => "Factures",
            EmailCategory::Newsletters => "Newsletters",
            EmailCategory::Social => "Social",
            EmailCategory::Promotions => "Promotions",
            EmailCategory::Personnel => "Personnel",
            EmailCategory::Travail => "Travail",
        }
    }

    /// Default label color for auto-created labels.
    pub fn default_color(&self) -> &'static str {
        match self {
            EmailCategory::Factures => "#f59e0b",    // amber
            EmailCategory::Newsletters => "#6366f1", // indigo
            EmailCategory::Social => "#22c55e",      // green
            EmailCategory::Promotions => "#ec4899",  // pink
            EmailCategory::Personnel => "#64748b",   // slate
            EmailCategory::Travail => "#3b82f6",     // blue
        }
    }
}

const FACTURES_KEYWORDS: &[&str] = &[
    "invoice",
    "facture",
    "paiement",
    "receipt",
    "payment",
    "commande",
    "order",
    "billing",
    "facturation",
    "reçu",
];

const NEWSLETTERS_KEYWORDS: &[&str] = &[
    "newsletter",
    "unsubscribe",
    "désabonner",
    "se désabonner",
    "digest",
    "weekly",
    "hebdomadaire",
    "mensuel",
    "monthly",
    "no-reply",
    "noreply",
];

const SOCIAL_KEYWORDS: &[&str] = &[
    "facebook",
    "twitter",
    "linkedin",
    "instagram",
    "notification",
    "vous a mentionné",
    "mentioned you",
    "tagged you",
    "a vous a suivi",
    "followed you",
    "friend request",
    "demande d'ami",
    "tiktok",
    "youtube",
    "pinterest",
    "snapchat",
    "whatsapp",
    "telegram",
];

const PROMOTIONS_KEYWORDS: &[&str] = &[
    "offre",
    "promotion",
    "soldes",
    "réduction",
    "discount",
    "deal",
    "coupon",
    "promo",
    "sale",
    "special offer",
    "offre spéciale",
    "%",
    "bon de réduction",
    "rabais",
    "clearance",
    "liquidation",
];

const TRAVAIL_KEYWORDS: &[&str] = &[
    "projet",
    "meeting",
    "réunion",
    "deadline",
    "sprint",
    "task",
    "ticket",
    "jira",
    "confluence",
    "pull request",
    "merge request",
    "review",
    "standup",
    "backlog",
    "milestone",
    "livrable",
    "deliverable",
    "rapport",
    "report",
];

/// Assign a category to an email based on keyword heuristics.
/// Evaluated in priority order; first match wins.
/// Falls back to `Personnel` if no keywords match.
pub fn categorize_email(sender: &str, subject: &str, body_preview: &str) -> EmailCategory {
    let sender_lc = sender.to_lowercase();
    let subject_lc = subject.to_lowercase();
    let body_lc = body_preview.to_lowercase();
    let combined = format!("{} {} {}", sender_lc, subject_lc, body_lc);

    // Social — sender-domain check first (most reliable signal)
    if SOCIAL_KEYWORDS.iter().any(|kw| combined.contains(kw)) {
        return EmailCategory::Social;
    }

    // Factures — financial signals
    if FACTURES_KEYWORDS.iter().any(|kw| combined.contains(kw)) {
        return EmailCategory::Factures;
    }

    // Newsletters — unsubscribe link / digest patterns
    if NEWSLETTERS_KEYWORDS.iter().any(|kw| combined.contains(kw)) {
        return EmailCategory::Newsletters;
    }

    // Promotions — discount / sale language
    if PROMOTIONS_KEYWORDS.iter().any(|kw| combined.contains(kw)) {
        return EmailCategory::Promotions;
    }

    // Travail — project / meeting vocabulary
    if TRAVAIL_KEYWORDS.iter().any(|kw| combined.contains(kw)) {
        return EmailCategory::Travail;
    }

    // Default: personal
    EmailCategory::Personnel
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: POST /api/v1/mail/emails/categorize
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct CategorizationResult {
    pub email_id: Uuid,
    pub category: String,
}

#[derive(Debug, Deserialize)]
pub struct CategorizeQuery {
    /// If true, persist the category as a label on each email (default: true).
    #[serde(default = "default_true")]
    pub apply_labels: bool,
}

fn default_true() -> bool {
    true
}

/// POST /api/v1/mail/emails/categorize
///
/// Fetches the last 50 unread emails across all accounts belonging to the
/// authenticated user, categorizes them via keyword heuristics, optionally
/// updates their `labels` field in the DB, and returns the results.
#[tracing::instrument(skip_all)]
pub async fn categorize_inbox(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CategorizationResult>>, (StatusCode, String)> {
    // Collect all account IDs for this user
    let account_ids: Vec<Uuid> =
        sqlx::query_scalar("SELECT id FROM mail.accounts WHERE user_id = $1")
            .bind(claims.sub)
            .fetch_all(&state.pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("DB error fetching accounts: {e}"),
                )
            })?;

    if account_ids.is_empty() {
        return Ok(Json(vec![]));
    }

    // Fetch last 50 unread emails across all user accounts
    type EmailRow = (
        Uuid,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    );
    let rows: Vec<EmailRow> = sqlx::query_as(
        r#"
            SELECT e.id, e.sender, e.subject, e.snippet, e.sender_name
            FROM   mail.emails e
            WHERE  e.account_id = ANY($1)
              AND  COALESCE(e.is_read, false) = false
              AND  COALESCE(e.is_deleted, false) = false
            ORDER  BY e.received_at DESC
            LIMIT  50
            "#,
    )
    .bind(&account_ids)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("DB error fetching emails: {e}"),
        )
    })?;

    let mut results = Vec::with_capacity(rows.len());

    for (email_id, sender, subject, snippet, _sender_name) in rows {
        let category = categorize_email(
            sender.as_deref().unwrap_or(""),
            subject.as_deref().unwrap_or(""),
            snippet.as_deref().unwrap_or(""),
        );

        let category_str = category.as_str().to_string();

        // Apply label to the email in DB
        let _ = ensure_label_and_apply(&state.pool, email_id, &account_ids, &category).await;

        results.push(CategorizationResult {
            email_id,
            category: category_str,
        });
    }

    Ok(Json(results))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: POST /api/v1/mail/emails/categorize/settings
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize)]
pub struct CategorySettings {
    /// account_id to update; if omitted, applies to all user accounts
    pub account_id: Option<Uuid>,
    /// Which categories are enabled (all enabled by default when not set)
    pub enabled_categories: Vec<String>,
}

/// POST /api/v1/mail/emails/categorize/settings
///
/// Saves per-account categorization preferences into the `metadata` JSONB
/// column of `mail.accounts`. Creates the column value if it doesn't exist yet.
#[tracing::instrument(skip_all)]
pub async fn save_categorize_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CategorySettings>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let settings_json = serde_json::json!({
        "categorization": {
            "enabled_categories": payload.enabled_categories,
        }
    });

    if let Some(account_id) = payload.account_id {
        // Update a specific account (must belong to the user)
        let rows_affected = sqlx::query(
            r#"
            UPDATE mail.accounts
            SET    metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
                   updated_at = NOW()
            WHERE  id = $2
              AND  user_id = $3
            "#,
        )
        .bind(&settings_json)
        .bind(account_id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("DB error updating settings: {e}"),
            )
        })?
        .rows_affected();

        if rows_affected == 0 {
            return Err((StatusCode::NOT_FOUND, "Account not found".to_string()));
        }
    } else {
        // Update all accounts for this user
        sqlx::query(
            r#"
            UPDATE mail.accounts
            SET    metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
                   updated_at = NOW()
            WHERE  user_id = $2
            "#,
        )
        .bind(&settings_json)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("DB error updating settings: {e}"),
            )
        })?;
    }

    Ok(Json(
        serde_json::json!({ "ok": true, "settings": settings_json }),
    ))
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: ensure label exists and add it to an email
// ─────────────────────────────────────────────────────────────────────────────

/// Given an email and a category, look up the account for that email, ensure
/// the category label exists in `mail.labels` for that account, then append
/// the label name to `mail.emails.labels[]`.
#[tracing::instrument(skip_all)]
pub async fn ensure_label_and_apply(
    pool: &sqlx::PgPool,
    email_id: Uuid,
    _account_ids: &[Uuid],
    category: &EmailCategory,
) -> Result<(), sqlx::Error> {
    // Look up the account_id for this specific email
    let account_id: Option<Uuid> =
        sqlx::query_scalar("SELECT account_id FROM mail.emails WHERE id = $1")
            .bind(email_id)
            .fetch_optional(pool)
            .await?;

    let Some(account_id) = account_id else {
        return Ok(());
    };

    let label_name = category.as_str();
    let label_color = category.default_color();

    // Upsert the label — create if missing, return the existing one otherwise
    sqlx::query(
        r#"
        INSERT INTO mail.labels (account_id, name, color)
        VALUES ($1, $2, $3)
        ON CONFLICT (account_id, name) DO NOTHING
        "#,
    )
    .bind(account_id)
    .bind(label_name)
    .bind(label_color)
    .execute(pool)
    .await?;

    // Add label name to the email's labels array (avoid duplicates)
    sqlx::query(
        r#"
        UPDATE mail.emails
        SET    labels = ARRAY(
                   SELECT DISTINCT unnest(COALESCE(labels, ARRAY[]::text[]) || ARRAY[$2::text])
               ),
               updated_at = NOW()
        WHERE  id = $1
          AND  NOT ($2 = ANY(COALESCE(labels, ARRAY[]::text[])))
        "#,
    )
    .bind(email_id)
    .bind(label_name)
    .execute(pool)
    .await?;

    Ok(())
}
