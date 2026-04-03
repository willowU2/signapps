//! DNS auto-configuration helpers for mail domains.
//!
//! Generates the required DNS records (MX, SPF, DKIM, DMARC) for a mail domain
//! so administrators can easily configure their DNS zones.

pub mod records;
