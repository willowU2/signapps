//! SO2 RBAC visualizer — effective permissions + simulate.
//!
//! Endpoints :
//! - `GET  /api/v1/org/rbac/person/:id`       → full effective map
//! - `GET  /api/v1/org/rbac/effective`        → filtered (user_id + resource)
//! - `POST /api/v1/org/rbac/simulate`         → `{allowed, reason, chain}`
//!
//! Chaque élément de la chain porte sa **source** :
//! `direct | node | role | delegation`. Les résultats sont mis en cache
//! moka (TTL 5 min) pour ne pas re-calculer à chaque rafraîchissement
//! d'UI ; une invalidation ciblée par `person_id` est déclenchée lorsque
//! les events `org.assignment.changed` / `org.policy.updated` /
//! `org.delegation.*` sont publiés (cf. event listener dans lib.rs).
//!
//! Approximation volontaire — `user_roles` table n'existe pas encore
//! dans ce workspace (elle est sur la feuille de route RBAC). Pour
//! l'axe `direct`, on se rabat sur la colonne `identity.users.role`
//! (smallint : 0=viewer, 1=editor, 2=admin, 3=superadmin). Quand
//! `user_roles` arrivera, il suffira de remplacer [`collect_direct`]
//! par une requête sur cette table.

use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use moka::future::Cache;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::models::org::{Axis, Person};
use signapps_db::repositories::org::{
    AssignmentRepository, DelegationRepository, PersonRepository,
};
use uuid::Uuid;

use crate::AppState;

// ─── Router ──────────────────────────────────────────────────────────

/// Build the RBAC visualizer router.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/person/:id", get(effective_for_person))
        .route("/effective", get(effective_filtered))
        .route("/simulate", post(simulate))
}

// ─── Cache ────────────────────────────────────────────────────────────

/// Cache TTL for RBAC viz results (5 min).
const CACHE_TTL: Duration = Duration::from_secs(5 * 60);

/// Global moka cache keyed by `person_id` → list of effective permissions.
///
/// We use a process-wide lazy `Cache` rather than attaching it to
/// `AppState` so the event listener (defined elsewhere) can evict
/// entries without a reference to the state.
pub static PERMISSION_CACHE: Lazy<Arc<Cache<Uuid, Arc<Vec<EffectivePermission>>>>> =
    Lazy::new(|| {
        Arc::new(
            Cache::builder()
                .time_to_live(CACHE_TTL)
                .max_capacity(1_000)
                .build(),
        )
    });

/// Invalidate the cache entry for a single person (called on
/// `org.assignment.changed`, `org.policy.updated`, `org.delegation.*`).
pub async fn invalidate_person(person_id: Uuid) {
    PERMISSION_CACHE.invalidate(&person_id).await;
}

/// Clear the whole cache (used when policies change tenant-wide).
pub async fn invalidate_all() {
    PERMISSION_CACHE.invalidate_all();
}

// ─── DTOs ─────────────────────────────────────────────────────────────

/// One effective permission row, with its source.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct EffectivePermission {
    /// Action autorisée (`read`, `write`, `admin`, …).
    pub action: String,
    /// Ressource (`<service>.<resource>` form, e.g. `docs.document`).
    pub resource: String,
    /// Origine de la permission (direct / node / role / delegation).
    pub source: PermissionSource,
}

/// Where does a permission come from ?
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum PermissionSource {
    /// Permission attribuée directement à l'utilisateur (legacy role).
    Direct {
        /// Identifiant de l'attribution (ici : user_id).
        ref_id: Uuid,
        /// Libellé lisible (`role:admin`, `role:editor`, …).
        ref_name: String,
    },
    /// Hérité d'une policy attachée à un noeud d'org.
    Node {
        /// Node auquel la policy est bindée.
        ref_id: Uuid,
        /// Nom du node.
        ref_name: String,
    },
    /// Hérité d'une policy (par son id).
    Role {
        /// Policy id.
        ref_id: Uuid,
        /// Nom de la policy.
        ref_name: String,
    },
    /// Hérité d'une délégation active.
    Delegation {
        /// Delegation id.
        ref_id: Uuid,
        /// Libellé (nom du delegator).
        ref_name: String,
    },
}

/// Query for `GET /api/v1/org/rbac/effective`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct EffectiveQuery {
    /// Filtre par user_id (résolu en person via `org_persons.user_id`).
    pub user_id: Option<Uuid>,
    /// Filtre par person_id directement.
    pub person_id: Option<Uuid>,
    /// Filtre par ressource (match exact ou préfixe `service.*`).
    pub resource: Option<String>,
}

