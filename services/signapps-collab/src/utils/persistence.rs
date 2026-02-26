use sqlx::PgPool;
use tracing::error;
use yrs::updates::decoder::Decode;
use yrs::{Doc, Transact, Update};

/// Load document from database
pub async fn load_document(pool: &PgPool, doc_id: &str) -> anyhow::Result<Doc> {
    let doc_uuid = uuid::Uuid::parse_str(doc_id)?;

    // Check if document exists
    let exists = sqlx::query("SELECT id FROM documents WHERE id = $1")
        .bind(doc_uuid)
        .fetch_optional(pool)
        .await?;

    if exists.is_none() {
        // Create new document if it doesn't exist (e.g. new chat room or doc)
        // Default to 'text' type for now, or infer from somewhere
        // For chat, we might want to ensure it's created as 'chat'
        // But here we just load. Creating should happen elsewhere or implicitly.

        // Implicit creation for now
        sqlx::query(
            "INSERT INTO documents (id, name, doc_type, doc_binary) VALUES ($1, $2, 'text', $3)",
        )
        .bind(doc_uuid)
        .bind("Untitled")
        .bind(&[] as &[u8])
        .execute(pool)
        .await?;
    }

    #[derive(sqlx::FromRow)]
    struct UpdateRecord {
        update: Vec<u8>,
    }

    // Load updates
    let updates = sqlx::query_as::<_, UpdateRecord>(
        "SELECT update FROM document_updates WHERE doc_id = $1 ORDER BY id ASC",
    )
    .bind(doc_uuid)
    .fetch_all(pool)
    .await?;

    let doc = Doc::new();

    {
        let mut txn = doc.transact_mut();
        for record in updates {
            match Update::decode_v1(&record.update) {
                Ok(update) => {
                    txn.apply_update(update);
                },
                Err(e) => error!("Failed to decode update for doc {}: {}", doc_id, e),
            }
        }
    }

    Ok(doc)
}

/// Save document update to database
pub async fn save_update(pool: &PgPool, doc_id: &str, update: Vec<u8>) -> anyhow::Result<()> {
    let doc_uuid = uuid::Uuid::parse_str(doc_id)?;

    sqlx::query("INSERT INTO document_updates (doc_id, update) VALUES ($1, $2)")
        .bind(doc_uuid)
        .bind(update)
        .execute(pool)
        .await?;

    Ok(())
}
