//! Certificate management handlers.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::models::{Certificate, CreateCertificate};
use signapps_db::repositories::CertificateRepository;
use uuid::Uuid;

use crate::AppState;

/// Certificate response.
#[derive(Debug, Serialize)]
pub struct CertificateResponse {
    pub id: Uuid,
    pub domain: String,
    pub issuer: Option<String>,
    pub not_before: chrono::DateTime<chrono::Utc>,
    pub not_after: chrono::DateTime<chrono::Utc>,
    pub auto_renew: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<Certificate> for CertificateResponse {
    fn from(cert: Certificate) -> Self {
        Self {
            id: cert.id,
            domain: cert.domain,
            issuer: cert.issuer,
            not_before: cert.not_before,
            not_after: cert.not_after,
            auto_renew: cert.auto_renew,
            created_at: cert.created_at,
            updated_at: cert.updated_at,
        }
    }
}

/// List all certificates.
#[tracing::instrument(skip_all)]
pub async fn list_certificates(
    State(state): State<AppState>,
) -> Result<Json<Vec<CertificateResponse>>> {
    let repo = CertificateRepository::new(&state.pool);
    let certs = repo.list().await?;

    let responses: Vec<CertificateResponse> =
        certs.into_iter().map(CertificateResponse::from).collect();

    Ok(Json(responses))
}

/// Upload a certificate manually.
#[tracing::instrument(skip_all)]
pub async fn upload_certificate(
    State(state): State<AppState>,
    Json(payload): Json<CreateCertificate>,
) -> Result<(StatusCode, Json<CertificateResponse>)> {
    // Validate PEM format
    if !payload.cert_pem.contains("BEGIN CERTIFICATE") {
        return Err(Error::Validation(
            "Invalid certificate PEM format".to_string(),
        ));
    }
    if !payload.key_pem.contains("BEGIN") || !payload.key_pem.contains("PRIVATE KEY") {
        return Err(Error::Validation(
            "Invalid private key PEM format".to_string(),
        ));
    }

    // Verify the cert/key pair is valid
    crate::proxy::tls::parse_certificate(&payload.cert_pem, &payload.key_pem)
        .map_err(|e| Error::Validation(format!("Invalid certificate/key pair: {}", e)))?;

    let repo = CertificateRepository::new(&state.pool);
    let cert = repo.upsert(&payload).await?;

    tracing::info!(domain = %cert.domain, "Certificate uploaded");

    Ok((StatusCode::CREATED, Json(CertificateResponse::from(cert))))
}

/// Request body for ACME certificate request.
#[derive(Debug, Deserialize)]
pub struct RequestCertificateBody {
    pub domain: String,
}

/// Request a certificate via ACME (Let's Encrypt).
#[tracing::instrument(skip_all)]
pub async fn request_certificate(
    State(_state): State<AppState>,
    Json(payload): Json<RequestCertificateBody>,
) -> Result<Json<serde_json::Value>> {
    let acme_enabled = std::env::var("ACME_ENABLED")
        .unwrap_or_else(|_| "false".to_string())
        .parse::<bool>()
        .unwrap_or(false);

    if !acme_enabled {
        return Err(Error::Configuration(
            "ACME is not enabled. Set ACME_ENABLED=true and ACME_EMAIL to use Let's Encrypt."
                .to_string(),
        ));
    }

    // Phase 3: Full ACME implementation
    tracing::info!(domain = %payload.domain, "ACME certificate request queued");

    Ok(Json(serde_json::json!({
        "status": "queued",
        "domain": payload.domain,
        "message": "Certificate provisioning has been queued"
    })))
}

/// Renew an existing certificate.
#[tracing::instrument(skip_all)]
pub async fn renew_certificate(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let repo = CertificateRepository::new(&state.pool);

    let cert = repo
        .find(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Certificate {}", id)))?;

    tracing::info!(
        cert_id = %id,
        domain = %cert.domain,
        "Certificate renewal requested"
    );

    Ok(Json(serde_json::json!({
        "status": "queued",
        "domain": cert.domain,
        "message": "Certificate renewal has been queued"
    })))
}

/// Delete a certificate.
#[tracing::instrument(skip_all)]
pub async fn delete_certificate(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let repo = CertificateRepository::new(&state.pool);

    let cert = repo
        .find(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Certificate {}", id)))?;

    repo.delete(id).await?;

    tracing::info!(
        cert_id = %id,
        domain = %cert.domain,
        "Certificate deleted"
    );

    Ok(StatusCode::NO_CONTENT)
}
