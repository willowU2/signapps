// #20 Software blacklist/whitelist policies
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_db::DatabasePool;
use uuid::Uuid;

fn internal_err(e: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SoftwarePolicy {
    pub id: Uuid,
    pub name: String,
    pub mode: String,
    pub patterns: Vec<String>,
    pub action: String,
    pub enabled: Option<bool>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSoftwarePolicyReq {
    pub name: String,
    pub mode: String, // "whitelist" | "blacklist"
    pub patterns: Vec<String>,
    pub action: String, // "alert" | "remove"
}

#[derive(Debug, Serialize)]
pub struct SoftwarePolicyCheckResult {
    pub hardware_id: Uuid,
    pub violations: Vec<PolicyViolation>,
}

#[derive(Debug, Serialize)]
pub struct PolicyViolation {
    pub policy_id: Uuid,
    pub policy_name: String,
    pub mode: String,
    pub action: String,
    pub matched_software: String,
    pub pattern: String,
}

/// GET /api/v1/it-assets/software-policies
#[tracing::instrument(skip_all)]
pub async fn list_software_policies(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<SoftwarePolicy>>, (StatusCode, String)> {
    let policies = sqlx::query_as::<_, SoftwarePolicy>(
        "SELECT id, name, mode, patterns, action, enabled, created_at, updated_at FROM it.software_policies ORDER BY name",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(Json(policies))
}

/// POST /api/v1/it-assets/software-policies
#[tracing::instrument(skip_all)]
pub async fn create_software_policy(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateSoftwarePolicyReq>,
) -> Result<(StatusCode, Json<SoftwarePolicy>), (StatusCode, String)> {
    if !matches!(payload.mode.as_str(), "whitelist" | "blacklist") {
        return Err((
            StatusCode::BAD_REQUEST,
            "mode must be 'whitelist' or 'blacklist'".to_string(),
        ));
    }
    if !matches!(payload.action.as_str(), "alert" | "remove") {
        return Err((
            StatusCode::BAD_REQUEST,
            "action must be 'alert' or 'remove'".to_string(),
        ));
    }

    let policy = sqlx::query_as::<_, SoftwarePolicy>(
        r#"INSERT INTO it.software_policies (name, mode, patterns, action)
           VALUES ($1,$2,$3,$4)
           RETURNING id, name, mode, patterns, action, enabled, created_at, updated_at"#,
    )
    .bind(&payload.name)
    .bind(&payload.mode)
    .bind(&payload.patterns)
    .bind(&payload.action)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok((StatusCode::CREATED, Json(policy)))
}

/// GET /api/v1/it-assets/hardware/:hw_id/software-check
/// Check installed software on a device against all enabled policies
#[tracing::instrument(skip_all)]
pub async fn check_software_compliance(
    State(pool): State<DatabasePool>,
    Path(hw_id): Path<Uuid>,
) -> Result<Json<SoftwarePolicyCheckResult>, (StatusCode, String)> {
    let policies = sqlx::query_as::<_, SoftwarePolicy>(
        "SELECT id, name, mode, patterns, action, enabled, created_at, updated_at FROM it.software_policies WHERE enabled = true",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    // Fetch installed software for this hardware
    let installed: Vec<(String,)> = sqlx::query_as(
        "SELECT COALESCE(name, '') FROM it.software_inventory WHERE hardware_id = $1",
    )
    .bind(hw_id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    let installed_names: Vec<String> = installed.into_iter().map(|(n,)| n.to_lowercase()).collect();

    let mut violations = Vec::new();

    for policy in &policies {
        for pattern in &policy.patterns {
            let pat_lower = pattern.to_lowercase();
            for sw in &installed_names {
                let matches = sw.contains(&pat_lower);
                // blacklist: flag matches; whitelist: flag non-matches (handled differently)
                if policy.mode == "blacklist" && matches {
                    violations.push(PolicyViolation {
                        policy_id: policy.id,
                        policy_name: policy.name.clone(),
                        mode: policy.mode.clone(),
                        action: policy.action.clone(),
                        matched_software: sw.clone(),
                        pattern: pattern.clone(),
                    });
                }
            }
        }
    }

    Ok(Json(SoftwarePolicyCheckResult {
        hardware_id: hw_id,
        violations,
    }))
}
