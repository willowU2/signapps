//! Bulk User Management handlers — V3-09.
//!
//! CSV import/export and bulk actions on multiple users.
//! All routes require admin role (enforced by the router middleware).
//! Import validation is performed in-memory; no DB writes.

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use uuid::Uuid;

use crate::AppState;

// =============================================================================
// Domain types
// =============================================================================

/// One row parsed from the import CSV.
#[derive(Debug, Clone)]
/// CsvUserRow data transfer object.
pub struct CsvUserRow {
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub role: Option<String>,
    pub department: Option<String>,
}

/// Supported bulk actions.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BulkAction {
    Activate,
    Deactivate,
    ResetPassword,
    ChangeRole { role: String },
    Delete,
}

/// Request body for POST /api/v1/admin/users/bulk-action.
#[derive(Debug, Deserialize)]
/// Request body for BulkAction.
pub struct BulkActionRequest {
    pub user_ids: Vec<Uuid>,
    pub action: BulkAction,
}

/// Result returned from a CSV import.
#[derive(Debug, Serialize)]
/// ImportResult data transfer object.
pub struct ImportResult {
    pub total: u32,
    pub created: u32,
    pub skipped: u32,
    pub errors: Vec<String>,
}

/// Result returned from a bulk action.
#[derive(Debug, Serialize)]
/// BulkActionResult data transfer object.
pub struct BulkActionResult {
    pub affected: u32,
    pub action: BulkAction,
}

// =============================================================================
// CSV helpers
// =============================================================================

/// Parse CSV text (header + data rows) into `CsvUserRow` values.
///
/// Expected header: `email,first_name,last_name,role,department`
/// Fields are trimmed; `role` and `department` are optional (may be empty).
fn parse_csv(body: &str) -> (Vec<CsvUserRow>, Vec<String>) {
    let mut rows = Vec::new();
    let mut errors = Vec::new();

    let mut lines = body.lines();

    // Skip/validate header
    match lines.next() {
        None => {
            errors.push("CSV body is empty".to_string());
            return (rows, errors);
        },
        Some(header) => {
            let h = header.trim().to_lowercase();
            // Accept the expected header or be lenient and skip any header row
            if !h.starts_with("email") {
                errors.push(format!("Unexpected header: '{}'", header.trim()));
                return (rows, errors);
            }
        },
    }

    for (line_idx, line) in lines.enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let row_num = line_idx + 2; // human-readable (1-based, after header)
        let fields: Vec<&str> = line.splitn(5, ',').collect();

        if fields.len() < 3 {
            errors.push(format!(
                "Row {}: expected at least 3 fields (email,first_name,last_name), got {}",
                row_num,
                fields.len()
            ));
            continue;
        }

        let email = fields[0].trim().to_string();
        let first_name = fields[1].trim().to_string();
        let last_name = fields[2].trim().to_string();
        let role = fields
            .get(3)
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());
        let department = fields
            .get(4)
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());

        // Basic email validation
        if !email.contains('@') || email.len() < 3 {
            errors.push(format!("Row {}: invalid email '{}'", row_num, email));
            continue;
        }
        if first_name.is_empty() {
            errors.push(format!("Row {}: first_name is required", row_num));
            continue;
        }
        if last_name.is_empty() {
            errors.push(format!("Row {}: last_name is required", row_num));
            continue;
        }

        rows.push(CsvUserRow {
            email,
            first_name,
            last_name,
            role,
            department,
        });
    }

    (rows, errors)
}

/// Render a slice of CsvUserRow as a CSV string (with header).
fn render_csv(rows: &[CsvUserRow]) -> String {
    let mut out = String::from("email,first_name,last_name,role,department\n");
    for r in rows {
        out.push_str(&format!(
            "{},{},{},{},{}\n",
            r.email,
            r.first_name,
            r.last_name,
            r.role.as_deref().unwrap_or(""),
            r.department.as_deref().unwrap_or(""),
        ));
    }
    out
}

// =============================================================================
// Handlers
// =============================================================================

