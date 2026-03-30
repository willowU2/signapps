use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use std::collections::HashMap;
use uuid::Uuid;

// ============================================================================
// Models
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
/// SpamModel data transfer object.
pub struct SpamModel {
    pub id: Uuid,
    pub account_id: Uuid,
    pub word: String,
    pub spam_count: i32,
    pub ham_count: i32,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
/// SpamSettings data transfer object.
pub struct SpamSettings {
    pub id: Uuid,
    pub account_id: Uuid,
    pub enabled: bool,
    pub threshold: f64,
    pub total_spam: i32,
    pub total_ham: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// ============================================================================
// Request / Response types
// ============================================================================

#[derive(Debug, Deserialize)]
/// Request body for Classify.
pub struct ClassifyRequest {
    pub account_id: Uuid,
    pub subject: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Serialize)]
/// Response for Classify.
pub struct ClassifyResponse {
    pub is_spam: bool,
    pub confidence: f64,
    pub spam_probability: f64,
    pub ham_probability: f64,
}

#[derive(Debug, Deserialize)]
/// Request body for Train.
pub struct TrainRequest {
    pub account_id: Uuid,
    pub email_id: Uuid,
    pub is_spam: bool,
}

#[derive(Debug, Serialize)]
/// Response for Train.
pub struct TrainResponse {
    pub status: String,
    pub words_updated: i64,
}

#[derive(Debug, Deserialize)]
/// Request body for UpdateSpamSettings.
pub struct UpdateSpamSettingsRequest {
    pub enabled: Option<bool>,
    pub threshold: Option<f64>,
}

#[derive(Debug, Serialize)]
/// Response for SpamStats.
pub struct SpamStatsResponse {
    pub enabled: bool,
    pub threshold: f64,
    pub total_spam: i32,
    pub total_ham: i32,
    pub total_classified: i32,
    pub vocabulary_size: i64,
}

// ============================================================================
// Naive Bayes helpers
// ============================================================================

/// Tokenize text into lowercase words, filtering out noise.
fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric() && c != '\'')
        .filter(|w| w.len() >= 3 && w.len() <= 40)
        .map(|w| w.to_string())
        .collect()
}

/// Compute P(spam | words) using Naive Bayes with Laplace smoothing.
fn naive_bayes_classify(
    word_counts: &HashMap<String, (i32, i32)>,
    words: &[String],
    total_spam: i32,
    total_ham: i32,
    vocab_size: usize,
) -> (f64, f64) {
    let total = (total_spam + total_ham) as f64;
    if total == 0.0 {
        return (0.5, 0.5);
    }

    let p_spam = (total_spam as f64) / total;
    let p_ham = (total_ham as f64) / total;

    // Use log probabilities to avoid underflow
    let mut log_p_spam = p_spam.ln();
    let mut log_p_ham = p_ham.ln();

    let vocab = vocab_size as f64;

    for word in words {
        let (spam_count, ham_count) = word_counts.get(word).copied().unwrap_or((0, 0));

        // Laplace smoothing
        let p_word_spam = (spam_count as f64 + 1.0) / (total_spam as f64 + vocab);
        let p_word_ham = (ham_count as f64 + 1.0) / (total_ham as f64 + vocab);

        log_p_spam += p_word_spam.ln();
        log_p_ham += p_word_ham.ln();
    }

    // Convert back from log-space using log-sum-exp
    let max_log = log_p_spam.max(log_p_ham);
    let sum = (log_p_spam - max_log).exp() + (log_p_ham - max_log).exp();

    let spam_prob = (log_p_spam - max_log).exp() / sum;
    let ham_prob = (log_p_ham - max_log).exp() / sum;

    (spam_prob, ham_prob)
}

// ============================================================================
// Handlers
// ============================================================================

