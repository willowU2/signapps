//! SO3 handlers for `/api/v1/org/templates`.
//!
//! Endpoints :
//! - `GET  /api/v1/org/templates?industry=X` — list public templates
//! - `GET  /api/v1/org/templates/:slug`      — detail (with spec_json)
//! - `POST /api/v1/org/templates/:slug/clone` — clone under a target node
//!
//! Events :
//! - `org.template.cloned` on clone (payload = {slug, target_node_id, node_ids, position_ids})

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::pg_events::NewEvent;
use signapps_common::{Error, Result};
use signapps_db::models::org::Template;
use signapps_db::repositories::org::{CloneOutcome, TemplateRepository};
use uuid::Uuid;

use crate::AppState;

/// Build the templates router (nested at `/api/v1/org/templates`).
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list))
        .route("/:slug", get(detail))
        .route("/:slug/clone", post(clone))
}

// ─── DTOs ───────────────────────────────────────────────────────────

/// Query params for `GET /api/v1/org/templates`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Optional industry filter (`saas`, `industrial`, `agency`, …).
    pub industry: Option<String>,
}

/// Request body for `POST /api/v1/org/templates/:slug/clone`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CloneBody {
    /// Tenant qui va recevoir les nouveaux nodes.
    pub tenant_id: Uuid,
    /// Parent node sous lequel cloner la hiérarchie du template.
    pub target_node_id: Uuid,
}

/// Response du clone.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct CloneResponse {
    /// Slug du template cloné.
    pub slug: String,
    /// Résultat détaillé (nodes + positions créés).
    #[serde(flatten)]
    pub outcome: CloneOutcome,
}

// ─── Handlers ───────────────────────────────────────────────────────

/// GET /api/v1/org/templates — list public templates.
#[utoipa::path(
    get,
    path = "/api/v1/org/templates",
    tag = "Org",
    params(ListQuery),
    responses(
        (status = 200, description = "Templates list", body = Vec<Template>),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Template>>> {
    let rows = TemplateRepository::new(st.pool.inner())
        .list_public(q.industry.as_deref())
        .await
        .map_err(|e| Error::Database(format!("list templates: {e}")))?;
    Ok(Json(rows))
}

/// GET /api/v1/org/templates/:slug — detail.
#[utoipa::path(
    get,
    path = "/api/v1/org/templates/{slug}",
    tag = "Org",
    params(("slug" = String, Path, description = "Template slug")),
    responses(
        (status = 200, description = "Template detail", body = Template),
        (status = 404, description = "Template not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn detail(
    State(st): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Template>> {
    TemplateRepository::new(st.pool.inner())
        .get_by_slug(&slug)
        .await
        .map_err(|e| Error::Database(format!("get template: {e}")))?
        .map(Json)
        .ok_or_else(|| Error::NotFound(format!("template {slug}")))
}

/// POST /api/v1/org/templates/:slug/clone — clone under target_node_id.
#[utoipa::path(
    post,
    path = "/api/v1/org/templates/{slug}/clone",
    tag = "Org",
    params(("slug" = String, Path, description = "Template slug")),
    request_body = CloneBody,
    responses(
        (status = 201, description = "Template cloned", body = CloneResponse),
        (status = 404, description = "Template or target node not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body), fields(slug=%slug))]
pub async fn clone(
    State(st): State<AppState>,
    Path(slug): Path<String>,
    Json(body): Json<CloneBody>,
) -> Result<(StatusCode, Json<CloneResponse>)> {
    let outcome = TemplateRepository::new(st.pool.inner())
        .clone_to_node(body.tenant_id, body.target_node_id, &slug)
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("not found") {
                Error::NotFound(msg)
            } else {
                Error::Database(format!("clone template: {msg}"))
            }
        })?;

    let node_ids: Vec<Uuid> = outcome.nodes.iter().map(|n| n.id).collect();
    let position_ids: Vec<Uuid> = outcome.positions.iter().map(|p| p.id).collect();
    let _ = st
        .event_bus
        .publish(NewEvent {
            event_type: "org.template.cloned".to_string(),
            aggregate_id: Some(body.target_node_id),
            payload: serde_json::json!({
                "slug": slug,
                "target_node_id": body.target_node_id,
                "node_ids": node_ids,
                "position_ids": position_ids,
            }),
        })
        .await;

    Ok((
        StatusCode::CREATED,
        Json(CloneResponse { slug, outcome }),
    ))
}
