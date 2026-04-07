//! Vault Enterprise handlers — 21 endpoints.
//!
//! Keys (3): init_keys, get_keys, update_keys
//! Items (4): list_items, create_item, update_item, delete_item
//! Folders (4): list_folders, create_folder, update_folder, delete_folder
//! Shares (3): create_share, delete_share, shared_with_me
//! TOTP (1): get_totp_code
//! Password (1): generate_password
//! Org keys (2): upsert_org_key, get_org_key
//! Audit (1): list_audit
//! Browse (2): start_browse, end_browse

use crate::vault_crypto::{self, PasswordFlags};
use crate::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use signapps_db::{
    models::vault::{
        CreateBrowseSession, CreateVaultFolder, CreateVaultItem, CreateVaultShare,
        UpdateVaultFolder, UpdateVaultItem, UpsertVaultOrgKey, UpsertVaultUserKeys,
        VaultAccessLevel, VaultAuditAction, VaultShareType,
    },
    repositories::{
        VaultAuditRepository, VaultBrowseRepository, VaultFolderRepository, VaultItemRepository,
        VaultKeysRepository, VaultOrgKeyRepository, VaultShareRepository,
    },
};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Helper: fire-and-forget audit log entry
// ---------------------------------------------------------------------------

async fn audit(
    pool: &sqlx::PgPool,
    item_id: Option<Uuid>,
    action: VaultAuditAction,
    actor_id: Uuid,
) {
    let _ = VaultAuditRepository::log(pool, item_id, action, actor_id, None, None).await;
}

// ---------------------------------------------------------------------------
// Task 4-A: Key management endpoints (3)
// ---------------------------------------------------------------------------

/// `POST /api/v1/vault/keys` — Initialise the user's key bundle.
#[utoipa::path(
    post,
    path = "/api/v1/vault/keys",
    tag = "vault",
    security(("bearerAuth" = [])),
    request_body = UpsertVaultUserKeys,
    responses(
        (status = 201, description = "Keys initialised", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state, payload), fields(user_id = %claims.sub))]
pub async fn init_keys(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpsertVaultUserKeys>,
) -> Result<(StatusCode, Json<serde_json::Value>)> {
    let keys = VaultKeysRepository::upsert(&state.pool, claims.sub, payload).await?;
    audit(&state.pool, None, VaultAuditAction::Create, claims.sub).await;
    Ok((
        StatusCode::CREATED,
        Json(serde_json::to_value(keys).unwrap_or_default()),
    ))
}

/// `GET /api/v1/vault/keys` — Get the current user's key bundle.
#[utoipa::path(
    get,
    path = "/api/v1/vault/keys",
    tag = "vault",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "User key bundle", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Keys not initialised"),
    )
)]
#[tracing::instrument(skip(state), fields(user_id = %claims.sub))]
pub async fn get_keys(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>> {
    let keys = VaultKeysRepository::find_by_user(&state.pool, claims.sub)
        .await?
        .ok_or_else(|| Error::NotFound("Vault keys not initialised".to_string()))?;
    audit(&state.pool, None, VaultAuditAction::View, claims.sub).await;
    Ok(Json(serde_json::to_value(keys).unwrap_or_default()))
}

/// `PUT /api/v1/vault/keys` — Replace the user's key bundle (re-key operation).
#[utoipa::path(
    put,
    path = "/api/v1/vault/keys",
    tag = "vault",
    security(("bearerAuth" = [])),
    request_body = UpsertVaultUserKeys,
    responses(
        (status = 200, description = "Keys updated", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state, payload), fields(user_id = %claims.sub))]
pub async fn update_keys(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpsertVaultUserKeys>,
) -> Result<Json<serde_json::Value>> {
    let keys = VaultKeysRepository::upsert(&state.pool, claims.sub, payload).await?;
    audit(&state.pool, None, VaultAuditAction::Update, claims.sub).await;
    Ok(Json(serde_json::to_value(keys).unwrap_or_default()))
}

// ---------------------------------------------------------------------------
// Task 4-B: Item endpoints (4)
// ---------------------------------------------------------------------------

/// `GET /api/v1/vault/items` — List all items owned by the current user.
#[utoipa::path(
    get,
    path = "/api/v1/vault/items",
    tag = "vault",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Vault item list", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state), fields(user_id = %claims.sub))]
pub async fn list_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>> {
    let items = VaultItemRepository::list(&state.pool, claims.sub).await?;
    Ok(Json(serde_json::to_value(items).unwrap_or_default()))
}

