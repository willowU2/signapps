//! Universal inline comments system with @mentions.
//!
//! Provides a generic, in-memory comment store usable by any service.
//! Comments are keyed by `entity_type:entity_id` so any domain object
//! (document, task, calendar event, etc.) can have a comment thread.
//!
//! Features:
//! - Threaded replies via `parent_id`
//! - `@mention` extraction (UUIDs or usernames)
//! - Emoji reactions per comment
//! - Resolve/unresolve for review workflows

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

// =============================================================================
// Comment
// =============================================================================

/// A single comment attached to an entity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Comment {
    /// Unique identifier.
    pub id: Uuid,
    /// Type of the parent entity (e.g. "document", "task", "event").
    pub entity_type: String,
    /// Identifier of the parent entity.
    pub entity_id: String,
    /// User who authored the comment.
    pub author_id: Uuid,
    /// Raw comment content (may contain `@mention` tokens).
    pub content: String,
    /// User IDs extracted from `@mentions` in content.
    pub mentions: Vec<Uuid>,
    /// If this is a reply, the parent comment ID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<Uuid>,
    /// Whether this comment thread has been marked as resolved.
    pub resolved: bool,
    /// Emoji reactions: emoji string -> list of user IDs who reacted.
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub reactions: HashMap<String, Vec<Uuid>>,
    /// When the comment was created.
    pub created_at: DateTime<Utc>,
    /// When the comment was last updated.
    pub updated_at: DateTime<Utc>,
}

// =============================================================================
// Mention extraction
// =============================================================================

/// Extract `@mentions` from comment content.
///
/// Supports two forms:
/// - `@<uuid>` — e.g. `@550e8400-e29b-41d4-a716-446655440000`
/// - `@<username>` — e.g. `@alice` (returned only as the username string)
///
/// Only UUID mentions are returned; username mentions are intentionally
/// excluded from the `Vec<Uuid>` so that the caller can resolve them
/// through its own user lookup.
pub fn extract_mentions(content: &str) -> Vec<Uuid> {
    let mut mentions = Vec::new();
    let bytes = content.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        if bytes[i] == b'@' {
            // Try to parse a UUID starting right after '@'.
            // UUIDs are 36 chars: 8-4-4-4-12
            let start = i + 1;
            if start + 36 <= len {
                let candidate = &content[start..start + 36];
                if let Ok(uuid) = Uuid::try_parse(candidate) {
                    if !mentions.contains(&uuid) {
                        mentions.push(uuid);
                    }
                    i = start + 36;
                    continue;
                }
            }
        }
        i += 1;
    }

    mentions
}

// =============================================================================
// CommentStore (in-memory)
// =============================================================================

/// Build the composite key used by `CommentStore`.
fn store_key(entity_type: &str, entity_id: &str) -> String {
    format!("{entity_type}:{entity_id}")
}

/// Thread-safe, in-memory comment store keyed by `entity_type:entity_id`.
#[derive(Debug, Clone)]
pub struct CommentStore {
    data: Arc<DashMap<String, Vec<Comment>>>,
}

impl Default for CommentStore {
    fn default() -> Self {
        Self::new()
    }
}

impl CommentStore {
    /// Create an empty comment store.
    pub fn new() -> Self {
        Self {
            data: Arc::new(DashMap::new()),
        }
    }

    /// Add a new top-level comment to an entity.
    ///
    /// `@mentions` are automatically extracted from `content`.
    pub fn add_comment(
        &self,
        entity_type: &str,
        entity_id: &str,
        author_id: Uuid,
        content: String,
    ) -> Comment {
        let now = Utc::now();
        let mentions = extract_mentions(&content);
        let comment = Comment {
            id: Uuid::new_v4(),
            entity_type: entity_type.to_string(),
            entity_id: entity_id.to_string(),
            author_id,
            content,
            mentions,
            parent_id: None,
            resolved: false,
            reactions: HashMap::new(),
            created_at: now,
            updated_at: now,
        };

        self.data
            .entry(store_key(entity_type, entity_id))
            .or_default()
            .push(comment.clone());

        comment
    }

