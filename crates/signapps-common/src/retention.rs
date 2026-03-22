//! Data Retention Policies — RGPD compliance foundation.
//!
//! Provides an in-memory policy engine that tracks retention rules per data type.
//! Policies define how long data may be kept and what action to take when expired.
//! Actual purge execution is handled by the calling service; this module only
//! declares and evaluates policies.
//!
//! ## Default policies
//!
//! | data_type | max_age_days | action   |
//! |-----------|--------------|----------|
//! | trash     | 30           | Delete   |
//! | logs      | 90           | Delete   |
//! | mails     | 730          | Archive  |
//! | sessions  | 7            | Delete   |

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

// =============================================================================
// RetentionAction
// =============================================================================

/// What to do with data that has exceeded its maximum age.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RetentionAction {
    /// Move data to cold/archive storage, but keep it accessible.
    Archive,
    /// Permanently remove data.
    Delete,
    /// Strip all personally-identifiable fields while keeping the record.
    Anonymize,
}

// =============================================================================
// RetentionPolicy
// =============================================================================

/// A single data-retention rule.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionPolicy {
    /// Unique identifier for this policy.
    pub id: Uuid,
    /// Logical data type this policy applies to (e.g. `"trash"`, `"logs"`).
    pub data_type: String,
    /// Maximum number of days data of this type may be retained.
    pub max_age_days: u32,
    /// Action to execute when data exceeds `max_age_days`.
    pub action: RetentionAction,
    /// Whether this policy is currently active.
    pub enabled: bool,
    /// Human-readable description for RGPD documentation purposes.
    pub description: String,
}

impl RetentionPolicy {
    /// Construct a new policy with a freshly generated UUID.
    pub fn new(
        data_type: impl Into<String>,
        max_age_days: u32,
        action: RetentionAction,
        enabled: bool,
        description: impl Into<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            data_type: data_type.into(),
            max_age_days,
            action,
            enabled,
            description: description.into(),
        }
    }
}

// =============================================================================
// RetentionEngine
// =============================================================================

/// In-memory store of [`RetentionPolicy`] entries with evaluation helpers.
///
/// Clone-cheap: backed by an `Arc<Mutex<...>>` so it can be shared across
/// Axum handlers and background tasks.
#[derive(Debug, Clone)]
pub struct RetentionEngine {
    policies: Arc<Mutex<HashMap<String, RetentionPolicy>>>,
}

impl RetentionEngine {
    /// Create a new engine populated with the platform's default RGPD policies.
    pub fn new() -> Self {
        let engine = Self {
            policies: Arc::new(Mutex::new(HashMap::new())),
        };
        engine.load_defaults();
        engine
    }

    /// Seed the engine with the four mandatory default policies.
    fn load_defaults(&self) {
        let defaults = [
            RetentionPolicy::new(
                "trash",
                30,
                RetentionAction::Delete,
                true,
                "Permanently delete items in the trash after 30 days (RGPD Art. 5)",
            ),
            RetentionPolicy::new(
                "logs",
                90,
                RetentionAction::Delete,
                true,
                "Purge application and access logs after 90 days",
            ),
            RetentionPolicy::new(
                "mails",
                730,
                RetentionAction::Archive,
                true,
                "Archive user mail data after 2 years before any further review",
            ),
            RetentionPolicy::new(
                "sessions",
                7,
                RetentionAction::Delete,
                true,
                "Invalidate and delete expired session records after 7 days",
            ),
        ];

        let mut guard = self.policies.lock().expect("retention lock poisoned");
        for policy in defaults {
            guard.insert(policy.data_type.clone(), policy);
        }
    }

    /// Register (or replace) a policy for the given data type.
    pub fn add_policy(&self, policy: RetentionPolicy) {
        let mut guard = self.policies.lock().expect("retention lock poisoned");
        guard.insert(policy.data_type.clone(), policy);
    }

    /// Remove the policy for `data_type`. Returns the removed policy if it existed.
    pub fn remove_policy(&self, data_type: &str) -> Option<RetentionPolicy> {
        let mut guard = self.policies.lock().expect("retention lock poisoned");
        guard.remove(data_type)
    }

    /// Return a snapshot of all registered policies (enabled or not).
    pub fn list_policies(&self) -> Vec<RetentionPolicy> {
        let guard = self.policies.lock().expect("retention lock poisoned");
        guard.values().cloned().collect()
    }

    /// Look up the policy for a specific data type.
    pub fn get_policy(&self, data_type: &str) -> Option<RetentionPolicy> {
        let guard = self.policies.lock().expect("retention lock poisoned");
        guard.get(data_type).cloned()
    }

    /// Returns `true` when `created_at` is older than the policy's `max_age_days`
    /// and the policy is enabled.  Returns `false` if no policy is registered.
    pub fn check_expired(&self, data_type: &str, created_at: DateTime<Utc>) -> bool {
        let guard = self.policies.lock().expect("retention lock poisoned");
        match guard.get(data_type) {
            Some(policy) if policy.enabled => {
                let age = Utc::now() - created_at;
                age > Duration::days(i64::from(policy.max_age_days))
            }
            _ => false,
        }
    }
}

impl Default for RetentionEngine {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_policies_are_loaded() {
        let engine = RetentionEngine::new();
        let policies = engine.list_policies();
        let types: Vec<&str> = policies.iter().map(|p| p.data_type.as_str()).collect();
        assert!(types.contains(&"trash"));
        assert!(types.contains(&"logs"));
        assert!(types.contains(&"mails"));
        assert!(types.contains(&"sessions"));
    }

    #[test]
    fn get_policy_returns_correct_data() {
        let engine = RetentionEngine::new();
        let policy = engine.get_policy("trash").expect("trash policy missing");
        assert_eq!(policy.max_age_days, 30);
        assert_eq!(policy.action, RetentionAction::Delete);
    }

    #[test]
    fn check_expired_old_data() {
        let engine = RetentionEngine::new();
        // Created 40 days ago — exceeds the 30-day trash policy.
        let old = Utc::now() - Duration::days(40);
        assert!(engine.check_expired("trash", old));
    }

    #[test]
    fn check_expired_fresh_data() {
        let engine = RetentionEngine::new();
        let recent = Utc::now() - Duration::days(5);
        assert!(!engine.check_expired("trash", recent));
    }

    #[test]
    fn add_and_remove_policy() {
        let engine = RetentionEngine::new();
        let custom = RetentionPolicy::new(
            "contracts",
            3650,
            RetentionAction::Anonymize,
            true,
            "Anonymize contract data after 10 years",
        );
        engine.add_policy(custom);
        assert!(engine.get_policy("contracts").is_some());
        engine.remove_policy("contracts");
        assert!(engine.get_policy("contracts").is_none());
    }

    #[test]
    fn unknown_data_type_not_expired() {
        let engine = RetentionEngine::new();
        let old = Utc::now() - Duration::days(9999);
        assert!(!engine.check_expired("unknown_type", old));
    }
}
