//! SO6 handlers for `/api/v1/org/panel-layouts` — DetailPanel refonte.
//!
//! Endpoints :
//! - `GET    /api/v1/org/panel-layouts?role=X&entity_type=Y` → custom ou default
//! - `PUT    /api/v1/org/panel-layouts/:role/:entity_type`   → upsert (admin only)
//! - `POST   /api/v1/org/panel-layouts/:role/:entity_type/reset` → delete custom
//! - `GET    /api/v1/org/panel-layouts/metrics?metric=X&entity_id=Y&entity_type=Z`
//!
//! Le champ `config` est validé par désérialisation en
//! [`PanelLayoutConfig`] avant insertion. Les erreurs de parsing
//! retournent un `400 Bad Request` RFC 7807.

use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use signapps_db::models::org::{
    PanelEntityType, PanelLayout, PanelLayoutConfig, PanelRole,
};
use signapps_db::repositories::org::{default_layout, PanelLayoutRepository};
use uuid::Uuid;

use crate::AppState;

/// Build the panel-layouts router (nested at `/api/v1/org/panel-layouts`).
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(get_layout))
        .route("/metrics", get(get_metric))
        .route("/:role/:entity_type", put(upsert_layout))
        .route("/:role/:entity_type/reset", post(reset_layout))
}

// ─── DTOs ───────────────────────────────────────────────────────────

/// Query params for `GET /api/v1/org/panel-layouts`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct LayoutQuery {
    /// Role cible (admin | manager | viewer).
    pub role: String,
    /// Type d'entité (node | person).
    pub entity_type: String,
}

/// Response of `GET /api/v1/org/panel-layouts`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct LayoutResponse {
    /// `true` si config custom stockée en DB, `false` si default hardcoded.
    pub is_custom: bool,
    /// Layout effectif (custom ou default).
    pub config: PanelLayoutConfig,
    /// Row sous-jacent (None si default).
    pub row: Option<PanelLayout>,
}

/// Request body for `PUT /api/v1/org/panel-layouts/:role/:entity_type`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpsertLayoutBody {
    /// Config validée côté serveur avant insertion.
    pub config: PanelLayoutConfig,
}

/// Query params for `GET /api/v1/org/panel-layouts/metrics`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct MetricQuery {
    /// Identifiant du KPI builtin (headcount | positions_open | raci_count | …).
    pub metric: String,
    /// UUID de l'entité cible (node ou person selon le KPI).
    pub entity_id: Uuid,
    /// Type de l'entité cible. Default : `node`.
    #[serde(default)]
    pub entity_type: Option<String>,
}

/// Response of `GET /api/v1/org/panel-layouts/metrics`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct MetricResponse {
    /// Valeur numérique du KPI (cast en i64 pour transport JSON).
    pub value: i64,
    /// Libellé localisable (FR par défaut).
    pub label: String,
    /// Tendance optionnelle sur N périodes ("+3", "-1", "=").
    pub trend: Option<String>,
}

// ─── Helpers ────────────────────────────────────────────────────────

fn parse_role(raw: &str) -> Result<PanelRole> {
    PanelRole::parse(raw).map_err(|e| Error::BadRequest(format!("role invalide : {e}")))
}

fn parse_entity_type(raw: &str) -> Result<PanelEntityType> {
    PanelEntityType::parse(raw)
        .map_err(|e| Error::BadRequest(format!("entity_type invalide : {e}")))
}

fn tenant_id_from_claims(claims: &Claims) -> Result<Uuid> {
    claims
        .tenant_id
        .ok_or_else(|| Error::BadRequest("tenant_id manquant dans le JWT".into()))
}

// ─── Handlers ───────────────────────────────────────────────────────

/// `GET /api/v1/org/panel-layouts` — lookup custom layout or fall back on default.
///
/// Tous les users authentifiés peuvent lire leur layout effectif.
#[utoipa::path(
    get,
    path = "/api/v1/org/panel-layouts",
    tag = "Org",
    params(LayoutQuery),
    responses(
        (status = 200, description = "Effective layout", body = LayoutResponse),
        (status = 400, description = "Invalid role or entity_type"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, claims))]
