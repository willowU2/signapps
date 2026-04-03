//! DNS record generation for mail domains.
//!
//! Given a [`MailDomain`](crate::handlers::domains::MailDomain), generates the
//! complete set of DNS records needed for email delivery and authentication.

use crate::handlers::domains::{DnsRecord, MailDomain};

/// Generate the required DNS records for a mail domain.
///
/// Returns MX, SPF (TXT), DKIM (TXT), and DMARC (TXT) records that must be
/// created in the domain's DNS zone for proper email operation.
///
/// # Arguments
///
/// * `domain` — The mail domain with DKIM keys and DMARC policy.
/// * `server_ip` — The public IP address of the mail server.
///
/// # Examples
///
/// ```ignore
/// use signapps_mail::dns::records::required_dns_records;
///
/// let records = required_dns_records(&domain, "203.0.113.1");
/// assert_eq!(records.len(), 4);
/// ```
///
/// # Panics
///
/// None.
pub fn required_dns_records(domain: &MailDomain, server_ip: &str) -> Vec<DnsRecord> {
    let selector = domain.dkim_selector.as_deref().unwrap_or("signapps");
    let dmarc_policy = domain.dmarc_policy.as_deref().unwrap_or("none");

    let mut records = vec![
        // MX record — route inbound mail to the mail server
        DnsRecord {
            name: domain.name.clone(),
            type_: "MX".to_string(),
            value: format!("10 mail.{}", domain.name),
            ttl: 3600,
        },
        // SPF record — authorize the server IP to send mail for this domain
        DnsRecord {
            name: domain.name.clone(),
            type_: "TXT".to_string(),
            value: format!("v=spf1 mx ip4:{} ~all", server_ip),
            ttl: 3600,
        },
        // DMARC record — set the domain's DMARC policy
        DnsRecord {
            name: format!("_dmarc.{}", domain.name),
            type_: "TXT".to_string(),
            value: format!(
                "v=DMARC1; p={}; rua=mailto:dmarc@{}",
                dmarc_policy, domain.name
            ),
            ttl: 3600,
        },
    ];

    // DKIM record — publish the public key for signature verification
    if let Some(ref dkim_dns_value) = domain.dkim_dns_value {
        records.push(DnsRecord {
            name: format!("{}._domainkey.{}", selector, domain.name),
            type_: "TXT".to_string(),
            value: dkim_dns_value.clone(),
            ttl: 3600,
        });
    }

    records
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_domain() -> MailDomain {
        MailDomain {
            id: uuid::Uuid::new_v4(),
            name: "example.com".to_string(),
            is_active: Some(true),
            tenant_id: None,
            dkim_selector: Some("signapps".to_string()),
            dkim_private_key: Some(
                "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----".to_string(),
            ),
            dkim_dns_value: Some("v=DKIM1; k=rsa; p=MIIBIjANtest".to_string()),
            dmarc_policy: Some("quarantine".to_string()),
            dns_verified: None,
            dns_verified_at: None,
            created_at: None,
            updated_at: None,
        }
    }

    #[test]
    fn test_required_dns_records_count() {
        let domain = test_domain();
        let records = required_dns_records(&domain, "203.0.113.1");
        assert_eq!(records.len(), 4);
    }

    #[test]
    fn test_mx_record() {
        let domain = test_domain();
        let records = required_dns_records(&domain, "203.0.113.1");
        let mx = records.iter().find(|r| r.type_ == "MX").unwrap();
        assert_eq!(mx.name, "example.com");
        assert_eq!(mx.value, "10 mail.example.com");
        assert_eq!(mx.ttl, 3600);
    }

    #[test]
    fn test_spf_record() {
        let domain = test_domain();
        let records = required_dns_records(&domain, "203.0.113.1");
        let spf = records
            .iter()
            .find(|r| r.type_ == "TXT" && r.value.starts_with("v=spf1"))
            .unwrap();
        assert_eq!(spf.name, "example.com");
        assert!(spf.value.contains("ip4:203.0.113.1"));
    }

    #[test]
    fn test_dkim_record() {
        let domain = test_domain();
        let records = required_dns_records(&domain, "203.0.113.1");
        let dkim = records
            .iter()
            .find(|r| r.name.contains("_domainkey"))
            .unwrap();
        assert_eq!(dkim.name, "signapps._domainkey.example.com");
        assert!(dkim.value.starts_with("v=DKIM1"));
    }

    #[test]
    fn test_dmarc_record() {
        let domain = test_domain();
        let records = required_dns_records(&domain, "203.0.113.1");
        let dmarc = records
            .iter()
            .find(|r| r.name.starts_with("_dmarc."))
            .unwrap();
        assert_eq!(dmarc.name, "_dmarc.example.com");
        assert!(dmarc.value.contains("p=quarantine"));
        assert!(dmarc.value.contains("rua=mailto:dmarc@example.com"));
    }

    #[test]
    fn test_no_dkim_dns_value() {
        let mut domain = test_domain();
        domain.dkim_dns_value = None;
        let records = required_dns_records(&domain, "203.0.113.1");
        // 3 records (no DKIM)
        assert_eq!(records.len(), 3);
        assert!(!records.iter().any(|r| r.name.contains("_domainkey")));
    }
}
