//! Group rule matcher — JSON DSL → parametric SQL WHERE.
//!
//! The matcher compiles a `rule_json` value into a [`Rule`] AST, then
//! builds a `sqlx::QueryBuilder` expression that is executed against
//! `org_persons` scoped by tenant. All values inserted into the query
//! go through `bind_unseparated` — no string interpolation — so the
//! resulting SQL is safe by construction.

use signapps_db::models::org::Person;
use sqlx::{PgPool, QueryBuilder};
use uuid::Uuid;

// ─── AST ──────────────────────────────────────────────────────────────

/// Compiled representation of a `rule_json` expression.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Rule {
    /// All children must match.
    And(Vec<Rule>),
    /// At least one child must match.
    Or(Vec<Rule>),
    /// Negate the child.
    Not(Box<Rule>),
    /// Person holds the given skill, optionally with a minimum level.
    Skill {
        /// Skill slug (lowercase kebab case).
        slug: String,
        /// Optional minimum level (1-5).
        level_min: Option<i16>,
    },
    /// Person has a structure-axis assignment on the exact node.
    NodeId(Uuid),
    /// Person has a structure-axis assignment on any node whose LTREE
    /// path is under the given prefix.
    NodePathStartswith(String),
    /// Person is attached to the given site.
    SiteId(Uuid),
    /// Person email ends with `@<domain>`.
    EmailDomain(String),
    /// Person has an assignment whose role ILIKE `%<needle>%`.
    TitleContains(String),
    /// Person has an assignment whose role equals the given value
    /// (case-insensitive).
    Role(String),
    /// Constant truthy — used for empty `and([])` semantics.
    True,
    /// Constant false — used for unknown operators.
    False,
}

impl Rule {
    /// Parse a JSON value into an AST.
    ///
    /// Unknown operators are mapped to [`Rule::False`] to avoid
    /// accidentally matching all persons.
    pub fn parse(value: &serde_json::Value) -> Self {
        let Some(obj) = value.as_object() else {
            return Rule::False;
        };
        if obj.is_empty() {
            return Rule::True;
        }
        // Only one top-level key is accepted per object. Multiple keys
        // are interpreted as an implicit AND to match the Notion-style
        // builder the frontend generates (e.g.
        // `{"skill": {...}, "email_domain": "..."}`).
        if obj.len() > 1 {
            let parts: Vec<Rule> = obj
                .iter()
                .map(|(k, v)| {
                    let mut wrap = serde_json::Map::new();
                    wrap.insert(k.clone(), v.clone());
                    Rule::parse(&serde_json::Value::Object(wrap))
                })
                .collect();
            return Rule::And(parts);
        }
        let (key, val) = obj.iter().next().unwrap_or_else(|| unreachable!());
        match key.as_str() {
            "and" => {
                let arr = val.as_array().cloned().unwrap_or_default();
                Rule::And(arr.iter().map(Rule::parse).collect())
            },
            "or" => {
                let arr = val.as_array().cloned().unwrap_or_default();
                Rule::Or(arr.iter().map(Rule::parse).collect())
            },
            "not" => Rule::Not(Box::new(Rule::parse(val))),
            "skill" => {
                let slug = val
                    .get("slug")
                    .and_then(|v| v.as_str())
                    .map(str::to_string)
                    .unwrap_or_default();
                let level_min =
                    val.get("level_min").and_then(|v| v.as_i64()).and_then(|v| i16::try_from(v).ok());
                if slug.is_empty() {
                    Rule::False
                } else {
                    Rule::Skill { slug, level_min }
                }
            },
            "node_id" => val
                .as_str()
                .and_then(|s| Uuid::parse_str(s).ok())
                .map_or(Rule::False, Rule::NodeId),
            "node_path_startswith" => val
                .as_str()
                .map(|s| Rule::NodePathStartswith(s.to_string()))
                .unwrap_or(Rule::False),
            "site_id" => val
                .as_str()
                .and_then(|s| Uuid::parse_str(s).ok())
                .map_or(Rule::False, Rule::SiteId),
            "email_domain" => val
                .as_str()
                .map(|s| Rule::EmailDomain(s.to_string()))
                .unwrap_or(Rule::False),
            "title_contains" => val
                .as_str()
                .map(|s| Rule::TitleContains(s.to_string()))
                .unwrap_or(Rule::False),
            "role" => val
                .as_str()
                .map(|s| Rule::Role(s.to_string()))
                .unwrap_or(Rule::False),
            _ => Rule::False,
        }
    }
}

// ─── Compiler ─────────────────────────────────────────────────────────

