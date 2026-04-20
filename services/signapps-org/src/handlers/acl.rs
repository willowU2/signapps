//! SO9 — CRUD handlers for `/api/v1/org/acl` + test endpoint.
//!
//! Exposes :
//! - `GET    /org/acl` → list with filters
//! - `POST   /org/acl` → create
//! - `DELETE /org/acl/:id` → delete
//! - `POST   /org/acl/test` → test endpoint returning allow/deny + matched
//!   rules (pour l'UI debug).
//!
//! Publie les events `org.acl.updated` sur le PgEventBus pour invalider
//! les caches ACL en aval (resolver moka 60 s).

use std::collections::HashSet;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post},
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::auth::Claims;
use signapps_common::pg_events::NewEvent;
use signapps_common::rbac::{
    AclAction as CommonAclAction, AclEffect as CommonAclEffect, AclEntry, AclSubjectCtx,
    AssignmentInheritance,
};
use signapps_common::{Error, Result};
use signapps_db::models::org::{Acl, AclEffect as DbAclEffect, AclSubjectType};
use signapps_db::repositories::org::{
    AclListFilters, AclRepository, NewAcl, ResourceAssignmentRepository,
};
use uuid::Uuid;

use crate::AppState;

/// Build the ACL router at `/api/v1/org/acl`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/test", post(test_rule))
        .route("/:id", delete(delete_acl))
}

// ─── DTOs ─────────────────────────────────────────────────────────────

/// Query for `GET /org/acl`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Tenant.
    pub tenant_id: Uuid,
    /// Filter par subject_type.
    pub subject_type: Option<String>,
    /// Filter par subject_id (person/group).
    pub subject_id: Option<Uuid>,
    /// Filter par resource_type.
    pub resource_type: Option<String>,
    /// Filter par resource_id.
    pub resource_id: Option<Uuid>,
    /// Filter par action.
    pub action: Option<String>,
}

/// Body for `POST /org/acl`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateAclBody {
    /// Tenant.
    pub tenant_id: Uuid,
    /// Subject type (`person`, `group`, `role`, `everyone`, `auth_user`).
    pub subject_type: String,
    /// Subject UUID (person/group only).
    pub subject_id: Option<Uuid>,
    /// Subject ref (role name).
    pub subject_ref: Option<String>,
    /// Action (e.g. `read`, `*`).
    pub action: String,
    /// Resource type (e.g. `resource`, `*`).
    pub resource_type: String,
    /// Resource UUID (None = wildcard).
    pub resource_id: Option<Uuid>,
    /// Effect (`allow` | `deny`).
    pub effect: String,
    /// Raison libre.
    pub reason: Option<String>,
    /// Début de validité.
    pub valid_from: Option<DateTime<Utc>>,
    /// Fin de validité.
    pub valid_until: Option<DateTime<Utc>>,
}

/// Body for `POST /org/acl/test`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct TestAclBody {
    /// Tenant.
    pub tenant_id: Uuid,
    /// Type de sujet à tester (`person` supporté principalement).
    pub subject_type: String,
    /// UUID du sujet.
    pub subject_id: Uuid,
    /// Action.
    pub action: String,
    /// Resource type.
    pub resource_type: String,
    /// Resource UUID (None = tester wildcard).
    pub resource_id: Option<Uuid>,
    /// Rôles globaux portés par le subject (pour matcher les ACLs `role`).
    #[serde(default)]
    pub roles: Vec<String>,
    /// Groupes auxquels le subject appartient.
    #[serde(default)]
    pub group_ids: Vec<Uuid>,
}

/// Matched rule flattened pour le front.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct MatchedRuleDto {
    /// Source (`acl` | `inherited_from_assignment` | `global_admin`).
    pub source: String,
    /// UUID ACL quand `source = "acl"`.
    pub acl_id: Option<Uuid>,
    /// Subject type de la règle ACL.
    pub subject_type: Option<String>,
    /// Rôle de l'assignment quand `source = "inherited_from_assignment"`.
    pub role: Option<String>,
    /// Effet (`allow` | `deny`).
    pub effect: String,
    /// Raison lisible.
    pub reason: String,
}

