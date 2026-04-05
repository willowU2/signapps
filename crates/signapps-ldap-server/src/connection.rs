//! LDAP connection handler — processes a single TCP connection.
//!
//! Reads BER-encoded LDAP messages from the TCP stream, decodes them,
//! routes to the appropriate operation handler, encodes the response,
//! and writes it back.

use std::net::SocketAddr;

use sqlx::PgPool;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::codec::ber::{self, BerData, BerElement, BerTag};
use crate::codec::ldap_msg::{
    BindAuthentication, BindRequest, CompareRequest, ExtendedRequest, ExtendedResponse,
    LdapMessage, LdapOperation, LdapResult, ModifyDnRequest, ModifyRequest, PartialAttribute,
    ResultCode, SaslCredentials, SearchFilter, SearchRequest, SearchResultEntry, SearchScope,
    AddRequest,
};
use crate::ops;
use crate::session::{AuthMethod, LdapSession};

/// Handle a single LDAP connection.
///
/// Loops reading LDAP messages until the client disconnects or sends
/// `UnbindRequest`.  Each complete BER message is decoded, routed to the
/// appropriate operation handler, and the response is encoded and written back.
///
/// # Panics
///
/// No panics — all errors are logged and cause the connection to close.
#[tracing::instrument(skip(stream, pool), fields(peer = %addr, tls = is_tls))]
pub async fn handle_connection(
    mut stream: TcpStream,
    pool: PgPool,
    addr: SocketAddr,
    is_tls: bool,
    domain: String,
) {
    let mut session = LdapSession::new(addr, is_tls);
    let mut buf = vec![0u8; 65536];
    let mut pending: Vec<u8> = Vec::new();

    tracing::debug!(peer = %addr, "LDAP connection started");

    loop {
        // Read data from TCP.
        let n = match stream.read(&mut buf).await {
            Ok(0) => {
                tracing::debug!(peer = %addr, "Client disconnected");
                break;
            }
            Ok(n) => n,
            Err(e) => {
                tracing::warn!(peer = %addr, error = %e, "TCP read error");
                break;
            }
        };

        pending.extend_from_slice(&buf[..n]);

        // Try to decode complete BER messages from the pending buffer.
        loop {
            if pending.is_empty() {
                break;
            }

            match ber::decode(&pending) {
                Ok((element, rest)) => {
                    let consumed = pending.len() - rest.len();
                    tracing::debug!(peer = %addr, consumed = consumed, tag = ?element.tag, "BER decoded");

                    match decode_ldap_message(&element) {
                        Ok(msg) => {
                            tracing::debug!(peer = %addr, msg_id = msg.message_id, "LDAP message decoded");
                            let is_unbind =
                                matches!(msg.operation, LdapOperation::UnbindRequest);

                            let responses =
                                process_message(&pool, &mut session, msg, &domain).await;

                            for resp_msg in responses {
                                let resp_ber = encode_ldap_message(&resp_msg);
                                let resp_bytes = ber::encode(&resp_ber);
                                if let Err(e) = stream.write_all(&resp_bytes).await {
                                    tracing::warn!(peer = %addr, error = %e, "TCP write error");
                                    return;
                                }
                            }

                            if is_unbind {
                                tracing::debug!(peer = %addr, "Unbind received — closing connection");
                                return;
                            }
                        }
                        Err(e) => {
                            tracing::warn!(peer = %addr, error = %e, "Failed to decode LDAP message");
                            // Non-fatal per-message error: continue with remaining buffer.
                        }
                    }

                    pending.drain(..consumed);
                }
                Err(ber::BerError::UnexpectedEnd) => {
                    tracing::trace!(peer = %addr, pending = pending.len(), "BER needs more data");
                    // Need more data — wait for the next read.
                    break;
                }
                Err(e) => {
                    tracing::warn!(peer = %addr, error = %e, "BER decode error — closing connection");
                    return;
                }
            }
        }
    }
}

