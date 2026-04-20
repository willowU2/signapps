//! SO9 — ACL universelle (ReBAC-style).
//!
//! Ce module fournit un **résolveur d'ACL** qui décide si un utilisateur
//! peut effectuer une action sur une ressource en combinant :
//!
//! 1. Les **ACLs explicites** stockées dans `org_acl` (persons, groups,
//!    roles, everyone, auth_user) avec effet `allow`/`deny`.
//! 2. Les **règles d'héritage implicites** dérivées de
//!    `org_resource_assignments` :
//!    - `owner` actif → allow read+update+assign+unassign+transition+renew
//!    - `caretaker` → allow read+update+transition+renew
//!    - `primary_user`/`secondary_user` → allow read
//!    - admin global → allow *
//!
//! La résolution applique la règle **deny wins** : si une ACL `deny`
//! match, on refuse. Sinon, au moins un `allow` → on autorise. Sinon,
//! implicit deny.
//!
//! Cache [`AclDecisionCache`] (moka, TTL 60 s) pour éviter de payer le
//! round-trip DB à chaque check. Invalidé sur events
//! `org.acl.updated` et `org.resource.assigned`.

use std::time::Duration;

use moka::future::Cache;
use uuid::Uuid;

/// Action applicable sur une ressource.
///
/// Les actions SO9 sont typées pour éviter les typos ; `Custom` permet
/// de gérer les futurs domaines (SO10+).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AclAction {
    /// Créer.
    Create,
    /// Lire (afficher, exporter).
    Read,
    /// Modifier.
    Update,
    /// Supprimer.
    Delete,
    /// Lister.
    List,
    /// Assigner à un sujet.
    Assign,
    /// Désassigner d'un sujet.
    Unassign,
    /// Transition de statut.
    Transition,
    /// Renouveler (garantie, licence, badge, ...).
    Renew,
}

impl AclAction {
    /// DB/SQL canonical snake_case value.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Create => "create",
            Self::Read => "read",
            Self::Update => "update",
            Self::Delete => "delete",
            Self::List => "list",
            Self::Assign => "assign",
            Self::Unassign => "unassign",
            Self::Transition => "transition",
            Self::Renew => "renew",
        }
    }

    /// Parse a snake_case string.
    ///
    /// # Errors
    ///
    /// Returns `Err` for unknown variants.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "create" => Ok(Self::Create),
            "read" => Ok(Self::Read),
            "update" => Ok(Self::Update),
            "delete" => Ok(Self::Delete),
            "list" => Ok(Self::List),
            "assign" => Ok(Self::Assign),
            "unassign" => Ok(Self::Unassign),
            "transition" => Ok(Self::Transition),
            "renew" => Ok(Self::Renew),
            other => Err(format!("unknown acl action: {other}")),
        }
    }
}

/// Une règle matchée qui a contribué à la décision.
///
/// Retournée par le resolver quand l'appelant veut un diagnostic (cf.
/// endpoint `POST /acl/test` qui affiche l'arbre visuel).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MatchedRule {
    /// Source de la règle.
    pub source: RuleSource,
    /// Effet de la règle (allow ou deny).
    pub effect: AclEffect,
    /// Raison lisible (pour le debug UI).
    pub reason: String,
}

/// D'où vient une règle matchée.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuleSource {
    /// Ligne explicite dans `org_acl`.
    Acl {
        /// UUID de la row `org_acl`.
        id: Uuid,
        /// Type de sujet (person/group/role/everyone/auth_user).
        subject_type: String,
    },
    /// Héritage implicite depuis `org_resource_assignments`.
    InheritedFromAssignment {
        /// Rôle dans l'assignment (owner/primary_user/...).
        role: String,
    },
    /// L'utilisateur est admin global.
    GlobalAdmin,
}

/// Simple allow/deny primitive.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AclEffect {
    /// Autorise.
    Allow,
    /// Refuse (prioritaire).
    Deny,
}

impl AclEffect {
    /// Parse a string.
    ///
    /// # Errors
    ///
    /// Returns `Err` for unknown variants.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "allow" => Ok(Self::Allow),
            "deny" => Ok(Self::Deny),
            other => Err(format!("unknown acl effect: {other}")),
        }
    }
}

