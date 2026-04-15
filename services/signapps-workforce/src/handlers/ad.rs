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

#[derive(Debug, Deserialize)]
pub struct CreateDomainRequest {
    pub dns_name: String,
    pub netbios_name: Option<String>,
    pub domain_type: Option<String>,
    pub ad_enabled: Option<bool>,
    pub mail_enabled: Option<bool>,
    pub dhcp_enabled: Option<bool>,
    pub pxe_enabled: Option<bool>,
    pub admin_user_id: Option<String>,
    pub admin_password: Option<String>,
}

/// List all infrastructure domains for the current tenant.
#[tracing::instrument(skip_all)]
pub async fn list_domains(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let domains: Vec<signapps_db::models::infrastructure::InfraDomain> = sqlx::query_as(
        "SELECT * FROM infrastructure.domains WHERE tenant_id = $1 AND is_active = true ORDER BY dns_name",
    )
    .bind(ctx.tenant_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list domains: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(domains)))
}

/// Create a new infrastructure domain using the unified provisioner.
///
/// Provisions all sub-systems (AD, DNS, certificates, mail, DHCP, NTP,
/// deployment profile) automatically based on the enabled flags in the request.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the core domain INSERT fails
/// (e.g., duplicate `(tenant_id, dns_name)` constraint triggers a DB error).
#[tracing::instrument(skip_all)]
pub async fn create_domain(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(req): Json<CreateDomainRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let input = signapps_db::models::infrastructure::CreateInfraDomain {
        dns_name: req.dns_name.clone(),
        netbios_name: req.netbios_name.clone(),
        domain_type: req.domain_type.clone(),
        ad_enabled: req.ad_enabled,
        mail_enabled: req.mail_enabled,
        dhcp_enabled: req.dhcp_enabled,
        pxe_enabled: req.pxe_enabled,
    };

    let result = signapps_ad_core::provisioner::provision_domain(&state.pool, ctx.tenant_id, input)
        .await
        .map_err(|e| {
            tracing::error!("Domain provisioning failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((StatusCode::CREATED, Json(json!(result))))
}

/// Delete an infrastructure domain (soft-delete via `is_active = false`).
#[tracing::instrument(skip_all)]
pub async fn delete_domain(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    sqlx::query(
        "UPDATE infrastructure.domains SET is_active = false, updated_at = NOW() WHERE id = $1",
    )
    .bind(id)
    .execute(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to delete domain: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(StatusCode::NO_CONTENT)
}

/// Update an infrastructure domain (features, netbios, type).
#[tracing::instrument(skip_all)]
pub async fn update_domain(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    let updates = vec!["updated_at = NOW()".to_string()];
    let bind_idx = 1u32;
    let values: Vec<Box<dyn std::any::Any + Send + Sync>> = Vec::new();

    // Build dynamic SET clause
    // Use raw SQL with parameter placeholders since we need dynamic updates
    let netbios = body["netbios_name"].as_str().map(String::from);
    let domain_type = body["domain_type"].as_str().map(String::from);
    let ad_enabled = body["ad_enabled"].as_bool();
    let mail_enabled = body["mail_enabled"].as_bool();
    let dhcp_enabled = body["dhcp_enabled"].as_bool();
    let pxe_enabled = body["pxe_enabled"].as_bool();
    let ntp_enabled = body["ntp_enabled"].as_bool();

    // Simple approach: update all provided fields
    let _result = sqlx::query(
        r#"UPDATE infrastructure.domains SET
            netbios_name = COALESCE($2, netbios_name),
            domain_type = COALESCE($3, domain_type),
            ad_enabled = COALESCE($4, ad_enabled),
            mail_enabled = COALESCE($5, mail_enabled),
            dhcp_enabled = COALESCE($6, dhcp_enabled),
            pxe_enabled = COALESCE($7, pxe_enabled),
            ntp_enabled = COALESCE($8, ntp_enabled),
            updated_at = NOW()
        WHERE id = $1"#,
    )
    .bind(id)
    .bind(netbios.as_deref())
    .bind(domain_type.as_deref())
    .bind(ad_enabled)
    .bind(mail_enabled)
    .bind(dhcp_enabled)
    .bind(pxe_enabled)
    .bind(ntp_enabled)
    .execute(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update domain: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Ignore unused variables
    let _ = (updates, bind_idx, values);

    Ok(StatusCode::NO_CONTENT)
}

/// Update a deployment profile.
#[tracing::instrument(skip_all)]
pub async fn update_deploy_profile(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(profile_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    let name = body["name"].as_str();
    let description = body["description"].as_str();
    let os_type = body["os_type"].as_str();
    let os_version = body["os_version"].as_str();
    let target_ou = body["target_ou"].as_str();
    let is_default = body["is_default"].as_bool();

    sqlx::query(
        r#"UPDATE infrastructure.deploy_profiles SET
            name = COALESCE($2, name),
            description = COALESCE($3, description),
            os_type = COALESCE($4, os_type),
            os_version = COALESCE($5, os_version),
            target_ou = COALESCE($6, target_ou),
            is_default = COALESCE($7, is_default),
            updated_at = NOW()
        WHERE id = $1"#,
    )
    .bind(profile_id)
    .bind(name)
    .bind(description)
    .bind(os_type)
    .bind(os_version)
    .bind(target_ou)
    .bind(is_default)
    .execute(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update deploy profile: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(StatusCode::NO_CONTENT)
}

/// Update a DHCP scope.
#[tracing::instrument(skip_all)]
pub async fn update_dhcp_scope(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(scope_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    let name = body["name"].as_str();
    let gateway = body["gateway"].as_str();
    let lease_hours = body["lease_duration_hours"].as_i64().map(|v| v as i32);
    let pxe_server = body["pxe_server"].as_str();
    let pxe_bootfile = body["pxe_bootfile"].as_str();

    sqlx::query(
        r#"UPDATE infrastructure.dhcp_scopes SET
            name = COALESCE($2, name),
            gateway = COALESCE($3, gateway),
            lease_duration_hours = COALESCE($4, lease_duration_hours),
            pxe_server = COALESCE($5, pxe_server),
            pxe_bootfile = COALESCE($6, pxe_bootfile)
        WHERE id = $1"#,
    )
    .bind(scope_id)
    .bind(name)
    .bind(gateway)
    .bind(lease_hours)
    .bind(pxe_server)
    .bind(pxe_bootfile)
    .execute(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update DHCP scope: {}", e);
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
    let zones: Vec<signapps_db::models::ad_dns::AdDnsZone> =
        sqlx::query_as("SELECT * FROM ad_dns_zones WHERE domain_id = $1 ORDER BY zone_name")
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
    let computers: Vec<serde_json::Value> =
        sqlx::query_as::<_, (Uuid, String, Option<String>, chrono::DateTime<chrono::Utc>)>(
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
    .map(
        |(id, name, _desc, _domain, _priority, enforced, disabled, _settings)| {
            json!({
                "id": id,
                "display_name": name,
                "version": 1,
                "enabled": !disabled,
                "machine_enabled": enforced,
                "user_enabled": true,
                "linked_ous": [],
            })
        },
    )
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

// ── Certificates ──────────────────────────────────────────────────────────────

/// List certificates for an infrastructure domain.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_certificates(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let certs: Vec<signapps_db::models::infrastructure::InfraCertificate> = sqlx::query_as(
        "SELECT * FROM infrastructure.certificates WHERE domain_id = $1 ORDER BY not_after DESC",
    )
    .bind(domain_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list certificates: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(certs)))
}

// ── DHCP ──────────────────────────────────────────────────────────────────────

/// List DHCP scopes for an infrastructure domain.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_dhcp_scopes(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let scopes: Vec<signapps_db::models::infrastructure::DhcpScope> = sqlx::query_as(
        "SELECT * FROM infrastructure.dhcp_scopes WHERE domain_id = $1 AND is_active = true ORDER BY name",
    )
    .bind(domain_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list DHCP scopes: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(scopes)))
}

/// List active DHCP leases for a scope.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_dhcp_leases(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(scope_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let leases: Vec<signapps_db::models::infrastructure::DhcpLease> = sqlx::query_as(
        "SELECT * FROM infrastructure.dhcp_leases WHERE scope_id = $1 AND is_active = true ORDER BY lease_end DESC",
    )
    .bind(scope_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list DHCP leases: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(leases)))
}

// ── Deployment ────────────────────────────────────────────────────────────────

/// List deployment profiles for an infrastructure domain.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_deploy_profiles(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let profiles: Vec<signapps_db::models::infrastructure::DeployProfile> = sqlx::query_as(
        "SELECT * FROM infrastructure.deploy_profiles WHERE domain_id = $1 ORDER BY sort_order, name",
    )
    .bind(domain_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list deploy profiles: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(profiles)))
}

