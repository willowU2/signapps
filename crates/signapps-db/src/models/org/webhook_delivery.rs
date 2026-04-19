//! Canonical `org_webhook_deliveries` table — SO4 integrations.
//!
//! Une **delivery** trace une tentative de dispatch d'une [`Webhook`].
//! Conservée pour l'audit + l'UI admin (timeline des 50 dernières).
//!
//! [`Webhook`]: super::Webhook

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// One `org_webhook_deliveries` row.
///
/// # Examples
///
/// ```ignore
/// let d = WebhookDelivery {
///     id: 42,
///     webhook_id: uuid::Uuid::new_v4(),
///     event_type: "org.person.created".into(),
///     payload_json: serde_json::json!({"id": "..."}),
///     status_code: Some(200),
///     response_body: Some("ok".into()),
///     error_message: None,
///     attempt: 1,
///     delivered_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct WebhookDelivery {
    /// Identifiant séquentiel (BIGSERIAL).
    pub id: i64,
    /// FK vers `org_webhooks.id`.
    pub webhook_id: Uuid,
    /// Type de l'event source.
    pub event_type: String,
    /// Payload JSON envoyé (signed body).
    pub payload_json: serde_json::Value,
    /// Code HTTP retourné (NULL si erreur réseau).
    pub status_code: Option<i32>,
    /// Body de réponse (clamped à 1024 chars côté dispatcher).
    pub response_body: Option<String>,
    /// Message d'erreur (réseau, parse, timeout…).
    pub error_message: Option<String>,
    /// Numéro de tentative (1, 2, 3…).
    pub attempt: i32,
    /// Date du dispatch (UTC).
    pub delivered_at: DateTime<Utc>,
}
