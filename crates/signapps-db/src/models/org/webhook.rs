//! Canonical `org_webhooks` table — SO4 integrations.
//!
//! Une **webhook** matérialise une souscription sortante : à chaque event
//! `org.*` publié sur le PgEventBus dont le type matche `events`, un POST
//! HMAC-SHA256-signé est dispatché vers `url`.
//!
//! La signature `X-SignApps-Signature: sha256=<hex>` est calculée sur le
//! body JSON brut. Le secret 64-char hex est généré à la création.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// One `org_webhooks` row.
///
/// # Examples
///
/// ```ignore
/// let webhook = Webhook {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     url: "https://example.com/hook".into(),
///     secret: "deadbeef…".into(),
///     events: vec!["org.person.created".into()],
///     active: true,
///     last_delivery_at: None,
///     last_status: None,
///     failure_count: 0,
///     created_at: chrono::Utc::now(),
///     updated_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Webhook {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire de la souscription.
    pub tenant_id: Uuid,
    /// URL HTTPS cible.
    pub url: String,
    /// Secret HMAC 64 chars hex (jamais retourné aux clients après création).
    pub secret: String,
    /// Liste des event types souscrits (ex: `org.person.created`).
    /// Le wildcard `org.person.*` matche tous les events `org.person.*`.
    pub events: Vec<String>,
    /// `false` = désactivée (auto après 5 échecs consécutifs).
    pub active: bool,
    /// Timestamp du dernier dispatch tenté.
    pub last_delivery_at: Option<DateTime<Utc>>,
    /// Dernier code HTTP retourné par la cible.
    pub last_status: Option<i32>,
    /// Nombre d'échecs consécutifs depuis la dernière réussite.
    pub failure_count: i32,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
}

impl Webhook {
    /// `true` si l'event_type donné matche au moins un des patterns souscrits.
    /// Supporte le wildcard suffix `*` (ex: `org.person.*` matche
    /// `org.person.created`).
    #[must_use]
    pub fn matches(&self, event_type: &str) -> bool {
        self.events.iter().any(|pat| pattern_matches(pat, event_type))
    }
}

/// Test si `pattern` (avec wildcard `*` final éventuel) matche `event_type`.
#[must_use]
pub fn pattern_matches(pattern: &str, event_type: &str) -> bool {
    if let Some(prefix) = pattern.strip_suffix(".*") {
        // `org.person.*` matche `org.person.created`, `org.person.updated`…
        event_type.starts_with(prefix) && event_type.len() > prefix.len()
    } else if pattern == "*" {
        true
    } else {
        pattern == event_type
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pattern_exact_match() {
        assert!(pattern_matches("org.person.created", "org.person.created"));
        assert!(!pattern_matches("org.person.created", "org.person.updated"));
    }

    #[test]
    fn pattern_wildcard_suffix() {
        assert!(pattern_matches("org.person.*", "org.person.created"));
        assert!(pattern_matches("org.person.*", "org.person.updated"));
        assert!(!pattern_matches("org.person.*", "org.node.created"));
        assert!(!pattern_matches("org.person.*", "org.person")); // exact prefix non matching
    }

    #[test]
    fn pattern_global_wildcard() {
        assert!(pattern_matches("*", "org.anything"));
    }
}
