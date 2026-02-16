use sqlx::PgPool;
use tracing::{debug, error};
use uuid::Uuid;
use yrs::Doc;

/// Save document state to PostgreSQL
pub async fn save_document(
    doc_id: &str,
    doc: &Doc,
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    let state_vector = doc.get_state_vector();
    let doc_binary = doc.encode_state_as_update(&state_vector);

    let doc_uuid = Uuid::parse_str(doc_id)
        .map_err(|e| sqlx::Error::Encode(Box::new(e)))?;

    sqlx::query!(
        r#"
        INSERT INTO documents (id, doc_binary, version, created_at, updated_at)
        VALUES ($1, $2, 0, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE
        SET doc_binary = $2, updated_at = NOW(), version = documents.version + 1
        "#,
        doc_uuid,
        &doc_binary
    )
    .execute(pool)
    .await?;

    debug!(doc_id = %doc_id, "Document persisted to PostgreSQL");

    Ok(())
}

/// Load document state from PostgreSQL
pub async fn load_document(
    doc_id: &str,
    pool: &PgPool,
) -> Result<Option<Doc>, sqlx::Error> {
    let doc_uuid = Uuid::parse_str(doc_id)
        .map_err(|e| sqlx::Error::Encode(Box::new(e)))?;

    let result = sqlx::query!("SELECT doc_binary FROM documents WHERE id = $1", doc_uuid)
        .fetch_optional(pool)
        .await?;

    if let Some(row) = result {
        let mut doc = Doc::new();
        doc.transact_mut()
            .apply_update_from_binary(row.doc_binary)
            .map_err(|e| {
                error!("Failed to apply stored update: {:?}", e);
                sqlx::Error::Decode(Box::new(e))
            })?;

        debug!(doc_id = %doc_id, "Document loaded from PostgreSQL");
        Ok(Some(doc))
    } else {
        debug!(doc_id = %doc_id, "Document not found in database");
        Ok(None)
    }
}

/// Record individual update for audit trail
pub async fn log_update(
    doc_id: &str,
    update: &[u8],
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    let doc_uuid = Uuid::parse_str(doc_id)
        .map_err(|e| sqlx::Error::Encode(Box::new(e)))?;

    sqlx::query!(
        r#"
        INSERT INTO document_updates (doc_id, update, timestamp)
        VALUES ($1, $2, NOW())
        "#,
        doc_uuid,
        update
    )
    .execute(pool)
    .await?;

    debug!(doc_id = %doc_id, "Update logged to audit trail");

    Ok(())
}
