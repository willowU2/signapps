use tokio::sync::broadcast;
use uuid::Uuid;

#[derive(Clone, Debug)]
pub enum BroadcastMessage {
    Binary(Vec<u8>),
    Text(String),
}

/// Represents a connected client session
#[derive(Clone)]
pub struct ClientSession {
    pub id: Uuid,
    pub doc_id: String,
    pub tx: broadcast::Sender<BroadcastMessage>,
}

impl ClientSession {
    /// Create a new client session
    pub fn new(doc_id: String, tx: broadcast::Sender<BroadcastMessage>) -> Self {
        Self {
            id: Uuid::new_v4(),
            doc_id,
            tx,
        }
    }

    /// Broadcast an update to all clients
    pub fn broadcast_update(
        &self,
        msg: BroadcastMessage,
    ) -> Result<usize, broadcast::error::SendError<BroadcastMessage>> {
        self.tx.send(msg)
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