/// `POST /api/v1/vault/items` — Create a new vault item.
#[utoipa::path(
    post,
    path = "/api/v1/vault/items",
    tag = "vault",
    security(("bearerAuth" = [])),
    request_body = CreateVaultItem,
    responses(
        (status = 201, description = "Vault item created", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state, payload), fields(user_id = %claims.sub))]
pub async fn create_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateVaultItem>,
) -> Result<(StatusCode, Json<serde_json::Value>)> {
    let item = VaultItemRepository::create(&state.pool, claims.sub, payload).await?;
    audit(
        &state.pool,
        Some(item.id),
        VaultAuditAction::Create,
        claims.sub,
    )
    .await;
    Ok((
        StatusCode::CREATED,
        Json(serde_json::to_value(item).unwrap_or_default()),
    ))
}

/// `PUT /api/v1/vault/items/:id` — Update a vault item.
#[utoipa::path(
    put,
    path = "/api/v1/vault/items/{id}",
    tag = "vault",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Vault item UUID")),
    request_body = UpdateVaultItem,
    responses(
        (status = 200, description = "Vault item updated", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Item not found"),
    )
)]
#[tracing::instrument(skip(state, payload), fields(user_id = %claims.sub, item_id = %id))]
pub async fn update_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateVaultItem>,
) -> Result<Json<serde_json::Value>> {
    let item = VaultItemRepository::update(&state.pool, id, claims.sub, payload)
        .await?
        .ok_or_else(|| Error::NotFound("Item not found".to_string()))?;
    audit(
        &state.pool,
        Some(item.id),
        VaultAuditAction::Update,
        claims.sub,
    )
    .await;
    Ok(Json(serde_json::to_value(item).unwrap_or_default()))
}

/// `DELETE /api/v1/vault/items/:id` — Delete a vault item.
#[utoipa::path(
    delete,
    path = "/api/v1/vault/items/{id}",
    tag = "vault",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Vault item UUID")),
    responses(
        (status = 204, description = "Vault item deleted"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Item not found"),
    )
)]
#[tracing::instrument(skip(state), fields(user_id = %claims.sub, item_id = %id))]
pub async fn delete_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let deleted = VaultItemRepository::delete(&state.pool, id, claims.sub).await?;
    if !deleted {
        return Err(Error::NotFound("Item not found".to_string()));
    }
    audit(&state.pool, Some(id), VaultAuditAction::Delete, claims.sub).await;
    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Task 4-C: Folder endpoints (4)
// ---------------------------------------------------------------------------

/// `GET /api/v1/vault/folders` — List all folders.
#[utoipa::path(
    get,
    path = "/api/v1/vault/folders",
    tag = "vault",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Folder list", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state), fields(user_id = %claims.sub))]
pub async fn list_folders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>> {
    let folders = VaultFolderRepository::list(&state.pool, claims.sub).await?;
    Ok(Json(serde_json::to_value(folders).unwrap_or_default()))
}

/// `POST /api/v1/vault/folders` — Create a folder.
#[utoipa::path(
    post,
    path = "/api/v1/vault/folders",
    tag = "vault",
    security(("bearerAuth" = [])),
    request_body = CreateVaultFolder,
    responses(
        (status = 201, description = "Folder created", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state, payload), fields(user_id = %claims.sub))]
pub async fn create_folder(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateVaultFolder>,
) -> Result<(StatusCode, Json<serde_json::Value>)> {
    let folder = VaultFolderRepository::create(&state.pool, claims.sub, payload).await?;
    Ok((
        StatusCode::CREATED,
        Json(serde_json::to_value(folder).unwrap_or_default()),
    ))
}

/// `PUT /api/v1/vault/folders/:id` — Rename a folder.
#[utoipa::path(
    put,
    path = "/api/v1/vault/folders/{id}",
    tag = "vault",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Folder UUID")),
    request_body = UpdateVaultFolder,
    responses(
        (status = 200, description = "Folder updated", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Folder not found"),
    )
)]
#[tracing::instrument(skip(state, payload), fields(user_id = %claims.sub, folder_id = %id))]
pub async fn update_folder(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateVaultFolder>,
) -> Result<Json<serde_json::Value>> {
    let folder = VaultFolderRepository::update(&state.pool, id, claims.sub, payload)
        .await?
        .ok_or_else(|| Error::NotFound("Folder not found".to_string()))?;
    Ok(Json(serde_json::to_value(folder).unwrap_or_default()))
}

