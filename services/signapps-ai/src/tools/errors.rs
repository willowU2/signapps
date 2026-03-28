//! Tool execution error types.

use std::fmt;

/// Errors that can occur during tool execution.
#[derive(Debug)]
pub enum ToolError {
    /// Tool not found in registry.
    ToolNotFound(String),
    /// Invalid parameters for tool.
    InvalidParams(String),
    /// Unknown service target.
    UnknownService(String),
    /// Invalid HTTP method.
    InvalidMethod(String),
    /// HTTP request failed.
    HttpError(String),
    /// Service returned an error.
    ServiceError(u16, String),
    /// Failed to parse response.
    ParseError(String),
    /// Maximum tool iterations exceeded.
    MaxIterations(usize),
    /// Permission denied (role too low).
    PermissionDenied(String),
}

impl fmt::Display for ToolError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ToolNotFound(name) => write!(f, "Tool not found: {}", name),
            Self::InvalidParams(msg) => write!(f, "Invalid parameters: {}", msg),
            Self::UnknownService(svc) => write!(f, "Unknown service: {}", svc),
            Self::InvalidMethod(m) => write!(f, "Invalid HTTP method: {}", m),
            Self::HttpError(msg) => write!(f, "HTTP error: {}", msg),
            Self::ServiceError(code, msg) => {
                write!(f, "Service error ({}): {}", code, msg)
            },
            Self::ParseError(msg) => write!(f, "Parse error: {}", msg),
            Self::MaxIterations(n) => {
                write!(f, "Max tool iterations reached ({})", n)
            },
            Self::PermissionDenied(tool) => {
                write!(f, "Permission denied for tool: {}", tool)
            },
        }
    }
}

impl std::error::Error for ToolError {}

impl From<reqwest::Error> for ToolError {
    fn from(e: reqwest::Error) -> Self {
        Self::HttpError(e.to_string())
    }
}
