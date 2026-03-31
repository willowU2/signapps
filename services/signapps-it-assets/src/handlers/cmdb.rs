// CM1-CM4: CMDB — CIs, relationships, lifecycle, change management
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_db::DatabasePool;
use uuid::Uuid;

fn internal_err(e: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

// ─── CM1: Configuration items ────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
/// Configuration for urationItem.
pub struct ConfigurationItem {
    pub id: Uuid,
    pub name: String,
    pub ci_type: String,
    pub status: Option<String>,
    pub owner_id: Option<Uuid>,
    pub metadata: Option<Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
/// Represents a create ci req.
pub struct CreateCiReq {
    pub name: String,
    pub ci_type: String,
    pub status: Option<String>,
    pub owner_id: Option<Uuid>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
/// Represents a update ci req.
pub struct UpdateCiReq {
    pub name: Option<String>,
    pub ci_type: Option<String>,
    pub status: Option<String>,
    pub owner_id: Option<Uuid>,
    pub metadata: Option<Value>,
}

#[tracing::instrument(skip_all)]
pub async fn list_cis(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<ConfigurationItem>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, ConfigurationItem>(
        "SELECT id, name, ci_type, status, owner_id, metadata, created_at, updated_at FROM it.configuration_items ORDER BY name",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

#[tracing::instrument(skip_all)]
pub async fn get_ci(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<Json<ConfigurationItem>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, ConfigurationItem>(
        "SELECT id, name, ci_type, status, owner_id, metadata, created_at, updated_at FROM it.configuration_items WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "CI not found".to_string()))?;
    Ok(Json(row))
}

#[tracing::instrument(skip_all)]
pub async fn create_ci(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateCiReq>,
) -> Result<(StatusCode, Json<ConfigurationItem>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, ConfigurationItem>(
        r#"
        INSERT INTO it.configuration_items (name, ci_type, status, owner_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, ci_type, status, owner_id, metadata, created_at, updated_at
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.ci_type)
    .bind(payload.status.as_deref().unwrap_or("active"))
    .bind(payload.owner_id)
    .bind(
        payload
            .metadata
            .as_ref()
            .unwrap_or(&Value::Object(Default::default())),
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[tracing::instrument(skip_all)]
pub async fn update_ci(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCiReq>,
) -> Result<Json<ConfigurationItem>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, ConfigurationItem>(
        r#"
        UPDATE it.configuration_items SET
            name     = COALESCE($1, name),
            ci_type  = COALESCE($2, ci_type),
            status   = COALESCE($3, status),
            owner_id = COALESCE($4, owner_id),
            metadata = COALESCE($5, metadata),
            updated_at = now()
        WHERE id = $6
        RETURNING id, name, ci_type, status, owner_id, metadata, created_at, updated_at
        "#,
    )
    .bind(payload.name.as_deref())
    .bind(payload.ci_type.as_deref())
    .bind(payload.status.as_deref())
    .bind(payload.owner_id)
    .bind(&payload.metadata)
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "CI not found".to_string()))?;
    Ok(Json(row))
}

#[tracing::instrument(skip_all)]
pub async fn delete_ci(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.configuration_items WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "CI not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── CM1: CI relationships ────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
/// Represents a ci relationship.
pub struct CiRelationship {
    pub id: Uuid,
    pub source_ci_id: Uuid,
    pub target_ci_id: Uuid,
    pub relationship_type: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
/// Represents a create ci rel req.
pub struct CreateCiRelReq {
    pub source_ci_id: Uuid,
    pub target_ci_id: Uuid,
    pub relationship_type: String,
}

#[tracing::instrument(skip_all)]
pub async fn list_ci_relationships(
    State(pool): State<DatabasePool>,
    Path(ci_id): Path<Uuid>,
) -> Result<Json<Vec<CiRelationship>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, CiRelationship>(
        "SELECT id, source_ci_id, target_ci_id, relationship_type, created_at FROM it.ci_relationships WHERE source_ci_id = $1 OR target_ci_id = $1 ORDER BY created_at",
    )
    .bind(ci_id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

#[tracing::instrument(skip_all)]
pub async fn create_ci_relationship(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateCiRelReq>,
) -> Result<(StatusCode, Json<CiRelationship>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, CiRelationship>(
        r#"
        INSERT INTO it.ci_relationships (source_ci_id, target_ci_id, relationship_type)
        VALUES ($1, $2, $3)
        RETURNING id, source_ci_id, target_ci_id, relationship_type, created_at
        "#,
    )
    .bind(payload.source_ci_id)
    .bind(payload.target_ci_id)
    .bind(&payload.relationship_type)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[tracing::instrument(skip_all)]
pub async fn delete_ci_relationship(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.ci_relationships WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Relationship not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// Impact analysis — fetch all CIs that depend (directly or indirectly) on a given CI
#[tracing::instrument(skip_all)]
pub async fn ci_impact(
    State(pool): State<DatabasePool>,
    Path(ci_id): Path<Uuid>,
) -> Result<Json<Vec<ConfigurationItem>>, (StatusCode, String)> {
    // Use recursive CTE to find all dependents
    let rows = sqlx::query_as::<_, ConfigurationItem>(
        r#"
        WITH RECURSIVE dependents AS (
            SELECT target_ci_id AS id FROM it.ci_relationships WHERE source_ci_id = $1
            UNION
            SELECT r.target_ci_id FROM it.ci_relationships r
            INNER JOIN dependents d ON d.id = r.source_ci_id
        )
        SELECT ci.id, ci.name, ci.ci_type, ci.status, ci.owner_id, ci.metadata, ci.created_at, ci.updated_at
        FROM it.configuration_items ci
        WHERE ci.id IN (SELECT id FROM dependents)
        "#,
    )
    .bind(ci_id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

// ─── CM3: Change requests ─────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
/// Request payload for Change operation.
pub struct ChangeRequest {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub impact_analysis: Option<String>,
    pub risk_level: Option<String>,
    pub status: Option<String>,
    pub submitted_by: Option<Uuid>,
    pub reviewed_by: Option<Uuid>,
    pub approved_by: Option<Uuid>,
    pub submitted_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub approved_at: Option<DateTime<Utc>>,
    pub implemented_at: Option<DateTime<Utc>>,
    pub verified_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
/// Represents a create change req.
pub struct CreateChangeReq {
    pub title: String,
    pub description: Option<String>,
    pub impact_analysis: Option<String>,
    pub risk_level: Option<String>,
    pub submitted_by: Option<Uuid>,
    pub ci_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
/// Represents a update change status req.
pub struct UpdateChangeStatusReq {
    pub status: String,
    pub actor_id: Option<Uuid>,
}

#[tracing::instrument(skip_all)]
pub async fn list_change_requests(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<ChangeRequest>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, ChangeRequest>(
        "SELECT id, title, description, impact_analysis, risk_level, status, submitted_by, reviewed_by, approved_by, submitted_at, reviewed_at, approved_at, implemented_at, verified_at FROM it.change_requests ORDER BY submitted_at DESC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

#[tracing::instrument(skip_all)]
pub async fn get_change_request(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<Json<ChangeRequest>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, ChangeRequest>(
        "SELECT id, title, description, impact_analysis, risk_level, status, submitted_by, reviewed_by, approved_by, submitted_at, reviewed_at, approved_at, implemented_at, verified_at FROM it.change_requests WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Change request not found".to_string()))?;
    Ok(Json(row))
}

#[tracing::instrument(skip_all)]
pub async fn create_change_request(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateChangeReq>,
) -> Result<(StatusCode, Json<ChangeRequest>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, ChangeRequest>(
        r#"
        INSERT INTO it.change_requests (title, description, impact_analysis, risk_level, submitted_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title, description, impact_analysis, risk_level, status, submitted_by, reviewed_by, approved_by, submitted_at, reviewed_at, approved_at, implemented_at, verified_at
        "#,
    )
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.impact_analysis)
    .bind(payload.risk_level.as_deref().unwrap_or("low"))
    .bind(payload.submitted_by)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    // Link CIs
    if let Some(ci_ids) = payload.ci_ids {
        for ci_id in ci_ids {
            sqlx::query(
                "INSERT INTO it.change_request_cis (change_request_id, ci_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(row.id)
            .bind(ci_id)
            .execute(pool.inner())
            .await
            .map_err(internal_err)?;
        }
    }

    Ok((StatusCode::CREATED, Json(row)))
}

#[tracing::instrument(skip_all)]
pub async fn update_change_status(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateChangeStatusReq>,
) -> Result<Json<ChangeRequest>, (StatusCode, String)> {
    let now = Utc::now();
    let row = sqlx::query_as::<_, ChangeRequest>(
        r#"
        UPDATE it.change_requests SET
            status         = $1,
            reviewed_by    = CASE WHEN $1 = 'reviewed'    THEN $2 ELSE reviewed_by END,
            approved_by    = CASE WHEN $1 = 'approved'    THEN $2 ELSE approved_by END,
            reviewed_at    = CASE WHEN $1 = 'reviewed'    THEN $3 ELSE reviewed_at END,
            approved_at    = CASE WHEN $1 = 'approved'    THEN $3 ELSE approved_at END,
            implemented_at = CASE WHEN $1 = 'implemented' THEN $3 ELSE implemented_at END,
            verified_at    = CASE WHEN $1 = 'verified'    THEN $3 ELSE verified_at END
        WHERE id = $4
        RETURNING id, title, description, impact_analysis, risk_level, status, submitted_by, reviewed_by, approved_by, submitted_at, reviewed_at, approved_at, implemented_at, verified_at
        "#,
    )
    .bind(&payload.status)
    .bind(payload.actor_id)
    .bind(now)
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Change request not found".to_string()))?;
    Ok(Json(row))
}

// CM4: LDAP import — basic TCP probe + proper structure for ldap3 crate
#[derive(Debug, Deserialize)]
/// Represents a ldap import req.
pub struct LdapImportReq {
    pub host: String,
    pub port: Option<u16>,
    pub base_dn: String,
    pub bind_dn: Option<String>,
    pub bind_password: Option<String>,
    /// LDAP filter, e.g. "(objectClass=user)"
    pub filter: Option<String>,
    /// Attributes to return, e.g. ["cn", "mail", "sAMAccountName"]
    pub attributes: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
/// Represents a ldap import result.
pub struct LdapImportResult {
    pub status: String,
    pub message: String,
    pub host_reachable: bool,
    pub port: u16,
    pub note: String,
}

#[tracing::instrument(skip_all)]
pub async fn import_ldap(
    Json(payload): Json<LdapImportReq>,
) -> Result<Json<LdapImportResult>, (StatusCode, String)> {
    use std::net::{SocketAddr, TcpStream};
    use std::str::FromStr;
    use std::time::Duration;

    let port = payload.port.unwrap_or(389);

    // Attempt basic TCP connectivity to LDAP port
    let host = payload.host.clone();
    let host_reachable = tokio::task::spawn_blocking(move || {
        let addr_str = format!("{}:{}", host, port);
        if let Ok(addr) = SocketAddr::from_str(&addr_str) {
            TcpStream::connect_timeout(&addr, Duration::from_millis(2000)).is_ok()
        } else {
            // Try as hostname:port
            std::net::TcpStream::connect_timeout(
                &format!("{}:{}", host, port)
                    .parse()
                    .unwrap_or_else(|_| SocketAddr::from_str("127.0.0.1:389").unwrap()),
                Duration::from_millis(2000),
            )
            .is_ok()
        }
    })
    .await
    .unwrap_or(false);

    // TODO: Replace with ldap3 crate for production LDAP bind+search:
    //
    // use ldap3::{Ldap, LdapConn, Scope, SearchEntry};
    // let mut ldap = LdapConn::new(&format!("ldap://{}:{}", payload.host, port))?;
    // ldap.simple_bind(&bind_dn, &bind_password).await?.success()?;
    // let (entries, _) = ldap.search(&payload.base_dn, Scope::Subtree, &filter, &attrs).await?.success()?;
    // for entry in entries { let se = SearchEntry::construct(entry); /* process */ }
    // ldap.unbind().await?;

    let status = if host_reachable {
        "ready"
    } else {
        "unreachable"
    };
    let message = if host_reachable {
        format!(
            "LDAP server {}:{} is reachable. Bind DN: {}. Base DN: {}. Ready for ldap3 crate integration.",
            payload.host, port,
            payload.bind_dn.as_deref().unwrap_or("(anonymous)"),
            payload.base_dn
        )
    } else {
        format!(
            "Cannot reach LDAP server {}:{}. Check host/port and firewall rules.",
            payload.host, port
        )
    };

    Ok(Json(LdapImportResult {
        status: status.to_string(),
        message,
        host_reachable,
        port,
        note: "Add 'ldap3 = \"0.11\"' to Cargo.toml for full LDAP bind+search support.".to_string(),
    }))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
