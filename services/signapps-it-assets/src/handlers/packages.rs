// SD1-SD4: Software packages CRUD, deployment scheduling, agent polling
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_db::DatabasePool;
use uuid::Uuid;

// ============================================================================
// Models
// ============================================================================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
/// Represents a software package.
pub struct SoftwarePackage {
    pub id: Uuid,
    pub name: String,
    pub version: String,
    pub publisher: Option<String>,
    pub platform: String,
    pub installer_type: String,
    pub silent_args: Option<String>,
    pub file_path: Option<String>,
    pub file_hash: Option<String>,
    pub file_size: Option<i64>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
/// Request payload for CreatePackage operation.
pub struct CreatePackageRequest {
    pub name: String,
    pub version: String,
    pub publisher: Option<String>,
    pub platform: String,       // "windows" | "linux" | "macos"
    pub installer_type: String, // "msi" | "exe" | "deb" | "rpm" | "pkg"
    pub silent_args: Option<String>,
    pub file_path: Option<String>,
    pub file_hash: Option<String>,
    pub file_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
/// Request payload for UpdatePackage operation.
pub struct UpdatePackageRequest {
    pub name: Option<String>,
    pub version: Option<String>,
    pub publisher: Option<String>,
    pub silent_args: Option<String>,
    pub file_path: Option<String>,
    pub file_hash: Option<String>,
    pub file_size: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
/// Represents a deployment.
pub struct Deployment {
    pub id: Uuid,
    pub package_id: Uuid,
    pub hardware_id: Uuid,
    pub status: String,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub exit_code: Option<i32>,
    pub output: Option<String>,
}

#[derive(Debug, Deserialize)]
/// Request payload for Deploy operation.
pub struct DeployRequest {
    pub hardware_ids: Vec<Uuid>,
    pub scheduled_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
/// Represents a pending install.
pub struct PendingInstall {
    pub deployment_id: Uuid,
    pub package: SoftwarePackage,
    pub scheduled_at: Option<DateTime<Utc>>,
}

// ============================================================================
// SD1: Package CRUD
// ============================================================================

#[tracing::instrument(skip_all)]
pub async fn list_packages(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<SoftwarePackage>>, (StatusCode, String)> {
    let packages = sqlx::query_as::<_, SoftwarePackage>(
        "SELECT id, name, version, publisher, platform, installer_type, silent_args, file_path, file_hash, file_size, created_at FROM it.software_packages ORDER BY name, version",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(packages))
}

#[tracing::instrument(skip_all)]
pub async fn get_package(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<Json<SoftwarePackage>, (StatusCode, String)> {
    let pkg = sqlx::query_as::<_, SoftwarePackage>(
        "SELECT id, name, version, publisher, platform, installer_type, silent_args, file_path, file_hash, file_size, created_at FROM it.software_packages WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Package not found".to_string()))?;

    Ok(Json(pkg))
}

#[tracing::instrument(skip_all)]
pub async fn create_package(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreatePackageRequest>,
) -> Result<(StatusCode, Json<SoftwarePackage>), (StatusCode, String)> {
    let pkg = sqlx::query_as::<_, SoftwarePackage>(
        r#"
        INSERT INTO it.software_packages (name, version, publisher, platform, installer_type, silent_args, file_path, file_hash, file_size)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, name, version, publisher, platform, installer_type, silent_args, file_path, file_hash, file_size, created_at
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.version)
    .bind(&payload.publisher)
    .bind(&payload.platform)
    .bind(&payload.installer_type)
    .bind(&payload.silent_args)
    .bind(&payload.file_path)
    .bind(&payload.file_hash)
    .bind(payload.file_size)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, Json(pkg)))
}

#[tracing::instrument(skip_all)]
pub async fn update_package(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePackageRequest>,
) -> Result<Json<SoftwarePackage>, (StatusCode, String)> {
    let pkg = sqlx::query_as::<_, SoftwarePackage>(
        r#"
        UPDATE it.software_packages SET
            name         = COALESCE($1, name),
            version      = COALESCE($2, version),
            publisher    = COALESCE($3, publisher),
            silent_args  = COALESCE($4, silent_args),
            file_path    = COALESCE($5, file_path),
            file_hash    = COALESCE($6, file_hash),
            file_size    = COALESCE($7, file_size)
        WHERE id = $8
        RETURNING id, name, version, publisher, platform, installer_type, silent_args, file_path, file_hash, file_size, created_at
        "#,
    )
    .bind(payload.name.as_deref())
    .bind(payload.version.as_deref())
    .bind(payload.publisher.as_deref())
    .bind(payload.silent_args.as_deref())
    .bind(payload.file_path.as_deref())
    .bind(payload.file_hash.as_deref())
    .bind(payload.file_size)
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Package not found".to_string()))?;

    Ok(Json(pkg))
}

#[tracing::instrument(skip_all)]
pub async fn delete_package(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.software_packages WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Package not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// SD2: Schedule deployment to machines
// ============================================================================

#[tracing::instrument(skip_all)]
#[allow(clippy::type_complexity)]
pub async fn deploy_package(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<DeployRequest>,
) -> Result<(StatusCode, Json<Vec<Deployment>>), (StatusCode, String)> {
    // Verify package exists
    let exists: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM it.software_packages WHERE id = $1")
            .bind(id)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "Package not found".to_string()));
    }

