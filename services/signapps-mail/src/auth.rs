use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use oauth2::{
    basic::BasicClient, reqwest::async_http_client, AuthUrl, AuthorizationCode, ClientId,
    ClientSecret, CsrfToken, RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use serde::{Deserialize, Serialize};
use std::env;

use crate::models::MailAccount;
use crate::AppState;

// ---------------------------------------------------------------------------
// Provider enum
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy)]
pub enum OAuthProvider {
    Google,
    Microsoft,
}

impl OAuthProvider {
    fn auth_url(&self) -> &'static str {
        match self {
            OAuthProvider::Google => "https://accounts.google.com/o/oauth2/v2/auth",
            OAuthProvider::Microsoft => {
                "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
            },
        }
    }

    fn token_url(&self) -> &'static str {
        match self {
            OAuthProvider::Google => "https://oauth2.googleapis.com/token",
            OAuthProvider::Microsoft => {
                "https://login.microsoftonline.com/common/oauth2/v2.0/token"
            },
        }
    }

    fn userinfo_url(&self) -> &'static str {
        match self {
            OAuthProvider::Google => "https://www.googleapis.com/oauth2/v2/userinfo",
            OAuthProvider::Microsoft => "https://graph.microsoft.com/v1.0/me",
        }
    }

    fn client_id_env(&self) -> &'static str {
        match self {
            OAuthProvider::Google => "GOOGLE_CLIENT_ID",
            OAuthProvider::Microsoft => "MICROSOFT_CLIENT_ID",
        }
    }

    fn client_secret_env(&self) -> &'static str {
        match self {
            OAuthProvider::Google => "GOOGLE_CLIENT_SECRET",
            OAuthProvider::Microsoft => "MICROSOFT_CLIENT_SECRET",
        }
    }

    fn redirect_uri(&self) -> &'static str {
        match self {
            OAuthProvider::Google => "http://localhost:3000/mail/callback/google",
            OAuthProvider::Microsoft => "http://localhost:3000/mail/callback/microsoft",
        }
    }

    fn scopes(&self) -> Vec<&'static str> {
        match self {
            OAuthProvider::Google => vec![
                "https://mail.google.com/",
                "https://www.googleapis.com/auth/userinfo.email",
            ],
            OAuthProvider::Microsoft => vec![
                "https://graph.microsoft.com/Mail.ReadWrite",
                "https://graph.microsoft.com/Mail.Send",
                "https://graph.microsoft.com/User.Read",
                "offline_access",
            ],
        }
    }

    fn imap_server(&self) -> &'static str {
        match self {
            OAuthProvider::Google => "imap.gmail.com",
            OAuthProvider::Microsoft => "outlook.office365.com",
        }
    }

    fn name(&self) -> &'static str {
        match self {
            OAuthProvider::Google => "google",
            OAuthProvider::Microsoft => "microsoft",
        }
    }
}

// ---------------------------------------------------------------------------
// Build OAuth2 client for a given provider
// ---------------------------------------------------------------------------

pub fn oauth_client_for(provider: OAuthProvider) -> BasicClient {
    let client_id = ClientId::new(
        env::var(provider.client_id_env()).unwrap_or_else(|_| "dummy_client_id".to_string()),
    );
    let client_secret = ClientSecret::new(
        env::var(provider.client_secret_env())
            .unwrap_or_else(|_| "dummy_client_secret".to_string()),
    );
    let auth_url =
        AuthUrl::new(provider.auth_url().to_string()).expect("Invalid authorization endpoint URL");
    let token_url =
        TokenUrl::new(provider.token_url().to_string()).expect("Invalid token endpoint URL");

    BasicClient::new(client_id, Some(client_secret), auth_url, Some(token_url)).set_redirect_uri(
        RedirectUrl::new(provider.redirect_uri().to_string()).expect("Invalid redirect URL"),
    )
}

