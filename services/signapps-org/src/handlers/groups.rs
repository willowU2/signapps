//! SO7 handlers for `/api/v1/org/groups` — groupes transverses.
//!
//! Endpoints :
//! - `GET    /api/v1/org/groups?tenant_id=X&kind=Y`
//! - `GET    /api/v1/org/groups/:id`
//! - `GET    /api/v1/org/groups/:id/members` — résolu selon kind
//! - `POST   /api/v1/org/groups`
//! - `PUT    /api/v1/org/groups/:id`
//! - `DELETE /api/v1/org/groups/:id` (soft-delete, archived = true)
//! - `POST   /api/v1/org/groups/:id/members` (add include/exclude)
//! - `DELETE /api/v1/org/groups/:id/members/:person_id`

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::models::org::{
    GroupKind, MembershipKind, OrgGroup, OrgGroupMember, Person,
};
use signapps_db::repositories::org::GroupRepository;
use uuid::Uuid;

use crate::groups::RuleMatcher;
use crate::AppState;

/// Mount the groups router at `/api/v1/org/groups`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/:id", get(get_one).put(update).delete(archive))
        .route("/:id/members", get(members).post(add_member))
        .route("/:id/members/:person_id", axum::routing::delete(remove_member))
}

// ─── DTOs ─────────────────────────────────────────────────────────────

/// Query for `GET /api/v1/org/groups`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Tenant UUID.
    pub tenant_id: Uuid,
    /// Optional kind filter (`static` | `dynamic` | `hybrid` | `derived`).
    pub kind: Option<String>,
}

/// Body for `POST /api/v1/org/groups`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateBody {
    /// Tenant.
    pub tenant_id: Uuid,
    /// Slug unique.
    pub slug: String,
    /// Libellé.
    pub name: String,
    /// Description optionnelle.
    pub description: Option<String>,
    /// Kind.
    pub kind: String,
    /// Règle DSL (dynamic / hybrid).
    pub rule_json: Option<serde_json::Value>,
    /// Node source (derived seulement).
    pub source_node_id: Option<Uuid>,
    /// Métadonnées.
    #[serde(default)]
    pub attributes: serde_json::Value,
}

/// Body for `PUT /api/v1/org/groups/:id`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateBody {
    /// Nouveau libellé.
    pub name: String,
    /// Description (null pour supprimer).
    pub description: Option<String>,
    /// Règle DSL.
    pub rule_json: Option<serde_json::Value>,
    /// Node source.
    pub source_node_id: Option<Uuid>,
    /// Métadonnées.
    #[serde(default)]
    pub attributes: serde_json::Value,
}

/// Body for `POST /api/v1/org/groups/:id/members`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct AddMemberBody {
    /// Personne à inclure ou exclure.
    pub person_id: Uuid,
    /// `include` (défaut) ou `exclude`.
    #[serde(default = "default_include")]
    pub kind: String,
}

fn default_include() -> String {
    "include".to_string()
}

/// Response for `GET /api/v1/org/groups/:id/members`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct MembersResponse {
    /// Group id.
    pub group_id: Uuid,
    /// Kind (static | dynamic | hybrid | derived).
    pub kind: String,
    /// Resolved persons (empty for unknown / archived groups).
    pub persons: Vec<Person>,
    /// Explicit include/exclude rows (only populated for hybrid and static).
    pub memberships: Vec<OrgGroupMember>,
}

// ─── Handlers ─────────────────────────────────────────────────────────

