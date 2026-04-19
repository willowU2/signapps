//! Canonical `org_provisioning_log` table — journal of cross-service
//! provisioning fan-out.
//!
//! When a new [`Person`](super::person::Person) is created, the W5
//! dispatcher emits an `org.person.provisioning_requested` event on
//! the `PgEventBus`; each consumer service writes one row here per
//! attempt with the resulting status.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// One row in the cross-service provisioning log.
///
/// `topic` is the event topic that triggered the work (e.g.
/// `org.person.provisioning_requested`). `service` is the consumer
/// (e.g. `mail`, `chat`, `drive`). `status` is one of `pending`,
/// `ok`, `error`.
///
/// # Examples
///
/// ```ignore
/// let log = ProvisioningLog {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     person_id: uuid::Uuid::new_v4(),
///     topic: "org.person.provisioning_requested".into(),
///     service: "mail".into(),
///     status: "ok".into(),
///     error: None,
///     attempts: 1,
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
pub struct ProvisioningLog {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant concerné.
    pub tenant_id: Uuid,
    /// Personne provisionnée.
    pub person_id: Uuid,
    /// Topic d'événement (`org.person.provisioning_requested`, ...).
    pub topic: String,
    /// Service consommateur (`mail`, `chat`, `drive`, ...).
    pub service: String,
    /// Status (`pending` | `ok` | `error`).
    pub status: String,
    /// Message d'erreur quand `status = error`.
    pub error: Option<String>,
    /// Nombre de tentatives accumulées.
    pub attempts: i32,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
}
