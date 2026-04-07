//! Infrastructure domain repositories.

pub mod ad_dns_repository;
pub mod ad_domain_repository;
pub mod ad_principal_keys_repository;
pub mod ad_sync_repository;
pub mod infrastructure_repository;

pub use ad_dns_repository::AdDnsRepository;
pub use ad_domain_repository::AdDomainRepository;
pub use ad_principal_keys_repository::AdPrincipalKeysRepository;
pub use ad_sync_repository::{AdOuRepository, AdSyncQueueRepository, AdUserAccountRepository};
pub use infrastructure_repository::{
    DeployProfileRepository, DhcpLeaseRepository, DhcpScopeRepository, InfraCertificateRepository,
    InfraDomainRepository,
};