    /// List all comments for a given entity, ordered by creation time.
    pub fn list_comments(&self, entity_type: &str, entity_id: &str) -> Vec<Comment> {
        self.data
            .get(&store_key(entity_type, entity_id))
            .map(|v| v.clone())
            .unwrap_or_default()
    }

    /// Reply to an existing comment (creates a threaded child).
    ///
    /// Returns `None` if the parent comment is not found.
    pub fn reply_to(
        &self,
        entity_type: &str,
        entity_id: &str,
        parent_id: Uuid,
        author_id: Uuid,
        content: String,
    ) -> Option<Comment> {
        let key = store_key(entity_type, entity_id);
        let entry = self.data.get(&key)?;
        let comments = entry.value();

        // Verify parent exists in this entity's comments.
        if !comments.iter().any(|c| c.id == parent_id) {
            return None;
        }

        let now = Utc::now();
        let mentions = extract_mentions(&content);
        let comment = Comment {
            id: Uuid::new_v4(),
            entity_type: entity_type.to_string(),
            entity_id: entity_id.to_string(),
            author_id,
            content,
            mentions,
            parent_id: Some(parent_id),
            resolved: false,
            reactions: HashMap::new(),
            created_at: now,
            updated_at: now,
        };

        drop(entry);

        self.data.entry(key).or_default().push(comment.clone());

        Some(comment)
    }

    /// Mark a comment as resolved (or unresolved).
    ///
    /// Returns `true` if the comment was found and updated.
    pub fn resolve(
        &self,
        entity_type: &str,
        entity_id: &str,
        comment_id: Uuid,
        resolved: bool,
    ) -> bool {
        let key = store_key(entity_type, entity_id);
        if let Some(mut entry) = self.data.get_mut(&key) {
            if let Some(comment) = entry.value_mut().iter_mut().find(|c| c.id == comment_id) {
                comment.resolved = resolved;
                comment.updated_at = Utc::now();
                return true;
            }
        }
        false
    }

    /// Toggle an emoji reaction on a comment.
    ///
    /// If the user already reacted with the same emoji, the reaction is removed.
    /// Returns `true` if the comment was found.
    pub fn add_reaction(
        &self,
        entity_type: &str,
        entity_id: &str,
        comment_id: Uuid,
        emoji: &str,
        user_id: Uuid,
    ) -> bool {
        let key = store_key(entity_type, entity_id);
        if let Some(mut entry) = self.data.get_mut(&key) {
            if let Some(comment) = entry.value_mut().iter_mut().find(|c| c.id == comment_id) {
                let users = comment.reactions.entry(emoji.to_string()).or_default();
                if let Some(pos) = users.iter().position(|u| *u == user_id) {
                    users.remove(pos);
                    if users.is_empty() {
                        comment.reactions.remove(emoji);
                    }
                } else {
                    users.push(user_id);
                }
                comment.updated_at = Utc::now();
                return true;
            }
        }
        false
    }

