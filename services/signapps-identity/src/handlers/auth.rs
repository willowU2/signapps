//! Authentication handlers.

use axum::{
    extract::{Extension, State},
    http::{header, HeaderMap},
    Json,
};
use chrono;
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use signapps_db::repositories::{LdapRepository, UserRepository, WorkspaceRepository};
use uuid::Uuid;
use validator::Validate;

use crate::auth::{create_tokens, verify_password, verify_token};
use crate::handlers::admin_security::ActiveSession;
use crate::ldap::LdapService;
use crate::AppState;

/// Append a row to `platform.audit_log` — fire-and-forget, never fails the request.
async fn audit_auth_event(
    pool: &sqlx::PgPool,
    actor_id: Option<Uuid>,
    actor_ip: Option<&str>,
    action: &str,
    user_id: Uuid,
) {
    let _ = sqlx::query(
        r#"INSERT INTO platform.audit_log
           (id, actor_id, actor_ip, action, entity_type, entity_id, old_data, new_data, workspace_id)
           VALUES (gen_uuid_v7(), $1, $2, $3, 'user', $4, NULL, NULL, NULL)"#,
    )
    .bind(actor_id)
    .bind(actor_ip)
    .bind(action)
    .bind(user_id)
    .execute(pool)
    .await;
}

/// Login request payload.
#[derive(Debug, Deserialize, Validate)]
/// Request body for Login.
pub struct LoginRequest {
    #[validate(length(min = 1, message = "Username is required"))]
    pub username: String,
    #[validate(length(min = 1, message = "Password is required"))]
    pub password: String,
    pub mfa_code: Option<String>,
}

/// Login response with tokens.
#[derive(Debug, Serialize)]
/// Response for Login.
pub struct LoginResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

/// Registration request payload.
#[derive(Debug, Deserialize, Validate)]
/// Request body for Register.
pub struct RegisterRequest {
    #[validate(length(min = 3, max = 64, message = "Username must be 3-64 characters"))]
    pub username: String,
    #[validate(email(message = "Invalid email format"))]
    pub email: Option<String>,
    #[validate(length(min = 8, max = 128, message = "Password must be 8-128 characters"))]
    pub password: String,
    #[validate(length(max = 255))]
    pub display_name: Option<String>,
}

/// User information response.
#[derive(Debug, Serialize)]
/// Response for User.
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub role: i16,
    pub mfa_enabled: bool,
    pub auth_provider: String,
    pub created_at: String,
    pub last_login: Option<String>,
}

/// Refresh token request.
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
/// Request body for Refresh.
pub struct RefreshRequest {
    pub refresh_token: String,
}

