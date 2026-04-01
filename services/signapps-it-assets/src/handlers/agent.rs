use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_db::DatabasePool;
use uuid::Uuid;

// ─── Agent Latest Version (EA5) ──────────────────────────────────────────────

const AGENT_LATEST_VERSION: &str = "1.0.0";

// ─── Request / Response Types ────────────────────────────────────────────────

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[allow(dead_code)]
/// Represents a register agent req.
pub struct RegisterAgentReq {
    pub hostname: String,
    pub os_type: String,
    pub os_version: String,
    pub mac_address: Option<String>,
    pub enrollment_token: String,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Represents a register agent resp.
pub struct RegisterAgentResp {
    pub agent_id: Uuid,
    pub hardware_id: Uuid,
    pub config: AgentConfig,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Configuration for Agent.
pub struct AgentConfig {
    pub poll_interval_seconds: u32,
    pub heartbeat_interval_seconds: u32,
    pub agent_latest_version: String,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[allow(dead_code)]
/// Represents a heartbeat req.
pub struct HeartbeatReq {
    pub agent_id: Uuid,
    pub status: Option<String>,
    pub uptime: Option<i64>,
    pub cpu_usage: Option<f32>,
    pub memory_usage: Option<f32>,
    pub disk_usage: Option<f32>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Represents a heartbeat resp.
pub struct HeartbeatResp {
    pub ok: bool,
    pub pending_scripts: i64,
    pub pending_patches: i64,
    pub agent_latest_version: String,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Configuration for AgentFull.
pub struct AgentFullConfig {
    pub agent_id: Uuid,
    pub hardware_id: Uuid,
    pub agent_latest_version: String,
    pub pending_scripts: Vec<PendingScript>,
    pub pending_patches: Vec<PendingPatch>,
}

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a pending script.
pub struct PendingScript {
    pub id: Uuid,
    pub script_type: String,
    pub script_content: String,
    pub timeout_seconds: i32,
}

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a pending patch.
pub struct PendingPatch {
    pub id: Uuid,
    pub patch_id: String,
    pub title: String,
    pub severity: Option<String>,
    pub kb_number: Option<String>,
}

// ─── Hardware Inventory ───────────────────────────────────────────────────────

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[allow(dead_code)]
/// Represents a hardware inventory req.
pub struct HardwareInventoryReq {
    pub agent_id: Uuid,
    pub cpu_model: Option<String>,
    pub cpu_cores: Option<i32>,
    pub ram_bytes: Option<i64>,
    pub disks: Option<Vec<DiskInfo>>,
    pub gpu_model: Option<String>,
    pub bios_version: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, utoipa::ToSchema)]
/// Represents a disk info.
pub struct DiskInfo {
    pub name: String,
    pub size_bytes: i64,
    pub kind: Option<String>,
}

// ─── Software Inventory ───────────────────────────────────────────────────────

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a software inventory req.
pub struct SoftwareInventoryReq {
    pub agent_id: Uuid,
    pub software: Vec<SoftwareEntry>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a software entry.
pub struct SoftwareEntry {
    pub name: String,
    pub version: Option<String>,
    pub publisher: Option<String>,
    pub install_date: Option<chrono::NaiveDate>,
    pub size_bytes: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
#[allow(dead_code)]
/// Represents a software inventory row.
pub struct SoftwareInventoryRow {
    pub id: Uuid,
    pub hardware_id: Uuid,
    pub name: String,
    pub version: Option<String>,
    pub publisher: Option<String>,
    pub install_date: Option<chrono::NaiveDate>,
    pub size_bytes: Option<i64>,
    pub updated_at: DateTime<Utc>,
}

// ─── Script Queue ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a queue script req.
pub struct QueueScriptReq {
    pub hardware_id: Uuid,
    pub script_type: Option<String>,
    pub script_content: String,
    pub timeout_seconds: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a script queue row.
pub struct ScriptQueueRow {
    pub id: Uuid,
    pub hardware_id: Uuid,
    pub script_type: String,
    pub script_content: String,
    pub timeout_seconds: i32,
    pub status: String,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub exit_code: Option<i32>,
    pub queued_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a script result req.
pub struct ScriptResultReq {
    pub script_id: Uuid,
    pub agent_id: Uuid,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub exit_code: i32,
}

// ─── Enrollment Tokens (EA6) ──────────────────────────────────────────────────

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a create enrollment token req.
pub struct CreateEnrollmentTokenReq {
    pub label: Option<String>,
    pub expires_in_hours: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a enrollment token row.
pub struct EnrollmentTokenRow {
    pub id: Uuid,
    pub token: String,
    pub label: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
    pub hardware_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

// ─── Helper ───────────────────────────────────────────────────────────────────

fn internal_err(e: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

// ─── EA1: Register agent ──────────────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/agent/register",
    request_body = RegisterAgentReq,
    responses(
        (status = 201, description = "Agent registered", body = RegisterAgentResp),
        (status = 401, description = "Invalid enrollment token"),
        (status = 500, description = "Internal server error"),
    ),
    tag = "Agents"
)]
#[tracing::instrument(skip_all)]
pub async fn register_agent(
    State(pool): State<DatabasePool>,
    Json(payload): Json<RegisterAgentReq>,
) -> Result<(StatusCode, Json<RegisterAgentResp>), (StatusCode, String)> {
    // Validate enrollment token
    let token_row = sqlx::query!(
        "SELECT id FROM it.enrollment_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > now()",
        payload.enrollment_token
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::UNAUTHORIZED, "Invalid or expired enrollment token".to_string()))?;