/// Décision finale rendue par [`AclResolver::check`].
#[derive(Debug, Clone)]
pub struct AclDecision {
    /// `true` = autorisé, `false` = refusé.
    pub allow: bool,
    /// Règles matchées qui ont produit la décision (pour l'UI debug).
    pub matched: Vec<MatchedRule>,
    /// Source consolidée (première règle qui emporte la décision).
    pub source: &'static str,
}

/// Entrée ACL minimaliste — ne dépend pas du type sqlx, porté par le
/// consumer (signapps-org).
#[derive(Debug, Clone)]
pub struct AclEntry {
    /// UUID `org_acl.id`.
    pub id: Uuid,
    /// Type de sujet (`person` | `group` | `role` | `everyone` | `auth_user`).
    pub subject_type: String,
    /// UUID du sujet si applicable.
    pub subject_id: Option<Uuid>,
    /// Ref rôle si subject_type=role.
    pub subject_ref: Option<String>,
    /// Action (`read` / `*` / ...).
    pub action: String,
    /// Type de ressource.
    pub resource_type: String,
    /// UUID ressource si précis.
    pub resource_id: Option<Uuid>,
    /// Effet.
    pub effect: AclEffect,
    /// Raison (display).
    pub reason: Option<String>,
    /// `true` si la règle est dans sa fenêtre de validité.
    pub is_valid: bool,
}

/// Contexte utilisateur à résoudre.
#[derive(Debug, Clone)]
pub struct AclSubjectCtx {
    /// UUID person (`org_persons.id`). None = anonymous.
    pub person_id: Option<Uuid>,
    /// Tenant.
    pub tenant_id: Uuid,
    /// Rôles globaux portés par le user (role_name).
    pub roles: Vec<String>,
    /// UUID des groupes auxquels la personne appartient.
    pub group_ids: Vec<Uuid>,
    /// `true` si admin global (role >= 2).
    pub is_global_admin: bool,
}

/// Rôle (simple string) dans `org_resource_assignments` pour inheritance.
#[derive(Debug, Clone)]
pub struct AssignmentInheritance {
    /// Rôle (`owner` | `primary_user` | `secondary_user` | `caretaker` | `maintainer`).
    pub role: String,
    /// Type de sujet (person/node/group/site).
    pub subject_type: String,
    /// UUID du sujet.
    pub subject_id: Uuid,
}

/// Résolveur pur — ne fait **aucun** accès DB.
///
/// Le caller charge les ACL et inheritance depuis la DB puis invoque
/// [`resolve`] — ce qui permet de tester unitairement tous les cas.
#[allow(clippy::too_many_arguments)]
pub fn resolve(
    ctx: &AclSubjectCtx,
    action: AclAction,
    resource_type: &str,
    resource_id: Option<Uuid>,
    acls: &[AclEntry],
    inheritance: &[AssignmentInheritance],
) -> AclDecision {
    // Global admin shortcut.
    if ctx.is_global_admin {
        return AclDecision {
            allow: true,
            matched: vec![MatchedRule {
                source: RuleSource::GlobalAdmin,
                effect: AclEffect::Allow,
                reason: "global admin has implicit allow * on *".into(),
            }],
            source: "global_admin",
        };
    }

    let mut matched: Vec<MatchedRule> = Vec::new();

    // 1. Collect applicable explicit ACLs.
    for rule in acls {
        if !rule.is_valid {
            continue;
        }
        if !action_matches(&rule.action, action) {
            continue;
        }
        if !resource_type_matches(&rule.resource_type, resource_type) {
            continue;
        }
        if !resource_id_matches(rule.resource_id, resource_id) {
            continue;
        }
        if !subject_matches(rule, ctx) {
            continue;
        }
        matched.push(MatchedRule {
            source: RuleSource::Acl {
                id: rule.id,
                subject_type: rule.subject_type.clone(),
            },
            effect: rule.effect,
            reason: rule
                .reason
                .clone()
                .unwrap_or_else(|| format!("{} on {}", rule.action, rule.resource_type)),
        });
    }

    // 2. Inheritance via assignments (only when resource_id is precise).
    if let Some(rid) = resource_id {
        for inh in inheritance {
            if let Some(effect) = inheritance_effect(&inh.role, action) {
                // inheritance only applies to the resource_id = rid with
                // subject_type = person (we match against the caller's
                // person_id); for node/group/site roles, we'd need to
                // check if the caller is a member — delegated to caller.
                if inh.subject_type == "person" && Some(inh.subject_id) == ctx.person_id {
                    matched.push(MatchedRule {
                        source: RuleSource::InheritedFromAssignment {
                            role: inh.role.clone(),
                        },
                        effect,
                        reason: format!(
                            "person is {} of resource {}",
                            inh.role, rid
                        ),
                    });
                }
            }
        }
    }

    // 3. Apply deny wins.
    let has_deny = matched.iter().any(|m| m.effect == AclEffect::Deny);
    if has_deny {
        return AclDecision {
            allow: false,
            matched,
            source: "deny_wins",
        };
    }
    let has_allow = matched.iter().any(|m| m.effect == AclEffect::Allow);
    if has_allow {
        return AclDecision {
            allow: true,
            matched,
            source: "allow",
        };
    }

    AclDecision {
        allow: false,
        matched,
        source: "implicit_deny",
    }
}

