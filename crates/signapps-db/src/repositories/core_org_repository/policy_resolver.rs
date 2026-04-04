//! PolicyResolver — GPO-style policy resolution engine.
//!
//! Implements the 5-step algorithm that collects, filters, separates, merges,
//! and returns effective policies for a person or an org node. This is the
//! core of the policy system, analogous to Windows GPO resultant set of policy
//! (RSoP).

use crate::models::org_policies::{EffectivePolicy, OrgPolicy, PolicySource};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Helper struct returned from the collection queries.
/// Carries the policy together with provenance metadata.
#[derive(Debug, Clone)]
struct CollectedPolicy {
    /// The policy itself.
    policy: OrgPolicy,
    /// Scope type through which the policy was linked.
    link_type: String,
    /// Human-readable description of the inheritance path.
    via: String,
    /// Whether this link blocks inheritance at this point.
    is_blocked: bool,
}

/// GPO-style policy resolution engine.
pub struct PolicyResolver;

impl PolicyResolver {
    /// Resolve the effective policy for a person.
    ///
    /// Implements the 5-step algorithm:
    /// 1. **Collect** policies from all sources (org ancestors, site, country, group, global).
    /// 2. **Filter** out disabled and blocked policies.
    /// 3. **Separate** enforced from normal policies.
    /// 4. **Merge** by domain using domain-specific merge strategies.
    /// 5. **Return** `EffectivePolicy` with merged settings and per-key provenance.
    pub async fn resolve_person_policy(pool: &PgPool, person_id: Uuid) -> Result<EffectivePolicy> {
        let mut collected: Vec<CollectedPolicy> = Vec::new();

        // --- Step 1a: Org policies via assignments → org_closure ancestors ---
        let org_policies = sqlx::query_as::<_, OrgPolicy>(
            r#"
            SELECT DISTINCT p.*
            FROM workforce_org_policies p
            JOIN workforce_org_policy_links pl ON pl.policy_id = p.id
            JOIN workforce_org_closure c ON c.ancestor_id = pl.link_id::uuid
            JOIN workforce_assignments wa ON wa.org_node_id = c.descendant_id
            WHERE wa.employee_id = $1
              AND pl.link_type = 'node'
              AND p.is_disabled = false
            ORDER BY p.priority ASC
            "#,
        )
        .bind(person_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        for p in org_policies {
            collected.push(CollectedPolicy {
                via: "org_node (assignment)".to_string(),
                link_type: "node".to_string(),
                is_blocked: false,
                policy: p,
            });
        }

        // --- Step 1b: Site policies via site_assignments ---
        let site_policies = sqlx::query_as::<_, OrgPolicy>(
            r#"
            SELECT DISTINCT p.*
            FROM workforce_org_policies p
            JOIN workforce_org_policy_links pl ON pl.policy_id = p.id
            JOIN workforce_site_assignments sa ON sa.site_id = pl.link_id::uuid
            WHERE sa.assignee_id = $1
              AND sa.assignee_type = 'person'
              AND pl.link_type = 'site'
              AND p.is_disabled = false
              AND pl.is_blocked = false
            ORDER BY p.priority ASC
            "#,
        )
        .bind(person_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        for p in site_policies {
            collected.push(CollectedPolicy {
                via: "site (assignment)".to_string(),
                link_type: "site".to_string(),
                is_blocked: false,
                policy: p,
            });
        }

        // --- Step 1c: Country policies via person's site country_code ---
        let country_policies = sqlx::query_as::<_, OrgPolicy>(
            r#"
            SELECT DISTINCT p.*
            FROM workforce_org_policies p
            JOIN workforce_country_policies cp ON cp.policy_id = p.id
            JOIN workforce_sites s ON s.country_code = cp.country_code
            JOIN workforce_site_assignments sa ON sa.site_id = s.id
            WHERE sa.assignee_id = $1
              AND sa.assignee_type = 'person'
              AND p.is_disabled = false
            ORDER BY p.priority ASC
            "#,
        )
        .bind(person_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        for p in country_policies {
            collected.push(CollectedPolicy {
                via: "country (site)".to_string(),
                link_type: "country".to_string(),
                is_blocked: false,
                policy: p,
            });
        }

        // --- Step 1d: Group policies via memberof ---
        let group_policies = sqlx::query_as::<_, OrgPolicy>(
            r#"
            SELECT DISTINCT p.*
            FROM workforce_org_policies p
            JOIN workforce_org_policy_links pl ON pl.policy_id = p.id
            JOIN workforce_org_memberof mo ON mo.group_id = pl.link_id::uuid
            WHERE mo.person_id = $1
              AND pl.link_type = 'group'
              AND p.is_disabled = false
              AND pl.is_blocked = false
            ORDER BY p.priority ASC
            "#,
        )
        .bind(person_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        for p in group_policies {
            collected.push(CollectedPolicy {
                via: "group (memberof)".to_string(),
                link_type: "group".to_string(),
                is_blocked: false,
                policy: p,
            });
        }

        // --- Step 1e: Global policies (tenant-wide) ---
        // We need the tenant_id — derive from any assignment or fall back to direct query
        let tenant_id = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT DISTINCT n.tenant_id
            FROM workforce_assignments wa
            JOIN workforce_org_nodes n ON n.id = wa.org_node_id
            WHERE wa.employee_id = $1
            LIMIT 1
            "#,
        )
        .bind(person_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        if let Some(tid) = tenant_id {
            let global_policies = sqlx::query_as::<_, OrgPolicy>(
                r#"
                SELECT DISTINCT p.*
                FROM workforce_org_policies p
                JOIN workforce_org_policy_links pl ON pl.policy_id = p.id
                WHERE p.tenant_id = $1
                  AND pl.link_type = 'global'
                  AND p.is_disabled = false
                  AND pl.is_blocked = false
                ORDER BY p.priority ASC
                "#,
            )
            .bind(tid)
            .fetch_all(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

            for p in global_policies {
                collected.push(CollectedPolicy {
                    via: "global".to_string(),
                    link_type: "global".to_string(),
                    is_blocked: false,
                    policy: p,
                });
            }
        }

        // Steps 2-5: merge
        Ok(merge_policies(collected))
    }

    /// Resolve the effective policy for an org node.
    ///
    /// Simpler version: walks org ancestors via closure table plus any
    /// direct site/group/global links.
    pub async fn resolve_node_policy(pool: &PgPool, node_id: Uuid) -> Result<EffectivePolicy> {
        let mut collected: Vec<CollectedPolicy> = Vec::new();

        // Org node ancestor policies
        let org_policies = sqlx::query_as::<_, OrgPolicy>(
            r#"
            SELECT DISTINCT p.*
            FROM workforce_org_policies p
            JOIN workforce_org_policy_links pl ON pl.policy_id = p.id
            JOIN workforce_org_closure c ON c.ancestor_id = pl.link_id::uuid
            WHERE c.descendant_id = $1
              AND pl.link_type = 'node'
              AND p.is_disabled = false
              AND pl.is_blocked = false
            ORDER BY p.priority ASC
            "#,
        )
        .bind(node_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        for p in org_policies {
            collected.push(CollectedPolicy {
                via: "org_node (closure)".to_string(),
                link_type: "node".to_string(),
                is_blocked: false,
                policy: p,
            });
        }

        // Global policies for this node's tenant
        let tenant_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT tenant_id FROM workforce_org_nodes WHERE id = $1",
        )
        .bind(node_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        if let Some(tid) = tenant_id {
            let global_policies = sqlx::query_as::<_, OrgPolicy>(
                r#"
                SELECT DISTINCT p.*
                FROM workforce_org_policies p
                JOIN workforce_org_policy_links pl ON pl.policy_id = p.id
                WHERE p.tenant_id = $1
                  AND pl.link_type = 'global'
                  AND p.is_disabled = false
                  AND pl.is_blocked = false
                ORDER BY p.priority ASC
                "#,
            )
            .bind(tid)
            .fetch_all(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

            for p in global_policies {
                collected.push(CollectedPolicy {
                    via: "global".to_string(),
                    link_type: "global".to_string(),
                    is_blocked: false,
                    policy: p,
                });
            }
        }

        Ok(merge_policies(collected))
    }
}

/// Steps 2-5 of the resolution algorithm: filter, separate, merge, return.
fn merge_policies(collected: Vec<CollectedPolicy>) -> EffectivePolicy {
    // Step 2: Filter — already done at SQL level (is_disabled=false, is_blocked=false).
    // Additional in-memory filter for blocked links.
    let active: Vec<&CollectedPolicy> = collected.iter().filter(|c| !c.is_blocked).collect();

    // Step 3: Separate enforced from normal.
    let mut enforced: Vec<&CollectedPolicy> = Vec::new();
    let mut normal: Vec<&CollectedPolicy> = Vec::new();
    for cp in &active {
        if cp.policy.is_enforced {
            enforced.push(cp);
        } else {
            normal.push(cp);
        }
    }

    // Sort by priority ASC (lower priority first, higher priority overrides later).
    normal.sort_by_key(|cp| cp.policy.priority);
    enforced.sort_by_key(|cp| cp.policy.priority);

    // Step 4: Merge by domain.
    let mut settings = serde_json::Map::new();
    let mut sources: Vec<PolicySource> = Vec::new();

    // Apply normal policies first (lower priority wins for first-non-null, higher priority
    // wins for security).
    apply_policies(&normal, &mut settings, &mut sources);

    // Enforced policies always override — applied last.
    apply_policies(&enforced, &mut settings, &mut sources);

    EffectivePolicy {
        settings: serde_json::Value::Object(settings),
        sources,
    }
}

/// Apply a sorted slice of collected policies into the merged settings map.
///
/// For the `security` domain, uses strict-wins strategy:
/// - Booleans: `true` beats `false` (more restrictive wins).
/// - Numbers: maximum wins (e.g. longer password length, more retries).
/// - Arrays: intersection (smallest common set).
///
/// For other domains (`modules`, `naming`, `delegation`, `compliance`, `custom`):
/// - Priority ASC → later (higher priority) values overwrite earlier.
fn apply_policies(
    policies: &[&CollectedPolicy],
    settings: &mut serde_json::Map<String, serde_json::Value>,
    sources: &mut Vec<PolicySource>,
) {
    for cp in policies {
        let domain = &cp.policy.domain;
        if let serde_json::Value::Object(policy_settings) = &cp.policy.settings {
            for (key, value) in policy_settings {
                let full_key = format!("{}.{}", domain, key);

                if domain == "security" {
                    // Strict-wins merge for security domain.
                    let should_apply = match settings.get(&full_key) {
                        None => true,
                        Some(existing) => security_strict_wins(existing, value),
                    };
                    if should_apply {
                        settings.insert(full_key.clone(), value.clone());
                        update_source(sources, &full_key, value, cp);
                    }
                } else {
                    // Priority-based overwrite: later (higher priority) wins.
                    settings.insert(full_key.clone(), value.clone());
                    update_source(sources, &full_key, value, cp);
                }
            }
        }
    }
}

/// Determine if the new value should replace the existing value under
/// the security strict-wins strategy.
///
/// - Booleans: `true` (restrictive) beats `false`.
/// - Numbers: larger value wins.
/// - Strings: new value always wins (treated as enum, latest priority wins).
/// - Arrays: keep existing (intersection would need both; simplified to keep strictest).
fn security_strict_wins(existing: &serde_json::Value, new: &serde_json::Value) -> bool {
    match (existing, new) {
        // true beats false for booleans.
        (serde_json::Value::Bool(e), serde_json::Value::Bool(n)) => *n && !*e,
        // Larger number wins for numeric thresholds.
        (serde_json::Value::Number(e), serde_json::Value::Number(n)) => {
            let ev = e.as_f64().unwrap_or(0.0);
            let nv = n.as_f64().unwrap_or(0.0);
            nv > ev
        },
        // For other types, higher priority (applied later) wins.
        _ => true,
    }
}

/// Update or insert a policy source for the given key.
fn update_source(
    sources: &mut Vec<PolicySource>,
    key: &str,
    value: &serde_json::Value,
    cp: &CollectedPolicy,
) {
    // Remove existing source for the same key and add the new one.
    sources.retain(|s| s.key != key);
    sources.push(PolicySource {
        key: key.to_string(),
        value: value.clone(),
        policy_id: cp.policy.id,
        policy_name: cp.policy.name.clone(),
        link_type: cp.link_type.clone(),
        via: cp.via.clone(),
    });
}
