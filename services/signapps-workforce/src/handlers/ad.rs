//! Active Directory domain management handlers.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};
use signapps_db::models::ad_domain::CreateAdDomain;
use signapps_db::repositories::{AdDnsRepository, AdDomainRepository};

#[derive(Debug, Deserialize)]
pub struct CreateDomainRequest {
    pub dns_name: String,
    pub netbios_name: String,
    pub tree_id: Option<String>,
    pub admin_user_id: Option<String>,
    pub admin_password: Option<String>,
}

/// List all AD domains for the current tenant.
#[tracing::instrument(skip_all)]
pub async fn list_domains(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let domains = AdDomainRepository::list_by_tenant(&state.pool, ctx.tenant_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list domains: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(json!(domains)))
}

/// Create a new AD domain.
#[tracing::instrument(skip_all)]
pub async fn create_domain(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(req): Json<CreateDomainRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let existing = AdDomainRepository::get_by_dns_name(&state.pool, ctx.tenant_id, &req.dns_name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check domain: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if existing.is_some() {
        return Err(StatusCode::CONFLICT);
    }

    let domain_sid = signapps_ad_core::SecurityIdentifier::generate_domain_sid();
    let realm = req.dns_name.to_uppercase();
    let tree_id = req
        .tree_id
        .as_deref()
        .and_then(|s| Uuid::parse_str(s).ok())
        .unwrap_or(Uuid::new_v4());

    let input = CreateAdDomain {
        dns_name: req.dns_name.clone(),
        netbios_name: req.netbios_name.clone(),
        tree_id,
    };

    let domain = AdDomainRepository::create(
        &state.pool,
        ctx.tenant_id,
        input,
        &domain_sid.to_string(),
        &realm,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to create domain: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Create DNS zone with default SRV records
    if let Ok(zone) = AdDnsRepository::create_zone(&state.pool, domain.id, &req.dns_name).await {
        let dc_fqdn = format!("dc.{}", req.dns_name);
        for (name, port) in &[
            ("_ldap._tcp", 389),
            ("_ldap._tcp.dc._msdcs", 389),
            ("_kerberos._tcp", 88),
            ("_kerberos._tcp.dc._msdcs", 88),
            ("_kpasswd._tcp", 464),
            ("_gc._tcp", 3268),
        ] {
            let _ = AdDnsRepository::add_record(
                &state.pool,
                zone.id,
                name,
                "SRV",
                json!({"priority": 0, "weight": 100, "port": port, "target": dc_fqdn}),
                3600,
                true,
            )
            .await;
        }
        let _ = AdDnsRepository::add_record(
            &state.pool,
            zone.id,
            &dc_fqdn,
            "A",
            json!({"ip": "127.0.0.1"}),
            3600,
            true,
        )
        .await;
    }

    tracing::info!(domain = %req.dns_name, sid = %domain_sid, "AD domain created");

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "domain_id": domain.id,
            "dns_name": domain.dns_name,
            "realm": domain.realm,
            "netbios_name": domain.netbios_name,
            "domain_sid": domain.domain_sid,
        })),
    ))
}

/// Delete an AD domain.
#[tracing::instrument(skip_all)]
pub async fn delete_domain(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    AdDomainRepository::delete(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete domain: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(StatusCode::NO_CONTENT)
}

/// Get DC status.
#[tracing::instrument(skip_all)]
pub async fn dc_status() -> impl IntoResponse {
    Json(json!({
        "service": "signapps-dc",
        "status": "healthy",
        "version": "0.1.0",
    }))
}
