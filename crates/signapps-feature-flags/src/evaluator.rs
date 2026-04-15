//! Evaluate whether a flag is enabled for a given [`RolloutContext`].
//!
//! Rules applied in order (short-circuit):
//! 1. If `enabled == false`: always false.
//! 2. If `target_users` contains `ctx.user_id`: true.
//! 3. If `target_orgs` contains `ctx.org_id`: true.
//! 4. If `rollout_percent >= 100`: true.
//! 5. If `rollout_percent <= 0`: false.
//! 6. Otherwise: stable hash bucket of `user_id` (or `org_id` fallback) +
//!    flag key; enabled if `bucket < rollout_percent`.
//!
//! The hash is deterministic so the same user always lands in the same bucket
//! across restarts.

use crate::types::{FeatureFlag, RolloutContext};
use std::hash::{Hash, Hasher};
use uuid::Uuid;

/// Evaluator for a single flag against a runtime context.
pub struct Evaluator;

impl Evaluator {
    /// Returns whether the flag is enabled for this context.
    pub fn is_enabled(flag: &FeatureFlag, ctx: &RolloutContext) -> bool {
        if !flag.enabled {
            return false;
        }
        if let Some(uid) = ctx.user_id {
            if flag.target_users.contains(&uid) {
                return true;
            }
        }
        if let Some(oid) = ctx.org_id {
            if flag.target_orgs.contains(&oid) {
                return true;
            }
        }
        if flag.rollout_percent <= 0 {
            return false;
        }
        if flag.rollout_percent >= 100 {
            return true;
        }
        let bucket = stable_bucket(ctx.user_id.or(ctx.org_id), &flag.key);
        bucket < (flag.rollout_percent as u32)
    }
}

fn stable_bucket(seed: Option<Uuid>, key: &str) -> u32 {
    use std::collections::hash_map::DefaultHasher;
    let mut h = DefaultHasher::new();
    if let Some(id) = seed {
        id.hash(&mut h);
    }
    key.hash(&mut h);
    (h.finish() % 100) as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn flag(enabled: bool, rollout: i32) -> FeatureFlag {
        FeatureFlag {
            id: Uuid::new_v4(),
            key: "k".into(),
            env: "prod".into(),
            enabled,
            rollout_percent: rollout,
            target_orgs: vec![],
            target_users: vec![],
            description: None,
            created_by: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    fn ctx(uid: Option<Uuid>) -> RolloutContext {
        RolloutContext {
            env: "prod".into(),
            user_id: uid,
            org_id: None,
        }
    }

    #[test]
    fn disabled_flag_never_fires() {
        assert!(!Evaluator::is_enabled(&flag(false, 100), &ctx(None)));
    }

    #[test]
    fn full_rollout_always_fires_when_enabled() {
        for _ in 0..10 {
            assert!(Evaluator::is_enabled(
                &flag(true, 100),
                &ctx(Some(Uuid::new_v4()))
            ));
        }
    }

    #[test]
    fn zero_rollout_never_fires_when_enabled() {
        for _ in 0..10 {
            assert!(!Evaluator::is_enabled(
                &flag(true, 0),
                &ctx(Some(Uuid::new_v4()))
            ));
        }
    }

    #[test]
    fn targeted_user_is_always_enabled_even_with_zero_rollout() {
        let uid = Uuid::new_v4();
        let mut f = flag(true, 0);
        f.target_users = vec![uid];
        assert!(Evaluator::is_enabled(&f, &ctx(Some(uid))));
    }

    #[test]
    fn rollout_distribution_is_roughly_correct() {
        let f = flag(true, 30);
        let hits = (0..10_000)
            .filter(|_| Evaluator::is_enabled(&f, &ctx(Some(Uuid::new_v4()))))
            .count();
        let pct = hits as f64 / 10_000.0 * 100.0;
        assert!((27.0..=33.0).contains(&pct), "distribution off: got {pct}%");
    }
}
