//! Built-in objectClass definitions for the AD schema registry.

use serde::{Deserialize, Serialize};

/// Identifies which PostgreSQL table/entity backs an objectClass.
///
/// Protocol servers use this to know which repository to query when
/// resolving LDAP entries for a given class.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PgSource {
    /// Backed by the `users` / `employees` table.
    User,
    /// Backed by the `groups` table.
    Group,
    /// Backed by the `org_nodes` table (departments, divisions, etc.).
    OrgNode,
    /// Backed by the `contacts` table.
    Contact,
    /// Backed by the `computers` table.
    Computer,
    /// Represents the domain root — synthesised, not stored in a single table.
    Domain,
    /// Virtual entry synthesised by the LDAP server (e.g., `top`, `container`).
    Virtual,
}

/// Metadata describing a single LDAP objectClass.
///
/// Instances live in the static [`BUILTIN_CLASSES`] slice.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ObjectClassDef {
    /// Class name as used in LDAP `objectClass` attributes.
    pub name: &'static str,
    /// OID for this class.
    pub oid: &'static str,
    /// Direct superclasses (empty for `top`).
    pub super_classes: &'static [&'static str],
    /// Attributes that MUST be present on entries of this class.
    pub must_attributes: &'static [&'static str],
    /// Attributes that MAY be present on entries of this class.
    pub may_attributes: &'static [&'static str],
    /// The PostgreSQL source that backs entries of this class.
    pub pg_source: PgSource,
}

/// All built-in objectClasses exposed by the virtual LDAP directory.
pub static BUILTIN_CLASSES: &[ObjectClassDef] = &[
    // ── Abstract / structural base ────────────────────────────────────────
    ObjectClassDef {
        name: "top",
        oid: "2.5.6.0",
        super_classes: &[],
        must_attributes: &["objectClass"],
        may_attributes: &[
            "description",
            "distinguishedName",
            "name",
            "objectGUID",
            "objectSid",
            "whenCreated",
            "whenChanged",
        ],
        pg_source: PgSource::Virtual,
    },
    // ── Person chain ─────────────────────────────────────────────────────
    ObjectClassDef {
        name: "person",
        oid: "2.5.6.6",
        super_classes: &["top"],
        must_attributes: &["cn", "sn"],
        may_attributes: &["telephoneNumber", "description"],
        pg_source: PgSource::Virtual,
    },
    ObjectClassDef {
        name: "organizationalPerson",
        oid: "2.5.6.7",
        super_classes: &["person"],
        must_attributes: &[],
        may_attributes: &[
            "title",
            "department",
            "givenName",
            "mail",
            "telephoneNumber",
            "displayName",
        ],
        pg_source: PgSource::Virtual,
    },
    ObjectClassDef {
        name: "user",
        oid: "1.2.840.113556.1.5.9",
        super_classes: &["organizationalPerson"],
        must_attributes: &["sAMAccountName"],
        may_attributes: &[
            "userPrincipalName",
            "unicodePwd",
            "userAccountControl",
            "memberOf",
            "homeDirectory",
            "scriptPath",
            "profilePath",
            "servicePrincipalName",
        ],
        pg_source: PgSource::User,
    },
    ObjectClassDef {
        name: "computer",
        oid: "1.2.840.113556.1.5.8",
        super_classes: &["user"],
        must_attributes: &[],
        may_attributes: &["servicePrincipalName"],
        pg_source: PgSource::Computer,
    },
    // ── Group ─────────────────────────────────────────────────────────────
    ObjectClassDef {
        name: "group",
        oid: "1.2.840.113556.1.5.8",
        super_classes: &["top"],
        must_attributes: &["cn", "sAMAccountName"],
        may_attributes: &["member", "groupType", "description", "mail"],
        pg_source: PgSource::Group,
    },
    // ── Organisational units / containers ─────────────────────────────────
    ObjectClassDef {
        name: "organizationalUnit",
        oid: "2.5.6.5",
        super_classes: &["top"],
        must_attributes: &["ou"],
        may_attributes: &["description", "displayName"],
        pg_source: PgSource::OrgNode,
    },
    ObjectClassDef {
        name: "container",
        oid: "1.2.840.113556.1.3.23",
        super_classes: &["top"],
        must_attributes: &["cn"],
        may_attributes: &["description"],
        pg_source: PgSource::Virtual,
    },
    // ── Domain ────────────────────────────────────────────────────────────
    ObjectClassDef {
        name: "domainDNS",
        oid: "1.2.840.113556.1.5.67",
        super_classes: &["top"],
        must_attributes: &["dc"],
        may_attributes: &["description", "name"],
        pg_source: PgSource::Domain,
    },
    // ── Contact ───────────────────────────────────────────────────────────
    ObjectClassDef {
        name: "contact",
        oid: "1.2.840.113556.1.5.15",
        super_classes: &["organizationalPerson"],
        must_attributes: &["cn"],
        may_attributes: &["mail", "telephoneNumber", "givenName", "sn"],
        pg_source: PgSource::Contact,
    },
];

