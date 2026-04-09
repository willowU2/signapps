//! Help Center endpoints — FAQ articles and support tickets.
//!
//! Provides endpoints for users to browse FAQ articles by category and submit
//! support tickets. FAQ articles are stored in `help.faq_articles` and tickets
//! in `help.support_tickets`.

use crate::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

// ── Types ────────────────────────────────────────────────────────────────────

/// A frequently asked question article.
///
/// # Examples
///
/// ```ignore
/// let article = FaqArticle {
///     id: Uuid::new_v4(),
///     category: "account".into(),
///     question: "How do I reset my password?".into(),
///     answer: "Go to Settings > Security > Change password.".into(),
///     ..Default::default()
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct FaqArticle {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Category for grouping (e.g. account, documents, mail).
    pub category: String,
    /// The question text.
    pub question: String,
    /// The answer in markdown format.
    pub answer: String,
    /// Sort order within a category (lower = first).
    pub sort_order: Option<i32>,
    /// Whether the article is visible to users.
    pub published: Option<bool>,
    /// Number of times the article has been viewed.
    pub view_count: Option<i32>,
    /// Timestamp of creation.
    pub created_at: DateTime<Utc>,
    /// Timestamp of last update.
    pub updated_at: DateTime<Utc>,
}

/// A support ticket submitted by a user.
///
/// # Examples
///
/// ```ignore
/// let ticket = SupportTicket {
///     id: Uuid::new_v4(),
///     user_id: claims.sub,
///     subject: "Cannot login".into(),
///     message: "I get a 401 error when logging in.".into(),
///     ..Default::default()
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct SupportTicket {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// User who submitted the ticket.
    pub user_id: Uuid,
    /// Short summary of the issue.
    pub subject: String,
    /// Detailed description of the issue.
    pub message: String,
    /// Ticket category (general, bug, feature, billing, etc.).
    pub category: Option<String>,
    /// Current status (open, in_progress, resolved, closed).
    pub status: Option<String>,
    /// Priority level (low, normal, high, urgent).
    pub priority: Option<String>,
    /// Timestamp of creation.
    pub created_at: DateTime<Utc>,
    /// Timestamp of last update.
    pub updated_at: DateTime<Utc>,
}

/// Query parameters for filtering FAQ articles.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct FaqQuery {
    /// Filter by category (e.g. "account", "mail", "calendar").
    pub category: Option<String>,
}

/// Request body for creating a support ticket.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateTicketRequest {
    /// Short summary of the issue.
    pub subject: String,
    /// Detailed description of the issue.
    pub message: String,
    /// Ticket category (default: "general").
    pub category: Option<String>,
    /// Priority level (default: "normal").
    pub priority: Option<String>,
}

// ── DB helpers ───────────────────────────────────────────────────────────────

/// Ensure the `help` schema and tables exist.
async fn ensure_tables(pool: &signapps_db::DatabasePool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE SCHEMA IF NOT EXISTS help;
        CREATE TABLE IF NOT EXISTS help.faq_articles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            category TEXT NOT NULL,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            sort_order INT DEFAULT 0,
            published BOOLEAN DEFAULT true,
            view_count INT DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS help.support_tickets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            status TEXT DEFAULT 'open',
            priority TEXT DEFAULT 'normal',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        "#,
    )
    .execute(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("ensure help tables: {e}")))?;
    Ok(())
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/// `GET /api/v1/help/faq` — list FAQ articles, optionally filtered by category.
///
/// Returns only published articles, sorted by sort_order and creation date.
///
/// # Errors
///
/// Returns `Error::Internal` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/help/faq",
    tag = "help",
    params(FaqQuery),
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of published FAQ articles", body = Vec<FaqArticle>),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_faq(
    State(state): State<AppState>,
    Query(q): Query<FaqQuery>,
) -> Result<Json<Vec<FaqArticle>>> {
    if let Err(e) = ensure_tables(&state.pool).await {
        tracing::warn!("help ensure_tables failed: {e}");
    }

    let articles = if let Some(ref category) = q.category {
        sqlx::query_as::<_, FaqArticle>(
            "SELECT * FROM help.faq_articles
             WHERE published = true AND category = $1
             ORDER BY sort_order ASC, created_at DESC",
        )
        .bind(category)
        .fetch_all(state.pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("list faq: {e}")))?
    } else {
        sqlx::query_as::<_, FaqArticle>(
            "SELECT * FROM help.faq_articles
             WHERE published = true
             ORDER BY sort_order ASC, created_at DESC",
        )
        .fetch_all(state.pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("list faq: {e}")))?
    };

    Ok(Json(articles))
}