/// Response for `POST /org/acl/test`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct TestAclResponse {
    /// Résultat (`allow` | `deny`).
    pub effect: String,
    /// Source consolidée.
    pub source: String,
    /// Règles ACL matchées.
    pub matched_acls: Vec<MatchedRuleDto>,
    /// Règles inheritance matchées.
    pub inherited_reasons: Vec<MatchedRuleDto>,
}

// ─── Handlers ─────────────────────────────────────────────────────────

/// GET /org/acl — list with filters.
#[utoipa::path(
    get,
    path = "/api/v1/org/acl",
    tag = "Org ACL",
    params(ListQuery),
    responses((status = 200, description = "List", body = Vec<Acl>)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Acl>>> {
    let subject_type = match q.subject_type.as_deref() {
        Some(s) => Some(AclSubjectType::parse(s).map_err(Error::BadRequest)?),
        None => None,
    };
    let rows = AclRepository::new(st.pool.inner())
        .list(AclListFilters {
            tenant_id: q.tenant_id,
            subject_type,
            subject_id: q.subject_id,
            resource_type: q.resource_type,
            resource_id: q.resource_id,
            action: q.action,
        })
        .await
        .map_err(|e| Error::Database(format!("list acl: {e}")))?;
    Ok(Json(rows))
}

/// POST /org/acl — create.
#[utoipa::path(
    post,
    path = "/api/v1/org/acl",
    tag = "Org ACL",
    request_body = CreateAclBody,
    responses(
        (status = 201, description = "Created", body = Acl),
        (status = 400, description = "Invalid payload"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, claims, body))]
pub async fn create(
    State(st): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAclBody>,
) -> Result<(StatusCode, Json<Acl>)> {
    let subject_type = AclSubjectType::parse(&body.subject_type).map_err(Error::BadRequest)?;
    let effect = DbAclEffect::parse(&body.effect).map_err(Error::BadRequest)?;

    let row = AclRepository::new(st.pool.inner())
        .create(NewAcl {
            tenant_id: body.tenant_id,
            subject_type,
            subject_id: body.subject_id,
            subject_ref: body.subject_ref,
            action: body.action,
            resource_type: body.resource_type,
            resource_id: body.resource_id,
            effect,
            reason: body.reason,
            valid_from: body.valid_from,
            valid_until: body.valid_until,
            created_by_user_id: Some(claims.sub),
        })
        .await
        .map_err(|e| Error::BadRequest(format!("create acl: {e}")))?;

    if let Ok(payload) = serde_json::to_value(&row) {
        let _ = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.acl.updated".to_string(),
                aggregate_id: Some(row.id),
                payload,
            })
            .await;
    }

    Ok((StatusCode::CREATED, Json(row)))
}

