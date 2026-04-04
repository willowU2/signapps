//! LDAP Search operation (RFC 4511 §4.5).
//!
//! Translates LDAP search requests into SQL queries via ad-core's
//! filter compiler and returns DirectoryEntry results.

use signapps_ad_core::{acl::check_access, AclDecision, AclOperation, LdapFilter};
use signapps_common::Result;
use sqlx::PgPool;
use tracing;

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

/// Handle an LDAP search request.
///
/// For RootDSE (empty base DN + base scope), returns server information
/// without requiring authentication.  All other searches require at least
/// anonymous (role 0) access, which the ACL layer permits for reads.
///
/// The filter is compiled to a PostgreSQL `WHERE` fragment via
/// [`LdapFilter::to_sql`].  Full result hydration (table joins, attribute
/// projection) will be wired in a later task when the
/// [`signapps_ad_core::DirectoryEntry`] builder is integrated.
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
/// let entries = handle_search(&pool, 0, "", Scope::BaseObject, "(objectClass=*)", &[], "example.com").await?;
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

    // TODO: Wire full SQL execution with DirectoryEntry builder and table joins.
    // The compiled `where_clause` and `params` are ready; the multi-table JOIN
    // (identity.users + workforce_org_nodes + groups) will be implemented in the
    // DirectoryEntry hydration task.
    let _ = (pool, requested_attrs);

    Ok(vec![])
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
