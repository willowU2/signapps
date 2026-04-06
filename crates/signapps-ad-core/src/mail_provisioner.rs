// crates/signapps-ad-core/src/mail_provisioner.rs
//! Mail provisioning for the org→AD sync pipeline.
//!
//! Handles three concerns:
//!
//! 1. **User mail aliases** — resolves the default domain (closest ancestor) and
//!    every sub-branch domain below the user's node, then upserts the resulting
//!    addresses into `ad_mail_aliases`.
//!
//! 2. **Shared OU mailboxes** — creates or updates an `ad_shared_mailboxes` entry
//!    for an OU with a normalised `{ou-name}@{dns_name}` address.
//!
//! 3. **IMAP folder subscriptions** — walks the ancestor chain from the user's node
//!    to the root, building a nested `[Shared]/…` folder path for every ancestor OU
//!    that has a shared mailbox with the right visibility settings, then upserts
//!    entries into `ad_shared_mailbox_subscriptions`.
//!
//! # Examples
//!
//! ```rust,ignore
//! use signapps_ad_core::mail_provisioner;
//! use uuid::Uuid;
//!
//! # async fn example(pool: &sqlx::PgPool) -> signapps_common::Result<()> {
//! let aliases = mail_provisioner::compute_user_mail_aliases(
//!     pool,
//!     user_account_id,
//!     person_id,
//!     node_id,
//!     "j.dupont",
//! ).await?;
//!
//! let subs = mail_provisioner::compute_user_subscriptions(
//!     pool,
//!     user_account_id,
//!     node_id,
//! ).await?;
//! # Ok(())
//! # }
//! ```

use signapps_common::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::mail_resolver;

// ── Public types ──────────────────────────────────────────────────────────────

/// A resolved mail alias entry ready to be stored in `ad_mail_aliases`.
///
/// # Examples
///
/// ```
/// use uuid::Uuid;
/// use signapps_ad_core::mail_provisioner::MailAliasEntry;
///
/// let entry = MailAliasEntry {
///     mail_address: "j.dupont@corp.local".to_string(),
///     domain_id: Uuid::new_v4(),
///     is_default: true,
/// };
/// assert!(entry.is_default);
/// ```
#[derive(Debug, Clone)]
pub struct MailAliasEntry {
    /// The full SMTP address, e.g. `j.dupont@corp.local`.
    pub mail_address: String,
    /// The `infrastructure.domains.id` this address belongs to.
    pub domain_id: Uuid,
    /// `true` for the primary/default alias (closest ancestor domain).
    pub is_default: bool,
}

/// A resolved IMAP folder subscription entry ready to be stored in
/// `ad_shared_mailbox_subscriptions`.
///
/// # Examples
///
/// ```
/// use uuid::Uuid;
/// use signapps_ad_core::mail_provisioner::SubscriptionEntry;
///
/// let entry = SubscriptionEntry {
///     mailbox_id: Uuid::new_v4(),
///     imap_folder_path: "[Shared]/Corp/SI/Dev Frontend".to_string(),
///     can_send_as: false,
/// };
/// assert!(!entry.can_send_as);
/// ```
#[derive(Debug, Clone)]
pub struct SubscriptionEntry {
    /// The `ad_shared_mailboxes.id` this subscription is for.
    pub mailbox_id: Uuid,
    /// The IMAP folder path as shown in the mail client, e.g. `[Shared]/Corp/SI`.
    pub imap_folder_path: String,
    /// Whether the user may send mail *as* this shared mailbox address.
    pub can_send_as: bool,
}

// ── Public functions ──────────────────────────────────────────────────────────

