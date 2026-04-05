use super::message_decoder::{decode_ldap_message, decode_search_filter};
use super::message_encoder::encode_ldap_message;
use crate::codec::ber::{self, BerData, BerElement, BerTag};
use crate::codec::ber::{encode, encode_integer, encode_octet_string, encode_sequence};
use crate::codec::ldap_msg::{LdapMessage, LdapOperation, LdapResult, PartialAttribute, ResultCode, SearchFilter, SearchResultEntry};

use super::filter_utils::search_filter_to_string;

/// Build a minimal LDAP BindRequest BER message.
fn bind_request_bytes(message_id: i32, dn: &str, password: &[u8]) -> Vec<u8> {
    // authentication [0] PRIMITIVE (simple)
    let auth = BerElement {
        tag: BerTag::Context { number: 0, constructed: false },
        data: BerData::Primitive(password.to_vec()),
    };
    // BindRequest [APPLICATION 0] CONSTRUCTED { version, name, auth }
    let bind_req = ber::encode_context(
        0,
        true,
        BerData::Constructed(vec![
            encode_integer(3),
            encode_octet_string(dn.as_bytes()),
            auth,
        ]),
    );
    let msg = encode_sequence(vec![encode_integer(i64::from(message_id)), bind_req]);
    encode(&msg)
}

#[test]
fn decode_bind_request_roundtrip() {
    let bytes = bind_request_bytes(1, "CN=admin,DC=example,DC=com", b"secret");
    let (elem, rest) = ber::decode(&bytes).expect("should decode");
    assert!(rest.is_empty(), "no leftover bytes");

    let msg = decode_ldap_message(&elem).expect("should parse as LdapMessage");
    assert_eq!(msg.message_id, 1);
    match &msg.operation {
        LdapOperation::BindRequest(req) => {
            assert_eq!(req.name, "CN=admin,DC=example,DC=com");
            assert_eq!(req.version, 3);
            match &req.authentication {
                crate::codec::ldap_msg::BindAuthentication::Simple(pw) => {
                    assert_eq!(pw, b"secret")
                }
                crate::codec::ldap_msg::BindAuthentication::Sasl(_) => {
                    panic!("expected simple auth")
                }
            }
        }
        op => panic!("unexpected operation: {op:?}"),
    }
}

#[test]
fn encode_bind_response_roundtrip() {
    let msg = LdapMessage {
        message_id: 1,
        operation: LdapOperation::BindResponse(LdapResult::success()),
    };
    let ber_elem = encode_ldap_message(&msg);
    let bytes = ber::encode(&ber_elem);

    // Minimum: 30 LL 02 01 01 (msgid) 61 LL 0A 01 00 04 00 04 00
    assert!(bytes.len() > 4, "encoded message should have content");
    // Verify the outer SEQUENCE tag.
    assert_eq!(bytes[0], 0x30, "outer tag must be SEQUENCE");
}

#[test]
fn encode_bind_error_response() {
    let msg = LdapMessage {
        message_id: 2,
        operation: LdapOperation::BindResponse(LdapResult::error(
            ResultCode::InvalidCredentials,
            "bad password",
        )),
    };
    let ber_elem = encode_ldap_message(&msg);
    let bytes = ber::encode(&ber_elem);
    assert!(!bytes.is_empty());
}

#[test]
fn decode_unbind_request() {
    // UnbindRequest [APPLICATION 2] NULL (length 0)
    let unbind = BerElement {
        tag: BerTag::Context { number: 2, constructed: false },
        data: BerData::Primitive(vec![]),
    };
    let msg_elem = encode_sequence(vec![encode_integer(5), unbind]);
    let bytes = ber::encode(&msg_elem);
    let (elem, _) = ber::decode(&bytes).unwrap();
    let msg = decode_ldap_message(&elem).expect("should parse as LdapMessage");
    assert_eq!(msg.message_id, 5);
    assert!(matches!(msg.operation, LdapOperation::UnbindRequest));
}

#[test]
fn filter_to_string_equality() {
    let f = SearchFilter::EqualityMatch {
        attribute: "cn".to_string(),
        value: b"Alice".to_vec(),
    };
    assert_eq!(search_filter_to_string(&f), "(cn=Alice)");
}

#[test]
fn filter_to_string_present() {
    let f = SearchFilter::Present("objectClass".to_string());
    assert_eq!(search_filter_to_string(&f), "(objectClass=*)");
}

#[test]
fn filter_to_string_and() {
    let f = SearchFilter::And(vec![
        SearchFilter::Present("objectClass".to_string()),
        SearchFilter::EqualityMatch {
            attribute: "cn".to_string(),
            value: b"Bob".to_vec(),
        },
    ]);
    assert_eq!(search_filter_to_string(&f), "(&(objectClass=*)(cn=Bob))");
}

#[test]
fn search_result_entry_encoded() {
    let msg = LdapMessage {
        message_id: 3,
        operation: LdapOperation::SearchResultEntry(SearchResultEntry {
            dn: "CN=Alice,DC=example,DC=com".to_string(),
            attributes: vec![PartialAttribute {
                attr_type: "cn".to_string(),
                values: vec![b"Alice".to_vec()],
            }],
        }),
    };
    let bytes = ber::encode(&encode_ldap_message(&msg));
    assert!(!bytes.is_empty());
    // Application tag 4 → 0x64
    // The application tag appears after the outer SEQUENCE's tag+length.
    assert!(bytes.len() > 5);
}
