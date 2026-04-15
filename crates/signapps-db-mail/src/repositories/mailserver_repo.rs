//! Mailserver repositories for domain, account, mailbox, and message CRUD.
//!
//! All queries target the `mailserver.*` schema. UID allocation for IMAP
//! uses `UPDATE ... RETURNING` to atomically increment `uid_next`.

use crate::models::mailserver::*;
use signapps_common::Result;
use signapps_db_shared::pool::DatabasePool;
use uuid::Uuid;

// ============================================================================
// Domain Repository
// ============================================================================

/// Repository for `mailserver.domains` CRUD operations.
///
/// # Errors
///
/// All methods propagate `sqlx::Error` wrapped in `signapps_common::Error`.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
pub struct DomainRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> DomainRepository<'a> {
    /// Create a new repository instance.
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Create a new mail domain.
    pub async fn create(&self, input: CreateMailDomain) -> Result<MailDomain> {
        let domain = sqlx::query_as::<_, MailDomain>(
            r#"
            INSERT INTO mailserver.domains (name, tenant_id, max_accounts)
            VALUES ($1, $2, COALESCE($3, 0))
            RETURNING *
            "#,
        )
        .bind(&input.name)
        .bind(input.tenant_id)
        .bind(input.max_accounts)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(domain)
    }

    /// Find a domain by ID.
    pub async fn get(&self, id: Uuid) -> Result<Option<MailDomain>> {
        let domain =
            sqlx::query_as::<_, MailDomain>("SELECT * FROM mailserver.domains WHERE id = $1")
                .bind(id)
                .fetch_optional(self.pool.inner())
                .await?;

        Ok(domain)
    }

    /// List all domains belonging to a tenant.
    pub async fn list_by_tenant(&self, tenant_id: Uuid) -> Result<Vec<MailDomain>> {
        let domains = sqlx::query_as::<_, MailDomain>(
            "SELECT * FROM mailserver.domains WHERE tenant_id = $1 ORDER BY name",
        )
        .bind(tenant_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(domains)
    }

    /// Update a domain.
    pub async fn update(&self, id: Uuid, input: UpdateMailDomain) -> Result<MailDomain> {
        let domain = sqlx::query_as::<_, MailDomain>(
            r#"
            UPDATE mailserver.domains
            SET
                dkim_private_key = COALESCE($2, dkim_private_key),
                dkim_selector = COALESCE($3, dkim_selector),
                dkim_algorithm = COALESCE($4, dkim_algorithm),
                spf_record = COALESCE($5, spf_record),
                dmarc_policy = COALESCE($6, dmarc_policy),
                catch_all_address = COALESCE($7, catch_all_address),
                max_accounts = COALESCE($8, max_accounts),
                is_verified = COALESCE($9, is_verified),
                is_active = COALESCE($10, is_active),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.dkim_private_key)
        .bind(&input.dkim_selector)
        .bind(&input.dkim_algorithm)
        .bind(&input.spf_record)
        .bind(&input.dmarc_policy)
        .bind(&input.catch_all_address)
        .bind(input.max_accounts)
        .bind(input.is_verified)
        .bind(input.is_active)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(domain)
    }

    /// Delete a domain and cascade to all accounts, mailboxes, messages.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM mailserver.domains WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}

// ============================================================================
// Account Repository
// ============================================================================

/// Repository for `mailserver.accounts` CRUD operations.
///
/// # Errors
///
/// All methods propagate `sqlx::Error` wrapped in `signapps_common::Error`.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
pub struct AccountRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> AccountRepository<'a> {
    /// Create a new repository instance.
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Create a new mail account.
    pub async fn create(&self, input: CreateMailAccount) -> Result<MailAccount> {
        let account = sqlx::query_as::<_, MailAccount>(
            r#"
            INSERT INTO mailserver.accounts
                (domain_id, user_id, address, display_name, password_hash, quota_bytes)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6, 5368709120))
            RETURNING *
            "#,
        )
        .bind(input.domain_id)
        .bind(input.user_id)
        .bind(&input.address)
        .bind(&input.display_name)
        .bind(&input.password_hash)
        .bind(input.quota_bytes)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(account)
    }

    /// Find an account by ID.
    pub async fn get(&self, id: Uuid) -> Result<Option<MailAccount>> {
        let account =
            sqlx::query_as::<_, MailAccount>("SELECT * FROM mailserver.accounts WHERE id = $1")
                .bind(id)
                .fetch_optional(self.pool.inner())
                .await?;

        Ok(account)
    }

    /// Find an account by email address.
    pub async fn get_by_address(&self, address: &str) -> Result<Option<MailAccount>> {
        let account = sqlx::query_as::<_, MailAccount>(
            "SELECT * FROM mailserver.accounts WHERE address = $1",
        )
        .bind(address)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(account)
    }

    /// List all accounts for a domain.
    pub async fn list_by_domain(&self, domain_id: Uuid) -> Result<Vec<MailAccount>> {
        let accounts = sqlx::query_as::<_, MailAccount>(
            "SELECT * FROM mailserver.accounts WHERE domain_id = $1 ORDER BY address",
        )
        .bind(domain_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(accounts)
    }

    /// Delete an account and cascade to mailboxes, messages, etc.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM mailserver.accounts WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}

// ============================================================================
// Mailbox Repository
// ============================================================================

/// Repository for `mailserver.mailboxes` CRUD and IMAP operations.
///
/// # Errors
///
/// All methods propagate `sqlx::Error` wrapped in `signapps_common::Error`.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
pub struct MailboxRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> MailboxRepository<'a> {
    /// Create a new repository instance.
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Create a new mailbox with a random UIDVALIDITY.
    pub async fn create(&self, input: CreateMailbox) -> Result<Mailbox> {
        let mailbox = sqlx::query_as::<_, Mailbox>(
            r#"
            INSERT INTO mailserver.mailboxes
                (account_id, name, special_use, uid_validity, parent_id, sort_order)
            VALUES ($1, $2, $3, (EXTRACT(EPOCH FROM NOW())::INT), $4, COALESCE($5, 0))
            RETURNING *
            "#,
        )
        .bind(input.account_id)
        .bind(&input.name)
        .bind(&input.special_use)
        .bind(input.parent_id)
        .bind(input.sort_order)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(mailbox)
    }

    /// Find a mailbox by ID.
    pub async fn get(&self, id: Uuid) -> Result<Option<Mailbox>> {
        let mailbox =
            sqlx::query_as::<_, Mailbox>("SELECT * FROM mailserver.mailboxes WHERE id = $1")
                .bind(id)
                .fetch_optional(self.pool.inner())
                .await?;

        Ok(mailbox)
    }

    /// List all mailboxes for an account.
    pub async fn list_by_account(&self, account_id: Uuid) -> Result<Vec<Mailbox>> {
        let mailboxes = sqlx::query_as::<_, Mailbox>(
            "SELECT * FROM mailserver.mailboxes WHERE account_id = $1 ORDER BY sort_order, name",
        )
        .bind(account_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(mailboxes)
    }

    /// Create the standard IMAP default mailboxes for a new account.
    ///
    /// Creates: INBOX, Sent, Drafts, Trash, Junk, Archive.
    pub async fn create_default_mailboxes(&self, account_id: Uuid) -> Result<Vec<Mailbox>> {
        let defaults = [
            ("INBOX", "\\Inbox", 0),
            ("Sent", "\\Sent", 1),
            ("Drafts", "\\Drafts", 2),
            ("Trash", "\\Trash", 3),
            ("Junk", "\\Junk", 4),
            ("Archive", "\\Archive", 5),
        ];

        let mut mailboxes = Vec::with_capacity(defaults.len());
        for (name, special_use, sort_order) in defaults {
            let mb = self
                .create(CreateMailbox {
                    account_id,
                    name: name.to_string(),
                    special_use: Some(special_use.to_string()),
                    parent_id: None,
                    sort_order: Some(sort_order),
                })
                .await?;
            mailboxes.push(mb);
        }

        Ok(mailboxes)
    }
}

// ============================================================================
// Message Repository
// ============================================================================

/// Repository for `mailserver.message_contents`, `messages`, and `message_mailboxes`.
///
/// Handles content deduplication by SHA-256 hash and atomic UID allocation.
///
/// # Errors
///
/// All methods propagate `sqlx::Error` wrapped in `signapps_common::Error`.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
pub struct MessageRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> MessageRepository<'a> {
    /// Create a new repository instance.
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Insert message content with dedup by SHA-256 hash.
    ///
    /// If content with the same hash already exists, returns the existing record
    /// without inserting a duplicate (ON CONFLICT DO NOTHING + fallback SELECT).
    pub async fn insert_content(&self, input: InsertMessageContent) -> Result<MessageContent> {
        // Try insert; if hash collision, fetch existing.
        let content = sqlx::query_as::<_, MessageContent>(
            r#"
            WITH ins AS (
                INSERT INTO mailserver.message_contents
                    (content_hash, raw_size, storage_key, headers_json,
                     body_text, body_html, body_structure)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (content_hash) DO NOTHING
                RETURNING id, content_hash, raw_size, storage_key, headers_json,
                          body_text, body_html, body_structure, created_at
            )
            SELECT * FROM ins
            UNION ALL
            SELECT id, content_hash, raw_size, storage_key, headers_json,
                   body_text, body_html, body_structure, created_at
            FROM mailserver.message_contents
            WHERE content_hash = $1
            LIMIT 1
            "#,
        )
        .bind(&input.content_hash)
        .bind(input.raw_size)
        .bind(&input.storage_key)
        .bind(&input.headers_json)
        .bind(&input.body_text)
        .bind(&input.body_html)
        .bind(&input.body_structure)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(content)
    }

    /// Insert a new message record.
    pub async fn insert_message(&self, input: InsertMailMessage) -> Result<MailMessage> {
        let message = sqlx::query_as::<_, MailMessage>(
            r#"
            INSERT INTO mailserver.messages
                (account_id, content_id, message_id_header, in_reply_to, thread_id,
                 sender, sender_name, recipients, subject, date,
                 has_attachments, spam_score, spam_status, received_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
            RETURNING *
            "#,
        )
        .bind(input.account_id)
        .bind(input.content_id)
        .bind(&input.message_id_header)
        .bind(&input.in_reply_to)
        .bind(input.thread_id)
        .bind(&input.sender)
        .bind(&input.sender_name)
        .bind(&input.recipients)
        .bind(&input.subject)
        .bind(input.date)
        .bind(input.has_attachments)
        .bind(input.spam_score)
        .bind(&input.spam_status)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(message)
    }

    /// Place a message into a mailbox, atomically allocating the next UID.
    ///
    /// Increments `mailboxes.uid_next` and `highest_modseq` atomically,
    /// then inserts the `message_mailboxes` row with the allocated UID.
    pub async fn insert_message_mailbox(
        &self,
        input: InsertMessageMailbox,
    ) -> Result<MessageMailbox> {
        let mm = sqlx::query_as::<_, MessageMailbox>(
            r#"
            WITH alloc AS (
                UPDATE mailserver.mailboxes
                SET uid_next = uid_next + 1,
                    highest_modseq = highest_modseq + 1,
                    total_messages = total_messages + 1,
                    unread_messages = CASE
                        WHEN ($3::INT & 1) = 0 THEN unread_messages + 1
                        ELSE unread_messages
                    END
                WHERE id = $2
                RETURNING uid_next - 1 AS allocated_uid, highest_modseq AS allocated_modseq
            )
            INSERT INTO mailserver.message_mailboxes (message_id, mailbox_id, uid, modseq, flags)
            SELECT $1, $2, alloc.allocated_uid, alloc.allocated_modseq, COALESCE($3, 0)
            FROM alloc
            RETURNING *
            "#,
        )
        .bind(input.message_id)
        .bind(input.mailbox_id)
        .bind(input.flags.unwrap_or(0))
        .fetch_one(self.pool.inner())
        .await?;

        Ok(mm)
    }

    /// List messages in a mailbox ordered by UID (ascending).
    ///
    /// Returns joined message + mailbox metadata.
    pub async fn list_by_mailbox(&self, mailbox_id: Uuid) -> Result<Vec<MailMessage>> {
        let messages = sqlx::query_as::<_, MailMessage>(
            r#"
            SELECT m.*
            FROM mailserver.messages m
            INNER JOIN mailserver.message_mailboxes mm ON mm.message_id = m.id
            WHERE mm.mailbox_id = $1
            ORDER BY mm.uid ASC
            "#,
        )
        .bind(mailbox_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(messages)
    }
}
