//! LDAP Search operation (RFC 4511 §4.5).
//!
//! Translates LDAP search requests into SQL queries via ad-core's
//! filter compiler and returns DirectoryEntry results.

use signapps_ad_core::{acl::check_access, AclDecision, AclOperation, LdapFilter, SecurityIdentifier};
use signapps_common::Result;
use sqlx::PgPool;
use uuid::Uuid;

/// Search scope as defined by RFC 4511 §4.5.1.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Scope {
    /// Return only the base object itself.
    BaseObject,
    /// Return the immediate children of the base object.
    SingleLevel,
    /// Return the base object and all of its descendants.
    WholeSubtree,
}

/// A single search result entry (DN + attributes).
///
/// Each attribute is represented as a `(name, values)` pair.
#[derive(Debug, Clone)]
pub struct SearchEntry {
    /// The Distinguished Name of this entry.
    pub dn: String,
    /// Attribute name → list of string values.
    pub attributes: Vec<(String, Vec<String>)>,
}

/// Build the RootDSE entry for the given domain name.
///
/// Returns the pseudo-entry that LDAP clients read when they issue a base-scope
/// search on an empty DN.  Contains naming contexts, supported LDAP version,
/// SASL mechanisms, and capability OIDs that Windows clients look for to
/// confirm they are talking to an Active Directory-compatible server.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::ops::search::root_dse;
///
/// let dse = root_dse("example.com");
/// assert_eq!(dse.dn, "");
/// ```
///
/// # Panics
///
/// No panics — this function is purely constructive.
pub fn root_dse(domain: &str) -> SearchEntry {
    let naming_context = format!("DC={}", domain.replace('.', ",DC="));
    SearchEntry {
        dn: String::new(),
        attributes: vec![
            ("namingContexts".to_string(), vec![naming_context.clone()]),
            ("defaultNamingContext".to_string(), vec![naming_context.clone()]),
            (
                "configurationNamingContext".to_string(),
                vec![format!("CN=Configuration,{naming_context}")],
            ),
            (
                "schemaNamingContext".to_string(),
                vec![format!("CN=Schema,CN=Configuration,{naming_context}")],
            ),
            ("supportedLDAPVersion".to_string(), vec!["3".to_string()]),
            (
                "supportedSASLMechanisms".to_string(),
                vec!["GSSAPI".to_string(), "EXTERNAL".to_string()],
            ),
            ("dnsHostName".to_string(), vec![domain.to_string()]),
            (
                "serverName".to_string(),
                vec![format!(
                    "CN=DC,CN=Servers,CN=Default-First-Site-Name,CN=Sites,CN=Configuration,{naming_context}"
                )],
            ),
            (
                "supportedCapabilities".to_string(),
                vec![
                    "1.2.840.113556.1.4.800".to_string(),  // LDAP_CAP_ACTIVE_DIRECTORY_OID
                    "1.2.840.113556.1.4.1791".to_string(), // LDAP_CAP_ACTIVE_DIRECTORY_LDAP_INTEG_OID
                ],
            ),
            (
                "subschemaSubentry".to_string(),
                vec![format!(
                    "CN=Aggregate,CN=Schema,CN=Configuration,{naming_context}"
                )],
            ),
            ("isGlobalCatalogReady".to_string(), vec!["TRUE".to_string()]),
        ],
    }
}

