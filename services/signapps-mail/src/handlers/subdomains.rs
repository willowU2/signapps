//! Service subdomain management handlers.
//!
//! Tracks which subdomains are assigned to which SignApps services for each
//! mail domain. For example, `mail.advicetech.fr` routes to signapps-mail
//! (port 3012), while `calendar.advicetech.fr` routes to signapps-calendar
//! (port 3011).
//!
//! Default subdomains are created automatically when a new domain is added:
//! `mail`, `calendar`, `meet`, `chat`, `drive`, `autoconfig`.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// A service subdomain assignment.
///
/// Maps a subdomain (e.g. `mail`) under a domain (e.g. `advicetech.fr`) to
/// a specific SignApps service (e.g. `signapps-mail` on port 3012).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct ServiceSubdomain {
    /// Unique identifier.
    pub id: Uuid,
    /// Parent domain ID.
    pub domain_id: Uuid,
    /// Subdomain label (e.g. `mail`, `calendar`, `meet`).
    pub subdomain: String,
    /// Service name (e.g. `signapps-mail`, `signapps-calendar`).
    pub service_name: String,
    /// Service port (e.g. 3012, 3011).
    pub service_port: i32,
    /// DNS record type (`A`, `CNAME`, `SRV`).
    pub record_type: String,
    /// DNS record target (resolved value).
    pub target: Option<String>,
    /// Whether the subdomain is active.
    pub is_active: Option<bool>,
    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
}

/// Request to create a service subdomain assignment.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateSubdomainRequest {
    /// Subdomain label (e.g. `mail`, `calendar`).
    pub subdomain: String,
    /// Service name (e.g. `signapps-mail`).
    pub service_name: String,
    /// Service port (e.g. 3012).
    pub service_port: i32,
    /// DNS record type (default: `CNAME`).
    pub record_type: Option<String>,
    /// DNS record target.
    pub target: Option<String>,
}

/// Default subdomain assignments for a new domain.
///
/// Returns the standard set of service subdomains that should be created
/// when a new mail domain is provisioned.
///
/// # Panics
///
/// None.
pub fn default_subdomains() -> Vec<(&'static str, &'static str, i32, &'static str)> {
    vec![
        ("mail", "signapps-mail", 3012, "A"),
        ("calendar", "signapps-calendar", 3011, "CNAME"),
        ("meet", "signapps-meet", 3014, "CNAME"),
        ("chat", "signapps-chat", 3020, "CNAME"),
        ("drive", "signapps-storage", 3004, "CNAME"),
        ("autoconfig", "signapps-mail", 3012, "CNAME"),
    ]
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List service subdomains for a domain.
///
/// # Errors
///
/// Returns 404 if the domain is not found. Returns 500 on database failure.
///
/// # Panics
///
/// None.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/domains/{id}/subdomains",
    tag = "mailserver-subdomains",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Domain ID")),
    responses(
        (status = 200, description = "List of service subdomains", body = Vec<ServiceSubdomain>),
        (status = 404, description = "Domain not found"),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip(state), fields(domain_id = %domain_id))]
pub async fn list_subdomains(
    State(state): State<AppState>,
    Path(domain_id): Path<Uuid>,
) -> impl IntoResponse {
    // Verify domain exists
    let domain_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM mailserver.domains WHERE id = $1)")
            .bind(domain_id)
            .fetch_one(&state.pool)
            .await
            .unwrap_or(false);

    if !domain_exists {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Domain not found" })),
        )
            .into_response();
    }

    match sqlx::query_as::<_, ServiceSubdomain>(
        "SELECT id, domain_id, subdomain, service_name, service_port, \
         record_type, target, is_active, created_at \
         FROM mailserver.service_subdomains \
         WHERE domain_id = $1 \
         ORDER BY subdomain",
    )
    .bind(domain_id)
    .fetch_all(&state.pool)
    .await
    {
        Ok(subdomains) => Json(serde_json::json!({ "subdomains": subdomains })).into_response(),
        Err(e) => {
            tracing::error!("Failed to list subdomains: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to list subdomains" })),
            )
                .into_response()
        },
    }
}

/// Create a service subdomain assignment.
///
/// # Errors
///
/// Returns 400 if the subdomain already exists for this domain.
/// Returns 404 if the domain is not found.
/// Returns 500 on database failure.
///
/// # Panics
///
/// None.
#[utoipa::path(
    post,
    path = "/api/v1/mailserver/domains/{id}/subdomains",
    tag = "mailserver-subdomains",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Domain ID")),
    request_body = CreateSubdomainRequest,
    responses(
        (status = 201, description = "Subdomain created", body = ServiceSubdomain),
        (status = 400, description = "Subdomain already exists"),
        (status = 404, description = "Domain not found"),
        (status = 500, description = "Internal server error"),
    )
)]
#[tracing::instrument(skip(state), fields(domain_id = %domain_id, subdomain = %payload.subdomain))]
pub async fn create_subdomain(
    State(state): State<AppState>,
    Path(domain_id): Path<Uuid>,
    Json(payload): Json<CreateSubdomainRequest>,
) -> impl IntoResponse {
    // Verify domain exists
    let domain_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM mailserver.domains WHERE id = $1)")
            .bind(domain_id)
            .fetch_one(&state.pool)
            .await
            .unwrap_or(false);

    if !domain_exists {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Domain not found" })),
        )
            .into_response();
    }

    let record_type = payload.record_type.unwrap_or_else(|| "CNAME".to_string());

    match sqlx::query_as::<_, ServiceSubdomain>(
        r#"INSERT INTO mailserver.service_subdomains
               (domain_id, subdomain, service_name, service_port, record_type, target)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, domain_id, subdomain, service_name, service_port,
                     record_type, target, is_active, created_at"#,
    )
    .bind(domain_id)
    .bind(&payload.subdomain)
    .bind(&payload.service_name)
    .bind(payload.service_port)
    .bind(&record_type)
    .bind(&payload.target)
    .fetch_one(&state.pool)
    .await
    {
        Ok(subdomain) => (StatusCode::CREATED, Json(subdomain)).into_response(),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("duplicate") || msg.contains("unique") {
                (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({
                        "error": format!("Subdomain '{}' already exists for this domain", payload.subdomain)
                    })),
                )
                    .into_response()
            } else {
                tracing::error!("Failed to create subdomain: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({ "error": "Failed to create subdomain" })),
                )
                    .into_response()
            }
        },
    }
}

