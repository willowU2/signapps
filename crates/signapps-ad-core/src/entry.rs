//! DirectoryEntry — the central Active Directory object.
//!
//! A [`DirectoryEntry`] is the runtime representation of a single LDAP object
//! (user, group, computer, OU, …).  It carries typed attributes, lifecycle
//! state, and a computed [`DistinguishedName`] resolved from the underlying
//! PostgreSQL org-structure tree.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dn::DistinguishedName;
use crate::schema::syntax::AttributeValue;
use crate::sid::SecurityIdentifier;
use crate::uac::UserAccountControl;

// ── LifecycleState ────────────────────────────────────────────────────────────

/// Tracks the Active Directory recycle-bin lifecycle of an entry.
///
/// Mirrors the three states defined in MS-ADTS §3.1.1.8.2:
/// * **Live** — normal, visible object
/// * **Recycled** — soft-deleted, stripped to tombstone attributes
/// * **Tombstone** — fully expired, awaiting garbage collection
///
/// # Examples
///
/// ```rust
/// use signapps_ad_core::entry::LifecycleState;
///
/// assert_eq!(LifecycleState::from_db(None), LifecycleState::Live);
/// assert_eq!(LifecycleState::from_db(Some("recycled")), LifecycleState::Recycled);
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LifecycleState {
    /// Object is live and fully visible in directory queries.
    Live,
    /// Object has been soft-deleted (recycle bin).
    Recycled,
    /// Object is a tombstone awaiting garbage collection.
    Tombstone,
}

impl LifecycleState {
    /// Converts an optional database string column to a [`LifecycleState`].
    ///
    /// `None` or `"live"` maps to [`Live`](Self::Live), `"recycled"` to
    /// [`Recycled`](Self::Recycled), and `"tombstone"` to
    /// [`Tombstone`](Self::Tombstone).  Any other value falls back to `Live`.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use signapps_ad_core::entry::LifecycleState;
    ///
    /// assert_eq!(LifecycleState::from_db(None), LifecycleState::Live);
    /// assert_eq!(LifecycleState::from_db(Some("live")), LifecycleState::Live);
    /// assert_eq!(LifecycleState::from_db(Some("recycled")), LifecycleState::Recycled);
    /// assert_eq!(LifecycleState::from_db(Some("tombstone")), LifecycleState::Tombstone);
    /// ```
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn from_db(val: Option<&str>) -> Self {
        match val {
            None | Some("live") => Self::Live,
            Some("recycled") => Self::Recycled,
            Some("tombstone") => Self::Tombstone,
            Some(_) => Self::Live,
        }
    }
}

// ── DirectoryEntry ────────────────────────────────────────────────────────────

/// A single Active Directory / LDAP object backed by the PostgreSQL org tree.
///
/// Attributes are stored as a multi-valued map keyed by lowercase attribute
/// name.  The `dn` field is computed at load time from the org-structure
/// closure table; it is not persisted directly.
///
/// # Examples
///
/// ```rust
/// use chrono::Utc;
/// use std::collections::HashMap;
/// use uuid::Uuid;
/// use signapps_ad_core::dn::DistinguishedName;
/// use signapps_ad_core::entry::{DirectoryEntry, LifecycleState};
/// use signapps_ad_core::uac::UserAccountControl;
///
/// let mut entry = DirectoryEntry {
///     guid: Uuid::new_v4(),
///     sid: None,
///     dn: DistinguishedName::parse("CN=Alice,DC=example,DC=com").unwrap(),
///     object_classes: vec!["top".into(), "person".into(), "user".into()],
///     attributes: HashMap::new(),
///     uac: UserAccountControl::normal_user(),
///     lifecycle: LifecycleState::Live,
///     created: Utc::now(),
///     modified: Utc::now(),
/// };
///
/// entry.set_str("sAMAccountName", "alice");
/// assert_eq!(entry.get_str("sAMAccountName"), Some("alice"));
/// ```
#[derive(Debug, Clone, Serialize)]
pub struct DirectoryEntry {
    /// Globally unique identifier (`objectGUID`).
    pub guid: Uuid,
    /// Optional Windows Security Identifier (`objectSid`).
    pub sid: Option<SecurityIdentifier>,
    /// Computed Distinguished Name, resolved from the org-structure closure table.
    pub dn: DistinguishedName,
    /// LDAP `objectClass` values, e.g. `["top", "person", "user"]`.
    pub object_classes: Vec<String>,
    /// All other LDAP attributes, keyed by attribute name (case-preserved).
    pub attributes: HashMap<String, Vec<AttributeValue>>,
    /// Parsed `userAccountControl` bitmask.
    pub uac: UserAccountControl,
    /// Recycle-bin lifecycle state.
    pub lifecycle: LifecycleState,
    /// Creation timestamp (`whenCreated`).
    pub created: DateTime<Utc>,
    /// Last modification timestamp (`whenChanged`).
    pub modified: DateTime<Utc>,
}

