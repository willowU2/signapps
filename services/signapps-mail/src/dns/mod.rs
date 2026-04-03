//! DNS auto-configuration helpers for mail domains.
//!
//! Generates the required DNS records (MX, SPF, DKIM, DMARC) for a mail domain
//! so administrators can easily configure their DNS zones. Integrates with
//! signapps-securelink for automatic DNS provisioning.

pub mod records;
pub mod securelink;