/// Returns the [`ObjectClassDef`] for the given class name (case-insensitive).
///
/// # Examples
///
/// ```
/// use signapps_ad_core::schema::classes::find_class;
///
/// let def = find_class("user").unwrap();
/// assert_eq!(def.name, "user");
///
/// assert!(find_class("User").is_some());
/// assert!(find_class("nonexistent").is_none());
/// ```
pub fn find_class(name: &str) -> Option<&'static ObjectClassDef> {
    BUILTIN_CLASSES
        .iter()
        .find(|c| c.name.eq_ignore_ascii_case(name))
}

/// Returns the full superclass chain for a given class name, including the
/// class itself.
///
/// The result is ordered from the class itself up to `"top"`.  Returns an
/// empty `Vec` if the class is not found.
///
/// # Examples
///
/// ```
/// use signapps_ad_core::schema::classes::class_hierarchy;
///
/// let chain = class_hierarchy("user");
/// assert_eq!(chain, vec!["user", "organizationalPerson", "person", "top"]);
///
/// let chain = class_hierarchy("group");
/// assert_eq!(chain, vec!["group", "top"]);
///
/// let chain = class_hierarchy("nonexistent");
/// assert!(chain.is_empty());
/// ```
pub fn class_hierarchy(name: &str) -> Vec<&'static str> {
    let mut result = Vec::new();
    let mut current = name;

    loop {
        match find_class(current) {
            None => break,
            Some(def) => {
                result.push(def.name);
                match def.super_classes.first() {
                    Some(parent) => current = parent,
                    None => break,
                }
            },
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find_user_class() {
        let def = find_class("user").expect("user class must exist");
        assert_eq!(def.name, "user");
        assert_eq!(def.pg_source, PgSource::User);
    }

    #[test]
    fn case_insensitive_lookup() {
        assert!(find_class("User").is_some());
        assert!(find_class("USER").is_some());
        assert!(find_class("OrganizationalUnit").is_some());
    }

    #[test]
    fn user_hierarchy() {
        let chain = class_hierarchy("user");
        assert_eq!(chain, vec!["user", "organizationalPerson", "person", "top"]);
    }

    #[test]
    fn computer_extends_user() {
        let chain = class_hierarchy("computer");
        assert_eq!(
            chain,
            vec!["computer", "user", "organizationalPerson", "person", "top"]
        );
    }

    #[test]
    fn group_hierarchy() {
        let chain = class_hierarchy("group");
        assert_eq!(chain, vec!["group", "top"]);
    }

    #[test]
    fn find_attribute_lookup() {
        use crate::schema::attributes::find_attribute;

        let def = find_attribute("sAMAccountName").expect("sAMAccountName must exist");
        assert_eq!(def.name, "sAMAccountName");
        assert!(!def.multi_valued);
    }
}