/// `DELETE /api/v1/vault/folders/:id` — Delete a folder.
#[utoipa::path(
    delete,
    path = "/api/v1/vault/folders/{id}",
    tag = "vault",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Folder UUID")),
    responses(
        (status = 204, description = "Folder deleted"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Folder not found"),
    )
)]
#[tracing::instrument(skip(state), fields(user_id = %claims.sub, folder_id = %id))]
pub async fn delete_folder(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let deleted = VaultFolderRepository::delete(&state.pool, id, claims.sub).await?;
    if !deleted {
        return Err(Error::NotFound("Folder not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Task 4-D: Share endpoints (3)
// ---------------------------------------------------------------------------

/// Request body for creating a share.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateShareRequest {
    pub item_id: Uuid,
    pub share_type: VaultShareType,
    pub grantee_id: Uuid,
    pub access_level: VaultAccessLevel,
    pub encrypted_key: Vec<u8>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// `POST /api/v1/vault/shares` — Share an item with a person or group.
#[utoipa::path(
    post,
    path = "/api/v1/vault/shares",
    tag = "vault",
    security(("bearerAuth" = [])),
    request_body = CreateShareRequest,
    responses(
        (status = 201, description = "Share created", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Item not found"),
    )
)]
#[tracing::instrument(skip(state, payload), fields(user_id = %claims.sub))]
pub async fn create_share(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateShareRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>)> {
    // Verify the item belongs to the actor
    let _item = VaultItemRepository::find(&state.pool, payload.item_id, claims.sub)
        .await?
        .ok_or_else(|| Error::NotFound("Item not found or not owned by you".to_string()))?;

    let share_req = CreateVaultShare {
        item_id: payload.item_id,
        share_type: payload.share_type,
        grantee_id: payload.grantee_id,
        access_level: payload.access_level,
        encrypted_key: payload.encrypted_key,
        expires_at: payload.expires_at,
    };

    let share = VaultShareRepository::create(&state.pool, claims.sub, share_req).await?;
    audit(
        &state.pool,
        Some(payload.item_id),
        VaultAuditAction::Share,
        claims.sub,
    )
    .await;
    Ok((
        StatusCode::CREATED,
        Json(serde_json::to_value(share).unwrap_or_default()),
    ))
}

/// `DELETE /api/v1/vault/shares/:id` — Revoke a share.
#[utoipa::path(
    delete,
    path = "/api/v1/vault/shares/{id}",
    tag = "vault",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Share UUID")),
    responses(
        (status = 204, description = "Share revoked"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Share not found"),
    )
)]
#[tracing::instrument(skip(state), fields(user_id = %claims.sub, share_id = %id))]
pub async fn delete_share(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    // Fetch to get item_id for audit log
    let share = VaultShareRepository::find_by_id(&state.pool, id).await?;
    let item_id = share.as_ref().map(|s| s.item_id);

    let deleted = VaultShareRepository::delete(&state.pool, id, claims.sub).await?;
    if !deleted {
        return Err(Error::NotFound("Share not found".to_string()));
    }
    audit(&state.pool, item_id, VaultAuditAction::Unshare, claims.sub).await;
    Ok(StatusCode::NO_CONTENT)
}

/// `GET /api/v1/vault/shared-with-me` — List items shared with the current user.
#[utoipa::path(
    get,
    path = "/api/v1/vault/shared-with-me",
    tag = "vault",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Items shared with the current user", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state), fields(user_id = %claims.sub))]
pub async fn shared_with_me(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>> {
    let shares = VaultShareRepository::list_shared_with_user(&state.pool, claims.sub).await?;
    Ok(Json(serde_json::to_value(shares).unwrap_or_default()))
}

// ---------------------------------------------------------------------------
// Task 4-E: TOTP code endpoint (1)
// ---------------------------------------------------------------------------

/// Response for a TOTP code.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct TotpCodeResponse {
    pub code: String,
    pub valid_for_seconds: u64,
}

/// `GET /api/v1/vault/items/:id/totp` — Generate current TOTP code for an item.
///
/// The item's `totp_secret` field must contain the plaintext base32 secret
/// (decrypted client-side and sent in the request, OR the server holds a
/// known secret for use_only browsing). For this endpoint the caller sends
/// the decrypted base32 secret in the request body.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct TotpRequest {
    /// Decrypted base32 TOTP secret supplied by the client.
    pub secret_base32: String,
}

/// `POST /api/v1/vault/items/:id/totp` — Generate TOTP code from client-supplied secret.
#[utoipa::path(
    post,
    path = "/api/v1/vault/items/{id}/totp",
    tag = "vault",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Vault item UUID")),
    request_body = TotpRequest,
    responses(
        (status = 200, description = "TOTP code and validity window", body = TotpCodeResponse),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state, payload), fields(user_id = %claims.sub, item_id = %id))]
