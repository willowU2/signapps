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

// ─── Agent Commands (RM3) ─────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a agent command.
pub struct AgentCommand {
    pub id: Uuid,
    pub hardware_id: Uuid,
    pub agent_id: Option<Uuid>,
    pub command: String,
    pub parameters: Value,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub sent_at: Option<DateTime<Utc>>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub result: Value,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a queue command req.
pub struct QueueCommandReq {
    pub hardware_id: Uuid,
    pub command: String, // 'reboot', 'shutdown', 'lock', 'run_script'
    pub parameters: Option<Value>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a update command status req.
pub struct UpdateCommandStatusReq {
    pub status: String, // 'acknowledged', 'done', 'failed'
    pub result: Option<Value>,
}

const ALLOWED_COMMANDS: &[&str] = &["reboot", "shutdown", "lock", "run_script", "message"];

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/agent/commands/queue",
    request_body = QueueCommandReq,
    responses(
        (status = 201, description = "Command queued", body = AgentCommand),
        (status = 400, description = "Invalid command"),
        (status = 404, description = "Hardware not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Commands"
)]
/// POST /api/v1/it-assets/agent/commands/queue
/// Admin queues a command for a managed machine.
#[tracing::instrument(skip_all)]
pub async fn queue_agent_command(
    State(pool): State<DatabasePool>,
    Json(payload): Json<QueueCommandReq>,
) -> Result<(StatusCode, Json<AgentCommand>), (StatusCode, String)> {
    if !ALLOWED_COMMANDS.contains(&payload.command.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            format!(
                "Commande invalide. Commandes autorisees: {}",
                ALLOWED_COMMANDS.join(", ")
            ),
        ));
    }

    // Verify hardware exists
    let _ = sqlx::query("SELECT id FROM it.hardware WHERE id = $1")
        .bind(payload.hardware_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Hardware not found".to_string()))?;

    let params = payload
        .parameters
        .unwrap_or_else(|| Value::Object(Default::default()));

    let cmd = sqlx::query_as::<_, AgentCommand>(
        r#"
        INSERT INTO it.agent_commands (hardware_id, command, parameters, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING id, hardware_id, agent_id, command, parameters, status,
                  created_at, sent_at, acknowledged_at, completed_at, result
        "#,
    )
    .bind(payload.hardware_id)
    .bind(&payload.command)
    .bind(&params)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tracing::info!(
        "Queued command '{}' for hardware {}",
        payload.command,
        payload.hardware_id
    );

    Ok((StatusCode::CREATED, Json(cmd)))
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/agent/commands/pending/{agent_id}",
    params(("agent_id" = uuid::Uuid, Path, description = "Agent UUID")),
    responses(
        (status = 200, description = "Pending commands", body = Vec<AgentCommand>),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Commands"
)]
/// GET /api/v1/it-assets/agent/commands/pending/:agent_id
/// Agent polls for pending commands.
#[tracing::instrument(skip_all)]
pub async fn get_pending_commands(
    State(pool): State<DatabasePool>,
    Path(agent_id): Path<Uuid>,
) -> Result<Json<Vec<AgentCommand>>, (StatusCode, String)> {
    // Resolve hardware_id from agent_id
    let hw: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM it.hardware WHERE agent_id = $1 LIMIT 1")
            .bind(agent_id)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let hardware_id = match hw {
        Some((id,)) => id,
        None => return Ok(Json(vec![])),
    };

    let cmds = sqlx::query_as::<_, AgentCommand>(
        r#"
        SELECT id, hardware_id, agent_id, command, parameters, status,
               created_at, sent_at, acknowledged_at, completed_at, result
        FROM it.agent_commands
        WHERE hardware_id = $1 AND status = 'pending'
        ORDER BY created_at ASC
        "#,
    )
    .bind(hardware_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Mark as 'sent'
    if !cmds.is_empty() {
        let ids: Vec<Uuid> = cmds.iter().map(|c| c.id).collect();
        sqlx::query(
            "UPDATE it.agent_commands SET status = 'sent', sent_at = now() WHERE id = ANY($1)",
        )
        .bind(&ids)
        .execute(pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    Ok(Json(cmds))
}

#[utoipa::path(
    put,
    path = "/api/v1/it-assets/agent/commands/{id}/status",
    params(("id" = uuid::Uuid, Path, description = "Command UUID")),
    request_body = UpdateCommandStatusReq,
    responses(
        (status = 200, description = "Command status updated", body = AgentCommand),
        (status = 400, description = "Invalid status"),
        (status = 404, description = "Command not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Commands"
)]
/// PUT /api/v1/it-assets/agent/commands/:id/status
/// Agent reports completion of a command.
#[tracing::instrument(skip_all)]
pub async fn update_command_status(
    State(pool): State<DatabasePool>,
    Path(command_id): Path<Uuid>,
    Json(payload): Json<UpdateCommandStatusReq>,
) -> Result<Json<AgentCommand>, (StatusCode, String)> {
    let allowed_statuses = ["acknowledged", "done", "failed"];
    if !allowed_statuses.contains(&payload.status.as_str()) {
        return Err((StatusCode::BAD_REQUEST, "Statut invalide".to_string()));
    }

    let result_val = payload
        .result
        .unwrap_or_else(|| Value::Object(Default::default()));

    let cmd = sqlx::query_as::<_, AgentCommand>(
        r#"
        UPDATE it.agent_commands
        SET status = $1,
            result = $2,
            acknowledged_at = CASE WHEN $1 = 'acknowledged' THEN now() ELSE acknowledged_at END,
            completed_at = CASE WHEN $1 IN ('done', 'failed') THEN now() ELSE completed_at END
        WHERE id = $3
        RETURNING id, hardware_id, agent_id, command, parameters, status,
                  created_at, sent_at, acknowledged_at, completed_at, result
        "#,
    )
    .bind(&payload.status)
    .bind(&result_val)
    .bind(command_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Command not found".to_string()))?;

    Ok(Json(cmd))
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/hardware/{id}/commands",
    params(("id" = uuid::Uuid, Path, description = "Hardware UUID")),
    responses(
        (status = 200, description = "Hardware commands list", body = Vec<AgentCommand>),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Commands"
)]
/// GET /api/v1/it-assets/hardware/:id/commands
/// List all commands for a hardware asset (admin view).
#[tracing::instrument(skip_all)]
pub async fn list_hardware_commands(
    State(pool): State<DatabasePool>,
    Path(hardware_id): Path<Uuid>,
) -> Result<Json<Vec<AgentCommand>>, (StatusCode, String)> {
    let cmds = sqlx::query_as::<_, AgentCommand>(
        r#"
        SELECT id, hardware_id, agent_id, command, parameters, status,
               created_at, sent_at, acknowledged_at, completed_at, result
        FROM it.agent_commands
        WHERE hardware_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .bind(hardware_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(cmds))
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
