//! Greylisting logic for anti-spam.
//!
//! Greylisting temporarily rejects messages from unknown sender/IP/recipient
//! triplets. Legitimate mail servers will retry after a delay, while many
//! spam bots will not. The triplet is stored and subsequent delivery attempts
//! from the same triplet are accepted.
//!
//! This module provides the data structures and decision logic. Actual storage
//! is handled by the caller (typically the SMTP inbound handler with a database
//! or in-memory cache).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// A greylisting triplet (sender IP, sender address, recipient address).
///
/// Used as the key for greylisting decisions. Messages from the same triplet
/// are grouped together.
///
/// # Examples
///
/// ```
/// use signapps_spam::greylisting::GreylistTriplet;
///
/// let triplet = GreylistTriplet {
///     sender_ip: "1.2.3.4".to_string(),
///     sender: "user@example.com".to_string(),
///     recipient: "dest@local.com".to_string(),
/// };
/// assert_eq!(triplet.key(), "1.2.3.4|user@example.com|dest@local.com");
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct GreylistTriplet {
    /// IP address of the sending MTA (as string).
    pub sender_ip: String,
    /// Envelope MAIL FROM address.
    pub sender: String,
    /// Envelope RCPT TO address.
    pub recipient: String,
}

impl GreylistTriplet {
    /// Generate a unique key for this triplet.
    pub fn key(&self) -> String {
        format!("{}|{}|{}", self.sender_ip, self.sender, self.recipient)
    }
}

/// A greylisting record stored for a known triplet.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GreylistRecord {
    /// The triplet this record belongs to.
    pub triplet: GreylistTriplet,
    /// When this triplet was first seen.
    pub first_seen: DateTime<Utc>,
    /// How many times this triplet has been retried.
    pub retry_count: u32,
    /// When the greylist entry expires (after which it is removed).
    pub expires_at: DateTime<Utc>,
}

/// Decision from the greylisting check.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum GreylistDecision {
    /// Accept the message — the triplet is known and the minimum delay has passed.
    Accept,
    /// Temporarily reject (451) — the triplet is new or the delay hasn't elapsed.
    TempReject {
        /// Number of seconds the sender should wait before retrying.
        retry_after_secs: u64,
    },
}

/// Minimum delay in seconds before a greylisted triplet is accepted (default: 5 minutes).
pub const DEFAULT_GREYLIST_DELAY_SECS: u64 = 300;

/// Default TTL for a greylisting record (default: 24 hours).
pub const DEFAULT_GREYLIST_TTL_SECS: u64 = 86400;

/// Evaluate a greylisting decision for a triplet.
///
/// # Arguments
///
/// * `existing` — An existing record for this triplet, if one was found in storage.
/// * `delay_secs` — Minimum delay before accepting a retried triplet.
/// * `now` — Current timestamp (passed explicitly for testability).
///
/// # Returns
///
/// A tuple of `(decision, updated_record)`:
/// - `decision`: Whether to accept or temporarily reject.
/// - `updated_record`: The record to store/update in the database.
///
/// # Panics
///
/// None.
pub fn evaluate(
    triplet: &GreylistTriplet,
    existing: Option<&GreylistRecord>,
    delay_secs: u64,
    ttl_secs: u64,
    now: DateTime<Utc>,
) -> (GreylistDecision, GreylistRecord) {
    match existing {
        Some(record) => {
            let elapsed = (now - record.first_seen).num_seconds().max(0) as u64;
            let updated = GreylistRecord {
                triplet: triplet.clone(),
                first_seen: record.first_seen,
                retry_count: record.retry_count + 1,
                expires_at: now + chrono::Duration::seconds(ttl_secs as i64),
            };

            if elapsed >= delay_secs {
                (GreylistDecision::Accept, updated)
            } else {
                let remaining = delay_secs - elapsed;
                (
                    GreylistDecision::TempReject {
                        retry_after_secs: remaining,
                    },
                    updated,
                )
            }
        },
        None => {
            // New triplet — create record and temp-reject
            let record = GreylistRecord {
                triplet: triplet.clone(),
                first_seen: now,
                retry_count: 0,
                expires_at: now + chrono::Duration::seconds(ttl_secs as i64),
            };
            (
                GreylistDecision::TempReject {
                    retry_after_secs: delay_secs,
                },
                record,
            )
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_triplet() -> GreylistTriplet {
        GreylistTriplet {
            sender_ip: "1.2.3.4".to_string(),
            sender: "test@example.com".to_string(),
            recipient: "user@local.com".to_string(),
        }
    }

    #[test]
    fn test_triplet_key() {
        let triplet = test_triplet();
        assert_eq!(triplet.key(), "1.2.3.4|test@example.com|user@local.com");
    }

    #[test]
    fn test_new_triplet_is_rejected() {
        let triplet = test_triplet();
        let now = Utc::now();
        let (decision, record) = evaluate(&triplet, None, 300, 86400, now);
        assert!(matches!(
            decision,
            GreylistDecision::TempReject {
                retry_after_secs: 300
            }
        ));
        assert_eq!(record.retry_count, 0);
        assert_eq!(record.first_seen, now);
    }

    #[test]
    fn test_retry_before_delay_is_rejected() {
        let triplet = test_triplet();
        let first_seen = Utc::now() - chrono::Duration::seconds(60); // 60s ago
        let existing = GreylistRecord {
            triplet: triplet.clone(),
            first_seen,
            retry_count: 1,
            expires_at: first_seen + chrono::Duration::seconds(86400),
        };
        let now = Utc::now();
        let (decision, record) = evaluate(&triplet, Some(&existing), 300, 86400, now);
        assert!(matches!(decision, GreylistDecision::TempReject { .. }));
        assert_eq!(record.retry_count, 2);
    }

    #[test]
    fn test_retry_after_delay_is_accepted() {
        let triplet = test_triplet();
        let first_seen = Utc::now() - chrono::Duration::seconds(600); // 10 min ago
        let existing = GreylistRecord {
            triplet: triplet.clone(),
            first_seen,
            retry_count: 1,
            expires_at: first_seen + chrono::Duration::seconds(86400),
        };
        let now = Utc::now();
        let (decision, record) = evaluate(&triplet, Some(&existing), 300, 86400, now);
        assert_eq!(decision, GreylistDecision::Accept);
        assert_eq!(record.retry_count, 2);
    }

    #[test]
    fn test_exact_delay_boundary_is_accepted() {
        let triplet = test_triplet();
        let now = Utc::now();
        let first_seen = now - chrono::Duration::seconds(300); // exactly 5 min ago
        let existing = GreylistRecord {
            triplet: triplet.clone(),
            first_seen,
            retry_count: 0,
            expires_at: first_seen + chrono::Duration::seconds(86400),
        };
        let (decision, _) = evaluate(&triplet, Some(&existing), 300, 86400, now);
        assert_eq!(decision, GreylistDecision::Accept);
    }
}