/// DELETE /org/acl/:id — delete.
#[utoipa::path(
    delete,
    path = "/api/v1/org/acl/{id}",
    tag = "Org ACL",
    params(("id" = Uuid, Path, description = "ACL UUID")),
    responses(
        (status = 204, description = "Deleted"),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn delete_acl(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let removed = AclRepository::new(st.pool.inner())
        .delete(id)
        .await
        .map_err(|e| Error::Database(format!("delete acl: {e}")))?;
    if !removed {
        return Err(Error::NotFound(format!("acl {id}")));
    }
    let _ = st
        .event_bus
        .publish(NewEvent {
            event_type: "org.acl.updated".to_string(),
            aggregate_id: Some(id),
            payload: serde_json::json!({ "deleted": id }),
        })
        .await;
    Ok(StatusCode::NO_CONTENT)
}

/// POST /org/acl/test — tester une décision.
#[utoipa::path(
    post,
    path = "/api/v1/org/acl/test",
    tag = "Org ACL",
    request_body = TestAclBody,
    responses(
        (status = 200, description = "Test result", body = TestAclResponse),
        (status = 400, description = "Invalid payload"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn test_rule(
    State(st): State<AppState>,
    Json(body): Json<TestAclBody>,
) -> Result<Json<TestAclResponse>> {
    let action = CommonAclAction::parse(&body.action).map_err(Error::BadRequest)?;
    // subject_type est informatif — on supporte surtout 'person' côté test.
    if body.subject_type != "person" {
        return Err(Error::BadRequest(format!(
            "/acl/test only supports subject_type=person (got {})",
            body.subject_type
        )));
    }

    let acl_repo = AclRepository::new(st.pool.inner());
    let asg_repo = ResourceAssignmentRepository::new(st.pool.inner());

    let now = Utc::now();
    let db_acls = acl_repo
        .list_applicable(body.tenant_id, &body.resource_type, body.resource_id)
        .await
        .map_err(|e| Error::Database(format!("list applicable acls: {e}")))?;

    let entries: Vec<AclEntry> = db_acls
        .into_iter()
        .map(|a| AclEntry {
            id: a.id,
            subject_type: a.subject_type.as_str().to_string(),
            subject_id: a.subject_id,
            subject_ref: a.subject_ref.clone(),
            action: a.action.clone(),
            resource_type: a.resource_type.clone(),
            resource_id: a.resource_id,
            effect: match a.effect {
                DbAclEffect::Allow => CommonAclEffect::Allow,
                DbAclEffect::Deny => CommonAclEffect::Deny,
            },
            reason: a.reason.clone(),
            is_valid: a.is_valid_at(now),
        })
        .collect();

    // Inherit from resource assignments when we have a precise resource_id.
    let inheritance: Vec<AssignmentInheritance> = match body.resource_id {
        Some(rid) => asg_repo
            .list_active_for_resource(rid)
            .await
            .map_err(|e| Error::Database(format!("list assignments: {e}")))?
            .into_iter()
            .map(|a| AssignmentInheritance {
                role: a.role.as_str().to_string(),
                subject_type: a.subject_type.as_str().to_string(),
                subject_id: a.subject_id,
            })
            .collect(),
        None => Vec::new(),
    };

    let ctx = AclSubjectCtx {
        person_id: Some(body.subject_id),
        tenant_id: body.tenant_id,
        roles: body.roles,
        group_ids: body.group_ids,
        is_global_admin: false,
    };

    // Deduplicate matched ACL ids to make the output stable.
    let mut seen_acl_ids: HashSet<Uuid> = HashSet::new();

    let decision = signapps_common::rbac::resolve_acl(
        &ctx,
        action,
        &body.resource_type,
        body.resource_id,
        &entries,
        &inheritance,
    );

    let mut matched_acls = Vec::new();
    let mut inherited_reasons = Vec::new();

    for rule in &decision.matched {
        let dto = match &rule.source {
            signapps_common::rbac::RuleSource::Acl { id, subject_type } => MatchedRuleDto {
                source: "acl".into(),
                acl_id: Some(*id),
                subject_type: Some(subject_type.clone()),
                role: None,
                effect: if rule.effect == CommonAclEffect::Allow {
                    "allow".into()
                } else {
                    "deny".into()
                },
                reason: rule.reason.clone(),
            },
            signapps_common::rbac::RuleSource::InheritedFromAssignment { role } => {
                MatchedRuleDto {
                    source: "inherited_from_assignment".into(),
                    acl_id: None,
                    subject_type: None,
                    role: Some(role.clone()),
                    effect: if rule.effect == CommonAclEffect::Allow {
                        "allow".into()
                    } else {
                        "deny".into()
                    },
                    reason: rule.reason.clone(),
                }
            }
            signapps_common::rbac::RuleSource::GlobalAdmin => MatchedRuleDto {
                source: "global_admin".into(),
                acl_id: None,
                subject_type: None,
                role: None,
                effect: "allow".into(),
                reason: rule.reason.clone(),
            },
        };
        match rule.source {
            signapps_common::rbac::RuleSource::Acl { id, .. } => {
                if seen_acl_ids.insert(id) {
                    matched_acls.push(dto);
                }
            }
            signapps_common::rbac::RuleSource::InheritedFromAssignment { .. } => {
                inherited_reasons.push(dto);
            }
            signapps_common::rbac::RuleSource::GlobalAdmin => matched_acls.push(dto),
        }
    }

    Ok(Json(TestAclResponse {
        effect: if decision.allow { "allow".into() } else { "deny".into() },
        source: decision.source.to_string(),
        matched_acls,
        inherited_reasons,
    }))
}
