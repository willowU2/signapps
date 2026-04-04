//! AD domain lifecycle operations.
//!
//! Provides the high-level flow for creating, configuring, and managing
//! AD domains. This is the entry point called by the DC admin API.

use signapps_common::{Error, Result};
use signapps_db::models::ad_domain::CreateAdDomain;
use signapps_db::models::ad_principal_keys::CreatePrincipalKey;
use signapps_db::repositories::{AdDnsRepository, AdDomainRepository, AdPrincipalKeysRepository};
use sqlx::PgPool;
use uuid::Uuid;

use crate::sid::SecurityIdentifier;

/// Result of domain creation — contains everything needed to start the DC.
///
/// # Examples
///
/// ```
/// use uuid::Uuid;
/// use signapps_ad_core::domain::DomainCreationResult;
///
/// let result = DomainCreationResult {
///     domain_id: Uuid::new_v4(),
///     dns_name: "example.com".to_string(),
///     realm: "EXAMPLE.COM".to_string(),
///     netbios_name: "EXAMPLE".to_string(),
///     domain_sid: "S-1-5-21-100-200-300".to_string(),
/// };
/// let json = serde_json::to_string(&result).unwrap();
/// assert!(json.contains("example.com"));
/// ```
#[derive(Debug, Clone, serde::Serialize)]
pub struct DomainCreationResult {
    /// UUID of the newly created `ad_domains` record.
    pub domain_id: Uuid,
    /// DNS name of the domain (e.g., `"example.com"`).
    pub dns_name: String,
    /// Kerberos realm (uppercase DNS name, e.g., `"EXAMPLE.COM"`).
    pub realm: String,
    /// NetBIOS name (e.g., `"EXAMPLE"`).
    pub netbios_name: String,
    /// Domain SID in string form (e.g., `"S-1-5-21-100-200-300"`).
    pub domain_sid: String,
}