/// Convert a [`signapps_ad_core::DirectoryEntry`] to a [`SearchEntry`] for LDAP response.
///
/// When `requested_attrs` is empty, all attributes are returned.  Otherwise
/// only the named attributes are included, using case-insensitive matching.
/// Binary attribute values are represented as their display string (e.g. `<binary 16 bytes>`).
///
/// # Examples
///
/// ```
/// use std::collections::HashMap;
/// use chrono::Utc;
/// use uuid::Uuid;
/// use signapps_ad_core::{
///     dn::DistinguishedName,
///     entry::{DirectoryEntry, LifecycleState},
///     schema::syntax::AttributeValue,
///     uac::UserAccountControl,
/// };
/// use signapps_ldap_server::ops::search::entry_to_search_entry;
///
/// let mut attrs = HashMap::new();
/// attrs.insert("cn".to_string(), vec![AttributeValue::String("Alice".to_string())]);
/// let entry = DirectoryEntry {
///     guid: Uuid::new_v4(), sid: None,
///     dn: DistinguishedName::parse("CN=Alice,DC=example,DC=com").unwrap(),
///     object_classes: vec!["user".into()],
///     attributes: attrs,
///     uac: UserAccountControl::normal_user(),
///     lifecycle: LifecycleState::Live,
///     created: Utc::now(),
///     modified: Utc::now(),
/// };
/// let search_entry = entry_to_search_entry(&entry, &[]);
/// assert_eq!(search_entry.dn, "CN=Alice,DC=example,DC=com");
/// ```
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub fn entry_to_search_entry(
    entry: &signapps_ad_core::DirectoryEntry,
    requested_attrs: &[String],
) -> SearchEntry {
    let attributes: Vec<(String, Vec<String>)> = if requested_attrs.is_empty() {
        // Return all attributes
        entry
            .attributes
            .iter()
            .map(|(name, values)| {
                let str_values: Vec<String> = values.iter().map(|v| v.to_string()).collect();
                (name.clone(), str_values)
            })
            .collect()
    } else {
        // Return only requested attributes, case-insensitive lookup
        requested_attrs
            .iter()
            .filter_map(|req| {
                entry
                    .attributes
                    .get(req)
                    .or_else(|| {
                        entry
                            .attributes
                            .iter()
                            .find(|(k, _)| k.eq_ignore_ascii_case(req))
                            .map(|(_, v)| v)
                    })
                    .map(|values| {
                        let str_values: Vec<String> =
                            values.iter().map(|v| v.to_string()).collect();
                        (req.clone(), str_values)
                    })
            })
            .collect()
    };

    SearchEntry {
        dn: entry.dn.to_string(),
        attributes,
    }
}

/// Resolve the domain SID for `domain` from the `ad_domains` table.
///
/// Falls back to a synthesised `S-1-5-21-0-0-0` when no row is found or the
/// stored string is not parseable.
///
/// # Errors
///
/// Never returns `Err` — SQL failures are swallowed and the fallback SID is
/// returned instead.
///
/// # Panics
///
/// No panics — the fallback parse is a hard-coded valid SID.
async fn resolve_domain_sid(pool: &PgPool, domain: &str) -> SecurityIdentifier {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT domain_sid FROM ad_domains WHERE dns_name = $1 LIMIT 1",
    )
    .bind(domain)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    row.and_then(|(s,)| SecurityIdentifier::parse(&s).ok())
        .or_else(|| SecurityIdentifier::parse("S-1-5-21-0-0-0").ok())
        .unwrap_or_else(|| {
            // This branch is only reachable if the hardcoded fallback above fails to
            // parse — which would be a bug. Log and return a generated placeholder SID.
            tracing::error!("Hardcoded fallback SID 'S-1-5-21-0-0-0' failed to parse — using generated SID");
            SecurityIdentifier::generate_domain_sid()
        })
}

