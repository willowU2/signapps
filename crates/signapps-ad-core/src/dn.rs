//! Distinguished Name parsing and building (RFC 4514).
//!
//! Provides [`DistinguishedName`], [`RdnComponent`], and [`DnBuilder`] for
//! working with LDAP/Active-Directory Distinguished Names according to
//! [RFC 4514](https://datatracker.ietf.org/doc/html/rfc4514).
//!
//! # Examples
//!
//! ```rust
//! use signapps_ad_core::dn::DistinguishedName;
//!
//! let dn = DistinguishedName::parse("CN=John Doe,OU=Users,DC=example,DC=com").unwrap();
//! assert_eq!(dn.rdn_value(), "John Doe");
//! assert_eq!(dn.domain_suffix(), "example.com");
//! ```

use std::fmt;

use serde::{Deserialize, Serialize};
use thiserror::Error;

// ── Errors ───────────────────────────────────────────────────────────────────

/// Errors that can occur while parsing or building a [`DistinguishedName`].
#[derive(Debug, Error)]
pub enum DnError {
    /// The input string is not a valid RFC 4514 Distinguished Name.
    #[error("invalid DN syntax: {0}")]
    InvalidSyntax(String),

    /// An attribute type in the DN is not recognised.
    #[error("unknown attribute type: {0}")]
    UnknownAttribute(String),
}

// ── RdnComponent ─────────────────────────────────────────────────────────────

/// A single Relative Distinguished Name component (e.g. `CN=John Doe`).
///
/// The `value` field holds the **unescaped** string; escaping is applied only
/// when the [`DistinguishedName`] is rendered via [`fmt::Display`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdnComponent {
    /// Attribute type, e.g. `"CN"`, `"OU"`, `"DC"`.
    pub attr_type: String,
    /// Unescaped attribute value.
    pub value: String,
}

impl RdnComponent {
    /// Creates a new [`RdnComponent`].
    ///
    /// # Examples
    ///
    /// ```rust
    /// use signapps_ad_core::dn::RdnComponent;
    ///
    /// let rdn = RdnComponent::new("CN", "John Doe");
    /// assert_eq!(rdn.attr_type, "CN");
    /// assert_eq!(rdn.value, "John Doe");
    /// ```
    pub fn new(attr_type: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            attr_type: attr_type.into(),
            value: value.into(),
        }
    }
}

impl fmt::Display for RdnComponent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}={}", self.attr_type, escape_dn_value(&self.value))
    }
}

// ── DistinguishedName ─────────────────────────────────────────────────────────

/// An LDAP Distinguished Name as defined by RFC 4514.
///
/// Components are stored in wire order (most-specific first, i.e. leftmost =
/// index 0). The root DN (empty string) has zero components.
///
/// # Examples
///
/// ```rust
/// use signapps_ad_core::dn::DistinguishedName;
///
/// let dn = DistinguishedName::parse("CN=Alice,OU=HR,DC=corp,DC=local").unwrap();
/// assert_eq!(dn.rdn_value(), "Alice");
/// assert!(dn.is_descendant_of(
///     &DistinguishedName::parse("DC=corp,DC=local").unwrap()
/// ));
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistinguishedName {
    /// RDN components, most-specific (left) first.
    pub components: Vec<RdnComponent>,
}

impl DistinguishedName {
    // ── Constructors ──────────────────────────────────────────────────────

    /// Parses a Distinguished Name string according to RFC 4514.
    ///
    /// An empty string is accepted and represents the root DN.
    ///
    /// # Errors
    ///
    /// Returns [`DnError::InvalidSyntax`] when the input cannot be parsed as a
    /// valid RFC 4514 DN.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use signapps_ad_core::dn::DistinguishedName;
    ///
    /// let dn = DistinguishedName::parse("CN=Bob,DC=example,DC=com").unwrap();
    /// assert_eq!(dn.components().len(), 3);
    /// ```
    ///
    /// # Panics
    ///
    /// Never panics — all errors are returned via `Result`.
    pub fn parse(input: &str) -> Result<Self, DnError> {
        let input = input.trim();
        if input.is_empty() {
            return Ok(Self {
                components: Vec::new(),
            });
        }

        let raw_rdns = split_rdns(input)?;
        let mut components = Vec::with_capacity(raw_rdns.len());

        for raw in raw_rdns {
            let component = parse_rdn(raw)?;
            components.push(component);
        }

        Ok(Self { components })
    }