/// POST /api/v1/mail/spam/classify
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn classify_email(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<ClassifyRequest>,
) -> impl IntoResponse {
    // Verify account ownership
    let account = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM mail.accounts WHERE id = $1 AND user_id = $2",
    )
    .bind(payload.account_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    if account.unwrap_or(None).is_none() {
        return (StatusCode::NOT_FOUND, "Account not found").into_response();
    }

    // Build text from subject + body
    let mut text = String::new();
    if let Some(ref subject) = payload.subject {
        text.push_str(subject);
        text.push(' ');
    }
    if let Some(ref body) = payload.body {
        text.push_str(body);
    }

    let words = tokenize(&text);
    if words.is_empty() {
        return Json(ClassifyResponse {
            is_spam: false,
            confidence: 0.0,
            spam_probability: 0.0,
            ham_probability: 1.0,
        })
        .into_response();
    }

    // Get unique words for lookup
    let unique_words: Vec<&str> = {
        let mut seen = std::collections::HashSet::new();
        words
            .iter()
            .filter(|w| seen.insert(w.as_str()))
            .map(|w| w.as_str())
            .collect()
    };

    // Fetch word counts from DB
    let rows = sqlx::query_as::<_, SpamModel>(
        "SELECT * FROM mail.spam_model WHERE account_id = $1 AND word = ANY($2)",
    )
    .bind(payload.account_id)
    .bind(&unique_words)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let word_counts: HashMap<String, (i32, i32)> = rows
        .into_iter()
        .map(|r| (r.word, (r.spam_count, r.ham_count)))
        .collect();

    // Get totals from settings
    let settings = get_or_create_settings(&state.pool, payload.account_id).await;
    let vocab_size =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM mail.spam_model WHERE account_id = $1")
            .bind(payload.account_id)
            .fetch_one(&state.pool)
            .await
            .unwrap_or(0);

    let (spam_prob, ham_prob) = naive_bayes_classify(
        &word_counts,
        &words,
        settings.total_spam,
        settings.total_ham,
        vocab_size as usize,
    );

    let is_spam = spam_prob >= settings.threshold;
    let confidence = (spam_prob - ham_prob).abs();

    Json(ClassifyResponse {
        is_spam,
        confidence,
        spam_probability: spam_prob,
        ham_probability: ham_prob,
    })
    .into_response()
}

/// POST /api/v1/mail/spam/train
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn train_spam(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<TrainRequest>,
) -> impl IntoResponse {
    // Verify account ownership
    let account = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM mail.accounts WHERE id = $1 AND user_id = $2",
    )
    .bind(payload.account_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    if account.unwrap_or(None).is_none() {
        return (StatusCode::NOT_FOUND, "Account not found").into_response();
    }

    // Fetch the email content
    let email = sqlx::query_as::<_, crate::models::Email>(
        "SELECT * FROM mail.emails WHERE id = $1 AND account_id = $2",
    )
    .bind(payload.email_id)
    .bind(payload.account_id)
    .fetch_optional(&state.pool)
    .await;

    let Some(email) = email.unwrap_or(None) else {
        return (StatusCode::NOT_FOUND, "Email not found").into_response();
    };

    // Build text from subject + body
    let mut text = String::new();
    if let Some(ref subject) = email.subject {
        text.push_str(subject);
        text.push(' ');
    }
    if let Some(ref body) = email.body_text {
        text.push_str(body);
    }

    let words = tokenize(&text);
    if words.is_empty() {
        return Json(TrainResponse {
            status: "no_words".to_string(),
            words_updated: 0,
        })
        .into_response();
    }

    // Count word frequencies in this email
    let mut freq: HashMap<String, i32> = HashMap::new();
    for word in &words {
        *freq.entry(word.clone()).or_insert(0) += 1;
    }

    // Upsert word counts
    let column = if payload.is_spam {
        "spam_count"
    } else {
        "ham_count"
    };

    let mut words_updated: i64 = 0;
    for word in freq.keys() {
        let query = format!(
            r#"INSERT INTO mail.spam_model (account_id, word, {col})
               VALUES ($1, $2, 1)
               ON CONFLICT (account_id, word)
               DO UPDATE SET {col} = mail.spam_model.{col} + 1, updated_at = NOW()"#,
            col = column
        );

        let result = sqlx::query(&query)
            .bind(payload.account_id)
            .bind(word)
            .execute(&state.pool)
            .await;

        if result.is_ok() {
            words_updated += 1;
        }
    }

    // Update totals in settings
    let total_column = if payload.is_spam {
        "total_spam"
    } else {
        "total_ham"
    };

    let settings_query = format!(
        r#"INSERT INTO mail.spam_settings (account_id, {col})
           VALUES ($1, 1)
           ON CONFLICT (account_id)
           DO UPDATE SET {col} = mail.spam_settings.{col} + 1, updated_at = NOW()"#,
        col = total_column
    );

    let _ = sqlx::query(&settings_query)
        .bind(payload.account_id)
        .execute(&state.pool)
        .await;

    Json(TrainResponse {
        status: "trained".to_string(),
        words_updated,
    })
    .into_response()
}