/// Create a new Active Directory domain.
///
/// This is the main entry point for domain provisioning. It:
/// 1. Generates a unique domain SID
/// 2. Creates the `ad_domains` record
/// 3. Creates the `krbtgt` principal key (required for all Kerberos tickets)
/// 4. Creates the admin user's Kerberos keys (AES256 + RC4-HMAC)
/// 5. Creates the DNS zone with default SRV records
///
/// # Arguments
/// - `pool`: PostgreSQL connection pool
/// - `tenant_id`: The tenant creating the domain
/// - `dns_name`: Domain DNS name (e.g., `"example.com"`)
/// - `netbios_name`: NetBIOS name (e.g., `"EXAMPLE"`)
/// - `tree_id`: Linked org tree ID
/// - `admin_user_id`: The user who becomes the first domain admin
/// - `admin_password`: Password for generating Kerberos keys
///
/// # Errors
///
/// Returns `Error::Conflict` if a domain with the same DNS name already exists
/// for this tenant.  Returns `Error::Database` if any database operation fails.
/// Returns `Error::NotFound` if `admin_user_id` does not exist.
///
/// # Panics
///
/// Aucun panic possible — toutes les erreurs sont propagées via `Result`.
#[tracing::instrument(skip(pool, admin_password))]
pub async fn create_domain(
    pool: &PgPool,
    tenant_id: Uuid,
    dns_name: &str,
    netbios_name: &str,
    tree_id: Uuid,
    admin_user_id: Uuid,
    admin_password: &str,
) -> Result<DomainCreationResult> {
    let realm = dns_name.to_uppercase();

    // Check if domain already exists
    if AdDomainRepository::get_by_dns_name(pool, tenant_id, dns_name)
        .await?
        .is_some()
    {
        return Err(Error::Conflict(format!("Domain {dns_name} already exists")));
    }

    // 1. Generate domain SID
    let domain_sid = SecurityIdentifier::generate_domain_sid();
    let domain_sid_str = domain_sid.to_string();

    tracing::info!(domain = dns_name, sid = %domain_sid_str, "Creating AD domain");

    // 2. Create domain record
    let input = CreateAdDomain {
        dns_name: dns_name.to_string(),
        netbios_name: netbios_name.to_string(),
        tree_id,
    };
    let domain =
        AdDomainRepository::create(pool, tenant_id, input, &domain_sid_str, &realm).await?;

    // 3. Create krbtgt principal key (the master key for all TGTs)
    let krbtgt_principal = format!("krbtgt/{realm}@{realm}");
    let krbtgt_salt = format!("{realm}krbtgt{realm}");
    let krbtgt_key = generate_random_key();

    AdPrincipalKeysRepository::create(
        pool,
        CreatePrincipalKey {
            domain_id: domain.id,
            principal_name: krbtgt_principal.clone(),
            principal_type: "krbtgt".to_string(),
            key_version: 1,
            enc_type: 18, // AES256-CTS-HMAC-SHA1-96
            key_data: krbtgt_key.to_vec(),
            salt: Some(krbtgt_salt),
            entity_id: None,
        },
    )
    .await?;

    tracing::info!(principal = %krbtgt_principal, "Created krbtgt key");

    // 4. Create admin user's Kerberos keys
    let admin_username = get_username(pool, admin_user_id).await?;
    let admin_principal = format!("{admin_username}@{realm}");
    let admin_salt = format!("{realm}{admin_username}");

    // AES256 key from password (enc_type 18)
    let aes_key = crate::crypto_helpers::derive_aes256_key(admin_password, &admin_salt);
    AdPrincipalKeysRepository::create(
        pool,
        CreatePrincipalKey {
            domain_id: domain.id,
            principal_name: admin_principal.clone(),
            principal_type: "user".to_string(),
            key_version: 1,
            enc_type: 18, // AES256-CTS-HMAC-SHA1-96
            key_data: aes_key.to_vec(),
            salt: Some(admin_salt),
            entity_id: Some(admin_user_id),
        },
    )
    .await?;

    // NT hash (RC4-HMAC / enc_type 23) from password
    let nt_hash = crate::crypto_helpers::compute_nt_hash(admin_password);
    AdPrincipalKeysRepository::create(
        pool,
        CreatePrincipalKey {
            domain_id: domain.id,
            principal_name: admin_principal.clone(),
            principal_type: "user".to_string(),
            key_version: 1,
            enc_type: 23, // RC4-HMAC
            key_data: nt_hash.to_vec(),
            salt: None,
            entity_id: Some(admin_user_id),
        },
    )
    .await?;

    tracing::info!(principal = %admin_principal, "Created admin Kerberos keys");

    // 5. Create DNS zone with default SRV records
    let zone = AdDnsRepository::create_zone(pool, domain.id, dns_name).await?;

    let srv_records = [
        ("_ldap._tcp", 389u16),
        ("_ldap._tcp.dc._msdcs", 389),
        ("_kerberos._tcp", 88),
        ("_kerberos._tcp.dc._msdcs", 88),
        ("_kpasswd._tcp", 464),
        ("_gc._tcp", 3268),
    ];

    for (name, port) in &srv_records {
        AdDnsRepository::add_record(
            pool,
            zone.id,
            name,
            "SRV",
            serde_json::json!({
                "priority": 0,
                "weight": 100,
                "port": port,
                "target": format!("dc.{dns_name}")
            }),
            3600,
            true,
        )
        .await?;
    }

    // DC A record (placeholder — updated with real IP on DC startup)
    AdDnsRepository::add_record(
        pool,
        zone.id,
        &format!("dc.{dns_name}"),
        "A",
        serde_json::json!({ "ip": "127.0.0.1" }),
        3600,
        true,
    )
    .await?;

    tracing::info!(
        zone = dns_name,
        records = srv_records.len() + 1,
        "DNS zone created"
    );

    Ok(DomainCreationResult {
        domain_id: domain.id,
        dns_name: dns_name.to_string(),
        realm,
        netbios_name: netbios_name.to_string(),
        domain_sid: domain_sid_str,
    })
}

/// Delete a domain and all associated data (cascading).
///
/// Cascade deletes in PostgreSQL handle `ad_principal_keys`, `ad_dns_zones`,
/// and `ad_dns_records` automatically.
///
/// # Errors
///
/// Returns `Error::Database` if the DELETE fails.
///
/// # Panics
///
/// Aucun panic possible — toutes les erreurs sont propagées via `Result`.
#[tracing::instrument(skip(pool))]
pub async fn delete_domain(pool: &PgPool, domain_id: Uuid) -> Result<()> {
    AdDomainRepository::delete(pool, domain_id).await?;
    tracing::info!(domain_id = %domain_id, "Domain deleted");
    Ok(())
}

/// Get username from `identity.users`.
async fn get_username(pool: &PgPool, user_id: Uuid) -> Result<String> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT username FROM identity.users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

    row.map(|(u,)| u)
        .ok_or_else(|| Error::NotFound(format!("User {user_id} not found")))
}

/// Generate a random 32-byte key for krbtgt.
fn generate_random_key() -> [u8; 32] {
    use rand::RngCore;

    let mut key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);
    key
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn domain_creation_result_serializable() {
        let result = DomainCreationResult {
            domain_id: Uuid::new_v4(),
            dns_name: "example.com".to_string(),
            realm: "EXAMPLE.COM".to_string(),
            netbios_name: "EXAMPLE".to_string(),
            domain_sid: "S-1-5-21-100-200-300".to_string(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("example.com"));
        assert!(json.contains("EXAMPLE.COM"));
    }

    #[test]
    fn random_key_generation() {
        let key1 = generate_random_key();
        let key2 = generate_random_key();
        // Overwhelmingly likely to differ — 2^-256 collision probability
        assert_ne!(key1, key2);
        assert_eq!(key1.len(), 32);
    }
}