    let mut created = Vec::new();
    for hw_id in &payload.hardware_ids {
        let deployment = sqlx::query_as::<_, Deployment>(
            r#"
            INSERT INTO it.deployments (package_id, hardware_id, status, scheduled_at)
            VALUES ($1, $2, 'pending', $3)
            RETURNING id, package_id, hardware_id, status, scheduled_at, started_at, completed_at, exit_code, output
            "#,
        )
        .bind(id)
        .bind(hw_id)
        .bind(payload.scheduled_at)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        created.push(deployment);
    }

    Ok((StatusCode::CREATED, Json(created)))
}

// ============================================================================
// SD3: Agent polls for pending packages
// ============================================================================

#[tracing::instrument(skip_all)]
pub async fn get_agent_pending_packages(
    State(pool): State<DatabasePool>,
    Path(agent_id): Path<Uuid>,
) -> Result<Json<Vec<PendingInstall>>, (StatusCode, String)> {
    let rows = sqlx::query!(
        r#"
        SELECT
            d.id AS deployment_id,
            d.scheduled_at,
            p.id AS pkg_id,
            p.name AS pkg_name,
            p.version,
            p.publisher,
            p.platform,
            p.installer_type,
            p.silent_args,
            p.file_path,
            p.file_hash,
            p.file_size,
            p.created_at AS pkg_created_at
        FROM it.deployments d
        JOIN it.software_packages p ON p.id = d.package_id
        WHERE d.hardware_id = $1
          AND d.status = 'pending'
          AND (d.scheduled_at IS NULL OR d.scheduled_at <= NOW())
        ORDER BY d.scheduled_at ASC NULLS FIRST
        "#,
        agent_id
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let pending: Vec<PendingInstall> = rows
        .into_iter()
        .map(|r| PendingInstall {
            deployment_id: r.deployment_id,
            scheduled_at: r.scheduled_at,
            package: SoftwarePackage {
                id: r.pkg_id,
                name: r.pkg_name,
                version: r.version,
                publisher: r.publisher,
                platform: r.platform,
                installer_type: r.installer_type,
                silent_args: r.silent_args,
                file_path: r.file_path,
                file_hash: r.file_hash,
                file_size: r.file_size,
                created_at: r.pkg_created_at,
            },
        })
        .collect();

    Ok(Json(pending))
}

// Agent updates deployment status
#[derive(Debug, Deserialize)]
/// Request payload for UpdateDeploymentStatus operation.
pub struct UpdateDeploymentStatusRequest {
    pub status: String, // "running" | "completed" | "failed"
    pub exit_code: Option<i32>,
    pub output: Option<String>,
}

#[tracing::instrument(skip_all)]
pub async fn update_deployment_status(
    State(pool): State<DatabasePool>,
    Path(deployment_id): Path<Uuid>,
    Json(payload): Json<UpdateDeploymentStatusRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let now = Utc::now();
    let started_at = if payload.status == "running" {
        Some(now)
    } else {
        None
    };
    let completed_at = if payload.status == "completed" || payload.status == "failed" {
        Some(now)
    } else {
        None
    };

    sqlx::query(
        r#"
        UPDATE it.deployments SET
            status       = $1,
            started_at   = COALESCE($2, started_at),
            completed_at = COALESCE($3, completed_at),
            exit_code    = COALESCE($4, exit_code),
            output       = COALESCE($5, output)
        WHERE id = $6
        "#,
    )
    .bind(&payload.status)
    .bind(started_at)
    .bind(completed_at)
    .bind(payload.exit_code)
    .bind(&payload.output)
    .bind(deployment_id)
    .execute(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
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