/// Login endpoint - supports local and LDAP authentication.
#[tracing::instrument(skip(state, payload), fields(username = %payload.username))]
#[tracing::instrument(skip_all)]
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<(HeaderMap, Json<LoginResponse>)> {
    // Validate input
    payload
        .validate()
        .map_err(|e| Error::Validation(e.to_string()))?;

    // Find user by username
    let user = UserRepository::find_by_username(&state.pool, &payload.username)
        .await?
        .ok_or(Error::InvalidCredentials)?;

    // Check auth provider
    match user.auth_provider.as_str() {
        "local" => {
            // Local authentication with Argon2
            let password_hash = user
                .password_hash
                .as_ref()
                .ok_or(Error::InvalidCredentials)?;

            if !verify_password(&payload.password, password_hash).await? {
                tracing::warn!(username = %payload.username, "Invalid password attempt");
                audit_auth_event(
                    state.pool.inner(),
                    Some(user.id),
                    None,
                    "login_failed",
                    user.id,
                )
                .await;
                return Err(Error::InvalidCredentials);
            }
        },
        "ldap" => {
            // LDAP authentication - bind user against LDAP server
            let ldap_config = LdapRepository::get_config(&state.pool)
                .await?
                .ok_or_else(|| Error::Internal("LDAP configuration not found".to_string()))?;

            if !ldap_config.enabled {
                // If LDAP is disabled, check fallback setting
                if ldap_config.fallback_local_auth {
                    // Try local auth fallback
                    let password_hash = user
                        .password_hash
                        .as_ref()
                        .ok_or(Error::InvalidCredentials)?;

                    if !verify_password(&payload.password, password_hash).await? {
                        tracing::warn!(username = %payload.username, "Invalid password (LDAP fallback)");
                        return Err(Error::InvalidCredentials);
                    }
                } else {
                    return Err(Error::Internal("LDAP is disabled".to_string()));
                }
            } else {
                // Decrypt service account password
                let service_password = decrypt_ldap_password(&ldap_config.bind_password_encrypted)?;

                // Authenticate user against LDAP
                let ldap_result = LdapService::authenticate(
                    &ldap_config,
                    &service_password,
                    &payload.username,
                    &payload.password,
                )
                .await?;

                if ldap_result.is_none() {
                    tracing::warn!(username = %payload.username, "LDAP authentication failed");
                    return Err(Error::InvalidCredentials);
                }

                tracing::info!(username = %payload.username, "LDAP authentication successful");
            }
        },
        _ => {
            tracing::error!(auth_provider = %user.auth_provider, "Unknown auth provider");
            return Err(Error::Internal("Unknown auth provider".to_string()));
        },
    }

    // Check MFA if enabled
    if user.mfa_enabled {
        let mfa_code = payload.mfa_code.as_ref().ok_or(Error::MfaRequired)?;

        // Verify TOTP code
        let mfa_secret = user.mfa_secret.as_ref().ok_or(Error::Internal(
            "MFA enabled but no secret found".to_string(),
        ))?;

        if !verify_totp(mfa_secret, mfa_code)? {
            return Err(Error::InvalidMfaCode);
        }
    }

    // Update last login
    UserRepository::update_last_login(&state.pool, user.id).await?;

    // Get user's workspace IDs if they have a tenant
    let workspace_ids = if user.tenant_id.is_some() {
        let workspaces = WorkspaceRepository::list_by_user(&state.pool, user.id).await?;
        if workspaces.is_empty() {
            None
        } else {
            Some(workspaces.into_iter().map(|w| w.id).collect())
        }
    } else {
        None
    };

    // Generate tokens with tenant and workspace context
    let tokens = create_tokens(
        user.id,
        &user.username,
        user.role,
        user.tenant_id,
        workspace_ids,
        &state.jwt_secret,
    )?;

    // Register this session in the active sessions store
    let session_id = tokens.access_token.chars().take(16).collect::<String>();
    let session_expires_at = chrono::Utc::now() + chrono::Duration::seconds(tokens.expires_in);
    state
        .active_sessions
        .add(ActiveSession {
            id: session_id,
            user_id: user.id,
            username: user.username.clone(),
            created_at: chrono::Utc::now(),
            expires_at: session_expires_at,
            ip_address: None,
            user_agent: None,
        })
        .await;

    tracing::info!(user_id = %user.id, tenant_id = ?user.tenant_id, "User logged in successfully");

    audit_auth_event(
        state.pool.inner(),
        Some(user.id),
        None,
        "login_success",
        user.id,
    )
    .await;

    let access_cookie = format!(
        "access_token={}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age={}",
        tokens.access_token, tokens.expires_in
    );
    let refresh_cookie = format!(
        "refresh_token={}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800",
        tokens.refresh_token
    );

    let mut response_headers = HeaderMap::new();
    if let Ok(c) = access_cookie.parse() {
        response_headers.append(header::SET_COOKIE, c);
    }
    if let Ok(c) = refresh_cookie.parse() {
        response_headers.append(header::SET_COOKIE, c);
    }

    Ok((
        response_headers,
        Json(LoginResponse {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_type: "Bearer".to_string(),
            expires_in: tokens.expires_in,
        }),
    ))
}

#[tracing::instrument(skip(state, headers))]
#[tracing::instrument(skip_all)]
pub async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Result<HeaderMap> {
    let mut token = None;

    if let Some(auth_header) = headers
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
    {
        if let Some(t) = auth_header.strip_prefix("Bearer ") {
            token = Some(t.to_string());
        }
    }

    if token.is_none() {
        if let Some(cookie_header) = headers.get(header::COOKIE).and_then(|h| h.to_str().ok()) {
            for cookie in cookie_header.split(';') {
                let cookie = cookie.trim();
                if let Some(t) = cookie.strip_prefix("access_token=") {
                    token = Some(t.to_string());
                    break;
                }
            }
        }
    }

    if let Some(token) = token {
        // Decode token to get expiration
        if let Ok(claims) = verify_token(&token, &state.jwt_secret) {
            let ttl = claims.exp - chrono::Utc::now().timestamp();
            if ttl > 0 {
                // Blacklist token in cache with remaining TTL
                let key = format!("blacklist:{}", token);
                state
                    .cache
                    .set(&key, "1", std::time::Duration::from_secs(ttl as u64))
                    .await;
            }
        }
        tracing::info!("User logged out, token blacklisted");
    }

    let access_cookie = "access_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
    let refresh_cookie = "refresh_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";

    let mut response_headers = HeaderMap::new();
    if let Ok(c) = access_cookie.parse() {
        response_headers.append(header::SET_COOKIE, c);
    }
    if let Ok(c) = refresh_cookie.parse() {
        response_headers.append(header::SET_COOKIE, c);
    }

    Ok(response_headers)
}