fn action_matches(rule_action: &str, want: AclAction) -> bool {
    rule_action == "*" || rule_action == want.as_str()
}

fn resource_type_matches(rule_type: &str, want: &str) -> bool {
    rule_type == "*" || rule_type == want
}

fn resource_id_matches(rule_id: Option<Uuid>, want: Option<Uuid>) -> bool {
    match (rule_id, want) {
        // Wildcard rule matches every target.
        (None, _) => true,
        // Rule targets a specific UUID — the want must match.
        (Some(rid), Some(wid)) => rid == wid,
        // Rule is targeted but want is unspecified (e.g. `list`) — no match.
        (Some(_), None) => false,
    }
}

fn subject_matches(rule: &AclEntry, ctx: &AclSubjectCtx) -> bool {
    match rule.subject_type.as_str() {
        "everyone" => true,
        "auth_user" => ctx.person_id.is_some(),
        "person" => rule.subject_id == ctx.person_id,
        "group" => rule
            .subject_id
            .is_some_and(|gid| ctx.group_ids.contains(&gid)),
        "role" => {
            let Some(ref role_name) = rule.subject_ref else {
                return false;
            };
            ctx.roles.iter().any(|r| r == role_name)
        }
        _ => false,
    }
}

/// Return the implicit effect granted by being in a given role.
fn inheritance_effect(role: &str, action: AclAction) -> Option<AclEffect> {
    use AclAction::{Assign, Read, Renew, Transition, Unassign, Update};
    match role {
        "owner" => match action {
            Read | Update | Assign | Unassign | Transition | Renew => Some(AclEffect::Allow),
            _ => None,
        },
        "caretaker" => match action {
            Read | Update | Transition | Renew => Some(AclEffect::Allow),
            _ => None,
        },
        "primary_user" | "secondary_user" => match action {
            Read => Some(AclEffect::Allow),
            _ => None,
        },
        _ => None,
    }
}

// ─── Cache ────────────────────────────────────────────────────────────

/// Cache key — scoped by user + action + resource type + resource id.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct AclCacheKey {
    /// Person UUID (anonymous → nil).
    pub person_id: Uuid,
    /// Tenant.
    pub tenant_id: Uuid,
    /// Action.
    pub action: AclAction,
    /// Resource type (owned String — `&'static str` ne suffit pas pour les
    /// types dynamiques comme `'site'` ou `'document'`).
    pub resource_type: String,
    /// Resource UUID (nil quand on demande pour un wildcard).
    pub resource_id: Uuid,
}

/// Cached outcome — just the boolean, le resolver rebuild les matched
/// quand il sert une entrée.
#[derive(Debug, Clone, Copy)]
pub struct AclCached {
    /// Result of the check.
    pub allow: bool,
}

/// Thin wrapper autour de `moka::Cache`.
pub struct AclDecisionCache {
    inner: Cache<AclCacheKey, AclCached>,
}