// ── Message decoding ──────────────────────────────────────────────────────────

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
fn decode_ldap_message(element: &BerElement) -> Result<LdapMessage, String> {
    let children = match &element.data {
        BerData::Constructed(c) => c,
        _ => return Err("Expected SEQUENCE for LDAPMessage".to_string()),
    };

    if children.len() < 2 {
        return Err("LDAPMessage must have at least 2 elements".to_string());
    }

    let message_id = ber::decode_integer(&children[0])
        .map_err(|e| format!("Invalid messageID: {e}"))? as i32;

    let operation = decode_operation(&children[1])?;

    Ok(LdapMessage { message_id, operation })
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
        BerTag::Application { number: 0, constructed: true } => {
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
                }
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
                    let credentials = sasl_children.get(1).map(|e| primitive_bytes_cloned(e));
                    BindAuthentication::Sasl(SaslCredentials { mechanism, credentials })
                }
                _ => BindAuthentication::Simple(vec![]),
            };

            Ok(LdapOperation::BindRequest(BindRequest { version, name, authentication }))
        }

        // UnbindRequest [APPLICATION 2]
        BerTag::Application { number: 2, .. } => Ok(LdapOperation::UnbindRequest),

        // SearchRequest [APPLICATION 3] CONSTRUCTED
        BerTag::Application { number: 3, constructed: true } => {
            let children = constructed_children(element, "SearchRequest")?;
            if children.len() < 8 {
                return Err("SearchRequest requires 8 elements".to_string());
            }
            let base_dn = octet_string_to_utf8(&children[0]);
            let scope =
                SearchScope::from_i32(ber::decode_enumerated(&children[1]).unwrap_or(2));
            let deref = crate::codec::ldap_msg::DerefAliases::from_i32(
                ber::decode_enumerated(&children[2]).unwrap_or(0),
            );
            let size_limit = ber::decode_integer(&children[3]).unwrap_or(0) as i32;
            let time_limit = ber::decode_integer(&children[4]).unwrap_or(0) as i32;
            let types_only = ber::decode_boolean(&children[5]).unwrap_or(false);
            let filter = decode_search_filter(&children[6])?;
            let attributes = match &children[7].data {
                BerData::Constructed(attrs) => {
                    attrs.iter().map(|a| octet_string_to_utf8(a)).collect()
                }
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
        }

        // ModifyRequest [APPLICATION 6] CONSTRUCTED
        BerTag::Application { number: 6, constructed: true } => {
            let children = constructed_children(element, "ModifyRequest")?;
            let dn = if !children.is_empty() {
                octet_string_to_utf8(&children[0])
            } else {
                String::new()
            };
            Ok(LdapOperation::ModifyRequest(ModifyRequest { dn, changes: vec![] }))
        }

        // AddRequest [APPLICATION 8] CONSTRUCTED
        BerTag::Application { number: 8, constructed: true } => {
            let children = constructed_children(element, "AddRequest")?;
            let dn = if !children.is_empty() {
                octet_string_to_utf8(&children[0])
            } else {
                String::new()
            };
            Ok(LdapOperation::AddRequest(AddRequest { dn, attributes: vec![] }))
        }

        // DeleteRequest [APPLICATION 10] PRIMITIVE
        BerTag::Application { number: 10, .. } => {
            let dn = match &element.data {
                BerData::Primitive(p) => String::from_utf8_lossy(p).to_string(),
                _ => String::new(),
            };
            Ok(LdapOperation::DeleteRequest(dn))
        }

        // ModifyDNRequest [APPLICATION 12] CONSTRUCTED
        BerTag::Application { number: 12, constructed: true } => {
            let children = constructed_children(element, "ModifyDNRequest")?;
            let dn = children.first().map(|e| octet_string_to_utf8(e)).unwrap_or_default();
            let new_rdn =
                children.get(1).map(|e| octet_string_to_utf8(e)).unwrap_or_default();
            let delete_old =
                children.get(2).and_then(|e| ber::decode_boolean(e).ok()).unwrap_or(true);
            let new_superior = children.get(3).map(|e| octet_string_to_utf8(e));
            Ok(LdapOperation::ModifyDnRequest(ModifyDnRequest {
                dn,
                new_rdn,
                delete_old_rdn: delete_old,
                new_superior,
            }))
        }

        // CompareRequest [APPLICATION 14] CONSTRUCTED
        BerTag::Application { number: 14, constructed: true } => {
            let children = constructed_children(element, "CompareRequest")?;
            let dn = children.first().map(|e| octet_string_to_utf8(e)).unwrap_or_default();
            // AVA: SEQUENCE { attributeDesc OCTET STRING, assertionValue OCTET STRING }
            let (attribute, value) = if let Some(ava) = children.get(1) {
                match &ava.data {
                    BerData::Constructed(ava_children) if ava_children.len() >= 2 => {
                        let attr = octet_string_to_utf8(&ava_children[0]);
                        let val = primitive_bytes_cloned(&ava_children[1]);
                        (attr, val)
                    }
                    _ => (String::new(), vec![]),
                }
            } else {
                (String::new(), vec![])
            };
            Ok(LdapOperation::CompareRequest(CompareRequest { dn, attribute, value }))
        }

        // AbandonRequest [APPLICATION 16]
        BerTag::Application { number: 16, .. } => {
            let id = ber::decode_integer(element).unwrap_or(0) as i32;
            Ok(LdapOperation::AbandonRequest(id))
        }

        // ExtendedRequest [APPLICATION 23] CONSTRUCTED
        BerTag::Application { number: 23, constructed: true } => {
            let children = constructed_children(element, "ExtendedRequest")?;
            let oid = children.first().map(|e| primitive_bytes_cloned(e)).map(|b| {
                String::from_utf8_lossy(&b).to_string()
            }).unwrap_or_default();
            let value = children.get(1).map(|e| primitive_bytes_cloned(e));
            Ok(LdapOperation::ExtendedRequest(ExtendedRequest { oid, value }))
        }

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
fn decode_search_filter(element: &BerElement) -> Result<SearchFilter, String> {
    match &element.tag {
        // and [0] SET OF Filter
        BerTag::Context { number: 0, constructed: true } => {
            let children = constructed_children(element, "AND filter")?;
            let filters: Result<Vec<_>, _> =
                children.iter().map(decode_search_filter).collect();
            Ok(SearchFilter::And(filters?))
        }
        // or [1] SET OF Filter
        BerTag::Context { number: 1, constructed: true } => {
            let children = constructed_children(element, "OR filter")?;
            let filters: Result<Vec<_>, _> =
                children.iter().map(decode_search_filter).collect();
            Ok(SearchFilter::Or(filters?))
        }
        // not [2] Filter
        BerTag::Context { number: 2, constructed: true } => {
            let children = constructed_children(element, "NOT filter")?;
            let child = children.first().ok_or("NOT filter must have one child")?;
            Ok(SearchFilter::Not(Box::new(decode_search_filter(child)?)))
        }
        // equalityMatch [3] AttributeValueAssertion
        BerTag::Context { number: 3, constructed: true } => {
            let children = constructed_children(element, "equalityMatch")?;
            if children.len() < 2 {
                return Err("equalityMatch requires attribute + value".to_string());
            }
            let attribute = octet_string_to_utf8(&children[0]);
            let value = primitive_bytes_cloned(&children[1]);
            Ok(SearchFilter::EqualityMatch { attribute, value })
        }
        // substrings [4] SubstringFilter
        BerTag::Context { number: 4, constructed: true } => {
            let children = constructed_children(element, "substrings")?;
            let attribute =
                children.first().map(|e| octet_string_to_utf8(e)).unwrap_or_default();
            Ok(SearchFilter::Substrings { attribute, substrings: vec![] })
        }
        // greaterOrEqual [5] AttributeValueAssertion
        BerTag::Context { number: 5, constructed: true } => {
            let children = constructed_children(element, "greaterOrEqual")?;
            if children.len() < 2 {
                return Err("greaterOrEqual requires attribute + value".to_string());
            }
            let attribute = octet_string_to_utf8(&children[0]);
            let value = primitive_bytes_cloned(&children[1]);
            Ok(SearchFilter::GreaterOrEqual { attribute, value })
        }
        // lessOrEqual [6] AttributeValueAssertion
        BerTag::Context { number: 6, constructed: true } => {
            let children = constructed_children(element, "lessOrEqual")?;
            if children.len() < 2 {
                return Err("lessOrEqual requires attribute + value".to_string());
            }
            let attribute = octet_string_to_utf8(&children[0]);
            let value = primitive_bytes_cloned(&children[1]);
            Ok(SearchFilter::LessOrEqual { attribute, value })
        }
        // present [7] AttributeDescription PRIMITIVE
        BerTag::Context { number: 7, constructed: false } => {
            let attr = match &element.data {
                BerData::Primitive(p) => String::from_utf8_lossy(p).to_string(),
                _ => return Err("present filter must be primitive".to_string()),
            };
            Ok(SearchFilter::Present(attr))
        }
        // approxMatch [8] AttributeValueAssertion
        BerTag::Context { number: 8, constructed: true } => {
            let children = constructed_children(element, "approxMatch")?;
            if children.len() < 2 {
                return Err("approxMatch requires attribute + value".to_string());
            }
            let attribute = octet_string_to_utf8(&children[0]);
            let value = primitive_bytes_cloned(&children[1]);
            Ok(SearchFilter::ApproxMatch { attribute, value })
        }
        _ => Err(format!("Unknown filter tag: {:?}", element.tag)),
    }
}

// ── Message processing ────────────────────────────────────────────────────────

/// Process a decoded LDAP message and return the list of response messages.
///
/// Routes the operation to the appropriate handler in `crate::ops` and maps
/// the result back to LDAP response messages.
///
/// # Panics
///
/// No panics.
async fn process_message(
    pool: &PgPool,
    session: &mut LdapSession,
    msg: LdapMessage,
    domain: &str,
) -> Vec<LdapMessage> {
    let id = msg.message_id;

    match msg.operation {
        LdapOperation::BindRequest(req) => {
            let result = match req.authentication {
                BindAuthentication::Simple(password) => {
                    ops::bind::handle_simple_bind(pool, &req.name, &password).await
                }
                BindAuthentication::Sasl(_sasl) => {
                    // SASL/GSSAPI is wired in Phase 3.
                    ops::bind::BindResult {
                        success: false,
                        user_id: None,
                        user_role: 0,
                        bound_dn: None,
                        error_message: "SASL not yet implemented".to_string(),
                    }
                }
            };

            if result.success {
                if let (Some(dn), Some(uid)) = (result.bound_dn, result.user_id) {
                    session.bind(dn, uid, result.user_role, AuthMethod::Simple);
                }
            }

            let ldap_result = if result.success {
                LdapResult::success()
            } else {
                LdapResult::error(ResultCode::InvalidCredentials, &result.error_message)
            };

            vec![LdapMessage {
                message_id: id,
                operation: LdapOperation::BindResponse(ldap_result),
            }]
        }

        LdapOperation::UnbindRequest => {
            session.unbind();
            vec![] // No response for Unbind per RFC 4511 §4.3.
        }

        LdapOperation::SearchRequest(req) => {
            let filter_str = search_filter_to_string(&req.filter);
            let scope = match req.scope {
                SearchScope::BaseObject => ops::search::Scope::BaseObject,
                SearchScope::SingleLevel => ops::search::Scope::SingleLevel,
                SearchScope::WholeSubtree => ops::search::Scope::WholeSubtree,
            };

            let entries = ops::search::handle_search(
                pool,
                session.user_role,
                &req.base_dn,
                scope,
                &filter_str,
                &req.attributes,
                domain,
            )
            .await
            .unwrap_or_default();

            let mut responses: Vec<LdapMessage> = entries
                .iter()
                .map(|entry| LdapMessage {
                    message_id: id,
                    operation: LdapOperation::SearchResultEntry(SearchResultEntry {
                        dn: entry.dn.clone(),
                        attributes: entry
                            .attributes
                            .iter()
                            .map(|(name, values)| PartialAttribute {
                                attr_type: name.clone(),
                                values: values
                                    .iter()
                                    .map(|v| v.as_bytes().to_vec())
                                    .collect(),
                            })
                            .collect(),
                    }),
                })
                .collect();

            responses.push(LdapMessage {
                message_id: id,
                operation: LdapOperation::SearchResultDone(LdapResult::success()),
            });

            responses
        }

        LdapOperation::AddRequest(req) => {
            let result =
                ops::write::handle_add(pool, session.user_role, &req.dn, &[]).await;
            let ldap_result = write_result_to_ldap(&result);
            vec![LdapMessage {
                message_id: id,
                operation: LdapOperation::AddResponse(ldap_result),
            }]
        }

        LdapOperation::ModifyRequest(req) => {
            let result =
                ops::write::handle_modify(pool, session.user_role, &req.dn, &[]).await;
            let ldap_result = write_result_to_ldap(&result);
            vec![LdapMessage {
                message_id: id,
                operation: LdapOperation::ModifyResponse(ldap_result),
            }]
        }

        LdapOperation::DeleteRequest(dn) => {
            let result = ops::write::handle_delete(pool, session.user_role, &dn).await;
            let ldap_result = write_result_to_ldap(&result);
            vec![LdapMessage {
                message_id: id,
                operation: LdapOperation::DeleteResponse(ldap_result),
            }]
        }

        LdapOperation::ModifyDnRequest(req) => {
            let result = ops::write::handle_modify_dn(
                pool,
                session.user_role,
                &req.dn,
                &req.new_rdn,
                req.delete_old_rdn,
                req.new_superior.as_deref(),
            )
            .await;
            let ldap_result = write_result_to_ldap(&result);
            vec![LdapMessage {
                message_id: id,
                operation: LdapOperation::ModifyDnResponse(ldap_result),
            }]
        }

        LdapOperation::CompareRequest(req) => {
            let result = ops::compare::handle_compare(
                pool,
                session.user_role,
                &req.dn,
                &req.attribute,
                &req.value,
            )
            .await;
            let code = match result {
                ops::compare::CompareResult::True => ResultCode::Success,
                ops::compare::CompareResult::False => ResultCode::Other,
                ops::compare::CompareResult::NoSuchObject => ResultCode::NoSuchObject,
                ops::compare::CompareResult::Error(_) => ResultCode::OperationsError,
            };
            vec![LdapMessage {
                message_id: id,
                operation: LdapOperation::CompareResponse(LdapResult {
                    result_code: code,
                    matched_dn: String::new(),
                    diagnostic_message: String::new(),
                }),
            }]
        }

        LdapOperation::ExtendedRequest(req) => {
            let bound_dn =
                session.bound_dn.as_ref().map(|dn| dn.to_string());
            let result = ops::extended::handle_extended(
                &req.oid,
                req.value.as_deref(),
                session.is_tls,
                bound_dn.as_deref(),
            )
            .await;
            let ldap_result = if result.success {
                LdapResult::success()
            } else {
                LdapResult::error(ResultCode::UnwillingToPerform, &result.error_message)
            };
            vec![LdapMessage {
                message_id: id,
                operation: LdapOperation::ExtendedResponse(ExtendedResponse {
                    result: ldap_result,
                    oid: result.oid,
                    value: result.value,
                }),
            }]
        }

        LdapOperation::AbandonRequest(_) => {
            // No response for Abandon per RFC 4511 §4.11.
            vec![]
        }

        _ => {
            // Server received an unexpected response-type operation from the client.
            vec![LdapMessage {
                message_id: id,
                operation: LdapOperation::ExtendedResponse(ExtendedResponse {
                    result: LdapResult::error(
                        ResultCode::ProtocolError,
                        "Unexpected operation",
                    ),
                    oid: None,
                    value: None,
                }),
            }]
        }
    }
}

// ── Message encoding ──────────────────────────────────────────────────────────

/// Encode an [`LdapMessage`] to a BER [`BerElement`] ready for serialisation.
///
/// # Panics
///
/// No panics.
fn encode_ldap_message(msg: &LdapMessage) -> BerElement {
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
fn encode_ldap_result(result: &LdapResult) -> Vec<BerElement> {
    vec![
        ber::encode_enumerated(result.result_code as i32),
        ber::encode_octet_string(result.matched_dn.as_bytes()),
        ber::encode_octet_string(result.diagnostic_message.as_bytes()),
    ]
}

// ── Filter serialisation ──────────────────────────────────────────────────────

/// Convert a [`SearchFilter`] to the LDAP filter string format.
///
/// The resulting string is passed to [`ops::search::handle_search`] which
/// parses it via [`signapps_ad_core::LdapFilter`].
///
/// # Panics
///
/// No panics.
fn search_filter_to_string(filter: &SearchFilter) -> String {
    match filter {
        SearchFilter::And(children) => {
            let parts: Vec<String> = children.iter().map(search_filter_to_string).collect();
            format!("(&{})", parts.join(""))
        }
        SearchFilter::Or(children) => {
            let parts: Vec<String> = children.iter().map(search_filter_to_string).collect();
            format!("(|{})", parts.join(""))
        }
        SearchFilter::Not(child) => {
            format!("(!{})", search_filter_to_string(child))
        }
        SearchFilter::EqualityMatch { attribute, value } => {
            format!("({}={})", attribute, String::from_utf8_lossy(value))
        }
        SearchFilter::Present(attr) => {
            format!("({}=*)", attr)
        }
        SearchFilter::GreaterOrEqual { attribute, value } => {
            format!("({}>={})", attribute, String::from_utf8_lossy(value))
        }
        SearchFilter::LessOrEqual { attribute, value } => {
            format!("({}<={})", attribute, String::from_utf8_lossy(value))
        }
        SearchFilter::Substrings { attribute, .. } => {
            format!("({}=*)", attribute) // Simplified — full substrings wired in Phase 3.
        }
        SearchFilter::ApproxMatch { attribute, value } => {
            format!("({}~={})", attribute, String::from_utf8_lossy(value))
        }
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
        }
    }
}

/// Map a [`ops::write::WriteResult`] to an [`LdapResult`].
fn write_result_to_ldap(result: &ops::write::WriteResult) -> LdapResult {
    if result.success {
        LdapResult::success()
    } else {
        LdapResult::error(ResultCode::InsufficientAccessRights, &result.error_message)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::codec::ber::{encode, encode_integer, encode_octet_string, encode_sequence};
    use crate::codec::ldap_msg::{LdapResult, ResultCode};

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
                    BindAuthentication::Simple(pw) => assert_eq!(pw, b"secret"),
                    BindAuthentication::Sasl(_) => panic!("expected simple auth"),
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
}