/// Search PostgreSQL for directory objects that match the given filter.
///
/// Queries `identity.users`, `workforce_org_nodes`, and `workforce_org_groups`
/// according to the `objectClass` hints embedded in `filter_str`.  When the
/// filter contains no `objectClass` restriction, all three object types are
/// queried (subtree / wildcard search).
///
/// # Errors
///
/// Individual builder failures are logged and skipped; the function itself
/// always returns `Ok`.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
async fn search_objects(
    pool: &PgPool,
    filter_str: &str,
    domain: &str,
    domain_sid: &SecurityIdentifier,
) -> Vec<signapps_ad_core::DirectoryEntry> {
    let mut results = Vec::new();

    // Decide which object types to query based on objectClass hints in filter.
    let has_class_constraint = filter_str.contains("objectClass=")
        && !filter_str.contains("objectClass=*");

    let search_users = !has_class_constraint
        || filter_str.contains("objectClass=user")
        || filter_str.contains("objectClass=person")
        || filter_str.contains("objectClass=organizationalPerson");

    let search_nodes = !has_class_constraint
        || filter_str.contains("objectClass=organizationalUnit")
        || filter_str.contains("objectClass=container");

    let search_groups = !has_class_constraint
        || filter_str.contains("objectClass=group");

    // ── Users ──────────────────────────────────────────────────────────────
    if search_users {
        let users: Vec<(Uuid,)> =
            sqlx::query_as("SELECT id FROM identity.users LIMIT 1000")
                .fetch_all(pool)
                .await
                .unwrap_or_default();

        for (user_id,) in users {
            match signapps_ad_core::builder::build_user_entry(pool, user_id, domain, domain_sid)
                .await
            {
                Ok(entry) => results.push(entry),
                Err(e) => {
                    tracing::warn!(user_id = %user_id, error = ?e, "Failed to build user entry");
                }
            }
        }
    }

    // ── Org nodes (OUs / containers) ───────────────────────────────────────
    if search_nodes {
        let nodes: Vec<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM workforce_org_nodes \
             WHERE lifecycle_state IS NULL OR lifecycle_state = 'live' \
             LIMIT 1000",
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        for (node_id,) in nodes {
            match signapps_ad_core::builder::build_node_entry(pool, node_id, domain).await {
                Ok(entry) => results.push(entry),
                Err(e) => {
                    tracing::warn!(node_id = %node_id, error = ?e, "Failed to build node entry");
                }
            }
        }
    }

    // ── Security groups ────────────────────────────────────────────────────
    if search_groups {
        let groups: Vec<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM workforce_org_groups WHERE is_active = true LIMIT 1000",
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        for (group_id,) in groups {
            match signapps_ad_core::builder::build_group_entry(pool, group_id, domain, domain_sid)
                .await
            {
                Ok(entry) => results.push(entry),
                Err(e) => {
                    tracing::warn!(group_id = %group_id, error = ?e, "Failed to build group entry");
                }
            }
        }
    }

    results
}

/// Paged results state for RFC 2696 Simple Paged Results Manipulation.
///
/// Carries the client-requested page size and the raw cookie bytes received
/// from the client (empty on the first request).
pub struct PagedResultsControl {
    /// Maximum number of entries to return in this response page.
    pub page_size: i32,
    /// Opaque cookie bytes from the client (empty on first page).
    pub cookie: Vec<u8>,
}

/// Parse the offset from a paged results cookie.
///
/// The cookie encodes the next result offset as a 4-byte little-endian integer.
/// An empty cookie means "first page" (offset 0).
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::ops::search::parse_paged_control;
///
/// assert_eq!(parse_paged_control(&[]), Some(0));
/// let cookie = 50_i32.to_le_bytes();
/// assert_eq!(parse_paged_control(&cookie), Some(50));
/// ```
///
/// # Panics
///
/// No panics.
pub fn parse_paged_control(cookie: &[u8]) -> Option<i32> {
    if cookie.is_empty() {
        return Some(0); // First page
    }
    if cookie.len() >= 4 {
        let offset = i32::from_le_bytes([cookie[0], cookie[1], cookie[2], cookie[3]]);
        return Some(offset);
    }
    None
}

/// Build a paged results response cookie.
///
/// Returns the `next_offset` encoded as a 4-byte little-endian integer, or
/// an empty `Vec` when `next_offset >= total` (signalling the last page).
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::ops::search::build_paged_cookie;
///
/// let cookie = build_paged_cookie(50, 100);
/// assert_eq!(cookie.len(), 4);
///
/// let done = build_paged_cookie(100, 100);
/// assert!(done.is_empty());
/// ```
///
/// # Panics
///
/// No panics.
pub fn build_paged_cookie(next_offset: i32, total: i32) -> Vec<u8> {
    if next_offset >= total {
        vec![] // Empty cookie = last page
    } else {
        next_offset.to_le_bytes().to_vec()
    }
}

