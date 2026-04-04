//! DirectoryEntry builder — constructs AD objects from PostgreSQL tables.
//!
//! This module bridges the gap between the relational database and the
//! LDAP protocol by building [`DirectoryEntry`] objects from existing tables.
//!
//! # Examples
//!
//! ```rust,no_run
//! use signapps_ad_core::builder::uuid_to_rid;
//! use uuid::Uuid;
//!
//! let uuid = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
//! let rid = uuid_to_rid(uuid);
//! assert!(rid >= 1000);
//! ```

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dn::DistinguishedName;
use crate::entry::{build_dn_from_path, resolve_node_path, DirectoryEntry, LifecycleState};
use crate::schema::syntax::AttributeValue;
use crate::sid::SecurityIdentifier;
use crate::uac::UserAccountControl;

// ── Row types ─────────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct UserRow {
    #[allow(dead_code)]
    id: Uuid,
    username: String,
    email: Option<String>,
    #[allow(dead_code)]
    role: i16,
    department: Option<String>,
    job_title: Option<String>,
    phone: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    first_name: Option<String>,
    last_name: Option<String>,
    lifecycle_state: Option<String>,
    #[allow(dead_code)]
    attributes: Option<serde_json::Value>,
}

#[derive(sqlx::FromRow)]
struct NodeRow {
    #[allow(dead_code)]
    id: Uuid,
    name: String,
    node_type: String,
    description: Option<String>,
    #[allow(dead_code)]
    is_active: bool,
    lifecycle_state: Option<String>,
    #[allow(dead_code)]
    attributes: serde_json::Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(sqlx::FromRow)]
