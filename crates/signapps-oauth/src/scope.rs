//! Scope resolver — org-aware provider visibility + scope filtering.

use crate::error::OAuthError;
use crate::protocol::OAuthPurpose;
use crate::provider::ProviderConfig;
use uuid::Uuid;

/// Snapshot of an user's org context for visibility checks.
///
/// Supplied by the caller (typically assembled from `signapps-db-identity`'s
/// org graph). `ScopeResolver` is agnostic to how the context is fetched.
#[derive(Debug, Clone)]
pub struct UserContext {
    /// The user.
    pub user_id: Uuid,
    /// Org nodes the user belongs to (departments, business units, ...).
    pub org_nodes: Vec<Uuid>,
    /// Cross-functional groups the user is a member of.
    pub groups: Vec<Uuid>,
    /// RBAC roles (admin, manager, user, ...).
    pub roles: Vec<String>,
}

/// Evaluates provider visibility, purpose allowance, and scope filtering.
///
/// Stateless — every check takes the `ProviderConfig` and `UserContext`
/// by reference; the resolver itself holds no state.
#[derive(Debug, Default, Clone, Copy)]
pub struct ScopeResolver;

impl ScopeResolver {
    /// Check whether the user has access to a provider based on the
    /// provider's visibility rules and the user's org context.
    ///
    /// Visibility = OR between (org_nodes ∪ groups ∪ roles) + override
    /// via `visible_to_users` (nominal whitelist, highest priority).
    ///
    /// # Errors
    ///
    /// Returns [`OAuthError::UserAccessDenied`] if the user is not
    /// allowed to use this provider.
    pub fn check_user_access(
        user_ctx: &UserContext,
        config: &ProviderConfig,
    ) -> Result<(), OAuthError> {
        // visible_to_users is a nominal override — highest priority.
        if config.visible_to_users.contains(&user_ctx.user_id) {
            return Ok(());
        }

        if config.visibility == "all" {
            return Ok(());
        }

        // "restricted" — OR between the 4 criteria.
        let allowed = config
            .visible_to_org_nodes
            .iter()
            .any(|n| user_ctx.org_nodes.contains(n))
            || config
                .visible_to_groups
                .iter()
                .any(|g| user_ctx.groups.contains(g))
            || config
                .visible_to_roles
                .iter()
                .any(|r| user_ctx.roles.contains(r));

        if allowed {
            Ok(())
        } else {
            Err(OAuthError::UserAccessDenied)
        }
    }

    /// Check whether the given purpose is allowed for this provider.
    ///
    /// # Errors
    ///
    /// Returns [`OAuthError::PurposeNotAllowed`] if the purpose is not
    /// in the config's `purposes` array.
    pub fn check_purpose_allowed(
        config: &ProviderConfig,
        purpose: OAuthPurpose,
    ) -> Result<(), OAuthError> {
        if !config.purposes.iter().any(|p| p == purpose.as_str()) {
            return Err(OAuthError::PurposeNotAllowed(purpose));
        }
        Ok(())
    }