impl DirectoryEntry {
    /// Returns the first value of `name` as a string slice, or `None`.
    ///
    /// Looks up `name` in the attribute map and returns the inner string of
    /// the first [`AttributeValue::String`] variant found.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # use chrono::Utc;
    /// # use std::collections::HashMap;
    /// # use uuid::Uuid;
    /// # use signapps_ad_core::dn::DistinguishedName;
    /// # use signapps_ad_core::entry::{DirectoryEntry, LifecycleState};
    /// # use signapps_ad_core::uac::UserAccountControl;
    /// let mut entry = DirectoryEntry {
    ///     guid: Uuid::new_v4(), sid: None,
    ///     dn: DistinguishedName::parse("CN=Bob,DC=example,DC=com").unwrap(),
    ///     object_classes: vec![], attributes: HashMap::new(),
    ///     uac: UserAccountControl::normal_user(), lifecycle: LifecycleState::Live,
    ///     created: Utc::now(), modified: Utc::now(),
    /// };
    /// entry.set_str("cn", "Bob");
    /// assert_eq!(entry.get_str("cn"), Some("Bob"));
    /// assert_eq!(entry.get_str("nonexistent"), None);
    /// ```
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn get_str(&self, name: &str) -> Option<&str> {
        self.attributes.get(name)?.first()?.as_str()
    }

    /// Returns all values for attribute `name`, or an empty slice.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # use chrono::Utc;
    /// # use std::collections::HashMap;
    /// # use uuid::Uuid;
    /// # use signapps_ad_core::dn::DistinguishedName;
    /// # use signapps_ad_core::entry::{DirectoryEntry, LifecycleState};
    /// # use signapps_ad_core::schema::syntax::AttributeValue;
    /// # use signapps_ad_core::uac::UserAccountControl;
    /// let mut entry = DirectoryEntry {
    ///     guid: Uuid::new_v4(), sid: None,
    ///     dn: DistinguishedName::parse("CN=Bob,DC=example,DC=com").unwrap(),
    ///     object_classes: vec![], attributes: std::collections::HashMap::new(),
    ///     uac: UserAccountControl::normal_user(), lifecycle: LifecycleState::Live,
    ///     created: Utc::now(), modified: Utc::now(),
    /// };
    /// entry.add_value("member", AttributeValue::String("CN=Alice,DC=example,DC=com".into()));
    /// assert_eq!(entry.get_all("member").len(), 1);
    /// assert_eq!(entry.get_all("missing").len(), 0);
    /// ```
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn get_all(&self, name: &str) -> &[AttributeValue] {
        self.attributes.get(name).map(Vec::as_slice).unwrap_or(&[])
    }

    /// Replaces the entire value list for `name` with a single string value.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # use chrono::Utc;
    /// # use std::collections::HashMap;
    /// # use uuid::Uuid;
    /// # use signapps_ad_core::dn::DistinguishedName;
    /// # use signapps_ad_core::entry::{DirectoryEntry, LifecycleState};
    /// # use signapps_ad_core::uac::UserAccountControl;
    /// let mut entry = DirectoryEntry {
    ///     guid: Uuid::new_v4(), sid: None,
    ///     dn: DistinguishedName::parse("CN=Bob,DC=example,DC=com").unwrap(),
    ///     object_classes: vec![], attributes: HashMap::new(),
    ///     uac: UserAccountControl::normal_user(), lifecycle: LifecycleState::Live,
    ///     created: Utc::now(), modified: Utc::now(),
    /// };
    /// entry.set_str("sAMAccountName", "bob");
    /// entry.set_str("sAMAccountName", "robert");
    /// assert_eq!(entry.get_str("sAMAccountName"), Some("robert"));
    /// ```
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn set_str(&mut self, name: &str, value: &str) {
        self.attributes
            .insert(name.to_owned(), vec![AttributeValue::String(value.to_owned())]);
    }

