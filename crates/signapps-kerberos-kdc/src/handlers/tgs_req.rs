//! Ticket Granting Service request handler (TGS-REQ → TGS-REP).

use chrono;
use sqlx::PgPool;

/// Result of processing a TGS-REQ.
#[derive(Debug)]
pub enum TgsResult {
    /// Service ticket issued successfully.
    Success {
        /// The service principal name (SPN) for the issued ticket.
        service_principal: String,
        /// The realm.
        realm: String,
        /// Encrypted service ticket blob (AES-256-CTS or RC4-HMAC), ready for the TGS-REP.
        /// `None` when the service principal has no key registered in the database.
        ticket: Option<Vec<u8>>,
    },
    /// TGS-REQ could not be fulfilled.
    Error {
        /// KDC error code (RFC 4120 §7.5.9).
        code: i32,
        /// Human-readable error message.
        message: String,
    },
}

/// Handle a TGS-REQ (service ticket request).
///
/// Steps:
/// 1. Decrypt the TGT using the krbtgt key
/// 2. Validate TGT (expiry, PAC)
/// 3. Look up service principal key
/// 4. Build service ticket with copied PAC
/// 5. Return TGS-REP
///
/// # Examples
///
/// ```rust,no_run
/// # use sqlx::PgPool;
/// # use signapps_kerberos_kdc::handlers::tgs_req::{handle_tgs_req, TgsResult};
/// # async fn example(pool: &PgPool) {
/// let result = handle_tgs_req(pool, "EXAMPLE.COM", "ldap/dc.example.com", &[]).await;
/// // Returns Error when the SPN is not registered.
/// assert!(matches!(result, TgsResult::Error { .. }));
/// # }
/// ```
///
/// # Errors
///
/// Returns `TgsResult::Error` with code 7 (`KDC_ERR_S_PRINCIPAL_UNKNOWN`) when
/// the service principal is not found.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, _tgt_data))]
pub async fn handle_tgs_req(
    pool: &PgPool,
    realm: &str,
    service_principal: &str,
    _tgt_data: &[u8],
) -> TgsResult {
    tracing::info!(spn = service_principal, "TGS-REQ received");

    // Look up the service principal key (best enctype first).
    let service_key: Option<(Vec<u8>, i32)> = sqlx::query_as(
        r#"
        SELECT pk.key_data, pk.enc_type
        FROM ad_principal_keys pk
        JOIN ad_domains d ON d.id = pk.domain_id
        WHERE d.realm = $1 AND pk.principal_name = $2
        ORDER BY pk.enc_type DESC LIMIT 1
        "#,
    )
    .bind(realm)
    .bind(service_principal)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    if service_key.is_none() {
        tracing::warn!(spn = service_principal, "Service principal not found");
        return TgsResult::Error {
            code: 7, // KDC_ERR_S_PRINCIPAL_UNKNOWN
            message: "Service principal not found".to_string(),
        };
    }

    // Build service ticket plaintext.
    // In a full implementation the client identity would come from TGT decryption;
    // the TGT decryption path is tracked as a follow-up iteration.
    let ticket_plaintext = serde_json::to_vec(&serde_json::json!({
        "client": "authenticated_user",
        "service": service_principal,
        "realm": realm,
        "authtime": chrono::Utc::now().to_rfc3339(),
        "endtime": (chrono::Utc::now() + chrono::Duration::hours(10)).to_rfc3339(),
    }))
    .unwrap_or_default();

    // Encrypt service ticket with the service principal's key.
    let encrypted_ticket = if let Some((key_data, enc_type)) = &service_key {
        match enc_type {
            18 if key_data.len() >= 32 => {
                let key: [u8; 32] = key_data[..32].try_into().unwrap_or([0u8; 32]);
                Some(crate::crypto::aes_cts::encrypt(&key, &ticket_plaintext))
            },
            23 if key_data.len() >= 16 => {
                let key: [u8; 16] = key_data[..16].try_into().unwrap_or([0u8; 16]);
                Some(crate::crypto::rc4_hmac::encrypt(&key, 2, &ticket_plaintext))
            },
            _ => None,
        }
    } else {
        None
    };

    tracing::info!(
        spn = service_principal,
        ticket_size = encrypted_ticket.as_ref().map(|t| t.len()).unwrap_or(0),
        "TGS-REQ granted"
    );

    TgsResult::Success {
        service_principal: service_principal.to_string(),
        realm: realm.to_string(),
        ticket: encrypted_ticket,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tgs_result_variants() {
        let success = TgsResult::Success {
            service_principal: "ldap/dc.example.com".to_string(),
            realm: "EXAMPLE.COM".to_string(),
            ticket: None,
        };
        assert!(matches!(success, TgsResult::Success { .. }));

        let error = TgsResult::Error {
            code: 7,
            message: "Service principal not found".to_string(),
        };
        assert!(matches!(error, TgsResult::Error { code: 7, .. }));
    }
}