    /// Builds a [`DistinguishedName`] from a path and a domain name.
    ///
    /// `path` is ordered **outermost-to-innermost**: the last element becomes
    /// the `CN`, intermediate elements become `OU`s (in order), and the domain
    /// name is split on `'.'` into `DC` components.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use signapps_ad_core::dn::DistinguishedName;
    ///
    /// let dn = DistinguishedName::from_path(&["Users", "John Doe"], "example.com");
    /// assert_eq!(dn.to_string(), "CN=John Doe,OU=Users,DC=example,DC=com");
    /// ```
    ///
    /// # Errors
    ///
    /// This function never returns an error.
    ///
    /// # Panics
    ///
    /// Panics if `path` is empty.
    pub fn from_path(path: &[&str], domain: &str) -> Self {
        assert!(!path.is_empty(), "from_path: path must not be empty");

        let mut components: Vec<RdnComponent> = Vec::new();

        // Last element → CN. Safety: non-emptiness was asserted above.
        let cn = path[path.len() - 1];
        components.push(RdnComponent::new("CN", cn));

        // Intermediate elements (all but last) → OU in reverse order so that
        // the outermost OU appears last in the wire representation.
        // path = ["A", "B", "C", "name"]  →  CN=name,OU=C,OU=B,OU=A
        for ou in path[..path.len() - 1].iter().rev() {
            components.push(RdnComponent::new("OU", *ou));
        }

        // Domain → DC components
        for dc in domain.split('.') {
            if !dc.is_empty() {
                components.push(RdnComponent::new("DC", dc));
            }
        }

        Self { components }
    }

    /// Returns a [`DnBuilder`] for programmatic construction.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use signapps_ad_core::dn::DistinguishedName;
    ///
    /// let dn = DistinguishedName::build()
    ///     .cn("Alice")
    ///     .ou("IT")
    ///     .dc("example")
    ///     .dc("com")
    ///     .finish();
    /// assert_eq!(dn.to_string(), "CN=Alice,OU=IT,DC=example,DC=com");
    /// ```
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn build() -> DnBuilder {
        DnBuilder::new()
    }

    // ── Accessors ─────────────────────────────────────────────────────────

    /// Returns `true` if this is the root DN (zero components).
    ///
    /// # Examples
    ///
    /// ```rust
    /// use signapps_ad_core::dn::DistinguishedName;
    ///
    /// assert!(DistinguishedName::parse("").unwrap().is_root());
    /// ```
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn is_root(&self) -> bool {
        self.components.is_empty()
    }

    /// Returns the RDN components slice (most-specific first).
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn components(&self) -> &[RdnComponent] {
        &self.components
    }

    /// Returns the leftmost RDN as a formatted string (e.g. `"CN=John Doe"`).
    ///
    /// Returns an empty string for the root DN.
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn rdn(&self) -> String {
        match self.components.first() {
            Some(c) => c.to_string(),
            None => String::new(),
        }
    }

    /// Returns the unescaped value of the leftmost RDN component.
    ///
    /// Returns `""` for the root DN.
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn rdn_value(&self) -> &str {
        match self.components.first() {
            Some(c) => &c.value,
            None => "",
        }
    }

    /// Returns the parent DN (everything after the first component), or
    /// `None` if this DN has zero or one component.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use signapps_ad_core::dn::DistinguishedName;
    ///
    /// let dn = DistinguishedName::parse("CN=Bob,DC=example,DC=com").unwrap();
    /// let parent = dn.parent().unwrap();
    /// assert_eq!(parent.to_string(), "DC=example,DC=com");
    /// ```
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn parent(&self) -> Option<Self> {
        if self.components.len() <= 1 {
            return None;
        }
        Some(Self {
            components: self.components[1..].to_vec(),
        })
    }

    /// Returns `true` if `self` is a descendant of `ancestor` (case-insensitive).
    ///
    /// A DN is *not* considered a descendant of itself.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use signapps_ad_core::dn::DistinguishedName;
    ///
    /// let child  = DistinguishedName::parse("CN=Bob,OU=Users,DC=corp,DC=local").unwrap();
    /// let parent = DistinguishedName::parse("OU=Users,DC=corp,DC=local").unwrap();
    /// assert!(child.is_descendant_of(&parent));
    /// assert!(!parent.is_descendant_of(&child));
    /// ```
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn is_descendant_of(&self, ancestor: &Self) -> bool {
        let anc_len = ancestor.components.len();
        let self_len = self.components.len();

        if anc_len == 0 {
            // Every non-root DN is a descendant of root.
            return self_len > 0;
        }
        if self_len <= anc_len {
            return false;
        }

        // The tail of self's components must equal ancestor's components.
        let tail = &self.components[self_len - anc_len..];
        tail.iter().zip(ancestor.components.iter()).all(|(a, b)| {
            a.attr_type.eq_ignore_ascii_case(&b.attr_type) && a.value.eq_ignore_ascii_case(&b.value)
        })
    }