/// Append a Postgres-compatible predicate for the given rule to `qb`.
///
/// The predicate evaluates to BOOLEAN and references the outer alias
/// `p` (for `org_persons`) — the query builder passed in MUST already
/// have selected `FROM org_persons p`.
fn push_predicate<'args>(qb: &mut QueryBuilder<'args, sqlx::Postgres>, rule: &'args Rule) {
    match rule {
        Rule::True => {
            qb.push("TRUE");
        },
        Rule::False => {
            qb.push("FALSE");
        },
        Rule::And(children) => {
            if children.is_empty() {
                qb.push("TRUE");
                return;
            }
            qb.push("(");
            for (i, child) in children.iter().enumerate() {
                if i > 0 {
                    qb.push(" AND ");
                }
                push_predicate(qb, child);
            }
            qb.push(")");
        },
        Rule::Or(children) => {
            if children.is_empty() {
                qb.push("FALSE");
                return;
            }
            qb.push("(");
            for (i, child) in children.iter().enumerate() {
                if i > 0 {
                    qb.push(" OR ");
                }
                push_predicate(qb, child);
            }
            qb.push(")");
        },
        Rule::Not(inner) => {
            qb.push("NOT (");
            push_predicate(qb, inner);
            qb.push(")");
        },
        Rule::Skill { slug, level_min } => {
            qb.push(
                "EXISTS (SELECT 1 FROM org_person_skills ps \
                 JOIN org_skills sk ON sk.id = ps.skill_id \
                 WHERE ps.person_id = p.id AND sk.slug = ",
            );
            qb.push_bind(slug.as_str());
            if let Some(lvl) = level_min {
                qb.push(" AND ps.level >= ");
                qb.push_bind(*lvl);
            }
            qb.push(")");
        },
        Rule::NodeId(id) => {
            qb.push(
                "EXISTS (SELECT 1 FROM org_assignments a \
                 WHERE a.person_id = p.id \
                   AND a.axis = 'structure' \
                   AND a.node_id = ",
            );
            qb.push_bind(*id);
            qb.push(" AND (a.end_date IS NULL OR a.end_date > CURRENT_DATE))");
        },
        Rule::NodePathStartswith(path) => {
            qb.push(
                "EXISTS (SELECT 1 FROM org_assignments a \
                 JOIN org_nodes n ON n.id = a.node_id \
                 WHERE a.person_id = p.id \
                   AND a.axis = 'structure' \
                   AND n.path <@ ",
            );
            qb.push_bind(path.as_str());
            qb.push("::ltree AND (a.end_date IS NULL OR a.end_date > CURRENT_DATE))");
        },
        Rule::SiteId(id) => {
            qb.push(
                "EXISTS (SELECT 1 FROM org_site_persons sp \
                 WHERE sp.person_id = p.id AND sp.site_id = ",
            );
            qb.push_bind(*id);
            qb.push(")");
        },
        Rule::EmailDomain(domain) => {
            qb.push("p.email ILIKE ");
            qb.push_bind(format!("%@{domain}"));
        },
        Rule::TitleContains(needle) => {
            qb.push(
                "EXISTS (SELECT 1 FROM org_assignments a \
                 WHERE a.person_id = p.id AND a.role ILIKE ",
            );
            qb.push_bind(format!("%{needle}%"));
            qb.push(")");
        },
        Rule::Role(role) => {
            qb.push(
                "EXISTS (SELECT 1 FROM org_assignments a \
                 WHERE a.person_id = p.id AND a.role ILIKE ",
            );
            qb.push_bind(role.clone());
            qb.push(")");
        },
    }
}

// ─── Public API ───────────────────────────────────────────────────────

/// Thin wrapper that owns a rule and can execute it against a pool.
pub struct RuleMatcher {
    /// Parsed rule AST.
    pub rule: Rule,
}

impl RuleMatcher {
    /// Build a matcher from a JSON value.
    #[must_use]
    pub fn from_json(value: &serde_json::Value) -> Self {
        Self { rule: Rule::parse(value) }
    }

    /// Execute the rule against `org_persons` scoped by tenant, returning
    /// the matching persons (active only).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn execute(&self, pool: &PgPool, tenant_id: Uuid) -> anyhow::Result<Vec<Person>> {
        let mut qb: QueryBuilder<sqlx::Postgres> = QueryBuilder::new(
            "SELECT p.* FROM org_persons p WHERE p.tenant_id = ",
        );
        qb.push_bind(tenant_id);
        qb.push(" AND p.active AND ");
        push_predicate(&mut qb, &self.rule);
        qb.push(" ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST");
        let rows: Vec<Person> = qb.build_query_as::<Person>().fetch_all(pool).await?;
        Ok(rows)
    }

    /// For testing : return only the compiled SQL template (without
    /// bound parameters) so tests can assert the shape.
    #[must_use]
    pub fn debug_sql(&self) -> String {
        let mut qb: QueryBuilder<sqlx::Postgres> = QueryBuilder::new(
            "SELECT p.* FROM org_persons p WHERE p.tenant_id = $1 AND p.active AND ",
        );
        // Use a fresh mutable borrow to push the predicate with a placeholder
        // for bind values so assertions remain deterministic.
        push_predicate(&mut qb, &self.rule);
        qb.into_sql()
    }
}

