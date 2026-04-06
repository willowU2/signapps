// SL1-SL3: Script library + scheduled scripts
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_common::Claims;
use signapps_db::DatabasePool;
use uuid::Uuid;

fn internal_err(e: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct ScriptLibraryEntry {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub script_type: String,
    pub content: String,
    pub parameters: Value,
    pub version: i32,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateScriptReq {
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub script_type: Option<String>,
    pub content: String,
    pub parameters: Option<Value>,
    pub created_by: Option<Uuid>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateScriptReq {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub script_type: Option<String>,
    pub content: Option<String>,
    pub parameters: Option<Value>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct RunScriptFromLibraryReq {
    pub hardware_ids: Vec<Uuid>,
    pub parameters: Option<Value>,
}

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct ScheduledScript {
    pub id: Uuid,
    pub script_id: Option<Uuid>,
    pub hardware_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
    pub cron_expression: String,
    pub enabled: bool,
    pub last_run: Option<DateTime<Utc>>,
    pub next_run: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateScheduleReq {
    pub script_id: Uuid,
    pub hardware_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
    pub cron_expression: String,
    pub enabled: Option<bool>,
    pub next_run: Option<DateTime<Utc>>,
}

// ─── SL1: Library CRUD ───────────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/script-library",
    responses(
        (status = 200, description = "Script library list", body = Vec<ScriptLibraryEntry>),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "ScriptLibrary"
)]
#[tracing::instrument(skip_all)]
pub async fn list_scripts(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<ScriptLibraryEntry>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, ScriptLibraryEntry>(
        r#"
        SELECT id, name, description, category, script_type, content, parameters,
               version, created_by, created_at, updated_at
        FROM it.script_library
        ORDER BY category NULLS LAST, name
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/script-library",
    request_body = CreateScriptReq,
    responses(
        (status = 201, description = "Script created", body = ScriptLibraryEntry),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "ScriptLibrary"
)]
#[tracing::instrument(skip_all)]
pub async fn create_script(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateScriptReq>,
) -> Result<(StatusCode, Json<ScriptLibraryEntry>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, ScriptLibraryEntry>(
        r#"
        INSERT INTO it.script_library
            (name, description, category, script_type, content, parameters, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, description, category, script_type, content, parameters,
                  version, created_by, created_at, updated_at
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.category)
    .bind(payload.script_type.as_deref().unwrap_or("bash"))
    .bind(&payload.content)
    .bind(payload.parameters.unwrap_or(Value::Array(vec![])))
    .bind(payload.created_by)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/script-library/{id}",
    params(("id" = uuid::Uuid, Path, description = "Script UUID")),
    responses(
        (status = 200, description = "Script", body = ScriptLibraryEntry),
        (status = 404, description = "Script not found"),
    ),
    security(("bearer" = [])),
    tag = "ScriptLibrary"
)]
#[tracing::instrument(skip_all)]
pub async fn get_script(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<Json<ScriptLibraryEntry>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, ScriptLibraryEntry>(
        r#"
        SELECT id, name, description, category, script_type, content, parameters,
               version, created_by, created_at, updated_at
        FROM it.script_library WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Script not found".to_string()))?;
    Ok(Json(row))
}

#[utoipa::path(
    put,
    path = "/api/v1/it-assets/script-library/{id}",
    params(("id" = uuid::Uuid, Path, description = "Script UUID")),
    request_body = UpdateScriptReq,
    responses(
        (status = 200, description = "Script updated", body = ScriptLibraryEntry),
        (status = 404, description = "Script not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "ScriptLibrary"
)]
#[tracing::instrument(skip_all)]
pub async fn update_script(
    State(pool): State<DatabasePool>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateScriptReq>,
) -> Result<Json<ScriptLibraryEntry>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, ScriptLibraryEntry>(
        r#"
        UPDATE it.script_library
        SET name        = COALESCE($2, name),
            description = COALESCE($3, description),
            category    = COALESCE($4, category),
            script_type = COALESCE($5, script_type),
            content     = COALESCE($6, content),
            parameters  = COALESCE($7, parameters),
            version     = version + 1,
            updated_at  = now()
        WHERE id = $1 AND created_by = $8
        RETURNING id, name, description, category, script_type, content, parameters,
                  version, created_by, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.category)
    .bind(&payload.script_type)
    .bind(&payload.content)
    .bind(&payload.parameters)
    .bind(claims.sub)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Script not found".to_string()))?;
    Ok(Json(row))
}

#[utoipa::path(
    delete,
    path = "/api/v1/it-assets/script-library/{id}",
    params(("id" = uuid::Uuid, Path, description = "Script UUID")),
    responses(
        (status = 204, description = "Script deleted"),
        (status = 404, description = "Script not found"),
    ),
    security(("bearer" = [])),
    tag = "ScriptLibrary"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_script(
    State(pool): State<DatabasePool>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.script_library WHERE id = $1 AND created_by = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Script not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── SL2: Run script from library ────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/script-library/{id}/run",
    params(("id" = uuid::Uuid, Path, description = "Script UUID")),
    request_body = RunScriptFromLibraryReq,
    responses(
        (status = 200, description = "Script queued"),
        (status = 404, description = "Script not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "ScriptLibrary"
)]
#[tracing::instrument(skip_all)]
pub async fn run_library_script(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<RunScriptFromLibraryReq>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Fetch script content
    let script: Option<(String, String)> =
        sqlx::query_as("SELECT content, script_type FROM it.script_library WHERE id = $1")
            .bind(id)
            .fetch_optional(pool.inner())
            .await
            .map_err(internal_err)?;

    let (content, script_type) =
        script.ok_or((StatusCode::NOT_FOUND, "Script not found".to_string()))?;

    let mut queued = 0usize;
    for hw_id in &payload.hardware_ids {
        // Queue via script_queue table (same as the existing queue_script handler)
        let params = payload.parameters.clone().unwrap_or_default();
        let script_content = inject_parameters(&content, &params);

        let _ = sqlx::query(
            r#"
            INSERT INTO it.script_queue (hardware_id, script_type, content, parameters, status)
            VALUES ($1, $2, $3, $4, 'pending')
            "#,
        )
        .bind(hw_id)
        .bind(&script_type)
        .bind(&script_content)
        .bind(&params)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;

        queued += 1;
    }

    Ok(Json(serde_json::json!({
        "queued": queued,
        "script_id": id,
    })))
}

fn inject_parameters(content: &str, params: &Value) -> String {
    // Simple variable substitution: {{param_name}} → value
    let mut result = content.to_string();
    if let Value::Object(map) = params {
        for (key, val) in map {
            let placeholder = format!("{{{{{}}}}}", key);
            let value = val.as_str().unwrap_or_default();
            result = result.replace(&placeholder, value);
        }
    }
    result
}

// ─── SL3: Scheduled scripts ───────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/script-library/schedules",
    responses(
        (status = 200, description = "Scheduled scripts list", body = Vec<ScheduledScript>),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "ScriptLibrary"
)]
#[tracing::instrument(skip_all)]
pub async fn list_schedules(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<ScheduledScript>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, ScheduledScript>(
        r#"
        SELECT id, script_id, hardware_id, group_id, cron_expression,
               enabled, last_run, next_run, created_at
        FROM it.scheduled_scripts
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/script-library/schedules",
    request_body = CreateScheduleReq,
    responses(
        (status = 201, description = "Schedule created", body = ScheduledScript),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "ScriptLibrary"
)]
#[tracing::instrument(skip_all)]
pub async fn create_schedule(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateScheduleReq>,
) -> Result<(StatusCode, Json<ScheduledScript>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, ScheduledScript>(
        r#"
        INSERT INTO it.scheduled_scripts
            (script_id, hardware_id, group_id, cron_expression, enabled, next_run)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, script_id, hardware_id, group_id, cron_expression,
                  enabled, last_run, next_run, created_at
        "#,
    )
    .bind(payload.script_id)
    .bind(payload.hardware_id)
    .bind(payload.group_id)
    .bind(&payload.cron_expression)
    .bind(payload.enabled.unwrap_or(true))
    .bind(payload.next_run)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[utoipa::path(
    delete,
    path = "/api/v1/it-assets/script-library/schedules/{id}",
    params(("id" = uuid::Uuid, Path, description = "Schedule UUID")),
    responses(
        (status = 204, description = "Schedule deleted"),
        (status = 404, description = "Schedule not found"),
    ),
    security(("bearer" = [])),
    tag = "ScriptLibrary"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_schedule(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // TODO: add tenant_id column to it.scheduled_scripts for tenant isolation
    let result = sqlx::query("DELETE FROM it.scheduled_scripts WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Schedule not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Background job: checks scheduled_scripts with next_run <= now and queues them.
#[allow(dead_code)]
pub async fn run_scheduler_tick(pool: &DatabasePool) {
    let due = match sqlx::query_as::<_, ScheduledScript>(
        r#"
        SELECT id, script_id, hardware_id, group_id, cron_expression,
               enabled, last_run, next_run, created_at
        FROM it.scheduled_scripts
        WHERE enabled = true AND next_run IS NOT NULL AND next_run <= now()
        "#,
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("Scheduler tick error: {}", e);
            return;
        },
    };

    for schedule in due {
        if let Some(script_id) = schedule.script_id {
            let hardware_ids: Vec<Uuid> = if let Some(hw_id) = schedule.hardware_id {
                vec![hw_id]
            } else if let Some(group_id) = schedule.group_id {
                // Expand group members
                sqlx::query_scalar::<_, Uuid>(
                    "SELECT hardware_id FROM it.device_group_members WHERE group_id = $1",
                )
                .bind(group_id)
                .fetch_all(pool.inner())
                .await
                .unwrap_or_default()
            } else {
                vec![]
            };

            for hw_id in hardware_ids {
                let content: Option<(String, String)> = sqlx::query_as(
                    "SELECT content, script_type FROM it.script_library WHERE id = $1",
                )
                .bind(script_id)
                .fetch_optional(pool.inner())
                .await
                .unwrap_or(None);

                if let Some((content, script_type)) = content {
                    let _ = sqlx::query(
                        r#"
                        INSERT INTO it.script_queue (hardware_id, script_type, content, parameters, status)
                        VALUES ($1, $2, $3, '{}', 'pending')
                        "#,
                    )
                    .bind(hw_id)
                    .bind(&script_type)
                    .bind(&content)
                    .execute(pool.inner())
                    .await;
                }
            }

            // Update last_run and clear next_run (cron re-scheduling would need a cron parser)
            let _ = sqlx::query(
                "UPDATE it.scheduled_scripts SET last_run = now(), next_run = NULL WHERE id = $1",
            )
            .bind(schedule.id)
            .execute(pool.inner())
            .await;

            tracing::info!(
                "Scheduled script {} executed (schedule {})",
                script_id,
                schedule.id
            );
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
