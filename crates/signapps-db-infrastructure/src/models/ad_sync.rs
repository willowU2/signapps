// crates/signapps-db/src/models/ad_sync.rs
//! Models for org→AD synchronization objects.
//!
//! These structs map 1-to-1 to the PostgreSQL tables created in migrations
//! 224–230. All models derive [`sqlx::FromRow`] for direct query mapping.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ── OUs ───────────────────────────────────────────────────────────────────────

/// An AD Organizational Unit synced from an org node.
///
/// Maps to the `ad_ous` table (migration 224).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdOu {
    /// Primary key (UUID v4).
    pub id: Uuid,
    /// The AD domain this OU belongs to.
    pub domain_id: Uuid,
    /// Source org node that this OU represents.
    pub node_id: Uuid,
    /// Full LDAP distinguished name, e.g. `OU=HR,DC=corp,DC=local`.
    pub distinguished_name: String,
    /// Parent OU, `None` for top-level OUs under the domain.
    pub parent_ou_id: Option<Uuid>,
    /// AD objectGUID (set after first successful sync).
    pub guid: Option<String>,
    /// Whether a distribution list should be created for this OU.
    pub mail_distribution_enabled: bool,
    /// Synchronisation state: `pending`, `synced`, `error`, or `orphan`.
    pub sync_status: String,
    /// Timestamp of last successful sync to AD.
    pub last_synced_at: Option<DateTime<Utc>>,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
}

// ── User Accounts ─────────────────────────────────────────────────────────────

/// An AD User Account synced from a person assignment.
///
/// Maps to the `ad_user_accounts` table (migration 224).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdUserAccount {
    /// Primary key (UUID v4).
    pub id: Uuid,
    /// The AD domain this account belongs to.
    pub domain_id: Uuid,
    /// Linked person record.
    pub person_id: Uuid,
    /// OU this user is placed in, if known.
    pub ou_id: Option<Uuid>,
    /// Windows-compatible login name (max 20 chars, pre-Windows 2000).
    pub sam_account_name: String,
    /// UPN-format login: `user@domain`.
    pub user_principal_name: String,
    /// Full LDAP distinguished name.
    pub distinguished_name: String,
    /// Display name shown in the Global Address List.
    pub display_name: String,
    /// Job title from the org chart.
    pub title: Option<String>,
    /// Department name from the org chart.
    pub department: Option<String>,
    /// Primary mail address.
    pub mail: Option<String>,
    /// Mail domain used for this account's primary address.
    pub mail_domain_id: Option<Uuid>,
    /// `userAccountControl` bitmask (default 512 = normal, enabled account).
    pub account_flags: i32,
    /// AD objectSid in string format (`S-1-5-...`).
    pub object_sid: Option<String>,
    /// Whether the user must change their password on first login.
    pub password_must_change: bool,
    /// Whether the account is currently enabled.
    pub is_enabled: bool,
    /// Synchronisation state: `pending`, `synced`, `error`, or `disabled`.
    pub sync_status: String,
    /// Timestamp of last successful sync to AD.
    pub last_synced_at: Option<DateTime<Utc>>,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Row last-update timestamp.
    pub updated_at: DateTime<Utc>,
}

// ── Computer Accounts ─────────────────────────────────────────────────────────

/// An AD Computer Account.
///
/// Maps to the `ad_computer_accounts` table (migration 224).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdComputerAccount {
    /// Primary key (UUID v4).
    pub id: Uuid,
    /// The AD domain this account belongs to.
    pub domain_id: Uuid,
    /// Optional link to a hardware/asset record.
    pub hardware_id: Option<Uuid>,
    /// Windows-compatible computer name (with trailing `$` in AD).
    pub sam_account_name: String,
    /// Full LDAP distinguished name.
    pub distinguished_name: String,
    /// DNS hostname of the machine.
    pub dns_hostname: Option<String>,
    /// Operating system name.
    pub os_name: Option<String>,
    /// Operating system version string.
    pub os_version: Option<String>,
    /// AD objectSid in string format.
    pub object_sid: Option<String>,
    /// Whether the computer account is enabled.
    pub is_enabled: bool,
    /// Synchronisation state: `pending`, `synced`, `error`, or `disabled`.
    pub sync_status: String,
    /// Timestamp of last successful sync to AD.
    pub last_synced_at: Option<DateTime<Utc>>,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
}

// ── Security Groups ───────────────────────────────────────────────────────────

