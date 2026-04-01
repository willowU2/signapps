//! # Inter-Service Event Bus
//!
//! Lightweight in-process event bus for microservice communication using
//! `tokio::sync::broadcast`. Provides a publish/subscribe mechanism for
//! domain events across services running in the same process.
//!
//! ## Usage
//!
//! ```rust,ignore
//! use signapps_common::events::{EventBus, DomainEvent};
//! use uuid::Uuid;
//!
//! let bus = EventBus::new(256);
//!
//! // Subscribe before publishing
//! let mut rx = bus.subscribe();
//!
//! // Publish an event
//! bus.publish(DomainEvent::UserCreated { id: Uuid::new_v4() });
//!
//! // Receive the event
//! let event = rx.recv().await.expect("channel should be open");
//! ```

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use uuid::Uuid;

/// Domain events emitted by SignApps services.
///
/// Each variant represents a meaningful state change in the system.
/// The `Custom` variant allows services to emit ad-hoc events without
/// modifying this enum.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum DomainEvent {
    // Document events
    /// A new document was created.
    DocumentCreated {
        /// Unique identifier of the new document.
        id: Uuid,
        /// User who created the document.
        user_id: Uuid,
    },
    /// An existing document's content or metadata was modified.
    DocumentUpdated {
        /// Unique identifier of the updated document.
        id: Uuid,
        /// User who performed the update.
        user_id: Uuid,
    },

    // File/storage events
    /// A file was successfully uploaded to storage.
    FileUploaded {
        /// Unique identifier of the uploaded file.
        id: Uuid,
        /// User who uploaded the file.
        user_id: Uuid,
        /// Size of the uploaded file in bytes.
        size: i64,
    },
    /// A file was removed from storage.
    FileDeleted {
        /// Unique identifier of the deleted file.
        id: Uuid,
        /// User who deleted the file.
        user_id: Uuid,
    },

    // User events
    /// A new user account was registered.
    UserCreated {
        /// Unique identifier of the new user.
        id: Uuid,
    },
    /// A user's profile or settings were modified.
    UserUpdated {
        /// Unique identifier of the updated user.
        id: Uuid,
    },

    // Calendar events
    /// A new event was added to a calendar.
    CalendarEventCreated {
        /// Unique identifier of the new calendar event.
        id: Uuid,
        /// User who created the calendar event.
        user_id: Uuid,
    },

    // Extensible catch-all for service-specific events
    /// Service-specific event that does not have a dedicated variant.
    Custom {
        /// Application-defined event type identifier (e.g. `"invoice.created"`).
        event_type: String,
        /// Arbitrary JSON payload for the event.
        payload: serde_json::Value,
    },
}

/// Envelope wrapping a [`DomainEvent`] with metadata.
///
/// Every published event is wrapped in an envelope that adds a unique ID
/// and a UTC timestamp, making events traceable and orderable.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventEnvelope {
    /// Unique identifier for this event instance.
    pub id: Uuid,
    /// When the event was published.
    pub timestamp: DateTime<Utc>,
    /// The domain event payload.
    pub event: DomainEvent,
}

/// In-process event bus built on [`tokio::sync::broadcast`].
///
/// The bus allows multiple producers and multiple consumers. Subscribers
/// that fall behind (i.e., the channel buffer is full) will lose the oldest
/// messages — this is acceptable for non-critical notifications. For
/// guaranteed delivery, events should be persisted to a database or
/// external message broker.
#[derive(Debug, Clone)]
pub struct EventBus {
    sender: broadcast::Sender<EventEnvelope>,
}

