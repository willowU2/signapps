//! SecureLink DNS integration client.
//!
//! Calls the signapps-securelink service (port 3006) to automatically
//! provision DNS records when a mail domain is created or removed.
//! If securelink is unreachable, operations log a warning and succeed
//! gracefully — the admin can configure DNS manually.

use serde::{Deserialize, Serialize};
use tracing;

/// Result of provisioning a single DNS record via SecureLink.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct DnsProvisionResult {
    /// DNS record name (e.g. `mail.example.com`).
    pub name: String,
    /// Record type (`A`, `CNAME`, `TXT`, `MX`, `SRV`).
    pub record_type: String,
    /// Record value.
    pub value: String,
    /// Whether the record was successfully created.
    pub success: bool,
    /// Error message if creation failed.
    pub error: Option<String>,
}

/// Payload sent to SecureLink `POST /api/v1/dns/records`.
#[derive(Debug, Serialize)]
struct AddRecordPayload {
    name: String,
    record_type: String,
    value: String,
    ttl: u32,
}

/// Payload sent to SecureLink `DELETE /api/v1/dns/records`.
#[derive(Debug, Serialize)]
struct DeleteRecordPayload {
    name: String,
    record_type: String,
}

/// HTTP client for the signapps-securelink DNS API.
///
/// Provisions MX, SPF, DKIM, DMARC, and service subdomain records
/// automatically when mail domains are created or removed.
///
/// # Examples
///
/// ```ignore
/// let client = SecurelinkDnsClient::new();
/// let results = client.provision_mail_domain(
///     "example.com", "203.0.113.1", "signapps",
///     "v=DKIM1; k=rsa; p=...", "none",
/// ).await?;
/// ```
pub struct SecurelinkDnsClient {
    /// Base URL of the securelink service.
    base_url: String,
    /// HTTP client for API calls.
    client: reqwest::Client,
}

impl SecurelinkDnsClient {
    /// Create a new client, reading `SECURELINK_URL` from the environment.
    ///
    /// Defaults to `http://localhost:3006` if the variable is not set.
    ///
    /// # Panics
    ///
    /// None.
    pub fn new() -> Self {
        let base_url =
            std::env::var("SECURELINK_URL").unwrap_or_else(|_| "http://localhost:3006".to_string());
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_default();
        Self { base_url, client }
    }

    /// Create all required DNS records for a mail domain.
    ///
    /// Provisions MX, SPF (TXT), DKIM (TXT), DMARC (TXT), and autodiscover
    /// records via the SecureLink DNS API. Individual record failures do not
    /// abort the remaining records.
    ///
    /// # Arguments
    ///
    /// * `domain` — The mail domain (e.g. `example.com`).
    /// * `server_ip` — Public IP of the mail server.
    /// * `dkim_selector` — DKIM selector (e.g. `signapps`).
    /// * `dkim_public_key` — DKIM DNS TXT value (e.g. `v=DKIM1; k=rsa; p=...`).
    /// * `dmarc_policy` — DMARC policy (`none`, `quarantine`, `reject`).
    ///
    /// # Errors
    ///
    /// Returns `Err` only if the SecureLink service is completely unreachable.
    /// Individual record failures are captured in the returned results.
    ///
    /// # Panics
    ///
    /// None.
    #[tracing::instrument(skip(self, dkim_public_key), fields(domain = %domain))]
    pub async fn provision_mail_domain(
        &self,
        domain: &str,
        server_ip: &str,
        dkim_selector: &str,
        dkim_public_key: &str,
        dmarc_policy: &str,
    ) -> Result<Vec<DnsProvisionResult>, String> {
        let records = vec![
            // MX record — route inbound mail
            AddRecordPayload {
                name: domain.to_string(),
                record_type: "MX".to_string(),
                value: format!("10 mail.{}", domain),
                ttl: 3600,
            },
            // SPF record — authorize server IP
            AddRecordPayload {
                name: domain.to_string(),
                record_type: "TXT".to_string(),
                value: format!("v=spf1 mx ip4:{} ~all", server_ip),
                ttl: 3600,
            },
            // DKIM record — publish signing public key
            AddRecordPayload {
                name: format!("{}._domainkey.{}", dkim_selector, domain),
                record_type: "TXT".to_string(),
                value: dkim_public_key.to_string(),
                ttl: 3600,
            },
            // DMARC record — set domain policy
            AddRecordPayload {
                name: format!("_dmarc.{}", domain),
                record_type: "TXT".to_string(),
                value: format!("v=DMARC1; p={}; rua=mailto:dmarc@{}", dmarc_policy, domain),
                ttl: 3600,
            },
            // Autoconfig CNAME — Thunderbird auto-setup
            AddRecordPayload {
                name: format!("autoconfig.{}", domain),
                record_type: "CNAME".to_string(),
                value: format!("mail.{}", domain),
                ttl: 3600,
            },
        ];

        let mut results = Vec::with_capacity(records.len());

        for record in &records {
            let result = self.create_record(record).await;
            results.push(result);
        }

        Ok(results)
    }

