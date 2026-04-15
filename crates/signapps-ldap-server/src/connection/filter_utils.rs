//! LDAP search filter serialisation.

use crate::codec::ldap_msg::SearchFilter;

/// Convert a [`SearchFilter`] to the LDAP filter string format.
///
/// The resulting string is passed to [`crate::ops::search::handle_search`] which
/// parses it via [`signapps_ad_core::LdapFilter`].
///
/// # Panics
///
/// No panics.
pub(crate) fn search_filter_to_string(filter: &SearchFilter) -> String {
    match filter {
        SearchFilter::And(children) => {
            let parts: Vec<String> = children.iter().map(search_filter_to_string).collect();
            format!("(&{})", parts.join(""))
        },
        SearchFilter::Or(children) => {
            let parts: Vec<String> = children.iter().map(search_filter_to_string).collect();
            format!("(|{})", parts.join(""))
        },
        SearchFilter::Not(child) => {
            format!("(!{})", search_filter_to_string(child))
        },
        SearchFilter::EqualityMatch { attribute, value } => {
            format!("({}={})", attribute, String::from_utf8_lossy(value))
        },
        SearchFilter::Present(attr) => {
            format!("({}=*)", attr)
        },
        SearchFilter::GreaterOrEqual { attribute, value } => {
            format!("({}>={})", attribute, String::from_utf8_lossy(value))
        },
        SearchFilter::LessOrEqual { attribute, value } => {
            format!("({}<={})", attribute, String::from_utf8_lossy(value))
        },
        SearchFilter::Substrings { attribute, .. } => {
            format!("({}=*)", attribute) // Simplified — full substrings wired in Phase 3.
        },
        SearchFilter::ApproxMatch { attribute, value } => {
            format!("({}~={})", attribute, String::from_utf8_lossy(value))
        },
    }
}