/// Delete a service subdomain assignment.
///
/// # Errors
///
/// Returns 404 if the subdomain is not found.
///
/// # Panics
///
/// None.
#[utoipa::path(
    delete,
    path = "/api/v1/mailserver/domains/{id}/subdomains/{sub_id}",
    tag = "mailserver-subdomains",
    security(("bearerAuth" = [])),
    params(
        ("id" = Uuid, Path, description = "Domain ID"),
        ("sub_id" = Uuid, Path, description = "Subdomain ID"),
    ),
    responses(
        (status = 200, description = "Subdomain deleted"),
        (status = 404, description = "Subdomain not found"),
    )
)]
#[tracing::instrument(skip(state), fields(domain_id = %ids.0, subdomain_id = %ids.1))]
pub async fn delete_subdomain(
    State(state): State<AppState>,
    Path(ids): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    let (domain_id, sub_id) = ids;

    match sqlx::query(
        "DELETE FROM mailserver.service_subdomains WHERE id = $1 AND domain_id = $2 RETURNING id",
    )
    .bind(sub_id)
    .bind(domain_id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(_)) => Json(serde_json::json!({ "success": true })).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Subdomain not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to delete subdomain: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to delete subdomain" })),
            )
                .into_response()
        },
    }
}

/// Create default service subdomain assignments for a domain.
///
/// Called internally after a domain is created. Inserts the standard set
/// of subdomain mappings (mail, calendar, meet, chat, drive, autoconfig).
///
/// # Errors
///
/// Returns `Err` on database failure.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(pool), fields(domain_id = %domain_id, domain_name = %domain_name))]
pub async fn create_default_subdomains(
    pool: &sqlx::Pool<sqlx::Postgres>,
    domain_id: Uuid,
    domain_name: &str,
) -> Result<Vec<ServiceSubdomain>, sqlx::Error> {
    let mut created = Vec::new();

    for (subdomain, service_name, port, rec_type) in default_subdomains() {
        // Build target: for A records it's the server IP, for CNAME it's mail.domain
        let target = if rec_type == "A" {
            std::env::var("MAIL_SERVER_IP").unwrap_or_else(|_| "127.0.0.1".to_string())
        } else {
            format!("mail.{}", domain_name)
        };

        let row = sqlx::query_as::<_, ServiceSubdomain>(
            r#"INSERT INTO mailserver.service_subdomains
                   (domain_id, subdomain, service_name, service_port, record_type, target)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (domain_id, subdomain) DO NOTHING
               RETURNING id, domain_id, subdomain, service_name, service_port,
                         record_type, target, is_active, created_at"#,
        )
        .bind(domain_id)
        .bind(subdomain)
        .bind(service_name)
        .bind(port)
        .bind(rec_type)
        .bind(&target)
        .fetch_optional(pool)
        .await?;

        if let Some(row) = row {
            created.push(row);
        }
    }

    tracing::info!(
        domain = %domain_name,
        count = created.len(),
        "Default service subdomains created"
    );
    Ok(created)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_subdomains_count() {
        let defaults = default_subdomains();
        assert_eq!(defaults.len(), 6);
    }

    #[test]
    fn test_default_subdomains_contain_mail() {
        let defaults = default_subdomains();
        assert!(defaults.iter().any(|(sub, _, _, _)| *sub == "mail"));
    }

    #[test]
    fn test_default_subdomains_contain_calendar() {
        let defaults = default_subdomains();
        assert!(defaults.iter().any(|(sub, _, _, _)| *sub == "calendar"));
    }

    #[test]
    fn test_default_subdomains_contain_meet() {
        let defaults = default_subdomains();
        assert!(defaults.iter().any(|(sub, _, _, _)| *sub == "meet"));
    }

    #[test]
    fn test_default_subdomains_unique() {
        let defaults = default_subdomains();
        let names: Vec<&str> = defaults.iter().map(|(s, _, _, _)| *s).collect();
        let mut unique = names.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(
            names.len(),
            unique.len(),
            "Duplicate subdomain names detected"
        );
    }

    #[test]
    fn test_service_subdomain_serialization() {
        let sub = ServiceSubdomain {
            id: Uuid::new_v4(),
            domain_id: Uuid::new_v4(),
            subdomain: "mail".to_string(),
            service_name: "signapps-mail".to_string(),
            service_port: 3012,
            record_type: "A".to_string(),
            target: Some("127.0.0.1".to_string()),
            is_active: Some(true),
            created_at: None,
        };
        let json = serde_json::to_string(&sub).expect("serialization must succeed");
        assert!(json.contains("signapps-mail"));
        assert!(json.contains("3012"));
    }
}
