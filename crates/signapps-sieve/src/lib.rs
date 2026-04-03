//! Simple Sieve script engine (RFC 5228).
//!
//! Provides a parser and executor for a subset of the Sieve email filtering
//! language. Supports the most common commands: `require`, `if`/`elsif`/`else`,
//! `stop`, `fileinto`, `redirect`, `reject`, `keep`, `discard`, and `vacation`.
//!
//! # Supported conditions
//!
//! - `header :contains/:is/:matches` — test header values
//! - `address :is` — test sender/recipient addresses
//! - `size :over/:under` — test message size
//! - `exists` — test header existence
//! - `allof`/`anyof` — AND/OR combinators
//! - `not` — negation
//!
//! # Examples
//!
//! ```
//! use signapps_sieve::{SieveScript, SieveContext, SieveAction};
//!
//! let source = r#"
//! require "fileinto";
//! if header :contains "Subject" "urgent" {
//!     fileinto "Important";
//! }
//! "#;
//!
//! let script = SieveScript::compile(source).unwrap();
//! let ctx = SieveContext {
//!     from: "boss@example.com".to_string(),
//!     to: vec!["me@example.com".to_string()],
//!     subject: "This is urgent!".to_string(),
//!     headers: vec![("Subject".to_string(), "This is urgent!".to_string())],
//!     size: 1024,
//! };
//!
//! let actions = script.execute(&ctx);
//! assert!(actions.iter().any(|a| matches!(a, SieveAction::FileInto(f) if f == "Important")));
//! ```

#![warn(missing_docs)]

pub mod actions;
pub mod executor;
pub mod parser;

pub use actions::{SieveAction, SieveCondition, SieveRule, SieveScript};
pub use executor::SieveContext;

/// Errors produced by the Sieve engine.
#[derive(Debug, thiserror::Error)]
pub enum SieveError {
    /// Script parsing failed.
    #[error("Parse error at line {line}: {message}")]
    Parse {
        /// Line number where the error occurred (1-based).
        line: usize,
        /// Description of the parse error.
        message: String,
    },

    /// Unsupported Sieve extension.
    #[error("Unsupported extension: {0}")]
    UnsupportedExtension(String),
}
