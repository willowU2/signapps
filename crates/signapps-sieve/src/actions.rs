//! Sieve action types and script structure.
//!
//! Defines the AST-like types for a compiled Sieve script: rules, conditions,
//! and actions. The parser produces these types from Sieve source, and the
//! executor evaluates them against a message context.

use crate::SieveError;
use serde::{Deserialize, Serialize};

/// A compiled Sieve script.
///
/// Contains the required extensions and a list of rules to evaluate.
///
/// # Examples
///
/// ```
/// use signapps_sieve::SieveScript;
/// let script = SieveScript::compile(r#"require "fileinto"; keep;"#).unwrap();
/// assert!(script.requires.contains(&"fileinto".to_string()));
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SieveScript {
    /// Required extensions declared with `require`.
    pub requires: Vec<String>,
    /// Ordered list of rules to evaluate.
    pub rules: Vec<SieveRule>,
}

/// A single rule in a Sieve script.
///
/// Can be a conditional block (if/elsif/else) or an unconditional action.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SieveRule {
    /// Conditional rule: if condition { actions } else { actions }.
    If {
        /// The test condition.
        condition: SieveCondition,
        /// Actions to execute if condition is true.
        actions: Vec<SieveAction>,
        /// Actions to execute if condition is false (else/elsif block).
        else_actions: Vec<SieveAction>,
    },
    /// Unconditional action.
    Action(SieveAction),
}

/// Comparator for header/address tests.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Comparator {
    /// Exact match (`:is`).
    Is,
    /// Substring match (`:contains`).
    Contains,
    /// Glob-like match (`:matches`, with `*` and `?` wildcards).
    Matches,
}

/// A test condition in a Sieve script.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SieveCondition {
    /// Test a header value.
    Header {
        /// The comparator to use.
        comparator: Comparator,
        /// Header name to test (e.g. `"Subject"`).
        header: String,
        /// Value to compare against.
        value: String,
    },
    /// Test an address (from, to, etc.).
    Address {
        /// The comparator to use.
        comparator: Comparator,
        /// Address part to test (e.g. `"from"`, `"to"`).
        part: String,
        /// Value to compare against.
        value: String,
    },
    /// Test message size.
    Size {
        /// If true, test `:over`; if false, test `:under`.
        over: bool,
        /// Size threshold in bytes.
        size: usize,
    },
    /// Test whether a header exists.
    Exists(String),
    /// All conditions must be true (AND).
    AllOf(Vec<SieveCondition>),
    /// At least one condition must be true (OR).
    AnyOf(Vec<SieveCondition>),
    /// Negation.
    Not(Box<SieveCondition>),
    /// Always true.
    True,
}

/// An action to perform on a message.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SieveAction {
    /// Keep the message in the default mailbox (INBOX).
    Keep,
    /// File the message into a specific mailbox/folder.
    FileInto(String),
    /// Redirect the message to another address.
    Redirect(String),
    /// Reject the message with a reason (bounce).
    Reject(String),
    /// Silently discard the message.
    Discard,
    /// Send an auto-reply (vacation).
    Vacation {
        /// Subject of the vacation reply.
        subject: Option<String>,
        /// Body text of the vacation reply.
        body: String,
        /// Minimum days between auto-replies to the same sender.
        days: u32,
    },
    /// Stop processing further rules.
    Stop,
}

impl SieveScript {
    /// Compile a Sieve script from source text.
    ///
    /// # Errors
    ///
    /// Returns [`SieveError::Parse`] if the script has syntax errors, or
    /// [`SieveError::UnsupportedExtension`] if an unknown extension is required.
    ///
    /// # Panics
    ///
    /// None.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_sieve::SieveScript;
    /// let script = SieveScript::compile(r#"
    /// require "fileinto";
    /// if header :contains "Subject" "test" {
    ///     fileinto "Tests";
    /// }
    /// "#).unwrap();
    /// assert_eq!(script.rules.len(), 1);
    /// ```
    pub fn compile(source: &str) -> Result<Self, SieveError> {
        crate::parser::parse(source)
    }

    /// Execute the script against a message context and return the list of actions.
    ///
    /// If no explicit action is taken, an implicit `keep` is added.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_sieve::{SieveScript, SieveContext, SieveAction};
    /// let script = SieveScript::compile("keep;").unwrap();
    /// let ctx = SieveContext {
    ///     from: "a@b.com".to_string(),
    ///     to: vec!["c@d.com".to_string()],
    ///     subject: "Hello".to_string(),
    ///     headers: vec![("Subject".to_string(), "Hello".to_string())],
    ///     size: 100,
    /// };
    /// let actions = script.execute(&ctx);
    /// assert!(actions.contains(&SieveAction::Keep));
    /// ```
    ///
    /// # Panics
    ///
    /// None.
    pub fn execute(&self, ctx: &crate::executor::SieveContext) -> Vec<SieveAction> {
        crate::executor::execute(self, ctx)
    }
}
