//! Anti-spam scoring engine for SignApps Platform.
//!
//! Provides a multi-factor spam scoring pipeline combining DNS blacklists (DNSBL),
//! greylisting, header analysis, and email authentication results (SPF, DKIM, DMARC).
//!
//! The engine is a pure library — no I/O is performed directly. DNS lookups are
//! abstracted behind the [`DnsBlResolver`] trait for testability.
//!
//! # Scoring model
//!
//! Each check contributes a weighted score. The final score determines the action:
//! - Below `ham_threshold`: accepted as legitimate (ham).
//! - Between `ham_threshold` and `quarantine_threshold`: accepted with warning.
//! - Between `quarantine_threshold` and `reject_threshold`: quarantined (Junk folder).
//! - Above `reject_threshold`: rejected outright.
//!
//! # Examples
//!
//! ```
//! use signapps_spam::{SpamChecker, SpamConfig, SpamContext, SpamAction};
//!
//! let config = SpamConfig::default();
//! let checker = SpamChecker::new(config);
//!
//! let ctx = SpamContext {
//!     sender_ip: "127.0.0.1".parse().unwrap(),
//!     helo_domain: "mail.example.com".to_string(),
//!     mail_from: "sender@example.com".to_string(),
//!     recipients: vec!["user@local.com".to_string()],
//!     spf_result: "pass".to_string(),
//!     dkim_result: "pass".to_string(),
//!     dmarc_result: "pass".to_string(),
//! };
//!
//! // Without async DNSBL checks, use synchronous scoring:
//! let verdict = checker.check_sync(&[], "", &ctx);
//! assert!(matches!(verdict.action, SpamAction::Accept));
//! ```

#![warn(missing_docs)]

pub mod dnsbl;
pub mod greylisting;
pub mod headers;
pub mod scorer;

pub use scorer::{SpamAction, SpamChecker, SpamConfig, SpamContext, SpamTest, SpamVerdict};
