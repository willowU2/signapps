//! Comment handling for document conversion.

use serde::{Deserialize, Serialize};

/// A comment in a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Comment {
    /// Unique identifier
    pub id: String,
    /// Author name
    pub author: String,
    /// Author identifier
    pub author_id: String,
    /// Comment content
    pub content: String,
    /// Creation timestamp (ISO 8601)
    pub created_at: String,
    /// Whether the comment is resolved
    pub resolved: bool,
    /// Replies to this comment
    pub replies: Vec<CommentReply>,
}

/// A reply to a comment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentReply {
    /// Unique identifier
    pub id: String,
    /// Author name
    pub author: String,
    /// Author identifier
    pub author_id: String,
    /// Reply content
    pub content: String,
    /// Creation timestamp (ISO 8601)
    pub created_at: String,
}

/// Comment with position information for export
#[derive(Debug, Clone)]
pub struct PositionedComment {
    /// The comment data
    pub comment: Comment,
    /// Start position in document (character offset)
    pub start: usize,
    /// End position in document (character offset)
    pub end: usize,
}

/// Extract comments from Tiptap JSON
pub fn extract_comments_from_tiptap(json: &serde_json::Value) -> Vec<PositionedComment> {
    let mut comments = Vec::new();
    let mut current_pos = 0;

    extract_comments_recursive(json, &mut comments, &mut current_pos);

    comments
}

fn extract_comments_recursive(
    json: &serde_json::Value,
    comments: &mut Vec<PositionedComment>,
    current_pos: &mut usize,
) {
    if let Some(obj) = json.as_object() {
        // Check if this is a text node with comment marks
        if obj.get("type").and_then(|t| t.as_str()) == Some("text") {
            let text_len = obj
                .get("text")
                .and_then(|t| t.as_str())
                .map(|t| t.len())
                .unwrap_or(0);

            // Check for comment marks
            if let Some(marks) = obj.get("marks").and_then(|m| m.as_array()) {
                for mark in marks {
                    if mark.get("type").and_then(|t| t.as_str()) == Some("comment") {
                        if let Some(attrs) = mark.get("attrs") {
                            if let Some(comment_id) = attrs.get("commentId").and_then(|c| c.as_str())
                            {
                                // Create a placeholder comment - actual data would come from frontend
                                let comment = Comment {
                                    id: comment_id.to_string(),
                                    author: "Unknown".to_string(),
                                    author_id: "unknown".to_string(),
                                    content: "Comment".to_string(),
                                    created_at: chrono::Utc::now().to_rfc3339(),
                                    resolved: false,
                                    replies: vec![],
                                };

                                comments.push(PositionedComment {
                                    comment,
                                    start: *current_pos,
                                    end: *current_pos + text_len,
                                });
                            }
                        }
                    }
                }
            }

            *current_pos += text_len;
        }

        // Process content array
        if let Some(content) = obj.get("content").and_then(|c| c.as_array()) {
            for child in content {
                extract_comments_recursive(child, comments, current_pos);
            }
        }
    }
}

/// Merge comments from external source with extracted positions
pub fn merge_comments(
    extracted: Vec<PositionedComment>,
    external_comments: &[Comment],
) -> Vec<PositionedComment> {
    extracted
        .into_iter()
        .map(|mut pc| {
            // Find matching comment from external source
            if let Some(external) = external_comments.iter().find(|c| c.id == pc.comment.id) {
                pc.comment = external.clone();
            }
            pc
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_comments() {
        let json = serde_json::json!({
            "type": "doc",
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "text": "Hello",
                    "marks": [{
                        "type": "comment",
                        "attrs": { "commentId": "comment-1" }
                    }]
                }, {
                    "type": "text",
                    "text": " World"
                }]
            }]
        });

        let comments = extract_comments_from_tiptap(&json);
        assert_eq!(comments.len(), 1);
        assert_eq!(comments[0].comment.id, "comment-1");
        assert_eq!(comments[0].start, 0);
        assert_eq!(comments[0].end, 5);
    }
}
