// PB1-PB4: Remediation playbooks — define, list, get, delete, run
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

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PlaybookRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub steps: Value,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePlaybookReq {
    pub name: String,
    pub description: Option<String>,
    /// Array of step objects: {action_type, config{}, on_failure: 'continue'|'stop'|'escalate'}
    pub steps: Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePlaybookReq {
    pub name: Option<String>,
    pub description: Option<String>,
    pub steps: Option<Value>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PlaybookRunRow {
    pub id: Uuid,
    pub playbook_id: Uuid,
    pub hardware_id: Option<Uuid>,
    pub status: String,
    pub step_results: Value,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct RunPlaybookReq {
    /// Target hardware to run playbook on (optional — some steps are server-side)
    pub hardware_id: Option<Uuid>,
}

// ─── PB1: List playbooks ─────────────────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn list_playbooks(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<PlaybookRow>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, PlaybookRow>(
        "SELECT id, name, description, steps, enabled, created_at, updated_at \
         FROM it.playbooks ORDER BY name ASC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(Json(rows))
}

// ─── PB2: Create playbook ────────────────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn create_playbook(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreatePlaybookReq>,
) -> Result<(StatusCode, Json<PlaybookRow>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, PlaybookRow>(
        r#"
        INSERT INTO it.playbooks (name, description, steps)
        VALUES ($1, $2, $3)
        RETURNING id, name, description, steps, enabled, created_at, updated_at
        "#,
    )
    .bind(&payload.name)
    .bind(payload.description)
    .bind(&payload.steps)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok((StatusCode::CREATED, Json(row)))
}

// ─── PB3: Get playbook ───────────────────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn get_playbook(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<Json<PlaybookRow>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, PlaybookRow>(
        "SELECT id, name, description, steps, enabled, created_at, updated_at \
         FROM it.playbooks WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Playbook not found".to_string()))?;

    Ok(Json(row))
}

// ─── PB3: Update playbook ────────────────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn update_playbook(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePlaybookReq>,
) -> Result<Json<PlaybookRow>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, PlaybookRow>(
        r#"
        UPDATE it.playbooks SET
            name        = COALESCE($2, name),
            description = COALESCE($3, description),
            steps       = COALESCE($4, steps),
            enabled     = COALESCE($5, enabled),
            updated_at  = now()
        WHERE id = $1
        RETURNING id, name, description, steps, enabled, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(payload.name)
    .bind(payload.description)
    .bind(payload.steps)
    .bind(payload.enabled)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Playbook not found".to_string()))?;

    Ok(Json(row))
}

// ─── PB4: Delete playbook ────────────────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn delete_playbook(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.playbooks WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Playbook not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── PB5: Run playbook ───────────────────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn run_playbook(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<RunPlaybookReq>,
) -> Result<(StatusCode, Json<PlaybookRunRow>), (StatusCode, String)> {
    // Verify playbook exists and is enabled
    #[derive(sqlx::FromRow)]
    struct PbSteps {
        id: Uuid,
        steps: Option<Value>,
    }

    let pb = sqlx::query_as::<_, PbSteps>(
        "SELECT id, steps FROM it.playbooks WHERE id = $1 AND enabled = true",
    )
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((
        StatusCode::NOT_FOUND,
        "Playbook not found or disabled".to_string(),
    ))?;

    let steps: Vec<Value> =
        serde_json::from_value(pb.steps.unwrap_or(Value::Array(vec![]))).unwrap_or_default();

    // Create a run record — initial step results pre-populated with 'pending'
    let initial_results: Vec<Value> = steps
        .iter()
        .enumerate()
        .map(|(i, step)| {
            serde_json::json!({
                "step_index": i,
                "action_type": step.get("action_type").unwrap_or(&Value::Null),
                "status": "pending",
                "output": null,
                "error": null,
                "started_at": null,
                "completed_at": null,
            })
        })
        .collect();

    let run = sqlx::query_as::<_, PlaybookRunRow>(
        r#"
        INSERT INTO it.playbook_runs (playbook_id, hardware_id, status, step_results)
        VALUES ($1, $2, 'running', $3)
        RETURNING id, playbook_id, hardware_id, status, step_results, started_at, completed_at
        "#,
    )
    .bind(id)
    .bind(payload.hardware_id)
    .bind(serde_json::Value::Array(initial_results))
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    // TODO: Dispatch step execution via agent commands queue.
    // For now, steps are recorded and can be picked up by the orchestration layer.

    Ok((StatusCode::CREATED, Json(run)))
}

// ─── PB6: List runs for a playbook ───────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn list_playbook_runs(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<PlaybookRunRow>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, PlaybookRunRow>(
        r#"
        SELECT id, playbook_id, hardware_id, status, step_results, started_at, completed_at
        FROM it.playbook_runs
        WHERE playbook_id = $1
        ORDER BY started_at DESC
        LIMIT 100
        "#,
    )
    .bind(id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(Json(rows))
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
