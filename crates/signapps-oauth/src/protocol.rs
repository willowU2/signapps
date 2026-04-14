//! OAuth protocol and related enums.

/// The OAuth/OIDC/SAML wire protocol variant for a provider.
///
/// Placeholder — fully defined in Task 3.
#[allow(dead_code)]
pub enum Protocol {
    /// Standard OAuth 2.0 authorization code flow.
    OAuth2,
    /// OpenID Connect (OAuth2 + ID token).
    Oidc,
    /// SAML 2.0 SSO.
    Saml2,
}

/// High-level category grouping providers for UI display and org policy.
///
/// Placeholder — fully defined in Task 3.
#[allow(dead_code)]
pub enum ProviderCategory {
    /// Productivity suites (Google Workspace, Microsoft 365, etc.).
    Productivity,
    /// Developer tools (GitHub, GitLab, Bitbucket, etc.).
    Developer,
    /// Identity providers (Okta, Auth0, Azure AD, etc.).
    Identity,
    /// Custom / enterprise OIDC or SAML endpoint.
    Custom,
}

/// The purpose for which an OAuth token is being requested.
///
/// Placeholder — fully defined in Task 3.
#[allow(dead_code)]
pub enum OAuthPurpose {
    /// Single-sign-on login flow.
    Login,
    /// Connecting a provider to enrich user data / import calendar, mail, etc.
    Connect,
    /// Admin-level consent grant (tenant-wide).
    AdminConsent,
}

/// Where the access token is expected by the upstream API.
///
/// Placeholder — fully defined in Task 3.
#[allow(dead_code)]
pub enum TokenPlacement {
    /// Standard `Authorization: Bearer <token>` header.
    BearerHeader,
    /// URL query parameter (legacy APIs).
    QueryParam,
}
