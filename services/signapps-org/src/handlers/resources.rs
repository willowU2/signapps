//! SO8 handlers for the canonical resources catalog.
//!
//! Surface (all under `/api/v1` prefix — paths below are service-local):
//!
//! - `GET    /org/resources?tenant_id=X&kind=Y&status=Z&assigned_to_person_id=&assigned_to_node_id=&primary_site_id=`
//! - `GET    /org/resources/:id`
//! - `POST   /org/resources`
//! - `PUT    /org/resources/:id`
//! - `DELETE /org/resources/:id` (soft-archive)
//! - `POST   /org/resources/:id/status` body `{to, reason?}`
//! - `GET    /org/resources/:id/history`
//! - `POST   /org/resources/:id/qr/rotate`
//! - `GET    /org/resources/counts?tenant_id=X`
//!
//! User-facing (authenticated, role >= 0):
//! - `GET    /me/inventory`
//!
//! Public (no auth, exempted from auth middleware):
//! - `GET    /public/resource/:qr_token` → 302 redirect vers UI admin.
//!
//! QR token = hex 16 chars = `hex(hmac_sha256(keystore.dek("qr-v1"),
//! resource.id.as_bytes())[..8])`.
//!
//! Le QR est régénérable (`POST /:id/qr/rotate`) mais la fonction pure
//! donne toujours le même résultat pour un id donné — le rotate change
//! donc uniquement si on veut repartir d'un nouveau id logique
//! (ici : rotate recalcule depuis id courant pour cohérence).

use axum::{
    extract::{Path, Query, State},
    http::{header::LOCATION, StatusCode},
    response::Response,
    routing::{get, post},
    Extension, Json, Router,
};
use chrono::NaiveDate;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use signapps_common::auth::Claims;
use signapps_common::{Error, Result};
use signapps_db::models::org::{
    Resource, ResourceKind, ResourceStatus, ResourceStatusLog,
};
use signapps_db::repositories::org::{
    NewResource, ResourceListFilters, ResourceRepository, ResourceUpdate,
};
use signapps_keystore::Keystore;
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;

type HmacSha256 = Hmac<Sha256>;

/// Derive the QR token from the resource id using the keystore DEK.
///
/// Returns 16 hex chars (8 bytes = 64 bits of entropy). Deterministic:
/// same id + same DEK → same token. This is stable across rotations
/// unless the master key changes.
///
/// # Panics
///
/// Panics only if the HMAC init fails on a zero-length key — the DEK is
/// always 32 bytes so this never happens in practice.
#[must_use]
pub fn derive_qr_token(keystore: &Arc<Keystore>, resource_id: Uuid) -> String {
    let dek = keystore.dek("qr-v1");
    let mut mac = HmacSha256::new_from_slice(dek.expose_bytes())
        .expect("HMAC accepts any key length");
    mac.update(resource_id.as_bytes());
    let out = mac.finalize().into_bytes();
    hex::encode(&out[..8])
}

// ─── Mount ────────────────────────────────────────────────────────────

/// Mount the resources admin router at `/api/v1/org/resources`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/counts", get(counts))
        .route("/:id", get(get_one).put(update).delete(archive))
        .route("/:id/status", post(transition))
        .route("/:id/history", get(history))
        .route("/:id/qr/rotate", post(rotate_qr))
}

/// Mount the authenticated-user router at `/api/v1/me/inventory`.
///
/// This handler requires an authenticated user (role >= 0) but is NOT
/// admin-restricted — any employee can see their own inventory.
pub fn me_routes() -> Router<AppState> {
    Router::new().route("/", get(my_inventory))
}

/// Mount the public QR redirect at `/public/resource/:qr_token`.
///
/// No auth required — exempted from the auth middleware upstream.
pub fn public_routes() -> Router<AppState> {
    Router::new().route("/:qr_token", get(public_redirect))
}

// ─── DTOs ─────────────────────────────────────────────────────────────