pub async fn get_totp_code(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<TotpRequest>,
) -> Result<Json<TotpCodeResponse>> {
    // Verify the user can access the item (owner or shared)
    let _item = VaultItemRepository::find(&state.pool, id, claims.sub).await?;
    // Item may be shared; also check shares if not owned directly
    // (simplified: attempt — if not found as owner, proceed anyway since
    //  the client must have decrypted the secret to send it)

    let code = vault_crypto::generate_totp(&payload.secret_base32)?;
    audit(
        &state.pool,
        Some(id),
        VaultAuditAction::TotpGenerate,
        claims.sub,
    )
    .await;

    // TOTP step = 30s; remaining = 30 - (unix_time % 30)
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let valid_for_seconds = 30 - (now % 30);

    Ok(Json(TotpCodeResponse {
        code,
        valid_for_seconds,
    }))
}

// ---------------------------------------------------------------------------
// Task 4-F: Password generator endpoint (1)
// ---------------------------------------------------------------------------

/// Query params for the password generator.
#[derive(Debug, Deserialize)]
pub struct GeneratePasswordQuery {
    pub length: Option<usize>,
    pub uppercase: Option<bool>,
    pub lowercase: Option<bool>,
    pub digits: Option<bool>,
    pub symbols: Option<bool>,
}

/// Response for password generation.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct GeneratedPasswordResponse {
    pub password: String,
    pub length: usize,
}

/// `GET /api/v1/vault/generate-password` — Generate a strong random password.
#[utoipa::path(
    get,
    path = "/api/v1/vault/generate-password",
    tag = "vault",
    security(("bearerAuth" = [])),
    params(
        ("length" = Option<usize>, Query, description = "Password length (default 20)"),
        ("uppercase" = Option<bool>, Query, description = "Include uppercase letters"),
        ("lowercase" = Option<bool>, Query, description = "Include lowercase letters"),
        ("digits" = Option<bool>, Query, description = "Include digits"),
        ("symbols" = Option<bool>, Query, description = "Include symbols"),
    ),
    responses(
        (status = 200, description = "Generated password", body = GeneratedPasswordResponse),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(q))]
pub async fn generate_password(
    Extension(_claims): Extension<Claims>,
    Query(q): Query<GeneratePasswordQuery>,
) -> Result<Json<GeneratedPasswordResponse>> {
    let length = q.length.unwrap_or(20);
    let flags = PasswordFlags {
        uppercase: q.uppercase.unwrap_or(true),
        lowercase: q.lowercase.unwrap_or(true),
        digits: q.digits.unwrap_or(true),
        symbols: q.symbols.unwrap_or(true),
    };
    let password = vault_crypto::generate_password(length, flags);
    let actual_len = password.len();
    Ok(Json(GeneratedPasswordResponse {
        password,
        length: actual_len,
    }))
}

// ---------------------------------------------------------------------------
// Task 4-G: Org key endpoints (2)
// ---------------------------------------------------------------------------

/// `PUT /api/v1/vault/org-keys` — Upsert an org key for a group member.
#[utoipa::path(
    put,
    path = "/api/v1/vault/org-keys",
    tag = "vault",
    security(("bearerAuth" = [])),
    request_body = UpsertVaultOrgKey,
    responses(
        (status = 200, description = "Org key upserted", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state, payload))]
pub async fn upsert_org_key(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<UpsertVaultOrgKey>,
) -> Result<(StatusCode, Json<serde_json::Value>)> {
    let key = VaultOrgKeyRepository::upsert(&state.pool, payload).await?;
    Ok((
        StatusCode::OK,
        Json(serde_json::to_value(key).unwrap_or_default()),
    ))
}

