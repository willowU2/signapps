//! ACME / Let's Encrypt integration with HTTP-01 challenge.

use dashmap::DashMap;
use instant_acme::{
    Account, AuthorizationStatus, ChallengeType, Identifier, NewAccount, NewOrder, OrderStatus,
};
use signapps_db::models::CreateCertificate;
use signapps_db::repositories::CertificateRepository;
use signapps_db::DatabasePool;
use std::sync::Arc;

use super::tls::TlsCertResolver;

/// In-memory store for ACME HTTP-01 challenge tokens.
#[derive(Clone, Default)]
pub struct AcmeChallengeStore {
    /// Maps token → proof (key authorization).
    tokens: Arc<DashMap<String, String>>,
}

impl AcmeChallengeStore {
    pub fn new() -> Self {
        Self {
            tokens: Arc::new(DashMap::new()),
        }
    }

    /// Store a challenge token and its proof.
    pub fn insert(&self, token: String, proof: String) {
        self.tokens.insert(token, proof);
    }

    /// Look up a challenge proof by token.
    pub fn get(&self, token: &str) -> Option<String> {
        self.tokens.get(token).map(|v| v.value().clone())
    }

    /// Remove a challenge after validation.
    pub fn remove(&self, token: &str) {
        self.tokens.remove(token);
    }
}

/// ACME certificate provisioning service.
#[derive(Clone)]
pub struct AcmeService {
    pub challenge_store: AcmeChallengeStore,
    pub pool: DatabasePool,
    pub tls_resolver: Option<TlsCertResolver>,
    pub email: String,
    pub directory_url: String,
}

impl AcmeService {
    pub fn new(
        pool: DatabasePool,
        challenge_store: AcmeChallengeStore,
        tls_resolver: Option<TlsCertResolver>,
        email: String,
        directory_url: String,
    ) -> Self {
        Self {
            challenge_store,
            pool,
            tls_resolver,
            email,
            directory_url,
        }
    }

    /// Provision a certificate for a domain via ACME HTTP-01 challenge.
    pub async fn provision_certificate(
        &self,
        domain: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        tracing::info!(domain, "Starting ACME certificate provisioning");

        // Create ACME account
        let (account, credentials) = Account::create(
            &NewAccount {
                contact: &[&format!("mailto:{}", self.email)],
                terms_of_service_agreed: true,
                only_return_existing: false,
            },
            &self.directory_url,
            None,
        )
        .await?;

        // Store ACME account in DB
        let repo = CertificateRepository::new(&self.pool);
        let cred_json = serde_json::to_value(&credentials)?;
        repo.get_or_create_acme_account(
            &self.email,
            &self.directory_url,
            &cred_json,
        )
        .await?;

        tracing::debug!("ACME account created/loaded");

        // Create order
        let identifier = Identifier::Dns(domain.to_string());
        let mut order = account
            .new_order(&NewOrder {
                identifiers: &[identifier],
            })
            .await?;

        // Get authorizations
        let authorizations = order.authorizations().await?;
        let mut challenge_tokens = Vec::new();

        for auth in &authorizations {
            match auth.status {
                AuthorizationStatus::Valid => continue,
                AuthorizationStatus::Pending => {}
                _ => {
                    return Err(format!(
                        "Unexpected authorization status: {:?}",
                        auth.status
                    )
                    .into());
                }
            }

            // Find HTTP-01 challenge
            let challenge = auth
                .challenges
                .iter()
                .find(|c| c.r#type == ChallengeType::Http01)
                .ok_or("No HTTP-01 challenge found")?;

            // Compute key authorization
            let key_auth = order.key_authorization(challenge);

            // Store token → key authorization in challenge store
            self.challenge_store.insert(
                challenge.token.clone(),
                key_auth.as_str().to_string(),
            );

            challenge_tokens.push(challenge.token.clone());

            tracing::debug!(
                token = %challenge.token,
                "ACME challenge stored, waiting for validation"
            );

            // Tell ACME server we're ready
            order.set_challenge_ready(&challenge.url).await?;
        }

        // Wait for order to become ready (poll with backoff)
        let mut tries = 1u8;
        let mut delay = std::time::Duration::from_millis(250);
        loop {
            tokio::time::sleep(delay).await;
            let state = order.refresh().await?;

            match state.status {
                OrderStatus::Ready | OrderStatus::Valid => {
                    tracing::debug!("ACME order is ready for finalization");
                    break;
                }
                OrderStatus::Invalid => {
                    return Err("ACME order is invalid".into());
                }
                _ => {
                    delay *= 2;
                    tries += 1;
                    if tries >= 10 {
                        return Err(format!(
                            "ACME order timed out: {:?}",
                            state.status
                        )
                        .into());
                    }
                }
            }
        }

        // Generate CSR with rcgen
        let mut params =
            rcgen::CertificateParams::new(vec![domain.to_string()])?;
        params.distinguished_name = rcgen::DistinguishedName::new();

        let key_pair = rcgen::KeyPair::generate()?;
        let csr = params.serialize_request(&key_pair)?;

        // Finalize order with CSR
        order.finalize(csr.der()).await?;

        // Wait for certificate
        let cert_chain_pem: String = loop {
            match order.certificate().await? {
                Some(cert) => break cert,
                None => {
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                }
            }
        };

        let key_pem = key_pair.serialize_pem();

        // Save to database
        let now = chrono::Utc::now();
        let not_after = now + chrono::Duration::days(90);

        let create_cert = CreateCertificate {
            domain: domain.to_string(),
            cert_pem: cert_chain_pem.clone(),
            key_pem: key_pem.clone(),
            issuer: Some("Let's Encrypt".to_string()),
            not_before: now,
            not_after,
            auto_renew: true,
        };

        repo.upsert(&create_cert).await?;

        // Update TLS resolver immediately
        if let Some(ref resolver) = self.tls_resolver {
            match super::tls::parse_certificate(&cert_chain_pem, &key_pem) {
                Ok(certified_key) => {
                    resolver.upsert_cert(domain, certified_key);
                    tracing::info!(domain, "TLS certificate loaded into resolver");
                }
                Err(e) => {
                    tracing::error!(
                        domain,
                        error = %e,
                        "Failed to load cert into resolver"
                    );
                }
            }
        }

        // Clean up challenge tokens
        for token in &challenge_tokens {
            self.challenge_store.remove(token);
        }

        tracing::info!(domain, "ACME certificate provisioned successfully");

        Ok(())
    }
}

/// Start auto-renewal loop that checks for expiring certificates.
pub async fn start_auto_renewal_loop(
    acme_service: AcmeService,
    interval_hours: u64,
    days_before_expiry: i64,
) {
    tracing::info!(
        interval_hours,
        days_before_expiry,
        "Starting ACME auto-renewal loop"
    );

    loop {
        tokio::time::sleep(std::time::Duration::from_secs(
            interval_hours * 3600,
        ))
        .await;

        let threshold =
            chrono::Utc::now() + chrono::Duration::days(days_before_expiry);
        let repo = CertificateRepository::new(&acme_service.pool);

        match repo.list_expiring_before(threshold).await {
            Ok(certs) => {
                for cert in certs {
                    tracing::info!(
                        domain = %cert.domain,
                        expires = %cert.not_after,
                        "Renewing expiring certificate"
                    );

                    if let Err(e) = acme_service
                        .provision_certificate(&cert.domain)
                        .await
                    {
                        tracing::error!(
                            domain = %cert.domain,
                            error = %e,
                            "ACME renewal failed"
                        );
                    }
                }
            }
            Err(e) => {
                tracing::error!(error = %e, "Failed to query expiring certs");
            }
        }
    }
}
