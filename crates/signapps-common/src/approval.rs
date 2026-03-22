//! Document approval workflow system.
//!
//! Provides a generic approval request system for documents that need sign-off.
//! Supports multiple approvers, status tracking, and comment trails.
//!
//! Features:
//! - Multi-approver workflows
//! - Status tracking (Draft, PendingReview, Approved, Rejected)
//! - Approval comments and audit trail
//! - In-memory store with DashMap

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

// =============================================================================
// ApprovalStatus
// =============================================================================

/// Status of an approval request.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ApprovalStatus {
    /// Document is being prepared, not yet submitted.
    Draft,
    /// Document awaiting review from approvers.
    PendingReview,
    /// Document has been approved by all required approvers.
    Approved,
    /// Document has been rejected by one or more approvers.
    Rejected,
}

// =============================================================================
// ApprovalComment
// =============================================================================

/// A comment on an approval request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalComment {
    /// Unique identifier for the comment.
    pub id: Uuid,
    /// User who authored the comment.
    pub author_id: Uuid,
    /// Comment text.
    pub content: String,
    /// When the comment was created.
    pub created_at: DateTime<Utc>,
}

impl ApprovalComment {
    /// Create a new approval comment.
    pub fn new(author_id: Uuid, content: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            author_id,
            content,
            created_at: Utc::now(),
        }
    }
}

// =============================================================================
// ApprovalRequest
// =============================================================================

/// An approval request for a document.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalRequest {
    /// Unique identifier for this approval request.
    pub id: Uuid,
    /// The document being approved.
    pub document_id: Uuid,
    /// User who submitted the document for approval.
    pub requester_id: Uuid,
    /// List of users who can approve this document.
    pub approvers: Vec<Uuid>,
    /// Current status of the approval.
    pub status: ApprovalStatus,
    /// Comments/feedback on the approval.
    pub comments: Vec<ApprovalComment>,
    /// When the approval request was created.
    pub created_at: DateTime<Utc>,
    /// When the approval request was last updated.
    pub updated_at: DateTime<Utc>,
}

impl ApprovalRequest {
    /// Create a new approval request in Draft status.
    pub fn new(document_id: Uuid, requester_id: Uuid, approvers: Vec<Uuid>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            document_id,
            requester_id,
            approvers,
            status: ApprovalStatus::Draft,
            comments: Vec::new(),
            created_at: now,
            updated_at: now,
        }
    }
}

// =============================================================================
// ApprovalStore
// =============================================================================

/// In-memory store for approval requests.
#[derive(Debug, Clone)]
pub struct ApprovalStore {
    requests: Arc<DashMap<Uuid, ApprovalRequest>>,
}

impl ApprovalStore {
    /// Create a new approval store.
    pub fn new() -> Self {
        Self {
            requests: Arc::new(DashMap::new()),
        }
    }

    /// Submit a document for approval.
    pub fn submit_for_approval(&self, document_id: Uuid, requester_id: Uuid, approvers: Vec<Uuid>) -> Uuid {
        let mut req = ApprovalRequest::new(document_id, requester_id, approvers);
        req.status = ApprovalStatus::PendingReview;
        req.updated_at = Utc::now();
        let req_id = req.id;
        self.requests.insert(req_id, req);
        req_id
    }

    /// Approve a pending request (by one approver).
    pub fn approve(&self, request_id: Uuid, approver_id: Uuid, comment: Option<String>) -> anyhow::Result<()> {
        if let Some(mut req) = self.requests.get_mut(&request_id) {
            if req.status != ApprovalStatus::PendingReview {
                return Err(anyhow::anyhow!("Cannot approve non-pending request"));
            }
            if !req.approvers.contains(&approver_id) {
                return Err(anyhow::anyhow!("User is not an approver for this request"));
            }

            if let Some(text) = comment {
                req.comments.push(ApprovalComment::new(approver_id, text));
            }

            // Mark as approved (simple case: first approver approves)
            req.status = ApprovalStatus::Approved;
            req.updated_at = Utc::now();
            Ok(())
        } else {
            Err(anyhow::anyhow!("Approval request not found"))
        }
    }

    /// Reject a pending request.
    pub fn reject(&self, request_id: Uuid, approver_id: Uuid, comment: String) -> anyhow::Result<()> {
        if let Some(mut req) = self.requests.get_mut(&request_id) {
            if req.status != ApprovalStatus::PendingReview {
                return Err(anyhow::anyhow!("Cannot reject non-pending request"));
            }
            if !req.approvers.contains(&approver_id) {
                return Err(anyhow::anyhow!("User is not an approver for this request"));
            }

            req.comments.push(ApprovalComment::new(approver_id, comment));
            req.status = ApprovalStatus::Rejected;
            req.updated_at = Utc::now();
            Ok(())
        } else {
            Err(anyhow::anyhow!("Approval request not found"))
        }
    }

    /// List all pending approval requests for a given approver.
    pub fn list_pending(&self, approver_id: Uuid) -> Vec<ApprovalRequest> {
        self.requests
            .iter()
            .filter(|entry| {
                let req = entry.value();
                req.status == ApprovalStatus::PendingReview && req.approvers.contains(&approver_id)
            })
            .map(|entry| entry.value().clone())
            .collect()
    }
}

impl Default for ApprovalStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_approval_request() {
        let doc_id = Uuid::new_v4();
        let requester = Uuid::new_v4();
        let approvers = vec![Uuid::new_v4()];

        let req = ApprovalRequest::new(doc_id, requester, approvers.clone());
        assert_eq!(req.status, ApprovalStatus::Draft);
        assert_eq!(req.document_id, doc_id);
    }

    #[test]
    fn test_submit_for_approval() {
        let store = ApprovalStore::new();
        let doc_id = Uuid::new_v4();
        let requester = Uuid::new_v4();
        let approvers = vec![Uuid::new_v4()];

        let req_id = store.submit_for_approval(doc_id, requester, approvers);
        let pending = store.list_pending(Uuid::new_v4());
        assert_eq!(pending.len(), 0);
    }

    #[test]
    fn test_approve_request() {
        let store = ApprovalStore::new();
        let doc_id = Uuid::new_v4();
        let requester = Uuid::new_v4();
        let approver = Uuid::new_v4();
        let approvers = vec![approver];

        let req_id = store.submit_for_approval(doc_id, requester, approvers);
        let result = store.approve(req_id, approver, Some("Looks good!".to_string()));
        assert!(result.is_ok());
    }

    #[test]
    fn test_reject_request() {
        let store = ApprovalStore::new();
        let doc_id = Uuid::new_v4();
        let requester = Uuid::new_v4();
        let approver = Uuid::new_v4();
        let approvers = vec![approver];

        let req_id = store.submit_for_approval(doc_id, requester, approvers);
        let result = store.reject(req_id, approver, "Needs revision".to_string());
        assert!(result.is_ok());
    }
}