struct GroupRow {
    #[allow(dead_code)]
    id: Uuid,
    name: String,
    description: Option<String>,
    #[allow(dead_code)]
    group_type: String,
    #[allow(dead_code)]
    is_active: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

// ── Public builders ───────────────────────────────────────────────────────────

/// Build a [`DirectoryEntry`] for a user from `identity.users` + `core.persons`.
///
/// Joins the two tables on `persons.user_id = users.id` and maps the result
/// to a full LDAP `user` object with standard AD attributes.
///
/// # Errors
///
/// Returns [`signapps_common::Error::Database`] on SQL errors.
/// Returns [`signapps_common::Error::NotFound`] when `user_id` does not exist.
///
/// # Panics
///
/// Never panics.
#[tracing::instrument(skip(pool, domain_sid), fields(user_id = %user_id))]
pub async fn build_user_entry(
    pool: &PgPool,
    user_id: Uuid,
    domain: &str,
    domain_sid: &SecurityIdentifier,
) -> signapps_common::Result<DirectoryEntry> {
    let row: Option<UserRow> = sqlx::query_as(
        r#"
        SELECT
            u.id, u.username, u.email, u.role, u.department, u.job_title, u.phone,
            u.created_at, u.updated_at,
            p.first_name, p.last_name, p.lifecycle_state, p.attributes
        FROM identity.users u
        LEFT JOIN core.persons p ON p.user_id = u.id
        WHERE u.id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    let row = row.ok_or_else(|| {
        signapps_common::Error::NotFound(format!("User {user_id} not found"))
    })?;

    let display_name = match (&row.first_name, &row.last_name) {
        (Some(f), Some(l)) => format!("{f} {l}"),
        (Some(f), None) => f.clone(),
        (None, Some(l)) => l.clone(),
        _ => row.username.clone(),
    };

    // DN: CN={display_name},OU=Users,DC=example,DC=com
    let dn = DistinguishedName::from_path(&["Users", &display_name], domain);

    let rid = uuid_to_rid(user_id);
    let sid = domain_sid.child(rid);

    let mut attrs: HashMap<String, Vec<AttributeValue>> = HashMap::new();

    set_attr(&mut attrs, "sAMAccountName", &row.username);
    set_attr(&mut attrs, "userPrincipalName", &format!("{}@{domain}", row.username));
    set_attr(&mut attrs, "cn", &display_name);
    set_attr(&mut attrs, "name", &display_name);
    set_attr(&mut attrs, "displayName", &display_name);
    set_attr(&mut attrs, "distinguishedName", &dn.to_string());

    if let Some(f) = &row.first_name {
        set_attr(&mut attrs, "givenName", f);
    }
    if let Some(l) = &row.last_name {
        set_attr(&mut attrs, "sn", l);
    }
    if let Some(email) = &row.email {
        set_attr(&mut attrs, "mail", email);
    }
    if let Some(dept) = &row.department {
        set_attr(&mut attrs, "department", dept);
    }
    if let Some(title) = &row.job_title {
        set_attr(&mut attrs, "title", title);
    }
    if let Some(phone) = &row.phone {
        set_attr(&mut attrs, "telephoneNumber", phone);
    }

    attrs.insert(
        "objectClass".to_string(),
        vec![
            AttributeValue::String("top".to_string()),
            AttributeValue::String("person".to_string()),
            AttributeValue::String("organizationalPerson".to_string()),
            AttributeValue::String("user".to_string()),
        ],
    );

    attrs.insert(
        "objectGUID".to_string(),
        vec![AttributeValue::Binary(user_id.as_bytes().to_vec())],
    );
    attrs.insert(
        "objectSid".to_string(),
        vec![AttributeValue::Binary(sid.to_bytes())],
    );

    set_attr(&mut attrs, "whenCreated", &format_generalized_time(row.created_at));
    set_attr(&mut attrs, "whenChanged", &format_generalized_time(row.updated_at));

    let uac = UserAccountControl::normal_user();
    set_attr(&mut attrs, "userAccountControl", &uac.value().to_string());

    Ok(DirectoryEntry {
        guid: user_id,
        sid: Some(sid),
        dn,
        object_classes: vec![
            "top".into(),
            "person".into(),
            "organizationalPerson".into(),
            "user".into(),
        ],
        attributes: attrs,
        uac,
        lifecycle: LifecycleState::from_db(row.lifecycle_state.as_deref()),
        created: row.created_at,
        modified: row.updated_at,
    })
}

/// Build a [`DirectoryEntry`] for an org node (OU / container).
///
/// Resolves the full DN from the closure table so that deeply nested nodes
/// produce the correct hierarchical DN.
///
/// # Errors
///
/// Returns [`signapps_common::Error::Database`] on SQL errors.
/// Returns [`signapps_common::Error::NotFound`] when `node_id` does not exist.
///
/// # Panics
///
/// Never panics.
#[tracing::instrument(skip(pool), fields(node_id = %node_id))]
pub async fn build_node_entry(
    pool: &PgPool,
    node_id: Uuid,
    domain: &str,
) -> signapps_common::Result<DirectoryEntry> {
    let row: Option<NodeRow> = sqlx::query_as(
        r#"
        SELECT id, name, node_type, description, is_active, lifecycle_state,
               attributes, created_at, updated_at
        FROM workforce_org_nodes WHERE id = $1
        "#,
    )
    .bind(node_id)
    .fetch_optional(pool)
    .await?;

    let row = row.ok_or_else(|| {
        signapps_common::Error::NotFound(format!("Node {node_id} not found"))
    })?;

    // Resolve DN from hierarchy closure table.
    let path = resolve_node_path(pool, node_id).await?;
    let dn = build_dn_from_path(&path, domain);

    let mut attrs: HashMap<String, Vec<AttributeValue>> = HashMap::new();
    set_attr(&mut attrs, "ou", &row.name);
    set_attr(&mut attrs, "name", &row.name);
    set_attr(&mut attrs, "distinguishedName", &dn.to_string());
    if let Some(desc) = &row.description {
        set_attr(&mut attrs, "description", desc);
    }
    attrs.insert(
        "objectGUID".to_string(),
        vec![AttributeValue::Binary(node_id.as_bytes().to_vec())],
    );

    let classes: Vec<&str> = match row.node_type.as_str() {
        "group" | "bu" => vec!["top", "container"],
        _ => vec!["top", "organizationalUnit"],
    };
    attrs.insert(
        "objectClass".to_string(),
        classes.iter().map(|c| AttributeValue::String(c.to_string())).collect(),
    );

    set_attr(&mut attrs, "whenCreated", &format_generalized_time(row.created_at));
    set_attr(&mut attrs, "whenChanged", &format_generalized_time(row.updated_at));

    Ok(DirectoryEntry {
        guid: node_id,
        sid: None,
        dn,
        object_classes: classes.iter().map(|c| c.to_string()).collect(),
        attributes: attrs,
        uac: UserAccountControl(0),
        lifecycle: LifecycleState::from_db(row.lifecycle_state.as_deref()),
        created: row.created_at,
        modified: row.updated_at,
    })
}

/// Build a [`DirectoryEntry`] for a security group.
///
/// Loads group membership from `workforce_org_group_members` and constructs
/// a standard AD `group` object with `member` multi-values.
///
/// # Errors
///
/// Returns [`signapps_common::Error::Database`] on SQL errors.
/// Returns [`signapps_common::Error::NotFound`] when `group_id` does not exist.
///
/// # Panics
///
/// Never panics.
#[tracing::instrument(skip(pool, domain_sid), fields(group_id = %group_id))]
pub async fn build_group_entry(
    pool: &PgPool,
    group_id: Uuid,
    domain: &str,
    domain_sid: &SecurityIdentifier,
) -> signapps_common::Result<DirectoryEntry> {
    let row: Option<GroupRow> = sqlx::query_as(
        "SELECT id, name, description, group_type, is_active, created_at, updated_at \
         FROM workforce_org_groups WHERE id = $1",
    )
    .bind(group_id)
    .fetch_optional(pool)
    .await?;

    let row = row.ok_or_else(|| {
        signapps_common::Error::NotFound(format!("Group {group_id} not found"))
    })?;

    let dn = DistinguishedName::from_path(&["Groups", &row.name], domain);
    let rid = uuid_to_rid(group_id);
    let sid = domain_sid.child(rid);

    let mut attrs: HashMap<String, Vec<AttributeValue>> = HashMap::new();
    set_attr(&mut attrs, "cn", &row.name);
    set_attr(&mut attrs, "name", &row.name);
    set_attr(&mut attrs, "sAMAccountName", &row.name);
    set_attr(&mut attrs, "distinguishedName", &dn.to_string());
    if let Some(desc) = &row.description {
        set_attr(&mut attrs, "description", desc);
    }

    attrs.insert(
        "objectClass".to_string(),
        vec![
            AttributeValue::String("top".to_string()),
            AttributeValue::String("group".to_string()),
        ],
    );
    attrs.insert(
        "objectGUID".to_string(),
        vec![AttributeValue::Binary(group_id.as_bytes().to_vec())],
    );
    attrs.insert(
        "objectSid".to_string(),
        vec![AttributeValue::Binary(sid.to_bytes())],
    );

    // -2147483646 = Global Security Group (ADS_GROUP_TYPE_GLOBAL_GROUP | ADS_GROUP_TYPE_SECURITY_ENABLED)
    set_attr(&mut attrs, "groupType", "-2147483646");

    set_attr(&mut attrs, "whenCreated", &format_generalized_time(row.created_at));
    set_attr(&mut attrs, "whenChanged", &format_generalized_time(row.updated_at));

    // Load members — join via persons to get display names for DNs.
    let dc_suffix = domain.replace('.', ",DC=");
    let members: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT CONCAT('CN=', p.first_name, ' ', p.last_name, ',CN=Users,DC=', $2)
        FROM workforce_org_group_members gm
        JOIN core.persons p ON p.id = gm.member_id AND gm.member_type = 'person'
        WHERE gm.group_id = $1
        "#,
    )
    .bind(group_id)
    .bind(&dc_suffix)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    if !members.is_empty() {
        attrs.insert(
            "member".to_string(),
            members.iter().map(|(dn,)| AttributeValue::String(dn.clone())).collect(),
        );
    }

    Ok(DirectoryEntry {
        guid: group_id,
        sid: Some(sid),
        dn,
        object_classes: vec!["top".into(), "group".into()],
        attributes: attrs,
        uac: UserAccountControl(0),
        lifecycle: LifecycleState::Live,
        created: row.created_at,
        modified: row.updated_at,
    })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Inserts a single string value under `name`, replacing any prior value.
fn set_attr(attrs: &mut HashMap<String, Vec<AttributeValue>>, name: &str, value: &str) {
    attrs.insert(name.to_string(), vec![AttributeValue::String(value.to_string())]);
}

/// Converts a UUID to a deterministic Relative Identifier (RID).
///
/// Uses the first four bytes of the UUID interpreted as a little-endian `u32`,
/// then offsets by 1000 to stay clear of well-known RIDs (0–999 are reserved
/// in Active Directory).
///
/// The result falls in the range `[1000, 1_001_999]`.
///
/// # Examples
///
/// ```rust
/// use signapps_ad_core::builder::uuid_to_rid;
/// use uuid::Uuid;
///
/// let uuid = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
/// let rid1 = uuid_to_rid(uuid);
/// let rid2 = uuid_to_rid(uuid);
/// assert_eq!(rid1, rid2);   // deterministic
/// assert!(rid1 >= 1000);
/// ```
///
/// # Panics
///
/// Never panics.
pub fn uuid_to_rid(uuid: Uuid) -> u32 {
    let bytes = uuid.as_bytes();
    let raw = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    1000 + (raw % 1_000_000)
}

/// Formats a [`DateTime<Utc>`] as an AD Generalized Time string (`YYYYMMDDHHMMSS.0Z`).
///
/// # Examples
///
/// ```rust
/// use signapps_ad_core::builder::format_generalized_time;
/// use chrono::{TimeZone, Utc};
///
/// let dt = Utc.with_ymd_and_hms(2026, 4, 5, 14, 30, 0).unwrap();
/// assert_eq!(format_generalized_time(dt), "20260405143000.0Z");
/// ```
///
/// # Panics
///
/// Never panics.
pub fn format_generalized_time(dt: DateTime<Utc>) -> String {
    dt.format("%Y%m%d%H%M%S.0Z").to_string()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uuid_to_rid_deterministic() {
        let uuid = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let rid1 = uuid_to_rid(uuid);
        let rid2 = uuid_to_rid(uuid);
        assert_eq!(rid1, rid2);
        assert!(rid1 >= 1000);
    }

    #[test]
    fn uuid_to_rid_different_uuids() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let rid_a = uuid_to_rid(a);
        let rid_b = uuid_to_rid(b);
        assert!(rid_a >= 1000);
        assert!(rid_b >= 1000);
    }

    #[test]
    fn format_generalized_time_format() {
        use chrono::TimeZone as _;
        let dt = Utc.with_ymd_and_hms(2026, 4, 5, 14, 30, 0).unwrap();
        let result = format_generalized_time(dt);
        assert_eq!(result, "20260405143000.0Z");
    }

    #[test]
    fn set_attr_helper() {
        let mut attrs = HashMap::new();
        set_attr(&mut attrs, "cn", "John");
        assert_eq!(attrs["cn"], vec![AttributeValue::String("John".to_string())]);
    }

    #[test]
    fn user_dn_format() {
        let dn = DistinguishedName::from_path(&["Users", "John Doe"], "example.com");
        assert_eq!(dn.to_string(), "CN=John Doe,OU=Users,DC=example,DC=com");
    }

    #[test]
    fn group_dn_format() {
        let dn = DistinguishedName::from_path(&["Groups", "Domain Admins"], "example.com");
        assert_eq!(dn.to_string(), "CN=Domain Admins,OU=Groups,DC=example,DC=com");
    }
}