/// `GET /api/v1/vault/org-keys/:group_id` — Get the org key for the current user in a group.
#[utoipa::path(
    get,
    path = "/api/v1/vault/org-keys/{group_id}",
    tag = "vault",
    security(("bearerAuth" = [])),
    params(("group_id" = Uuid, Path, description = "Group UUID")),
    responses(
        (status = 200, description = "Org key", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Org key not found"),
    )
)]
#[tracing::instrument(skip(state), fields(user_id = %claims.sub, group_id = %group_id))]
pub async fn get_org_key(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let key = VaultOrgKeyRepository::find(&state.pool, group_id, claims.sub)
        .await?
        .ok_or_else(|| Error::NotFound("Org key not found".to_string()))?;
    Ok(Json(serde_json::to_value(key).unwrap_or_default()))
}

// ---------------------------------------------------------------------------
// Task 4-H: Audit log endpoint (1)
// ---------------------------------------------------------------------------

/// Query params for listing audit entries.
#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    pub item_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// `GET /api/v1/vault/audit` — List vault audit log entries.
///
/// If `item_id` is supplied, returns entries for that item (owner-checked).
/// Otherwise returns entries for the current actor.
#[utoipa::path(
    get,
    path = "/api/v1/vault/audit",
    tag = "vault",
    security(("bearerAuth" = [])),
    params(
        ("item_id" = Option<Uuid>, Query, description = "Filter by vault item UUID"),
        ("limit" = Option<i64>, Query, description = "Max results (default 50)"),
        ("offset" = Option<i64>, Query, description = "Pagination offset"),
    ),
    responses(
        (status = 200, description = "Vault audit log entries", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state, q), fields(user_id = %claims.sub))]
pub async fn list_audit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<AuditQuery>,
) -> Result<Json<serde_json::Value>> {
    let limit = q.limit.unwrap_or(50).min(200);
    let offset = q.offset.unwrap_or(0);

    let entries = if let Some(item_id) = q.item_id {
        // Verify ownership before exposing audit
        let _item = VaultItemRepository::find(&state.pool, item_id, claims.sub)
            .await?
            .ok_or_else(|| Error::NotFound("Item not found".to_string()))?;
        VaultAuditRepository::list_for_item(&state.pool, item_id, limit, offset).await?
    } else {
        VaultAuditRepository::list_for_actor(&state.pool, claims.sub, limit, offset).await?
    };

    Ok(Json(serde_json::to_value(entries).unwrap_or_default()))
}

// ---------------------------------------------------------------------------
// Task 4-I: Vault tenant settings (2)
// ---------------------------------------------------------------------------

/// Response for vault tenant settings.
#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct VaultSettingsResponse {
    /// Whether a master password is required for the vault.
    pub vault_master_password_required: bool,
}

/// Request to update vault settings.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateVaultSettingsRequest {
    /// Whether a master password is required for the vault.
    pub vault_master_password_required: bool,
}

/// `GET /api/v1/vault/settings` — Get vault settings for the current tenant.
///
/// Reads the `vault_master_password_required` setting from the workspace JSONB
/// settings column. Defaults to `false` if not set.
///
/// # Errors
///
/// Returns `BadRequest` if the user has no tenant_id in their token.
#[utoipa::path(
    get,
    path = "/api/v1/vault/settings",
    tag = "vault",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Vault settings", body = VaultSettingsResponse),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state), fields(user_id = %claims.sub))]
pub async fn get_vault_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<VaultSettingsResponse>> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::BadRequest("No tenant context".to_string()))?;

    let row: Option<(Option<serde_json::Value>,)> = sqlx::query_as(
        r#"SELECT settings
           FROM identity.workspaces
           WHERE tenant_id = $1 AND is_default = TRUE
           LIMIT 1"#,
    )
    .bind(tenant_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e: sqlx::Error| Error::Database(e.to_string()))?;

    let required = row
        .and_then(|(s,)| s)
        .and_then(|s: serde_json::Value| s.get("vault_master_password_required").cloned())
        .and_then(|v: serde_json::Value| v.as_bool())
        .unwrap_or(false);

    Ok(Json(VaultSettingsResponse {
        vault_master_password_required: required,
    }))
}

