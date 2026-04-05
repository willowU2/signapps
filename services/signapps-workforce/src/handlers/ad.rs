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

/// List DNS zones for a domain.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_dns_zones(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let zones: Vec<signapps_db::models::ad_dns::AdDnsZone> = sqlx::query_as(
        "SELECT * FROM ad_dns_zones WHERE domain_id = $1 ORDER BY zone_name",
    )
    .bind(domain_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list DNS zones: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(zones)))
}

/// List DNS records for a zone.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_dns_records(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(zone_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let records: Vec<signapps_db::models::ad_dns::AdDnsRecord> = sqlx::query_as(
        "SELECT * FROM ad_dns_records WHERE zone_id = $1 ORDER BY name, record_type",
    )
    .bind(zone_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list DNS records: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(records)))
}

/// List Kerberos principal keys for a domain (key material excluded).
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_keys(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let keys: Vec<serde_json::Value> = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            String,
            i32,
            i32,
            Option<String>,
            Option<Uuid>,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        "SELECT id, principal_name, principal_type, key_version, enc_type, salt, entity_id, \
         created_at FROM ad_principal_keys WHERE domain_id = $1 ORDER BY principal_name, enc_type",
    )
    .bind(domain_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list Kerberos keys: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .into_iter()
    .map(|(id, name, ptype, version, enc, salt, entity, created)| {
        json!({
            "id": id,
            "principal_name": name,
            "principal_type": ptype,
            "key_version": version,
            "enc_type": enc,
            "salt": salt,
            "entity_id": entity,
            "created_at": created,
        })
    })
    .collect();
    Ok(Json(json!(keys)))
}

/// List computer accounts (org nodes with type `computer`) for a domain.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_computers(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(_domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let computers: Vec<serde_json::Value> = sqlx::query_as::<
        _,
        (Uuid, String, Option<String>, chrono::DateTime<chrono::Utc>),
    >(
        "SELECT id, name, description, created_at FROM workforce_org_nodes \
         WHERE tenant_id = $1 AND node_type = 'computer' AND is_active = true ORDER BY name",
    )
    .bind(ctx.tenant_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list computer accounts: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .into_iter()
    .map(|(id, name, _desc, created)| {
        let none: Option<String> = None;
        json!({
            "id": id,
            "name": name,
            "dns_hostname": none,
            "os": none,
            "os_version": none,
            "last_logon": none,
            "created_at": created,
        })
    })
    .collect();
    Ok(Json(json!(computers)))
}

/// List GPOs (governance policies) for a domain.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_gpos(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(_domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let gpos: Vec<serde_json::Value> = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            Option<String>,
            String,
            i32,
            bool,
            bool,
            serde_json::Value,
        ),
    >(
        "SELECT id, name, description, domain, priority, is_enforced, is_disabled, settings \
         FROM workforce_org_policies WHERE tenant_id = $1 AND domain = 'governance' \
         ORDER BY priority DESC, name",
    )
    .bind(ctx.tenant_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list GPOs: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .into_iter()
    .map(|(id, name, _desc, _domain, _priority, enforced, disabled, _settings)| {
        json!({
            "id": id,
            "display_name": name,
            "version": 1,
            "enabled": !disabled,
            "machine_enabled": enforced,
            "user_enabled": true,
            "linked_ous": [],
        })
    })
    .collect();
    Ok(Json(json!(gpos)))
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
