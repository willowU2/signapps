// crates/signapps-ad-core/src/naming.rs
//! SAM account name and Distinguished Name generation for AD objects.
//!
//! Implements the naming algorithm used when provisioning new AD user accounts
//! from org-chart person data:
//!
//! 1. `p.nom` — first letter of `first_name` + `"."` + `last_name`
//! 2. `pp.nom` — first letter of `first_name` + first letter of `middle_name` + `"."` + `last_name`
//! 3. `pr.nom` — first two letters of `first_name` + `"."` + `last_name`
//! 4. `p.nom2`, `p.nom3`, … — numeric suffixes (last resort)
//!
//! All names are normalised to ASCII lowercase, stripping accents and removing
//! characters that are not valid in a sAMAccountName.
//!
//! # Examples
//!
//! ```
//! use signapps_ad_core::naming::{generate_sam_candidates, domain_to_dn, build_ou_dn};
//!
//! let candidates = generate_sam_candidates("Étienne", "Müller", None);
//! assert_eq!(candidates[0], "e.muller");
//!
//! assert_eq!(domain_to_dn("corp.local"), "DC=corp,DC=local");
//!
//! let dn = build_ou_dn("DRH", None, "DC=corp,DC=local");
//! assert_eq!(dn, "OU=DRH,DC=corp,DC=local");
//! ```

use sqlx::PgPool;
use uuid::Uuid;

// ── ASCII normalisation ───────────────────────────────────────────────────────

/// Normalize a string to ASCII lowercase, replacing accented characters with
/// their closest ASCII equivalents and dropping all other non-ASCII characters.
///
/// Only letters, digits, `.`, `-`, and ` ` (space) survive after filtering.
/// The result is returned in lowercase.
///
/// # Examples
///
/// ```
/// use signapps_ad_core::naming::normalize_ascii;
///
/// assert_eq!(normalize_ascii("Étienne"), "etienne");
/// assert_eq!(normalize_ascii("François"), "francois");
/// assert_eq!(normalize_ascii("José María"), "jose maria");
/// assert_eq!(normalize_ascii("Müller"), "muller");
/// ```
///
/// # Panics
///
/// Never panics.
pub fn normalize_ascii(input: &str) -> String {
    input
        .chars()
        .map(|c| match c {
            'à' | 'â' | 'ä' | 'á' | 'À' | 'Â' | 'Ä' | 'Á' => 'a',
            'é' | 'è' | 'ê' | 'ë' | 'É' | 'È' | 'Ê' | 'Ë' => 'e',
            'ï' | 'î' | 'ì' | 'í' | 'Ï' | 'Î' | 'Ì' | 'Í' => 'i',
            'ö' | 'ô' | 'ò' | 'ó' | 'Ö' | 'Ô' | 'Ò' | 'Ó' => 'o',
            'ü' | 'û' | 'ù' | 'ú' | 'Ü' | 'Û' | 'Ù' | 'Ú' => 'u',
            'ÿ' | 'Ÿ' => 'y',
            'ç' | 'Ç' => 'c',
            'ñ' | 'Ñ' => 'n',
            'ß' => 's',
            _ => c,
        })
        .filter(|c| c.is_ascii_alphanumeric() || *c == '.' || *c == '-' || *c == ' ')
        .collect::<String>()
        .to_lowercase()
}

// ── SAM candidate generation ─────────────────────────────────────────────────

