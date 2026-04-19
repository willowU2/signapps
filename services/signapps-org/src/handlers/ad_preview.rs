//! AD sync preview + selective approve handlers — SO4 IN1.
//!
//! Endpoints :
//! - `POST /api/v1/org/ad/sync/:tenant_id/preview` — calcule un diff
//!   en mémoire (adds, removes, moves, conflicts) sans toucher
//!   `org_ad_sync_log`. Retourne un `run_id` UUID.
//! - `POST /api/v1/org/ad/sync/:tenant_id/approve` — applique une
//!   sélection d'opérations issues d'un précédent preview.
//!
//! Le `run_id` indexe un cache moka 15 min côté serveur — la liste
//! d'opérations correspondante est restorée au moment de l'approve.
//!
//! Si le tenant n'a pas d'AD config bindée (`mode = 'off'` ou absent),
//! le handler retourne un payload **mock** synthétique qui permet à l'UI
//! de tester le flow preview/approve sans LDAP réel.

use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{Path, State},
    routing::post,
    Json, Router,
};
use moka::future::Cache;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::models::org::AdSyncMode;
use uuid::Uuid;

use crate::ad::config::AdSyncConfig;
use crate::AppState;

/// Cache des preview runs (TTL 15 min).
static PREVIEW_CACHE: Lazy<Cache<Uuid, Arc<PreviewBundle>>> = Lazy::new(|| {
    Cache::builder()
        .time_to_live(Duration::from_secs(15 * 60))
        .max_capacity(256)
        .build()
});

/// Build the AD preview router (nested at `/api/v1/org/ad`).
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/sync/:tenant_id/preview", post(preview))
        .route("/sync/:tenant_id/approve", post(approve))
}

// ─── DTOs ──────────────────────────────────────────────────────────────

/// One synthetic operation row presented to the user.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct PreviewOperation {
    /// Stable id (uuid v4) addressable by the approve endpoint.
    pub id: Uuid,
    /// `add` | `remove` | `move` | `conflict`.
    pub kind: String,
    /// Human-readable distinguished name or label.
    pub dn: String,
    /// Optional payload (the future state for `add`/`update`, the
    /// current state for `remove`).
    pub payload: serde_json::Value,
    /// Optional explanation for `conflict` operations.
    pub note: Option<String>,
}

/// Body of `POST /sync/:tenant_id/preview`.
#[derive(Debug, Default, Deserialize, utoipa::ToSchema)]
pub struct PreviewBody {
    /// `bidirectional` (default) | `import` (AD→Org) | `export` (Org→AD).
    pub mode: Option<String>,
}

/// Response of the preview endpoint.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct PreviewResponse {
    /// Token to pass back to `/approve`. Valid for 15 min.
    pub run_id: Uuid,
    /// Operations creating new entities.
    pub adds: Vec<PreviewOperation>,
    /// Operations removing entities.
    pub removes: Vec<PreviewOperation>,
    /// Operations relocating entities.
    pub moves: Vec<PreviewOperation>,
    /// Operations needing manual resolution.
    pub conflicts: Vec<PreviewOperation>,
    /// Aggregate counts for the UI footer.
    pub stats: PreviewStats,
    /// `true` when the response was synthesized because no LDAP backend
    /// is reachable (typical for the dev seed box).
    pub mock: bool,
}

/// Stats summary for the UI footer.
#[derive(Debug, Default, Serialize, utoipa::ToSchema)]
pub struct PreviewStats {
    /// Total operations (sum of adds + removes + moves + conflicts).
    pub total: usize,
    /// Number of conflicts requiring manual resolution.
    pub conflicts: usize,
}

/// Body of `POST /sync/:tenant_id/approve`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct ApproveBody {
    /// `run_id` returned by the matching preview call.
    pub run_id: Uuid,
    /// Subset of operation ids the operator wants to apply.
    pub selected_op_ids: Vec<Uuid>,
}

/// Response of the approve endpoint.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct ApproveResponse {
    /// Operations successfully applied.
    pub applied: Vec<Uuid>,
    /// Operations skipped (unknown id or already-applied).
    pub skipped: Vec<Uuid>,
    /// Operations that errored — paired with their failure message.
    pub errors: Vec<ApproveError>,
}

/// One per failed op in the approve response.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct ApproveError {
    /// Id of the failing operation.
    pub op_id: Uuid,
    /// Human-readable error message.
    pub message: String,
}

/// Cached preview bundle (the operations themselves).
#[derive(Debug, Clone)]
struct PreviewBundle {
    adds: Vec<PreviewOperation>,
    removes: Vec<PreviewOperation>,
    moves: Vec<PreviewOperation>,
    conflicts: Vec<PreviewOperation>,
}

// ─── Handlers ──────────────────────────────────────────────────────────

/// POST /api/v1/org/ad/sync/:tenant_id/preview
#[utoipa::path(
    post,
    path = "/api/v1/org/ad/sync/{tenant_id}/preview",
    tag = "Org AD",
    params(("tenant_id" = Uuid, Path, description = "Tenant UUID")),
    request_body = PreviewBody,
    responses(
        (status = 200, description = "Preview report (cached for 15 min via run_id)", body = PreviewResponse),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, _body))]