    /// Validate that every requested scope is in `allowed_scopes`.
    ///
    /// # Errors
    ///
    /// Returns [`OAuthError::ScopeNotAllowed`] on the first scope not in
    /// the config's allowed list.
    pub fn filter_scopes(
        requested: &[String],
        config: &ProviderConfig,
    ) -> Result<Vec<String>, OAuthError> {
        for scope in requested {
            if !config.allowed_scopes.contains(scope) {
                return Err(OAuthError::ScopeNotAllowed(scope.clone()));
            }
        }
        Ok(requested.to_vec())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk_config(
        visibility: &str,
        nodes: Vec<Uuid>,
        groups: Vec<Uuid>,
        roles: Vec<&str>,
        users: Vec<Uuid>,
        purposes: Vec<&str>,
        allowed_scopes: Vec<&str>,
    ) -> ProviderConfig {
        ProviderConfig {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            provider_key: "test".into(),
            client_id_enc: None,
            client_secret_enc: None,
            extra_params_enc: None,
            enabled: true,
            purposes: purposes.into_iter().map(String::from).collect(),
            allowed_scopes: allowed_scopes.into_iter().map(String::from).collect(),
            visibility: visibility.into(),
            visible_to_org_nodes: nodes,
            visible_to_groups: groups,
            visible_to_roles: roles.into_iter().map(String::from).collect(),
            visible_to_users: users,
            allow_user_override: false,
            is_tenant_sso: false,
            auto_provision_users: false,
            default_role: None,
        }
    }

    fn mk_user(nodes: Vec<Uuid>, groups: Vec<Uuid>, roles: Vec<&str>) -> UserContext {
        UserContext {
            user_id: Uuid::new_v4(),
            org_nodes: nodes,
            groups,
            roles: roles.into_iter().map(String::from).collect(),
        }
    }

    #[test]
    fn visibility_all_accepts_everyone() {
        let config = mk_config("all", vec![], vec![], vec![], vec![], vec![], vec![]);
        let user = mk_user(vec![], vec![], vec![]);
        ScopeResolver::check_user_access(&user, &config).unwrap();
    }

    #[test]
    fn visibility_restricted_rejects_orphan_user() {
        let node = Uuid::new_v4();
        let config = mk_config("restricted", vec![node], vec![], vec![], vec![], vec![], vec![]);
        let user = mk_user(vec![Uuid::new_v4()], vec![], vec![]);
        let err = ScopeResolver::check_user_access(&user, &config).unwrap_err();
        assert!(matches!(err, OAuthError::UserAccessDenied));
    }

    #[test]
    fn visibility_restricted_accepts_matching_node() {
        let node = Uuid::new_v4();
        let config = mk_config("restricted", vec![node], vec![], vec![], vec![], vec![], vec![]);
        let user = mk_user(vec![node], vec![], vec![]);
        ScopeResolver::check_user_access(&user, &config).unwrap();
    }

    #[test]
    fn user_override_wins_over_visibility() {
        let user_id = Uuid::new_v4();
        // Config is restricted to a node the user doesn't belong to,
        // BUT user is in visible_to_users.
        let config = mk_config(
            "restricted",
            vec![Uuid::new_v4()],
            vec![],
            vec![],
            vec![user_id],
            vec![],
            vec![],
        );
        let user = UserContext {
            user_id,
            org_nodes: vec![],
            groups: vec![],
            roles: vec![],
        };
        ScopeResolver::check_user_access(&user, &config).unwrap();
    }

    #[test]
    fn visibility_by_role() {
        let config = mk_config(
            "restricted",
            vec![],
            vec![],
            vec!["admin"],
            vec![],
            vec![],
            vec![],
        );
        let user = mk_user(vec![], vec![], vec!["admin", "user"]);
        ScopeResolver::check_user_access(&user, &config).unwrap();

        let user2 = mk_user(vec![], vec![], vec!["user"]);
        let err = ScopeResolver::check_user_access(&user2, &config).unwrap_err();
        assert!(matches!(err, OAuthError::UserAccessDenied));
    }

    #[test]
    fn purpose_allowed() {
        let config = mk_config("all", vec![], vec![], vec![], vec![], vec!["login"], vec![]);
        ScopeResolver::check_purpose_allowed(&config, OAuthPurpose::Login).unwrap();

        let err = ScopeResolver::check_purpose_allowed(&config, OAuthPurpose::Integration)
            .unwrap_err();
        assert!(matches!(err, OAuthError::PurposeNotAllowed(OAuthPurpose::Integration)));
    }

    #[test]
    fn filter_scopes_passthrough_when_allowed() {
        let config = mk_config(
            "all",
            vec![],
            vec![],
            vec![],
            vec![],
            vec![],
            vec!["email", "profile", "openid"],
        );
        let requested = vec!["email".into(), "openid".into()];
        let out = ScopeResolver::filter_scopes(&requested, &config).unwrap();
        assert_eq!(out, requested);
    }

    #[test]
    fn filter_scopes_rejects_disallowed() {
        let config = mk_config("all", vec![], vec![], vec![], vec![], vec![], vec!["email"]);
        let requested = vec!["email".into(), "admin".into()];
        let err = ScopeResolver::filter_scopes(&requested, &config).unwrap_err();
        assert!(matches!(err, OAuthError::ScopeNotAllowed(s) if s == "admin"));
    }
}
