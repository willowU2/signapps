//! LDAP connection handler — processes a single TCP connection.
//!
//! Reads BER-encoded LDAP messages from the TCP stream, decodes them,
//! routes to the appropriate operation handler, encodes the response,
//! and writes it back.
//!
//! ## StartTLS upgrade (RFC 4511 §4.14.1)
//!
//! When the client sends an Extended Request with OID
//! `1.3.6.1.4.1.1466.20037` (StartTLS), the dispatcher sets
//! `session.start_tls_pending = true`.  After the ExtendedResponse is
//! flushed to the wire, the message loop checks that flag and — if a
//! [`TlsAcceptor`] is available — performs the TLS handshake in-place,
//! then continues processing messages over the encrypted stream.
//!
//! If no acceptor is configured the connection continues in plain text and
//! `session.is_tls` remains `false`.

mod dispatcher;
mod filter_utils;
mod message_decoder;
mod message_encoder;

#[cfg(test)]
mod tests;

use std::net::SocketAddr;
use std::sync::Arc;

use sqlx::PgPool;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_rustls::TlsAcceptor;

use crate::codec::ber;
use crate::codec::ldap_msg::LdapOperation;
use crate::session::LdapSession;

use dispatcher::process_message;
use message_decoder::decode_ldap_message;
use message_encoder::encode_ldap_message;

// ── Public entry points ────────────────────────────────────────────────────────

/// Handle a single plain LDAP connection.
///
/// Convenience wrapper used by the plain-text LDAP listener.  Does not
/// support StartTLS upgrade (no [`TlsAcceptor`] is passed).
///
/// # Panics
///
/// No panics — all errors are logged and cause the connection to close.
#[tracing::instrument(skip(stream, pool), fields(peer = %addr, tls = false))]
pub async fn handle_connection(
    stream: TcpStream,
    pool: PgPool,
    addr: SocketAddr,
    is_tls: bool,
    domain: String,
) {
    handle_connection_upgradable(stream, pool, addr, is_tls, domain, None).await;
}

