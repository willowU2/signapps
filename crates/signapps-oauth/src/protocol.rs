//! OAuth protocol and related enums.

use serde::{Deserialize, Serialize};

/// Supported OAuth-family protocols.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Protocol {
    /// OAuth 2.0 authorization code grant.
    OAuth2,
    /// OAuth 1.0a (legacy, Twitter v1a, Trello).
    OAuth1a,
    /// OpenID Connect (OAuth 2.0 + id_token).
    Oidc,
    /// SAML 2.0 (POST binding).
    Saml,
}

/// Why is the user going through this OAuth flow?
///
/// Login = establishing a session via SSO.
/// Integration = adding a connected account (mail, calendar, drive, ...).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OAuthPurpose {
    /// Authenticating a user for session / login (SSO).
    Login,
    /// Connecting a third-party service for ongoing API use.
    Integration,
}

impl OAuthPurpose {
    /// Short string representation for DB storage and admin UI.
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Login => "login",
            Self::Integration => "integration",
        }
    }
}

/// Provider category for admin UI grouping and catalog filtering.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProviderCategory {
    /// Email providers (Gmail, Outlook, Fastmail, ...).
    Mail,
    /// Calendar providers (Google Calendar, Microsoft Graph, ...).
    Calendar,
    /// File storage / drive (Google Drive, OneDrive, Dropbox, ...).
    Drive,
    /// Social media (Twitter, LinkedIn, Facebook, ...).
    Social,
    /// Enterprise or consumer SSO (Okta, Keycloak, GitHub, ...).
    Sso,
    /// Chat / messaging (Slack, Discord, Teams, ...).
    Chat,
    /// Developer platforms (GitHub, GitLab, Bitbucket, ...).
    Dev,
    /// CRM / customer data (Salesforce, HubSpot, ...).
    Crm,
    /// Everything else.
    Other,
}

/// Where the access token is placed on outgoing API calls.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum TokenPlacement {
    /// `Authorization: Bearer <token>` header (default for most providers).
    #[default]
    Header,
    /// `?access_token=<token>` query string.
    Query,
    /// Form body `access_token=<token>`.
    Body,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn purpose_as_str_roundtrip() {
        assert_eq!(OAuthPurpose::Login.as_str(), "login");
        assert_eq!(OAuthPurpose::Integration.as_str(), "integration");
    }

    #[test]
    fn purpose_serde() {
        let json = serde_json::to_string(&OAuthPurpose::Login).unwrap();
        assert_eq!(json, "\"login\"");
        let back: OAuthPurpose = serde_json::from_str("\"integration\"").unwrap();
        assert_eq!(back, OAuthPurpose::Integration);
    }

    #[test]
    fn protocol_serde() {
        let json = serde_json::to_string(&Protocol::OAuth2).unwrap();
        assert_eq!(json, "\"OAuth2\"");
        let back: Protocol = serde_json::from_str("\"Oidc\"").unwrap();
        assert_eq!(back, Protocol::Oidc);
    }

    #[test]
    fn token_placement_default_is_header() {
        assert_eq!(TokenPlacement::default(), TokenPlacement::Header);
    }
}
