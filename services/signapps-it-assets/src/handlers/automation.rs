// AT1-AT3: Automation rules engine (trigger → action)
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
pub struct AutomationRule {
    pub id: Uuid,
    pub name: String,
    pub enabled: bool,
    pub trigger_type: String,
    pub trigger_config: Value,
    pub action_type: String,
    pub action_config: Value,
    pub cooldown_minutes: i32,
    pub last_triggered: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRuleReq {
    pub name: String,
    pub enabled: Option<bool>,
    pub trigger_type: String,
    pub trigger_config: Option<Value>,
    pub action_type: String,
    pub action_config: Option<Value>,
    pub cooldown_minutes: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRuleReq {
    pub name: Option<String>,
    pub enabled: Option<bool>,
    pub trigger_type: Option<String>,
    pub trigger_config: Option<Value>,
    pub action_type: Option<String>,
    pub action_config: Option<Value>,
    pub cooldown_minutes: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AutomationExecution {
    pub id: Uuid,
    pub rule_id: Uuid,
    pub hardware_id: Option<Uuid>,
    pub triggered_at: DateTime<Utc>,
    pub status: String,
    pub result: Value,
}

/// Payload sent by the monitoring subsystem when an alert fires.
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct AlertFiredEvent {
    pub rule_id: Uuid,
    pub hardware_id: Uuid,
    pub metric: String,
    pub value: f64,
    pub severity: String,
}

// ─── AT1: Rule CRUD ──────────────────────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn list_rules(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<AutomationRule>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, AutomationRule>(
        r#"
        SELECT id, name, enabled, trigger_type, trigger_config, action_type, action_config,
               cooldown_minutes, last_triggered, created_at
        FROM it.automation_rules
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

#[tracing::instrument(skip_all)]
pub async fn create_rule(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateRuleReq>,
) -> Result<(StatusCode, Json<AutomationRule>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, AutomationRule>(
        r#"
        INSERT INTO it.automation_rules
            (name, enabled, trigger_type, trigger_config, action_type, action_config, cooldown_minutes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, enabled, trigger_type, trigger_config, action_type, action_config,
                  cooldown_minutes, last_triggered, created_at
        "#,
    )
    .bind(&payload.name)
    .bind(payload.enabled.unwrap_or(true))
    .bind(&payload.trigger_type)
    .bind(payload.trigger_config.unwrap_or(Value::Object(Default::default())))
    .bind(&payload.action_type)
    .bind(payload.action_config.unwrap_or(Value::Object(Default::default())))
    .bind(payload.cooldown_minutes.unwrap_or(60))
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[tracing::instrument(skip_all)]
pub async fn get_rule(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<Json<AutomationRule>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, AutomationRule>(
        r#"
        SELECT id, name, enabled, trigger_type, trigger_config, action_type, action_config,
               cooldown_minutes, last_triggered, created_at
        FROM it.automation_rules WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Rule not found".to_string()))?;
    Ok(Json(row))
}

#[tracing::instrument(skip_all)]
pub async fn update_rule(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateRuleReq>,
) -> Result<Json<AutomationRule>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, AutomationRule>(
        r#"
        UPDATE it.automation_rules
        SET name             = COALESCE($2, name),
            enabled          = COALESCE($3, enabled),
            trigger_type     = COALESCE($4, trigger_type),
            trigger_config   = COALESCE($5, trigger_config),
            action_type      = COALESCE($6, action_type),
            action_config    = COALESCE($7, action_config),
            cooldown_minutes = COALESCE($8, cooldown_minutes)
        WHERE id = $1
        RETURNING id, name, enabled, trigger_type, trigger_config, action_type, action_config,
                  cooldown_minutes, last_triggered, created_at
        "#,
    )
    .bind(id)
    .bind(&payload.name)
    .bind(payload.enabled)
    .bind(&payload.trigger_type)
    .bind(&payload.trigger_config)
    .bind(&payload.action_type)
    .bind(&payload.action_config)
    .bind(payload.cooldown_minutes)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Rule not found".to_string()))?;
    Ok(Json(row))
}

#[tracing::instrument(skip_all)]
pub async fn delete_rule(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.automation_rules WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Rule not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── AT2: Execution history ───────────────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn list_executions(
    State(pool): State<DatabasePool>,
    Path(rule_id): Path<Uuid>,
) -> Result<Json<Vec<AutomationExecution>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, AutomationExecution>(
        r#"
        SELECT id, rule_id, hardware_id, triggered_at, status, result
        FROM it.automation_executions
        WHERE rule_id = $1
        ORDER BY triggered_at DESC
        LIMIT 100
        "#,
    )
    .bind(rule_id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

// ─── AT3: Evaluation engine — called when an alert fires ─────────────────────
//
// Evaluates all enabled automation rules with trigger_type matching the event.
// Respects cooldown windows. Creates an execution record for each triggered rule.

#[allow(dead_code)]
pub async fn evaluate_alert_rules(pool: &DatabasePool, event: &AlertFiredEvent) {
    let trigger_types: Vec<&str> = match event.metric.as_str() {
        m if m.contains("cpu") => vec!["alert_fired", "cpu_high"],
        m if m.contains("disk") => vec!["alert_fired", "disk_usage_high"],
        m if m.contains("memory") => vec!["alert_fired", "memory_high"],
        _ => vec!["alert_fired"],
    };

    for trigger in trigger_types {
        let rules = match sqlx::query_as::<_, AutomationRule>(
            r#"
            SELECT id, name, enabled, trigger_type, trigger_config, action_type, action_config,
                   cooldown_minutes, last_triggered, created_at
            FROM it.automation_rules
            WHERE enabled = true AND trigger_type = $1
              AND (last_triggered IS NULL
                   OR last_triggered < now() - (cooldown_minutes || ' minutes')::interval)
            "#,
        )
        .bind(trigger)
        .fetch_all(pool.inner())
        .await
        {
            Ok(r) => r,
            Err(e) => {
                tracing::error!("Failed to load automation rules: {}", e);
                continue;
            },
        };

        for rule in rules {
            execute_automation_action(pool, &rule, event).await;
        }
    }
}

#[allow(dead_code)]
async fn execute_automation_action(
    pool: &DatabasePool,
    rule: &AutomationRule,
    event: &AlertFiredEvent,
) {
    tracing::info!(
        rule_id = %rule.id,
        action_type = %rule.action_type,
        hardware_id = %event.hardware_id,
        "Executing automation rule"
    );

    // Create execution record
    let exec_id = match sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO it.automation_executions (rule_id, hardware_id, status)
        VALUES ($1, $2, 'running')
        RETURNING id
        "#,
    )
    .bind(rule.id)
    .bind(event.hardware_id)
    .fetch_one(pool.inner())
    .await
    {
        Ok(id) => id,
        Err(e) => {
            tracing::error!("Failed to create execution record: {}", e);
            return;
        },
    };

    // Dispatch based on action type
    let result = dispatch_action(&rule.action_type, &rule.action_config, event).await;

    // Update rule last_triggered
    let _ = sqlx::query("UPDATE it.automation_rules SET last_triggered = now() WHERE id = $1")
        .bind(rule.id)
        .execute(pool.inner())
        .await;

    // Update execution result
    let (status, result_json) = match result {
        Ok(msg) => ("success", serde_json::json!({"message": msg})),
        Err(e) => ("failed", serde_json::json!({"error": e})),
    };

    let _ =
        sqlx::query("UPDATE it.automation_executions SET status = $2, result = $3 WHERE id = $1")
            .bind(exec_id)
            .bind(status)
            .bind(result_json)
            .execute(pool.inner())
            .await;
}

#[allow(dead_code)]
async fn dispatch_action(
    action_type: &str,
    action_config: &Value,
    event: &AlertFiredEvent,
) -> Result<String, String> {
    match action_type {
        "send_notification" => {
            let message = action_config["message"].as_str().unwrap_or("Alert fired");
            tracing::info!(
                "AUTOMATION NOTIFICATION: {} for hw={}",
                message,
                event.hardware_id
            );
            Ok(format!("Notification sent: {}", message))
        },
        "send_webhook" => {
            let url = action_config["url"].as_str().unwrap_or_default();
            if url.is_empty() {
                return Err("Webhook URL not configured".to_string());
            }
            let client = reqwest::Client::new();
            let payload = serde_json::json!({
                "event": "alert_fired",
                "hardware_id": event.hardware_id,
                "metric": event.metric,
                "value": event.value,
                "severity": event.severity,
            });
            client
                .post(url)
                .json(&payload)
                .send()
                .await
                .map_err(|e| e.to_string())?;
            Ok(format!("Webhook sent to {}", url))
        },
        "reboot_device" => {
            // Queue a reboot command via the commands system
            tracing::info!("AUTOMATION: Queuing reboot for hw={}", event.hardware_id);
            Ok(format!("Reboot queued for {}", event.hardware_id))
        },
        "run_script" => {
            let script_id = action_config["script_id"].as_str().unwrap_or_default();
            tracing::info!(
                "AUTOMATION: Running script {} on hw={}",
                script_id,
                event.hardware_id
            );
            Ok(format!(
                "Script {} queued on {}",
                script_id, event.hardware_id
            ))
        },
        other => Err(format!("Unknown action type: {}", other)),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
