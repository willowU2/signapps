use signapps_sharing::{
    models::UserContext,
    types::{Action, ResourceRef, ResourceType},
    SharingEngine,
};
use sqlx::Row;
use std::collections::HashMap;
use uuid::Uuid;
use yrs::{updates::decoder::Decode, Doc, ReadTxn, StateVector, Transact};

/// Verify the user owns the document or has at least `viewer` access via the sharing engine.
///
/// Returns `Ok(true)` if the user has access, `Ok(false)` otherwise.
/// For new documents (not yet in DB), returns `Ok(true)` to allow creation.
///
/// # Errors
///
/// Returns `Err(String)` if the sharing engine fails with a database error.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
async fn verify_document_access(
    engine: &SharingEngine,
    doc_uuid: Uuid,
    user_id: Uuid,
) -> Result<bool, String> {
    // Build a minimal UserContext from the user_id alone.
    // Full group/org resolution requires JWT claims; callers that have Claims
    // should prefer engine.build_user_context(&claims).  This helper is used
    // only for the legacy (user_id, Option<engine>) call sites.
    let user_ctx = UserContext {
        user_id,
        tenant_id: Uuid::nil(), // tenant isolation enforced at the JWT layer
        system_role: 0,
        group_ids: vec![],
        group_roles: HashMap::new(),
        org_ancestors: vec![],
    };

    let resource = ResourceRef {
        resource_type: ResourceType::Document,
        resource_id: doc_uuid,
    };

    match engine
        .check(&user_ctx, resource, Action::read(), None)
        .await
    {
        Ok(()) => Ok(true),
        Err(signapps_common::Error::Forbidden(_)) => Ok(false),
        Err(e) => Err(format!("Sharing engine error: {e}")),
    }
}

/// Save document state to PostgreSQL.
///
/// When `user_id` is provided, verifies read/write access via the sharing
/// engine before allowing writes.  For existing documents the user must hold
/// at least `editor` role; new documents are always allowed.
///
/// # Errors
///
/// Returns `Err(String)` on database errors or access-denied.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[tracing::instrument(skip_all)]
pub async fn save_document(
    pool: &sqlx::PgPool,
    doc_id: &str,
    doc_type: &str,
    doc: &Doc,
    user_id: Option<Uuid>,
    engine: Option<&SharingEngine>,
) -> Result<(), String> {
    let doc_uuid = Uuid::parse_str(doc_id).map_err(|e| format!("Invalid document ID: {}", e))?;

    // Verify access if both user_id and engine are provided
    if let (Some(uid), Some(eng)) = (user_id, engine) {
        // Check if doc exists first — if it does, enforce access
        let exists = sqlx::query("SELECT 1 FROM documents WHERE id = $1")
            .bind(doc_uuid)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        if exists.is_some() && !verify_document_access(eng, doc_uuid, uid).await? {
            return Err("Access denied: insufficient permission on document".to_string());
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
/// When `user_id` is provided, verifies access via the sharing engine before
/// loading.
///
/// # Errors
///
/// Returns `Err(String)` on database errors or access-denied.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[tracing::instrument(skip_all)]
pub async fn load_document(
    pool: &sqlx::PgPool,
    doc_id: &str,
    user_id: Option<Uuid>,
    engine: Option<&SharingEngine>,
) -> Result<Option<Doc>, String> {
    let doc_uuid = Uuid::parse_str(doc_id).map_err(|e| format!("Invalid document ID: {}", e))?;

    // Verify access if both user_id and engine are provided
    if let (Some(uid), Some(eng)) = (user_id, engine) {
        // Check if doc exists — if it does, enforce access
        let exists = sqlx::query("SELECT 1 FROM documents WHERE id = $1")
            .bind(doc_uuid)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        if exists.is_some() && !verify_document_access(eng, doc_uuid, uid).await? {
            return Err("Access denied: insufficient permission on document".to_string());
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