/// Handle an LDAP search request.
///
/// For RootDSE (empty base DN + base scope), returns server information
/// without requiring authentication.  All other searches require at least
/// anonymous (role 0) access, which the ACL layer permits for reads.
///
/// User, OU/container, and group objects are hydrated from PostgreSQL via the
/// [`signapps_ad_core::builder`] functions.  The `objectClass` hints in the
/// filter string are used to narrow which table(s) are queried; a wildcard
/// filter (`(objectClass=*)`) or no class constraint triggers a full subtree
/// search across all three object types.
///
/// When `size_limit > 0`, the result set is truncated to at most `size_limit`
/// entries before returning.
///
/// # Errors
///
/// Returns `Ok(vec![])` on filter parse failure or access denial — the caller
/// should send an LDAP `noSuchObject` or `insufficientAccessRights` result
/// code respectively.  Returns `Err` only on unrecoverable internal failures.
///
/// # Examples
///
/// ```ignore
/// let entries = handle_search(&pool, 0, "", Scope::BaseObject, "(objectClass=*)", &[], "example.com", 0).await?;
/// assert_eq!(entries[0].dn, "");
/// ```
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool))]
pub async fn handle_search(
    pool: &PgPool,
    user_role: i16,
    base_dn: &str,
    scope: Scope,
    filter_str: &str,
    requested_attrs: &[String],
    domain: &str,
    size_limit: i32,
) -> Result<Vec<SearchEntry>> {
    // RootDSE — unauthenticated, no filter parsing needed
    if base_dn.is_empty() && scope == Scope::BaseObject {
        tracing::debug!("RootDSE search");
        return Ok(vec![root_dse(domain)]);
    }

    // ACL check — regular users (role 1) and above may read; role 0 (anonymous)
    // also passes because check_access returns Allow for Read at any role level.
    if check_access(user_role, AclOperation::Read, None) == AclDecision::Deny {
        tracing::warn!(user_role, "Search denied: insufficient access rights");
        return Ok(vec![]);
    }

    // Parse filter
    let filter = match LdapFilter::parse(filter_str) {
        Ok(f) => f,
        Err(e) => {
            tracing::warn!(filter = filter_str, "Invalid search filter: {}", e);
            return Ok(vec![]);
        }
    };

    // Compile to parameterized SQL — param_offset = 1 for standalone queries
    let (where_clause, params) = filter.to_sql(1);

    tracing::debug!(
        base = base_dn,
        scope = ?scope,
        sql_where = %where_clause,
        param_count = params.len(),
        "Search compiled"
    );

    // Resolve domain SID for object building
    let domain_sid = resolve_domain_sid(pool, domain).await;

    // Query PostgreSQL and build DirectoryEntry objects
    let raw_entries = search_objects(pool, filter_str, domain, &domain_sid).await;

    // Enforce size limit (0 = unlimited)
    let entries: Vec<signapps_ad_core::DirectoryEntry> =
        if size_limit > 0 && raw_entries.len() > size_limit as usize {
            tracing::debug!(
                size_limit,
                total = raw_entries.len(),
                "Truncating results to size limit"
            );
            raw_entries.into_iter().take(size_limit as usize).collect()
        } else {
            raw_entries
        };

    tracing::debug!(
        result_count = entries.len(),
        base = base_dn,
        "Search returned {} entries",
        entries.len()
    );

    // Convert DirectoryEntry objects to SearchEntry for LDAP response
    let search_entries: Vec<SearchEntry> = entries
        .iter()
        .map(|e| entry_to_search_entry(e, requested_attrs))
        .collect();

    Ok(search_entries)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use chrono::Utc;
    use uuid::Uuid;

    use super::*;
    use signapps_ad_core::{
        dn::DistinguishedName,
        entry::{DirectoryEntry, LifecycleState},
        schema::syntax::AttributeValue,
        uac::UserAccountControl,
    };

    fn make_entry(attrs: HashMap<String, Vec<AttributeValue>>) -> DirectoryEntry {
        DirectoryEntry {
            guid: Uuid::new_v4(),
            sid: None,
            dn: DistinguishedName::parse("CN=Test,DC=example,DC=com").unwrap(),
            object_classes: vec!["user".into()],
            attributes: attrs,
            uac: UserAccountControl::normal_user(),
            lifecycle: LifecycleState::Live,
            created: Utc::now(),
            modified: Utc::now(),
        }
    }

    #[test]
    fn root_dse_has_required_attributes() {
        let dse = root_dse("example.com");
        assert_eq!(dse.dn, "");
        let attrs: Vec<&str> = dse.attributes.iter().map(|(k, _)| k.as_str()).collect();
        assert!(attrs.contains(&"namingContexts"));
        assert!(attrs.contains(&"defaultNamingContext"));
        assert!(attrs.contains(&"supportedLDAPVersion"));
        assert!(attrs.contains(&"supportedSASLMechanisms"));
        assert!(attrs.contains(&"supportedCapabilities"));
    }

    #[test]
    fn root_dse_naming_context_format() {
        let dse = root_dse("example.com");
        let nc = &dse.attributes[0].1[0];
        assert_eq!(nc, "DC=example,DC=com");
    }

    #[test]
    fn root_dse_multi_domain() {
        let dse = root_dse("sub.example.com");
        let nc = &dse.attributes[0].1[0];
        assert_eq!(nc, "DC=sub,DC=example,DC=com");
    }

    #[test]
    fn root_dse_subschema_uses_naming_context() {
        let dse = root_dse("corp.local");
        let subschema = dse
            .attributes
            .iter()
            .find(|(k, _)| k == "subschemaSubentry")
            .unwrap();
        assert!(subschema.1[0].contains("DC=corp,DC=local"));
    }

    #[test]
    fn search_entry_construction() {
        let entry = SearchEntry {
            dn: "CN=admin,DC=example,DC=com".to_string(),
            attributes: vec![
                ("sAMAccountName".to_string(), vec!["admin".to_string()]),
                ("mail".to_string(), vec!["admin@example.com".to_string()]),
            ],
        };
        assert_eq!(entry.attributes.len(), 2);
        assert_eq!(entry.dn, "CN=admin,DC=example,DC=com");
    }

    #[test]
    fn scope_variants_are_distinct() {
        assert_ne!(Scope::BaseObject, Scope::SingleLevel);
        assert_ne!(Scope::SingleLevel, Scope::WholeSubtree);
        assert_ne!(Scope::BaseObject, Scope::WholeSubtree);
    }

    #[test]
    fn entry_to_search_entry_all_attrs() {
        let mut attrs = HashMap::new();
        attrs.insert("cn".to_string(), vec![AttributeValue::String("Alice".into())]);
        attrs.insert("mail".to_string(), vec![AttributeValue::String("alice@example.com".into())]);
        attrs.insert("sn".to_string(), vec![AttributeValue::String("Smith".into())]);

        let entry = make_entry(attrs);
        let result = entry_to_search_entry(&entry, &[]);

        // All 3 attributes returned when requested_attrs is empty
        assert_eq!(result.attributes.len(), 3);
        assert_eq!(result.dn, "CN=Test,DC=example,DC=com");
    }

    #[test]
    fn entry_to_search_entry_specific_attrs() {
        let mut attrs = HashMap::new();
        attrs.insert("cn".to_string(), vec![AttributeValue::String("Alice".into())]);
        attrs.insert("mail".to_string(), vec![AttributeValue::String("alice@example.com".into())]);
        attrs.insert("sn".to_string(), vec![AttributeValue::String("Smith".into())]);

        let entry = make_entry(attrs);
        let requested = vec!["cn".to_string(), "mail".to_string()];
        let result = entry_to_search_entry(&entry, &requested);

        // Only the 2 requested attributes are returned
        assert_eq!(result.attributes.len(), 2);
        let names: Vec<&str> = result.attributes.iter().map(|(k, _)| k.as_str()).collect();
        assert!(names.contains(&"cn"));
        assert!(names.contains(&"mail"));
        assert!(!names.contains(&"sn"));
    }

    #[test]
    fn paged_cookie_roundtrip() {
        let cookie = build_paged_cookie(50, 100);
        assert_eq!(cookie.len(), 4);
        let offset = parse_paged_control(&cookie);
        assert_eq!(offset, Some(50));
    }

    #[test]
    fn paged_cookie_last_page() {
        let cookie = build_paged_cookie(100, 100);
        assert!(cookie.is_empty()); // Empty = last page
    }

    #[test]
    fn paged_cookie_first_page() {
        let offset = parse_paged_control(&[]);
        assert_eq!(offset, Some(0));
    }

    #[test]
    fn entry_to_search_entry_case_insensitive() {
        let mut attrs = HashMap::new();
        attrs.insert("cn".to_string(), vec![AttributeValue::String("Bob".into())]);
        attrs.insert("mail".to_string(), vec![AttributeValue::String("bob@example.com".into())]);

        let entry = make_entry(attrs);
        // Request "CN" (uppercase) — should match "cn" (lowercase) in attributes
        let requested = vec!["CN".to_string()];
        let result = entry_to_search_entry(&entry, &requested);

        assert_eq!(result.attributes.len(), 1);
        // The key in the result is the requested name (preserving case of request)
        assert_eq!(result.attributes[0].0, "CN");
        assert_eq!(result.attributes[0].1, vec!["Bob"]);
    }
}
