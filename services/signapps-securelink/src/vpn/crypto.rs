//! Cryptographic utilities for VPN certificates.

use signapps_common::{Error, Result};
use std::process::Command;
use tokio::fs;
use uuid::Uuid;

/// Crypto service for certificate management.
#[derive(Clone)]
pub struct CryptoService {
    ca_path: String,
    certs_path: String,
}

impl CryptoService {
    /// Create a new crypto service.
    pub fn new(ca_path: &str, certs_path: &str) -> Self {
        Self {
            ca_path: ca_path.to_string(),
            certs_path: certs_path.to_string(),
        }
    }

    /// Generate a new key pair.
    pub async fn generate_keypair(&self) -> Result<KeyPair> {
        // Use OpenSSL to generate Ed25519 key pair
        let temp_dir = std::env::temp_dir();
        let key_path = temp_dir.join(format!("key_{}.pem", Uuid::new_v4()));
        let pub_path = temp_dir.join(format!("pub_{}.pem", Uuid::new_v4()));

        // Generate private key
        let output = Command::new("openssl")
            .args(["genpkey", "-algorithm", "Ed25519", "-out"])
            .arg(&key_path)
            .output()
            .map_err(|e| Error::Internal(format!("Failed to generate key: {}", e)))?;

        if !output.status.success() {
            return Err(Error::Internal(format!(
                "OpenSSL error: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        // Extract public key
        let output = Command::new("openssl")
            .args(["pkey", "-in"])
            .arg(&key_path)
            .args(["-pubout", "-out"])
            .arg(&pub_path)
            .output()
            .map_err(|e| Error::Internal(format!("Failed to extract public key: {}", e)))?;

        if !output.status.success() {
            return Err(Error::Internal(format!(
                "OpenSSL error: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        let private_key = fs::read_to_string(&key_path).await?;
        let public_key = fs::read_to_string(&pub_path).await?;

        // Cleanup temp files
        let _ = fs::remove_file(&key_path).await;
        let _ = fs::remove_file(&pub_path).await;

        Ok(KeyPair {
            private_key,
            public_key,
        })
    }

    /// Sign a certificate for a device.
    pub async fn sign_certificate(
        &self,
        device_name: &str,
        _ip_address: &str,
        _is_lighthouse: bool,
    ) -> Result<Certificate> {
        let ca_key_path = format!("{}/ca.key", self.ca_path);
        let ca_cert_path = format!("{}/ca.crt", self.ca_path);

        // Generate device keypair
        let keypair = self.generate_keypair().await?;

        // Create temp files for CSR and cert
        let temp_dir = std::env::temp_dir();
        let key_path = temp_dir.join(format!("{}.key", device_name));
        let csr_path = temp_dir.join(format!("{}.csr", device_name));
        let cert_path = temp_dir.join(format!("{}.crt", device_name));

        // Write private key
        fs::write(&key_path, &keypair.private_key).await?;

        // Generate CSR
        let subject = format!("/CN={}/O=SecureLink", device_name);
        let output = Command::new("openssl")
            .args(["req", "-new", "-key"])
            .arg(&key_path)
            .args(["-out"])
            .arg(&csr_path)
            .args(["-subj", &subject])
            .output()
            .map_err(|e| Error::Internal(format!("Failed to create CSR: {}", e)))?;

        if !output.status.success() {
            return Err(Error::Internal(format!(
                "OpenSSL CSR error: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        // Sign with CA
        let output = Command::new("openssl")
            .args(["x509", "-req", "-in"])
            .arg(&csr_path)
            .args(["-CA", &ca_cert_path, "-CAkey", &ca_key_path])
            .args(["-CAcreateserial", "-out"])
            .arg(&cert_path)
            .args(["-days", "365"])
            .output()
            .map_err(|e| Error::Internal(format!("Failed to sign cert: {}", e)))?;

        if !output.status.success() {
            return Err(Error::Internal(format!(
                "OpenSSL sign error: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        let cert_pem = fs::read_to_string(&cert_path).await?;
        let ca_pem = fs::read_to_string(&ca_cert_path).await?;

        // Cleanup temp files
        let _ = fs::remove_file(&key_path).await;
        let _ = fs::remove_file(&csr_path).await;
        let _ = fs::remove_file(&cert_path).await;

        Ok(Certificate {
            ca: ca_pem,
            cert: cert_pem,
            key: keypair.private_key,
            public_key: keypair.public_key,
        })
    }

    /// Get CA certificate.
    pub async fn get_ca_certificate(&self) -> Result<String> {
        let ca_cert_path = format!("{}/ca.crt", self.ca_path);
        let ca_pem = fs::read_to_string(&ca_cert_path).await?;
        Ok(ca_pem)
    }

    /// Initialize CA if it doesn't exist.
    pub async fn init_ca(&self, name: &str) -> Result<()> {
        let ca_key_path = format!("{}/ca.key", self.ca_path);
        let ca_cert_path = format!("{}/ca.crt", self.ca_path);

        // Check if CA already exists
        if tokio::fs::metadata(&ca_cert_path).await.is_ok() {
            tracing::info!("CA already exists");
            return Ok(());
        }

        // Create CA directory
        fs::create_dir_all(&self.ca_path).await?;

        // Generate CA key
        let output = Command::new("openssl")
            .args(["genpkey", "-algorithm", "Ed25519", "-out", &ca_key_path])
            .output()
            .map_err(|e| Error::Internal(format!("Failed to generate CA key: {}", e)))?;

        if !output.status.success() {
            return Err(Error::Internal(format!(
                "OpenSSL error: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        // Generate CA certificate
        let subject = format!("/CN={} CA/O=SecureLink", name);
        let output = Command::new("openssl")
            .args([
                "req", "-new", "-x509", "-key", &ca_key_path,
                "-out", &ca_cert_path,
                "-days", "3650",
                "-subj", &subject,
            ])
            .output()
            .map_err(|e| Error::Internal(format!("Failed to generate CA cert: {}", e)))?;

        if !output.status.success() {
            return Err(Error::Internal(format!(
                "OpenSSL error: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        tracing::info!("CA initialized: {}", name);

        Ok(())
    }
}

/// Key pair.
#[derive(Debug, Clone)]
pub struct KeyPair {
    pub private_key: String,
    pub public_key: String,
}

/// Certificate bundle.
#[derive(Debug, Clone)]
pub struct Certificate {
    pub ca: String,
    pub cert: String,
    pub key: String,
    pub public_key: String,
}