/// Compute all mail aliases for a user and upsert them into `ad_mail_aliases`.
///
/// The default alias uses the closest ancestor domain (via
/// [`mail_resolver::resolve_closest_mail_domain`]).  Secondary aliases are
/// generated for every sub-branch domain below the user's node (via
/// [`mail_resolver::resolve_mail_aliases`]).  All aliases share the same local
/// part: `sam_account_name`.
///
/// The function is idempotent — it uses `ON CONFLICT DO UPDATE` so repeated
/// calls are safe.
///
/// # Errors
///
/// Returns `Error::Database` if any query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,ignore
/// let aliases = compute_user_mail_aliases(
///     &pool, user_account_id, person_id, node_id, "j.dupont"
/// ).await?;
/// for a in &aliases {
///     tracing::info!(address = %a.mail_address, default = a.is_default);
/// }
/// ```
#[tracing::instrument(skip(pool), fields(
    user_account_id = %user_account_id,
    node_id = %node_id,
    sam = %sam_account_name
))]
pub async fn compute_user_mail_aliases(
    pool: &PgPool,
    user_account_id: Uuid,
    _person_id: Uuid,
    node_id: Uuid,
    sam_account_name: &str,
) -> Result<Vec<MailAliasEntry>> {
    let mut entries: Vec<MailAliasEntry> = Vec::new();

    // ── 1. Default alias from closest ancestor domain ──────────────────────
    let default_domain = mail_resolver::resolve_closest_mail_domain(pool, node_id).await?;
    let mut default_domain_id: Option<Uuid> = None;

    if let Some((domain_id, dns_name)) = default_domain {
        let mail_address = format!("{}@{}", sam_account_name, dns_name);
        upsert_mail_alias(pool, user_account_id, &mail_address, domain_id, true).await?;
        entries.push(MailAliasEntry { mail_address, domain_id, is_default: true });
        default_domain_id = Some(domain_id);
    }

    // ── 2. Secondary aliases from sub-branch domains ───────────────────────
    let alias_domains = mail_resolver::resolve_mail_aliases(pool, node_id).await?;

    for (domain_id, dns_name) in alias_domains {
        // Skip if this is the same domain as the default (already inserted).
        if default_domain_id == Some(domain_id) {
            continue;
        }
        let mail_address = format!("{}@{}", sam_account_name, dns_name);
        upsert_mail_alias(pool, user_account_id, &mail_address, domain_id, false).await?;
        entries.push(MailAliasEntry { mail_address, domain_id, is_default: false });
    }

    tracing::info!(
        alias_count = entries.len(),
        "Mail aliases computed and upserted"
    );
    Ok(entries)
}