/// POST /api/v1/admin/users/import
///
/// Accepts a `text/csv` body, parses and validates each row, and returns an
/// `ImportResult`. No DB writes — validation only.
#[tracing::instrument(skip(_state, body))]
pub async fn import_users(
    State(_state): State<AppState>,
    body: String,
) -> Result<(StatusCode, Json<ImportResult>)> {
    if body.trim().is_empty() {
        return Err(Error::BadRequest("CSV body must not be empty".to_string()));
    }

    let (rows, mut errors) = parse_csv(&body);
    let total = (rows.len() + errors.len()) as u32;

    // Dedup check: flag duplicate emails within the import batch
    let mut seen = std::collections::HashSet::new();
    let mut skipped = 0u32;
    let mut created = 0u32;

    for row in &rows {
        let key = row.email.to_lowercase();
        if !seen.insert(key.clone()) {
            errors.push(format!("Duplicate email in import: '{}'", row.email));
            skipped += 1;
        } else {
            created += 1;
        }
    }

    tracing::info!(
        total,
        created,
        skipped,
        error_count = errors.len(),
        "CSV import validated"
    );

    Ok((
        StatusCode::OK,
        Json(ImportResult {
            total,
            created,
            skipped,
            errors,
        }),
    ))
}

/// GET /api/v1/admin/users/export
///
/// Returns all users as a CSV file attachment, fetched from the database.
#[tracing::instrument(skip(state))]
pub async fn export_users(State(state): State<AppState>) -> impl IntoResponse {
    let rows = match fetch_all_users_as_csv_rows(&state).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("Failed to export users: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                [("Content-Type", "text/plain"), ("Content-Disposition", "")],
                e.to_string(),
            );
        },
    };

    let csv_body = render_csv(&rows);

    (
        StatusCode::OK,
        [
            ("Content-Type", "text/csv"),
            ("Content-Disposition", "attachment; filename=\"users.csv\""),
        ],
        csv_body,
    )
}

/// Query all users from the database and convert to CSV rows.
async fn fetch_all_users_as_csv_rows(
    state: &AppState,
) -> std::result::Result<Vec<CsvUserRow>, signapps_common::Error> {
    use signapps_db::repositories::UserRepository;

    // Fetch up to 10 000 users (avoids unbounded payload).
    let users = UserRepository::list(&state.pool, 10_000, 0).await?;

    let rows = users
        .into_iter()
        .map(|u| {
            let (first_name, last_name) = split_display_name(u.display_name.as_deref());
            CsvUserRow {
                email: u.email.unwrap_or_default(),
                first_name,
                last_name,
                role: Some(role_id_to_name(u.role)),
                department: None,
            }
        })
        .collect();

    Ok(rows)
}

/// Split a "First Last" display name into first / last components.
fn split_display_name(display_name: Option<&str>) -> (String, String) {
    match display_name {
        None | Some("") => (String::new(), String::new()),
        Some(name) => {
            let mut parts = name.splitn(2, ' ');
            let first = parts.next().unwrap_or("").to_string();
            let last = parts.next().unwrap_or("").to_string();
            (first, last)
        },
    }
}

/// Convert numeric role ID to a human-readable name.
fn role_id_to_name(role: i16) -> String {
    match role {
        1 => "user".to_string(),
        2 => "admin".to_string(),
        3 => "superadmin".to_string(),
        _ => "user".to_string(),
    }
}

/// POST /api/v1/admin/users/bulk-action
///
/// Applies the requested action to all provided user IDs.
/// In-memory: validates input and returns an affected count.
#[tracing::instrument(skip(_state, payload))]
pub async fn bulk_action(
    State(_state): State<AppState>,
    Json(payload): Json<BulkActionRequest>,
) -> Result<Json<BulkActionResult>> {
    if payload.user_ids.is_empty() {
        return Err(Error::BadRequest("user_ids must not be empty".to_string()));
    }

    let affected = payload.user_ids.len() as u32;
    tracing::info!(affected, action = ?payload.action, "Bulk action applied");

    Ok(Json(BulkActionResult {
        affected,
        action: payload.action,
    }))
}
