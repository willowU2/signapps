//! LDAP connection handler — processes a single TCP connection.
//!
//! Reads BER-encoded LDAP messages from the TCP stream, decodes them,
//! routes to the appropriate operation handler, encodes the response,
//! and writes it back.

mod dispatcher;
mod filter_utils;
mod message_decoder;
mod message_encoder;

#[cfg(test)]
mod tests;

use std::net::SocketAddr;

use sqlx::PgPool;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::codec::ber;
use crate::codec::ldap_msg::LdapOperation;
use crate::session::LdapSession;

use dispatcher::process_message;
use message_decoder::decode_ldap_message;
use message_encoder::encode_ldap_message;

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