pub async fn get_layout(
    State(st): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<LayoutQuery>,
) -> Result<Json<LayoutResponse>> {
    let tenant_id = tenant_id_from_claims(&claims)?;
    let role = parse_role(&q.role)?;
    let entity_type = parse_entity_type(&q.entity_type)?;

    let repo = PanelLayoutRepository::new(st.pool.inner());
    let row = repo
        .get(tenant_id, role, entity_type)
        .await
        .map_err(|e| Error::Database(format!("panel layout get: {e}")))?;

    match row {
        Some(r) => {
            let cfg: PanelLayoutConfig = serde_json::from_value(r.config.clone())
                .unwrap_or_else(|err| {
                    tracing::warn!(
                        ?err,
                        layout_id = %r.id,
                        "invalid panel layout config in DB, falling back to default"
                    );
                    default_layout(role, entity_type)
                });
            Ok(Json(LayoutResponse {
                is_custom: true,
                config: cfg,
                row: Some(r),
            }))
        },
        None => Ok(Json(LayoutResponse {
            is_custom: false,
            config: default_layout(role, entity_type),
            row: None,
        })),
    }
}

/// `PUT /api/v1/org/panel-layouts/:role/:entity_type` — upsert (admin only).
///
/// Le role effectif du user doit être `admin` (role >= 2 dans le JWT).
#[utoipa::path(
    put,
    path = "/api/v1/org/panel-layouts/{role}/{entity_type}",
    tag = "Org",
    params(
        ("role" = String, Path, description = "admin|manager|viewer"),
        ("entity_type" = String, Path, description = "node|person"),
    ),
    request_body = UpsertLayoutBody,
    responses(
        (status = 200, description = "Layout upserted", body = PanelLayout),
        (status = 400, description = "Invalid role, entity_type or config"),
        (status = 403, description = "Admin role required"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, claims, body))]
pub async fn upsert_layout(
    State(st): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((role_raw, entity_type_raw)): Path<(String, String)>,
    Json(body): Json<UpsertLayoutBody>,
) -> Result<Json<PanelLayout>> {
    // Admin-only (role >= 2 per identity.users.role mapping).
    if claims.role < 2 {
        return Err(Error::Forbidden(
            "panel layout edition réservée aux admins".into(),
        ));
    }
    let tenant_id = tenant_id_from_claims(&claims)?;
    let role = parse_role(&role_raw)?;
    let entity_type = parse_entity_type(&entity_type_raw)?;
    let updater = Some(claims.sub);

    // Re-serialize to JSONB-ready Value to guarantee round-trip with the schema.
    let config_value = serde_json::to_value(&body.config)
        .map_err(|e| Error::BadRequest(format!("config non sérialisable : {e}")))?;

    let row = PanelLayoutRepository::new(st.pool.inner())
        .upsert(tenant_id, role, entity_type, config_value, updater)
        .await
        .map_err(|e| Error::Database(format!("panel layout upsert: {e}")))?;
    Ok(Json(row))
}

/// `POST /api/v1/org/panel-layouts/:role/:entity_type/reset` — delete custom row.
#[utoipa::path(
    post,
    path = "/api/v1/org/panel-layouts/{role}/{entity_type}/reset",
    tag = "Org",
    params(
        ("role" = String, Path, description = "admin|manager|viewer"),
        ("entity_type" = String, Path, description = "node|person"),
    ),
    responses(
        (status = 200, description = "Row deleted if any — next fetch returns default"),
        (status = 403, description = "Admin role required"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, claims))]