// ─── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parse_empty_object_is_true() {
        assert_eq!(Rule::parse(&json!({})), Rule::True);
    }

    #[test]
    fn parse_unknown_operator_is_false() {
        assert_eq!(Rule::parse(&json!({"unknown_op": 42})), Rule::False);
    }

    #[test]
    fn parse_skill_with_level_min() {
        let r = Rule::parse(&json!({"skill": {"slug": "python", "level_min": 3}}));
        assert_eq!(
            r,
            Rule::Skill {
                slug: "python".to_string(),
                level_min: Some(3)
            }
        );
    }

    #[test]
    fn parse_skill_without_level() {
        let r = Rule::parse(&json!({"skill": {"slug": "rust"}}));
        assert_eq!(
            r,
            Rule::Skill {
                slug: "rust".to_string(),
                level_min: None
            }
        );
    }

    #[test]
    fn parse_skill_missing_slug_is_false() {
        let r = Rule::parse(&json!({"skill": {"level_min": 2}}));
        assert_eq!(r, Rule::False);
    }

    #[test]
    fn parse_and_or_not() {
        let r = Rule::parse(&json!({
            "and": [
                {"email_domain": "nexus.corp"},
                {"or": [
                    {"skill": {"slug": "python"}},
                    {"skill": {"slug": "rust"}},
                ]},
                {"not": {"title_contains": "Intern"}},
            ]
        }));
        match r {
            Rule::And(items) => {
                assert_eq!(items.len(), 3);
                assert!(matches!(items[0], Rule::EmailDomain(_)));
                assert!(matches!(items[1], Rule::Or(_)));
                assert!(matches!(items[2], Rule::Not(_)));
            },
            _ => panic!("expected And"),
        }
    }

    #[test]
    fn parse_node_path_startswith() {
        let r = Rule::parse(&json!({"node_path_startswith": "nexus.engineering"}));
        assert_eq!(r, Rule::NodePathStartswith("nexus.engineering".to_string()));
    }

    #[test]
    fn parse_site_id_valid_uuid() {
        let id = Uuid::new_v4();
        let r = Rule::parse(&json!({"site_id": id.to_string()}));
        assert_eq!(r, Rule::SiteId(id));
    }

    #[test]
    fn parse_site_id_invalid_is_false() {
        let r = Rule::parse(&json!({"site_id": "not-a-uuid"}));
        assert_eq!(r, Rule::False);
    }

    #[test]
    fn multi_key_object_becomes_and() {
        let r = Rule::parse(&json!({
            "email_domain": "nexus.corp",
            "title_contains": "Lead"
        }));
        match r {
            Rule::And(items) => assert_eq!(items.len(), 2),
            _ => panic!("expected And wrapper"),
        }
    }

    // ─── SQL compilation ──────────────────────────────────────────────

    #[test]
    fn sql_skill_contains_level_filter() {
        let m = RuleMatcher::from_json(&json!({"skill": {"slug": "python", "level_min": 3}}));
        let sql = m.debug_sql();
        assert!(sql.contains("org_person_skills"));
        assert!(sql.contains("sk.slug ="));
        assert!(sql.contains("ps.level >="));
    }

    #[test]
    fn sql_and_combines_with_intersection() {
        let m = RuleMatcher::from_json(&json!({
            "and": [
                {"skill": {"slug": "rust"}},
                {"email_domain": "nexus.corp"}
            ]
        }));
        let sql = m.debug_sql();
        assert!(sql.contains(" AND "));
        assert!(sql.contains("ILIKE"));
    }

    #[test]
    fn sql_or_combines_with_union() {
        let m = RuleMatcher::from_json(&json!({
            "or": [
                {"skill": {"slug": "rust"}},
                {"skill": {"slug": "python"}}
            ]
        }));
        let sql = m.debug_sql();
        assert!(sql.contains(" OR "));
    }

    #[test]
    fn sql_not_negates() {
        let m = RuleMatcher::from_json(&json!({"not": {"email_domain": "nexus.corp"}}));
        let sql = m.debug_sql();
        assert!(sql.contains("NOT ("));
    }

    #[test]
    fn sql_node_path_uses_ltree() {
        let m = RuleMatcher::from_json(&json!({
            "node_path_startswith": "nexus_industries.engineering"
        }));
        let sql = m.debug_sql();
        assert!(sql.contains("<@"));
        assert!(sql.contains("::ltree"));
    }

    #[test]
    fn sql_title_contains_uses_ilike() {
        let m = RuleMatcher::from_json(&json!({"title_contains": "Lead"}));
        let sql = m.debug_sql();
        assert!(sql.contains("ILIKE"));
    }

    #[test]
    fn sql_empty_and_is_true() {
        let m = RuleMatcher::from_json(&json!({"and": []}));
        let sql = m.debug_sql();
        assert!(sql.ends_with("TRUE"));
    }

    #[test]
    fn sql_empty_or_is_false() {
        let m = RuleMatcher::from_json(&json!({"or": []}));
        let sql = m.debug_sql();
        assert!(sql.ends_with("FALSE"));
    }

    #[test]
    fn sql_unknown_op_is_false() {
        let m = RuleMatcher::from_json(&json!({"bogus": 42}));
        let sql = m.debug_sql();
        assert!(sql.ends_with("FALSE"));
    }
}