/// Register new user (local auth only).
#[tracing::instrument(skip(state, payload), fields(username = %payload.username))]
#[tracing::instrument(skip_all)]
pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<UserResponse>> {
    // Validate input
    payload
        .validate()
        .map_err(|e| Error::Validation(e.to_string()))?;

    // Check username uniqueness
    if UserRepository::find_by_username(&state.pool, &payload.username)
        .await?
        .is_some()
    {
        return Err(Error::AlreadyExists("Username already taken".to_string()));
    }

    // Check email uniqueness if provided
    if let Some(ref email) = payload.email {
        if UserRepository::find_by_email(&state.pool, email)
            .await?
            .is_some()
        {
            return Err(Error::AlreadyExists("Email already registered".to_string()));
        }
    }

    // Hash password
    let password_hash = crate::auth::hash_password(&payload.password).await?;

    // Create user
    let create_user = signapps_db::models::CreateUser {
        username: payload.username.to_lowercase(),
        email: payload.email,
        password: Some(payload.password.clone()),
        display_name: payload.display_name,
        role: 1, // Default user role
        auth_provider: "local".to_string(),
        ldap_dn: None,
        ldap_groups: None,
        avatar_url: None,
    };

    let user = UserRepository::create_with_hash(&state.pool, create_user, &password_hash).await?;

    tracing::info!(user_id = %user.id, "User registered successfully");

    Ok(Json(UserResponse {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        mfa_enabled: user.mfa_enabled,
        auth_provider: user.auth_provider,
        created_at: user.created_at.to_rfc3339(),
        last_login: user.last_login.map(|dt| dt.to_rfc3339()),
    }))
}

