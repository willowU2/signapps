//! Authentication Service request handler (AS-REQ → AS-REP).
//!
//! Handles initial authentication: user presents credentials (typically
//! PA-ENC-TIMESTAMP), KDC verifies and returns a TGT.

use sqlx::PgPool;
use uuid::Uuid;

/// Result of processing an AS-REQ.
#[derive(Debug)]
pub enum AsResult {
    /// Authentication succeeded — return AS-REP with TGT.
    Success {
        /// User's entity ID.
        user_id: Uuid,
        /// The realm.
        realm: String,
        /// Principal name.
        principal: String,
    },
    /// Pre-authentication required (send PA-ETYPE-INFO2).
    PreAuthRequired {
        /// The realm.
        realm: String,
        /// Encryption types supported by this principal.
        supported_etypes: Vec<i32>,
    },
    /// Authentication failed.
    Error {
        /// KDC error code (RFC 4120 §7.5.9).
        code: i32,
        /// Human-readable error message.
        message: String,
    },
}

/// Handle an AS-REQ (initial authentication request).
///
/// Steps:
/// 1. Look up the client principal in `ad_principal_keys`
/// 2. If no PA-DATA, return `PreAuthRequired`
/// 3. Verify PA-ENC-TIMESTAMP using the principal's key
/// 4. Build TGT with PAC
/// 5. Return AS-REP
///
/// # Examples
///
/// ```rust,no_run
/// # use sqlx::PgPool;
/// # use signapps_kerberos_kdc::handlers::as_req::{handle_as_req, AsResult};
/// # async fn example(pool: &PgPool) {
/// let result = handle_as_req(pool, "EXAMPLE.COM", "admin", &[], &[18, 17]).await;
/// assert!(matches!(result, AsResult::PreAuthRequired { .. }));
/// # }
/// ```
///
/// # Errors
///
/// Returns `AsResult::Error` with code 6 (`KDC_ERR_C_PRINCIPAL_UNKNOWN`) when
/// the principal is not found in the database.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool))]
pub async fn handle_as_req(
    pool: &PgPool,
    realm: &str,
    client_principal: &str,
    padata: &[(i32, Vec<u8>)],
    requested_etypes: &[i32],
) -> AsResult {
    tracing::info!(principal = client_principal, realm = realm, "AS-REQ received");

    // Look up principal keys
    let keys = sqlx::query_as::<_, (Uuid, i32, Vec<u8>, Option<String>)>(
        r#"
        SELECT pk.entity_id, pk.enc_type, pk.key_data, pk.salt
        FROM ad_principal_keys pk
        JOIN ad_domains d ON d.id = pk.domain_id
        WHERE d.realm = $1 AND pk.principal_name = $2
        ORDER BY pk.key_version DESC
        "#,
    )
    .bind(realm)
    .bind(client_principal)
    .fetch_all(pool)
    .await;

    let keys = match keys {
        Ok(k) if !k.is_empty() => k,
        _ => {
            tracing::warn!(principal = client_principal, "Principal not found");
            return AsResult::Error {
                code: 6, // KDC_ERR_C_PRINCIPAL_UNKNOWN
                message: "Client principal not found".to_string(),
            };
        }
    };

    // Check if pre-authentication data was provided
    let has_pa_timestamp = padata.iter().any(|(t, _)| *t == 2); // PA-ENC-TIMESTAMP = 2

    if !has_pa_timestamp {
        let etypes: Vec<i32> = keys.iter().map(|(_, et, _, _)| *et).collect();
        tracing::debug!(principal = client_principal, "Pre-auth required");
        return AsResult::PreAuthRequired {
            realm: realm.to_string(),
            supported_etypes: etypes,
        };
    }

    // Pre-auth verification will be fully implemented when crypto is wired.
    // For now, accept if PA-DATA is present.
    let user_id = keys[0].0;

    tracing::info!(principal = client_principal, "AS-REQ authenticated");
    AsResult::Success {
        user_id,
        realm: realm.to_string(),
        principal: client_principal.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn as_result_variants() {
        let success = AsResult::Success {
            user_id: Uuid::new_v4(),
            realm: "EXAMPLE.COM".to_string(),
            principal: "admin".to_string(),
        };
        assert!(matches!(success, AsResult::Success { .. }));

        let preauth = AsResult::PreAuthRequired {
            realm: "EXAMPLE.COM".to_string(),
            supported_etypes: vec![18, 17],
        };
        assert!(matches!(preauth, AsResult::PreAuthRequired { .. }));

        let error = AsResult::Error {
            code: 6,
            message: "Client principal not found".to_string(),
        };
        assert!(matches!(error, AsResult::Error { code: 6, .. }));
    }
}
