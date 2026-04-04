//! Built-in Active Directory attribute definitions.

use crate::schema::syntax::AttributeSyntax;

/// Metadata describing a single LDAP/AD attribute.
///
/// Instances are stored in the static [`BUILTIN_ATTRIBUTES`] slice and are
/// never heap-allocated — all string fields are `'static` references.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AttributeDef {
    /// LDAP attribute name (case-canonical form used by AD).
    pub name: &'static str,
    /// OID for this attribute.
    pub oid: &'static str,
    /// Value syntax / type.
    pub syntax: AttributeSyntax,
    /// Whether more than one value is allowed.
    pub multi_valued: bool,
    /// Whether the attribute is managed by the server and cannot be written
    /// by clients (e.g., `objectGUID`, `whenCreated`).
    pub read_only: bool,
}

/// All built-in AD attributes exposed by the virtual LDAP directory.
///
/// Ordered roughly by attribute category (core → user → group → timestamps → naming).
pub static BUILTIN_ATTRIBUTES: &[AttributeDef] = &[
    // ── Core ─────────────────────────────────────────────────────────────────
    AttributeDef {
        name: "objectGUID",
        oid: "1.2.840.113556.1.4.2",
        syntax: AttributeSyntax::OctetString,
        multi_valued: false,
        read_only: true,
    },
    AttributeDef {
        name: "objectSid",
        oid: "1.2.840.113556.1.4.146",
        syntax: AttributeSyntax::Sid,
        multi_valued: false,
        read_only: true,
    },
    AttributeDef {
        name: "objectClass",
        oid: "2.5.4.0",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: true,
        read_only: true,
    },
    AttributeDef {
        name: "distinguishedName",
        oid: "2.5.4.49",
        syntax: AttributeSyntax::DnString,
        multi_valued: false,
        read_only: true,
    },
    AttributeDef {
        name: "cn",
        oid: "2.5.4.3",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "name",
        oid: "1.2.840.113556.1.4.1",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "displayName",
        oid: "1.2.840.113556.1.2.13",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "description",
        oid: "2.5.4.13",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: true,
        read_only: false,
    },
    // ── User ─────────────────────────────────────────────────────────────────
    AttributeDef {
        name: "sAMAccountName",
        oid: "1.2.840.113556.1.4.221",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "userPrincipalName",
        oid: "1.2.840.113556.1.4.656",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "givenName",
        oid: "2.5.4.42",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "sn",
        oid: "2.5.4.4",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "mail",
        oid: "0.9.2342.19200300.100.1.3",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "telephoneNumber",
        oid: "2.5.4.20",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "department",
        oid: "1.2.840.113556.1.2.141",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "title",
        oid: "2.5.4.12",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "userAccountControl",
        oid: "1.2.840.113556.1.4.8",
        syntax: AttributeSyntax::Integer,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "memberOf",
        oid: "1.2.840.113556.1.2.102",
        syntax: AttributeSyntax::DnString,
        multi_valued: true,
        read_only: true,
    },
    AttributeDef {
        name: "unicodePwd",
        oid: "1.2.840.113556.1.4.90",
        syntax: AttributeSyntax::OctetString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "homeDirectory",
        oid: "1.2.840.113556.1.4.44",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "scriptPath",
        oid: "1.2.840.113556.1.4.62",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "profilePath",
        oid: "1.2.840.113556.1.4.139",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    AttributeDef {
        name: "servicePrincipalName",
        oid: "1.2.840.113556.1.4.771",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: true,
        read_only: false,
    },
    // ── Group ────────────────────────────────────────────────────────────────
    AttributeDef {
        name: "member",
        oid: "2.5.4.31",
        syntax: AttributeSyntax::DnString,
        multi_valued: true,
        read_only: false,
    },
    AttributeDef {
        name: "groupType",
        oid: "1.2.840.113556.1.4.750",
        syntax: AttributeSyntax::Integer,
        multi_valued: false,
        read_only: false,
    },
    // ── Timestamps ───────────────────────────────────────────────────────────
    AttributeDef {
        name: "whenCreated",
        oid: "1.2.840.113556.1.2.2",
        syntax: AttributeSyntax::GeneralizedTime,
        multi_valued: false,
        read_only: true,
    },
    AttributeDef {
        name: "whenChanged",
        oid: "1.2.840.113556.1.2.3",
        syntax: AttributeSyntax::GeneralizedTime,
        multi_valued: false,
        read_only: true,
    },
    AttributeDef {
        name: "lastLogon",
        oid: "1.2.840.113556.1.4.51",
        syntax: AttributeSyntax::LargeInteger,
        multi_valued: false,
        read_only: true,
    },
    // ── OU / Container ───────────────────────────────────────────────────────
    AttributeDef {
        name: "ou",
        oid: "2.5.4.11",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
    // ── Domain ───────────────────────────────────────────────────────────────
    AttributeDef {
        name: "dc",
        oid: "0.9.2342.19200300.100.1.25",
        syntax: AttributeSyntax::DirectoryString,
        multi_valued: false,
        read_only: false,
    },
];

/// Returns the [`AttributeDef`] for the given attribute name (case-insensitive).
///
/// # Examples
///
/// ```
/// use signapps_ad_core::schema::attributes::find_attribute;
///
/// let def = find_attribute("sAMAccountName").unwrap();
/// assert_eq!(def.name, "sAMAccountName");
///
/// // Case-insensitive
/// assert!(find_attribute("SAMACCOUNTNAME").is_some());
/// assert!(find_attribute("does-not-exist").is_none());
/// ```
pub fn find_attribute(name: &str) -> Option<&'static AttributeDef> {
    BUILTIN_ATTRIBUTES
        .iter()
        .find(|a| a.name.eq_ignore_ascii_case(name))
}