/// `GET /api/v1/help/faq/:id` — get a single FAQ article and increment view count.
///
/// # Errors
///
/// Returns `Error::NotFound` if the article does not exist.
/// Returns `Error::Internal` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/help/faq/{id}",
    tag = "help",
    params(("id" = Uuid, Path, description = "FAQ article UUID")),
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "FAQ article details", body = FaqArticle),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Article not found"),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip_all, fields(article_id = %id))]
pub async fn get_faq(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<FaqArticle>> {
    if let Err(e) = ensure_tables(&state.pool).await {
        tracing::warn!("help ensure_tables failed: {e}");
    }

    // Increment view_count and return the article in a single query
    let article = sqlx::query_as::<_, FaqArticle>(
        "UPDATE help.faq_articles
         SET view_count = COALESCE(view_count, 0) + 1
         WHERE id = $1 AND published = true
         RETURNING *",
    )
    .bind(id)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("get faq: {e}")))?
    .ok_or_else(|| Error::NotFound(format!("FAQ article {id}")))?;

    Ok(Json(article))
}

/// `POST /api/v1/help/tickets` — create a new support ticket.
///
/// The ticket is associated with the authenticated user from JWT claims.
///
/// # Errors
///
/// Returns `Error::Validation` if subject or message is empty.
/// Returns `Error::Internal` if the database insert fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/help/tickets",
    tag = "help",
    security(("bearerAuth" = [])),
    request_body = CreateTicketRequest,
    responses(
        (status = 201, description = "Ticket created", body = SupportTicket),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn create_ticket(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateTicketRequest>,
) -> Result<(StatusCode, Json<SupportTicket>)> {
    // Validate inputs
    if payload.subject.trim().is_empty() {
        return Err(Error::Validation("Subject cannot be empty".to_string()));
    }
    if payload.message.trim().is_empty() {
        return Err(Error::Validation("Message cannot be empty".to_string()));
    }

    if let Err(e) = ensure_tables(&state.pool).await {
        tracing::warn!("help ensure_tables failed: {e}");
    }

    let category = payload.category.unwrap_or_else(|| "general".to_string());
    let priority = payload.priority.unwrap_or_else(|| "normal".to_string());

    let ticket = sqlx::query_as::<_, SupportTicket>(
        "INSERT INTO help.support_tickets (user_id, subject, message, category, priority)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *",
    )
    .bind(claims.sub)
    .bind(&payload.subject)
    .bind(&payload.message)
    .bind(&category)
    .bind(&priority)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("create ticket: {e}")))?;

    tracing::info!(ticket_id = %ticket.id, user_id = %claims.sub, "support ticket created");

    Ok((StatusCode::CREATED, Json(ticket)))
}

/// `GET /api/v1/help/tickets` — list the authenticated user's support tickets.
///
/// Returns tickets for the current user, ordered by creation date descending.
///
/// # Errors
///
/// Returns `Error::Internal` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/help/tickets",
    tag = "help",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of user's support tickets", body = Vec<SupportTicket>),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn list_tickets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SupportTicket>>> {
    if let Err(e) = ensure_tables(&state.pool).await {
        tracing::warn!("help ensure_tables failed: {e}");
    }

    let tickets = sqlx::query_as::<_, SupportTicket>(
        "SELECT * FROM help.support_tickets
         WHERE user_id = $1
         ORDER BY created_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("list tickets: {e}")))?;

    Ok(Json(tickets))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
