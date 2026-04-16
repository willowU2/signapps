//! Bulk employee CSV import handler.

use axum::extract::Multipart;
use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

use super::types::ImportResult;

/// POST /api/v1/workforce/employees/import
///
/// Accepts a multipart form upload with a CSV file (field name: "file").
/// Expected header row: name, email, department, position, start_date
/// (or: first_name, last_name, email, department, position, start_date)
///
/// Employees are created and linked to an org node if `department` matches
/// an existing org node name for this tenant.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/employees/import",
    responses(
        (status = 200, description = "Import result summary"),
        (status = 400, description = "Invalid CSV file or no file uploaded"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Employees"
)]
#[tracing::instrument(skip_all)]
pub async fn import_employees(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, StatusCode> {
    let mut csv_bytes: Vec<u8> = Vec::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name().unwrap_or("") == "file" {
            match field.bytes().await {
                Ok(b) => {
                    csv_bytes = b.to_vec();
                    break;
                },
                Err(e) => {
                    tracing::error!("Failed to read CSV field: {e}");
                    return Err(StatusCode::BAD_REQUEST);
                },
            }
        }
    }

    if csv_bytes.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let content = match std::str::from_utf8(&csv_bytes) {
        Ok(s) => s.to_string(),
        Err(_) => return Err(StatusCode::BAD_REQUEST),
    };

    let mut lines = content.lines();
    let header_line = match lines.next() {
        Some(h) => h,
        None => return Err(StatusCode::BAD_REQUEST),
    };

    let headers: Vec<String> = header_line
        .split(',')
        .map(|h| h.trim().to_lowercase().replace('"', ""))
        .collect();

    let col = |name: &str| -> Option<usize> { headers.iter().position(|h| h == name) };

    let idx_first_name = col("first_name");
    let idx_last_name = col("last_name");
    let idx_name = col("name");
    let idx_email = col("email");
    let idx_department = col("department");
    let idx_position = col("position");
    let idx_start_date = col("start_date");

    let parse_col = |row: &[&str], idx: Option<usize>| -> Option<String> {
        idx.and_then(|i| row.get(i))
            .map(|v| v.trim().replace('"', ""))
            .filter(|v| !v.is_empty())
    };

    let mut imported = 0u32;
    let mut skipped = 0u32;
    let mut failed = 0u32;

    // Cache a default org node (root) for the tenant as fallback
    let default_node: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM workforce_org_nodes WHERE tenant_id = $1 AND parent_id IS NULL LIMIT 1",
    )
    .bind(ctx.tenant_id)
    .fetch_optional(&*state.pool)
    .await
    .ok()
    .flatten();

    for line in lines {
        if line.trim().is_empty() {
            skipped += 1;
            continue;
        }
        let cols: Vec<&str> = line.split(',').collect();

        let (first_name, last_name) = if let (Some(f), Some(l)) = (
            parse_col(&cols, idx_first_name),
            parse_col(&cols, idx_last_name),
        ) {
            (f, l)
        } else if let Some(full) = parse_col(&cols, idx_name) {
            let parts: Vec<&str> = full.splitn(2, ' ').collect();
            let first = parts.first().copied().unwrap_or("").to_string();
            let last = parts.get(1).copied().unwrap_or("").to_string();
            (first, last)
        } else {
            skipped += 1;
            continue;
        };

        if first_name.is_empty() {
            skipped += 1;
            continue;
        }

        let email = parse_col(&cols, idx_email);
        let department = parse_col(&cols, idx_department);
        let position = parse_col(&cols, idx_position);
        let start_date_str = parse_col(&cols, idx_start_date);

        // Resolve org node from department name
        let org_node_id: Option<Uuid> = if let Some(ref dept) = department {
            sqlx::query_scalar(
                "SELECT id FROM workforce_org_nodes WHERE tenant_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1",
            )
            .bind(ctx.tenant_id)
            .bind(dept)
            .fetch_optional(&*state.pool)
            .await
            .ok()
            .flatten()
        } else {
            None
        };

        let node_id = match org_node_id.or(default_node) {
            Some(id) => id,
            None => {
                failed += 1;
                continue;
            },
        };

        let hire_date: Option<chrono::NaiveDate> = start_date_str
            .as_deref()
            .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

        let functions = match position {
            Some(ref p) => serde_json::json!([p]),
            None => serde_json::json!([]),
        };

        let res = sqlx::query(
            r#"INSERT INTO workforce_employees
               (id, tenant_id, org_node_id, first_name, last_name, email,
                functions, contract_type, fte_ratio, hire_date, status, metadata,
                created_at, updated_at)
               VALUES
               (gen_random_uuid(), $1, $2, $3, $4, $5,
                $6, 'full-time', 1.0, $7, 'active', '{}',
                NOW(), NOW())"#,
        )
        .bind(ctx.tenant_id)
        .bind(node_id)
        .bind(&first_name)
        .bind(&last_name)
        .bind(email.as_deref())
        .bind(&functions)
        .bind(hire_date)
        .execute(&*state.pool)
        .await;

        match res {
            Ok(_) => imported += 1,
            Err(e) => {
                tracing::warn!("Failed to insert employee: {e}");
                failed += 1;
            },
        }
    }

    tracing::info!(
        tenant = %ctx.tenant_id,
        imported,
        skipped,
        failed,
        "Employee CSV import completed"
    );

    Ok(Json(ImportResult {
        imported,
        skipped,
        failed,
    }))
}