impl EventBus {
    /// Create a new event bus with the given channel capacity.
    ///
    /// A reasonable default is 256–1024 depending on expected throughput.
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self { sender }
    }

    /// Publish a domain event to all current subscribers.
    ///
    /// The event is wrapped in an [`EventEnvelope`] with a generated ID
    /// and the current UTC timestamp. If there are no active subscribers
    /// the event is silently dropped.
    pub fn publish(&self, event: DomainEvent) {
        let envelope = EventEnvelope {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            event,
        };

        // Ignore send errors — they only occur when there are no receivers,
        // which is a valid state (no service is listening yet).
        let _ = self.sender.send(envelope);
    }

    /// Subscribe to the event bus.
    ///
    /// Returns a receiver that will receive all events published *after*
    /// this call. Events published before subscribing are not replayed.
    pub fn subscribe(&self) -> broadcast::Receiver<EventEnvelope> {
        self.sender.subscribe()
    }

    /// Returns the current number of active subscribers.
    pub fn subscriber_count(&self) -> usize {
        self.sender.receiver_count()
    }
}

impl Default for EventBus {
    /// Creates an event bus with a default capacity of 256.
    fn default() -> Self {
        Self::new(256)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn publish_and_receive_event() {
        let bus = EventBus::new(16);
        let mut rx = bus.subscribe();

        let user_id = Uuid::new_v4();
        bus.publish(DomainEvent::UserCreated { id: user_id });

        let envelope = rx.recv().await.expect("should receive event");
        match envelope.event {
            DomainEvent::UserCreated { id } => assert_eq!(id, user_id),
            _ => panic!("unexpected event variant"),
        }
    }

    #[tokio::test]
    async fn multiple_subscribers_receive_same_event() {
        let bus = EventBus::new(16);
        let mut rx1 = bus.subscribe();
        let mut rx2 = bus.subscribe();

        let doc_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        bus.publish(DomainEvent::DocumentCreated {
            id: doc_id,
            user_id,
        });

        let e1 = rx1.recv().await.expect("rx1 should receive");
        let e2 = rx2.recv().await.expect("rx2 should receive");

        // Both envelopes share the same event ID
        assert_eq!(e1.id, e2.id);
    }

    #[tokio::test]
    async fn publish_without_subscribers_does_not_panic() {
        let bus = EventBus::new(16);
        // No subscribers — should not panic
        bus.publish(DomainEvent::UserCreated { id: Uuid::new_v4() });
    }

    #[test]
    fn event_serialization_roundtrip() {
        let event = DomainEvent::FileUploaded {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            size: 1024,
        };
        let json = serde_json::to_string(&event).expect("serialize");
        let deserialized: DomainEvent = serde_json::from_str(&json).expect("deserialize");
        match deserialized {
            DomainEvent::FileUploaded { size, .. } => assert_eq!(size, 1024),
            _ => panic!("unexpected variant after deserialization"),
        }
    }

    #[test]
    fn custom_event_serialization() {
        let event = DomainEvent::Custom {
            event_type: "test.happened".to_string(),
            payload: serde_json::json!({"key": "value"}),
        };
        let json = serde_json::to_string(&event).expect("serialize");
        let deserialized: DomainEvent = serde_json::from_str(&json).expect("deserialize");
        match deserialized {
            DomainEvent::Custom {
                event_type,
                payload,
            } => {
                assert_eq!(event_type, "test.happened");
                assert_eq!(payload["key"], "value");
            },
            _ => panic!("unexpected variant"),
        }
    }

    #[test]
    fn subscriber_count_tracks_receivers() {
        let bus = EventBus::new(16);
        assert_eq!(bus.subscriber_count(), 0);

        let _rx1 = bus.subscribe();
        assert_eq!(bus.subscriber_count(), 1);

        let _rx2 = bus.subscribe();
        assert_eq!(bus.subscriber_count(), 2);

        drop(_rx1);
        assert_eq!(bus.subscriber_count(), 1);
    }

    #[test]
    fn default_bus_has_capacity() {
        let bus = EventBus::default();
        assert_eq!(bus.subscriber_count(), 0);
        // Just verify it doesn't panic
        bus.publish(DomainEvent::UserCreated { id: Uuid::new_v4() });
    }
}
