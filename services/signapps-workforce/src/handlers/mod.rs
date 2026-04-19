//! Workforce Service Handlers
//!
//! After the S1 org+RBAC refonte (2026-04-18), workforce keeps only
//! HR-pure domains:
//! - attendance: clock-in / clock-out
//! - audit: org-audit query endpoints (read-only, backed by canonical tables)
//! - coverage: coverage templates and rules
//! - expenses: expense approval workflow
//! - learning / lms: learning courses + progress tracking
//! - my_team: manager's direct reports + pending actions
//! - supply_chain: purchase orders, warehouses, inventory
//! - timesheet: timer + stats
//! - validation: gap analysis + leave simulation
//!
//! AD, org hierarchy CRUD, boards, policies, groups, delegations and
//! employee CRUD have moved to `signapps-org` (the canonical service).

pub mod attendance;
pub mod audit;
pub mod coverage;
pub mod expenses;
pub mod learning;
pub mod lms;
pub mod my_team;
pub mod openapi;
pub mod supply_chain;
pub mod timesheet;
pub mod validation;

use axum::Json;

/// Health check endpoint
#[tracing::instrument(skip_all)]
pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-workforce",
        "version": env!("CARGO_PKG_VERSION"),
        "app": {
            "id": "workforce",
            "label": "Workforce",
            "description": "RH et gestion des équipes",
            "icon": "Briefcase",
            "category": "Business",
            "color": "text-rose-500",
            "href": "/workforce",
            "port": 3024
        }
    }))
}