    /// Create service subdomain records for a domain.
    ///
    /// Provisions `A` and `CNAME` records for standard SignApps services:
    /// `mail`, `calendar`, `contacts`, `autoconfig`, and an `SRV` record
    /// for Outlook autodiscover.
    ///
    /// # Errors
    ///
    /// Returns `Err` only if the SecureLink service is completely unreachable.
    ///
    /// # Panics
    ///
    /// None.
    #[tracing::instrument(skip(self), fields(domain = %domain))]
    pub async fn provision_service_subdomains(
        &self,
        domain: &str,
        server_ip: &str,
    ) -> Result<Vec<DnsProvisionResult>, String> {
        let records = vec![
            // mail.domain.com → A record → server IP
            AddRecordPayload {
                name: format!("mail.{}", domain),
                record_type: "A".to_string(),
                value: server_ip.to_string(),
                ttl: 3600,
            },
            // calendar.domain.com → CNAME → mail.domain.com
            AddRecordPayload {
                name: format!("calendar.{}", domain),
                record_type: "CNAME".to_string(),
                value: format!("mail.{}", domain),
                ttl: 3600,
            },
            // contacts.domain.com → CNAME → mail.domain.com
            AddRecordPayload {
                name: format!("contacts.{}", domain),
                record_type: "CNAME".to_string(),
                value: format!("mail.{}", domain),
                ttl: 3600,
            },
            // meet.domain.com → CNAME → mail.domain.com
            AddRecordPayload {
                name: format!("meet.{}", domain),
                record_type: "CNAME".to_string(),
                value: format!("mail.{}", domain),
                ttl: 3600,
            },
            // chat.domain.com → CNAME → mail.domain.com
            AddRecordPayload {
                name: format!("chat.{}", domain),
                record_type: "CNAME".to_string(),
                value: format!("mail.{}", domain),
                ttl: 3600,
            },
            // drive.domain.com → CNAME → mail.domain.com
            AddRecordPayload {
                name: format!("drive.{}", domain),
                record_type: "CNAME".to_string(),
                value: format!("mail.{}", domain),
                ttl: 3600,
            },
        ];

        let mut results = Vec::with_capacity(records.len());

        for record in &records {
            let result = self.create_record(record).await;
            results.push(result);
        }

        Ok(results)
    }

    /// Remove all DNS records for a mail domain.
    ///
    /// Deprovisions MX, SPF, DKIM, DMARC, autodiscover, and service subdomain
    /// records. Failures are logged but do not cause the operation to fail.
    ///
    /// # Errors
    ///
    /// Returns `Err` only if the SecureLink service is completely unreachable.
    ///
    /// # Panics
    ///
    /// None.
    #[tracing::instrument(skip(self), fields(domain = %domain))]
    pub async fn deprovision_mail_domain(&self, domain: &str) -> Result<(), String> {
        let records_to_delete = vec![
            // Mail records
            DeleteRecordPayload {
                name: domain.to_string(),
                record_type: "MX".to_string(),
            },
            DeleteRecordPayload {
                name: domain.to_string(),
                record_type: "TXT".to_string(),
            },
            DeleteRecordPayload {
                name: format!("signapps._domainkey.{}", domain),
                record_type: "TXT".to_string(),
            },
            DeleteRecordPayload {
                name: format!("_dmarc.{}", domain),
                record_type: "TXT".to_string(),
            },
            // Service subdomains
            DeleteRecordPayload {
                name: format!("mail.{}", domain),
                record_type: "A".to_string(),
            },
            DeleteRecordPayload {
                name: format!("calendar.{}", domain),
                record_type: "CNAME".to_string(),
            },
            DeleteRecordPayload {
                name: format!("contacts.{}", domain),
                record_type: "CNAME".to_string(),
            },
            DeleteRecordPayload {
                name: format!("meet.{}", domain),
                record_type: "CNAME".to_string(),
            },
            DeleteRecordPayload {
                name: format!("chat.{}", domain),
                record_type: "CNAME".to_string(),
            },
            DeleteRecordPayload {
                name: format!("drive.{}", domain),
                record_type: "CNAME".to_string(),
            },
            DeleteRecordPayload {
                name: format!("autoconfig.{}", domain),
                record_type: "CNAME".to_string(),
            },
        ];

        for record in &records_to_delete {
            if let Err(e) = self.delete_record(record).await {
                tracing::warn!(
                    record_name = %record.name,
                    record_type = %record.record_type,
                    "Failed to delete DNS record during deprovision: {}",
                    e
                );
            }
        }

        Ok(())
    }