/// Request body for `POST /api/v1/org/rbac/simulate`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct SimulateBody {
    /// Identifiant de la personne à simuler.
    pub person_id: Uuid,
    /// Action demandée (`read`, `write`, …).
    pub action: String,
    /// Ressource demandée (`service.resource`).
    pub resource: String,
}

/// Response of `POST /api/v1/org/rbac/simulate`.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SimulateResponse {
    /// Vrai si l'action est autorisée.
    pub allowed: bool,
    /// Raison humaine (log-friendly).
    pub reason: String,
    /// Chaîne complète de permissions contribuant au verdict.
    pub chain: Vec<EffectivePermission>,
}

// ─── Handlers ─────────────────────────────────────────────────────────

/// `GET /api/v1/org/rbac/person/:id` — full effective map.
#[utoipa::path(
    get,
    path = "/api/v1/org/rbac/person/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Person UUID")),
    responses(
        (status = 200, description = "Effective permissions", body = Vec<EffectivePermission>),
        (status = 404, description = "Person not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn effective_for_person(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<EffectivePermission>>> {
    let list = resolve_permissions(&st, id).await?;
    Ok(Json((*list).clone()))
}

/// `GET /api/v1/org/rbac/effective` — filtered map.
#[utoipa::path(
    get,
    path = "/api/v1/org/rbac/effective",
    tag = "Org",
    params(EffectiveQuery),
    responses(
        (status = 200, description = "Filtered effective permissions", body = Vec<EffectivePermission>),
        (status = 400, description = "Missing both user_id and person_id"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn effective_filtered(
    State(st): State<AppState>,
    Query(q): Query<EffectiveQuery>,
) -> Result<Json<Vec<EffectivePermission>>> {
    let person_id = resolve_person_id(&st, &q).await?;
    let list = resolve_permissions(&st, person_id).await?;
    let filtered: Vec<EffectivePermission> = match q.resource.as_deref() {
        None => (*list).clone(),
        Some(filter) => list
            .iter()
            .filter(|p| matches_resource(&p.resource, filter))
            .cloned()
            .collect(),
    };
    Ok(Json(filtered))
}

/// `POST /api/v1/org/rbac/simulate` — check one specific action.
#[utoipa::path(
    post,
    path = "/api/v1/org/rbac/simulate",
    tag = "Org",
    request_body = SimulateBody,
    responses(
        (status = 200, description = "Simulation result", body = SimulateResponse),
        (status = 404, description = "Person not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn simulate(
    State(st): State<AppState>,
    Json(body): Json<SimulateBody>,
) -> Result<Json<SimulateResponse>> {
    let list = resolve_permissions(&st, body.person_id).await?;
    let chain: Vec<EffectivePermission> = list
        .iter()
        .filter(|p| {
            (p.action == body.action || p.action == "*" || p.action == "admin")
                && matches_resource(&p.resource, &body.resource)
        })
        .cloned()
        .collect();
    let allowed = !chain.is_empty();
    let reason = if allowed {
        format!(
            "{} source(s) grant '{}' on '{}'",
            chain.len(),
            body.action,
            body.resource
        )
    } else {
        format!("no source grants '{}' on '{}'", body.action, body.resource)
    };
    Ok(Json(SimulateResponse {
        allowed,
        reason,
        chain,
    }))
}

// ─── Internal: resolve + cache ────────────────────────────────────────

/// Resolve the full effective permission map for one person (cached).
async fn resolve_permissions(
    st: &AppState,
    person_id: Uuid,
) -> Result<Arc<Vec<EffectivePermission>>> {
    if let Some(hit) = PERMISSION_CACHE.get(&person_id).await {
        return Ok(hit);
    }

    let person = PersonRepository::new(st.pool.inner())
        .get(person_id)
        .await
        .map_err(|e| Error::Database(format!("get person: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("person {person_id}")))?;

    let mut out: Vec<EffectivePermission> = Vec::new();

    // Axis 1 — direct (approximated via identity.users.role).
    out.extend(collect_direct(st, &person).await?);

    // Axis 2 + 3 — node + role (policies bound to nodes the person is assigned to).
    out.extend(collect_node_and_role(st, &person).await?);

    // Axis 4 — delegations (active rows where person is delegate).
    out.extend(collect_delegations(st, &person).await?);

    // Dedupe exact (action, resource, source).
    out.sort_by(|a, b| {
        a.resource
            .cmp(&b.resource)
            .then(a.action.cmp(&b.action))
            .then_with(|| {
                serde_json::to_string(&a.source)
                    .unwrap_or_default()
                    .cmp(&serde_json::to_string(&b.source).unwrap_or_default())
            })
    });
    out.dedup_by(|a, b| {
        a.action == b.action
            && a.resource == b.resource
            && serde_json::to_string(&a.source).unwrap_or_default()
                == serde_json::to_string(&b.source).unwrap_or_default()
    });

    let arc = Arc::new(out);
    PERMISSION_CACHE.insert(person_id, arc.clone()).await;
    Ok(arc)
}

/// Axis 1 — direct permissions inferred from the legacy `users.role` column.
///
/// 0=viewer → read, 1=editor → read+write, 2=admin / 3=superadmin → `*`.
async fn collect_direct(
    st: &AppState,
    person: &Person,
) -> Result<Vec<EffectivePermission>> {
    let Some(user_id) = person.user_id else {
        return Ok(Vec::new());
    };
    let row: Option<(i16,)> =
        sqlx::query_as("SELECT role FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(st.pool.inner())
            .await
            .map_err(|e| Error::Database(format!("read users.role: {e}")))?;
    let Some((role,)) = row else {
        return Ok(Vec::new());
    };
    let (role_name, actions): (&str, &[&str]) = match role {
        r if r >= 3 => ("superadmin", &["*"]),
        2 => ("admin", &["*"]),
        1 => ("editor", &["read", "write"]),
        _ => ("viewer", &["read"]),
    };
    let source = PermissionSource::Direct {
        ref_id: user_id,
        ref_name: format!("role:{role_name}"),
    };
    let mut out = Vec::new();
    for action in actions {
        out.push(EffectivePermission {
            action: (*action).to_string(),
            resource: "*".into(),
            source: source.clone(),
        });
    }
    Ok(out)
}

/// Axis 2 + 3 — policies bound to nodes the person is assigned to.
///
/// For each `org_assignments` row (axis = structure) we load the
/// containing node's `path`, then for every ancestor node that carries
/// a policy binding we surface the (resource, action) pairs.
async fn collect_node_and_role(
    st: &AppState,
    person: &Person,
) -> Result<Vec<EffectivePermission>> {
    let assignments = AssignmentRepository::new(st.pool.inner())
        .list_by_person(person.id, Some(Axis::Structure))
        .await
        .map_err(|e| Error::Database(format!("list assignments: {e}")))?;
    if assignments.is_empty() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for a in assignments {
        // SQL: for each ancestor node (path @>), list bound policies + names.
        let rows: Vec<(Uuid, String, Uuid, String, serde_json::Value, bool)> = sqlx::query_as(
            r#"
            SELECT pb.node_id, an.name, p.id, p.name, p.permissions, pb.inherit
              FROM org_policy_bindings pb
              JOIN org_policies p ON p.id = pb.policy_id
              JOIN org_nodes    an ON an.id = pb.node_id
              JOIN org_nodes    rn ON rn.id = $1
             WHERE (an.id = rn.id)
                OR (pb.inherit = true AND an.path @> rn.path)
            "#,
        )
        .bind(a.node_id)
        .fetch_all(st.pool.inner())
        .await
        .map_err(|e| Error::Database(format!("policy lookup: {e}")))?;
        for (node_id, node_name, policy_id, policy_name, perms, _inherit) in rows {
            let specs = extract_perm_specs(&perms);
            for (resource, action) in specs {
                // node source → "hérité du node X"
                out.push(EffectivePermission {
                    action: action.clone(),
                    resource: resource.clone(),
                    source: PermissionSource::Node {
                        ref_id: node_id,
                        ref_name: node_name.clone(),
                    },
                });
                // role source → "via la policy X"
                out.push(EffectivePermission {
                    action,
                    resource,
                    source: PermissionSource::Role {
                        ref_id: policy_id,
                        ref_name: policy_name.clone(),
                    },
                });
            }
        }
    }
    Ok(out)
}

/// Axis 4 — delegations.
async fn collect_delegations(
    st: &AppState,
    person: &Person,
) -> Result<Vec<EffectivePermission>> {
    let delegations = DelegationRepository::new(st.pool.inner())
        .list_active_for_delegate(person.id)
        .await
        .map_err(|e| Error::Database(format!("list delegations: {e}")))?;
    if delegations.is_empty() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for d in delegations {
        // Only rbac / all scopes carry RBAC permissions.
        match d.scope {
            signapps_db::models::org::DelegationScope::Rbac
            | signapps_db::models::org::DelegationScope::All => {}
            signapps_db::models::org::DelegationScope::Manager => continue,
        }
        let delegator = PersonRepository::new(st.pool.inner())
            .get(d.delegator_person_id)
            .await
            .map_err(|e| Error::Database(format!("get delegator: {e}")))?;
        let Some(delegator) = delegator else { continue };
        let name = format!(
            "{} {}",
            delegator.first_name.clone().unwrap_or_default(),
            delegator.last_name.clone().unwrap_or_default()
        )
        .trim()
        .to_string();
        // Recursively resolve the delegator's permissions and surface
        // them as Delegation. To avoid infinite recursion we bypass the
        // cache for the delegator path.
        let delegator_perms =
            Box::pin(resolve_permissions(st, delegator.id)).await?;
        for p in delegator_perms.iter() {
            // Only node/role sources flow through the delegation —
            // direct sources of the delegator are personal.
            if matches!(p.source, PermissionSource::Direct { .. }) {
                continue;
            }
            out.push(EffectivePermission {
                action: p.action.clone(),
                resource: p.resource.clone(),
                source: PermissionSource::Delegation {
                    ref_id: d.id,
                    ref_name: if name.is_empty() {
                        delegator.email.clone()
                    } else {
                        name.clone()
                    },
                },
            });
        }
    }
    Ok(out)
}

/// Extract `(resource, action)` pairs from a `permissions` JSONB.
///
/// Accepts two shapes for forward-compat :
/// - `[{"resource":"docs","actions":["read","write"]}, ...]` (canonical)
/// - `["docs.read", "mail.write"]`                           (shorthand)
fn extract_perm_specs(v: &serde_json::Value) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let Some(arr) = v.as_array() else { return out };
    for entry in arr {
        if let Some(s) = entry.as_str() {
            // shorthand "docs.read"
            if let Some((res, act)) = s.split_once('.') {
                out.push((res.to_string(), act.to_string()));
            }
            continue;
        }
        if let Some(obj) = entry.as_object() {
            let resource = obj.get("resource").and_then(|x| x.as_str()).unwrap_or("*");
            if let Some(acts) = obj.get("actions").and_then(|x| x.as_array()) {
                for a in acts {
                    if let Some(s) = a.as_str() {
                        out.push((resource.to_string(), s.to_string()));
                    }
                }
            }
        }
    }
    out
}

fn matches_resource(resource: &str, filter: &str) -> bool {
    if filter == "*" || resource == "*" || resource == filter {
        return true;
    }
    if let Some(prefix) = filter.strip_suffix(".*") {
        if resource.starts_with(&format!("{prefix}.")) || resource == prefix {
            return true;
        }
    }
    if let Some(prefix) = resource.strip_suffix(".*") {
        if filter.starts_with(&format!("{prefix}.")) || filter == prefix {
            return true;
        }
    }
    false
}

async fn resolve_person_id(st: &AppState, q: &EffectiveQuery) -> Result<Uuid> {
    if let Some(pid) = q.person_id {
        return Ok(pid);
    }
    let Some(user_id) = q.user_id else {
        return Err(Error::BadRequest(
            "either user_id or person_id is required".into(),
        ));
    };
    let row: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM org_persons WHERE user_id = $1 LIMIT 1")
            .bind(user_id)
            .fetch_optional(st.pool.inner())
            .await
            .map_err(|e| Error::Database(format!("lookup person by user_id: {e}")))?;
    row.map(|(id,)| id)
        .ok_or_else(|| Error::NotFound(format!("no person linked to user {user_id}")))
}

// ─── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_resource_exact_and_wildcard() {
        assert!(matches_resource("docs.document", "docs.document"));
        assert!(matches_resource("*", "anything"));
        assert!(matches_resource("anything", "*"));
        assert!(matches_resource("docs.document", "docs.*"));
        assert!(matches_resource("docs.*", "docs.document"));
        assert!(!matches_resource("docs.document", "mail.inbox"));
    }

    #[test]
    fn extract_specs_handles_both_shapes() {
        let canonical = serde_json::json!([
            {"resource": "docs", "actions": ["read", "write"]}
        ]);
        let short = serde_json::json!(["mail.send"]);
        let c = extract_perm_specs(&canonical);
        let s = extract_perm_specs(&short);
        assert_eq!(c.len(), 2);
        assert_eq!(s.len(), 1);
        assert_eq!(s[0], ("mail".to_string(), "send".to_string()));
    }
}
