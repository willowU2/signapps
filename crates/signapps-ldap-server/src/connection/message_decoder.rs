//! BER → LDAP message decoding.

use crate::codec::ber::{self, BerData, BerElement, BerTag};
use crate::codec::ldap_msg::{
    AddRequest, BindAuthentication, BindRequest, CompareRequest, ExtendedRequest, LdapMessage,
    LdapOperation, ModifyDnRequest, ModifyRequest, SaslCredentials, SearchFilter, SearchRequest,
    SearchScope,
};

/// Decode a BER element into an [`LdapMessage`].
///
/// LDAP message structure (RFC 4511 §4.1.1):
/// ```text
/// LDAPMessage ::= SEQUENCE { messageID INTEGER, protocolOp CHOICE { … } }
/// ```
///
/// # Errors
///
/// Returns `Err(String)` when the element is not a SEQUENCE, has fewer than 2
/// children, or the messageID or protocolOp cannot be decoded.
///
/// # Panics
///
/// No panics.
pub(crate) fn decode_ldap_message(element: &BerElement) -> Result<LdapMessage, String> {
    let children = match &element.data {
        BerData::Constructed(c) => c,
        _ => return Err("Expected SEQUENCE for LDAPMessage".to_string()),
    };

    if children.len() < 2 {
        return Err("LDAPMessage must have at least 2 elements".to_string());
    }

    let message_id =
        ber::decode_integer(&children[0]).map_err(|e| format!("Invalid messageID: {e}"))? as i32;

    let operation = decode_operation(&children[1])?;

    Ok(LdapMessage {
        message_id,
        operation,
    })
}