    /// Delete a comment by ID.
    ///
    /// Returns the removed comment, or `None` if not found.
    pub fn delete(&self, entity_type: &str, entity_id: &str, comment_id: Uuid) -> Option<Comment> {
        let key = store_key(entity_type, entity_id);
        if let Some(mut entry) = self.data.get_mut(&key) {
            let comments = entry.value_mut();
            if let Some(pos) = comments.iter().position(|c| c.id == comment_id) {
                return Some(comments.remove(pos));
            }
        }
        None
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_mentions_uuid() {
        let uuid1 = Uuid::new_v4();
        let uuid2 = Uuid::new_v4();
        let content = format!("Hey @{uuid1} and @{uuid2}, please review.");
        let mentions = extract_mentions(&content);
        assert_eq!(mentions.len(), 2);
        assert!(mentions.contains(&uuid1));
        assert!(mentions.contains(&uuid2));
    }

    #[test]
    fn test_extract_mentions_dedup() {
        let uuid = Uuid::new_v4();
        let content = format!("@{uuid} @{uuid} duplicate");
        let mentions = extract_mentions(&content);
        assert_eq!(mentions.len(), 1);
    }

    #[test]
    fn test_extract_mentions_no_match() {
        let mentions = extract_mentions("No mentions here @alice or @bob.");
        assert!(mentions.is_empty());
    }

    #[test]
    fn test_add_and_list_comments() {
        let store = CommentStore::new();
        let author = Uuid::new_v4();

        store.add_comment("document", "doc-1", author, "First comment".into());
        store.add_comment("document", "doc-1", author, "Second comment".into());

        let comments = store.list_comments("document", "doc-1");
        assert_eq!(comments.len(), 2);
        assert_eq!(comments[0].content, "First comment");
        assert_eq!(comments[1].content, "Second comment");
    }

    #[test]
    fn test_list_empty() {
        let store = CommentStore::new();
        let comments = store.list_comments("task", "nonexistent");
        assert!(comments.is_empty());
    }

    #[test]
    fn test_reply_to() {
        let store = CommentStore::new();
        let author = Uuid::new_v4();

        let parent = store.add_comment("document", "doc-1", author, "Parent".into());
        let reply = store
            .reply_to("document", "doc-1", parent.id, author, "Reply".into())
            .expect("reply should succeed");

        assert_eq!(reply.parent_id, Some(parent.id));

        let all = store.list_comments("document", "doc-1");
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn test_reply_to_nonexistent_parent() {
        let store = CommentStore::new();
        let author = Uuid::new_v4();
        store.add_comment("document", "doc-1", author, "Root".into());

        let result = store.reply_to("document", "doc-1", Uuid::new_v4(), author, "Orphan".into());
        assert!(result.is_none());
    }

    #[test]
    fn test_resolve() {
        let store = CommentStore::new();
        let author = Uuid::new_v4();

        let comment = store.add_comment("task", "t-1", author, "Review this".into());
        assert!(!comment.resolved);

        assert!(store.resolve("task", "t-1", comment.id, true));

        let comments = store.list_comments("task", "t-1");
        assert!(comments[0].resolved);
    }

    #[test]
    fn test_add_reaction_toggle() {
        let store = CommentStore::new();
        let author = Uuid::new_v4();
        let reactor = Uuid::new_v4();

        let comment = store.add_comment("document", "doc-1", author, "Nice work".into());

        // Add reaction
        assert!(store.add_reaction("document", "doc-1", comment.id, "👍", reactor));
        let comments = store.list_comments("document", "doc-1");
        assert_eq!(
            comments[0]
                .reactions
                .get("👍")
                .expect("reaction key present")
                .len(),
            1
        );

        // Toggle off
        assert!(store.add_reaction("document", "doc-1", comment.id, "👍", reactor));
        let comments = store.list_comments("document", "doc-1");
        assert!(!comments[0].reactions.contains_key("👍"));
    }

    #[test]
    fn test_delete() {
        let store = CommentStore::new();
        let author = Uuid::new_v4();

        let comment = store.add_comment("event", "ev-1", author, "Delete me".into());
        assert!(store.delete("event", "ev-1", comment.id).is_some());
        assert!(store.list_comments("event", "ev-1").is_empty());
    }

    #[test]
    fn test_delete_nonexistent() {
        let store = CommentStore::new();
        assert!(store.delete("event", "ev-1", Uuid::new_v4()).is_none());
    }

    #[test]
    fn test_mentions_extracted_on_add() {
        let store = CommentStore::new();
        let author = Uuid::new_v4();
        let mentioned = Uuid::new_v4();

        let comment = store.add_comment(
            "document",
            "doc-1",
            author,
            format!("cc @{mentioned} for review"),
        );

        assert_eq!(comment.mentions.len(), 1);
        assert_eq!(comment.mentions[0], mentioned);
    }

    #[test]
    fn test_cross_entity_isolation() {
        let store = CommentStore::new();
        let author = Uuid::new_v4();

        store.add_comment("document", "doc-1", author, "Doc comment".into());
        store.add_comment("task", "task-1", author, "Task comment".into());

        assert_eq!(store.list_comments("document", "doc-1").len(), 1);
        assert_eq!(store.list_comments("task", "task-1").len(), 1);
    }
}