/// Generate sAMAccountName candidates for a person, in priority order.
///
/// Returns a [`Vec`] with at least 100 entries. The caller should pick the
/// first one that is not already taken in the domain (see [`pick_available_sam`]).
///
/// The algorithm (in order):
///
/// 1. `p.nom` — first letter + `.` + last name
/// 2. `pm.nom` — first letter + first letter of middle name + `.` + last name
///    (only when `middle_name` is provided)
/// 3. `pr.nom` — first two letters of first name + `.` + last name
/// 4. `p.nom2` … `p.nom99` — numeric suffixes on the base name
///
/// All components are normalised via [`normalize_ascii`] before assembly.
/// Any candidate longer than 20 characters is truncated at 20.
///
/// # Examples
///
/// ```
/// use signapps_ad_core::naming::generate_sam_candidates;
///
/// let c = generate_sam_candidates("Jean", "Dupont", None);
/// assert_eq!(c[0], "j.dupont");
/// assert_eq!(c[1], "je.dupont"); // no middle name → 2-letter variant
///
/// let c = generate_sam_candidates("Jean", "Dupont", Some("Paul"));
/// assert_eq!(c[0], "j.dupont");
/// assert_eq!(c[1], "jp.dupont"); // middle-name variant
/// assert_eq!(c[2], "je.dupont"); // 2-letter variant
/// ```
///
/// # Panics
///
/// Never panics.
pub fn generate_sam_candidates(
    first_name: &str,
    last_name: &str,
    middle_name: Option<&str>,
) -> Vec<String> {
    let first = normalize_ascii(first_name);
    let last = normalize_ascii(last_name).replace(' ', "-");

    let first_char = first.chars().next().unwrap_or('x');

    let base = {
        let raw = format!("{first_char}.{last}");
        if raw.len() > 20 {
            raw[..20].to_string()
        } else {
            raw
        }
    };

    let mut candidates = vec![base.clone()];

    // With middle name
    if let Some(mn) = middle_name {
        let mn_norm = normalize_ascii(mn);
        if let Some(mn_char) = mn_norm.chars().next() {
            let alt = {
                let raw = format!("{first_char}{mn_char}.{last}");
                if raw.len() > 20 {
                    raw[..20].to_string()
                } else {
                    raw
                }
            };
            candidates.push(alt);
        }
    }

    // Two first letters of first name
    let first_two: String = first.chars().take(2).collect();
    if first_two.len() == 2 {
        let alt2 = {
            let raw = format!("{first_two}.{last}");
            if raw.len() > 20 {
                raw[..20].to_string()
            } else {
                raw
            }
        };
        candidates.push(alt2);
    }

    // Numeric suffixes on the base candidate (last resort)
    for i in 2..=99 {
        candidates.push(format!("{base}{i}"));
    }

    candidates
}

// ── Database-backed pick ──────────────────────────────────────────────────────

/// Pick the first available sAMAccountName from the generated candidates.
///
/// Fetches all existing `sam_account_name` values for the given domain and
/// returns the first candidate not present in that set.
///
/// # Errors
///
/// - Returns [`signapps_common::Error::Database`] if the SQL query fails.
/// - Returns [`signapps_common::Error::Internal`] if all candidates are taken
///   (requires more than 100 accounts with the same base name, extremely
///   unlikely in practice).
///
/// # Panics
///
/// Never panics.
#[tracing::instrument(skip(pool), fields(domain_id = %domain_id, first_name, last_name))]
pub async fn pick_available_sam(
    pool: &PgPool,
    domain_id: Uuid,
    first_name: &str,
    last_name: &str,
    middle_name: Option<&str>,
) -> signapps_common::Result<String> {
    let candidates = generate_sam_candidates(first_name, last_name, middle_name);

    let existing: Vec<(String,)> =
        sqlx::query_as("SELECT sam_account_name FROM ad_user_accounts WHERE domain_id = $1")
            .bind(domain_id)
            .fetch_all(pool)
            .await
            .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let taken: std::collections::HashSet<String> = existing.into_iter().map(|(s,)| s).collect();

    for candidate in &candidates {
        if !taken.contains(candidate) {
            return Ok(candidate.clone());
        }
    }

    Err(signapps_common::Error::Internal(
        "All SAM account name candidates are taken".into(),
    ))
}

// ── DN helpers ────────────────────────────────────────────────────────────────

/// Build a Distinguished Name for an OU from the org-node hierarchy.
///
/// Constructs the string `OU=<node_name>,<parent_dn_or_domain_dn>`.
/// Commas inside `node_name` are escaped with a backslash as required by
/// RFC 4514.
///
/// # Examples
///
/// ```
/// use signapps_ad_core::naming::build_ou_dn;
///
/// assert_eq!(
///     build_ou_dn("DRH", None, "DC=corp,DC=local"),
///     "OU=DRH,DC=corp,DC=local"
/// );
/// assert_eq!(
///     build_ou_dn("Dev Frontend", Some("OU=SI,DC=corp,DC=local"), "DC=corp,DC=local"),
///     "OU=Dev Frontend,OU=SI,DC=corp,DC=local"
/// );
/// ```
///
/// # Panics
///
/// Never panics.
pub fn build_ou_dn(node_name: &str, parent_dn: Option<&str>, domain_dn: &str) -> String {
    let ou_part = format!("OU={}", node_name.replace(',', "\\,"));
    match parent_dn {
        Some(parent) => format!("{ou_part},{parent}"),
        None => format!("{ou_part},{domain_dn}"),
    }
}