/// GET /api/v1/org/groups
#[utoipa::path(
    get,
    path = "/api/v1/org/groups",
    tag = "Org Groups",
    params(ListQuery),
    responses((status = 200, description = "Groups", body = Vec<OrgGroup>)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<OrgGroup>>> {
    let kind = match q.kind.as_deref() {
        Some(k) => Some(GroupKind::parse(k).map_err(Error::BadRequest)?),
        None => None,
    };
    let rows = GroupRepository::new(st.pool.inner())
        .list_by_tenant(q.tenant_id, kind)
        .await
        .map_err(|e| Error::Database(format!("list groups: {e}")))?;
    Ok(Json(rows))
}

/// GET /api/v1/org/groups/:id
#[utoipa::path(
    get,
    path = "/api/v1/org/groups/{id}",
    tag = "Org Groups",
    params(("id" = Uuid, Path, description = "Group UUID")),
    responses(
        (status = 200, description = "Group", body = OrgGroup),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn get_one(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<OrgGroup>> {
    let row = GroupRepository::new(st.pool.inner())
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get group: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("group {id}")))?;
    Ok(Json(row))
}

/// POST /api/v1/org/groups
#[utoipa::path(
    post,
    path = "/api/v1/org/groups",
    tag = "Org Groups",
    request_body = CreateBody,
    responses(
        (status = 201, description = "Created", body = OrgGroup),
        (status = 400, description = "Bad request"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn create(
    State(st): State<AppState>,
    Json(body): Json<CreateBody>,
) -> Result<(StatusCode, Json<OrgGroup>)> {
    let kind = GroupKind::parse(&body.kind).map_err(Error::BadRequest)?;
    let row = GroupRepository::new(st.pool.inner())
        .create(
            body.tenant_id,
            &body.slug,
            &body.name,
            body.description.as_deref(),
            kind,
            body.rule_json,
            body.source_node_id,
            body.attributes,
            None,
        )
        .await
        .map_err(|e| Error::Database(format!("create group: {e}")))?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// PUT /api/v1/org/groups/:id
#[utoipa::path(
    put,
    path = "/api/v1/org/groups/{id}",
    tag = "Org Groups",
    params(("id" = Uuid, Path, description = "Group UUID")),
    request_body = UpdateBody,
    responses(
        (status = 200, description = "Updated", body = OrgGroup),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn update(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateBody>,
) -> Result<Json<OrgGroup>> {
    let row = GroupRepository::new(st.pool.inner())
        .update(
            id,
            &body.name,
            body.description.as_deref(),
            body.rule_json,
            body.source_node_id,
            body.attributes,
        )
        .await
        .map_err(|e| Error::Database(format!("update group: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("group {id}")))?;
    Ok(Json(row))
}

/// DELETE /api/v1/org/groups/:id — soft-delete.
#[utoipa::path(
    delete,
    path = "/api/v1/org/groups/{id}",
    tag = "Org Groups",
    params(("id" = Uuid, Path, description = "Group UUID")),
    responses(
        (status = 204, description = "Archived"),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn archive(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let ok = GroupRepository::new(st.pool.inner())
        .archive(id)
        .await
        .map_err(|e| Error::Database(format!("archive group: {e}")))?;
    if !ok {
        return Err(Error::NotFound(format!("group {id}")));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/org/groups/:id/members — resolved persons.
#[utoipa::path(
    get,
    path = "/api/v1/org/groups/{id}/members",
    tag = "Org Groups",
    params(("id" = Uuid, Path, description = "Group UUID")),
    responses(
        (status = 200, description = "Members", body = MembersResponse),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn members(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<MembersResponse>> {
    let repo = GroupRepository::new(st.pool.inner());
    let group = repo
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get group: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("group {id}")))?;

    let persons = match group.kind {
        GroupKind::Static => repo
            .resolve_static(id)
            .await
            .map_err(|e| Error::Database(format!("resolve static: {e}")))?,
        GroupKind::Dynamic => {
            let rule = group
                .rule_json
                .clone()
                .unwrap_or_else(|| serde_json::json!({}));
            let matcher = RuleMatcher::from_json(&rule);
            matcher
                .execute(st.pool.inner(), group.tenant_id)
                .await
                .map_err(|e| Error::Database(format!("matcher execute: {e}")))?
        },
        GroupKind::Hybrid => resolve_hybrid(&st, &group).await?,
        GroupKind::Derived => repo
            .resolve_derived(&group)
            .await
            .map_err(|e| Error::Database(format!("resolve derived: {e}")))?,
    };

    let memberships = repo
        .list_members(id)
        .await
        .map_err(|e| Error::Database(format!("list members: {e}")))?;

    Ok(Json(MembersResponse {
        group_id: id,
        kind: group.kind.as_str().to_string(),
        persons,
        memberships,
    }))
}

/// Hybrid resolution : matcher ∪ includes − excludes.
async fn resolve_hybrid(st: &AppState, group: &OrgGroup) -> Result<Vec<Person>> {
    let repo = GroupRepository::new(st.pool.inner());
    let rule = group
        .rule_json
        .clone()
        .unwrap_or_else(|| serde_json::json!({}));
    let matcher = RuleMatcher::from_json(&rule);
    let mut base: Vec<Person> = matcher
        .execute(st.pool.inner(), group.tenant_id)
        .await
        .map_err(|e| Error::Database(format!("matcher execute: {e}")))?;
    let includes: Vec<Uuid> = repo
        .list_includes(group.id)
        .await
        .map_err(|e| Error::Database(format!("list includes: {e}")))?;
    let excludes: Vec<Uuid> = repo
        .list_excludes(group.id)
        .await
        .map_err(|e| Error::Database(format!("list excludes: {e}")))?;

    // Union with explicitly included persons (fetch them in a single query).
    if !includes.is_empty() {
        let include_persons: Vec<Person> = sqlx::query_as::<_, Person>(
            "SELECT * FROM org_persons WHERE id = ANY($1) AND active",
        )
        .bind(&includes)
        .fetch_all(st.pool.inner())
        .await
        .map_err(|e| Error::Database(format!("fetch included persons: {e}")))?;
        for p in include_persons {
            if !base.iter().any(|x| x.id == p.id) {
                base.push(p);
            }
        }
    }

    // Apply exclusions.
    if !excludes.is_empty() {
        base.retain(|p| !excludes.contains(&p.id));
    }

    base.sort_by(|a, b| {
        let an = a.first_name.as_deref().unwrap_or_default();
        let bn = b.first_name.as_deref().unwrap_or_default();
        an.cmp(bn)
    });
    Ok(base)
}

/// POST /api/v1/org/groups/:id/members — add include OR exclude.
#[utoipa::path(
    post,
    path = "/api/v1/org/groups/{id}/members",
    tag = "Org Groups",
    params(("id" = Uuid, Path, description = "Group UUID")),
    request_body = AddMemberBody,
    responses(
        (status = 201, description = "Added", body = OrgGroupMember),
        (status = 400, description = "Bad kind"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn add_member(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<AddMemberBody>,
) -> Result<(StatusCode, Json<OrgGroupMember>)> {
    let kind = match body.kind.as_str() {
        "include" => MembershipKind::Include,
        "exclude" => MembershipKind::Exclude,
        other => return Err(Error::BadRequest(format!("unknown kind: {other}"))),
    };
    let row = GroupRepository::new(st.pool.inner())
        .upsert_member(id, body.person_id, kind)
        .await
        .map_err(|e| Error::Database(format!("upsert member: {e}")))?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// DELETE /api/v1/org/groups/:id/members/:person_id
#[utoipa::path(
    delete,
    path = "/api/v1/org/groups/{id}/members/{person_id}",
    tag = "Org Groups",
    params(
        ("id" = Uuid, Path, description = "Group UUID"),
        ("person_id" = Uuid, Path, description = "Person UUID"),
    ),
    responses(
        (status = 204, description = "Removed"),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn remove_member(
    State(st): State<AppState>,
    Path((id, person_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode> {
    let ok = GroupRepository::new(st.pool.inner())
        .remove_member(id, person_id)
        .await
        .map_err(|e| Error::Database(format!("remove member: {e}")))?;
    if !ok {
        return Err(Error::NotFound(format!(
            "membership {id}/{person_id}"
        )));
    }
    Ok(StatusCode::NO_CONTENT)
}