    // Upsert hardware record
    let agent_id = Uuid::new_v4();
    let row = sqlx::query!(
        r#"
        INSERT INTO it.hardware (name, type, os_type, os_version, agent_id, agent_version, last_heartbeat)
        VALUES ($1, 'workstation', $2, $3, $4, $5, now())
        ON CONFLICT (agent_id) DO UPDATE SET
            os_type = EXCLUDED.os_type,
            os_version = EXCLUDED.os_version,
            agent_version = EXCLUDED.agent_version,
            last_heartbeat = now(),
            updated_at = now()
        RETURNING id, agent_id
        "#,
        payload.hostname,
        payload.os_type,
        payload.os_version,
        agent_id,
        AGENT_LATEST_VERSION,
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    let hardware_id = row.id;
    let returned_agent_id = row.agent_id.unwrap_or(agent_id);

    // Mark token as used
    sqlx::query!(
        "UPDATE it.enrollment_tokens SET used_at = now(), hardware_id = $1 WHERE id = $2",
        hardware_id,
        token_row.id,
    )
    .execute(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok((
        StatusCode::CREATED,
        Json(RegisterAgentResp {
            agent_id: returned_agent_id,
            hardware_id,
            config: AgentConfig {
                poll_interval_seconds: 60,
                heartbeat_interval_seconds: 30,
                agent_latest_version: AGENT_LATEST_VERSION.to_string(),
            },
        }),
    ))
}

// ─── EA1: Heartbeat ───────────────────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/agent/{agent_id}/heartbeat",
    params(("agent_id" = uuid::Uuid, Path, description = "Agent UUID")),
    request_body = HeartbeatReq,
    responses(
        (status = 200, description = "Heartbeat accepted", body = HeartbeatResp),
        (status = 404, description = "Agent not registered"),
    ),
    tag = "Agents"
)]
#[tracing::instrument(skip_all)]
pub async fn agent_heartbeat(
    State(pool): State<DatabasePool>,
    Json(payload): Json<HeartbeatReq>,
) -> Result<Json<HeartbeatResp>, (StatusCode, String)> {
    // Find hardware by agent_id
    let hw = sqlx::query!(
        "SELECT id FROM it.hardware WHERE agent_id = $1",
        payload.agent_id
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Agent not registered".to_string()))?;

    let hardware_id = hw.id;

    // Update last_heartbeat
    sqlx::query!(
        "UPDATE it.hardware SET last_heartbeat = now(), updated_at = now() WHERE id = $1",
        hardware_id
    )
    .execute(pool.inner())
    .await
    .map_err(internal_err)?;

    // Insert metrics
    sqlx::query!(
        r#"
        INSERT INTO it.agent_metrics (hardware_id, cpu_usage, memory_usage, disk_usage, uptime_seconds)
        VALUES ($1, $2, $3, $4, $5)
        "#,
        hardware_id,
        payload.cpu_usage,
        payload.memory_usage,
        payload.disk_usage,
        payload.uptime,
    )
    .execute(pool.inner())
    .await
    .map_err(internal_err)?;

    // Count pending items
    let pending_scripts: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM it.script_queue WHERE hardware_id = $1 AND status = 'pending'",
        hardware_id
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?
    .unwrap_or(0);

    let pending_patches: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM it.available_patches WHERE hardware_id = $1 AND status = 'approved'",
        hardware_id
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?
    .unwrap_or(0);

    Ok(Json(HeartbeatResp {
        ok: true,
        pending_scripts,
        pending_patches,
        agent_latest_version: AGENT_LATEST_VERSION.to_string(),
    }))
}

// ─── EA1 + EA5: Get agent config ──────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/agent/{agent_id}/config",
    params(("agent_id" = uuid::Uuid, Path, description = "Agent UUID")),
    responses(
        (status = 200, description = "Agent configuration", body = AgentFullConfig),
        (status = 404, description = "Agent not registered"),
    ),
    tag = "Agents"
)]
#[tracing::instrument(skip_all)]
pub async fn get_agent_config(
    State(pool): State<DatabasePool>,
    Path(agent_id): Path<Uuid>,
) -> Result<Json<AgentFullConfig>, (StatusCode, String)> {
    let hw = sqlx::query!("SELECT id FROM it.hardware WHERE agent_id = $1", agent_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(internal_err)?
        .ok_or((StatusCode::NOT_FOUND, "Agent not registered".to_string()))?;

    let hardware_id = hw.id;

    let pending_scripts = sqlx::query_as::<_, PendingScript>(
        "SELECT id, script_type, script_content, timeout_seconds FROM it.script_queue WHERE hardware_id = $1 AND status = 'pending' ORDER BY queued_at ASC"
    )
    .bind(hardware_id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    let pending_patches = sqlx::query_as::<_, PendingPatch>(
        "SELECT id, patch_id, title, severity, kb_number FROM it.available_patches WHERE hardware_id = $1 AND status = 'approved' ORDER BY detected_at ASC"
    )
    .bind(hardware_id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(Json(AgentFullConfig {
        agent_id,
        hardware_id,
        agent_latest_version: AGENT_LATEST_VERSION.to_string(),
        pending_scripts,
        pending_patches,
    }))
}

// ─── EA2: Hardware inventory ──────────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/agent/{agent_id}/hardware",
    params(("agent_id" = uuid::Uuid, Path, description = "Agent UUID")),
    request_body = HardwareInventoryReq,
    responses(
        (status = 204, description = "Hardware inventory accepted"),
        (status = 404, description = "Agent not registered"),
    ),
    tag = "Agents"
)]
#[tracing::instrument(skip_all)]
pub async fn report_hardware_inventory(
    State(pool): State<DatabasePool>,
    Json(payload): Json<HardwareInventoryReq>,
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

    // Upsert CPU component — use actual it.components schema (type, model, capacity)
    if let Some(ref cpu_model) = payload.cpu_model {
        let cpu_capacity = format!("{} cores", payload.cpu_cores.unwrap_or(0));
        sqlx::query!(
            r#"
            INSERT INTO it.components (hardware_id, type, model, capacity)
            VALUES ($1, 'cpu', $2, $3)
            "#,
            hardware_id,
            cpu_model,
            cpu_capacity,
        )
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    }

    // Upsert RAM component
    if let Some(ram_bytes) = payload.ram_bytes {
        let ram_gb = ram_bytes / (1024 * 1024 * 1024);
        sqlx::query!(
            r#"
            INSERT INTO it.components (hardware_id, type, model, capacity)
            VALUES ($1, 'ram', 'RAM', $2)
            "#,
            hardware_id,
            format!("{} GB", ram_gb),
        )
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    }

    Ok(StatusCode::NO_CONTENT)
}

// ─── EA3: Software inventory ──────────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/agent/{agent_id}/software",
    params(("agent_id" = uuid::Uuid, Path, description = "Agent UUID")),
    request_body = SoftwareInventoryReq,
    responses(
        (status = 204, description = "Software inventory accepted"),
        (status = 404, description = "Agent not registered"),
    ),
    tag = "Agents"
)]
#[tracing::instrument(skip_all)]
pub async fn report_software_inventory(
    State(pool): State<DatabasePool>,
    Json(payload): Json<SoftwareInventoryReq>,
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

    for sw in payload.software {
        sqlx::query!(
            r#"
            INSERT INTO it.software_inventory (hardware_id, name, version, publisher, install_date, size_bytes, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, now())
            ON CONFLICT (hardware_id, name, version) DO UPDATE SET
                publisher = EXCLUDED.publisher,
                install_date = EXCLUDED.install_date,
                size_bytes = EXCLUDED.size_bytes,
                updated_at = now()
            "#,
            hardware_id,
            sw.name,
            sw.version,
            sw.publisher,
            sw.install_date,
            sw.size_bytes,
        )
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    }

    Ok(StatusCode::NO_CONTENT)
}

// ─── EA4: Script queue ────────────────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/agent/{agent_id}/scripts",
    params(("agent_id" = uuid::Uuid, Path, description = "Agent UUID")),
    request_body = QueueScriptReq,
    responses(
        (status = 201, description = "Script queued", body = ScriptQueueRow),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Agents"
)]
#[tracing::instrument(skip_all)]
pub async fn queue_script(
    State(pool): State<DatabasePool>,
    Json(payload): Json<QueueScriptReq>,
) -> Result<(StatusCode, Json<ScriptQueueRow>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, ScriptQueueRow>(
        r#"
        INSERT INTO it.script_queue (hardware_id, script_type, script_content, timeout_seconds)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(payload.hardware_id)
    .bind(payload.script_type.unwrap_or_else(|| "bash".to_string()))
    .bind(payload.script_content)
    .bind(payload.timeout_seconds.unwrap_or(300))
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok((StatusCode::CREATED, Json(row)))
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/agent/{agent_id}/scripts",
    params(("agent_id" = uuid::Uuid, Path, description = "Agent UUID")),
    responses(
        (status = 200, description = "Pending scripts", body = Vec<ScriptQueueRow>),
        (status = 404, description = "Agent not registered"),
    ),
    tag = "Agents"
)]
#[tracing::instrument(skip_all)]
pub async fn get_pending_scripts(
    State(pool): State<DatabasePool>,
    Path(agent_id): Path<Uuid>,
) -> Result<Json<Vec<ScriptQueueRow>>, (StatusCode, String)> {
    let hw = sqlx::query!("SELECT id FROM it.hardware WHERE agent_id = $1", agent_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(internal_err)?
        .ok_or((StatusCode::NOT_FOUND, "Agent not registered".to_string()))?;

    let rows = sqlx::query_as::<_, ScriptQueueRow>(
        "SELECT * FROM it.script_queue WHERE hardware_id = $1 AND status = 'pending' ORDER BY queued_at ASC"
    )
    .bind(hw.id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(Json(rows))
}

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/agent/{agent_id}/scripts/result",
    params(("agent_id" = uuid::Uuid, Path, description = "Agent UUID")),
    request_body = ScriptResultReq,
    responses(
        (status = 204, description = "Script result accepted"),
        (status = 404, description = "Agent or script not found"),
    ),
    tag = "Agents"
)]
#[tracing::instrument(skip_all)]
pub async fn report_script_result(
    State(pool): State<DatabasePool>,
    Json(payload): Json<ScriptResultReq>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Verify the script belongs to this agent
    let hw = sqlx::query!(
        "SELECT id FROM it.hardware WHERE agent_id = $1",
        payload.agent_id
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Agent not registered".to_string()))?;

    let result = sqlx::query!(
        r#"
        UPDATE it.script_queue
        SET status = CASE WHEN $3 = 0 THEN 'completed' ELSE 'failed' END,
            stdout = $1,
            stderr = $2,
            exit_code = $3,
            completed_at = now()
        WHERE id = $4 AND hardware_id = $5
        "#,
        payload.stdout,
        payload.stderr,
        payload.exit_code,
        payload.script_id,
        hw.id,
    )
    .execute(pool.inner())
    .await
    .map_err(internal_err)?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Script not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ─── EA6: Enrollment tokens ───────────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/enrollment/token",
    request_body = CreateEnrollmentTokenReq,
    responses(
        (status = 201, description = "Enrollment token created", body = EnrollmentTokenRow),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Agents"
)]
#[tracing::instrument(skip_all)]
pub async fn create_enrollment_token(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateEnrollmentTokenReq>,
) -> Result<(StatusCode, Json<EnrollmentTokenRow>), (StatusCode, String)> {
    use std::time::SystemTime;

    let token = format!(
        "{}-{}",
        Uuid::new_v4().simple(),
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    );

    let expires_hours = payload.expires_in_hours.unwrap_or(24);
    let expires_at = Utc::now() + chrono::Duration::hours(expires_hours);

    let row = sqlx::query_as::<_, EnrollmentTokenRow>(
        r#"
        INSERT INTO it.enrollment_tokens (token, label, expires_at)
        VALUES ($1, $2, $3)
        RETURNING id, token, label, expires_at, used_at, hardware_id, created_at
        "#,
    )
    .bind(&token)
    .bind(payload.label)
    .bind(expires_at)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok((StatusCode::CREATED, Json(row)))
}

// ─── EA7: Agent binary download ───────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct AgentDownloadInfo {
    platform: String,
    version: String,
    install_instructions: String,
    download_url: Option<String>,
    checksum_url: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/agent/download/{platform}",
    params(("platform" = String, Path, description = "Target platform: windows, linux, macos")),
    responses(
        (status = 200, description = "Agent download info"),
        (status = 404, description = "Unknown platform"),
    ),
    tag = "Agents"
)]
pub async fn download_agent(
    Path(platform): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let version = AGENT_LATEST_VERSION;

    let info = match platform.to_lowercase().as_str() {
        "windows" | "win" | "win64" => AgentDownloadInfo {
            platform: "windows".into(),
            version: version.into(),
            install_instructions: format!(
                r#"Windows Installation (PowerShell, run as Administrator):

1. Download the agent installer:
   Invoke-WebRequest -Uri "https://your-signapps-server/api/v1/it-assets/agent/download/windows" -OutFile signapps-agent-{version}.exe

2. Install silently:
   .\signapps-agent-{version}.exe /S /TOKEN=<enrollment-token> /SERVER=https://your-signapps-server

3. Verify the service is running:
   Get-Service signapps-agent

Alternatively, use the MSI package:
   msiexec /i signapps-agent-{version}.msi TOKEN=<enrollment-token> SERVER=https://your-signapps-server /qn
"#,
                version = version
            ),
            download_url: None, // Binary not yet compiled — placeholder
            checksum_url: None,
        },
        "linux" | "linux64" | "deb" | "rpm" => AgentDownloadInfo {
            platform: "linux".into(),
            version: version.into(),
            install_instructions: format!(
                r#"Linux Installation:

# Debian/Ubuntu (DEB):
curl -fsSL https://your-signapps-server/api/v1/it-assets/agent/download/linux | sudo bash
# Or manual:
wget https://your-signapps-server/agent/signapps-agent_{version}_amd64.deb
sudo dpkg -i signapps-agent_{version}_amd64.deb
sudo signapps-agent enroll --token <enrollment-token> --server https://your-signapps-server

# RHEL/CentOS/Fedora (RPM):
wget https://your-signapps-server/agent/signapps-agent-{version}-1.x86_64.rpm
sudo rpm -i signapps-agent-{version}-1.x86_64.rpm
sudo signapps-agent enroll --token <enrollment-token> --server https://your-signapps-server

# Verify:
sudo systemctl status signapps-agent
"#,
                version = version
            ),
            download_url: None, // Binary not yet compiled — placeholder
            checksum_url: None,
        },
        "macos" | "darwin" | "mac" => AgentDownloadInfo {
            platform: "macos".into(),
            version: version.into(),
            install_instructions: format!(
                r#"macOS Installation:

# Using the PKG installer:
curl -fsSL https://your-signapps-server/agent/signapps-agent-{version}.pkg -o signapps-agent-{version}.pkg
sudo installer -pkg signapps-agent-{version}.pkg -target /
sudo /usr/local/bin/signapps-agent enroll --token <enrollment-token> --server https://your-signapps-server

# Or using Homebrew (when available):
brew install signapps/tap/signapps-agent
signapps-agent enroll --token <enrollment-token> --server https://your-signapps-server

# Verify:
launchctl list | grep signapps
"#,
                version = version
            ),
            download_url: None, // Binary not yet compiled — placeholder
            checksum_url: None,
        },
        other => {
            return Err((
                StatusCode::NOT_FOUND,
                format!(
                    "Unknown platform '{}'. Supported platforms: windows, linux, macos",
                    other
                ),
            ));
        },
    };

    Ok(Json(info))
}

// ─── EA-SVC: Agent reports running services (Feature 24) ─────────────────────

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct ServiceEntry {
    pub name: String,
    pub status: String,
    pub description: Option<String>,
    pub pid: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct ServiceRow {
    pub id: Uuid,
    pub hardware_id: Uuid,
    pub name: String,
    pub status: String,
    pub description: Option<String>,
    pub pid: Option<i32>,
    pub reported_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct ReportServicesReq {
    pub services: Vec<ServiceEntry>,
}

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/agent/{agent_id}/services",
    params(("agent_id" = uuid::Uuid, Path, description = "Agent UUID")),
    request_body = ReportServicesReq,
    responses(
        (status = 204, description = "Services reported"),
        (status = 404, description = "Agent not registered"),
    ),
    tag = "Agents"
)]
#[tracing::instrument(skip_all)]
pub async fn report_services(
    State(pool): State<DatabasePool>,
    Path(agent_id): Path<Uuid>,
    Json(payload): Json<ReportServicesReq>,
) -> Result<StatusCode, (StatusCode, String)> {
    let hw = sqlx::query!("SELECT id FROM it.hardware WHERE agent_id = $1", agent_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(internal_err)?
        .ok_or((StatusCode::NOT_FOUND, "Agent not registered".to_string()))?;

    let hardware_id = hw.id;

    // Upsert all services — delete old entries first for this hardware
    sqlx::query("DELETE FROM it.agent_services WHERE hardware_id = $1")
        .bind(hardware_id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;

    for svc in payload.services {
        sqlx::query(
            r#"INSERT INTO it.agent_services (hardware_id, name, status, description, pid)
               VALUES ($1, $2, $3, $4, $5)"#,
        )
        .bind(hardware_id)
        .bind(svc.name)
        .bind(svc.status)
        .bind(svc.description)
        .bind(svc.pid)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    }

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/hardware/{hw_id}/services",
    params(("hw_id" = uuid::Uuid, Path, description = "Hardware UUID")),
    responses(
        (status = 200, description = "Services list", body = Vec<ServiceRow>),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Agents"
)]
#[tracing::instrument(skip_all)]
pub async fn list_hardware_services(
    State(pool): State<DatabasePool>,
    Path(hw_id): Path<Uuid>,
) -> Result<Json<Vec<ServiceRow>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, ServiceRow>(
        r#"
        SELECT id, hardware_id, name, status, description, pid, reported_at
        FROM it.agent_services
        WHERE hardware_id = $1
        ORDER BY status ASC, name ASC
        "#,
    )
    .bind(hw_id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(Json(rows))
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
