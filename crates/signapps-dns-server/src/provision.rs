//! Auto-provisioning of AD SRV records on domain creation.

use signapps_db::repositories::AdDomainRepository;
use sqlx::PgPool;
use uuid::Uuid;

/// Provision all DNS records for a newly created AD domain.
///
/// This is the high-level entry point called by the DC service when
/// an admin creates a new AD domain. It looks up the domain by ID,
/// then calls [`super::zone::create_ad_zone`] to create the forward
/// lookup zone with all default SRV and A records.
///
/// # Errors
///
/// Returns `Error::NotFound` if no domain with `domain_id` exists.
/// Returns `Error::Database` if any DNS INSERT fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```ignore
/// provision_domain_dns(&pool, domain_id, "dc01", "10.0.0.1").await?;
/// ```
#[tracing::instrument(skip(pool))]
pub async fn provision_domain_dns(
    pool: &PgPool,
    domain_id: Uuid,
    dc_hostname: &str,
    dc_ip: &str,
) -> signapps_common::Result<()> {
    let domain = AdDomainRepository::get(pool, domain_id)
        .await?
        .ok_or_else(|| signapps_common::Error::NotFound("Domain not found".to_string()))?;

    super::zone::create_ad_zone(pool, domain_id, &domain.dns_name, dc_hostname, dc_ip).await?;

    tracing::info!(domain = %domain.dns_name, "DNS provisioning complete");
    Ok(())
}

#[cfg(test)]
mod tests {
    use signapps_common::Error;

    #[test]
    fn not_found_error_message() {
        let err = Error::NotFound("Domain not found".to_string());
        assert!(err.to_string().contains("Domain not found"));
    }
}