/// Query parameters for `GET /org/resources`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Tenant (required — pas de scan cross-tenant).
    pub tenant_id: Uuid,
    /// Optional kind (snake_case: `it_device`, `vehicle`, …).
    pub kind: Option<String>,
    /// Optional status (`ordered`, `active`, `loaned`, …).
    pub status: Option<String>,
    /// Filter by person.
    pub assigned_to_person_id: Option<Uuid>,
    /// Filter by node.
    pub assigned_to_node_id: Option<Uuid>,
    /// Filter by site.
    pub primary_site_id: Option<Uuid>,
    /// Include archived rows (default false).
    #[serde(default)]
    pub include_archived: bool,
}

/// Query parameters for `GET /org/resources/counts`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct CountsQuery {
    /// Tenant (required).
    pub tenant_id: Uuid,
}

/// Body for `POST /org/resources`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateBody {
    /// Tenant.
    pub tenant_id: Uuid,
    /// Taxonomie fermée.
    pub kind: String,
    /// Slug unique (tenant-scoped).
    pub slug: String,
    /// Libellé.
    pub name: String,
    /// Description optionnelle.
    pub description: Option<String>,
    /// Numéro de série / référence.
    pub serial_or_ref: Option<String>,
    /// Attributs JSONB (spécifique par kind).
    #[serde(default)]
    pub attributes: serde_json::Value,
    /// Statut initial (défaut `active`).
    pub status: Option<String>,
    /// Assignation initiale (mutuel exclusif avec `assigned_to_node_id`).
    pub assigned_to_person_id: Option<Uuid>,
    /// Assignation à un node.
    pub assigned_to_node_id: Option<Uuid>,
    /// Site physique.
    pub primary_site_id: Option<Uuid>,
    /// Date d'achat (ISO date).
    pub purchase_date: Option<NaiveDate>,
    /// Coût en centimes.
    pub purchase_cost_cents: Option<i64>,
    /// Devise ISO 4217 (défaut EUR).
    pub currency: Option<String>,
    /// Durée d'amortissement.
    pub amortization_months: Option<i32>,
    /// Fin de garantie.
    pub warranty_end_date: Option<NaiveDate>,
    /// Prochaine maintenance.
    pub next_maintenance_date: Option<NaiveDate>,
    /// URL photo hero (SO9).
    pub photo_url: Option<String>,
    /// Type de l'identifiant primaire (SO9).
    pub primary_identifier_type: Option<String>,
}

/// Body for `PUT /org/resources/:id`.
///
/// Tous les champs sont optionnels — `null` explicite vide le champ ;
/// `undefined` (absence) = pas touché.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateBody {
    /// Libellé.
    pub name: Option<String>,
    /// Description (double option : présent mais null = clear).
    #[serde(default, deserialize_with = "deserialize_optional_option")]
    pub description: Option<Option<String>>,
    /// Serial.
    #[serde(default, deserialize_with = "deserialize_optional_option")]
    pub serial_or_ref: Option<Option<String>>,
    /// Attributs (remplace).
    pub attributes: Option<serde_json::Value>,
    /// Personne assignée.
    #[serde(default, deserialize_with = "deserialize_optional_option")]
    pub assigned_to_person_id: Option<Option<Uuid>>,
    /// Node assigné.
    #[serde(default, deserialize_with = "deserialize_optional_option")]
    pub assigned_to_node_id: Option<Option<Uuid>>,
    /// Site.
    #[serde(default, deserialize_with = "deserialize_optional_option")]
    pub primary_site_id: Option<Option<Uuid>>,
    /// Date d'achat.
    #[serde(default, deserialize_with = "deserialize_optional_option")]
    pub purchase_date: Option<Option<NaiveDate>>,
    /// Coût en centimes.
    #[serde(default, deserialize_with = "deserialize_optional_option")]
    pub purchase_cost_cents: Option<Option<i64>>,
    /// Devise.
    #[serde(default, deserialize_with = "deserialize_optional_option")]
    pub currency: Option<Option<String>>,
    /// Amortissement.
    #[serde(default, deserialize_with = "deserialize_optional_option")]
    pub amortization_months: Option<Option<i32>>,
    /// Garantie.
    #[serde(default, deserialize_with = "deserialize_optional_option")]
    pub warranty_end_date: Option<Option<NaiveDate>>,
    /// Prochaine maintenance.
    #[serde(default, deserialize_with = "deserialize_optional_option")]
    pub next_maintenance_date: Option<Option<NaiveDate>>,
    /// URL photo hero (SO9).
    #[serde(default, deserialize_with = "deserialize_optional_option")]
    pub photo_url: Option<Option<String>>,
    /// Type de l'identifiant primaire (SO9).
    pub primary_identifier_type: Option<String>,
}

