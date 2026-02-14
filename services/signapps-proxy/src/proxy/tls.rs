//! TLS termination with rustls and SNI-based certificate resolution.

use arc_swap::ArcSwap;
use rustls::server::{ClientHello, ResolvesServerCert};
use rustls::sign::CertifiedKey;
use signapps_db::repositories::CertificateRepository;
use signapps_db::DatabasePool;
use std::collections::HashMap;
use std::sync::Arc;

/// TLS certificate resolver with SNI support and DB-backed storage.
#[derive(Clone)]
pub struct TlsCertResolver {
    certs: Arc<ArcSwap<HashMap<String, Arc<CertifiedKey>>>>,
    fallback: Arc<CertifiedKey>,
}

impl std::fmt::Debug for TlsCertResolver {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TlsCertResolver")
            .field("certs_count", &self.certs.load().len())
            .finish()
    }
}

impl TlsCertResolver {
    /// Create a new TLS resolver with a self-signed fallback certificate.
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let fallback = generate_self_signed()?;

        Ok(Self {
            certs: Arc::new(ArcSwap::from_pointee(HashMap::new())),
            fallback: Arc::new(fallback),
        })
    }

    /// Number of loaded certificates.
    pub fn cert_count(&self) -> usize {
        self.certs.load().len()
    }

    /// Force refresh certificates from database.
    pub async fn refresh_from_db(
        &self,
        pool: &DatabasePool,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let repo = CertificateRepository::new(pool);
        let certs = repo.list().await?;

        let mut map = HashMap::new();

        for cert in &certs {
            match parse_certificate(&cert.cert_pem, &cert.key_pem) {
                Ok(certified_key) => {
                    map.insert(cert.domain.clone(), Arc::new(certified_key));
                    tracing::debug!(domain = %cert.domain, "Loaded TLS certificate");
                }
                Err(e) => {
                    tracing::warn!(
                        domain = %cert.domain,
                        error = %e,
                        "Failed to load TLS certificate"
                    );
                }
            }
        }

        let loaded = map.len();
        self.certs.store(Arc::new(map));

        tracing::debug!(certificates = loaded, "TLS certificate cache refreshed");

        Ok(())
    }

    /// Insert or update a certificate for a domain.
    pub fn upsert_cert(&self, domain: &str, certified_key: CertifiedKey) {
        let mut map = (**self.certs.load()).clone();
        map.insert(domain.to_string(), Arc::new(certified_key));
        self.certs.store(Arc::new(map));
    }
}

impl ResolvesServerCert for TlsCertResolver {
    fn resolve(&self, client_hello: ClientHello<'_>) -> Option<Arc<CertifiedKey>> {
        let sni = client_hello.server_name()?;

        let certs = self.certs.load();

        // Exact match
        if let Some(cert) = certs.get(sni) {
            return Some(cert.clone());
        }

        // Wildcard match: try *.example.com for sub.example.com
        if let Some(dot_pos) = sni.find('.') {
            let wildcard = format!("*{}", &sni[dot_pos..]);
            if let Some(cert) = certs.get(&wildcard) {
                return Some(cert.clone());
            }
        }

        // Fallback to self-signed
        Some(self.fallback.clone())
    }
}

/// Parse PEM-encoded certificate and private key into a CertifiedKey.
pub fn parse_certificate(
    cert_pem: &str,
    key_pem: &str,
) -> Result<CertifiedKey, Box<dyn std::error::Error + Send + Sync>> {
    let cert_chain = rustls_pemfile::certs(&mut cert_pem.as_bytes())
        .collect::<Result<Vec<_>, _>>()?;

    if cert_chain.is_empty() {
        return Err("No certificates found in PEM".into());
    }

    let private_key = rustls_pemfile::private_key(&mut key_pem.as_bytes())?
        .ok_or("No private key found in PEM")?;

    let signing_key = rustls::crypto::ring::sign::any_supported_type(&private_key)?;

    Ok(CertifiedKey::new(cert_chain, signing_key))
}

/// Generate a self-signed certificate for fallback.
fn generate_self_signed() -> Result<CertifiedKey, Box<dyn std::error::Error>> {
    let mut params = rcgen::CertificateParams::new(vec!["localhost".to_string()])?;
    params.distinguished_name.push(
        rcgen::DnType::CommonName,
        rcgen::DnValue::Utf8String("SignApps Proxy".to_string()),
    );

    let key_pair = rcgen::KeyPair::generate()?;
    let cert = params.self_signed(&key_pair)?;

    let cert_pem = cert.pem();
    let key_pem = key_pair.serialize_pem();

    parse_certificate(&cert_pem, &key_pem)
        .map_err(|e| -> Box<dyn std::error::Error> { e })
}

/// Start TLS certificate refresh loop.
pub async fn start_cert_refresh_loop(
    resolver: TlsCertResolver,
    pool: DatabasePool,
    interval_secs: u64,
) {
    tracing::info!(interval_secs, "Starting TLS cert refresh loop");

    // Initial load
    if let Err(e) = resolver.refresh_from_db(&pool).await {
        tracing::error!(error = %e, "Initial TLS cert load failed");
    }

    loop {
        tokio::time::sleep(std::time::Duration::from_secs(interval_secs)).await;

        if let Err(e) = resolver.refresh_from_db(&pool).await {
            tracing::error!(error = %e, "TLS cert refresh failed");
        }
    }
}
