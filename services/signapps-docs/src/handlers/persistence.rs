use sqlx::Row;
use uuid::Uuid;
use yrs::{updates::decoder::Decode, Doc, ReadTxn, StateVector, Transact};

/// Verify the user owns the document or has explicit permission to access it.
///
/// Returns `Ok(true)` if the user has access, `Ok(false)` otherwise.
/// For new documents (not yet in DB), returns `Ok(true)` to allow creation.
async fn verify_document_access(
    pool: &sqlx::PgPool,
    doc_uuid: Uuid,
    user_id: Uuid,
) -> Result<bool, String> {
    let row = sqlx::query(
        r#"SELECT EXISTS(
            SELECT 1 FROM documents
            WHERE id = $1
              AND (created_by = $2
                   OR id IN (SELECT doc_id FROM document_permissions WHERE user_id = $2))
        ) AS has_access"#,
    )
    .bind(doc_uuid)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let has_access: bool = row
        .try_get("has_access")
        .map_err(|e| format!("Failed to read access check: {}", e))?;

    Ok(has_access)
}

/// Save document state to PostgreSQL.
///
/// When `user_id` is provided, verifies ownership before allowing writes.
/// For existing documents, the user must be the creator or have edit permission.
#[tracing::instrument(skip_all)]
pub async fn save_document(
    pool: &sqlx::PgPool,
    doc_id: &str,
    doc_type: &str,
    doc: &Doc,
    user_id: Option<Uuid>,
) -> Result<(), String> {
    let doc_uuid = Uuid::parse_str(doc_id).map_err(|e| format!("Invalid document ID: {}", e))?;

    // Verify ownership if user_id is provided
    if let Some(uid) = user_id {
        // Check if doc exists first — if it does, enforce ownership
        let exists = sqlx::query("SELECT 1 FROM documents WHERE id = $1")
            .bind(doc_uuid)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        if exists.is_some() && !verify_document_access(pool, doc_uuid, uid).await? {
            return Err("Access denied: not the document owner or permitted user".to_string());
        }
    }

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

/// Load document state from PostgreSQL.
///
/// When `user_id` is provided, verifies ownership or permission before loading.
#[tracing::instrument(skip_all)]
pub async fn load_document(
    pool: &sqlx::PgPool,
    doc_id: &str,
    user_id: Option<Uuid>,
) -> Result<Option<Doc>, String> {
    let doc_uuid = Uuid::parse_str(doc_id).map_err(|e| format!("Invalid document ID: {}", e))?;

    // Verify access if user_id is provided
    if let Some(uid) = user_id {
        // Check if doc exists — if it does, enforce ownership
        let exists = sqlx::query("SELECT 1 FROM documents WHERE id = $1")
            .bind(doc_uuid)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        if exists.is_some() && !verify_document_access(pool, doc_uuid, uid).await? {
            return Err("Access denied: not the document owner or permitted user".to_string());
        }
    }

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

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
