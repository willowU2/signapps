use tokio::sync::broadcast;
use uuid::Uuid;

/// Represents a connected client session (for future use)
#[derive(Clone)]
#[allow(dead_code)]
pub struct ClientSession {
    pub id: Uuid,
    pub doc_id: String,
    pub tx: broadcast::Sender<Vec<u8>>,
}

#[allow(dead_code)]
impl ClientSession {
    /// Create a new client session
    pub fn new(doc_id: String, tx: broadcast::Sender<Vec<u8>>) -> Self {
        Self {
            id: Uuid::new_v4(),
            doc_id,
            tx,
        }
    }

    /// Broadcast an update to all clients
    pub fn broadcast_update(
        &self,
        update: Vec<u8>,
    ) -> Result<(), broadcast::error::SendError<Vec<u8>>> {
        self.tx.send(update).map(|_| ())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_creation() {
        let (tx, _) = broadcast::channel(100);
        let session = ClientSession::new("doc-123".to_string(), tx);

        assert_eq!(session.doc_id, "doc-123");
    }
}