/// GET /api/v1/mail/spam/settings/:account_id
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_spam_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(account_id): Path<Uuid>,
) -> impl IntoResponse {
    // Verify account ownership
    let account = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM mail.accounts WHERE id = $1 AND user_id = $2",
    )
    .bind(account_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    if account.unwrap_or(None).is_none() {
        return (StatusCode::NOT_FOUND, "Account not found").into_response();
    }

    let settings = get_or_create_settings(&state.pool, account_id).await;
    let vocab_size =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM mail.spam_model WHERE account_id = $1")
            .bind(account_id)
            .fetch_one(&state.pool)
            .await
            .unwrap_or(0);

    Json(SpamStatsResponse {
        enabled: settings.enabled,
        threshold: settings.threshold,
        total_spam: settings.total_spam,
        total_ham: settings.total_ham,
        total_classified: settings.total_spam + settings.total_ham,
        vocabulary_size: vocab_size,
    })
    .into_response()
}

/// PATCH /api/v1/mail/spam/settings/:account_id
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update_spam_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(account_id): Path<Uuid>,
    Json(payload): Json<UpdateSpamSettingsRequest>,
) -> impl IntoResponse {
    // Verify account ownership
    let account = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM mail.accounts WHERE id = $1 AND user_id = $2",
    )
    .bind(account_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    if account.unwrap_or(None).is_none() {
        return (StatusCode::NOT_FOUND, "Account not found").into_response();
    }

    // Ensure settings exist
    let _ = get_or_create_settings(&state.pool, account_id).await;

    let settings = sqlx::query_as::<_, SpamSettings>(
        r#"UPDATE mail.spam_settings SET
            enabled = COALESCE($1, enabled),
            threshold = COALESCE($2, threshold),
            updated_at = NOW()
        WHERE account_id = $3
        RETURNING *"#,
    )
    .bind(payload.enabled)
    .bind(payload.threshold)
    .bind(account_id)
    .fetch_one(&state.pool)
    .await;

    match settings {
        Ok(s) => Json(s).into_response(),
        Err(e) => {
            tracing::error!("Failed to update spam settings: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to update settings",
            )
                .into_response()
        },
    }
}

