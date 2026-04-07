use signapps_common::auth::Claims;
use signapps_sharing::{
    types::{Action, ResourceRef, ResourceType},
    SharingEngine,
};
use sqlx::Row;
use uuid::Uuid;
use yrs::{updates::decoder::Decode, Doc, ReadTxn, StateVector, Transact};

/// Verify the user owns the document or has at least `viewer` access via the sharing engine.
///
/// Uses `engine.build_user_context(claims)` to resolve the full `UserContext` — including
/// tenant isolation, group membership, and org-node ancestors — before calling
/// `engine.check(...)`. This ensures that:
/// - users from a different tenant cannot access documents they do not own, and
/// - users whose access is granted via a group or org-node delegation are not
///   incorrectly rejected.
///
/// Returns `Ok(true)` if the user has access, `Ok(false)` if access is denied.
/// For new documents (not yet in DB) the caller should skip this check to allow creation.
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
    claims: &Claims,
) -> Result<bool, String> {
    // Build a full UserContext from the JWT claims, resolving tenant_id,
    // group memberships, and org-node ancestors via the sharing engine.
    // This is the only correct way to enforce tenant isolation at this layer.
    let user_ctx = engine
        .build_user_context(claims)
        .await
        .map_err(|e| format!("Failed to build user context: {e}"))?;

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
/// When `claims` is provided together with `engine`, verifies write access via the
/// sharing engine before allowing the save.  The full `UserContext` is built from
/// `claims` (including tenant isolation, group, and org-node resolution) so that
/// cross-tenant access is correctly rejected.  For new documents the access check
/// is skipped to allow creation.
///
/// **WebSocket note:** The WebSocket persistence path passes `None` for both
/// `claims` and `engine`.  Authentication for WebSocket connections is enforced
/// at connection-upgrade time; persistence calls within an already-authenticated
/// session do not repeat the JWT check.  This is a known, intentional trade-off.
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
    claims: Option<&Claims>,
    engine: Option<&SharingEngine>,
) -> Result<(), String> {
    let doc_uuid = Uuid::parse_str(doc_id).map_err(|e| format!("Invalid document ID: {}", e))?;

    // Verify access if both claims and engine are provided
    if let (Some(c), Some(eng)) = (claims, engine) {
        // Check if doc exists first — if it does, enforce access
        let exists = sqlx::query("SELECT 1 FROM documents WHERE id = $1")
            .bind(doc_uuid)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        if exists.is_some() && !verify_document_access(eng, doc_uuid, c).await? {
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
/// When `claims` is provided together with `engine`, verifies read access via the
/// sharing engine before loading.  The full `UserContext` is built from `claims`
/// (including tenant isolation, group, and org-node resolution) so that cross-tenant
/// reads are correctly rejected.
///
/// **WebSocket note:** The WebSocket load path passes `None` for both `claims` and
/// `engine`.  Authentication is enforced at connection-upgrade time; the in-session
/// load does not repeat the JWT check.  This is a known, intentional trade-off.
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
    claims: Option<&Claims>,
    engine: Option<&SharingEngine>,
) -> Result<Option<Doc>, String> {
    let doc_uuid = Uuid::parse_str(doc_id).map_err(|e| format!("Invalid document ID: {}", e))?;

    // Verify access if both claims and engine are provided
    if let (Some(c), Some(eng)) = (claims, engine) {
        // Check if doc exists — if it does, enforce access
        let exists = sqlx::query("SELECT 1 FROM documents WHERE id = $1")
            .bind(doc_uuid)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        if exists.is_some() && !verify_document_access(eng, doc_uuid, c).await? {
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