/// List deployment history for a profile (last 50 entries).
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_deploy_history(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(profile_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let history: Vec<signapps_db::models::infrastructure::DeployHistory> = sqlx::query_as(
        "SELECT * FROM infrastructure.deploy_history WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 50",
    )
    .bind(profile_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list deploy history: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(history)))
}

// ── DHCP CRUD ────────────────────────────────────────────────────────────────

/// Create a new DHCP scope.
#[tracing::instrument(skip_all)]
pub async fn create_dhcp_scope(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    let name = body["name"].as_str().unwrap_or("New Scope");
    let subnet = body["subnet"].as_str().unwrap_or("192.168.1.0/24");
    let range_start = body["range_start"].as_str().unwrap_or("192.168.1.100");
    let range_end = body["range_end"].as_str().unwrap_or("192.168.1.200");
    let gateway = body["gateway"].as_str();
    let lease_hours = body["lease_duration_hours"].as_i64().unwrap_or(8) as i32;

    let scope = signapps_db::repositories::DhcpScopeRepository::create(
        &state.pool,
        domain_id,
        None,
        name,
        subnet,
        range_start,
        range_end,
        gateway,
        &[],
        lease_hours,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to create DHCP scope: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(json!(scope))))
}

/// Delete a DHCP scope (soft-delete: set is_active = false).
#[tracing::instrument(skip_all)]
pub async fn delete_dhcp_scope(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(scope_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    sqlx::query("UPDATE infrastructure.dhcp_scopes SET is_active = false WHERE id = $1")
        .bind(scope_id)
        .execute(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete DHCP scope: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Deploy CRUD ──────────────────────────────────────────────────────────────

/// Create a new deployment profile.
#[tracing::instrument(skip_all)]
pub async fn create_deploy_profile(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    let name = body["name"].as_str().unwrap_or("New Profile");
    let description = body["description"].as_str();
    let os_type = body["os_type"].as_str();
    let os_version = body["os_version"].as_str();

    let profile = signapps_db::repositories::DeployProfileRepository::create(
        &state.pool,
        domain_id,
        name,
        description,
        os_type,
        os_version,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to create deploy profile: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(json!(profile))))
}

/// Delete a deployment profile.
#[tracing::instrument(skip_all)]
pub async fn delete_deploy_profile(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(profile_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    sqlx::query("DELETE FROM infrastructure.deploy_profiles WHERE id = $1")
        .bind(profile_id)
        .execute(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete deploy profile: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(StatusCode::NO_CONTENT)
}

/// Update a domain's configuration (NTP, etc.).
#[tracing::instrument(skip_all)]
pub async fn update_domain_config(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    sqlx::query(
        "UPDATE infrastructure.domains SET config = config || $1, updated_at = now() WHERE id = $2",
    )
    .bind(&body)
    .bind(domain_id)
    .execute(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update domain config: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Certificate Lifecycle ─────────────────────────────────────────────────────

/// Issue a new server certificate signed by the domain's CA.
///
/// Creates a placeholder certificate record in `pending` status. Real signing
/// requires the CA private key to be accessible by the provisioner subsystem.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the INSERT fails (e.g. no
/// root CA exists for the domain yet).
#[tracing::instrument(skip_all)]
pub async fn issue_certificate(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    let subject = body["subject"].as_str().unwrap_or("CN=new-cert");
    let cert_type = body["cert_type"].as_str().unwrap_or("server");
    let san: Vec<String> = body["san"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let now = chrono::Utc::now();
    let expires = now + chrono::Duration::days(730);

    let cert: signapps_db::models::infrastructure::InfraCertificate = sqlx::query_as(
        r#"INSERT INTO infrastructure.certificates
           (domain_id, subject, issuer, cert_type, certificate, not_before, not_after, san, status)
           VALUES ($1, $2,
                   (SELECT subject FROM infrastructure.certificates WHERE domain_id = $1 AND cert_type = 'root_ca' LIMIT 1),
                   $3, 'pending-issuance', $4, $5, $6, 'pending')
           RETURNING *"#,
    )
    .bind(domain_id)
    .bind(subject)
    .bind(cert_type)
    .bind(now)
    .bind(expires)
    .bind(&san)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to issue certificate: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(json!(cert))))
}

/// Revoke a certificate.
///
/// Sets the certificate status to `revoked`. The CRL is not automatically
/// republished; a separate CRL regeneration step is required.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the UPDATE fails.
#[tracing::instrument(skip_all)]
pub async fn revoke_certificate(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(cert_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    sqlx::query("UPDATE infrastructure.certificates SET status = 'revoked' WHERE id = $1")
        .bind(cert_id)
        .execute(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to revoke certificate: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(StatusCode::NO_CONTENT)
}

/// Renew a certificate (reset expiry to +2 years, status back to `active`).
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the UPDATE fails.
#[tracing::instrument(skip_all)]
pub async fn renew_certificate(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(cert_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let now = chrono::Utc::now();
    let new_expiry = now + chrono::Duration::days(730);
    sqlx::query(
        "UPDATE infrastructure.certificates \
         SET not_before = $1, not_after = $2, status = 'active' WHERE id = $3",
    )
    .bind(now)
    .bind(new_expiry)
    .bind(cert_id)
    .execute(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to renew certificate: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(StatusCode::NO_CONTENT)
}

// ── DHCP Reservations ─────────────────────────────────────────────────────────

/// List DHCP reservations for a scope.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_dhcp_reservations(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(scope_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let reservations: Vec<signapps_db::models::infrastructure::DhcpReservation> = sqlx::query_as(
        "SELECT * FROM infrastructure.dhcp_reservations \
             WHERE scope_id = $1 ORDER BY ip_address",
    )
    .bind(scope_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list DHCP reservations: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(reservations)))
}

/// Create a DHCP reservation.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the INSERT fails (e.g.
/// duplicate MAC or IP within the scope).
#[tracing::instrument(skip_all)]
pub async fn create_dhcp_reservation(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(scope_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    let mac = body["mac_address"].as_str().unwrap_or("");
    let ip = body["ip_address"].as_str().unwrap_or("");
    let hostname = body["hostname"].as_str();
    let description = body["description"].as_str();

    let reservation: signapps_db::models::infrastructure::DhcpReservation = sqlx::query_as(
        r#"INSERT INTO infrastructure.dhcp_reservations
           (scope_id, mac_address, ip_address, hostname, description)
           VALUES ($1, $2, $3, $4, $5) RETURNING *"#,
    )
    .bind(scope_id)
    .bind(mac)
    .bind(ip)
    .bind(hostname)
    .bind(description)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create DHCP reservation: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(json!(reservation))))
}

/// Delete a DHCP reservation.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the DELETE fails.
#[tracing::instrument(skip_all)]
pub async fn delete_dhcp_reservation(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(reservation_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    sqlx::query("DELETE FROM infrastructure.dhcp_reservations WHERE id = $1")
        .bind(reservation_id)
        .execute(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete DHCP reservation: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Deploy Assignments ────────────────────────────────────────────────────────

/// List deploy assignments for a profile.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_deploy_assignments(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(profile_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let assignments: Vec<serde_json::Value> =
        sqlx::query_as::<_, (Uuid, Uuid, String, String, chrono::DateTime<chrono::Utc>)>(
            "SELECT id, profile_id, target_type, target_id, created_at \
         FROM infrastructure.deploy_assignments \
         WHERE profile_id = $1 ORDER BY created_at",
        )
        .bind(profile_id)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list deploy assignments: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .into_iter()
        .map(|(id, pid, ttype, tid, created)| {
            json!({
                "id": id,
                "profile_id": pid,
                "target_type": ttype,
                "target_id": tid,
                "created_at": created,
            })
        })
        .collect();
    Ok(Json(json!(assignments)))
}

/// Create a deploy assignment.
///
/// Binds a deployment profile to an org node (or any target type) so that PXE
/// provisioning applies the profile to all matching machines.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the INSERT fails (e.g.
/// duplicate `(profile_id, target_id)` constraint).
#[tracing::instrument(skip_all)]
pub async fn create_deploy_assignment(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(profile_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    let target_type = body["target_type"].as_str().unwrap_or("org_node");
    let target_id = body["target_id"].as_str().unwrap_or("");

    let row: (Uuid, Uuid, String, String, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
        r#"INSERT INTO infrastructure.deploy_assignments (profile_id, target_type, target_id)
           VALUES ($1, $2, $3)
           RETURNING id, profile_id, target_type, target_id, created_at"#,
    )
    .bind(profile_id)
    .bind(target_type)
    .bind(target_id)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create deploy assignment: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": row.0,
            "profile_id": row.1,
            "target_type": row.2,
            "target_id": row.3,
            "created_at": row.4,
        })),
    ))
}

/// Delete a deploy assignment.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the DELETE fails.
#[tracing::instrument(skip_all)]
pub async fn delete_deploy_assignment(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(assignment_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    sqlx::query("DELETE FROM infrastructure.deploy_assignments WHERE id = $1")
        .bind(assignment_id)
        .execute(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete deploy assignment: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Maintenance ───────────────────────────────────────────────────────────────

/// Expire stale DHCP leases (background sweep endpoint).
///
/// Sets `is_active = false` on all leases whose `lease_end` is in the past.
/// Returns the number of leases that were expired.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the UPDATE fails.
#[tracing::instrument(skip_all)]
pub async fn expire_dhcp_leases(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let result = sqlx::query(
        "UPDATE infrastructure.dhcp_leases \
         SET is_active = false \
         WHERE is_active = true AND lease_end <= now()",
    )
    .execute(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to expire leases: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let count = result.rows_affected();
    if count > 0 {
        tracing::info!(expired = count, "DHCP lease expiration sweep completed");
    }
    Ok(Json(json!({ "expired": count })))
}

/// Check for certificates expiring within N days (default 30).
///
/// Returns a list of certificates that are active but will expire soon,
/// suitable for dashboard alerts and notification triggers.
#[tracing::instrument(skip_all)]
pub async fn check_expiring_certificates(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<impl IntoResponse, StatusCode> {
    let days: i32 = params
        .get("days")
        .and_then(|d| d.parse().ok())
        .unwrap_or(30);

    let certs: Vec<signapps_db::models::infrastructure::InfraCertificate> = sqlx::query_as(
        r#"SELECT * FROM infrastructure.certificates
           WHERE status = 'active'
             AND not_after <= now() + make_interval(days => $1)
           ORDER BY not_after ASC"#,
    )
    .bind(days)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to check expiring certificates: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !certs.is_empty() {
        tracing::warn!(
            count = certs.len(),
            days = days,
            "Certificates expiring soon"
        );
    }

    Ok(Json(json!({
        "expiring_within_days": days,
        "count": certs.len(),
        "certificates": certs,
    })))
}

/// Infrastructure health overview — aggregated stats for the dashboard.
#[tracing::instrument(skip_all)]
pub async fn infrastructure_health(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    // Run all stat queries in parallel
    let (domains, certs, expiring, scopes, active_leases, profiles) = tokio::join!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM infrastructure.domains WHERE is_active = true")
            .fetch_one(&*state.pool),
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM infrastructure.certificates WHERE status = 'active'")
            .fetch_one(&*state.pool),
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM infrastructure.certificates WHERE status = 'active' AND not_after <= now() + interval '30 days'"
        ).fetch_one(&*state.pool),
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM infrastructure.dhcp_scopes WHERE is_active = true")
            .fetch_one(&*state.pool),
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM infrastructure.dhcp_leases WHERE is_active = true AND lease_end > now()")
            .fetch_one(&*state.pool),
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM infrastructure.deploy_profiles")
            .fetch_one(&*state.pool),
    );

    Ok(Json(json!({
        "domains": domains.unwrap_or(0),
        "certificates": {
            "active": certs.unwrap_or(0),
            "expiring_soon": expiring.unwrap_or(0),
        },
        "dhcp": {
            "scopes": scopes.unwrap_or(0),
            "active_leases": active_leases.unwrap_or(0),
        },
        "deployment": {
            "profiles": profiles.unwrap_or(0),
        },
    })))
}