/// An AD Security Group backed by an org group, team, or position.
///
/// Maps to the `ad_security_groups` table (migration 225).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdSecurityGroup {
    /// Primary key (UUID v4).
    pub id: Uuid,
    /// The AD domain this group belongs to.
    pub domain_id: Uuid,
    /// Origin type: `org_group`, `team`, or `position`.
    pub source_type: String,
    /// UUID of the source object (org group, team, or position).
    pub source_id: Uuid,
    /// Windows-compatible group name.
    pub sam_account_name: String,
    /// Full LDAP distinguished name.
    pub distinguished_name: String,
    /// Human-readable display name.
    pub display_name: Option<String>,
    /// AD group scope: `domain_local`, `global`, or `universal`.
    pub group_scope: String,
    /// AD group type: `security` or `distribution`.
    pub group_type: String,
    /// AD objectSid in string format.
    pub object_sid: Option<String>,
    /// Synchronisation state: `pending`, `synced`, `error`, or `orphan`.
    pub sync_status: String,
    /// Timestamp of last successful sync to AD.
    pub last_synced_at: Option<DateTime<Utc>>,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// A member of an AD Security Group.
///
/// Maps to the `ad_group_members` table (migration 225).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdGroupMember {
    /// Primary key (UUID v4).
    pub id: Uuid,
    /// The group this record belongs to.
    pub group_id: Uuid,
    /// Member type: `user`, `computer`, or `group`.
    pub member_type: String,
    /// UUID of the member object (user, computer, or nested group).
    pub member_id: Uuid,
    /// Synchronisation state for this membership entry.
    pub sync_status: String,
}

// ── Sync Queue ────────────────────────────────────────────────────────────────

/// An event in the org→AD sync queue.
///
/// Maps to the `ad_sync_queue` table (migration 226).
/// Events are produced by PostgreSQL triggers on `core.org_nodes` and
/// `core.assignments` and consumed by the async sync worker in `signapps-dc`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdSyncEvent {
    /// Primary key (UUID v4).
    pub id: Uuid,
    /// Target domain for this event.
    pub domain_id: Uuid,
    /// Event type, e.g. `ou_create`, `user_provision`, `user_move`.
    pub event_type: String,
    /// Event-specific JSON payload.
    pub payload: serde_json::Value,
    /// Optional target site (for geo-distributed DC selection).
    pub target_site_id: Option<Uuid>,
    /// Optional target DC for this event.
    pub target_dc_id: Option<Uuid>,
    /// Processing priority — lower values are processed first.
    pub priority: i32,
    /// Queue status: `pending`, `processing`, `completed`, `failed`, `retry`, or `dead`.
    pub status: String,
    /// Number of processing attempts made so far.
    pub attempts: i32,
    /// Maximum number of attempts before the event is marked `dead`.
    pub max_attempts: i32,
    /// Earliest timestamp for the next retry (exponential backoff).
    pub next_retry_at: Option<DateTime<Utc>>,
    /// Last error message, populated on failure.
    pub error_message: Option<String>,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Timestamp when the event reached a terminal state.
    pub processed_at: Option<DateTime<Utc>>,
}

// ── DC Sites ─────────────────────────────────────────────────────────────────

/// A Domain Controller site entry.
///
/// Maps to the `ad_dc_sites` table (migration 228).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdDcSite {
    /// Primary key (UUID v4).
    pub id: Uuid,
    /// Domain this DC belongs to.
    pub domain_id: Uuid,
    /// Optional site/location reference.
    pub site_id: Option<Uuid>,
    /// Fully-qualified hostname of the DC.
    pub dc_hostname: String,
    /// Primary IP address of the DC.
    pub dc_ip: String,
    /// DC role: `primary_rwdc`, `rwdc`, or `rodc`.
    pub dc_role: String,
    /// Operational status: `provisioning`, `online`, `degraded`, `offline`, or `decommissioning`.
    pub dc_status: String,
    /// Whether this DC accepts write operations.
    pub is_writable: bool,
    /// Whether this is the primary DC for the domain.
    pub is_primary: bool,
    /// Optional replication partner DC.
    pub replication_partner_id: Option<Uuid>,
    /// When this DC was promoted.
    pub promoted_at: Option<DateTime<Utc>>,
    /// When this DC was demoted.
    pub demoted_at: Option<DateTime<Utc>>,
    /// Last heartbeat from this DC.
    pub last_heartbeat_at: Option<DateTime<Utc>>,
    /// Last successful AD replication timestamp.
    pub last_replication_at: Option<DateTime<Utc>>,
    /// Arbitrary JSON configuration blob.
    pub config: serde_json::Value,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
}

// ── Snapshots ─────────────────────────────────────────────────────────────────

