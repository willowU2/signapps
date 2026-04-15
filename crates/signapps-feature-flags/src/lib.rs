//! Feature flags for SignApps Platform.
//!
//! Flags live in the `feature_flags` table (one row per (key, env) pair). The
//! library exposes an evaluator that combines enabled/rollout_percent/
//! target_orgs/target_users to answer `is_enabled(key, ctx)` in O(1) against
//! an in-process TTL cache.

#![warn(missing_docs)]

pub mod cache;
pub mod evaluator;
pub mod repository;
pub mod types;

pub use evaluator::Evaluator;
pub use types::{FeatureFlag, RolloutContext};