// ============================================================================
// Unit tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize_splits_words_correctly() {
        let words = tokenize("Hello World foo");
        assert!(words.contains(&"hello".to_string()));
        assert!(words.contains(&"world".to_string()));
        assert!(words.contains(&"foo".to_string()));
    }

    #[test]
    fn test_tokenize_lowercases_text() {
        let words = tokenize("SPAM Email Subject");
        assert!(words.contains(&"spam".to_string()));
        assert!(words.contains(&"email".to_string()));
        assert!(words.contains(&"subject".to_string()));
    }

    #[test]
    fn test_tokenize_filters_short_words() {
        // Words shorter than 3 chars should be filtered out
        let words = tokenize("hi to do it is a");
        assert!(words.is_empty() || words.iter().all(|w| w.len() >= 3));
    }

    #[test]
    fn test_tokenize_filters_long_words() {
        // Words longer than 40 chars should be filtered out
        let long_word = "a".repeat(50);
        let text = format!("normal {}", long_word);
        let words = tokenize(&text);
        assert!(words.iter().all(|w| w.len() <= 40));
    }

    #[test]
    fn test_tokenize_handles_punctuation() {
        let words = tokenize("hello, world! buy now.");
        assert!(words.contains(&"hello".to_string()));
        assert!(words.contains(&"world".to_string()));
    }

    #[test]
    fn test_tokenize_empty_string() {
        let words = tokenize("");
        assert!(words.is_empty());
    }

    #[test]
    fn test_naive_bayes_classify_no_training_data_returns_half() {
        // With no training data (totals = 0), both probabilities should be 0.5
        let word_counts = HashMap::new();
        let words = vec!["buy".to_string(), "now".to_string()];
        let (spam_prob, ham_prob) = naive_bayes_classify(&word_counts, &words, 0, 0, 10);
        assert!((spam_prob - 0.5).abs() < 1e-9);
        assert!((ham_prob - 0.5).abs() < 1e-9);
    }

    #[test]
    fn test_naive_bayes_classify_known_spam_words() {
        // Seed the model with clearly spammy word counts
        let mut word_counts = HashMap::new();
        word_counts.insert("buy".to_string(), (100, 1)); // (spam_count, ham_count)
        word_counts.insert("now".to_string(), (80, 2));
        word_counts.insert("cheap".to_string(), (90, 1));

        let words = vec!["buy".to_string(), "now".to_string(), "cheap".to_string()];
        let (spam_prob, _ham_prob) = naive_bayes_classify(&word_counts, &words, 200, 50, 100);
        assert!(
            spam_prob > 0.5,
            "Spam words should yield spam_prob > 0.5, got {}",
            spam_prob
        );
    }

    #[test]
    fn test_naive_bayes_classify_known_ham_words() {
        // Seed the model with clearly ham word counts
        let mut word_counts = HashMap::new();
        word_counts.insert("meeting".to_string(), (1, 100));
        word_counts.insert("agenda".to_string(), (2, 80));

        let words = vec!["meeting".to_string(), "agenda".to_string()];
        let (_spam_prob, ham_prob) = naive_bayes_classify(&word_counts, &words, 50, 200, 100);
        assert!(
            ham_prob > 0.5,
            "Ham words should yield ham_prob > 0.5, got {}",
            ham_prob
        );
    }

    #[test]
    fn test_naive_bayes_probabilities_sum_to_one() {
        let mut word_counts = HashMap::new();
        word_counts.insert("test".to_string(), (10, 5));

        let words = vec!["test".to_string()];
        let (spam_prob, ham_prob) = naive_bayes_classify(&word_counts, &words, 100, 100, 50);
        let sum = spam_prob + ham_prob;
        assert!(
            (sum - 1.0).abs() < 1e-9,
            "Probabilities must sum to 1.0, got {}",
            sum
        );
    }
}

// ============================================================================
// Helpers
// ============================================================================

async fn get_or_create_settings(pool: &sqlx::PgPool, account_id: Uuid) -> SpamSettings {
    let existing =
        sqlx::query_as::<_, SpamSettings>("SELECT * FROM mail.spam_settings WHERE account_id = $1")
            .bind(account_id)
            .fetch_optional(pool)
            .await
            .unwrap_or(None);

    if let Some(settings) = existing {
        return settings;
    }

    // Create default settings
    sqlx::query_as::<_, SpamSettings>(
        r#"INSERT INTO mail.spam_settings (account_id) VALUES ($1)
           ON CONFLICT (account_id) DO NOTHING
           RETURNING *"#,
    )
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .unwrap_or(None)
    .unwrap_or(SpamSettings {
        id: Uuid::new_v4(),
        account_id,
        enabled: true,
        threshold: 0.7,
        total_spam: 0,
        total_ham: 0,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    })
}
