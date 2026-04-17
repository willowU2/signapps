//! Models for Nexus AI CRM Hub.

use chrono::{DateTime, Utc};
use pgvector::Vector;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Représente une entité métier (BusinessEntity) au sein du hub Nexus.
/// 
/// Supporte les synchronisations CRDT (via jsonb) et l'analyse sémantique 
/// temps réel pour déduplication (via pgvector).
/// 
/// # Examples
/// 
/// ```
/// let entity = NexusEntity {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     name: "Odoo Inc".into(),
///     crdt_payload: serde_json::json!({}),
///     semantic_embedding: None,
///     created_at: chrono::Utc::now(),
///     updated_at: chrono::Utc::now(),
/// };
/// ```
/// 
/// # Panics
/// 
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct NexusEntity {
    /// Identifiant unique (UUID v4)
    pub id: Uuid,
    /// Identifiant du locataire/tenant
    pub tenant_id: Uuid,
    /// Nom de l'entité
    pub name: String,
    /// Payload CRDT sérialisé au format jsonb
    pub crdt_payload: serde_json::Value,
    /// Embedding sémantique généré (optionnel)
    #[cfg_attr(feature = "openapi", schema(value_type = Option<Vec<f32>>))]
    pub semantic_embedding: Option<Vector>,
    /// Date de création
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification
    pub updated_at: DateTime<Utc>,
}