/// Custom deserializer: `None` field absent, `Some(None)` JSON null,
/// `Some(Some(value))` provided.
fn deserialize_optional_option<'de, T, D>(deserializer: D) -> std::result::Result<Option<Option<T>>, D::Error>
where
    T: serde::Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

/// Body for `POST /org/resources/:id/status`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct TransitionBody {
    /// État cible.
    pub to: String,
    /// Motif optionnel.
    pub reason: Option<String>,
}

/// Response for `GET /org/resources/counts`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct CountsResponse {
    /// (kind, count) pairs, sorted by kind.
    pub buckets: Vec<KindCount>,
    /// Total non-archivé.
    pub total: i64,
}

/// One kind-count bucket.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct KindCount {
    /// `it_device`, `vehicle`, …
    pub kind: String,
    /// Nombre de rows.
    pub count: i64,
}

/// Response for `GET /me/inventory`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct InventoryResponse {
    /// Resources groupées par kind.
    pub by_kind: Vec<InventoryBucket>,
    /// Total non-archivé.
    pub total: i64,
}

/// One group of resources for `/me/inventory`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct InventoryBucket {
    /// Kind snake_case.
    pub kind: String,
    /// Resources assignées à l'user.
    pub resources: Vec<Resource>,
}

// ─── Handlers ─────────────────────────────────────────────────────────