impl AclDecisionCache {
    /// Build a new cache with a fixed TTL.
    #[must_use]
    pub fn new(ttl_secs: u64) -> Self {
        Self {
            inner: Cache::builder()
                .max_capacity(50_000)
                .time_to_live(Duration::from_secs(ttl_secs))
                .build(),
        }
    }

    /// Lookup.
    pub async fn get(&self, key: &AclCacheKey) -> Option<AclCached> {
        self.inner.get(key).await
    }

    /// Insert.
    pub async fn put(&self, key: AclCacheKey, v: AclCached) {
        self.inner.insert(key, v).await;
    }

    /// Invalidate all (on `org.acl.updated`).
    pub async fn invalidate_all(&self) {
        self.inner.invalidate_all();
    }

    /// Invalidate entries that target a given resource.
    pub async fn invalidate_resource(&self, resource_type: &str, resource_id: Uuid) {
        let rt = resource_type.to_string();
        if let Err(e) = self
            .inner
            .invalidate_entries_if(move |k, _| k.resource_type == rt && k.resource_id == resource_id)
        {
            tracing::warn!(?e, "acl cache invalidate_resource failed");
        }
    }

    /// Current number of cached entries (metrics + tests).
    #[must_use]
    pub fn entry_count(&self) -> u64 {
        self.inner.entry_count()
    }
}