/// Kept for backward compatibility with any existing callers.
pub fn oauth_client() -> BasicClient {
    oauth_client_for(OAuthProvider::Google)
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct AuthUrlResponse {
    pub url: String,
}

#[derive(Deserialize)]
pub struct AuthCallbackRequest {
    pub code: String,
    pub user_id: uuid::Uuid,
}

#[derive(Deserialize)]
struct GoogleUserProfile {
    email: String,
}

#[derive(Deserialize)]
struct MicrosoftUserProfile {
    #[serde(rename = "userPrincipalName")]
    user_principal_name: Option<String>,
    mail: Option<String>,
}

// ---------------------------------------------------------------------------
// Login URL handlers — /oauth/google/login  and  /oauth/microsoft/login
// ---------------------------------------------------------------------------

pub async fn oauth_google_login() -> impl IntoResponse {
    oauth_login_url_for(OAuthProvider::Google).await
}

pub async fn oauth_microsoft_login() -> impl IntoResponse {
    oauth_login_url_for(OAuthProvider::Microsoft).await
}

/// Legacy single-provider endpoint kept for backward compatibility.
pub async fn oauth_login_url() -> impl IntoResponse {
    oauth_login_url_for(OAuthProvider::Google).await
}

async fn oauth_login_url_for(provider: OAuthProvider) -> impl IntoResponse {
    let client = oauth_client_for(provider);
    let mut req = client.authorize_url(CsrfToken::new_random);
    for scope in provider.scopes() {
        req = req.add_scope(Scope::new(scope.to_string()));
    }
    req = req
        .add_extra_param("access_type", "offline")
        .add_extra_param("prompt", "consent");
    let (authorize_url, _csrf_state) = req.url();
    Json(AuthUrlResponse {
        url: authorize_url.to_string(),
    })
}

// ---------------------------------------------------------------------------
// Callback handlers — /oauth/google/callback  and  /oauth/microsoft/callback
// ---------------------------------------------------------------------------

pub async fn oauth_google_callback(
    state: State<AppState>,
    body: Json<AuthCallbackRequest>,
) -> impl IntoResponse {
    oauth_callback_for(state, body, OAuthProvider::Google).await
}

pub async fn oauth_microsoft_callback(
    state: State<AppState>,
    body: Json<AuthCallbackRequest>,
) -> impl IntoResponse {
    oauth_callback_for(state, body, OAuthProvider::Microsoft).await
}

/// Legacy single-provider callback (defaults to Google).
pub async fn oauth_callback(
    state: State<AppState>,
    body: Json<AuthCallbackRequest>,
) -> impl IntoResponse {
    oauth_callback_for(state, body, OAuthProvider::Google).await
}

async fn oauth_callback_for(
    State(state): State<AppState>,
    Json(payload): Json<AuthCallbackRequest>,
    provider: OAuthProvider,
) -> impl IntoResponse {
    let client = oauth_client_for(provider);
    let token_result = client
        .exchange_code(AuthorizationCode::new(payload.code))
        .request_async(async_http_client)
        .await;

    let token = match token_result {
        Ok(t) => t,
        Err(e) => {
            tracing::error!(
                "OAuth token exchange failed ({:?}): {:?}",
                provider.name(),
                e
            );
            return StatusCode::BAD_REQUEST.into_response();
        },
    };

    let access_token = token.access_token().secret().clone();
    let refresh_token = token
        .refresh_token()
        .map(|rt| rt.secret().clone())
        .unwrap_or_default();

    // Fetch user profile to get their email address
    let http_client = reqwest::Client::new();
    let profile_resp = http_client
        .get(provider.userinfo_url())
        .bearer_auth(&access_token)
        .send()
        .await;

    let email = match profile_resp {
        Ok(resp) => match provider {
            OAuthProvider::Google => {
                if let Ok(profile) = resp.json::<GoogleUserProfile>().await {
                    profile.email
                } else {
                    return StatusCode::INTERNAL_SERVER_ERROR.into_response();
                }
            },
            OAuthProvider::Microsoft => {
                if let Ok(profile) = resp.json::<MicrosoftUserProfile>().await {
                    profile
                        .mail
                        .or(profile.user_principal_name)
                        .unwrap_or_default()
                } else {
                    return StatusCode::INTERNAL_SERVER_ERROR.into_response();
                }
            },
        },
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    // Upsert the mail account in the database.
    let account = sqlx::query_as::<_, MailAccount>(
        r#"
        INSERT INTO mail_accounts (
            user_id, email_address, provider, imap_server, imap_port, oauth_token, oauth_refresh_token
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, email_address) DO UPDATE SET
            oauth_token = EXCLUDED.oauth_token,
            oauth_refresh_token = CASE
                WHEN EXCLUDED.oauth_refresh_token != '' THEN EXCLUDED.oauth_refresh_token
                ELSE mail_accounts.oauth_refresh_token
            END,
            provider = EXCLUDED.provider,
            imap_server = EXCLUDED.imap_server,
            imap_port = EXCLUDED.imap_port,
            status = 'active'
        RETURNING *
        "#,
    )
    .bind(payload.user_id)
    .bind(&email)
    .bind(provider.name())
    .bind(provider.imap_server())
    .bind(993)
    .bind(&access_token)
    .bind(&refresh_token)
    .fetch_one(&state.pool)
    .await;

    match account {
        Ok(acc) => Json(acc).into_response(),
        Err(e) => {
            tracing::error!("Failed to save oauth account: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        },
    }
}