#[tracing::instrument(skip(state, headers))]
#[tracing::instrument(skip_all)]
pub async fn refresh(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<(HeaderMap, Json<LoginResponse>)> {
    let mut refresh_token = None;
    if let Some(cookie_header) = headers.get(header::COOKIE).and_then(|h| h.to_str().ok()) {
        for cookie in cookie_header.split(';') {
            let cookie = cookie.trim();
            if let Some(t) = cookie.strip_prefix("refresh_token=") {
                refresh_token = Some(t.to_string());
                break;
            }
        }
    }
    let refresh_token = refresh_token.ok_or(Error::InvalidToken)?;

    // Verify refresh token
    let claims = verify_token(&refresh_token, &state.jwt_secret)?;

    // Ensure it's a refresh token
    if claims.token_type != "refresh" {
        return Err(Error::InvalidToken);
    }

    // Check expiration
    let now = chrono::Utc::now().timestamp();
    if claims.exp < now {
        return Err(Error::TokenExpired);
    }

    // Blacklist the old refresh token to prevent reuse
    let ttl = claims.exp - now;
    if ttl > 0 {
        let key = format!("blacklist:{}", refresh_token);
        state
            .cache
            .set(&key, "1", std::time::Duration::from_secs(ttl as u64))
            .await;
    }

    // Get fresh user data
    let user = UserRepository::find_by_id(&state.pool, claims.sub)
        .await?
        .ok_or(Error::NotFound("User not found".to_string()))?;

    // Get user's workspace IDs if they have a tenant
    let workspace_ids = if user.tenant_id.is_some() {
        let workspaces = WorkspaceRepository::list_by_user(&state.pool, user.id).await?;
        if workspaces.is_empty() {
            None
        } else {
            Some(workspaces.into_iter().map(|w| w.id).collect())
        }
    } else {
        None
    };

    // Generate new tokens with tenant and workspace context
    let tokens = create_tokens(
        user.id,
        &user.username,
        user.role,
        user.tenant_id,
        workspace_ids,
        &state.jwt_secret,
    )?;

    tracing::info!(user_id = %user.id, tenant_id = ?user.tenant_id, "Token refreshed");

    let access_cookie = format!(
        "access_token={}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age={}",
        tokens.access_token, tokens.expires_in
    );
    let refresh_cookie = format!(
        "refresh_token={}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800",
        tokens.refresh_token
    );

    let mut response_headers = HeaderMap::new();
    if let Ok(c) = access_cookie.parse() {
        response_headers.append(header::SET_COOKIE, c);
    }
    if let Ok(c) = refresh_cookie.parse() {
        response_headers.append(header::SET_COOKIE, c);
    }

    Ok((
        response_headers,
        Json(LoginResponse {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_type: "Bearer".to_string(),
            expires_in: tokens.expires_in,
        }),
    ))
}

/// Get current user info.
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn me(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UserResponse>> {
    let user = UserRepository::find_by_id(&state.pool, claims.sub)
        .await?
        .ok_or(Error::NotFound("User not found".to_string()))?;

    Ok(Json(UserResponse {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        mfa_enabled: user.mfa_enabled,
        auth_provider: user.auth_provider,
        created_at: user.created_at.to_rfc3339(),
        last_login: user.last_login.map(|dt| dt.to_rfc3339()),
    }))
}

/// Bootstrap endpoint - promotes the first user to admin if no admin exists.
/// This is a one-time operation for initial setup.
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn bootstrap(State(state): State<AppState>) -> Result<Json<serde_json::Value>> {
    // Check if any admin already exists (direct SQL — checks ALL users, not just first N)
    let has_admin: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM identity.users WHERE role >= 2)")
            .fetch_one(&*state.pool)
            .await
            .unwrap_or(true); // Default to true (block bootstrap) on error

    if has_admin {
        return Err(Error::Forbidden(
            "Bootstrap already completed - an admin user exists".to_string(),
        ));
    }

    let users = UserRepository::list(&state.pool, 1, 0).await?;
    if users.is_empty() {
        return Err(Error::NotFound(
            "No users found. Register a user first via /api/v1/auth/register".to_string(),
        ));
    }

    // Promote the first user to admin (role 2)
    let first_user = &users[0];
    sqlx::query("UPDATE identity.users SET role = 2 WHERE id = $1")
        .bind(first_user.id)
        .execute(&*state.pool)
        .await
        .map_err(|e| Error::Internal(format!("Failed to promote user: {}", e)))?;

    tracing::info!(
        user_id = %first_user.id,
        username = %first_user.username,
        "Bootstrap: promoted user to admin"
    );

    Ok(Json(serde_json::json!({
        "message": "Bootstrap complete",
        "admin_user": first_user.username,
        "admin_id": first_user.id.to_string()
    })))
}

/// Verify TOTP code.
fn verify_totp(secret: &str, code: &str) -> Result<bool> {
    use totp_rs::{Algorithm, Secret, TOTP};

    let secret_bytes = Secret::Encoded(secret.to_string())
        .to_bytes()
        .map_err(|e| Error::Internal(format!("TOTP secret decode error: {}", e)))?;

    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret_bytes,
        Some("SignApps".to_string()),
        "user".to_string(),
    )
    .map_err(|e| Error::Internal(format!("TOTP error: {}", e)))?;

    Ok(totp.check_current(code).unwrap_or(false))
}

/// Password reset confirm request payload.
#[derive(Debug, Deserialize)]
/// Request body for PasswordResetConfirm.
pub struct PasswordResetConfirmRequest {
    pub token: String,
    #[serde(rename = "new_password")]
    pub new_password: String,
}