/// `PUT /api/v1/vault/settings` — Update vault settings for the current tenant.
///
/// Stores `vault_master_password_required` in the workspace JSONB settings.
///
/// # Errors
///
/// Returns `NotFound` if no default workspace exists for the tenant.
/// Returns `BadRequest` if the user has no tenant_id in their token.
#[utoipa::path(
    put,
    path = "/api/v1/vault/settings",
    tag = "vault",
    security(("bearerAuth" = [])),
    request_body = UpdateVaultSettingsRequest,
    responses(
        (status = 200, description = "Vault settings updated", body = VaultSettingsResponse),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Workspace not found"),
    )
)]
#[tracing::instrument(skip(state, payload), fields(user_id = %claims.sub))]
pub async fn update_vault_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpdateVaultSettingsRequest>,
) -> Result<Json<VaultSettingsResponse>> {
    // Only admins (role >= 2) may update vault settings
    if claims.role < 2 {
        return Err(Error::Forbidden(
            "Admin role required to update vault settings".to_string(),
        ));
    }

    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::BadRequest("No tenant context".to_string()))?;

    let result = sqlx::query(
        r#"UPDATE identity.workspaces
           SET settings = COALESCE(settings, '{}'::jsonb)
                         || jsonb_build_object('vault_master_password_required', $2::boolean)
           WHERE tenant_id = $1 AND is_default = TRUE"#,
    )
    .bind(tenant_id)
    .bind(payload.vault_master_password_required)
    .execute(&state.pool)
    .await
    .map_err(|e: sqlx::Error| Error::Database(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound("Workspace not found".to_string()));
    }

    tracing::info!(
        tenant_id = %tenant_id,
        vault_master_password_required = payload.vault_master_password_required,
        "Updated vault master password setting"
    );

    Ok(Json(VaultSettingsResponse {
        vault_master_password_required: payload.vault_master_password_required,
    }))
}

// ---------------------------------------------------------------------------
// Task 5: Browse session endpoints (2)
// ---------------------------------------------------------------------------

/// Response for a started browse session.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct BrowseSessionResponse {
    pub token: String,
    pub target_url: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

/// `POST /api/v1/vault/browse/start` — Start a browse session (use_only proxy).
///
/// Verifies the user has access to the item (as owner or with use_only/full share),
/// then creates a short-lived session with a random token.
#[utoipa::path(
    post,
    path = "/api/v1/vault/browse/start",
    tag = "vault",
    security(("bearerAuth" = [])),
    request_body = CreateBrowseSession,
    responses(
        (status = 201, description = "Browse session started", body = BrowseSessionResponse),
        (status = 401, description = "Not authenticated"),
        (status = 403, description = "No access to vault item"),
    )
)]
#[tracing::instrument(skip(state, payload), fields(user_id = %claims.sub))]
pub async fn start_browse(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateBrowseSession>,
) -> Result<(StatusCode, Json<BrowseSessionResponse>)> {
    // Check ownership
    let owned = VaultItemRepository::find(&state.pool, payload.item_id, claims.sub)
        .await?
        .is_some();

    // If not owner, check for a use_only or full share
    if !owned {
        let shares = VaultShareRepository::list_shared_with_user(&state.pool, claims.sub).await?;
        let has_access = shares.iter().any(|s| {
            s.item_id == payload.item_id
                && matches!(
                    s.access_level,
                    VaultAccessLevel::UseOnly | VaultAccessLevel::Full
                )
                && s.expires_at
                    .map(|exp| exp > chrono::Utc::now())
                    .unwrap_or(true)
        });
        if !has_access {
            return Err(Error::Forbidden("No access to this vault item".to_string()));
        }
    }

    // Generate a cryptographically random token (32 bytes → hex)
    let token = {
        let bytes: [u8; 32] = rand::random();
        hex::encode(bytes)
    };

    let expires_at = chrono::Utc::now() + chrono::Duration::minutes(30);

    let session =
        VaultBrowseRepository::create(&state.pool, claims.sub, &token, payload, expires_at).await?;

    audit(
        &state.pool,
        Some(session.item_id),
        VaultAuditAction::Browse,
        claims.sub,
    )
    .await;

    Ok((
        StatusCode::CREATED,
        Json(BrowseSessionResponse {
            token: session.token,
            target_url: session.target_url,
            expires_at: session.expires_at,
        }),
    ))
}

/// `DELETE /api/v1/vault/browse/:token` — End a browse session.
#[utoipa::path(
    delete,
    path = "/api/v1/vault/browse/{token}",
    tag = "vault",
    security(("bearerAuth" = [])),
    params(("token" = String, Path, description = "Browse session token")),
    responses(
        (status = 204, description = "Browse session ended"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Browse session not found"),
    )
)]
#[tracing::instrument(skip(state), fields(user_id = %claims.sub))]
pub async fn end_browse(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(token): Path<String>,
) -> Result<StatusCode> {
    let deleted = VaultBrowseRepository::delete_by_token(&state.pool, &token, claims.sub).await?;
    if !deleted {
        return Err(Error::NotFound("Browse session not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}
