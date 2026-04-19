//! HTTP handlers for the Org service.
//!
//! The `assignments`, `org_context`, `org_nodes` and `org_trees` modules
//! carry the pre-existing logic that powers the internal org-chart UI.
//!
//! The modules below (`nodes`, `persons`, `assignments_new`, `policies`,
//! `boards`, `grants`, `ad`, `provisioning`, `openapi`, `grant_redirect`)
//! are new for the S1 org+RBAC refonte and expose the canonical
//! `/api/v1/org/*` surface backed by the W1 repositories in
//! `signapps_db::repositories::org`.

pub mod assignments;
pub mod org_context;
pub mod org_nodes;
pub mod org_trees;

// ── S1 canonical surface (W2 scaffold, CRUD wired in Task 10/11) ────────────
pub mod ad;
pub mod boards;
pub mod grants;
pub mod nodes;
pub mod openapi;
pub mod persons;
pub mod policies;
pub mod provisioning;
pub mod canonical_assignments;

// ── SO1 foundations (positions, history, delegations) ────────────────────────
pub mod delegations;
pub mod history;
pub mod positions;

// ── SO2 governance (rbac visualizer, raci matrix, board decisions) ──────────
pub mod decisions;
pub mod raci;
pub mod rbac;

// ── SO3 scale & power (templates, headcount, skills, search, bulk) ──────────
pub mod headcount;
pub mod search;
pub mod skills;
pub mod templates;