/// Build the DC portion of a Distinguished Name from a DNS domain name.
///
/// Each label separated by `'.'` becomes a `DC=<label>` component.
///
/// # Examples
///
/// ```
/// use signapps_ad_core::naming::domain_to_dn;
///
/// assert_eq!(domain_to_dn("corp.local"), "DC=corp,DC=local");
/// assert_eq!(domain_to_dn("ad.example.com"), "DC=ad,DC=example,DC=com");
/// ```
///
/// # Panics
///
/// Never panics.
pub fn domain_to_dn(dns_name: &str) -> String {
    dns_name
        .split('.')
        .map(|part| format!("DC={part}"))
        .collect::<Vec<_>>()
        .join(",")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_accents() {
        assert_eq!(normalize_ascii("Étienne"), "etienne");
        assert_eq!(normalize_ascii("François"), "francois");
        assert_eq!(normalize_ascii("José María"), "jose maria");
        assert_eq!(normalize_ascii("Müller"), "muller");
    }

    #[test]
    fn normalize_drops_non_ascii() {
        // Characters that are not alphanumeric, '.', '-', or ' ' are dropped.
        assert_eq!(normalize_ascii("O'Brien"), "obrien");
        assert_eq!(normalize_ascii("Saïd"), "said");
    }

    #[test]
    fn sam_basic() {
        let c = generate_sam_candidates("Jean", "Dupont", None);
        assert_eq!(c[0], "j.dupont");
        // No middle name: index 1 is the 2-letter variant, not a middle-name variant.
        assert_eq!(c[1], "je.dupont");
    }

    #[test]
    fn sam_with_middle_name() {
        let c = generate_sam_candidates("Jean", "Dupont", Some("Paul"));
        assert_eq!(c[0], "j.dupont");
        assert_eq!(c[1], "jp.dupont"); // middle-name variant
        assert_eq!(c[2], "je.dupont"); // 2-letter variant
    }

    #[test]
    fn sam_accented() {
        let c = generate_sam_candidates("Étienne", "Müller", None);
        assert_eq!(c[0], "e.muller");
    }

    #[test]
    fn sam_truncation() {
        let c = generate_sam_candidates("A", "Verylonglastnamethatexceedstwenty", None);
        assert!(c[0].len() <= 20, "base candidate must be ≤20 chars");
    }

    #[test]
    fn sam_numeric_suffixes_present() {
        let c = generate_sam_candidates("Jean", "Dupont", None);
        // Numeric suffixes start after the positional candidates.
        assert!(c.iter().any(|s| s.ends_with('2')));
        assert!(c.iter().any(|s| s.ends_with("99")));
    }

    #[test]
    fn domain_dn() {
        assert_eq!(domain_to_dn("corp.local"), "DC=corp,DC=local");
        assert_eq!(domain_to_dn("ad.example.com"), "DC=ad,DC=example,DC=com");
    }

    #[test]
    fn ou_dn_root() {
        let dn = build_ou_dn("DRH", None, "DC=corp,DC=local");
        assert_eq!(dn, "OU=DRH,DC=corp,DC=local");
    }

    #[test]
    fn ou_dn_nested() {
        let parent = "OU=SI,DC=corp,DC=local";
        let dn = build_ou_dn("Dev Frontend", Some(parent), "DC=corp,DC=local");
        assert_eq!(dn, "OU=Dev Frontend,OU=SI,DC=corp,DC=local");
    }

    #[test]
    fn ou_dn_escapes_comma() {
        // A node name containing a comma must have it escaped.
        let dn = build_ou_dn("Sales, EMEA", None, "DC=corp,DC=local");
        assert_eq!(dn, r"OU=Sales\, EMEA,DC=corp,DC=local");
    }
}