/// Decode the `protocolOp` CHOICE from its context-specific application tag.
///
/// # Errors
///
/// Returns `Err(String)` for unrecognised or malformed operation tags.
///
/// # Panics
///
/// No panics.
fn decode_operation(element: &BerElement) -> Result<LdapOperation, String> {
    match &element.tag {
        // BindRequest [APPLICATION 0] CONSTRUCTED
        BerTag::Application {
            number: 0,
            constructed: true,
        } => {
            let children = constructed_children(element, "BindRequest")?;
            if children.len() < 3 {
                return Err("BindRequest requires 3 elements".to_string());
            }
            let version = ber::decode_integer(&children[0]).unwrap_or(3) as i32;
            let name = octet_string_to_utf8(&children[1]);

            let authentication = match &children[2].tag {
                BerTag::Context { number: 0, .. } => {
                    let password = primitive_bytes_cloned(&children[2]);
                    BindAuthentication::Simple(password)
                },
                BerTag::Context { number: 3, .. } => {
                    let sasl_children = match &children[2].data {
                        BerData::Constructed(c) => c,
                        _ => return Err("SASL must be constructed".to_string()),
                    };
                    let mechanism = if !sasl_children.is_empty() {
                        octet_string_to_utf8(&sasl_children[0])
                    } else {
                        String::new()
                    };
                    let credentials = sasl_children.get(1).map(primitive_bytes_cloned);
                    BindAuthentication::Sasl(SaslCredentials {
                        mechanism,
                        credentials,
                    })
                },
                _ => BindAuthentication::Simple(vec![]),
            };

            Ok(LdapOperation::BindRequest(BindRequest {
                version,
                name,
                authentication,
            }))
        },

        // UnbindRequest [APPLICATION 2]
        BerTag::Application { number: 2, .. } => Ok(LdapOperation::UnbindRequest),

        // SearchRequest [APPLICATION 3] CONSTRUCTED
        BerTag::Application {
            number: 3,
            constructed: true,
        } => {
            let children = constructed_children(element, "SearchRequest")?;
            if children.len() < 8 {
                return Err("SearchRequest requires 8 elements".to_string());
            }
            let base_dn = octet_string_to_utf8(&children[0]);
            let scope = SearchScope::from_i32(ber::decode_enumerated(&children[1]).unwrap_or(2));
            let deref = crate::codec::ldap_msg::DerefAliases::from_i32(
                ber::decode_enumerated(&children[2]).unwrap_or(0),
            );
            let size_limit = ber::decode_integer(&children[3]).unwrap_or(0) as i32;
            let time_limit = ber::decode_integer(&children[4]).unwrap_or(0) as i32;
            let types_only = ber::decode_boolean(&children[5]).unwrap_or(false);
            let filter = decode_search_filter(&children[6])?;
            let attributes = match &children[7].data {
                BerData::Constructed(attrs) => {
                    attrs.iter().map(octet_string_to_utf8).collect()
                },
                _ => vec![],
            };

            Ok(LdapOperation::SearchRequest(SearchRequest {
                base_dn,
                scope,
                deref_aliases: deref,
                size_limit,
                time_limit,
                types_only,
                filter,
                attributes,
            }))
        },

        // ModifyRequest [APPLICATION 6] CONSTRUCTED
        BerTag::Application {
            number: 6,
            constructed: true,
        } => {
            let children = constructed_children(element, "ModifyRequest")?;
            let dn = if !children.is_empty() {
                octet_string_to_utf8(&children[0])
            } else {
                String::new()
            };
            Ok(LdapOperation::ModifyRequest(ModifyRequest {
                dn,
                changes: vec![],
            }))
        },

        // AddRequest [APPLICATION 8] CONSTRUCTED
        BerTag::Application {
            number: 8,
            constructed: true,
        } => {
            let children = constructed_children(element, "AddRequest")?;
            let dn = if !children.is_empty() {
                octet_string_to_utf8(&children[0])
            } else {
                String::new()
            };
            Ok(LdapOperation::AddRequest(AddRequest {
                dn,
                attributes: vec![],
            }))
        },

        // DeleteRequest [APPLICATION 10] PRIMITIVE
        BerTag::Application { number: 10, .. } => {
            let dn = match &element.data {
                BerData::Primitive(p) => String::from_utf8_lossy(p).to_string(),
                _ => String::new(),
            };
            Ok(LdapOperation::DeleteRequest(dn))
        },

        // ModifyDNRequest [APPLICATION 12] CONSTRUCTED
        BerTag::Application {
            number: 12,
            constructed: true,
        } => {
            let children = constructed_children(element, "ModifyDNRequest")?;
            let dn = children
                .first()
                .map(octet_string_to_utf8)
                .unwrap_or_default();
            let new_rdn = children
                .get(1)
                .map(octet_string_to_utf8)
                .unwrap_or_default();
            let delete_old = children
                .get(2)
                .and_then(|e| ber::decode_boolean(e).ok())
                .unwrap_or(true);
            let new_superior = children.get(3).map(octet_string_to_utf8);
            Ok(LdapOperation::ModifyDnRequest(ModifyDnRequest {
                dn,
                new_rdn,
                delete_old_rdn: delete_old,
                new_superior,
            }))
        },

        // CompareRequest [APPLICATION 14] CONSTRUCTED
        BerTag::Application {
            number: 14,
            constructed: true,
        } => {
            let children = constructed_children(element, "CompareRequest")?;
            let dn = children
                .first()
                .map(octet_string_to_utf8)
                .unwrap_or_default();
            // AVA: SEQUENCE { attributeDesc OCTET STRING, assertionValue OCTET STRING }
            let (attribute, value) = if let Some(ava) = children.get(1) {
                match &ava.data {
                    BerData::Constructed(ava_children) if ava_children.len() >= 2 => {
                        let attr = octet_string_to_utf8(&ava_children[0]);
                        let val = primitive_bytes_cloned(&ava_children[1]);
                        (attr, val)
                    },
                    _ => (String::new(), vec![]),
                }
            } else {
                (String::new(), vec![])
            };
            Ok(LdapOperation::CompareRequest(CompareRequest {
                dn,
                attribute,
                value,
            }))
        },

        // AbandonRequest [APPLICATION 16]
        BerTag::Application { number: 16, .. } => {
            let id = ber::decode_integer(element).unwrap_or(0) as i32;
            Ok(LdapOperation::AbandonRequest(id))
        },

        // ExtendedRequest [APPLICATION 23] CONSTRUCTED
        BerTag::Application {
            number: 23,
            constructed: true,
        } => {
            let children = constructed_children(element, "ExtendedRequest")?;
            let oid = children
                .first()
                .map(primitive_bytes_cloned)
                .map(|b| String::from_utf8_lossy(&b).to_string())
                .unwrap_or_default();
            let value = children.get(1).map(primitive_bytes_cloned);
            Ok(LdapOperation::ExtendedRequest(ExtendedRequest {
                oid,
                value,
            }))
        },

        _ => Err(format!("Unknown LDAP operation tag: {:?}", element.tag)),
    }
}

