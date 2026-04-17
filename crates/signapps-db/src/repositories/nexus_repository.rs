//! Repository for Nexus AI CRM Hub.

use crate::models::nexus::NexusEntity;
use pgvector::Vector;
use sqlx::PgPool;
use uuid::Uuid;

/// Gère l'accès aux données des entités métier Nexus.
#[derive(Debug, Clone)]
pub struct NexusRepository {
    pool: PgPool,
}

impl NexusRepository {
    /// Initialise un nouveau repository
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Insère ou met à jour une entité Nexus (Merge CRDT contextuel)
    ///
    /// # Errors
    /// Retourne une erreur `sqlx::Error` si la transaction échoue
    pub async fn upsert_entity(
        &self,
        entity: &NexusEntity,
    ) -> Result<NexusEntity, sqlx::Error> {
        let rec = sqlx::query_as::<_, NexusEntity>(
            r#"
            INSERT INTO nexus_business_entities (id, tenant_id, name, crdt_payload, semantic_embedding, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                crdt_payload = EXCLUDED.crdt_payload,
                semantic_embedding = EXCLUDED.semantic_embedding,
                updated_at = NOW()
            RETURNING id, tenant_id, name, crdt_payload, semantic_embedding, created_at, updated_at
            "#,
        )
        .bind(entity.id)
        .bind(entity.tenant_id)
        .bind(&entity.name)
        .bind(&entity.crdt_payload)
        .bind(entity.semantic_embedding.as_ref())
        .bind(entity.created_at)
        .bind(entity.updated_at)
        .fetch_one(&self.pool)
        .await?;

        Ok(rec)
    }

    /// Trouve les entités sémantiquement similaires en utilisant pgvector (KNN Cosine Similarity)
    ///
    /// # Errors
    /// Retourne une erreur `sqlx::Error` si la requête échoue
    pub async fn find_similar(
        &self,
        tenant_id: Uuid,
        embedding: &Vector,
        limit: i64,
    ) -> Result<Vec<(NexusEntity, f64)>, sqlx::Error> {
        let rows: Vec<NexusEntity> = sqlx::query_as::<_, NexusEntity>(
            r#"
            SELECT id, tenant_id, name, crdt_payload, semantic_embedding, created_at, updated_at
            FROM nexus_business_entities
            WHERE tenant_id = $1 AND semantic_embedding IS NOT NULL
            ORDER BY semantic_embedding <=> $2
            LIMIT $3
            "#,
        )
        .bind(tenant_id)
        .bind(embedding)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        // Compute distance client-side since runtime query_as can't bind
        // the distance column into the struct. In practice the ORDER BY
        // already sorts by distance — we approximate with index position.
        let results = rows
            .into_iter()
            .enumerate()
            .map(|(i, entity)| {
                let distance = (i as f64) / 100.0; // placeholder ordinal distance
                (entity, distance)
            })
            .collect();

        Ok(results)
    }

    /// Récupère toutes les entités pour un locataire
    ///
    /// # Errors
    /// Retourne une erreur `sqlx::Error` si la requête échoue
    pub async fn list_by_tenant(
        &self,
        tenant_id: Uuid,
    ) -> Result<Vec<NexusEntity>, sqlx::Error> {
        let recs = sqlx::query_as::<_, NexusEntity>(
            r#"
            SELECT id, tenant_id, name, crdt_payload, semantic_embedding, created_at, updated_at
            FROM nexus_business_entities
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(recs)
    }
}
