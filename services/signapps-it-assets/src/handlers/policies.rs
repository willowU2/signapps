// GP1-GP5: Policy CRUD, assignment, merged policies for agent, compliance reporting
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

// ============================================================================
// Models
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
/// Represents a policy.
pub struct Policy {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub settings: Value,
    pub parent_id: Option<Uuid>,
    pub priority: Option<i32>,
    pub mode: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
/// Represents a policy with children.
pub struct PolicyWithChildren {
    #[serde(flatten)]
    pub policy: Policy,
    pub children: Vec<PolicyWithChildren>,
}

#[derive(Debug, Deserialize)]
/// Request payload for CreatePolicy operation.
pub struct CreatePolicyRequest {
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub settings: Option<Value>,
    pub parent_id: Option<Uuid>,
    pub priority: Option<i32>,
    pub mode: Option<String>,
}

#[derive(Debug, Deserialize)]
/// Request payload for UpdatePolicy operation.
pub struct UpdatePolicyRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub settings: Option<Value>,
    pub parent_id: Option<Uuid>,
    pub priority: Option<i32>,
    pub mode: Option<String>,
}

#[derive(Debug, Deserialize)]
/// Request payload for AssignPolicy operation.
pub struct AssignPolicyRequest {
    pub target_type: String, // "group" | "machine"
    pub target_id: Uuid,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
/// Represents a policy assignment.
pub struct PolicyAssignment {
    pub id: Uuid,
    pub policy_id: Uuid,
    pub target_type: String,
    pub target_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
/// Represents a compliance report.
pub struct ComplianceReport {
    pub hardware_id: Uuid,
    pub policy_id: Uuid,
    pub compliant: bool,
    pub details: Option<Value>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
/// Represents a policy compliance.
pub struct PolicyCompliance {
    pub id: Uuid,
    pub hardware_id: Uuid,
    pub policy_id: Uuid,
    pub compliant: bool,
    pub details: Option<Value>,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
/// Represents a compliance summary.
pub struct ComplianceSummary {
    pub total_checks: i64,
    pub compliant_count: i64,
    pub non_compliant_count: i64,
    pub compliance_pct: f64,
    pub non_compliant_machines: Vec<NonCompliantMachine>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
/// Represents a non compliant machine.
pub struct NonCompliantMachine {
    pub hardware_id: Uuid,
    pub hardware_name: String,
    pub policy_id: Uuid,
    pub policy_name: String,
    pub checked_at: DateTime<Utc>,
}

// ============================================================================
// GP1: List policies (flat)
// ============================================================================

pub async fn list_policies(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<Policy>>, (StatusCode, String)> {
    let policies = sqlx::query_as::<_, Policy>(
        r#"
        SELECT id, name, description, category, settings, parent_id, priority, mode, created_at, updated_at
        FROM it.policies
        ORDER BY priority DESC, created_at DESC
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(policies))
}

// GP1: List policies as tree (parent → children)
pub async fn list_policies_tree(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<PolicyWithChildren>>, (StatusCode, String)> {
    let all_policies = sqlx::query_as::<_, Policy>(
        r#"
        SELECT id, name, description, category, settings, parent_id, priority, mode, created_at, updated_at
        FROM it.policies
        ORDER BY priority DESC, created_at DESC
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let tree = build_tree(all_policies, None);
    Ok(Json(tree))
}

fn build_tree(policies: Vec<Policy>, parent_id: Option<Uuid>) -> Vec<PolicyWithChildren> {
    let mut result = Vec::new();
    let (children_src, remaining): (Vec<Policy>, Vec<Policy>) =
        policies.into_iter().partition(|p| p.parent_id == parent_id);

    for policy in children_src {
        let id = policy.id;
        let children = build_tree(
            remaining
                .iter()
                .filter(|p| p.parent_id == Some(id))
                .cloned()
                .collect(),
            Some(id),
        );
        // We need remaining without consumed children — rebuild from original
        result.push(PolicyWithChildren { policy, children });
    }
    result
}

// ============================================================================
// CRUD
// ============================================================================

pub async fn get_policy(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Policy>, (StatusCode, String)> {
    let policy = sqlx::query_as::<_, Policy>(
        "SELECT id, name, description, category, settings, parent_id, priority, mode, created_at, updated_at FROM it.policies WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Policy not found".to_string()))?;

    Ok(Json(policy))
}

pub async fn create_policy(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreatePolicyRequest>,
) -> Result<(StatusCode, Json<Policy>), (StatusCode, String)> {
    let settings = payload
        .settings
        .unwrap_or(Value::Object(serde_json::Map::new()));
    let policy = sqlx::query_as::<_, Policy>(
        r#"
        INSERT INTO it.policies (name, description, category, settings, parent_id, priority, mode)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, description, category, settings, parent_id, priority, mode, created_at, updated_at
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.category)
    .bind(&settings)
    .bind(payload.parent_id)
    .bind(payload.priority.unwrap_or(0))
    .bind(payload.mode.as_deref().unwrap_or("enforce"))
    .fetch_one(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, Json(policy)))
}

pub async fn update_policy(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePolicyRequest>,
) -> Result<Json<Policy>, (StatusCode, String)> {
    let _ = sqlx::query("SELECT id FROM it.policies WHERE id = $1")
        .bind(id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Policy not found".to_string()))?;

    let policy = sqlx::query_as::<_, Policy>(
        r#"
        UPDATE it.policies SET
            name        = COALESCE($1, name),
            description = COALESCE($2, description),
            category    = COALESCE($3, category),
            settings    = COALESCE($4, settings),
            parent_id   = COALESCE($5, parent_id),
            priority    = COALESCE($6, priority),
            mode        = COALESCE($7, mode),
            updated_at  = NOW()
        WHERE id = $8
        RETURNING id, name, description, category, settings, parent_id, priority, mode, created_at, updated_at
        "#,
    )
    .bind(payload.name.as_deref())
    .bind(payload.description.as_deref())
    .bind(payload.category.as_deref())
    .bind(&payload.settings)
    .bind(payload.parent_id)
    .bind(payload.priority)
    .bind(payload.mode.as_deref())
    .bind(id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(policy))
}

pub async fn delete_policy(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.policies WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Policy not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// GP2: Assignment
// ============================================================================

pub async fn assign_policy(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AssignPolicyRequest>,
) -> Result<(StatusCode, Json<PolicyAssignment>), (StatusCode, String)> {
    // Validate target_type
    if !["group", "machine"].contains(&payload.target_type.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            "target_type must be 'group' or 'machine'".to_string(),
        ));
    }

    let assignment = sqlx::query_as::<_, PolicyAssignment>(
        r#"
        INSERT INTO it.policy_assignments (policy_id, target_type, target_id)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        RETURNING id, policy_id, target_type, target_id, created_at
        "#,
    )
    .bind(id)
    .bind(&payload.target_type)
    .bind(payload.target_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match assignment {
        Some(a) => Ok((StatusCode::CREATED, Json(a))),
        None => Err((
            StatusCode::CONFLICT,
            "Assignment already exists".to_string(),
        )),
    }
}

pub async fn list_assignments(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<PolicyAssignment>>, (StatusCode, String)> {
    let assignments = sqlx::query_as::<_, PolicyAssignment>(
        "SELECT id, policy_id, target_type, target_id, created_at FROM it.policy_assignments WHERE policy_id = $1",
    )
    .bind(id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(assignments))
}

// ============================================================================
// GP2: Merged policies for agent (with inheritance)
// ============================================================================

pub async fn get_agent_policies(
    State(pool): State<DatabasePool>,
    Path(agent_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, String)> {
    // Fetch all policies assigned to this machine directly
    let direct_policies = sqlx::query_as::<_, Policy>(
        r#"
        SELECT p.id, p.name, p.description, p.category, p.settings, p.parent_id, p.priority, p.mode, p.created_at, p.updated_at
        FROM it.policies p
        JOIN it.policy_assignments pa ON pa.policy_id = p.id
        WHERE pa.target_type = 'machine' AND pa.target_id = $1
        ORDER BY p.priority DESC
        "#,
    )
    .bind(agent_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Merge settings: child overrides parent
    let mut merged: serde_json::Map<String, Value> = serde_json::Map::new();
    let mut policies_applied: Vec<serde_json::Value> = Vec::new();

    for policy in &direct_policies {
        // Fetch ancestor chain to apply inheritance bottom-up (parent first)
        let ancestors = get_ancestor_chain(pool.inner(), &policy).await?;
        for ancestor in ancestors {
            if let Value::Object(ref map) = ancestor.settings {
                for (k, v) in map {
                    merged.entry(k.clone()).or_insert_with(|| v.clone());
                }
            }
        }
        // Then apply current policy (overrides parent)
        if let Value::Object(ref map) = policy.settings {
            for (k, v) in map {
                merged.insert(k.clone(), v.clone());
            }
        }
        policies_applied.push(serde_json::json!({
            "id": policy.id,
            "name": policy.name,
            "category": policy.category,
            "mode": policy.mode,
            "priority": policy.priority,
        }));
    }

    Ok(Json(serde_json::json!({
        "agent_id": agent_id,
        "policies_applied": policies_applied,
        "merged_settings": merged,
    })))
}

async fn get_ancestor_chain(
    pool: &sqlx::PgPool,
    policy: &Policy,
) -> Result<Vec<Policy>, (StatusCode, String)> {
    let mut ancestors = Vec::new();
    let mut current_parent = policy.parent_id;
    while let Some(parent_id) = current_parent {
        let parent = sqlx::query_as::<_, Policy>(
            "SELECT id, name, description, category, settings, parent_id, priority, mode, created_at, updated_at FROM it.policies WHERE id = $1",
        )
        .bind(parent_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        match parent {
            Some(p) => {
                current_parent = p.parent_id;
                ancestors.insert(0, p); // prepend so ancestors come first
            },
            None => break,
        }
    }
    Ok(ancestors)
}

// ============================================================================
// GP4: Compliance reporting from agent
// ============================================================================

pub async fn report_compliance(
    State(pool): State<DatabasePool>,
    Json(payload): Json<ComplianceReport>,
) -> Result<StatusCode, (StatusCode, String)> {
    let details = payload
        .details
        .unwrap_or(Value::Object(serde_json::Map::new()));

    sqlx::query(
        r#"
        INSERT INTO it.policy_compliance (hardware_id, policy_id, compliant, details, checked_at)
        VALUES ($1, $2, $3, $4, NOW())
        "#,
    )
    .bind(payload.hardware_id)
    .bind(payload.policy_id)
    .bind(payload.compliant)
    .bind(&details)
    .execute(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::CREATED)
}

// GP4: Compliance dashboard summary
pub async fn compliance_summary(
    State(pool): State<DatabasePool>,
) -> Result<Json<ComplianceSummary>, (StatusCode, String)> {
    let row: (i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COUNT(*) FILTER (WHERE compliant = true)  AS compliant_count,
            COUNT(*) FILTER (WHERE compliant = false) AS non_compliant_count
        FROM (
            SELECT DISTINCT ON (hardware_id, policy_id) hardware_id, policy_id, compliant
            FROM it.policy_compliance
            ORDER BY hardware_id, policy_id, checked_at DESC
        ) latest
        "#,
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (compliant_count, non_compliant_count) = row;
    let total = compliant_count + non_compliant_count;
    let pct = if total > 0 {
        compliant_count as f64 / total as f64 * 100.0
    } else {
        100.0
    };

    let non_compliant_machines = sqlx::query_as::<_, NonCompliantMachine>(
        r#"
        SELECT DISTINCT ON (pc.hardware_id, pc.policy_id)
            pc.hardware_id,
            h.name AS hardware_name,
            pc.policy_id,
            p.name AS policy_name,
            pc.checked_at
        FROM it.policy_compliance pc
        JOIN it.hardware h ON h.id = pc.hardware_id
        JOIN it.policies p ON p.id = pc.policy_id
        WHERE pc.compliant = false
        ORDER BY pc.hardware_id, pc.policy_id, pc.checked_at DESC
        LIMIT 100
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ComplianceSummary {
        total_checks: total,
        compliant_count,
        non_compliant_count,
        compliance_pct: pct,
        non_compliant_machines,
    }))
}