    /// Appends `value` to the list of values for attribute `name`.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # use chrono::Utc;
    /// # use std::collections::HashMap;
    /// # use uuid::Uuid;
    /// # use signapps_ad_core::dn::DistinguishedName;
    /// # use signapps_ad_core::entry::{DirectoryEntry, LifecycleState};
    /// # use signapps_ad_core::schema::syntax::AttributeValue;
    /// # use signapps_ad_core::uac::UserAccountControl;
    /// let mut entry = DirectoryEntry {
    ///     guid: Uuid::new_v4(), sid: None,
    ///     dn: DistinguishedName::parse("CN=Bob,DC=example,DC=com").unwrap(),
    ///     object_classes: vec![], attributes: HashMap::new(),
    ///     uac: UserAccountControl::normal_user(), lifecycle: LifecycleState::Live,
    ///     created: Utc::now(), modified: Utc::now(),
    /// };
    /// entry.add_value("proxyAddresses", AttributeValue::String("smtp:bob@example.com".into()));
    /// entry.add_value("proxyAddresses", AttributeValue::String("SMTP:bob@example.com".into()));
    /// assert_eq!(entry.get_all("proxyAddresses").len(), 2);
    /// ```
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn add_value(&mut self, name: &str, value: AttributeValue) {
        self.attributes.entry(name.to_owned()).or_default().push(value);
    }

    /// Returns `true` if `class_name` appears in `object_classes` (case-insensitive).
    ///
    /// # Examples
    ///
    /// ```rust
    /// # use chrono::Utc;
    /// # use std::collections::HashMap;
    /// # use uuid::Uuid;
    /// # use signapps_ad_core::dn::DistinguishedName;
    /// # use signapps_ad_core::entry::{DirectoryEntry, LifecycleState};
    /// # use signapps_ad_core::uac::UserAccountControl;
    /// let entry = DirectoryEntry {
    ///     guid: Uuid::new_v4(), sid: None,
    ///     dn: DistinguishedName::parse("CN=Bob,DC=example,DC=com").unwrap(),
    ///     object_classes: vec!["top".into(), "person".into(), "user".into()],
    ///     attributes: HashMap::new(),
    ///     uac: UserAccountControl::normal_user(), lifecycle: LifecycleState::Live,
    ///     created: Utc::now(), modified: Utc::now(),
    /// };
    /// assert!(entry.has_class("user"));
    /// assert!(entry.has_class("User"));
    /// assert!(!entry.has_class("group"));
    /// ```
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn has_class(&self, class_name: &str) -> bool {
        self.object_classes
            .iter()
            .any(|c| c.eq_ignore_ascii_case(class_name))
    }
}

// ── DB-backed DN resolution ───────────────────────────────────────────────────

