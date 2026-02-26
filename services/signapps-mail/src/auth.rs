use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use oauth2::{
    basic::BasicClient, reqwest::async_http_client, AuthUrl, AuthorizationCode, ClientId,
    ClientSecret, CsrfToken, RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use serde::{Deserialize, Serialize};
use std::env;

use crate::models::MailAccount;
use crate::AppState;

pub fn oauth_client() -> BasicClient {
    let google_client_id = ClientId::new(
        env::var("GOOGLE_CLIENT_ID").unwrap_or_else(|_| "dummy_client_id".to_string()),
    );
    let google_client_secret = ClientSecret::new(
        env::var("GOOGLE_CLIENT_SECRET").unwrap_or_else(|_| "dummy_client_secret".to_string()),
    );
    let auth_url = AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())
        .expect("Invalid authorization endpoint URL");
    let token_url = TokenUrl::new("https://oauth2.googleapis.com/token".to_string())
        .expect("Invalid token endpoint URL");

    BasicClient::new(
        google_client_id,
        Some(google_client_secret),
        auth_url,
        Some(token_url),
    )
    .set_redirect_uri(
        RedirectUrl::new("http://localhost:3000/mail/callback".to_string())
            .expect("Invalid redirect URL"),
    )
}

#[derive(Serialize)]
pub struct AuthUrlResponse {
    pub url: String,
}

pub async fn google_auth_url() -> impl IntoResponse {
    let client = oauth_client();
    let (authorize_url, _csrf_state) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new("https://mail.google.com/".to_string()))
        .add_extra_param("access_type", "offline")
        .add_extra_param("prompt", "consent") // Force consent to get refresh token
        .url();

    Json(AuthUrlResponse {
        url: authorize_url.to_string(),
    })
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

pub async fn google_auth_callback(
    State(state): State<AppState>,
    Json(payload): Json<AuthCallbackRequest>,
) -> impl IntoResponse {
    let client = oauth_client();
    let token_result = client
        .exchange_code(AuthorizationCode::new(payload.code))
        .request_async(async_http_client)
        .await;

    let token = match token_result {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("OAuth token exchange failed: {:?}", e);
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
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(&access_token)
        .send()
        .await;

    let email = match profile_resp {
        Ok(resp) => {
            if let Ok(profile) = resp.json::<GoogleUserProfile>().await {
                profile.email
            } else {
                return StatusCode::INTERNAL_SERVER_ERROR.into_response();
            }
        },
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    // Upsert the mail account in the database. Relying on the unique constraint (user_id, email_address).
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
    .bind("google")
    .bind("imap.gmail.com")
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