/// Create or update the shared mailbox entry for an OU.
///
/// The OU name is normalised to a mail-safe form: lowercased and spaces
/// replaced with hyphens.  The resulting address is
/// `{normalised_name}@{dns_name}`.
///
/// Returns the `ad_shared_mailboxes.id` that was created or updated, or
/// `None` if the OU's `mail_distribution_enabled` flag is `false`.
///
/// # Errors
///
/// Returns `Error::Database` if any query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,ignore
/// let mailbox_id = provision_ou_shared_mailbox(
///     &pool, ou_id, "Dev Frontend", domain_id, "corp.local"
/// ).await?;
/// ```
#[tracing::instrument(skip(pool), fields(ou_id = %ou_id, ou_name = %ou_name))]
pub async fn provision_ou_shared_mailbox(
    pool: &PgPool,
    ou_id: Uuid,
    ou_name: &str,
    domain_id: Uuid,
    dns_name: &str,
) -> Result<Option<Uuid>> {
    // Check whether mail distribution is enabled on the OU.
    let mail_dist_enabled: Option<bool> = sqlx::query_scalar(
        "SELECT mail_distribution_enabled FROM ad_ous WHERE id = $1",
    )
    .bind(ou_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let enabled = mail_dist_enabled.unwrap_or(true);
    if !enabled {
        tracing::debug!(ou_id = %ou_id, "mail_distribution_enabled=false — skipping shared mailbox");
        return Ok(None);
    }

    let normalised = normalise_ou_name(ou_name);
    let mail_address = format!("{}@{}", normalised, dns_name);

    let mailbox_id: Uuid = sqlx::query_scalar(
        r#"INSERT INTO ad_shared_mailboxes
               (ou_id, mail_address, domain_id, display_name)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (mail_address)
               DO UPDATE SET
                   ou_id        = EXCLUDED.ou_id,
                   domain_id    = EXCLUDED.domain_id,
                   display_name = EXCLUDED.display_name
           RETURNING id"#,
    )
    .bind(ou_id)
    .bind(&mail_address)
    .bind(domain_id)
    .bind(ou_name)
    .fetch_one(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    tracing::info!(
        mailbox_id = %mailbox_id,
        mail_address = %mail_address,
        "Shared OU mailbox provisioned"
    );
    Ok(Some(mailbox_id))
}

/// Compute and sync IMAP folder subscriptions for a user.
///
/// The algorithm (from spec §9.8):
///
/// 1. Fetch all ancestors of `node_id` ordered from root to the user's node.
/// 2. For each ancestor that has a shared mailbox:
///    - Skip if `shared_mailbox_enabled` is `false`.
///    - Skip if the ancestor is not the user's own node and
///      `shared_mailbox_visible_to_children` is `false`.
///    - Build the nested IMAP path: `[Shared]/{ancestor1}/{ancestor2}/…`.
///    - Determine `can_send_as` from the mailbox `config.shared_mailbox_send_as`.
/// 3. Add subscriptions for cross-functional group mailboxes.
/// 4. Upsert every resolved subscription into `ad_shared_mailbox_subscriptions`.
///
/// Returns the list of resolved subscriptions.
///
/// # Errors
///
/// Returns `Error::Database` if any query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,ignore
/// let subs = compute_user_subscriptions(&pool, user_account_id, node_id).await?;
/// for s in &subs {
///     tracing::info!(path = %s.imap_folder_path, send_as = s.can_send_as);
/// }
/// ```
#[tracing::instrument(skip(pool), fields(user_account_id = %user_account_id, node_id = %node_id))]
pub async fn compute_user_subscriptions(
    pool: &PgPool,
    user_account_id: Uuid,
    node_id: Uuid,
) -> Result<Vec<SubscriptionEntry>> {
    // ── 1. Fetch all ancestors from root to the user's own node ──────────
    // The closure table stores (ancestor, descendant, depth).
    // depth=0 means the node itself.  We ORDER BY depth DESC to get root-first.
    let ancestors: Vec<(Uuid, i32)> = sqlx::query_as(
        r#"SELECT ancestor_id, depth
           FROM core.org_closure
           WHERE descendant_id = $1
           ORDER BY depth DESC"#,
    )
    .bind(node_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let mut subscriptions: Vec<SubscriptionEntry> = Vec::new();
    let mut path_parts: Vec<String> = Vec::new();

    // ── 2. Walk ancestors, root first ────────────────────────────────────
    for (ancestor_id, depth) in &ancestors {
        let is_own_node = *depth == 0;

        // Look up the shared mailbox for the OU associated with this ancestor.
        let mailbox: Option<(Uuid, String, serde_json::Value)> = sqlx::query_as(
            r#"SELECT sm.id, sm.display_name, sm.config
               FROM ad_shared_mailboxes sm
               JOIN ad_ous ao ON ao.id = sm.ou_id
               WHERE ao.node_id = $1
                 AND sm.is_active = true
               LIMIT 1"#,
        )
        .bind(ancestor_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

        let Some((mailbox_id, display_name, config)) = mailbox else {
            continue;
        };

        // Check shared_mailbox_enabled.
        let mb_enabled = config["shared_mailbox_enabled"].as_bool().unwrap_or(true);
        if !mb_enabled {
            continue;
        }

        // Check visibility for children (skip ancestor mailboxes that are not
        // visible to descendants, unless this is the user's own node).
        if !is_own_node {
            let visible_to_children =
                config["shared_mailbox_visible_to_children"].as_bool().unwrap_or(true);
            if !visible_to_children {
                continue;
            }
        }

        path_parts.push(display_name.clone());
        let folder_path = format!("[Shared]/{}", path_parts.join("/"));

        // Determine can_send_as from send_as policy.
        let send_as_policy = config["shared_mailbox_send_as"].as_str().unwrap_or("members");
        let can_send_as = match send_as_policy {
            "members" => true,
            "managers" => is_user_board_member(pool, user_account_id, *ancestor_id).await?,
            _ => false, // "none" or any unknown value
        };

        upsert_subscription(pool, mailbox_id, user_account_id, &folder_path, can_send_as).await?;
        subscriptions.push(SubscriptionEntry { mailbox_id, imap_folder_path: folder_path, can_send_as });
    }

    // ── 3. Cross-functional group mailboxes ───────────────────────────────
    // Find every security group the user belongs to that has a shared mailbox.
    let group_mailboxes: Vec<(Uuid, String)> = sqlx::query_as(
        r#"SELECT sm.id, sm.display_name
           FROM ad_shared_mailboxes sm
           JOIN ad_group_members gm ON gm.group_id = sm.group_id
           JOIN ad_security_groups sg ON sg.id = gm.group_id
           JOIN ad_user_accounts ua ON ua.id = $1
               AND sg.domain_id = ua.domain_id
           WHERE gm.member_type = 'user'
             AND gm.member_id = $1
             AND sm.is_active = true"#,
    )
    .bind(user_account_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    for (mailbox_id, display_name) in group_mailboxes {
        let folder_path = format!("[Shared]/Groupes/{}", display_name);
        // Group mailboxes default to can_send_as = false (individual policy).
        upsert_subscription(pool, mailbox_id, user_account_id, &folder_path, false).await?;
        subscriptions.push(SubscriptionEntry {
            mailbox_id,
            imap_folder_path: folder_path,
            can_send_as: false,
        });
    }

    tracing::info!(subscription_count = subscriptions.len(), "IMAP subscriptions computed");
    Ok(subscriptions)
}

// ── Private helpers ───────────────────────────────────────────────────────────

/// Normalise an OU display name to a mail-safe local-part.
///
/// Converts to lowercase and replaces spaces (and sequences of spaces) with
/// hyphens.  Non-ASCII characters are kept as-is (the mail server handles
/// IDN).
fn normalise_ou_name(name: &str) -> String {
    name.to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join("-")
}

/// Upsert a row into `ad_mail_aliases`.
async fn upsert_mail_alias(
    pool: &PgPool,
    user_account_id: Uuid,
    mail_address: &str,
    domain_id: Uuid,
    is_default: bool,
) -> Result<()> {
    sqlx::query(
        r#"INSERT INTO ad_mail_aliases
               (user_account_id, mail_address, domain_id, is_default)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (mail_address)
               DO UPDATE SET
                   user_account_id = EXCLUDED.user_account_id,
                   domain_id       = EXCLUDED.domain_id,
                   is_default      = EXCLUDED.is_default,
                   is_active       = true"#,
    )
    .bind(user_account_id)
    .bind(mail_address)
    .bind(domain_id)
    .bind(is_default)
    .execute(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;
    Ok(())
}

/// Upsert a row into `ad_shared_mailbox_subscriptions`.
async fn upsert_subscription(
    pool: &PgPool,
    mailbox_id: Uuid,
    user_account_id: Uuid,
    imap_folder_path: &str,
    can_send_as: bool,
) -> Result<()> {
    sqlx::query(
        r#"INSERT INTO ad_shared_mailbox_subscriptions
               (mailbox_id, user_account_id, imap_folder_path, can_send_as)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (mailbox_id, user_account_id)
               DO UPDATE SET
                   imap_folder_path = EXCLUDED.imap_folder_path,
                   can_send_as      = EXCLUDED.can_send_as,
                   is_subscribed    = true"#,
    )
    .bind(mailbox_id)
    .bind(user_account_id)
    .bind(imap_folder_path)
    .bind(can_send_as)
    .execute(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;
    Ok(())
}

/// Returns `true` if `user_account_id` is a board member of the org node
/// `ancestor_node_id`, allowing them to send-as the ancestor's shared mailbox
/// when the policy is `managers`.
async fn is_user_board_member(
    pool: &PgPool,
    user_account_id: Uuid,
    ancestor_node_id: Uuid,
) -> Result<bool> {
    // The board is stored in `core.node_board_members`.  A user is a board
    // member if their `person_id` (linked via `ad_user_accounts → core.persons`)
    // appears there.
    let count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)
           FROM core.node_board_members nbm
           JOIN core.assignments a ON a.person_id = nbm.person_id
               AND a.node_id = nbm.node_id
           JOIN ad_user_accounts ua ON ua.person_id = a.person_id
           WHERE nbm.node_id = $1
             AND ua.id = $2"#,
    )
    .bind(ancestor_node_id)
    .bind(user_account_id)
    .fetch_one(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;
    Ok(count > 0)
}

#[cfg(test)]
mod tests {
    use super::normalise_ou_name;

    #[test]
    fn normalise_single_word() {
        assert_eq!(normalise_ou_name("DRH"), "drh");
    }

    #[test]
    fn normalise_multi_word() {
        assert_eq!(normalise_ou_name("Dev Frontend"), "dev-frontend");
    }

    #[test]
    fn normalise_extra_spaces() {
        assert_eq!(normalise_ou_name("  SI  Team  "), "si-team");
    }

    #[test]
    fn normalise_already_lowercase() {
        assert_eq!(normalise_ou_name("dev"), "dev");
    }
}