    /// Joins all `DC` components with `'.'` to produce the domain suffix.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use signapps_ad_core::dn::DistinguishedName;
    ///
    /// let dn = DistinguishedName::parse("CN=Bob,DC=example,DC=com").unwrap();
    /// assert_eq!(dn.domain_suffix(), "example.com");
    /// ```
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn domain_suffix(&self) -> String {
        self.components
            .iter()
            .filter(|c| c.attr_type.eq_ignore_ascii_case("DC"))
            .map(|c| c.value.as_str())
            .collect::<Vec<_>>()
            .join(".")
    }
}

// ── Display / PartialEq / Eq ──────────────────────────────────────────────────

impl fmt::Display for DistinguishedName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let parts: Vec<String> = self.components.iter().map(|c| c.to_string()).collect();
        write!(f, "{}", parts.join(","))
    }
}

impl PartialEq for DistinguishedName {
    fn eq(&self, other: &Self) -> bool {
        if self.components.len() != other.components.len() {
            return false;
        }
        self.components
            .iter()
            .zip(other.components.iter())
            .all(|(a, b)| {
                a.attr_type.eq_ignore_ascii_case(&b.attr_type)
                    && a.value.eq_ignore_ascii_case(&b.value)
            })
    }
}

impl Eq for DistinguishedName {}

// ── DnBuilder ─────────────────────────────────────────────────────────────────

/// Builder for constructing a [`DistinguishedName`] programmatically.
///
/// Components are appended in left-to-right (most-specific-first) order.
///
/// # Examples
///
/// ```rust
/// use signapps_ad_core::dn::DistinguishedName;
///
/// let dn = DistinguishedName::build()
///     .cn("Alice")
///     .ou("Engineering")
///     .dc("acme")
///     .dc("com")
///     .finish();
/// assert_eq!(dn.to_string(), "CN=Alice,OU=Engineering,DC=acme,DC=com");
/// ```
#[derive(Debug, Default)]
pub struct DnBuilder {
    components: Vec<RdnComponent>,
}

impl DnBuilder {
    /// Creates a new, empty [`DnBuilder`].
    pub fn new() -> Self {
        Self {
            components: Vec::new(),
        }
    }

    /// Appends a `CN` component.
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn cn(mut self, value: &str) -> Self {
        self.components.push(RdnComponent::new("CN", value));
        self
    }

    /// Appends an `OU` component.
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn ou(mut self, value: &str) -> Self {
        self.components.push(RdnComponent::new("OU", value));
        self
    }

    /// Appends a `DC` component.
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn dc(mut self, value: &str) -> Self {
        self.components.push(RdnComponent::new("DC", value));
        self
    }

    /// Consumes the builder and returns the completed [`DistinguishedName`].
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn finish(self) -> DistinguishedName {
        DistinguishedName {
            components: self.components,
        }
    }
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

/// Splits a DN string into raw RDN tokens, respecting escaped commas.
fn split_rdns(input: &str) -> Result<Vec<&str>, DnError> {
    let bytes = input.as_bytes();
    let mut rdns: Vec<&str> = Vec::new();
    let mut start = 0usize;
    let mut i = 0usize;

    while i < bytes.len() {
        match bytes[i] {
            b'\\' => {
                // Skip the next character (escaped).
                i += 2;
            },
            b',' => {
                let rdn = input[start..i].trim();
                if rdn.is_empty() {
                    return Err(DnError::InvalidSyntax(
                        "empty RDN between commas".to_string(),
                    ));
                }
                rdns.push(rdn);
                start = i + 1;
                i += 1;
            },
            _ => {
                i += 1;
            },
        }
    }

    // Last segment
    let last = input[start..].trim();
    if last.is_empty() {
        return Err(DnError::InvalidSyntax("trailing comma in DN".to_string()));
    }
    rdns.push(last);
    Ok(rdns)
}

/// Parses a single `attr=value` token into an [`RdnComponent`].
fn parse_rdn(raw: &str) -> Result<RdnComponent, DnError> {
    let eq_pos = raw
        .find('=')
        .ok_or_else(|| DnError::InvalidSyntax(format!("missing '=' in RDN: {raw}")))?;

    let attr = raw[..eq_pos].trim().to_string();
    if attr.is_empty() {
        return Err(DnError::InvalidSyntax(
            "attribute type is empty".to_string(),
        ));
    }

    let raw_value = raw[eq_pos + 1..].trim();
    let value = unescape_dn_value(raw_value)?;

    Ok(RdnComponent {
        attr_type: attr,
        value,
    })
}

/// Unescapes RFC 4514 escape sequences from a DN value.
///
/// Handles `\,` `\+` `\"` `\\` `\<` `\>` `\;` `\=` `\#` `\ ` and `\XX` hex pairs.
fn unescape_dn_value(input: &str) -> Result<String, DnError> {
    let mut result = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        if chars[i] == '\\' {
            if i + 1 >= chars.len() {
                return Err(DnError::InvalidSyntax(
                    "trailing backslash in DN value".to_string(),
                ));
            }
            let next = chars[i + 1];
            match next {
                ',' | '+' | '"' | '\\' | '<' | '>' | ';' | '=' | '#' | ' ' => {
                    result.push(next);
                    i += 2;
                },
                _ => {
                    // Expect two hex digits: \XX
                    if i + 2 >= chars.len() {
                        return Err(DnError::InvalidSyntax(format!(
                            "invalid escape sequence \\{next}"
                        )));
                    }
                    let hex: String = [chars[i + 1], chars[i + 2]].iter().collect();
                    let byte = u8::from_str_radix(&hex, 16).map_err(|_| {
                        DnError::InvalidSyntax(format!("invalid hex escape \\{hex}"))
                    })?;
                    result.push(byte as char);
                    i += 3;
                },
            }
        } else {
            result.push(chars[i]);
            i += 1;
        }
    }

