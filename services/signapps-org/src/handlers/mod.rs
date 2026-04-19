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
pub mod grant_redirect;
pub mod grants;
pub mod nodes;
pub mod openapi;
pub mod persons;
pub mod policies;
pub mod provisioning;
pub mod canonical_assignments;
