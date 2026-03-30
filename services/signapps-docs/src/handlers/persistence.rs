use sqlx::Row;
use uuid::Uuid;
use yrs::{updates::decoder::Decode, Doc, ReadTxn, StateVector, Transact};

/// Save document state to PostgreSQL
#[tracing::instrument(skip_all)]
pub async fn save_document(
    pool: &sqlx::PgPool,
    doc_id: &str,
    doc_type: &str,
    doc: &Doc,
) -> Result<(), String> {
    let doc_uuid = Uuid::parse_str(doc_id).map_err(|e| format!("Invalid document ID: {}", e))?;

    // Encode the entire document state to binary
    let doc_binary = doc
        .transact()
        .encode_state_as_update_v1(&StateVector::default());

    // Upsert the document
    sqlx::query(
        r#"
        INSERT INTO documents (id, doc_type, doc_binary, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (id) 
        DO UPDATE SET 
            doc_binary = $3,
            updated_at = NOW()
        "#,
    )
    .bind(doc_uuid)
    .bind(doc_type)
    .bind(doc_binary)
    .execute(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(())
}

/// Load document state from PostgreSQL
#[tracing::instrument(skip_all)]
pub async fn load_document(pool: &sqlx::PgPool, doc_id: &str) -> Result<Option<Doc>, String> {
    let doc_uuid = Uuid::parse_str(doc_id).map_err(|e| format!("Invalid document ID: {}", e))?;

    let row = sqlx::query("SELECT doc_binary FROM documents WHERE id = $1")
        .bind(doc_uuid)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if let Some(row) = row {
        let doc_binary: Vec<u8> = row
            .try_get("doc_binary")
            .map_err(|e| format!("Failed to read binary: {}", e))?;

        let doc = Doc::new();
        let mut txn = doc.transact_mut();
        txn.apply_update(yrs::Update::decode_v1(&doc_binary).map_err(|e| e.to_string())?);
        drop(txn);

        Ok(Some(doc))
    } else {
        Ok(None)
    }
}
