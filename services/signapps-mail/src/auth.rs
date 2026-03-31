use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use chrono::Utc;
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
/// Enum representing OAuthProvider variants.
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
                "https://www.googleapis.com/auth/gmail.send",
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

/// Ensure the mail.oauth_app_configs table exists (auto-migrate).
pub async fn ensure_oauth_configs_table(pool: &sqlx::Pool<sqlx::Postgres>) {
    let _ = sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS mail.oauth_app_configs (
            platform    TEXT PRIMARY KEY,
            client_id   TEXT NOT NULL DEFAULT '',
            client_secret TEXT NOT NULL DEFAULT '',
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await;
}

/// Look up client_id / client_secret from DB first, fall back to env vars.
async fn resolve_credentials(
    pool: &sqlx::Pool<sqlx::Postgres>,
    provider: OAuthProvider,
) -> (String, String) {
    let platform = provider.name();
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT client_id, client_secret FROM mail.oauth_app_configs WHERE platform = $1",
    )
    .bind(platform)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    if let Some((id, secret)) = row {
        if !id.is_empty() && !secret.is_empty() {
            return (id, secret);
        }
    }

    // Fall back to environment variables
    let id = env::var(provider.client_id_env()).unwrap_or_default();
    let secret = env::var(provider.client_secret_env()).unwrap_or_default();
    (id, secret)
}

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

/// Build OAuth2 client using credentials resolved from DB first, then env vars.
async fn oauth_client_for_with_db(
    pool: &sqlx::Pool<sqlx::Postgres>,
    provider: OAuthProvider,
) -> BasicClient {
    let (id, secret) = resolve_credentials(pool, provider).await;
    let client_id = ClientId::new(if id.is_empty() {
        "dummy_client_id".to_string()
    } else {
        id
    });
    let client_secret = ClientSecret::new(if secret.is_empty() {
        "dummy_client_secret".to_string()
    } else {
        secret
    });
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
// OAuth app config management (save/read Google Client ID & Secret from DB)
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct OAuthAppConfigRequest {
    pub platform: String,
    pub client_id: String,
    pub client_secret: String,
}

#[derive(Serialize)]
pub struct OAuthAppConfigResponse {
    pub platform: String,
    pub client_id: String,
    pub configured: bool,
}

pub async fn get_oauth_config(
    State(state): State<AppState>,
    axum::extract::Path(platform): axum::extract::Path<String>,
) -> impl IntoResponse {
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT client_id, client_secret FROM mail.oauth_app_configs WHERE platform = $1",
    )
    .bind(&platform)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let (client_id, configured) = match row {
        Some((id, secret)) => (id.clone(), !id.is_empty() && !secret.is_empty()),
        None => (String::new(), false),
    };

    Json(OAuthAppConfigResponse {
        platform,
        client_id,
        configured,
    })
}

pub async fn save_oauth_config(
    State(state): State<AppState>,
    Json(payload): Json<OAuthAppConfigRequest>,
) -> impl IntoResponse {
    let result = sqlx::query(
        r#"
        INSERT INTO mail.oauth_app_configs (platform, client_id, client_secret, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (platform) DO UPDATE SET
            client_id = EXCLUDED.client_id,
            client_secret = EXCLUDED.client_secret,
            updated_at = NOW()
        "#,
    )
    .bind(&payload.platform)
    .bind(&payload.client_id)
    .bind(&payload.client_secret)
    .execute(&state.pool)
    .await;

    match result {
        Ok(_) => StatusCode::OK.into_response(),
        Err(e) => {
            tracing::error!("Failed to save OAuth config: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        },
    }
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Serialize)]
/// Response payload for AuthUrl operation.
pub struct AuthUrlResponse {
    pub url: String,
}

#[derive(Deserialize)]
/// Request payload for AuthCallback operation.
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

pub async fn oauth_google_login(State(state): State<AppState>) -> impl IntoResponse {
    oauth_login_url_for(&state.pool, OAuthProvider::Google).await
}

pub async fn oauth_microsoft_login(State(state): State<AppState>) -> impl IntoResponse {
    oauth_login_url_for(&state.pool, OAuthProvider::Microsoft).await
}

/// Legacy single-provider endpoint kept for backward compatibility.
pub async fn oauth_login_url(State(state): State<AppState>) -> impl IntoResponse {
    oauth_login_url_for(&state.pool, OAuthProvider::Google).await
}

async fn oauth_login_url_for(
    pool: &sqlx::Pool<sqlx::Postgres>,
    provider: OAuthProvider,
) -> impl IntoResponse {
    let client = oauth_client_for_with_db(pool, provider).await;
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
    let client = oauth_client_for_with_db(&state.pool, provider).await;
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
    // Compute expiry time from expires_in (default 3600s if not provided)
    let oauth_expires_at = {
        let expires_in = token
            .expires_in()
            .map(|d| d.as_secs() as i64)
            .unwrap_or(3600);
        Utc::now() + chrono::Duration::seconds(expires_in)
    };

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
        INSERT INTO mail.accounts (
            user_id, email_address, provider, imap_server, imap_port, oauth_token, oauth_refresh_token, oauth_expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, email_address) DO UPDATE SET
            oauth_token = EXCLUDED.oauth_token,
            oauth_refresh_token = CASE
                WHEN EXCLUDED.oauth_refresh_token != '' THEN EXCLUDED.oauth_refresh_token
                ELSE mail.accounts.oauth_refresh_token
            END,
            oauth_expires_at = EXCLUDED.oauth_expires_at,
            provider = EXCLUDED.provider,
            imap_server = EXCLUDED.imap_server,
            imap_port = EXCLUDED.imap_port,
            status = 'active',
            updated_at = NOW()
        RETURNING *
        "#,
    )
    .bind(payload.user_id)
    .bind(&email)
    .bind(provider.name())
    .bind(provider.imap_server())
    .bind(993_i32)
    .bind(&access_token)
    .bind(&refresh_token)
    .bind(oauth_expires_at)
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
