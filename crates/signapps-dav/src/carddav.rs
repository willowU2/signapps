//! CardDAV REPORT helpers.
//!
//! Provides response builders for CardDAV `addressbook-query` and
//! `addressbook-multiget` REPORT methods. Responses are built as DAV
//! multistatus XML with embedded `address-data` (vCard).

use crate::xml::{build_multistatus, MultistatusResponse};

/// A contact resource for inclusion in a CardDAV multistatus response.
///
/// # Examples
///
/// ```
/// use signapps_dav::carddav::ContactResource;
/// let res = ContactResource {
///     href: "/dav/addressbooks/user@ex.com/book/contact1.vcf".to_string(),
///     etag: "\"abc123\"".to_string(),
///     address_data: "BEGIN:VCARD\r\n...END:VCARD".to_string(),
/// };
/// ```
#[derive(Debug, Clone)]
pub struct ContactResource {
    /// The href (path) of the resource.
    pub href: String,
    /// ETag of the resource (quoted string).
    pub etag: String,
    /// Full vCard data as a string.
    pub address_data: String,
}

/// An addressbook collection for PROPFIND responses.
///
/// # Examples
///
/// ```
/// use signapps_dav::carddav::AddressbookInfo;
/// let info = AddressbookInfo {
///     href: "/dav/addressbooks/user@ex.com/default/".to_string(),
///     display_name: "Contacts".to_string(),
///     ctag: "\"ctag-v1\"".to_string(),
///     description: None,
/// };
/// ```
#[derive(Debug, Clone)]
pub struct AddressbookInfo {
    /// The href (path) of the addressbook collection.
    pub href: String,
    /// Display name of the addressbook.
    pub display_name: String,
    /// CTag (collection tag) for sync detection.
    pub ctag: String,
    /// Addressbook description.
    pub description: Option<String>,
}

/// Build a CardDAV multistatus response for a list of contact resources.
///
/// Used for `addressbook-query` and `addressbook-multiget` REPORT responses.
///
/// # Examples
///
/// ```
/// use signapps_dav::carddav::{ContactResource, build_addressbook_multiget_response};
/// let resources = vec![ContactResource {
///     href: "/dav/addressbooks/u@ex.com/book/c.vcf".to_string(),
///     etag: "\"v1\"".to_string(),
///     address_data: "BEGIN:VCARD\r\nEND:VCARD".to_string(),
/// }];
/// let xml = build_addressbook_multiget_response(&resources);
/// assert!(xml.contains("address-data"));
/// ```
///
/// # Panics
///
/// None.
pub fn build_addressbook_multiget_response(resources: &[ContactResource]) -> String {
    let responses: Vec<MultistatusResponse> = resources
        .iter()
        .map(|r| MultistatusResponse {
            href: r.href.clone(),
            found_props: vec![
                ("D:getetag".to_string(), r.etag.clone()),
                ("CR:address-data".to_string(), r.address_data.clone()),
            ],
            status: "HTTP/1.1 200 OK".to_string(),
        })
        .collect();

    build_multistatus(&responses)
}

/// Build a CardDAV PROPFIND response for addressbook collections.
///
/// Returns a multistatus XML listing addressbook properties (displayname,
/// resourcetype, ctag).
///
/// # Examples
///
/// ```
/// use signapps_dav::carddav::{AddressbookInfo, build_addressbook_propfind_response};
/// let books = vec![AddressbookInfo {
///     href: "/dav/addressbooks/u@ex.com/default/".to_string(),
///     display_name: "Contacts".to_string(),
///     ctag: "\"ct1\"".to_string(),
///     description: Some("My contacts".to_string()),
/// }];
/// let xml = build_addressbook_propfind_response(&books);
/// assert!(xml.contains("Contacts"));
/// ```
///
/// # Panics
///
/// None.
pub fn build_addressbook_propfind_response(addressbooks: &[AddressbookInfo]) -> String {
    let responses: Vec<MultistatusResponse> = addressbooks
        .iter()
        .map(|ab| {
            let mut props = vec![
                ("D:displayname".to_string(), ab.display_name.clone()),
                (
                    "D:resourcetype".to_string(),
                    "<D:collection/><CR:addressbook/>".to_string(),
                ),
                ("CS:getctag".to_string(), ab.ctag.clone()),
            ];
            if let Some(ref desc) = ab.description {
                props.push(("CR:addressbook-description".to_string(), desc.clone()));
            }
            MultistatusResponse {
                href: ab.href.clone(),
                found_props: props,
                status: "HTTP/1.1 200 OK".to_string(),
            }
        })
        .collect();

    build_multistatus(&responses)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_addressbook_multiget_response() {
        let resources = vec![
            ContactResource {
                href: "/dav/addressbooks/u@ex.com/book/c1.vcf".to_string(),
                etag: "\"v1\"".to_string(),
                address_data: "BEGIN:VCARD\r\nFN:John\r\nEND:VCARD".to_string(),
            },
            ContactResource {
                href: "/dav/addressbooks/u@ex.com/book/c2.vcf".to_string(),
                etag: "\"v2\"".to_string(),
                address_data: "BEGIN:VCARD\r\nFN:Jane\r\nEND:VCARD".to_string(),
            },
        ];
        let xml = build_addressbook_multiget_response(&resources);
        assert!(xml.contains("<D:multistatus"));
        assert!(xml.contains("c1.vcf"));
        assert!(xml.contains("c2.vcf"));
        assert!(xml.contains("address-data"));
    }

    #[test]
    fn test_build_addressbook_propfind_response() {
        let books = vec![AddressbookInfo {
            href: "/dav/addressbooks/u@ex.com/default/".to_string(),
            display_name: "My Contacts".to_string(),
            ctag: "\"ctag-99\"".to_string(),
            description: Some("Personal contacts".to_string()),
        }];
        let xml = build_addressbook_propfind_response(&books);
        assert!(xml.contains("My Contacts"));
        assert!(xml.contains("ctag-99"));
        assert!(xml.contains("Personal contacts"));
        assert!(xml.contains("<CR:addressbook/>"));
    }
}