/// Resolves the ancestor path of an org-structure node from the closure table.
///
/// Returns a `Vec<(name, node_type)>` ordered from root (outermost) to the
/// target node itself (depth = 0 is the target, so ORDER BY depth DESC puts
/// the root first).
///
/// # Errors
///
/// Propagates any [`sqlx`] database error wrapped in [`signapps_common::Error`].
///
/// # Panics
///
/// Never panics.
pub async fn resolve_node_path(
    pool: &PgPool,
    node_id: Uuid,
) -> signapps_common::Result<Vec<(String, String)>> {
    let rows = sqlx::query_as::<_, (String, String)>(
        r#"
        SELECT ancestor.name, ancestor.node_type
        FROM   workforce_org_closure  c
        JOIN   workforce_org_nodes    ancestor ON ancestor.id = c.ancestor_id
        WHERE  c.descendant_id = $1
        ORDER  BY c.depth DESC
        "#,
    )
    .bind(node_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Constructs a [`DistinguishedName`] from an org-structure path and a domain.
///
/// `path` is a slice of `(name, node_type)` pairs ordered **root-first**
/// (as returned by [`resolve_node_path`]).  The last element maps to `CN`,
/// all preceding elements map to `OU`s.
///
/// An empty `path` returns a DC-only root DN for `domain`.
///
/// # Examples
///
/// ```rust
/// use signapps_ad_core::entry::build_dn_from_path;
///
/// let path = vec![
///     ("Engineering".to_string(), "department".to_string()),
///     ("Backend".to_string(),     "team".to_string()),
///     ("John Doe".to_string(),    "position".to_string()),
/// ];
/// let dn = build_dn_from_path(&path, "example.com");
/// assert_eq!(dn.to_string(), "CN=John Doe,OU=Backend,OU=Engineering,DC=example,DC=com");
/// ```
///
/// # Panics
///
/// Never panics.
pub fn build_dn_from_path(path: &[(String, String)], domain: &str) -> DistinguishedName {
    if path.is_empty() {
        // Domain-root DN: only DC components.
        let mut builder = DistinguishedName::build();
        for dc in domain.split('.') {
            if !dc.is_empty() {
                builder = builder.dc(dc);
            }
        }
        return builder.finish();
    }

    // Collect just the names (ignoring node_type for DN construction).
    let names: Vec<&str> = path.iter().map(|(name, _)| name.as_str()).collect();
    DistinguishedName::from_path(&names, domain)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use chrono::Utc;
    use uuid::Uuid;

    use super::*;
    use crate::dn::DistinguishedName;
    use crate::schema::syntax::AttributeValue;
    use crate::uac::UserAccountControl;

    fn make_entry(object_classes: Vec<String>) -> DirectoryEntry {
        DirectoryEntry {
            guid: Uuid::new_v4(),
            sid: None,
            dn: DistinguishedName::parse("CN=Test,DC=example,DC=com").unwrap(),
            object_classes,
            attributes: HashMap::new(),
            uac: UserAccountControl::normal_user(),
            lifecycle: LifecycleState::Live,
            created: Utc::now(),
            modified: Utc::now(),
        }
    }

    #[test]
    fn entry_get_set_attributes() {
        let mut entry = make_entry(vec![]);
        entry.set_str("sAMAccountName", "testuser");
        assert_eq!(entry.get_str("sAMAccountName"), Some("testuser"));
        assert_eq!(entry.get_str("nonexistent"), None);
    }

    #[test]
    fn entry_multi_valued() {
        let mut entry = make_entry(vec![]);
        entry.add_value("member", AttributeValue::String("CN=Alice,DC=example,DC=com".into()));
        entry.add_value("member", AttributeValue::String("CN=Bob,DC=example,DC=com".into()));
        assert_eq!(entry.get_all("member").len(), 2);
    }

    #[test]
    fn entry_has_class() {
        let entry = make_entry(vec!["top".into(), "person".into(), "user".into()]);
        assert!(entry.has_class("user"), "exact match");
        assert!(entry.has_class("User"), "case-insensitive match");
        assert!(!entry.has_class("group"), "not present");
    }

    #[test]
    fn lifecycle_from_db() {
        assert_eq!(LifecycleState::from_db(None), LifecycleState::Live);
        assert_eq!(LifecycleState::from_db(Some("live")), LifecycleState::Live);
        assert_eq!(LifecycleState::from_db(Some("recycled")), LifecycleState::Recycled);
        assert_eq!(LifecycleState::from_db(Some("tombstone")), LifecycleState::Tombstone);
    }

    #[test]
    fn build_dn_from_org_path() {
        let path = vec![
            ("Engineering".to_string(), "department".to_string()),
            ("Backend".to_string(), "team".to_string()),
            ("John Doe".to_string(), "position".to_string()),
        ];
        let dn = build_dn_from_path(&path, "example.com");
        assert_eq!(dn.to_string(), "CN=John Doe,OU=Backend,OU=Engineering,DC=example,DC=com");
    }
}