/// GET /org/resources — list filtered resources.
#[utoipa::path(
    get,
    path = "/api/v1/org/resources",
    tag = "Org Resources",
    params(ListQuery),
    responses((status = 200, description = "Resources", body = Vec<Resource>)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Resource>>> {
    let kind = match q.kind.as_deref() {
        Some(k) => Some(ResourceKind::parse(k).map_err(Error::BadRequest)?),
        None => None,
    };
    let status = match q.status.as_deref() {
        Some(s) => Some(ResourceStatus::parse(s).map_err(Error::BadRequest)?),
        None => None,
    };
    let rows = ResourceRepository::new(st.pool.inner())
        .list(ResourceListFilters {
            tenant_id: q.tenant_id,
            kind,
            status,
            assigned_to_person_id: q.assigned_to_person_id,
            assigned_to_node_id: q.assigned_to_node_id,
            primary_site_id: q.primary_site_id,
            include_archived: q.include_archived,
        })
        .await
        .map_err(|e| Error::Database(format!("list resources: {e}")))?;
    Ok(Json(rows))
}

/// GET /org/resources/counts — counts by kind.
#[utoipa::path(
    get,
    path = "/api/v1/org/resources/counts",
    tag = "Org Resources",
    params(CountsQuery),
    responses((status = 200, description = "Counts", body = CountsResponse)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn counts(
    State(st): State<AppState>,
    Query(q): Query<CountsQuery>,
) -> Result<Json<CountsResponse>> {
    let rows = ResourceRepository::new(st.pool.inner())
        .count_by_kind(q.tenant_id)
        .await
        .map_err(|e| Error::Database(format!("counts resources: {e}")))?;
    let total = rows.iter().map(|(_, c)| c).sum();
    let buckets = rows
        .into_iter()
        .map(|(kind, count)| KindCount { kind, count })
        .collect();
    Ok(Json(CountsResponse { buckets, total }))
}

/// GET /org/resources/:id — single row.
#[utoipa::path(
    get,
    path = "/api/v1/org/resources/{id}",
    tag = "Org Resources",
    params(("id" = Uuid, Path, description = "Resource UUID")),
    responses(
        (status = 200, description = "Resource", body = Resource),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn get_one(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Resource>> {
    let row = ResourceRepository::new(st.pool.inner())
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get resource: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("resource {id}")))?;
    Ok(Json(row))
}

/// POST /org/resources — create a new resource, auto-generate QR token.
#[utoipa::path(
    post,
    path = "/api/v1/org/resources",
    tag = "Org Resources",
    request_body = CreateBody,
    responses(
        (status = 201, description = "Created", body = Resource),
        (status = 400, description = "Bad input"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, claims, body))]
pub async fn create(
    State(st): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBody>,
) -> Result<(StatusCode, Json<Resource>)> {
    let kind = ResourceKind::parse(&body.kind).map_err(Error::BadRequest)?;
    let status = match body.status.as_deref() {
        Some(s) => ResourceStatus::parse(s).map_err(Error::BadRequest)?,
        None => ResourceStatus::Active,
    };

    if body.assigned_to_person_id.is_some() && body.assigned_to_node_id.is_some() {
        return Err(Error::BadRequest(
            "assigned_to_person_id and assigned_to_node_id are mutually exclusive".into(),
        ));
    }

    let repo = ResourceRepository::new(st.pool.inner());
    let created = repo
        .create(
            NewResource {
                tenant_id: body.tenant_id,
                kind,
                slug: body.slug,
                name: body.name,
                description: body.description,
                serial_or_ref: body.serial_or_ref,
                attributes: if body.attributes.is_null() {
                    serde_json::json!({})
                } else {
                    body.attributes
                },
                status,
                assigned_to_person_id: body.assigned_to_person_id,
                assigned_to_node_id: body.assigned_to_node_id,
                primary_site_id: body.primary_site_id,
                purchase_date: body.purchase_date,
                purchase_cost_cents: body.purchase_cost_cents,
                currency: body.currency.or_else(|| Some("EUR".to_string())),
                amortization_months: body.amortization_months,
                warranty_end_date: body.warranty_end_date,
                next_maintenance_date: body.next_maintenance_date,
                qr_token: None,
                photo_url: body.photo_url.clone(),
                primary_identifier_type: body.primary_identifier_type.clone(),
            },
            Some(claims.sub),
        )
        .await
        .map_err(|e| Error::Database(format!("create resource: {e}")))?;

    // Derive and persist QR token from the new id.
    let token = derive_qr_token(&st.keystore, created.id);
    let withqr = repo
        .set_qr_token(created.id, &token)
        .await
        .map_err(|e| Error::Database(format!("set qr token: {e}")))?
        .unwrap_or(created);

    Ok((StatusCode::CREATED, Json(withqr)))
}

/// PUT /org/resources/:id — partial update.
#[utoipa::path(
    put,
    path = "/api/v1/org/resources/{id}",
    tag = "Org Resources",
    params(("id" = Uuid, Path, description = "Resource UUID")),
    request_body = UpdateBody,
    responses(
        (status = 200, description = "Updated", body = Resource),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn update(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateBody>,
) -> Result<Json<Resource>> {
    let patch = ResourceUpdate {
        name: body.name,
        description: body.description,
        serial_or_ref: body.serial_or_ref,
        attributes: body.attributes,
        assigned_to_person_id: body.assigned_to_person_id,
        assigned_to_node_id: body.assigned_to_node_id,
        primary_site_id: body.primary_site_id,
        purchase_date: body.purchase_date,
        purchase_cost_cents: body.purchase_cost_cents,
        currency: body.currency,
        amortization_months: body.amortization_months,
        warranty_end_date: body.warranty_end_date,
        next_maintenance_date: body.next_maintenance_date,
        photo_url: body.photo_url,
        primary_identifier_type: body.primary_identifier_type,
    };

    let row = ResourceRepository::new(st.pool.inner())
        .update(id, patch)
        .await
        .map_err(|e| Error::Database(format!("update resource: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("resource {id}")))?;
    Ok(Json(row))
}

/// DELETE /org/resources/:id — soft archive.
#[utoipa::path(
    delete,
    path = "/api/v1/org/resources/{id}",
    tag = "Org Resources",
    params(("id" = Uuid, Path, description = "Resource UUID")),
    responses(
        (status = 204, description = "Archived"),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn archive(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let ok = ResourceRepository::new(st.pool.inner())
        .archive(id)
        .await
        .map_err(|e| Error::Database(format!("archive resource: {e}")))?;
    if !ok {
        return Err(Error::NotFound(format!("resource {id}")));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// POST /org/resources/:id/status — state machine transition.
#[utoipa::path(
    post,
    path = "/api/v1/org/resources/{id}/status",
    tag = "Org Resources",
    params(("id" = Uuid, Path, description = "Resource UUID")),
    request_body = TransitionBody,
    responses(
        (status = 200, description = "Transitioned", body = Resource),
        (status = 400, description = "Invalid transition"),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, claims, body))]
pub async fn transition(
    State(st): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<TransitionBody>,
) -> Result<Json<Resource>> {
    let to = ResourceStatus::parse(&body.to).map_err(Error::BadRequest)?;

    let repo = ResourceRepository::new(st.pool.inner());
    let existing = repo
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get resource: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("resource {id}")))?;
    let from = existing.status;

    if !from.can_transition_to(to) {
        return Err(Error::BadRequest(format!(
            "invalid transition {} -> {}",
            from.as_str(),
            to.as_str()
        )));
    }

    let updated = repo
        .transition(id, from, to, Some(claims.sub), body.reason)
        .await
        .map_err(|e| Error::Database(format!("transition: {e}")))?
        .ok_or_else(|| {
            Error::BadRequest(
                "state changed concurrently — retry with latest status".into(),
            )
        })?;
    Ok(Json(updated))
}

/// GET /org/resources/:id/history — status transitions log.
#[utoipa::path(
    get,
    path = "/api/v1/org/resources/{id}/history",
    tag = "Org Resources",
    params(("id" = Uuid, Path, description = "Resource UUID")),
    responses((status = 200, description = "History", body = Vec<ResourceStatusLog>)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn history(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ResourceStatusLog>>> {
    let rows = ResourceRepository::new(st.pool.inner())
        .list_status_log(id)
        .await
        .map_err(|e| Error::Database(format!("list status log: {e}")))?;
    Ok(Json(rows))
}

/// POST /org/resources/:id/qr/rotate — re-derive the QR token.
///
/// Le token est déterministe à partir du `resource.id` + DEK, donc il ne
/// change pas vraiment (sauf si la master key change). Ce endpoint sert
/// de "reset" si jamais le token a été copié en dur quelque part et
/// qu'on veut s'assurer qu'il est à jour.
#[utoipa::path(
    post,
    path = "/api/v1/org/resources/{id}/qr/rotate",
    tag = "Org Resources",
    params(("id" = Uuid, Path, description = "Resource UUID")),
    responses(
        (status = 200, description = "Rotated", body = Resource),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn rotate_qr(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Resource>> {
    let repo = ResourceRepository::new(st.pool.inner());
    let existing = repo
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get resource: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("resource {id}")))?;
    let token = derive_qr_token(&st.keystore, existing.id);
    let updated = repo
        .set_qr_token(existing.id, &token)
        .await
        .map_err(|e| Error::Database(format!("rotate qr: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("resource {id}")))?;
    Ok(Json(updated))
}

/// GET /me/inventory — resources assigned to the current user's person_id.
///
/// Requires auth (any role). If the user has no `person_id` on their
/// claims, the response is an empty inventory (not a 401).
#[utoipa::path(
    get,
    path = "/api/v1/me/inventory",
    tag = "My Inventory",
    responses((status = 200, description = "Inventory", body = InventoryResponse)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, claims))]
pub async fn my_inventory(
    State(st): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<InventoryResponse>> {
    let Some(person_id) = claims.person_id else {
        return Ok(Json(InventoryResponse {
            by_kind: Vec::new(),
            total: 0,
        }));
    };
    let rows = ResourceRepository::new(st.pool.inner())
        .list_by_person(person_id)
        .await
        .map_err(|e| Error::Database(format!("my inventory: {e}")))?;
    let total = i64::try_from(rows.len()).unwrap_or(i64::MAX);

    // Group by kind preserving ordering (the repo already orders by kind, name).
    let mut by_kind: Vec<InventoryBucket> = Vec::new();
    for r in rows {
        if let Some(last) = by_kind.last_mut() {
            if last.kind == r.kind.as_str() {
                last.resources.push(r);
                continue;
            }
        }
        by_kind.push(InventoryBucket {
            kind: r.kind.as_str().to_string(),
            resources: vec![r],
        });
    }
    Ok(Json(InventoryResponse { by_kind, total }))
}

/// GET /public/resource/:qr_token — 302 redirect to `/admin/resources/:id`.
///
/// No auth required. If token is unknown or archived, returns 404.
/// The response is a plain redirect so that a mobile browser scanning
/// the QR lands directly on the admin UI (or login page if not signed
/// in).
#[tracing::instrument(skip(st))]
pub async fn public_redirect(
    State(st): State<AppState>,
    Path(qr_token): Path<String>,
) -> std::result::Result<Response, Error> {
    // Sanity : 16 hex chars.
    if qr_token.len() != 16 || !qr_token.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(Error::BadRequest("invalid qr token format".into()));
    }

    let row = ResourceRepository::new(st.pool.inner())
        .get_by_qr_token(&qr_token)
        .await
        .map_err(|e| Error::Database(format!("qr lookup: {e}")))?
        .ok_or_else(|| Error::NotFound("resource not found".into()))?;

    tracing::info!(resource_id = %row.id, "qr scan");

    let target = format!("/admin/resources/{}", row.id);
    Response::builder()
        .status(StatusCode::FOUND)
        .header(LOCATION, target)
        .body(axum::body::Body::empty())
        .map_err(|e| Error::Internal(format!("build redirect: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use signapps_keystore::KeystoreBackend;

    #[tokio::test]
    async fn qr_token_is_16_hex_chars() {
        std::env::set_var("SO8_TEST_MASTER_KEY", "0".repeat(64));
        let ks = Arc::new(
            Keystore::init(KeystoreBackend::EnvVarNamed("SO8_TEST_MASTER_KEY".into()))
                .await
                .expect("init ks"),
        );
        let id = Uuid::new_v4();
        let t = derive_qr_token(&ks, id);
        assert_eq!(t.len(), 16, "token must be 16 hex chars, got {t}");
        assert!(t.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[tokio::test]
    async fn qr_token_is_deterministic() {
        std::env::set_var("SO8_TEST_MASTER_KEY_2", "a".repeat(64));
        let ks = Arc::new(
            Keystore::init(KeystoreBackend::EnvVarNamed(
                "SO8_TEST_MASTER_KEY_2".into(),
            ))
            .await
            .expect("init ks"),
        );
        let id = Uuid::new_v4();
        let t1 = derive_qr_token(&ks, id);
        let t2 = derive_qr_token(&ks, id);
        assert_eq!(t1, t2);
    }

    #[tokio::test]
    async fn qr_token_different_for_different_ids() {
        std::env::set_var("SO8_TEST_MASTER_KEY_3", "b".repeat(64));
        let ks = Arc::new(
            Keystore::init(KeystoreBackend::EnvVarNamed(
                "SO8_TEST_MASTER_KEY_3".into(),
            ))
            .await
            .expect("init ks"),
        );
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        assert_ne!(derive_qr_token(&ks, a), derive_qr_token(&ks, b));
    }
}
