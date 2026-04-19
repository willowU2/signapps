//! Conflict resolution for AD ↔ Org divergences.
//!
//! When an AD entry and the matching Org row disagree on a scalar
//! attribute (first name, last name, email, ...) the sync engine calls
//! [`resolve`] with the tenant's configured
//! [`signapps_db::models::org::ConflictStrategy`] and the two candidate
//! values. The resulting [`Resolved`] tells the caller what to do:
//!
//! - `Resolved::UseOrg(_)` — keep the SignApps value, overwrite AD if
//!   pushing.
//! - `Resolved::UseAd(_)` — overwrite the SignApps row with the AD
//!   value.
//! - `Resolved::Manual` — leave both sides untouched and record the
//!   conflict in `org_ad_sync_log` for human review.

use signapps_db::models::org::ConflictStrategy;

/// Outcome of a single conflict-resolution call.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Resolved<T> {
    /// The SignApps-side value wins.
    UseOrg(T),
    /// The AD-side value wins.
    UseAd(T),
    /// Neither side is automatically applied — human intervention
    /// required.
    Manual,
}

/// Deterministic resolver driven by the tenant's
/// [`ConflictStrategy`]. Returns the candidate value the caller should
/// adopt, or [`Resolved::Manual`] when the strategy requires human
/// review.
///
/// # Examples
///
/// ```
/// use signapps_db::models::org::ConflictStrategy;
/// use signapps_org::ad::conflict::{resolve, Resolved};
///
/// let out = resolve(ConflictStrategy::OrgWins, "alice@sign.app", "alice@ad.corp");
/// assert_eq!(out, Resolved::UseOrg("alice@sign.app"));
/// ```
#[must_use]
pub fn resolve<T: Clone>(strategy: ConflictStrategy, org: T, ad: T) -> Resolved<T> {
    match strategy {
        ConflictStrategy::OrgWins => Resolved::UseOrg(org),
        ConflictStrategy::AdWins => Resolved::UseAd(ad),
        ConflictStrategy::Manual => Resolved::Manual,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn org_wins_returns_org() {
        assert_eq!(resolve(ConflictStrategy::OrgWins, 1, 2), Resolved::UseOrg(1));
    }

    #[test]
    fn ad_wins_returns_ad() {
        assert_eq!(resolve(ConflictStrategy::AdWins, 1, 2), Resolved::UseAd(2));
    }

    #[test]
    fn manual_returns_manual() {
        let out: Resolved<i32> = resolve(ConflictStrategy::Manual, 1, 2);
        assert_eq!(out, Resolved::Manual);
    }
}
