//! Certificate repository for TLS management.

use crate::models::{AcmeAccount, Certificate, CreateCertificate};
use crate::DatabasePool;
use chrono::{DateTime, Utc};
use signapps_common::Result;
use uuid::Uuid;

/// Repository for certificate operations.
pub struct CertificateRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> CertificateRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find certificate by ID.
    pub async fn find(&self, id: Uuid) -> Result<Option<Certificate>> {
        let cert = sqlx::query_as::<_, Certificate>(
            "SELECT * FROM proxy.certificates WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(cert)
    }

    /// Find certificate by domain.
    pub async fn find_by_domain(&self, domain: &str) -> Result<Option<Certificate>> {
        let cert = sqlx::query_as::<_, Certificate>(
            "SELECT * FROM proxy.certificates WHERE domain = $1",
        )
        .bind(domain)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(cert)
    }

    /// List all certificates.
    pub async fn list(&self) -> Result<Vec<Certificate>> {
        let certs = sqlx::query_as::<_, Certificate>(
            "SELECT * FROM proxy.certificates ORDER BY domain",
        )
        .fetch_all(self.pool.inner())
        .await?;

        Ok(certs)
    }

    /// List certificates expiring before a given threshold.
    pub async fn list_expiring_before(
        &self,
        threshold: DateTime<Utc>,
    ) -> Result<Vec<Certificate>> {
        let certs = sqlx::query_as::<_, Certificate>(
            "SELECT * FROM proxy.certificates WHERE auto_renew = true AND not_after < $1 ORDER BY not_after",
        )
        .bind(threshold)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(certs)
    }

    /// Upsert a certificate (insert or update on domain conflict).
    pub async fn upsert(&self, cert: &CreateCertificate) -> Result<Certificate> {
        let created = sqlx::query_as::<_, Certificate>(
            r#"
            INSERT INTO proxy.certificates (domain, cert_pem, key_pem, issuer, not_before, not_after, auto_renew)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (domain)
            DO UPDATE SET
                cert_pem = EXCLUDED.cert_pem,
                key_pem = EXCLUDED.key_pem,
                issuer = EXCLUDED.issuer,
                not_before = EXCLUDED.not_before,
                not_after = EXCLUDED.not_after,
                auto_renew = EXCLUDED.auto_renew,
                updated_at = NOW()
            RETURNING *
            "#,
        )
        .bind(&cert.domain)
        .bind(&cert.cert_pem)
        .bind(&cert.key_pem)
        .bind(&cert.issuer)
        .bind(cert.not_before)
        .bind(cert.not_after)
        .bind(cert.auto_renew)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Delete a certificate.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM proxy.certificates WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }

    // --- ACME Account methods ---

    /// Find ACME account by ID.
    pub async fn find_acme_account(&self, id: Uuid) -> Result<Option<AcmeAccount>> {
        let account = sqlx::query_as::<_, AcmeAccount>(
            "SELECT * FROM proxy.acme_accounts WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(account)
    }

    /// Get or create the first ACME account.
    pub async fn get_or_create_acme_account(
        &self,
        email: &str,
        directory_url: &str,
        credentials: &serde_json::Value,
    ) -> Result<AcmeAccount> {
        // Try to find existing
        let existing = sqlx::query_as::<_, AcmeAccount>(
            "SELECT * FROM proxy.acme_accounts WHERE email = $1 LIMIT 1",
        )
        .bind(email)
        .fetch_optional(self.pool.inner())
        .await?;

        if let Some(account) = existing {
            return Ok(account);
        }

        // Create new
        let account = sqlx::query_as::<_, AcmeAccount>(
            r#"
            INSERT INTO proxy.acme_accounts (email, directory_url, account_credentials)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(email)
        .bind(directory_url)
        .bind(credentials)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(account)
    }
}