// ─── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn person_ctx(tenant: Uuid, person: Uuid) -> AclSubjectCtx {
        AclSubjectCtx {
            person_id: Some(person),
            tenant_id: tenant,
            roles: Vec::new(),
            group_ids: Vec::new(),
            is_global_admin: false,
        }
    }

    fn acl(
        subject_type: &str,
        subject_id: Option<Uuid>,
        subject_ref: Option<&str>,
        action: &str,
        resource_type: &str,
        resource_id: Option<Uuid>,
        effect: AclEffect,
    ) -> AclEntry {
        AclEntry {
            id: Uuid::new_v4(),
            subject_type: subject_type.into(),
            subject_id,
            subject_ref: subject_ref.map(str::to_string),
            action: action.into(),
            resource_type: resource_type.into(),
            resource_id,
            effect,
            reason: None,
            is_valid: true,
        }
    }

    #[test]
    fn global_admin_allows_everything() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let mut ctx = person_ctx(t, p);
        ctx.is_global_admin = true;

        let d = resolve(&ctx, AclAction::Delete, "resource", None, &[], &[]);
        assert!(d.allow);
        assert_eq!(d.source, "global_admin");
    }

    #[test]
    fn implicit_deny_when_no_rules() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let ctx = person_ctx(t, p);
        let d = resolve(&ctx, AclAction::Read, "resource", None, &[], &[]);
        assert!(!d.allow);
        assert_eq!(d.source, "implicit_deny");
    }

    #[test]
    fn explicit_allow_person_on_resource_type_wildcard() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let ctx = person_ctx(t, p);
        let acls = [acl(
            "person",
            Some(p),
            None,
            "read",
            "resource",
            None,
            AclEffect::Allow,
        )];
        let d = resolve(&ctx, AclAction::Read, "resource", None, &acls, &[]);
        assert!(d.allow);
        assert_eq!(d.source, "allow");
    }

    #[test]
    fn explicit_deny_beats_allow() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let ctx = person_ctx(t, p);
        let r = Uuid::new_v4();
        let acls = [
            acl(
                "everyone",
                None,
                None,
                "read",
                "resource",
                None,
                AclEffect::Allow,
            ),
            acl(
                "person",
                Some(p),
                None,
                "read",
                "resource",
                Some(r),
                AclEffect::Deny,
            ),
        ];
        let d = resolve(&ctx, AclAction::Read, "resource", Some(r), &acls, &[]);
        assert!(!d.allow);
        assert_eq!(d.source, "deny_wins");
    }

    #[test]
    fn group_subject_matches_when_person_in_group() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let g = Uuid::new_v4();
        let mut ctx = person_ctx(t, p);
        ctx.group_ids = vec![g];
        let acls = [acl(
            "group",
            Some(g),
            None,
            "read",
            "resource",
            None,
            AclEffect::Allow,
        )];
        let d = resolve(&ctx, AclAction::Read, "resource", None, &acls, &[]);
        assert!(d.allow);
    }

    #[test]
    fn role_subject_matches_when_person_has_role() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let mut ctx = person_ctx(t, p);
        ctx.roles = vec!["vehicle_manager".into()];
        let acls = [acl(
            "role",
            None,
            Some("vehicle_manager"),
            "*",
            "resource",
            None,
            AclEffect::Allow,
        )];
        let d = resolve(&ctx, AclAction::Delete, "resource", None, &acls, &[]);
        assert!(d.allow);
    }

    #[test]
    fn role_subject_no_match_when_role_absent() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let ctx = person_ctx(t, p);
        let acls = [acl(
            "role",
            None,
            Some("vehicle_manager"),
            "*",
            "resource",
            None,
            AclEffect::Allow,
        )];
        let d = resolve(&ctx, AclAction::Delete, "resource", None, &acls, &[]);
        assert!(!d.allow);
    }

    #[test]
    fn auth_user_subject_matches_when_logged_in() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let ctx = person_ctx(t, p);
        let acls = [acl(
            "auth_user",
            None,
            None,
            "read",
            "resource",
            None,
            AclEffect::Allow,
        )];
        let d = resolve(&ctx, AclAction::Read, "resource", None, &acls, &[]);
        assert!(d.allow);
    }

    #[test]
    fn auth_user_subject_no_match_for_anonymous() {
        let t = Uuid::new_v4();
        let mut ctx = person_ctx(t, Uuid::nil());
        ctx.person_id = None;
        let acls = [acl(
            "auth_user",
            None,
            None,
            "read",
            "resource",
            None,
            AclEffect::Allow,
        )];
        let d = resolve(&ctx, AclAction::Read, "resource", None, &acls, &[]);
        assert!(!d.allow);
    }

    #[test]
    fn inheritance_owner_allows_update() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let ctx = person_ctx(t, p);
        let r = Uuid::new_v4();
        let inh = [AssignmentInheritance {
            role: "owner".into(),
            subject_type: "person".into(),
            subject_id: p,
        }];
        let d = resolve(&ctx, AclAction::Update, "resource", Some(r), &[], &inh);
        assert!(d.allow);
        assert_eq!(d.source, "allow");
    }

    #[test]
    fn inheritance_primary_user_only_allows_read() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let ctx = person_ctx(t, p);
        let r = Uuid::new_v4();
        let inh = [AssignmentInheritance {
            role: "primary_user".into(),
            subject_type: "person".into(),
            subject_id: p,
        }];
        assert!(resolve(&ctx, AclAction::Read, "resource", Some(r), &[], &inh).allow);
        assert!(!resolve(&ctx, AclAction::Update, "resource", Some(r), &[], &inh).allow);
    }

    #[test]
    fn inheritance_caretaker_allows_transition_and_renew() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let ctx = person_ctx(t, p);
        let r = Uuid::new_v4();
        let inh = [AssignmentInheritance {
            role: "caretaker".into(),
            subject_type: "person".into(),
            subject_id: p,
        }];
        assert!(resolve(&ctx, AclAction::Transition, "resource", Some(r), &[], &inh).allow);
        assert!(resolve(&ctx, AclAction::Renew, "resource", Some(r), &[], &inh).allow);
        assert!(!resolve(&ctx, AclAction::Delete, "resource", Some(r), &[], &inh).allow);
    }

    #[test]
    fn temporal_validity_disables_rule() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let ctx = person_ctx(t, p);
        let mut rule = acl(
            "person",
            Some(p),
            None,
            "read",
            "resource",
            None,
            AclEffect::Allow,
        );
        rule.is_valid = false;
        let d = resolve(&ctx, AclAction::Read, "resource", None, &[rule], &[]);
        assert!(!d.allow);
    }

    #[test]
    fn wildcard_resource_type_matches_specific() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let ctx = person_ctx(t, p);
        let acls = [acl(
            "person",
            Some(p),
            None,
            "read",
            "*",
            None,
            AclEffect::Allow,
        )];
        let d = resolve(&ctx, AclAction::Read, "resource", None, &acls, &[]);
        assert!(d.allow);
    }

    #[test]
    fn specific_resource_id_only_matches_exact_uuid() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let ctx = person_ctx(t, p);
        let r1 = Uuid::new_v4();
        let r2 = Uuid::new_v4();
        let acls = [acl(
            "person",
            Some(p),
            None,
            "read",
            "resource",
            Some(r1),
            AclEffect::Allow,
        )];
        assert!(resolve(&ctx, AclAction::Read, "resource", Some(r1), &acls, &[]).allow);
        assert!(!resolve(&ctx, AclAction::Read, "resource", Some(r2), &acls, &[]).allow);
    }

    #[test]
    fn action_wildcard_matches_all_actions() {
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let ctx = person_ctx(t, p);
        let acls = [acl(
            "person",
            Some(p),
            None,
            "*",
            "resource",
            None,
            AclEffect::Allow,
        )];
        for a in [
            AclAction::Create,
            AclAction::Read,
            AclAction::Update,
            AclAction::Delete,
            AclAction::Transition,
            AclAction::Renew,
        ] {
            assert!(resolve(&ctx, a, "resource", None, &acls, &[]).allow);
        }
    }

    #[test]
    fn everyone_allows_anonymous() {
        let t = Uuid::new_v4();
        let mut ctx = person_ctx(t, Uuid::nil());
        ctx.person_id = None;
        let acls = [acl(
            "everyone",
            None,
            None,
            "read",
            "resource",
            None,
            AclEffect::Allow,
        )];
        let d = resolve(&ctx, AclAction::Read, "resource", None, &acls, &[]);
        assert!(d.allow);
    }

    #[test]
    fn inheritance_deny_not_applicable() {
        // Inheritance produces only `Allow` effects — never `Deny`.
        // Adding a deny-only ACL still trumps the allow.
        let t = Uuid::new_v4();
        let p = Uuid::new_v4();
        let ctx = person_ctx(t, p);
        let r = Uuid::new_v4();
        let inh = [AssignmentInheritance {
            role: "owner".into(),
            subject_type: "person".into(),
            subject_id: p,
        }];
        let acls = [acl(
            "person",
            Some(p),
            None,
            "update",
            "resource",
            Some(r),
            AclEffect::Deny,
        )];
        let d = resolve(&ctx, AclAction::Update, "resource", Some(r), &acls, &inh);
        assert!(!d.allow);
        assert_eq!(d.source, "deny_wins");
    }

    #[tokio::test]
    async fn cache_get_put_roundtrip() {
        let cache = AclDecisionCache::new(60);
        let key = AclCacheKey {
            person_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            action: AclAction::Read,
            resource_type: "resource".into(),
            resource_id: Uuid::new_v4(),
        };
        assert!(cache.get(&key).await.is_none());
        cache.put(key.clone(), AclCached { allow: true }).await;
        cache.inner.run_pending_tasks().await;
        let hit = cache.get(&key).await.expect("cached");
        assert!(hit.allow);
    }

    #[tokio::test]
    async fn cache_invalidate_all_drops_entries() {
        let cache = AclDecisionCache::new(60);
        let rid = Uuid::new_v4();
        let key = AclCacheKey {
            person_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            action: AclAction::Read,
            resource_type: "resource".into(),
            resource_id: rid,
        };
        cache.put(key.clone(), AclCached { allow: true }).await;
        cache.inner.run_pending_tasks().await;
        assert_eq!(cache.entry_count(), 1);
        cache.invalidate_all().await;
        cache.inner.run_pending_tasks().await;
        assert!(cache.get(&key).await.is_none());
    }

    #[test]
    fn action_roundtrip() {
        for a in [
            AclAction::Create,
            AclAction::Read,
            AclAction::Update,
            AclAction::Delete,
            AclAction::List,
            AclAction::Assign,
            AclAction::Unassign,
            AclAction::Transition,
            AclAction::Renew,
        ] {
            assert_eq!(AclAction::parse(a.as_str()).unwrap(), a);
        }
    }
}