/// An AD snapshot for backup and granular restore.
///
/// Maps to the `ad_snapshots` table (migration 229).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdSnapshot {
    /// Primary key (UUID v4).
    pub id: Uuid,
    /// Domain this snapshot covers.
    pub domain_id: Uuid,
    /// DC that produced the snapshot.
    pub dc_id: Option<Uuid>,
    /// Snapshot type: `full`, `incremental`, `pre_migration`, or `pre_restore`.
    pub snapshot_type: String,
    /// Storage path where the snapshot data is written.
    pub storage_path: String,
    /// JSON manifest describing snapshot contents.
    pub manifest: serde_json::Value,
    /// Names of tables included in this snapshot.
    pub tables_included: Vec<String>,
    /// Compressed size in bytes.
    pub size_bytes: i64,
    /// SHA-256 checksum of the snapshot archive.
    pub checksum_sha256: Option<String>,
    /// Snapshot status: `creating`, `completed`, `restoring`, `expired`, or `failed`.
    pub status: String,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
    /// When this snapshot expires and may be purged.
    pub expires_at: Option<DateTime<Utc>>,
}

// ── Mail ──────────────────────────────────────────────────────────────────────

/// A mail alias for an AD user account.
///
/// Maps to the `ad_mail_aliases` table (migration 230).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdMailAlias {
    /// Primary key (UUID v4).
    pub id: Uuid,
    /// The user account this alias belongs to.
    pub user_account_id: Uuid,
    /// Full mail address, e.g. `j.dupont@corp.local`.
    pub mail_address: String,
    /// Mail domain used for this alias.
    pub domain_id: Uuid,
    /// Whether this is the user's primary (default) mail address.
    pub is_default: bool,
    /// Whether this alias is currently active.
    pub is_active: bool,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// A shared mailbox for an OU or security group (exposed as an IMAP folder).
///
/// Maps to the `ad_shared_mailboxes` table (migration 230).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdSharedMailbox {
    /// Primary key (UUID v4).
    pub id: Uuid,
    /// OU that owns this mailbox (mutually exclusive with `group_id`).
    pub ou_id: Option<Uuid>,
    /// Security group that owns this mailbox (mutually exclusive with `ou_id`).
    pub group_id: Option<Uuid>,
    /// Mail address for this shared mailbox.
    pub mail_address: String,
    /// Mail domain.
    pub domain_id: Uuid,
    /// Human-readable display name.
    pub display_name: String,
    /// JSON configuration (send-as policy, visibility, auto-subscribe, etc.).
    pub config: serde_json::Value,
    /// Whether this mailbox is currently active.
    pub is_active: bool,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// A user's subscription to a shared mailbox.
///
/// Maps to the `ad_shared_mailbox_subscriptions` table (migration 230).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdSharedMailboxSubscription {
    /// Primary key (UUID v4).
    pub id: Uuid,
    /// The shared mailbox this subscription is for.
    pub mailbox_id: Uuid,
    /// The user account subscribed to the mailbox.
    pub user_account_id: Uuid,
    /// IMAP folder path, e.g. `Shared/DRH`.
    pub imap_folder_path: String,
    /// Whether the user can send mail as the shared mailbox address.
    pub can_send_as: bool,
    /// Whether the subscription is currently active.
    pub is_subscribed: bool,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
}

// ── Node Mail Domain ──────────────────────────────────────────────────────────

/// Mail domain mapping for an org node.
///
/// Maps to the `ad_node_mail_domains` table (migration 227).
/// The effective mail domain for a node is resolved by walking the org-node
/// ancestor chain to find the nearest mapping.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdNodeMailDomain {
    /// Org node that has an explicit mail-domain assignment.
    pub node_id: Uuid,
    /// The mail domain assigned to this node.
    pub domain_id: Uuid,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
}

// ── FSMO Roles ────────────────────────────────────────────────────────────────

/// FSMO (Flexible Single Master Operations) role assignment.
///
/// Maps to the `ad_fsmo_roles` table (migration 228).
/// There are five FSMO roles: `schema_master`, `domain_naming`, `rid_master`,
/// `pdc_emulator`, and `infrastructure_master`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdFsmoRole {
    /// Primary key (UUID v4).
    pub id: Uuid,
    /// Domain this FSMO role is scoped to.
    pub domain_id: Uuid,
    /// FSMO role name.
    pub role: String,
    /// DC that currently holds this role.
    pub dc_id: Uuid,
    /// When this role was last transferred to the current DC.
    pub transferred_at: DateTime<Utc>,
}