/// Handle a single LDAP connection with optional StartTLS upgrade support.
///
/// When `tls_acceptor` is `Some` and the client sends a StartTLS Extended
/// Request, the function sends the success response and then performs the
/// TLS handshake.  Subsequent messages are read/written over the encrypted
/// stream with `session.is_tls` set to `true`.
///
/// # Errors
///
/// TLS handshake errors are logged and cause the connection to close.
///
/// # Panics
///
/// No panics — all errors are logged and cause the connection to close.
#[tracing::instrument(skip(stream, pool, tls_acceptor), fields(peer = %addr, tls = is_tls))]
pub async fn handle_connection_upgradable(
    stream: TcpStream,
    pool: PgPool,
    addr: SocketAddr,
    is_tls: bool,
    domain: String,
    tls_acceptor: Option<Arc<TlsAcceptor>>,
) {
    let mut session = LdapSession::new(addr, is_tls);
    tracing::debug!(peer = %addr, "LDAP connection started");

    // Phase 1: plain TCP message loop.
    // Returns `Some(stream)` if a StartTLS upgrade was requested and the
    // caller provided a TLS acceptor; otherwise `None` (connection closed).
    let upgrade_stream = run_plain_loop(stream, &pool, &mut session, addr, &domain).await;

    let raw_stream = match upgrade_stream {
        None => return, // Normal close or no upgrade needed.
        Some(s) => s,
    };

    // Phase 2: StartTLS handshake.
    let Some(acceptor) = tls_acceptor else {
        tracing::warn!(
            peer = %addr,
            "StartTLS requested but no TLS acceptor configured — connection closed"
        );
        return;
    };

    tracing::info!(peer = %addr, "Performing StartTLS handshake");
    match acceptor.accept(raw_stream).await {
        Ok(tls_stream) => {
            session.is_tls = true;
            tracing::info!(peer = %addr, "StartTLS handshake complete");
            // Phase 3: TLS message loop.
            run_stream_loop(tls_stream, &pool, &mut session, addr, &domain).await;
        }
        Err(e) => {
            tracing::warn!(peer = %addr, error = %e, "StartTLS handshake failed");
        }
    }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/// Run the message loop on a plain [`TcpStream`].
///
/// Returns `Some(stream)` when a StartTLS upgrade is needed so the caller
/// can perform the TLS handshake on the same TCP connection.
/// Returns `None` on normal close or error.
///
/// # Panics
///
/// No panics.
async fn run_plain_loop(
    mut stream: TcpStream,
    pool: &PgPool,
    session: &mut LdapSession,
    addr: SocketAddr,
    domain: &str,
) -> Option<TcpStream> {
    let mut buf = vec![0u8; 65536];
    let mut pending: Vec<u8> = Vec::new();

    loop {
        let n = match stream.read(&mut buf).await {
            Ok(0) => {
                tracing::debug!(peer = %addr, "Client disconnected");
                return None;
            }
            Ok(n) => n,
            Err(e) => {
                tracing::warn!(peer = %addr, error = %e, "TCP read error");
                return None;
            }
        };

        pending.extend_from_slice(&buf[..n]);

        let signal = dispatch_pending(pool, session, &mut pending, &mut stream, addr, domain).await;

        match signal {
            LoopSignal::Unbind | LoopSignal::Error => return None,
            LoopSignal::StartTls => return Some(stream),
            LoopSignal::Continue => {}
        }
    }
}

/// Run the message loop on any `AsyncRead + AsyncWrite + Unpin` stream.
///
/// Used for the post-StartTLS TLS stream phase.
///
/// # Panics
///
/// No panics.
async fn run_stream_loop<S>(
    mut stream: S,
    pool: &PgPool,
    session: &mut LdapSession,
    addr: SocketAddr,
    domain: &str,
) where
    S: AsyncRead + AsyncWrite + Unpin,
{
    let mut buf = vec![0u8; 65536];
    let mut pending: Vec<u8> = Vec::new();

    loop {
        let n = match stream.read(&mut buf).await {
            Ok(0) => {
                tracing::debug!(peer = %addr, "Client disconnected (TLS)");
                return;
            }
            Ok(n) => n,
            Err(e) => {
                tracing::warn!(peer = %addr, error = %e, "Read error");
                return;
            }
        };

        pending.extend_from_slice(&buf[..n]);

        let signal = dispatch_pending(pool, session, &mut pending, &mut stream, addr, domain).await;

        match signal {
            LoopSignal::Unbind | LoopSignal::Error => return,
            // StartTLS nested in TLS is rejected by the dispatcher (is_tls = true).
            LoopSignal::StartTls | LoopSignal::Continue => {}
        }
    }
}

/// Signal returned by [`dispatch_pending`] to control the outer read loop.
#[derive(PartialEq, Eq)]
enum LoopSignal {
    /// Normal — keep reading.
    Continue,
    /// Client sent `UnbindRequest` — close the connection.
    Unbind,
    /// Fatal write/decode error — close the connection.
    Error,
    /// Client sent a successful StartTLS Extended Request — upgrade to TLS.
    StartTls,
}

/// Decode and dispatch all complete BER messages currently in `pending`.
///
/// Writes responses to `stream`.  Returns a [`LoopSignal`] indicating whether
/// the caller should keep reading, close the connection, or perform a TLS
/// upgrade.
///
/// # Panics
///
/// No panics.
async fn dispatch_pending<W>(
    pool: &PgPool,
    session: &mut LdapSession,
    pending: &mut Vec<u8>,
    stream: &mut W,
    addr: SocketAddr,
    domain: &str,
) -> LoopSignal
where
    W: AsyncWrite + Unpin,
{
    loop {
        if pending.is_empty() {
            return LoopSignal::Continue;
        }

        match ber::decode(pending) {
            Ok((element, rest)) => {
                let consumed = pending.len() - rest.len();
                tracing::debug!(peer = %addr, consumed = consumed, tag = ?element.tag, "BER decoded");

                match decode_ldap_message(&element) {
                    Ok(msg) => {
                        tracing::debug!(
                            peer = %addr,
                            msg_id = msg.message_id,
                            "LDAP message decoded"
                        );
                        let is_unbind = matches!(msg.operation, LdapOperation::UnbindRequest);

                        let responses = process_message(pool, session, msg, domain).await;

                        for resp_msg in responses {
                            let resp_ber = encode_ldap_message(&resp_msg);
                            let resp_bytes = ber::encode(&resp_ber);
                            if let Err(e) = stream.write_all(&resp_bytes).await {
                                tracing::warn!(peer = %addr, error = %e, "Write error");
                                return LoopSignal::Error;
                            }
                        }

                        if is_unbind {
                            tracing::debug!(peer = %addr, "Unbind received — closing connection");
                            return LoopSignal::Unbind;
                        }

                        // Check for StartTLS upgrade signal set by the dispatcher.
                        // Stop processing further messages so the caller can upgrade
                        // the stream before reading any more bytes from the client.
                        if session.start_tls_pending {
                            session.start_tls_pending = false;
                            pending.drain(..consumed);
                            return LoopSignal::StartTls;
                        }
                    }
                    Err(e) => {
                        tracing::warn!(
                            peer = %addr,
                            error = %e,
                            "Failed to decode LDAP message"
                        );
                        // Non-fatal per-message error — continue with remaining buffer.
                    }
                }

                pending.drain(..consumed);
            }
            Err(ber::BerError::UnexpectedEnd) => {
                tracing::trace!(peer = %addr, pending = pending.len(), "BER needs more data");
                // Need more data — wait for the next read.
                return LoopSignal::Continue;
            }
            Err(e) => {
                tracing::warn!(peer = %addr, error = %e, "BER decode error — closing connection");
                return LoopSignal::Error;
            }
        }
    }
}
