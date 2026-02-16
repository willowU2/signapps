use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Document metadata stored in PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub id: Uuid,
    pub name: String,
    pub version: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Uuid,
}

impl DocumentMetadata {
    /// Create new document metadata
    pub fn new(id: Uuid, name: String, created_by: Uuid) -> Self {
        let now = Utc::now();
        Self {
            id,
            name,
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
        let metadata = DocumentMetadata::new(doc_id, "Test Document".to_string(), user_id);

        assert_eq!(metadata.name, "Test Document");
        assert_eq!(metadata.version, 0);
        assert_eq!(metadata.created_by, user_id);
    }
}