/// Decode a BER-encoded search filter into a [`SearchFilter`].
///
/// # Errors
///
/// Returns `Err(String)` for unrecognised filter tags or malformed content.
///
/// # Panics
///
/// No panics.
pub(crate) fn decode_search_filter(element: &BerElement) -> Result<SearchFilter, String> {
    match &element.tag {
        // and [0] SET OF Filter
        BerTag::Context {
            number: 0,
            constructed: true,
        } => {
            let children = constructed_children(element, "AND filter")?;
            let filters: Result<Vec<_>, _> = children.iter().map(decode_search_filter).collect();
            Ok(SearchFilter::And(filters?))
        },
        // or [1] SET OF Filter
        BerTag::Context {
            number: 1,
            constructed: true,
        } => {
            let children = constructed_children(element, "OR filter")?;
            let filters: Result<Vec<_>, _> = children.iter().map(decode_search_filter).collect();
            Ok(SearchFilter::Or(filters?))
        },
        // not [2] Filter
        BerTag::Context {
            number: 2,
            constructed: true,
        } => {
            let children = constructed_children(element, "NOT filter")?;
            let child = children.first().ok_or("NOT filter must have one child")?;
            Ok(SearchFilter::Not(Box::new(decode_search_filter(child)?)))
        },
        // equalityMatch [3] AttributeValueAssertion
        BerTag::Context {
            number: 3,
            constructed: true,
        } => {
            let children = constructed_children(element, "equalityMatch")?;
            if children.len() < 2 {
                return Err("equalityMatch requires attribute + value".to_string());
            }
            let attribute = octet_string_to_utf8(&children[0]);
            let value = primitive_bytes_cloned(&children[1]);
            Ok(SearchFilter::EqualityMatch { attribute, value })
        },
        // substrings [4] SubstringFilter
        BerTag::Context {
            number: 4,
            constructed: true,
        } => {
            let children = constructed_children(element, "substrings")?;
            let attribute = children
                .first()
                .map(octet_string_to_utf8)
                .unwrap_or_default();
            Ok(SearchFilter::Substrings {
                attribute,
                substrings: vec![],
            })
        },
        // greaterOrEqual [5] AttributeValueAssertion
        BerTag::Context {
            number: 5,
            constructed: true,
        } => {
            let children = constructed_children(element, "greaterOrEqual")?;
            if children.len() < 2 {
                return Err("greaterOrEqual requires attribute + value".to_string());
            }
            let attribute = octet_string_to_utf8(&children[0]);
            let value = primitive_bytes_cloned(&children[1]);
            Ok(SearchFilter::GreaterOrEqual { attribute, value })
        },
        // lessOrEqual [6] AttributeValueAssertion
        BerTag::Context {
            number: 6,
            constructed: true,
        } => {
            let children = constructed_children(element, "lessOrEqual")?;
            if children.len() < 2 {
                return Err("lessOrEqual requires attribute + value".to_string());
            }
            let attribute = octet_string_to_utf8(&children[0]);
            let value = primitive_bytes_cloned(&children[1]);
            Ok(SearchFilter::LessOrEqual { attribute, value })
        },
        // present [7] AttributeDescription PRIMITIVE
        BerTag::Context {
            number: 7,
            constructed: false,
        } => {
            let attr = match &element.data {
                BerData::Primitive(p) => String::from_utf8_lossy(p).to_string(),
                _ => return Err("present filter must be primitive".to_string()),
            };
            Ok(SearchFilter::Present(attr))
        },
        // approxMatch [8] AttributeValueAssertion
        BerTag::Context {
            number: 8,
            constructed: true,
        } => {
            let children = constructed_children(element, "approxMatch")?;
            if children.len() < 2 {
                return Err("approxMatch requires attribute + value".to_string());
            }
            let attribute = octet_string_to_utf8(&children[0]);
            let value = primitive_bytes_cloned(&children[1]);
            Ok(SearchFilter::ApproxMatch { attribute, value })
        },
        _ => Err(format!("Unknown filter tag: {:?}", element.tag)),
    }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/// Extract children from a constructed BER element, returning an error on failure.
fn constructed_children<'a>(
    element: &'a BerElement,
    name: &str,
) -> Result<&'a Vec<BerElement>, String> {
    match &element.data {
        BerData::Constructed(c) => Ok(c),
        _ => Err(format!("{name} must be constructed")),
    }
}

/// Read the raw bytes from any BER element, regardless of tag.
///
/// For primitive elements returns the payload; for constructed elements
/// returns an empty `Vec`.
fn primitive_bytes_cloned(element: &BerElement) -> Vec<u8> {
    match &element.data {
        BerData::Primitive(p) => p.clone(),
        BerData::Constructed(_) => vec![],
    }
}

/// Decode an OCTET STRING element into a UTF-8 `String`, replacing invalid
/// sequences with the Unicode replacement character.
fn octet_string_to_utf8(element: &BerElement) -> String {
    match ber::decode_octet_string(element) {
        Ok(bytes) => String::from_utf8_lossy(bytes).to_string(),
        Err(_) => {
            // Fall back to raw bytes when the element is not tagged OctetString
            // (e.g. context-tagged implicit primitive).
            match &element.data {
                BerData::Primitive(p) => String::from_utf8_lossy(p).to_string(),
                BerData::Constructed(_) => String::new(),
            }
        },
    }
}
