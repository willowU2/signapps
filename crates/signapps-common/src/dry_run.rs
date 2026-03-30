//! Dry-Run Mode for destructive API endpoints.
//!
//! When the `X-Dry-Run: true` header is present, destructive operations
//! validate inputs and return what would happen without executing.

use axum::{extract::Request, http::HeaderMap};
use serde::Serialize;

/// Check if the current request is a dry-run.
pub fn is_dry_run(headers: &HeaderMap) -> bool {
    headers
        .get("x-dry-run")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
        .unwrap_or(false)
}

/// Extract dry-run flag from an axum Request.
pub fn is_dry_run_request(req: &Request) -> bool {
    is_dry_run(req.headers())
}

/// Response for a dry-run operation.
#[derive(Debug, Serialize)]
pub struct DryRunResult {
    pub dry_run: bool,
    pub would_affect: usize,
    pub operations: Vec<DryRunOp>,
}

#[derive(Debug, Serialize)]
/// Represents a dry run op.
pub struct DryRunOp {
    pub action: String,
    pub target: String,
    pub details: Option<String>,
}

impl DryRunResult {
    pub fn new() -> Self {
        Self {
            dry_run: true,
            would_affect: 0,
            operations: Vec::new(),
        }
    }

    pub fn add_op(mut self, action: impl Into<String>, target: impl Into<String>) -> Self {
        self.would_affect += 1;
        self.operations.push(DryRunOp {
            action: action.into(),
            target: target.into(),
            details: None,
        });
        self
    }

    pub fn add_op_with_details(
        mut self,
        action: impl Into<String>,
        target: impl Into<String>,
        details: impl Into<String>,
    ) -> Self {
        self.would_affect += 1;
        self.operations.push(DryRunOp {
            action: action.into(),
            target: target.into(),
            details: Some(details.into()),
        });
        self
    }
}

impl Default for DryRunResult {
    fn default() -> Self {
        Self::new()
    }
}