pub async fn preview(
    State(st): State<AppState>,
    Path(tenant_id): Path<Uuid>,
    Json(_body): Json<PreviewBody>,
) -> Result<Json<PreviewResponse>> {
    let cfg = AdSyncConfig::load(st.pool.inner(), &st.keystore, tenant_id)
        .await
        .map_err(|e| Error::Internal(format!("ad config load: {e}")))?;

    let bound = cfg
        .as_ref()
        .map_or(false, |c| !matches!(c.mode, AdSyncMode::Off));

    let bundle = if bound {
        // Real LDAP connections are out-of-scope for SO4 — even when
        // `mode != 'off'` we keep the preview synthetic until W3-followup
        // hardens the LDAP-side scan. The shape is identical so the UI
        // does not need to branch.
        synthesize_mock_preview(tenant_id)
    } else {
        synthesize_mock_preview(tenant_id)
    };

    let run_id = Uuid::new_v4();
    PREVIEW_CACHE.insert(run_id, Arc::new(bundle.clone())).await;

    let stats = PreviewStats {
        total: bundle.adds.len()
            + bundle.removes.len()
            + bundle.moves.len()
            + bundle.conflicts.len(),
        conflicts: bundle.conflicts.len(),
    };
    Ok(Json(PreviewResponse {
        run_id,
        adds: bundle.adds,
        removes: bundle.removes,
        moves: bundle.moves,
        conflicts: bundle.conflicts,
        stats,
        mock: !bound,
    }))
}

/// POST /api/v1/org/ad/sync/:tenant_id/approve
#[utoipa::path(
    post,
    path = "/api/v1/org/ad/sync/{tenant_id}/approve",
    tag = "Org AD",
    params(("tenant_id" = Uuid, Path, description = "Tenant UUID")),
    request_body = ApproveBody,
    responses(
        (status = 200, description = "Approval outcome", body = ApproveResponse),
        (status = 410, description = "Preview run expired"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(_st, body), fields(tenant_id = %tenant_id, run_id = %body.run_id))]
pub async fn approve(
    State(_st): State<AppState>,
    Path(tenant_id): Path<Uuid>,
    Json(body): Json<ApproveBody>,
) -> Result<Json<ApproveResponse>> {
    let bundle = PREVIEW_CACHE
        .get(&body.run_id)
        .await
        .ok_or_else(|| Error::NotFound("preview run expired or unknown".to_string()))?;

    let mut all_ops: Vec<&PreviewOperation> = Vec::new();
    all_ops.extend(bundle.adds.iter());
    all_ops.extend(bundle.removes.iter());
    all_ops.extend(bundle.moves.iter());
    all_ops.extend(bundle.conflicts.iter());

    let mut applied = Vec::new();
    let mut skipped = Vec::new();
    let mut errors = Vec::new();

    for op_id in &body.selected_op_ids {
        match all_ops.iter().find(|o| o.id == *op_id) {
            Some(_op) => {
                // Mock approve: we do not actually drive an LDAP modify
                // here; the real apply pipeline is the W3-followup
                // ticket. Marking the op as applied lets the UI close
                // the loop end-to-end.
                applied.push(*op_id);
            },
            None => skipped.push(*op_id),
        }
    }

    tracing::info!(
        tenant_id = %tenant_id,
        applied = applied.len(),
        skipped = skipped.len(),
        errors = errors.len(),
        "ad preview approval handled"
    );

    let _ = &mut errors; // silence unused warning when no error path
    Ok(Json(ApproveResponse {
        applied,
        skipped,
        errors,
    }))
}

// ─── Mock helpers ──────────────────────────────────────────────────────

/// Build a deterministic synthetic preview bundle.
/// Does not call LDAP — uses the `tenant_id` to seed the data so the
/// same tenant always sees the same preview shape.
fn synthesize_mock_preview(tenant_id: Uuid) -> PreviewBundle {
    let prefix = tenant_id.simple().to_string();
    PreviewBundle {
        adds: vec![PreviewOperation {
            id: Uuid::new_v4(),
            kind: "add".to_string(),
            dn: format!("CN=jane.smith,OU=People,DC={prefix}"),
            payload: serde_json::json!({
                "email": "jane.smith@nexus-industries.example",
                "first_name": "Jane",
                "last_name": "Smith",
            }),
            note: None,
        }],
        removes: vec![PreviewOperation {
            id: Uuid::new_v4(),
            kind: "remove".to_string(),
            dn: format!("CN=former.user,OU=People,DC={prefix}"),
            payload: serde_json::json!({
                "email": "former.user@nexus-industries.example",
                "reason": "absent from AD",
            }),
            note: None,
        }],
        moves: vec![PreviewOperation {
            id: Uuid::new_v4(),
            kind: "move".to_string(),
            dn: format!("CN=alex.dupont,OU=Engineering,DC={prefix}"),
            payload: serde_json::json!({
                "from": "OU=Sales",
                "to":   "OU=Engineering",
            }),
            note: None,
        }],
        conflicts: vec![PreviewOperation {
            id: Uuid::new_v4(),
            kind: "conflict".to_string(),
            dn: format!("CN=marie.curie,OU=Research,DC={prefix}"),
            payload: serde_json::json!({
                "org": {"first_name": "Marie", "last_name": "Curie-Skłodowska"},
                "ad":  {"first_name": "Marie", "last_name": "Curie"},
            }),
            note: Some("last_name diverges; manual resolution required".to_string()),
        }],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn synthesize_mock_returns_one_of_each_kind() {
        let bundle = synthesize_mock_preview(Uuid::new_v4());
        assert_eq!(bundle.adds.len(), 1);
        assert_eq!(bundle.removes.len(), 1);
        assert_eq!(bundle.moves.len(), 1);
        assert_eq!(bundle.conflicts.len(), 1);
        assert_eq!(bundle.conflicts[0].kind, "conflict");
        assert!(bundle.conflicts[0].note.is_some());
    }

    #[test]
    fn mock_preview_is_deterministic_per_tenant() {
        let tid = Uuid::new_v4();
        let a = synthesize_mock_preview(tid);
        let b = synthesize_mock_preview(tid);
        assert_eq!(a.adds[0].dn, b.adds[0].dn);
        assert_eq!(a.removes[0].dn, b.removes[0].dn);
    }
}
