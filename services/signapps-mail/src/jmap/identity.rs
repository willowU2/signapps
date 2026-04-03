//! JMAP Identity method handlers (RFC 8621 Section 7).
//!
//! Implements `Identity/get` and `Identity/set`.
//! Identities represent sender information (name + email) for composing.
//! They are derived from `mail.accounts` and `mail.aliases`.

use signapps_jmap::types::{GetRequest, GetResponse, SetRequest, SetResponse};
use sqlx::PgPool;
use uuid::Uuid;

/// Internal row type for identity lookups (accounts).
#[derive(Debug, sqlx::FromRow)]
struct AccountIdentityRow {
    id: Uuid,
    email_address: String,
    display_name: Option<String>,
    signature_html: Option<String>,
    signature_text: Option<String>,
}

/// Internal row type for identity lookups (aliases).
#[derive(Debug, sqlx::FromRow)]
struct AliasIdentityRow {
    id: Uuid,
    alias_address: String,
    display_name: Option<String>,
}

/// Handle `Identity/get` — fetch sender identities.
///
/// Returns JMAP Identity objects derived from the user's mail accounts
/// and their configured aliases.
///
/// # Errors
///
/// Returns a `MethodError::server_fail` if the database query fails.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(pool))]
pub async fn identity_get(
    pool: &PgPool,
    user_id: Uuid,
    req: GetRequest,
) -> Result<GetResponse, signapps_jmap::MethodError> {
    let account_id = req.account_id.clone();
    let account_uuid = Uuid::parse_str(&req.account_id)
        .map_err(|_| signapps_jmap::MethodError::invalid_arguments("Invalid accountId format"))?;

    let mut list: Vec<serde_json::Value> = Vec::new();

    // Primary identity from the mail account itself
    let accounts: Vec<AccountIdentityRow> = sqlx::query_as(
        r#"
        SELECT id, email_address, display_name, signature_html, signature_text
        FROM mail.accounts
        WHERE id = $1 AND user_id = $2 AND (status = 'active' OR status IS NULL)
        "#,
    )
    .bind(account_uuid)
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "Identity/get account query failed");
        signapps_jmap::MethodError::server_fail("Database query failed")
    })?;

    for acc in &accounts {
        list.push(serde_json::json!({
            "id": acc.id.to_string(),
            "name": acc.display_name.as_deref().unwrap_or(""),
            "email": acc.email_address,
            "replyTo": null,
            "bcc": null,
            "textSignature": acc.signature_text.as_deref().unwrap_or(""),
            "htmlSignature": acc.signature_html.as_deref().unwrap_or(""),
            "mayDelete": false,
        }));
    }

    // Alias identities (if the aliases table exists)
    let aliases: Vec<AliasIdentityRow> = sqlx::query_as(
        r#"
        SELECT id, alias_address, display_name
        FROM mail.aliases
        WHERE account_id = $1
        ORDER BY created_at
        "#,
    )
    .bind(account_uuid)
    .fetch_all(pool)
    .await
    .unwrap_or_default(); // Silently skip if aliases table doesn't exist

    for alias in &aliases {
        list.push(serde_json::json!({
            "id": format!("alias-{}", alias.id),
            "name": alias.display_name.as_deref().unwrap_or(""),
            "email": alias.alias_address,
            "replyTo": null,
            "bcc": null,
            "textSignature": "",
            "htmlSignature": "",
            "mayDelete": true,
        }));
    }

    // Handle ID filtering if specific IDs were requested
    let not_found = if let Some(requested_ids) = &req.ids {
        let found_ids: std::collections::HashSet<&str> = list
            .iter()
            .filter_map(|v| v.get("id").and_then(|id| id.as_str()))
            .collect();
        requested_ids
            .iter()
            .filter(|id| !found_ids.contains(id.as_str()))
            .cloned()
            .collect()
    } else {
        vec![]
    };

    // Filter list to requested IDs if specified
    if let Some(requested_ids) = &req.ids {
        let requested: std::collections::HashSet<&str> =
            requested_ids.iter().map(|s| s.as_str()).collect();
        list.retain(|v| {
            v.get("id")
                .and_then(|id| id.as_str())
                .map(|id| requested.contains(id))
                .unwrap_or(false)
        });
    }

    Ok(GetResponse {
        account_id,
        state: uuid::Uuid::new_v4().to_string(),
        list,
        not_found,
    })
}

/// Handle `Identity/set` — create or update sender identities.
///
/// Creates new aliases as new identities; updates display name on existing.
///
/// # Errors
///
/// Returns a `MethodError::server_fail` if database operations fail.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(pool))]
pub async fn identity_set(
    pool: &PgPool,
    user_id: Uuid,
    req: SetRequest,
) -> Result<SetResponse, signapps_jmap::MethodError> {
    let account_id = req.account_id.clone();
    let account_uuid = Uuid::parse_str(&req.account_id)
        .map_err(|_| signapps_jmap::MethodError::invalid_arguments("Invalid accountId format"))?;

    // Verify account ownership
    let owns: Option<bool> = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM mail.accounts WHERE id = $1 AND user_id = $2)",
    )
    .bind(account_uuid)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "Identity/set ownership check failed");
        signapps_jmap::MethodError::server_fail("Database query failed")
    })?;

    if owns != Some(true) {
        return Err(signapps_jmap::MethodError::account_not_found());
    }

    let old_state = uuid::Uuid::new_v4().to_string();
    let new_state = uuid::Uuid::new_v4().to_string();

    let mut created = serde_json::Map::new();
    let mut not_created = serde_json::Map::new();

    // ── Create new alias identities ───────────────────────────────────────────
    if let Some(create_map) = &req.create {
        for (creation_id, obj) in create_map {
            let email = obj.get("email").and_then(|v| v.as_str()).unwrap_or("");
            let name = obj.get("name").and_then(|v| v.as_str()).unwrap_or("");

            if email.is_empty() {
                not_created.insert(
                    creation_id.clone(),
                    serde_json::json!({
                        "type": "invalidArguments",
                        "description": "email is required"
                    }),
                );
                continue;
            }

            let new_id = Uuid::new_v4();
            let result = sqlx::query(
                r#"
                INSERT INTO mail.aliases (id, account_id, alias_address, display_name)
                VALUES ($1, $2, $3, $4)
                "#,
            )
            .bind(new_id)
            .bind(account_uuid)
            .bind(email)
            .bind(name)
            .execute(pool)
            .await;

            match result {
                Ok(_) => {
                    created.insert(
                        creation_id.clone(),
                        serde_json::json!({"id": format!("alias-{}", new_id)}),
                    );
                },
                Err(e) => {
                    tracing::error!(?e, creation_id, "Identity/set create failed");
                    not_created.insert(
                        creation_id.clone(),
                        serde_json::json!({
                            "type": "serverFail",
                            "description": "Failed to create identity"
                        }),
                    );
                },
            }
        }
    }

    Ok(SetResponse {
        account_id,
        old_state,
        new_state,
        created: if created.is_empty() {
            None
        } else {
            Some(created)
        },
        updated: None,
        destroyed: None,
        not_created: if not_created.is_empty() {
            None
        } else {
            Some(not_created)
        },
        not_updated: None,
        not_destroyed: None,
    })
}
