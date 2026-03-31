use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect, Response},
    Extension, Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use signapps_common::Claims;
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn base_url() -> String {
    std::env::var("PUBLIC_BASE_URL").unwrap_or_else(|_| "http://localhost:3019".to_string())
}

fn frontend_url() -> String {
    std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string())
}

fn encode(s: &str) -> String {
    urlencoding::encode(s).into_owned()
}

// ---------------------------------------------------------------------------
// Authorize endpoint
// GET /api/v1/social/oauth/:platform/authorize
// Protected — requires JWT. Returns { redirect_url: "..." }
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct AuthorizeQuery {
    /// Mastodon only: the instance base URL (e.g. "mastodon.social")
    pub instance: Option<String>,
}

#[tracing::instrument(skip_all)]
pub async fn oauth_authorize(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(platform): Path<String>,
    Query(query): Query<AuthorizeQuery>,
) -> impl IntoResponse {
    let base = base_url();

    // Generate CSRF state token
    let state_token = Uuid::new_v4().to_string();

    // Auto-create oauth_states table if not exists
    // platform column is VARCHAR(500) to allow mastodon:<instance>:<client_id>:<client_secret>
    let _ = sqlx::query(
        "CREATE TABLE IF NOT EXISTS social.oauth_states (
            state VARCHAR(100) PRIMARY KEY,
            user_id UUID NOT NULL,
            platform VARCHAR(500) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"
    ).execute(&state.pool).await;
    // Widen existing column if needed (idempotent)
    let _ = sqlx::query(
        "ALTER TABLE social.oauth_states ALTER COLUMN platform TYPE VARCHAR(500)"
    ).execute(&state.pool).await;

    // Clean up expired tokens (older than 10 min)
    let _ = sqlx::query("DELETE FROM social.oauth_states WHERE created_at < NOW() - INTERVAL '10 minutes'")
        .execute(&state.pool).await;

    // Store state token
    let stored = sqlx::query(
        "INSERT INTO social.oauth_states (state, user_id, platform, created_at)
         VALUES ($1, $2, $3, NOW())",
    )
    .bind(&state_token)
    .bind(claims.sub)
    .bind(&platform)
    .execute(&state.pool)
    .await;

    if let Err(e) = stored {
        tracing::error!("oauth_authorize store state: {e}");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to store OAuth state: {e}") })),
        )
            .into_response();
    }

    // Check that the platform client_id is configured (mastodon auto-registers, so skip)
    // For other platforms, check DB first, then env var
    let env_key = match platform.as_str() {
        "twitter" => "TWITTER_CLIENT_ID",
        "linkedin" => "LINKEDIN_CLIENT_ID",
        "facebook" | "instagram" => "FACEBOOK_CLIENT_ID",
        // mastodon uses dynamic registration — no env_key required
        _ => "",
    };
    if !env_key.is_empty() {
        // Try DB-stored credentials first, then env var
        let db_client_id = sqlx::query_scalar::<_, String>(
            "SELECT client_id FROM social.oauth_app_configs WHERE platform = $1"
        ).bind(&platform).fetch_optional(&state.pool).await.ok().flatten();

        let has_credential = db_client_id.is_some()
            || !std::env::var(env_key).unwrap_or_default().is_empty();

        if !has_credential {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("OAuth non configure: definissez {} dans les variables d'environnement du service social", env_key) })),
            ).into_response();
        }
    }

    let redirect_url = match platform.as_str() {
        "twitter" => {
            // DB credentials take priority over env var
            let client_id = sqlx::query_scalar::<_, String>(
                "SELECT client_id FROM social.oauth_app_configs WHERE platform = 'twitter'"
            ).fetch_optional(&state.pool).await.ok().flatten()
             .or_else(|| std::env::var("TWITTER_CLIENT_ID").ok())
             .unwrap_or_default();
            let redirect_uri = format!("{}/api/v1/social/oauth/twitter/callback", base);
            let scopes = "tweet.read tweet.write users.read offline.access";
            // Twitter OAuth 2.0 PKCE — code_challenge_method=plain for simplicity
            let code_challenge = &state_token[..43.min(state_token.len())];
            format!(
                "https://twitter.com/i/oauth2/authorize?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=plain",
                encode(&client_id),
                encode(&redirect_uri),
                encode(scopes),
                encode(&state_token),
                encode(code_challenge),
            )
        },
        "linkedin" => {
            let client_id = sqlx::query_scalar::<_, String>(
                "SELECT client_id FROM social.oauth_app_configs WHERE platform = 'linkedin'"
            ).fetch_optional(&state.pool).await.ok().flatten()
             .or_else(|| std::env::var("LINKEDIN_CLIENT_ID").ok())
             .unwrap_or_default();
            let redirect_uri = format!("{}/api/v1/social/oauth/linkedin/callback", base);
            let scopes = "r_liteprofile r_emailaddress w_member_social";
            format!(
                "https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}",
                encode(&client_id),
                encode(&redirect_uri),
                encode(scopes),
                encode(&state_token),
            )
        },
        "facebook" => {
            let client_id = sqlx::query_scalar::<_, String>(
                "SELECT client_id FROM social.oauth_app_configs WHERE platform = 'facebook'"
            ).fetch_optional(&state.pool).await.ok().flatten()
             .or_else(|| std::env::var("FACEBOOK_CLIENT_ID").ok())
             .unwrap_or_default();
            let redirect_uri = format!("{}/api/v1/social/oauth/facebook/callback", base);
            let scopes = "pages_show_list,pages_read_engagement,pages_manage_posts";
            format!(
                "https://www.facebook.com/v18.0/dialog/oauth?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}",
                encode(&client_id),
                encode(&redirect_uri),
                encode(scopes),
                encode(&state_token),
            )
        },
        "instagram" => {
            // Instagram shares Facebook app credentials
            let client_id = sqlx::query_scalar::<_, String>(
                "SELECT client_id FROM social.oauth_app_configs WHERE platform IN ('instagram','facebook') ORDER BY platform DESC LIMIT 1"
            ).fetch_optional(&state.pool).await.ok().flatten()
             .or_else(|| std::env::var("FACEBOOK_CLIENT_ID").ok())
             .unwrap_or_default();
            let redirect_uri = format!("{}/api/v1/social/oauth/instagram/callback", base);
            let scopes = "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish";
            format!(
                "https://www.facebook.com/v18.0/dialog/oauth?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}",
                encode(&client_id),
                encode(&redirect_uri),
                encode(scopes),
                encode(&state_token),
            )
        },
        "mastodon" => {
            let instance = query.instance.as_deref().unwrap_or("mastodon.social");
            let instance_url = if instance.starts_with("http") {
                instance.trim_end_matches('/').to_string()
            } else {
                format!("https://{}", instance.trim_end_matches('/'))
            };

            // Auto-register OAuth app on the Mastodon instance
            let http_client = reqwest::Client::new();
            let redirect_uri = format!("{}/api/v1/social/oauth/mastodon/callback", base);
            let register_resp = http_client
                .post(format!("{}/api/v1/apps", instance_url))
                .form(&[
                    ("client_name", "SignApps"),
                    ("redirect_uris", redirect_uri.as_str()),
                    ("scopes", "read write follow push"),
                    ("website", base.as_str()),
                ])
                .send()
                .await;

            match register_resp {
                Ok(resp) if resp.status().is_success() => {
                    let app: serde_json::Value = resp.json().await.unwrap_or_default();
                    let client_id = app["client_id"].as_str().unwrap_or_default();
                    let client_secret = app["client_secret"].as_str().unwrap_or_default();

                    // Store instance_url + client_id + client_secret in the platform column
                    // Format: "mastodon:<instance_url>:<client_id>:<client_secret>"
                    let encoded_platform = format!(
                        "mastodon:{}:{}:{}",
                        instance_url, client_id, client_secret
                    );
                    let _ = sqlx::query(
                        "UPDATE social.oauth_states SET platform = $1 WHERE state = $2"
                    )
                    .bind(&encoded_platform)
                    .bind(&state_token)
                    .execute(&state.pool)
                    .await;

                    let scopes = "read write follow push";
                    format!(
                        "{}/oauth/authorize?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}",
                        instance_url,
                        encode(client_id),
                        encode(&redirect_uri),
                        encode(scopes),
                        encode(&state_token),
                    )
                },
                _ => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(json!({
                            "error": format!("Impossible de contacter l'instance Mastodon: {}", instance_url)
                        })),
                    )
                        .into_response();
                },
            }
        },
        "bluesky" => {
            // Bluesky uses app passwords, not OAuth2. Return a special indicator.
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "Bluesky uses app passwords, not OAuth web flow",
                    "use_manual": true
                })),
            )
                .into_response();
        },
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("Unsupported platform: {}", platform) })),
            )
                .into_response();
        },
    };

    (
        StatusCode::OK,
        Json(json!({ "redirect_url": redirect_url, "state": state_token })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// Callback endpoint (public — no JWT, platform redirects here)
// GET /api/v1/social/oauth/:platform/callback?code=XXX&state=YYY
// Exchanges code for tokens, upserts account, redirects to frontend
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct OAuthCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

#[tracing::instrument(skip_all)]
pub async fn oauth_callback(
    State(state): State<AppState>,
    Path(platform): Path<String>,
    Query(params): Query<OAuthCallbackQuery>,
) -> Response {
    let frontend = frontend_url();

    // Handle platform-side errors
    if let Some(err) = &params.error {
        let desc = params.error_description.as_deref().unwrap_or(err);
        tracing::warn!("OAuth callback error from {}: {}", platform, desc);
        return Redirect::temporary(&format!(
            "{}/social/accounts?oauth_error={}&platform={}",
            frontend,
            encode(desc),
            encode(&platform),
        ))
        .into_response();
    }

    let code = match &params.code {
        Some(c) if !c.is_empty() => c.clone(),
        _ => {
            return Redirect::temporary(&format!(
                "{}/social/accounts?oauth_error=missing_code&platform={}",
                frontend,
                encode(&platform),
            ))
            .into_response();
        },
    };

    let state_token = match &params.state {
        Some(s) if !s.is_empty() => s.clone(),
        _ => {
            return Redirect::temporary(&format!(
                "{}/social/accounts?oauth_error=missing_state&platform={}",
                frontend,
                encode(&platform),
            ))
            .into_response();
        },
    };

    // Verify and consume state token.
    // For Mastodon, platform column contains "mastodon:<instance>:<client_id>:<client_secret>"
    // so we match on platform = $2 OR platform starting with "mastodon:" (for mastodon callbacks).
    let row = if platform == "mastodon" {
        sqlx::query_as::<_, (Uuid, String)>(
            "DELETE FROM social.oauth_states
             WHERE state = $1
               AND (platform = $2 OR platform LIKE 'mastodon:%')
               AND created_at > NOW() - INTERVAL '10 minutes'
             RETURNING user_id, platform",
        )
        .bind(&state_token)
        .bind(&platform)
        .fetch_optional(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, (Uuid, String)>(
            "DELETE FROM social.oauth_states
             WHERE state = $1 AND platform = $2
               AND created_at > NOW() - INTERVAL '10 minutes'
             RETURNING user_id, platform",
        )
        .bind(&state_token)
        .bind(&platform)
        .fetch_optional(&state.pool)
        .await
    };

    let (user_id, stored_platform) = match row {
        Ok(Some(r)) => r,
        Ok(None) => {
            tracing::warn!(
                "OAuth callback: invalid or expired state token for {}",
                platform
            );
            return Redirect::temporary(&format!(
                "{}/social/accounts?oauth_error=invalid_state&platform={}",
                frontend,
                encode(&platform),
            ))
            .into_response();
        },
        Err(e) => {
            tracing::error!("OAuth callback state query: {e}");
            return Redirect::temporary(&format!(
                "{}/social/accounts?oauth_error=server_error&platform={}",
                frontend,
                encode(&platform),
            ))
            .into_response();
        },
    };

    // Exchange code for tokens
    let token_result = exchange_code_for_tokens(&platform, &code, &stored_platform, &state.pool).await;

    match token_result {
        Ok(token_data) => {
            // Upsert account in DB
            let account_id = Uuid::new_v4();
            let now = Utc::now();
            let platform_config = token_data.platform_config.unwrap_or_else(|| json!({}));

            let upsert = sqlx::query_as::<_, (Uuid,)>(
                "INSERT INTO social.accounts
                    (id, user_id, platform, platform_user_id, username, display_name, avatar_url,
                     access_token, refresh_token, token_expires_at, platform_config, is_active,
                     created_at, updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13)
                 ON CONFLICT (user_id, platform, platform_user_id)
                 DO UPDATE SET
                     access_token = EXCLUDED.access_token,
                     refresh_token = EXCLUDED.refresh_token,
                     token_expires_at = EXCLUDED.token_expires_at,
                     username = COALESCE(EXCLUDED.username, social.accounts.username),
                     display_name = COALESCE(EXCLUDED.display_name, social.accounts.display_name),
                     avatar_url = COALESCE(EXCLUDED.avatar_url, social.accounts.avatar_url),
                     is_active = true,
                     updated_at = EXCLUDED.updated_at
                 RETURNING id",
            )
            .bind(account_id)
            .bind(user_id)
            .bind(&platform)
            .bind(&token_data.platform_user_id)
            .bind(&token_data.username)
            .bind(&token_data.display_name)
            .bind(&token_data.avatar_url)
            .bind(&token_data.access_token)
            .bind(&token_data.refresh_token)
            .bind(token_data.token_expires_at)
            .bind(platform_config)
            .bind(now)
            .bind(now)
            .fetch_one(&state.pool)
            .await;

            match upsert {
                Ok((id,)) => {
                    tracing::info!("OAuth account connected: {} platform={}", id, platform);
                    // Redirect to frontend with success; frontend popup detects this
                    Redirect::temporary(&format!(
                        "{}/social/oauth/callback?oauth_success=true&platform={}&account_id={}",
                        frontend,
                        encode(&platform),
                        id,
                    ))
                    .into_response()
                },
                Err(e) => {
                    tracing::error!("OAuth upsert account: {e}");
                    Redirect::temporary(&format!(
                        "{}/social/accounts?oauth_error=db_error&platform={}",
                        frontend,
                        encode(&platform),
                    ))
                    .into_response()
                },
            }
        },
        Err(e) => {
            tracing::error!("OAuth token exchange for {}: {}", platform, e);
            Redirect::temporary(&format!(
                "{}/social/accounts?oauth_error=token_exchange_failed&platform={}",
                frontend,
                encode(&platform),
            ))
            .into_response()
        },
    }
}

// ---------------------------------------------------------------------------
// Token exchange logic
// ---------------------------------------------------------------------------

struct TokenData {
    access_token: String,
    refresh_token: Option<String>,
    token_expires_at: Option<chrono::DateTime<Utc>>,
    platform_user_id: Option<String>,
    username: Option<String>,
    display_name: Option<String>,
    avatar_url: Option<String>,
    platform_config: Option<serde_json::Value>,
}

async fn exchange_code_for_tokens(
    platform: &str,
    code: &str,
    stored_platform: &str,
    pool: &sqlx::Pool<sqlx::Postgres>,
) -> Result<TokenData, anyhow::Error> {
    let base = base_url();
    let client = reqwest::Client::new();

    match platform {
        "twitter" => {
            // DB credentials first, then env var
            let client_id = sqlx::query_scalar::<_, String>(
                "SELECT client_id FROM social.oauth_app_configs WHERE platform = 'twitter'"
            ).fetch_optional(pool).await.ok().flatten()
             .or_else(|| std::env::var("TWITTER_CLIENT_ID").ok())
             .ok_or_else(|| anyhow::anyhow!("TWITTER_CLIENT_ID not configured"))?;
            let client_secret = sqlx::query_scalar::<_, String>(
                "SELECT client_secret FROM social.oauth_app_configs WHERE platform = 'twitter'"
            ).fetch_optional(pool).await.ok().flatten()
             .or_else(|| std::env::var("TWITTER_CLIENT_SECRET").ok())
             .ok_or_else(|| anyhow::anyhow!("TWITTER_CLIENT_SECRET not configured"))?;
            let redirect_uri = format!("{}/api/v1/social/oauth/twitter/callback", base);

            let resp = client
                .post("https://api.twitter.com/2/oauth2/token")
                .basic_auth(&client_id, Some(&client_secret))
                .form(&[
                    ("grant_type", "authorization_code"),
                    ("code", code),
                    ("redirect_uri", &redirect_uri),
                    ("code_verifier", &code[..43.min(code.len())]),
                ])
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;

            let access_token = resp["access_token"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("no access_token in Twitter response"))?
                .to_string();
            let refresh_token = resp["refresh_token"].as_str().map(String::from);
            let expires_in = resp["expires_in"].as_i64().unwrap_or(7200);
            let token_expires_at = Some(Utc::now() + chrono::Duration::seconds(expires_in));

            // Fetch user info
            let user_resp = client
                .get("https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,name")
                .bearer_auth(&access_token)
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;

            let user = &user_resp["data"];
            Ok(TokenData {
                access_token,
                refresh_token,
                token_expires_at,
                platform_user_id: user["id"].as_str().map(String::from),
                username: user["username"].as_str().map(String::from),
                display_name: user["name"].as_str().map(String::from),
                avatar_url: user["profile_image_url"].as_str().map(String::from),
                platform_config: None,
            })
        },

        "linkedin" => {
            let client_id = sqlx::query_scalar::<_, String>(
                "SELECT client_id FROM social.oauth_app_configs WHERE platform = 'linkedin'"
            ).fetch_optional(pool).await.ok().flatten()
             .or_else(|| std::env::var("LINKEDIN_CLIENT_ID").ok())
             .ok_or_else(|| anyhow::anyhow!("LINKEDIN_CLIENT_ID not configured"))?;
            let client_secret = sqlx::query_scalar::<_, String>(
                "SELECT client_secret FROM social.oauth_app_configs WHERE platform = 'linkedin'"
            ).fetch_optional(pool).await.ok().flatten()
             .or_else(|| std::env::var("LINKEDIN_CLIENT_SECRET").ok())
             .ok_or_else(|| anyhow::anyhow!("LINKEDIN_CLIENT_SECRET not configured"))?;
            let redirect_uri = format!("{}/api/v1/social/oauth/linkedin/callback", base);

            let resp = client
                .post("https://www.linkedin.com/oauth/v2/accessToken")
                .form(&[
                    ("grant_type", "authorization_code"),
                    ("code", code),
                    ("redirect_uri", &redirect_uri),
                    ("client_id", &client_id),
                    ("client_secret", &client_secret),
                ])
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;

            let access_token = resp["access_token"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("no access_token in LinkedIn response"))?
                .to_string();
            let expires_in = resp["expires_in"].as_i64().unwrap_or(5183944);
            let token_expires_at = Some(Utc::now() + chrono::Duration::seconds(expires_in));

            // Fetch profile
            let profile = client
                .get("https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))")
                .bearer_auth(&access_token)
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;

            let platform_user_id = profile["id"].as_str().map(String::from);
            let first = profile["localizedFirstName"].as_str().unwrap_or("");
            let last = profile["localizedLastName"].as_str().unwrap_or("");
            let display_name = if first.is_empty() && last.is_empty() {
                None
            } else {
                Some(format!("{} {}", first, last).trim().to_string())
            };
            let author_urn = platform_user_id
                .as_ref()
                .map(|id| format!("urn:li:person:{}", id));

            Ok(TokenData {
                access_token,
                refresh_token: None,
                token_expires_at,
                platform_user_id,
                username: display_name.clone(),
                display_name,
                avatar_url: None,
                platform_config: author_urn.map(|urn| json!({ "author_urn": urn })),
            })
        },

        "facebook" => {
            let client_id = sqlx::query_scalar::<_, String>(
                "SELECT client_id FROM social.oauth_app_configs WHERE platform = 'facebook'"
            ).fetch_optional(pool).await.ok().flatten()
             .or_else(|| std::env::var("FACEBOOK_CLIENT_ID").ok())
             .ok_or_else(|| anyhow::anyhow!("FACEBOOK_CLIENT_ID not configured"))?;
            let client_secret = sqlx::query_scalar::<_, String>(
                "SELECT client_secret FROM social.oauth_app_configs WHERE platform = 'facebook'"
            ).fetch_optional(pool).await.ok().flatten()
             .or_else(|| std::env::var("FACEBOOK_CLIENT_SECRET").ok())
             .ok_or_else(|| anyhow::anyhow!("FACEBOOK_CLIENT_SECRET not configured"))?;
            let redirect_uri = format!("{}/api/v1/social/oauth/facebook/callback", base);

            let resp = client
                .get("https://graph.facebook.com/v18.0/oauth/access_token")
                .query(&[
                    ("client_id", client_id.as_str()),
                    ("client_secret", client_secret.as_str()),
                    ("redirect_uri", redirect_uri.as_str()),
                    ("code", code),
                ])
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;

            let access_token = resp["access_token"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("no access_token in Facebook response"))?
                .to_string();
            let expires_in = resp["expires_in"].as_i64().unwrap_or(5184000);
            let token_expires_at = Some(Utc::now() + chrono::Duration::seconds(expires_in));

            // Fetch pages
            let pages_resp = client
                .get("https://graph.facebook.com/v18.0/me/accounts")
                .query(&[("access_token", access_token.as_str())])
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;

            // Use first page's token if available, else use user token
            let (final_token, page_id, page_name) =
                if let Some(pages) = pages_resp["data"].as_array() {
                    if let Some(page) = pages.first() {
                        let page_token = page["access_token"]
                            .as_str()
                            .unwrap_or(&access_token)
                            .to_string();
                        let pid = page["id"].as_str().map(String::from);
                        let pname = page["name"].as_str().map(String::from);
                        (page_token, pid, pname)
                    } else {
                        (access_token, None, None)
                    }
                } else {
                    (access_token, None, None)
                };

            Ok(TokenData {
                access_token: final_token,
                refresh_token: None,
                token_expires_at,
                platform_user_id: page_id.clone(),
                username: page_name.clone(),
                display_name: page_name,
                avatar_url: None,
                platform_config: page_id.map(|id| json!({ "page_id": id })),
            })
        },

        "instagram" => {
            // Instagram uses the same Facebook OAuth flow
            let client_id = sqlx::query_scalar::<_, String>(
                "SELECT client_id FROM social.oauth_app_configs WHERE platform IN ('instagram','facebook') ORDER BY platform DESC LIMIT 1"
            ).fetch_optional(pool).await.ok().flatten()
             .or_else(|| std::env::var("FACEBOOK_CLIENT_ID").ok())
             .ok_or_else(|| anyhow::anyhow!("FACEBOOK_CLIENT_ID not configured"))?;
            let client_secret = sqlx::query_scalar::<_, String>(
                "SELECT client_secret FROM social.oauth_app_configs WHERE platform IN ('instagram','facebook') ORDER BY platform DESC LIMIT 1"
            ).fetch_optional(pool).await.ok().flatten()
             .or_else(|| std::env::var("FACEBOOK_CLIENT_SECRET").ok())
             .ok_or_else(|| anyhow::anyhow!("FACEBOOK_CLIENT_SECRET not configured"))?;
            let redirect_uri = format!("{}/api/v1/social/oauth/instagram/callback", base);

            let resp = client
                .get("https://graph.facebook.com/v18.0/oauth/access_token")
                .query(&[
                    ("client_id", client_id.as_str()),
                    ("client_secret", client_secret.as_str()),
                    ("redirect_uri", redirect_uri.as_str()),
                    ("code", code),
                ])
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;

            let access_token = resp["access_token"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("no access_token in Instagram/Facebook response"))?
                .to_string();
            let expires_in = resp["expires_in"].as_i64().unwrap_or(5184000);
            let token_expires_at = Some(Utc::now() + chrono::Duration::seconds(expires_in));

            // Find Instagram business account via Graph API
            let me_resp = client
                .get("https://graph.facebook.com/v18.0/me/accounts")
                .query(&[
                    ("access_token", access_token.as_str()),
                    ("fields", "instagram_business_account,name,access_token"),
                ])
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;

            let (ig_user_id, ig_token, page_name) = if let Some(pages) = me_resp["data"].as_array()
            {
                let mut found = (None, access_token.clone(), None);
                for page in pages {
                    if let Some(ig_acct) = page["instagram_business_account"].as_object() {
                        let ig_id = ig_acct["id"].as_str().map(String::from);
                        let page_token = page["access_token"]
                            .as_str()
                            .unwrap_or(&access_token)
                            .to_string();
                        let name = page["name"].as_str().map(String::from);
                        found = (ig_id, page_token, name);
                        break;
                    }
                }
                found
            } else {
                (None, access_token, None)
            };

            Ok(TokenData {
                access_token: ig_token,
                refresh_token: None,
                token_expires_at,
                platform_user_id: ig_user_id.clone(),
                username: page_name.clone(),
                display_name: page_name,
                avatar_url: None,
                platform_config: ig_user_id.map(|id| json!({ "user_id": id })),
            })
        },

        "mastodon" => {
            // stored_platform format: "mastodon:<instance_url>:<client_id>:<client_secret>"
            // (set during auto-registration in oauth_authorize)
            let parts: Vec<&str> = stored_platform.splitn(4, ':').collect();
            // parts[0] = "mastodon", parts[1..] reconstructed = instance_url, client_id, secret
            // But instance_url itself starts with "https:" so we need to re-join properly.
            // Format was: "mastodon:{instance_url}:{client_id}:{client_secret}"
            // where instance_url = "https://mastodon.social"
            // splitn(4, ':') gives: ["mastodon", "https", "//mastodon.social", "client_id:client_secret"]
            // We need to handle this carefully — split on first ':' only for mastodon prefix
            let remainder = stored_platform.strip_prefix("mastodon:").unwrap_or(stored_platform);
            // remainder = "<instance_url>:<client_id>:<client_secret>"
            // instance_url may contain ':' (https://...), so split from the right
            // Find last two ':' separators for client_id and client_secret
            let last_colon = remainder.rfind(':').ok_or_else(|| anyhow::anyhow!("invalid mastodon state: missing client_secret"))?;
            let client_secret = &remainder[last_colon + 1..];
            let before_secret = &remainder[..last_colon];
            let second_last_colon = before_secret.rfind(':').ok_or_else(|| anyhow::anyhow!("invalid mastodon state: missing client_id"))?;
            let client_id = &before_secret[second_last_colon + 1..];
            let instance_url = &before_secret[..second_last_colon];

            if instance_url.is_empty() || client_id.is_empty() || client_secret.is_empty() {
                return Err(anyhow::anyhow!("incomplete mastodon state: instance={}, client_id present={}", instance_url, !client_id.is_empty()));
            }

            let redirect_uri = format!("{}/api/v1/social/oauth/mastodon/callback", base);

            let resp = client
                .post(format!("{}/oauth/token", instance_url))
                .form(&[
                    ("grant_type", "authorization_code"),
                    ("code", code),
                    ("redirect_uri", &redirect_uri),
                    ("client_id", client_id),
                    ("client_secret", client_secret),
                ])
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;

            let access_token = resp["access_token"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("no access_token in Mastodon response"))?
                .to_string();

            // Fetch account info
            let acct_resp = client
                .get(format!("{}/api/v1/accounts/verify_credentials", instance_url))
                .bearer_auth(&access_token)
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;

            Ok(TokenData {
                access_token,
                refresh_token: None,
                token_expires_at: None,
                platform_user_id: acct_resp["id"].as_str().map(String::from),
                username: acct_resp["username"].as_str().map(String::from),
                display_name: acct_resp["display_name"].as_str().map(String::from),
                avatar_url: acct_resp["avatar"].as_str().map(String::from),
                platform_config: Some(json!({ "instance_url": instance_url })),
            })
        },

        other => Err(anyhow::anyhow!(
            "Unsupported platform for token exchange: {}",
            other
        )),
    }
}

// ---------------------------------------------------------------------------
// Save OAuth credentials endpoint
// POST /api/v1/social/oauth/credentials
// Admin stores client_id + client_secret for a platform in the DB
// ---------------------------------------------------------------------------

#[derive(Deserialize, Serialize)]
pub struct SaveCredentialsRequest {
    pub platform: String,
    pub client_id: String,
    pub client_secret: String,
}

#[tracing::instrument(skip_all)]
pub async fn save_oauth_credentials(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SaveCredentialsRequest>,
) -> impl IntoResponse {
    // Validate platform
    let allowed = ["twitter", "linkedin", "facebook", "instagram"];
    if !allowed.contains(&body.platform.as_str()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("Unsupported platform: {}", body.platform) })),
        )
            .into_response();
    }

    if body.client_id.trim().is_empty() || body.client_secret.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "client_id and client_secret are required" })),
        )
            .into_response();
    }

    // Auto-create table if needed
    let _ = sqlx::query(
        "CREATE TABLE IF NOT EXISTS social.oauth_app_configs (
            platform VARCHAR(20) PRIMARY KEY,
            client_id VARCHAR(500) NOT NULL,
            client_secret VARCHAR(500) NOT NULL,
            updated_by UUID,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )"
    )
    .execute(&state.pool)
    .await;

    let result = sqlx::query(
        "INSERT INTO social.oauth_app_configs (platform, client_id, client_secret, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (platform) DO UPDATE
         SET client_id = EXCLUDED.client_id,
             client_secret = EXCLUDED.client_secret,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()",
    )
    .bind(&body.platform)
    .bind(&body.client_id)
    .bind(&body.client_secret)
    .bind(claims.sub)
    .execute(&state.pool)
    .await;

    match result {
        Ok(_) => {
            tracing::info!("OAuth credentials saved for platform: {}", body.platform);
            (
                StatusCode::OK,
                Json(json!({ "status": "saved", "platform": body.platform })),
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("Failed to save OAuth credentials: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Failed to save credentials: {}", e) })),
            )
                .into_response()
        },
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "oauth handler module loaded");
    }
}
