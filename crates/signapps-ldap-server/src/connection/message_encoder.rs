//! LDAP message → BER encoding.

use crate::codec::ber::{self, BerData, BerElement};
use crate::codec::ldap_msg::{LdapMessage, LdapOperation, LdapResult};

/// Encode an [`LdapMessage`] to a BER [`BerElement`] ready for serialisation.
///
/// # Panics
///
/// No panics.
pub(crate) fn encode_ldap_message(msg: &LdapMessage) -> BerElement {
    let id_elem = ber::encode_integer(i64::from(msg.message_id));
    let op_elem = encode_operation(&msg.operation);
    ber::encode_sequence(vec![id_elem, op_elem])
}

/// Encode an LDAP operation into a BER element using the correct application tag.
///
/// # Panics
///
/// No panics.
fn encode_operation(op: &LdapOperation) -> BerElement {
    match op {
        // BindResponse [APPLICATION 1]
        LdapOperation::BindResponse(result) => ber::encode_application(
            1,
            true,
            BerData::Constructed(encode_ldap_result(result)),
        ),

        // SearchResultEntry [APPLICATION 4]
        LdapOperation::SearchResultEntry(entry) => {
            let attrs: Vec<BerElement> = entry
                .attributes
                .iter()
                .map(|attr| {
                    let values: Vec<BerElement> = attr
                        .values
                        .iter()
                        .map(|v| ber::encode_octet_string(v))
                        .collect();
                    ber::encode_sequence(vec![
                        ber::encode_octet_string(attr.attr_type.as_bytes()),
                        ber::encode_set(values),
                    ])
                })
                .collect();

            ber::encode_application(
                4,
                true,
                BerData::Constructed(vec![
                    ber::encode_octet_string(entry.dn.as_bytes()),
                    ber::encode_sequence(attrs),
                ]),
            )
        }

        // SearchResultDone [APPLICATION 5]
        LdapOperation::SearchResultDone(result) => ber::encode_application(
            5,
            true,
            BerData::Constructed(encode_ldap_result(result)),
        ),

        // ModifyResponse [APPLICATION 7]
        LdapOperation::ModifyResponse(result) => ber::encode_application(
            7,
            true,
            BerData::Constructed(encode_ldap_result(result)),
        ),

        // AddResponse [APPLICATION 9]
        LdapOperation::AddResponse(result) => ber::encode_application(
            9,
            true,
            BerData::Constructed(encode_ldap_result(result)),
        ),

        // DeleteResponse [APPLICATION 11]
        LdapOperation::DeleteResponse(result) => ber::encode_application(
            11,
            true,
            BerData::Constructed(encode_ldap_result(result)),
        ),

        // ModifyDNResponse [APPLICATION 13]
        LdapOperation::ModifyDnResponse(result) => ber::encode_application(
            13,
            true,
            BerData::Constructed(encode_ldap_result(result)),
        ),

        // CompareResponse [APPLICATION 15]
        LdapOperation::CompareResponse(result) => ber::encode_application(
            15,
            true,
            BerData::Constructed(encode_ldap_result(result)),
        ),

        // ExtendedResponse [APPLICATION 24]
        LdapOperation::ExtendedResponse(resp) => {
            let mut children = encode_ldap_result(&resp.result);
            if let Some(oid) = &resp.oid {
                children.push(ber::encode_context(
                    10,
                    false,
                    BerData::Primitive(oid.as_bytes().to_vec()),
                ));
            }
            if let Some(val) = &resp.value {
                children.push(ber::encode_context(
                    11,
                    false,
                    BerData::Primitive(val.clone()),
                ));
            }
            ber::encode_application(24, true, BerData::Constructed(children))
        }

        _ => {
            // Server never sends request-type operations.
            ber::encode_sequence(vec![])
        }
    }
}

/// Build the three-element BER representation of an [`LdapResult`].
///
/// Used by all response encoders (RFC 4511 §4.1.9).
pub(crate) fn encode_ldap_result(result: &LdapResult) -> Vec<BerElement> {
    vec![
        ber::encode_enumerated(result.result_code as i32),
        ber::encode_octet_string(result.matched_dn.as_bytes()),
        ber::encode_octet_string(result.diagnostic_message.as_bytes()),
    ]
}
