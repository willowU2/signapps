//! Group rule evaluation — SO7 groupes transverses.
//!
//! Translates the `rule_json` JSON DSL stored in `org_groups.rule_json`
//! into a single parameterised SQL WHERE fragment on `org_persons`,
//! then executes it and returns the matching persons.
//!
//! Supported operators :
//!
//! - `{"and": [ … ]}` / `{"or": [ … ]}` / `{"not": … }`
//! - `{"skill": {"slug": "python", "level_min": 3?}}`
//! - `{"node_id": "<uuid>"}` — person has a structure-axis assignment
//!   on the exact node.
//! - `{"node_path_startswith": "nexus_industries.engineering"}` — person
//!   has a structure-axis assignment on any node under the given path
//!   (LTREE `<@`).
//! - `{"site_id": "<uuid>"}` — person is rattached to a site via
//!   `org_site_persons`.
//! - `{"email_domain": "nexus.corp"}` / `{"title_contains": "Lead"}`.
//! - `{"role": "manager"}` — person has at least one assignment whose
//!   role matches (case-insensitive LIKE).

pub mod matcher;

pub use matcher::{Rule, RuleMatcher};