pub async fn reset_layout(
    State(st): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((role_raw, entity_type_raw)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>> {
    if claims.role < 2 {
        return Err(Error::Forbidden(
            "panel layout reset réservée aux admins".into(),
        ));
    }
    let tenant_id = tenant_id_from_claims(&claims)?;
    let role = parse_role(&role_raw)?;
    let entity_type = parse_entity_type(&entity_type_raw)?;

    let deleted = PanelLayoutRepository::new(st.pool.inner())
        .delete(tenant_id, role, entity_type)
        .await
        .map_err(|e| Error::Database(format!("panel layout reset: {e}")))?;

    Ok(Json(serde_json::json!({
        "deleted": deleted,
        "default": default_layout(role, entity_type),
    })))
}

/// `GET /api/v1/org/panel-layouts/metrics` — fetch a builtin KPI value.
///
/// Supporte les metrics builtin :
/// - `headcount` : count de persons assignées sur le node (axis = structure).
/// - `positions_open` : count de positions actives dont head_count > incumbents.
/// - `raci_count` : count de lignes RACI pour le node (project).
/// - `delegations_active` : count de délégations actives pour le node.
/// - `audit_events_week` : count audit_log sur 7 jours glissants.
/// - `assignments_active` : count d'affectations actives pour la person.
/// - `skills_top` : count de skills (level >= 3) pour la person.
#[utoipa::path(
    get,
    path = "/api/v1/org/panel-layouts/metrics",
    tag = "Org",
    params(MetricQuery),
    responses(
        (status = 200, description = "KPI value", body = MetricResponse),
        (status = 400, description = "Unknown metric"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, claims))]
pub async fn get_metric(
    State(st): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<MetricQuery>,
) -> Result<Json<MetricResponse>> {
    let tenant_id = tenant_id_from_claims(&claims)?;
    let pool = st.pool.inner();
    let entity_type = q
        .entity_type
        .as_deref()
        .map(parse_entity_type)
        .transpose()?
        .unwrap_or(PanelEntityType::Node);

    let (value, label) = match q.metric.as_str() {
        "headcount" => {
            let n: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM org_assignments
                 WHERE tenant_id = $1 AND node_id = $2 AND ended_at IS NULL",
            )
            .bind(tenant_id)
            .bind(q.entity_id)
            .fetch_one(pool)
            .await
            .map_err(|e| Error::Database(format!("headcount metric: {e}")))?;
            (n, "Effectif".to_string())
        },
        "positions_open" => {
            let n: i64 = sqlx::query_scalar(
                "SELECT COALESCE(SUM(GREATEST(p.head_count - COALESCE(oc.n, 0), 0))::BIGINT, 0)
                 FROM org_positions p
                 LEFT JOIN (
                     SELECT position_id, COUNT(*) AS n
                     FROM org_position_incumbents
                     WHERE end_date IS NULL
                     GROUP BY position_id
                 ) oc ON oc.position_id = p.id
                 WHERE p.tenant_id = $1 AND p.node_id = $2 AND p.active = TRUE",
            )
            .bind(tenant_id)
            .bind(q.entity_id)
            .fetch_one(pool)
            .await
            .map_err(|e| Error::Database(format!("positions_open metric: {e}")))?;
            (n, "Postes ouverts".to_string())
        },
        "raci_count" => {
            let n: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM org_raci
                 WHERE tenant_id = $1 AND project_id = $2",
            )
            .bind(tenant_id)
            .bind(q.entity_id)
            .fetch_one(pool)
            .await
            .map_err(|e| Error::Database(format!("raci_count metric: {e}")))?;
            (n, "Projets RACI".to_string())
        },
        "delegations_active" => {
            let n: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM org_delegations
                 WHERE tenant_id = $1 AND node_id = $2 AND active = TRUE",
            )
            .bind(tenant_id)
            .bind(q.entity_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);
            (n, "Délégations actives".to_string())
        },
        "audit_events_week" => {
            let n: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM org_audit_log
                 WHERE tenant_id = $1 AND entity_id = $2
                   AND changed_at > NOW() - INTERVAL '7 days'",
            )
            .bind(tenant_id)
            .bind(q.entity_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);
            (n, "Évènements 7j".to_string())
        },
        "assignments_active" if matches!(entity_type, PanelEntityType::Person) => {
            let n: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM org_assignments
                 WHERE tenant_id = $1 AND person_id = $2 AND ended_at IS NULL",
            )
            .bind(tenant_id)
            .bind(q.entity_id)
            .fetch_one(pool)
            .await
            .map_err(|e| Error::Database(format!("assignments_active metric: {e}")))?;
            (n, "Affectations actives".to_string())
        },
        "skills_top" if matches!(entity_type, PanelEntityType::Person) => {
            let n: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM org_person_skills
                 WHERE person_id = $1 AND level >= 3",
            )
            .bind(q.entity_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);
            (n, "Compétences fortes".to_string())
        },
        "permissions_level" if matches!(entity_type, PanelEntityType::Person) => {
            // Best-effort: count explicit role-bindings pointing at this person.
            let n: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM org_policy_bindings
                 WHERE tenant_id = $1 AND person_id = $2",
            )
            .bind(tenant_id)
            .bind(q.entity_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);
            (n, "Permissions".to_string())
        },
        other => {
            return Err(Error::BadRequest(format!("metric inconnu : {other}")));
        },
    };

    Ok(Json(MetricResponse {
        value,
        label,
        trend: None,
    }))
}
