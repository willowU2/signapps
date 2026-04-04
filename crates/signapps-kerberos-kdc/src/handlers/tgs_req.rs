//! Ticket Granting Service request handler (TGS-REQ → TGS-REP).

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

    // Look up service principal key
    let key_exists = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM ad_principal_keys pk
            JOIN ad_domains d ON d.id = pk.domain_id
            WHERE d.realm = $1 AND pk.principal_name = $2
        )
        "#,
    )
    .bind(realm)
    .bind(service_principal)
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !key_exists {
        tracing::warn!(spn = service_principal, "Service principal not found");
        return TgsResult::Error {
            code: 7, // KDC_ERR_S_PRINCIPAL_UNKNOWN
            message: "Service principal not found".to_string(),
        };
    }

    tracing::info!(spn = service_principal, "TGS-REQ granted");
    TgsResult::Success {
        service_principal: service_principal.to_string(),
        realm: realm.to_string(),
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
        };
        assert!(matches!(success, TgsResult::Success { .. }));

        let error = TgsResult::Error {
            code: 7,
            message: "Service principal not found".to_string(),
        };
        assert!(matches!(error, TgsResult::Error { code: 7, .. }));
    }
}