    Ok(result)
}

/// Escapes special characters in a DN value per RFC 4514.
fn escape_dn_value(input: &str) -> String {
    let mut result = String::with_capacity(input.len() + 4);
    let chars: Vec<char> = input.chars().collect();

    for (idx, &ch) in chars.iter().enumerate() {
        match ch {
            ',' | '+' | '"' | '\\' | '<' | '>' | ';' => {
                result.push('\\');
                result.push(ch);
            },
            ' ' if idx == 0 || idx == chars.len() - 1 => {
                // Leading and trailing spaces must be escaped.
                result.push('\\');
                result.push(' ');
            },
            '#' if idx == 0 => {
                // Leading '#' must be escaped.
                result.push('\\');
                result.push('#');
            },
            _ => result.push(ch),
        }
    }

    result
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_simple_dn() {
        let dn = DistinguishedName::parse("CN=John Doe,OU=Users,DC=example,DC=com").unwrap();
        assert_eq!(dn.components().len(), 4);
        assert_eq!(dn.rdn(), "CN=John Doe");
        let parent = dn.parent().unwrap();
        assert_eq!(parent.to_string(), "OU=Users,DC=example,DC=com");
    }

    #[test]
    fn parse_escaped_characters() {
        let dn = DistinguishedName::parse(r"CN=Before\,After,DC=example,DC=com").unwrap();
        assert_eq!(dn.components().len(), 3);
        assert_eq!(dn.rdn_value(), "Before,After");
    }

    #[test]
    fn parse_empty_dn() {
        let dn = DistinguishedName::parse("").unwrap();
        assert!(dn.is_root());
        assert_eq!(dn.components().len(), 0);
    }

    #[test]
    fn parse_invalid_dn() {
        let result = DistinguishedName::parse("not a valid dn without equals");
        assert!(result.is_err(), "expected error for invalid DN");
    }

    #[test]
    fn build_dn_from_components() {
        let dn = DistinguishedName::build()
            .cn("John Doe")
            .ou("Users")
            .dc("example")
            .dc("com")
            .finish();
        assert_eq!(dn.to_string(), "CN=John Doe,OU=Users,DC=example,DC=com");
    }

    #[test]
    fn dn_case_insensitive_comparison() {
        let a = DistinguishedName::parse("CN=Admin,DC=Example,DC=COM").unwrap();
        let b = DistinguishedName::parse("cn=admin,dc=example,dc=com").unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn dn_is_descendant_of() {
        let child = DistinguishedName::parse("CN=Bob,OU=Users,DC=corp,DC=local").unwrap();
        let parent = DistinguishedName::parse("OU=Users,DC=corp,DC=local").unwrap();
        let root = DistinguishedName::parse("DC=corp,DC=local").unwrap();

        assert!(child.is_descendant_of(&parent));
        assert!(child.is_descendant_of(&root));
        assert!(!parent.is_descendant_of(&child));
        assert!(
            !child.is_descendant_of(&child),
            "a DN is not a descendant of itself"
        );
    }

    #[test]
    fn dn_domain_suffix() {
        let dn = DistinguishedName::parse("CN=Alice,OU=HR,DC=example,DC=com").unwrap();
        assert_eq!(dn.domain_suffix(), "example.com");
    }

    #[test]
    fn build_dn_from_path_and_domain() {
        let dn = DistinguishedName::from_path(&["Users", "John Doe"], "example.com");
        assert_eq!(dn.to_string(), "CN=John Doe,OU=Users,DC=example,DC=com");
    }
}
