//! Attribute syntax types for the AD schema registry.

use std::fmt;

use serde::{Deserialize, Serialize};

/// The syntax (value type) of an LDAP/AD attribute.
///
/// Mirrors the subset of RFC 4517 syntaxes used by Active Directory.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AttributeSyntax {
    /// UTF-8 string (`1.3.6.1.4.1.1466.115.121.1.15`).
    DirectoryString,
    /// Distinguished Name (`1.3.6.1.4.1.1466.115.121.1.12`).
    DnString,
    /// 32-bit or 64-bit signed integer (`1.3.6.1.4.1.1466.115.121.1.27`).
    Integer,
    /// Boolean true/false (`1.3.6.1.4.1.1466.115.121.1.7`).
    Boolean,
    /// Raw binary octet string (`1.3.6.1.4.1.1466.115.121.1.40`).
    OctetString,
    /// ISO 8601 / X.500 GeneralizedTime (`1.3.6.1.4.1.1466.115.121.1.24`).
    GeneralizedTime,
    /// Windows NT Security Descriptor (binary blob).
    NtSecurityDescriptor,
    /// Windows LARGE_INTEGER (64-bit signed, stored as decimal string in LDAP).
    LargeInteger,
    /// Windows SID binary blob.
    Sid,
}

/// A typed attribute value that can be stored in a [`DirectoryEntry`].
///
/// [`DirectoryEntry`]: crate::entry::DirectoryEntry
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AttributeValue {
    /// UTF-8 string value.
    String(String),
    /// Raw binary value.
    Binary(Vec<u8>),
    /// 64-bit signed integer value.
    Integer(i64),
    /// Boolean value.
    Boolean(bool),
}

impl AttributeValue {
    /// Returns a reference to the inner string, if this is a [`AttributeValue::String`] variant.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::schema::syntax::AttributeValue;
    ///
    /// let v = AttributeValue::String("Alice".to_owned());
    /// assert_eq!(v.as_str(), Some("Alice"));
    ///
    /// let v = AttributeValue::Boolean(true);
    /// assert_eq!(v.as_str(), None);
    /// ```
    pub fn as_str(&self) -> Option<&str> {
        match self {
            AttributeValue::String(s) => Some(s.as_str()),
            _ => None,
        }
    }

    /// Converts any variant to a byte representation suitable for LDAP responses.
    ///
    /// - `String` → UTF-8 bytes
    /// - `Binary` → raw bytes (cloned)
    /// - `Integer` → ASCII decimal representation
    /// - `Boolean` → `b"TRUE"` or `b"FALSE"`
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::schema::syntax::AttributeValue;
    ///
    /// let v = AttributeValue::Integer(42);
    /// assert_eq!(v.as_bytes(), b"42".to_vec());
    ///
    /// let v = AttributeValue::Boolean(true);
    /// assert_eq!(v.as_bytes(), b"TRUE".to_vec());
    /// ```
    pub fn as_bytes(&self) -> Vec<u8> {
        match self {
            AttributeValue::String(s) => s.as_bytes().to_vec(),
            AttributeValue::Binary(b) => b.clone(),
            AttributeValue::Integer(i) => i.to_string().into_bytes(),
            AttributeValue::Boolean(true) => b"TRUE".to_vec(),
            AttributeValue::Boolean(false) => b"FALSE".to_vec(),
        }
    }
}

impl fmt::Display for AttributeValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AttributeValue::String(s) => write!(f, "{s}"),
            AttributeValue::Binary(b) => write!(f, "<binary {} bytes>", b.len()),
            AttributeValue::Integer(i) => write!(f, "{i}"),
            AttributeValue::Boolean(b) => write!(f, "{}", if *b { "TRUE" } else { "FALSE" }),
        }
    }
}