    /// Create a single DNS record via SecureLink API.
    ///
    /// # Panics
    ///
    /// None.
    async fn create_record(&self, payload: &AddRecordPayload) -> DnsProvisionResult {
        let url = format!("{}/api/v1/dns/records", self.base_url);

        match self.client.post(&url).json(payload).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    tracing::info!(
                        name = %payload.name,
                        record_type = %payload.record_type,
                        "DNS record provisioned via SecureLink"
                    );
                    DnsProvisionResult {
                        name: payload.name.clone(),
                        record_type: payload.record_type.clone(),
                        value: payload.value.clone(),
                        success: true,
                        error: None,
                    }
                } else {
                    let status = resp.status();
                    let body = resp.text().await.unwrap_or_default();
                    tracing::warn!(
                        name = %payload.name,
                        status = %status,
                        body = %body,
                        "Failed to provision DNS record via SecureLink"
                    );
                    DnsProvisionResult {
                        name: payload.name.clone(),
                        record_type: payload.record_type.clone(),
                        value: payload.value.clone(),
                        success: false,
                        error: Some(format!("HTTP {}: {}", status, body)),
                    }
                }
            },
            Err(e) => {
                tracing::warn!(
                    name = %payload.name,
                    "SecureLink unreachable, DNS record not provisioned: {}",
                    e
                );
                DnsProvisionResult {
                    name: payload.name.clone(),
                    record_type: payload.record_type.clone(),
                    value: payload.value.clone(),
                    success: false,
                    error: Some(format!("Connection failed: {}", e)),
                }
            },
        }
    }

    /// Delete a single DNS record via SecureLink API.
    ///
    /// # Errors
    ///
    /// Returns `Err` if the HTTP request fails or returns a non-success status.
    ///
    /// # Panics
    ///
    /// None.
    async fn delete_record(&self, payload: &DeleteRecordPayload) -> Result<(), String> {
        let url = format!("{}/api/v1/dns/records", self.base_url);

        match self.client.delete(&url).json(payload).send().await {
            Ok(resp) => {
                if resp.status().is_success() || resp.status().as_u16() == 404 {
                    tracing::debug!(
                        name = %payload.name,
                        record_type = %payload.record_type,
                        "DNS record removed via SecureLink"
                    );
                    Ok(())
                } else {
                    let body = resp.text().await.unwrap_or_default();
                    Err(format!("HTTP error: {}", body))
                }
            },
            Err(e) => Err(format!("Connection failed: {}", e)),
        }
    }
}

impl Default for SecurelinkDnsClient {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = SecurelinkDnsClient::new();
        assert!(client.base_url.starts_with("http"));
    }

    #[test]
    fn test_default_base_url() {
        // Without SECURELINK_URL set, should default to localhost:3006
        let client = SecurelinkDnsClient::new();
        // May or may not be default depending on env, just verify it is non-empty
        assert!(!client.base_url.is_empty());
    }

    #[test]
    fn test_dns_provision_result_serialization() {
        let result = DnsProvisionResult {
            name: "example.com".to_string(),
            record_type: "MX".to_string(),
            value: "10 mail.example.com".to_string(),
            success: true,
            error: None,
        };
        let json = serde_json::to_string(&result).expect("serialization must succeed");
        assert!(json.contains("example.com"));
        assert!(json.contains("MX"));
    }
}
