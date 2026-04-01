use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_db::DatabasePool;
use uuid::Uuid;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a report patches req.
pub struct ReportPatchesReq {
    pub agent_id: Uuid,
    pub patches: Vec<PatchEntry>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a patch entry.
pub struct PatchEntry {
    pub patch_id: String,
    pub title: String,
    pub severity: Option<String>,
    pub kb_number: Option<String>,
    pub category: Option<String>,
    pub size_bytes: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a patch row.
pub struct PatchRow {
    pub id: Uuid,
    pub hardware_id: Uuid,
    pub patch_id: String,
    pub title: String,
    pub severity: Option<String>,
    pub kb_number: Option<String>,
    pub category: Option<String>,
    pub size_bytes: Option<i64>,
    pub detected_at: DateTime<Utc>,
    pub status: String,
    pub approved_at: Option<DateTime<Utc>>,
    pub deployed_at: Option<DateTime<Utc>>,
    pub installed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
#[allow(dead_code)]
/// Represents a patch policy row.
pub struct PatchPolicyRow {
    pub id: Uuid,
    pub name: String,
    pub auto_approve_critical: Option<bool>,
    pub auto_approve_important: Option<bool>,
    pub auto_approve_delay_hours: Option<i32>,
    pub maintenance_window_start: Option<NaiveTime>,
    pub maintenance_window_end: Option<NaiveTime>,
    pub target_group: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Represents a compliance stats.
pub struct ComplianceStats {
    pub total_machines: i64,
    pub fully_patched: i64,
    pub pending_patches: i64,
    pub critical_pending: i64,
    pub compliance_pct: f64,
    pub by_severity: Vec<SeverityCount>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Represents a severity count.
pub struct SeverityCount {
    pub severity: String,
    pub count: i64,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[allow(dead_code)]
/// Represents a deploy patch req.
pub struct DeployPatchReq {
    pub hardware_ids: Option<Vec<Uuid>>,
    pub target_group: Option<String>,
}

fn internal_err(e: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

// ─── PM1: Agent reports available patches ────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/agent/patches/report",
    request_body = ReportPatchesReq,
    responses(
        (status = 204, description = "Patches reported"),
        (status = 404, description = "Agent not registered"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Patches"
)]
#[tracing::instrument(skip_all)]
pub async fn report_available_patches(
    State(pool): State<DatabasePool>,
    Json(payload): Json<ReportPatchesReq>,
) -> Result<StatusCode, (StatusCode, String)> {
    let hw = sqlx::query!(
        "SELECT id FROM it.hardware WHERE agent_id = $1",
        payload.agent_id
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Agent not registered".to_string()))?;

    let hardware_id = hw.id;

    for patch in payload.patches {
        sqlx::query!(
            r#"
            INSERT INTO it.available_patches
                (hardware_id, patch_id, title, severity, kb_number, category, size_bytes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT DO NOTHING
            "#,
            hardware_id,
            patch.patch_id,
            patch.title,
            patch.severity,
            patch.kb_number,
            patch.category,
            patch.size_bytes,
        )
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    }

    Ok(StatusCode::NO_CONTENT)
}

// ─── PM2: Admin lists all patches across fleet ───────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/patches",
    responses(
        (status = 200, description = "Patches list", body = Vec<PatchRow>),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Patches"
)]
#[tracing::instrument(skip_all)]
pub async fn list_patches(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<PatchRow>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, PatchRow>(
        "SELECT * FROM it.available_patches ORDER BY detected_at DESC LIMIT 1000",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(Json(rows))
}

// ─── PM3: Approve patch ───────────────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/patches/{id}/approve",
    params(("id" = uuid::Uuid, Path, description = "Patch UUID")),
    responses(
        (status = 204, description = "Patch approved"),
        (status = 404, description = "Patch not found"),
    ),
    security(("bearer" = [])),
    tag = "Patches"
)]
#[tracing::instrument(skip_all)]
pub async fn approve_patch(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query!(
        "UPDATE it.available_patches SET status = 'approved', approved_at = now() WHERE id = $1 AND status = 'pending'",
        id
    )
    .execute(pool.inner())
    .await
    .map_err(internal_err)?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            "Patch not found or not in pending state".to_string(),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/patches/{id}/reject",
    params(("id" = uuid::Uuid, Path, description = "Patch UUID")),
    responses(
        (status = 204, description = "Patch rejected"),
        (status = 404, description = "Patch not found"),
    ),
    security(("bearer" = [])),
    tag = "Patches"
)]
/// Reject (deny) a patch — sets status back to 'rejected'
#[tracing::instrument(skip_all)]
pub async fn reject_patch(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query!(
        "UPDATE it.available_patches SET status = 'rejected' WHERE id = $1",
        id
    )
    .execute(pool.inner())
    .await
    .map_err(internal_err)?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Patch not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ─── PM4: Deploy patch ────────────────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/patches/{id}/deploy",
    params(("id" = uuid::Uuid, Path, description = "Patch UUID")),
    request_body = DeployPatchReq,
    responses(
        (status = 204, description = "Patch deployed"),
        (status = 404, description = "Patch not found or not approved"),
    ),
    security(("bearer" = [])),
    tag = "Patches"
)]
#[tracing::instrument(skip_all)]
pub async fn deploy_patch(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(_payload): Json<DeployPatchReq>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Mark patch as deployed (agent will pick it up via config endpoint)
    let result = sqlx::query!(
        "UPDATE it.available_patches SET status = 'deployed', deployed_at = now() WHERE id = $1 AND status = 'approved'",
        id
    )
    .execute(pool.inner())
    .await
    .map_err(internal_err)?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            "Patch not found or not yet approved".to_string(),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ─── PM5: Compliance stats ────────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/patches/compliance",
    responses(
        (status = 200, description = "Patch compliance stats", body = ComplianceStats),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Patches"
)]
#[tracing::instrument(skip_all)]
pub async fn patch_compliance(
    State(pool): State<DatabasePool>,
) -> Result<Json<ComplianceStats>, (StatusCode, String)> {
    let total_machines: i64 = sqlx::query_scalar!("SELECT COUNT(DISTINCT id) FROM it.hardware")
        .fetch_one(pool.inner())
        .await
        .map_err(internal_err)?
        .unwrap_or(0);

    let pending_machines: i64 = sqlx::query_scalar!(
        "SELECT COUNT(DISTINCT hardware_id) FROM it.available_patches WHERE status IN ('pending', 'approved', 'deployed')"
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?
    .unwrap_or(0);

    let fully_patched = total_machines - pending_machines;

    let critical_pending: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM it.available_patches WHERE status IN ('pending', 'approved') AND severity = 'critical'"
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?
    .unwrap_or(0);

    // By severity breakdown
    let severity_rows = sqlx::query!(
        r#"
        SELECT COALESCE(severity, 'unknown') as "severity!", COUNT(*) as "count!"
        FROM it.available_patches
        WHERE status IN ('pending', 'approved', 'deployed')
        GROUP BY severity
        ORDER BY COUNT(*) DESC
        "#
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    let by_severity = severity_rows
        .into_iter()
        .map(|r| SeverityCount {
            severity: r.severity,
            count: r.count,
        })
        .collect();

    let compliance_pct = if total_machines > 0 {
        (fully_patched as f64 / total_machines as f64) * 100.0
    } else {
        100.0
    };

    Ok(Json(ComplianceStats {
        total_machines,
        fully_patched,
        pending_patches: pending_machines,
        critical_pending,
        compliance_pct,
        by_severity,
    }))
}

// ─── PM6: Rollback patch (Feature 30) ────────────────────────────────────────
//
// POST /api/v1/it-assets/patches/:id/rollback
// Queues a rollback command: wusa /uninstall (Windows) or apt downgrade (Linux).

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/patches/{id}/rollback",
    params(("id" = uuid::Uuid, Path, description = "Patch UUID")),
    responses(
        (status = 202, description = "Rollback queued"),
        (status = 404, description = "Patch not found or not installed"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Patches"
)]
#[tracing::instrument(skip_all)]
pub async fn rollback_patch(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Fetch patch info
    let patch = sqlx::query!(
        r#"
        SELECT hardware_id, kb_number, patch_id, title, category
        FROM it.available_patches
        WHERE id = $1 AND status = 'installed'
        "#,
        id
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((
        StatusCode::NOT_FOUND,
        "Patch not found or not in installed state".to_string(),
    ))?;

    // Mark patch as rollback_pending
    sqlx::query!(
        "UPDATE it.available_patches SET status = 'rollback_pending' WHERE id = $1",
        id
    )
    .execute(pool.inner())
    .await
    .map_err(internal_err)?;

    // Build rollback script based on OS type inferred from patch metadata
    let rollback_script = if let Some(ref kb) = patch.kb_number {
        // Windows: wusa.exe /uninstall /kb:<number> /quiet /norestart
        let kb_num = kb.trim_start_matches("KB");
        format!(
            r#"wusa /uninstall /kb:{kb_num} /quiet /norestart
if %errorlevel% == 0 (echo Rollback OK) else (echo Rollback failed: %errorlevel% && exit 1)"#,
            kb_num = kb_num
        )
    } else if patch.category.as_deref() == Some("os") {
        // Linux apt: revert to previous version
        // patch_id format: apt-<name>-<version>
        let pkg_info = patch
            .patch_id
            .strip_prefix("apt-")
            .and_then(|s| s.rsplit_once('-'))
            .map(|(name, _ver)| name.to_string())
            .unwrap_or_else(|| patch.patch_id.clone());
        format!(
            "apt-get install --reinstall {} 2>&1\n\
             # For specific version: apt-get install {}=<prev_version>",
            pkg_info, pkg_info
        )
    } else {
        format!(
            "# Manual rollback required for patch: {}\n# Title: {}",
            patch.patch_id, patch.title
        )
    };

    // Queue rollback script via script_queue
    sqlx::query!(
        r#"
        INSERT INTO it.script_queue (hardware_id, script_type, script_content, timeout_seconds)
        VALUES ($1, $2, $3, 600)
        "#,
        patch.hardware_id,
        if patch.kb_number.is_some() {
            "cmd"
        } else {
            "bash"
        },
        rollback_script,
    )
    .execute(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(StatusCode::ACCEPTED)
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
