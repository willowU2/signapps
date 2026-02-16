use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Document metadata stored in PostgreSQL (for future use)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct DocumentMetadata {
    pub id: Uuid,
    pub name: String,
    pub doc_type: String, // text, sheet, slide, board
    pub version: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Uuid,
}

#[allow(dead_code)]
impl DocumentMetadata {
    /// Create new document metadata
    pub fn new(id: Uuid, name: String, doc_type: String, created_by: Uuid) -> Self {
        let now = Utc::now();
        Self {
            id,
            name,
            doc_type,
            version: 0,
            created_at: now,
            updated_at: now,
            created_by,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_document_metadata_creation() {
        let user_id = Uuid::new_v4();
        let doc_id = Uuid::new_v4();
        let metadata = DocumentMetadata::new(doc_id, "Test Document".to_string(), "text".to_string(), user_id);

        assert_eq!(metadata.name, "Test Document");
        assert_eq!(metadata.doc_type, "text");
        assert_eq!(metadata.version, 0);
        assert_eq!(metadata.created_by, user_id);
    }
}
