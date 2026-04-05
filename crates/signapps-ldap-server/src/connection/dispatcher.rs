//! LDAP message dispatcher — routes decoded operations to the appropriate handler.

use sqlx::PgPool;

use crate::codec::ldap_msg::{
    BindAuthentication, ExtendedResponse, LdapMessage, LdapOperation, LdapResult, PartialAttribute,
    ResultCode, SearchResultEntry, SearchScope,
};
use crate::ops;
use crate::session::{AuthMethod, LdapSession};

use super::filter_utils::search_filter_to_string;

/// Process a decoded LDAP message and return the list of response messages.
///
/// Routes the operation to the appropriate handler in `crate::ops` and maps
/// the result back to LDAP response messages.
///
/// # Panics
///
/// No panics.
pub(crate) async fn process_message(
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
                req.size_limit,
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
            let is_start_tls = req.oid == ops::extended::oid::START_TLS;
            let bound_dn = session.bound_dn.as_ref().map(|dn| dn.to_string());
            let result = ops::extended::handle_extended(
                &req.oid,
                req.value.as_deref(),
                session.is_tls,
                bound_dn.as_deref(),
            )
            .await;

            // Signal the connection loop to perform the TLS upgrade after sending
            // the StartTLS response (RFC 4511 §4.14.1 — the server MUST send the
            // response before initiating the TLS handshake).
            if is_start_tls && result.success {
                session.start_tls_pending = true;
            }

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

/// Map a [`ops::write::WriteResult`] to an [`LdapResult`].
fn write_result_to_ldap(result: &ops::write::WriteResult) -> LdapResult {
    if result.success {
        LdapResult::success()
    } else {
        LdapResult::error(ResultCode::InsufficientAccessRights, &result.error_message)
    }
}