/// Password reset request (rate-limited to 3/min per IP).
///
/// Accepts an email address and — if an account exists — initiates the reset flow.
/// Always returns HTTP 200 to avoid leaking account existence.
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn password_reset(
    State(state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>> {
    let email = payload
        .get("email")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    tracing::info!(email = %email, "Password reset requested");

    // Look up the user — do not reveal if not found
    let user = match UserRepository::find_by_email(&state.pool, &email).await {
        Ok(Some(u)) => u,
        _ => {
            return Ok(Json(serde_json::json!({
                "message": "If an account with that email exists, a reset link has been sent."
            })));
        },
    };

    // Generate a secure random hex token (32 bytes = 64 hex chars)
    let token_bytes: [u8; 32] = rand::random();
    let token = hex::encode(token_bytes);
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(2);

    // Store the token in the DB (create table if needed via the migration)
    let store_result = sqlx::query(
        r#"INSERT INTO identity.password_reset_tokens (token, user_id, expires_at, used)
           VALUES ($1, $2, $3, false)
           ON CONFLICT (token) DO NOTHING"#,
    )
    .bind(&token)
    .bind(user.id)
    .bind(expires_at)
    .execute(state.pool.inner())
    .await;

    if let Err(e) = store_result {
        tracing::error!("Failed to store password reset token: {}", e);
        // Return success anyway to avoid leaking information
        return Ok(Json(serde_json::json!({
            "message": "If an account with that email exists, a reset link has been sent."
        })));
    }

    // Send email via MAIL_SERVICE_URL env var (fire-and-forget)
    let mail_url =
        std::env::var("MAIL_SERVICE_URL").unwrap_or_else(|_| "http://localhost:3012".to_string());
    let reset_url =
        std::env::var("APP_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let reset_link = format!("{}/auth/password-reset?token={}", reset_url, token);

    let client = reqwest::Client::new();
    let _ = client
        .post(format!("{}/api/v1/mail/send", mail_url))
        .json(&serde_json::json!({
            "to": email,
            "subject": "Réinitialisation de mot de passe SignApps",
            "html": format!(
                "<p>Bonjour,</p><p>Cliquez sur ce lien pour réinitialiser votre mot de passe :</p><p><a href=\"{0}\">{0}</a></p><p>Ce lien expire dans 2 heures.</p>",
                reset_link
            ),
            "text": format!("Réinitialisez votre mot de passe : {}", reset_link)
        }))
        .send()
        .await;

    tracing::info!(user_id = %user.id, "Password reset email dispatched");

    Ok(Json(serde_json::json!({
        "message": "If an account with that email exists, a reset link has been sent."
    })))
}

/// POST /api/v1/auth/password-reset/confirm — apply a password reset token.
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn password_reset_confirm(
    State(state): State<AppState>,
    Json(payload): Json<PasswordResetConfirmRequest>,
) -> Result<Json<serde_json::Value>> {
    // Validate new password length
    if payload.new_password.len() < 8 {
        return Err(Error::Validation(
            "Password must be at least 8 characters".to_string(),
        ));
    }

    // Fetch the token record
    let row = sqlx::query_as::<_, (Uuid, chrono::DateTime<chrono::Utc>, bool)>(
        r#"SELECT user_id, expires_at, used
           FROM identity.password_reset_tokens
           WHERE token = $1"#,
    )
    .bind(&payload.token)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("DB error: {}", e)))?;

    let (user_id, expires_at, used) = match row {
        Some(r) => r,
        None => return Err(Error::Unauthorized),
    };

    if used {
        return Err(Error::Unauthorized);
    }

    if chrono::Utc::now() > expires_at {
        return Err(Error::Unauthorized);
    }

    // Hash the new password
    let new_hash = crate::auth::hash_password(&payload.new_password).await?;

    // Update password and mark token as used in a transaction
    let mut tx = state
        .pool
        .inner()
        .begin()
        .await
        .map_err(|e| Error::Internal(format!("Transaction error: {}", e)))?;

    sqlx::query(
        r#"UPDATE identity.users SET password_hash = $1, updated_at = now() WHERE id = $2"#,
    )
    .bind(&new_hash)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| Error::Internal(format!("Failed to update password: {}", e)))?;

    sqlx::query(r#"UPDATE identity.password_reset_tokens SET used = true WHERE token = $1"#)
        .bind(&payload.token)
        .execute(&mut *tx)
        .await
        .map_err(|e| Error::Internal(format!("Failed to mark token used: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| Error::Internal(format!("Transaction commit error: {}", e)))?;

    audit_auth_event(
        state.pool.inner(),
        Some(user_id),
        None,
        "password_reset_confirmed",
        user_id,
    )
    .await;

    Ok(Json(serde_json::json!({
        "message": "Password reset successfully."
    })))
}

/// Decrypt LDAP bind password using XOR with LDAP_ENCRYPTION_KEY env var.
/// The encrypted value is base64(XOR(password, key_repeated)).
/// If LDAP_ENCRYPTION_KEY is not set, falls back to plain base64 decode for backward compat.
fn decrypt_ldap_password(encrypted: &str) -> Result<String> {
    use base64::Engine;

    let cipher_bytes = base64::engine::general_purpose::STANDARD
        .decode(encrypted)
        .map_err(|e| Error::Internal(format!("Failed to decode LDAP password: {}", e)))?;

    let key = std::env::var("LDAP_ENCRYPTION_KEY").unwrap_or_default();
    if key.is_empty() {
        // Backward compat: plain base64
        tracing::warn!("LDAP_ENCRYPTION_KEY not set — using plain base64 decode (insecure)");
        return String::from_utf8(cipher_bytes)
            .map_err(|e| Error::Internal(format!("Invalid LDAP password encoding: {}", e)));
    }

    // XOR decrypt with key
    let key_bytes = key.as_bytes();
    let plain_bytes: Vec<u8> = cipher_bytes
        .iter()
        .enumerate()
        .map(|(i, &b)| b ^ key_bytes[i % key_bytes.len()])
        .collect();

    String::from_utf8(plain_bytes)
        .map_err(|e| Error::Internal(format!("Invalid LDAP password after decryption: {}", e)))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
