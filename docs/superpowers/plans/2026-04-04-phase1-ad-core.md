# Phase 1: signapps-ad-core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational AD data layer that maps existing PostgreSQL tables to Active Directory concepts (DN, SID, GUID, objectClass, filters, DirectoryEntry).

**Architecture:** `signapps-ad-core` is a shared crate that provides the unified `DirectoryEntry` abstraction. It reads from existing tables (`workforce_org_nodes`, `identity.users`, `core.persons`, `workforce_org_groups`, etc.) and new tables (`ad_domains`, `ad_principal_keys`, `ad_dns_zones/records`). The LDAP server, KDC, and DNS modules will all depend on this crate — they never access the database directly.

**Tech Stack:** Rust (edition 2021), sqlx (PostgreSQL), tokio (async), serde, thiserror, uuid, chrono

**Spec:** `docs/superpowers/specs/2026-04-04-signapps-dc-design.md`

---

## File Structure

```
crates/signapps-ad-core/
  Cargo.toml
  src/
    lib.rs                  # Crate root — re-exports all public types
    dn.rs                   # DistinguishedName: parse, build, compare (RFC 4514)
    sid.rs                  # SecurityIdentifier: generate, parse, format (MS-DTYP §2.4.2)
    guid.rs                 # ObjectGuid: UUID ↔ AD GUID binary format
    uac.rs                  # UserAccountControl: bit flags (MS-ADTS §2.2.16)
    entry.rs                # DirectoryEntry: the central AD object, built from DB tables
    filter.rs               # LDAP filter → SQL compiler (RFC 4515)
    acl.rs                  # Access control: check_access() using delegations + policies
    schema/
      mod.rs                # Schema registry: objectClass definitions, attribute syntax
      classes.rs            # Built-in objectClasses (top, person, user, group, computer, OU)
      attributes.rs         # Built-in attribute definitions (sAMAccountName, mail, memberOf, ...)
      syntax.rs             # Attribute syntax types (DirectoryString, DN, Integer, Boolean, ...)
migrations/
  213_ad_domains.sql        # ad_domains table
  214_ad_principal_keys.sql # ad_principal_keys table
  215_ad_dns.sql            # ad_dns_zones + ad_dns_records tables
crates/signapps-db/src/
  models/
    ad_domain.rs            # Rust model structs for ad_domains
    ad_principal_keys.rs    # Rust model structs for ad_principal_keys
    ad_dns.rs               # Rust model structs for ad_dns_zones + ad_dns_records
    mod.rs                  # (modify) Add pub mod ad_domain, ad_principal_keys, ad_dns
  repositories/
    ad_domain_repository.rs # CRUD for ad_domains
    ad_principal_keys_repository.rs # CRUD for ad_principal_keys
    ad_dns_repository.rs    # CRUD for ad_dns_zones + ad_dns_records
    mod.rs                  # (modify) Add pub mod + re-exports
```

---

### Task 1: Create the crate skeleton

**Files:**
- Create: `crates/signapps-ad-core/Cargo.toml`
- Create: `crates/signapps-ad-core/src/lib.rs`
- Modify: `Cargo.toml` (workspace root — add member)

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "signapps-ad-core"
version.workspace = true
edition = "2021"
rust-version.workspace = true
authors.workspace = true
license.workspace = true
description = "Active Directory core data layer — DN, SID, GUID, schema, filter compilation, DirectoryEntry"

[dependencies]
tokio = { workspace = true }
sqlx = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
tracing = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
thiserror = { workspace = true }
anyhow = { workspace = true }
rand = { workspace = true }

signapps-common = { path = "../signapps-common" }
signapps-db = { path = "../signapps-db" }

[dev-dependencies]
tokio-test = { workspace = true }
```

- [ ] **Step 2: Create lib.rs**

```rust
//! Active Directory core data layer.
//!
//! Provides the foundational types and abstractions for mapping PostgreSQL
//! tables (org-structure, identity, groups) to Active Directory concepts.
//! All protocol servers (LDAP, Kerberos, DNS) depend on this crate —
//! they never access the database directly.

pub mod dn;
pub mod sid;
pub mod guid;
pub mod uac;
pub mod schema;
pub mod filter;
pub mod entry;
pub mod acl;

pub use dn::DistinguishedName;
pub use sid::SecurityIdentifier;
pub use guid::ObjectGuid;
pub use uac::UserAccountControl;
pub use entry::DirectoryEntry;
```

- [ ] **Step 3: Add to workspace members**

In root `Cargo.toml`, add `"crates/signapps-ad-core"` to the `[workspace] members` array, in the shared crates section.

- [ ] **Step 4: Verify it compiles**

Run: `rtk cargo check -p signapps-ad-core`
Expected: compilation errors for missing modules (that's fine — we'll create them next)

- [ ] **Step 5: Create empty module files**

Create all module files with minimal content so the crate compiles:

`crates/signapps-ad-core/src/dn.rs`:
```rust
//! Distinguished Name parsing and building (RFC 4514).
```

`crates/signapps-ad-core/src/sid.rs`:
```rust
//! Security Identifier generation and parsing (MS-DTYP §2.4.2).
```

`crates/signapps-ad-core/src/guid.rs`:
```rust
//! ObjectGUID: UUID ↔ AD GUID binary format conversion.
```

`crates/signapps-ad-core/src/uac.rs`:
```rust
//! userAccountControl bit flags (MS-ADTS §2.2.16).
```

`crates/signapps-ad-core/src/filter.rs`:
```rust
//! LDAP filter evaluation and SQL compilation (RFC 4515).
```

`crates/signapps-ad-core/src/entry.rs`:
```rust
//! DirectoryEntry — the central Active Directory object.
```

`crates/signapps-ad-core/src/acl.rs`:
```rust
//! Access control for directory operations.
```

`crates/signapps-ad-core/src/schema/mod.rs`:
```rust
//! AD schema registry — objectClass definitions and attribute syntax.

pub mod classes;
pub mod attributes;
pub mod syntax;
```

`crates/signapps-ad-core/src/schema/classes.rs`:
```rust
//! Built-in objectClass definitions.
```

`crates/signapps-ad-core/src/schema/attributes.rs`:
```rust
//! Built-in attribute definitions.
```

`crates/signapps-ad-core/src/schema/syntax.rs`:
```rust
//! Attribute syntax types.
```

- [ ] **Step 6: Verify it compiles clean**

Run: `rtk cargo check -p signapps-ad-core`
Expected: 0 errors, 0 warnings

- [ ] **Step 7: Commit**

```bash
git add crates/signapps-ad-core/ Cargo.toml
git commit -m "feat(ad-core): scaffold signapps-ad-core crate skeleton"
```

---

### Task 2: Distinguished Name (dn.rs)

**Files:**
- Create: `crates/signapps-ad-core/src/dn.rs`

- [ ] **Step 1: Write tests for DN parsing and building**

```rust
//! Distinguished Name parsing and building (RFC 4514).

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_simple_dn() {
        let dn = DistinguishedName::parse("CN=John Doe,OU=Users,DC=example,DC=com").unwrap();
        assert_eq!(dn.components().len(), 4);
        assert_eq!(dn.rdn(), "CN=John Doe");
        assert_eq!(dn.parent().unwrap().to_string(), "OU=Users,DC=example,DC=com");
    }

    #[test]
    fn parse_escaped_characters() {
        // RFC 4514 §2.4: comma, plus, quote, backslash, lt, gt, semicolon
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
        assert!(DistinguishedName::parse("not a valid dn without equals").is_err());
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
        let child = DistinguishedName::parse("CN=John,OU=Users,DC=example,DC=com").unwrap();
        let parent = DistinguishedName::parse("DC=example,DC=com").unwrap();
        assert!(child.is_descendant_of(&parent));
        assert!(!parent.is_descendant_of(&child));
    }

    #[test]
    fn dn_domain_suffix() {
        let dn = DistinguishedName::parse("CN=John,OU=Users,DC=example,DC=com").unwrap();
        assert_eq!(dn.domain_suffix(), "example.com");
    }

    #[test]
    fn build_dn_from_path_and_domain() {
        let dn = DistinguishedName::from_path(&["Users", "John Doe"], "example.com");
        assert_eq!(dn.to_string(), "CN=John Doe,OU=Users,DC=example,DC=com");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk cargo test -p signapps-ad-core -- dn`
Expected: FAIL — no struct `DistinguishedName`

- [ ] **Step 3: Implement DistinguishedName**

```rust
//! Distinguished Name parsing and building (RFC 4514).
//!
//! A DN is an ordered sequence of Relative Distinguished Names (RDNs),
//! each consisting of an attribute type and value (e.g., `CN=John Doe`).
//! This module handles parsing from string representation, building
//! programmatically, comparison (case-insensitive), and hierarchy checks.

use std::fmt;

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors that can occur during DN parsing.
#[derive(Debug, Error)]
pub enum DnError {
    #[error("Invalid DN syntax: {0}")]
    InvalidSyntax(String),
    #[error("Unknown attribute type: {0}")]
    UnknownAttribute(String),
}

/// A single component of a Distinguished Name (e.g., `CN=John Doe`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdnComponent {
    /// Attribute type (e.g., "CN", "OU", "DC").
    pub attr_type: String,
    /// Attribute value (unescaped).
    pub value: String,
}

/// A fully parsed Distinguished Name.
///
/// Components are stored in order from most-specific (leftmost) to
/// least-specific (rightmost). For example, `CN=John,OU=Users,DC=example,DC=com`
/// is stored as `[CN=John, OU=Users, DC=example, DC=com]`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistinguishedName {
    components: Vec<RdnComponent>,
}

impl DistinguishedName {
    /// Parse a DN from its RFC 4514 string representation.
    ///
    /// # Errors
    ///
    /// Returns `DnError::InvalidSyntax` if the string is not a valid DN.
    pub fn parse(input: &str) -> Result<Self, DnError> {
        if input.is_empty() {
            return Ok(Self { components: vec![] });
        }

        let mut components = Vec::new();
        let mut current = String::new();
        let mut escaped = false;

        for ch in input.chars() {
            if escaped {
                current.push(ch);
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                current.push(ch);
                continue;
            }
            if ch == ',' {
                components.push(Self::parse_rdn(&current)?);
                current.clear();
                continue;
            }
            current.push(ch);
        }

        if !current.is_empty() {
            components.push(Self::parse_rdn(&current)?);
        }

        Ok(Self { components })
    }

    /// Parse a single RDN component like `CN=John Doe`.
    fn parse_rdn(input: &str) -> Result<RdnComponent, DnError> {
        let input = input.trim();
        let eq_pos = input
            .find('=')
            .ok_or_else(|| DnError::InvalidSyntax(format!("No '=' in RDN: {input}")))?;

        let attr_type = input[..eq_pos].trim().to_uppercase();
        let raw_value = input[eq_pos + 1..].trim();

        // Unescape RFC 4514 special characters
        let value = Self::unescape(raw_value);

        Ok(RdnComponent { attr_type, value })
    }

    /// Unescape RFC 4514 escaped characters.
    fn unescape(input: &str) -> String {
        let mut result = String::with_capacity(input.len());
        let mut escaped = false;
        for ch in input.chars() {
            if escaped {
                result.push(ch);
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            result.push(ch);
        }
        result
    }

    /// Escape a value for use in a DN string.
    fn escape(input: &str) -> String {
        let mut result = String::with_capacity(input.len());
        for ch in input.chars() {
            if matches!(ch, ',' | '+' | '"' | '\\' | '<' | '>' | ';') {
                result.push('\\');
            }
            result.push(ch);
        }
        result
    }

    /// Returns `true` if this is the root (empty) DN.
    pub fn is_root(&self) -> bool {
        self.components.is_empty()
    }

    /// Returns all components of the DN.
    pub fn components(&self) -> &[RdnComponent] {
        &self.components
    }

    /// Returns the leftmost RDN as a string (e.g., `"CN=John Doe"`).
    pub fn rdn(&self) -> String {
        match self.components.first() {
            Some(c) => format!("{}={}", c.attr_type, Self::escape(&c.value)),
            None => String::new(),
        }
    }

    /// Returns the unescaped value of the leftmost RDN.
    pub fn rdn_value(&self) -> &str {
        self.components
            .first()
            .map(|c| c.value.as_str())
            .unwrap_or("")
    }

    /// Returns the parent DN (everything after the first component).
    pub fn parent(&self) -> Option<Self> {
        if self.components.len() <= 1 {
            return None;
        }
        Some(Self {
            components: self.components[1..].to_vec(),
        })
    }

    /// Check if this DN is a descendant of `ancestor`.
    pub fn is_descendant_of(&self, ancestor: &Self) -> bool {
        if ancestor.components.len() >= self.components.len() {
            return false;
        }
        let offset = self.components.len() - ancestor.components.len();
        for (i, ac) in ancestor.components.iter().enumerate() {
            let sc = &self.components[offset + i];
            if !sc.attr_type.eq_ignore_ascii_case(&ac.attr_type)
                || !sc.value.eq_ignore_ascii_case(&ac.value)
            {
                return false;
            }
        }
        true
    }

    /// Extract the domain suffix from DC components (e.g., `"example.com"`).
    pub fn domain_suffix(&self) -> String {
        self.components
            .iter()
            .filter(|c| c.attr_type == "DC")
            .map(|c| c.value.as_str())
            .collect::<Vec<_>>()
            .join(".")
    }

    /// Build a DN from a list of OU/CN path segments and a domain name.
    ///
    /// `path` is ordered from outermost to innermost (e.g., `["Users", "John Doe"]`).
    /// The last element becomes a CN, the rest become OUs.
    pub fn from_path(path: &[&str], domain: &str) -> Self {
        let mut components = Vec::new();

        if let Some((last, parents)) = path.split_last() {
            components.push(RdnComponent {
                attr_type: "CN".to_string(),
                value: last.to_string(),
            });
            for p in parents.iter().rev() {
                components.push(RdnComponent {
                    attr_type: "OU".to_string(),
                    value: p.to_string(),
                });
            }
        }

        for part in domain.split('.') {
            components.push(RdnComponent {
                attr_type: "DC".to_string(),
                value: part.to_string(),
            });
        }

        Self { components }
    }

    /// Start building a DN programmatically.
    pub fn build() -> DnBuilder {
        DnBuilder {
            components: Vec::new(),
        }
    }
}

impl fmt::Display for DistinguishedName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let parts: Vec<String> = self
            .components
            .iter()
            .map(|c| format!("{}={}", c.attr_type, Self::escape(&c.value)))
            .collect();
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

/// Builder for constructing a DN component-by-component.
pub struct DnBuilder {
    components: Vec<RdnComponent>,
}

impl DnBuilder {
    /// Add a CN component.
    pub fn cn(mut self, value: &str) -> Self {
        self.components.push(RdnComponent {
            attr_type: "CN".to_string(),
            value: value.to_string(),
        });
        self
    }

    /// Add an OU component.
    pub fn ou(mut self, value: &str) -> Self {
        self.components.push(RdnComponent {
            attr_type: "OU".to_string(),
            value: value.to_string(),
        });
        self
    }

    /// Add a DC component.
    pub fn dc(mut self, value: &str) -> Self {
        self.components.push(RdnComponent {
            attr_type: "DC".to_string(),
            value: value.to_string(),
        });
        self
    }

    /// Finish building and return the DN.
    pub fn finish(self) -> DistinguishedName {
        DistinguishedName {
            components: self.components,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_simple_dn() {
        let dn = DistinguishedName::parse("CN=John Doe,OU=Users,DC=example,DC=com").unwrap();
        assert_eq!(dn.components().len(), 4);
        assert_eq!(dn.rdn(), "CN=John Doe");
        assert_eq!(
            dn.parent().unwrap().to_string(),
            "OU=Users,DC=example,DC=com"
        );
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
        assert!(DistinguishedName::parse("not a valid dn without equals").is_err());
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
        let child =
            DistinguishedName::parse("CN=John,OU=Users,DC=example,DC=com").unwrap();
        let parent = DistinguishedName::parse("DC=example,DC=com").unwrap();
        assert!(child.is_descendant_of(&parent));
        assert!(!parent.is_descendant_of(&child));
    }

    #[test]
    fn dn_domain_suffix() {
        let dn =
            DistinguishedName::parse("CN=John,OU=Users,DC=example,DC=com").unwrap();
        assert_eq!(dn.domain_suffix(), "example.com");
    }

    #[test]
    fn build_dn_from_path_and_domain() {
        let dn = DistinguishedName::from_path(&["Users", "John Doe"], "example.com");
        assert_eq!(dn.to_string(), "CN=John Doe,OU=Users,DC=example,DC=com");
    }
}
```

- [ ] **Step 4: Run tests**

Run: `rtk cargo test -p signapps-ad-core -- dn`
Expected: 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add crates/signapps-ad-core/src/dn.rs
git commit -m "feat(ad-core): implement DistinguishedName parsing and building (RFC 4514)"
```

---

### Task 3: Security Identifier (sid.rs)

**Files:**
- Create: `crates/signapps-ad-core/src/sid.rs`

- [ ] **Step 1: Write tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_domain_sid() {
        let sid = SecurityIdentifier::parse("S-1-5-21-3623811015-3361044348-30300820").unwrap();
        assert_eq!(sid.revision(), 1);
        assert_eq!(sid.authority(), 5);
        assert_eq!(sid.sub_authorities(), &[21, 3623811015, 3361044348, 30300820]);
    }

    #[test]
    fn parse_well_known_sid() {
        let sid = SecurityIdentifier::parse("S-1-5-32-544").unwrap(); // BUILTIN\Administrators
        assert_eq!(sid.authority(), 5);
        assert_eq!(sid.sub_authorities(), &[32, 544]);
    }

    #[test]
    fn generate_domain_sid() {
        let sid = SecurityIdentifier::generate_domain_sid();
        assert!(sid.to_string().starts_with("S-1-5-21-"));
        assert_eq!(sid.sub_authorities().len(), 4); // 21 + 3 random
    }

    #[test]
    fn child_sid_from_domain() {
        let domain_sid = SecurityIdentifier::parse("S-1-5-21-100-200-300").unwrap();
        let user_sid = domain_sid.child(1001);
        assert_eq!(user_sid.to_string(), "S-1-5-21-100-200-300-1001");
    }

    #[test]
    fn rid_extraction() {
        let sid = SecurityIdentifier::parse("S-1-5-21-100-200-300-1001").unwrap();
        assert_eq!(sid.rid(), Some(1001));
    }

    #[test]
    fn domain_sid_extraction() {
        let sid = SecurityIdentifier::parse("S-1-5-21-100-200-300-1001").unwrap();
        let domain = sid.domain_sid().unwrap();
        assert_eq!(domain.to_string(), "S-1-5-21-100-200-300");
    }

    #[test]
    fn binary_roundtrip() {
        let sid = SecurityIdentifier::parse("S-1-5-21-3623811015-3361044348-30300820-1001").unwrap();
        let bytes = sid.to_bytes();
        let parsed = SecurityIdentifier::from_bytes(&bytes).unwrap();
        assert_eq!(sid, parsed);
    }

    #[test]
    fn invalid_sid_format() {
        assert!(SecurityIdentifier::parse("not-a-sid").is_err());
        assert!(SecurityIdentifier::parse("S-2-5-21").is_err()); // revision must be 1
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk cargo test -p signapps-ad-core -- sid`
Expected: FAIL

- [ ] **Step 3: Implement SecurityIdentifier**

```rust
//! Security Identifier (SID) generation and parsing.
//!
//! A SID uniquely identifies a security principal (user, group, computer)
//! in a Windows domain. Format: `S-1-{authority}-{sub1}-{sub2}-...-{RID}`.
//!
//! Domain SIDs have the form `S-1-5-21-{a}-{b}-{c}` where a, b, c are
//! random 32-bit integers generated at domain creation time. User/group
//! SIDs append a RID (Relative Identifier): `S-1-5-21-{a}-{b}-{c}-{RID}`.

use std::fmt;

use rand::Rng;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors during SID parsing.
#[derive(Debug, Error)]
pub enum SidError {
    #[error("Invalid SID format: {0}")]
    InvalidFormat(String),
    #[error("Invalid SID revision: expected 1, got {0}")]
    InvalidRevision(u8),
}

/// A Windows Security Identifier.
#[derive(Debug, Clone, Serialize, Deserialize, Eq)]
pub struct SecurityIdentifier {
    revision: u8,
    authority: u64,
    sub_authorities: Vec<u32>,
}

impl SecurityIdentifier {
    /// Parse a SID from its string representation (e.g., `"S-1-5-21-100-200-300"`).
    ///
    /// # Errors
    ///
    /// Returns `SidError` if the format is invalid or revision is not 1.
    pub fn parse(input: &str) -> Result<Self, SidError> {
        let parts: Vec<&str> = input.split('-').collect();
        if parts.len() < 3 || parts[0] != "S" {
            return Err(SidError::InvalidFormat(input.to_string()));
        }

        let revision: u8 = parts[1]
            .parse()
            .map_err(|_| SidError::InvalidFormat(input.to_string()))?;
        if revision != 1 {
            return Err(SidError::InvalidRevision(revision));
        }

        let authority: u64 = parts[2]
            .parse()
            .map_err(|_| SidError::InvalidFormat(input.to_string()))?;

        let sub_authorities: Vec<u32> = parts[3..]
            .iter()
            .map(|p| {
                p.parse()
                    .map_err(|_| SidError::InvalidFormat(input.to_string()))
            })
            .collect::<Result<_, _>>()?;

        Ok(Self {
            revision,
            authority,
            sub_authorities,
        })
    }

    /// Generate a new random domain SID (`S-1-5-21-{a}-{b}-{c}`).
    pub fn generate_domain_sid() -> Self {
        let mut rng = rand::thread_rng();
        Self {
            revision: 1,
            authority: 5,
            sub_authorities: vec![
                21,
                rng.gen::<u32>(),
                rng.gen::<u32>(),
                rng.gen::<u32>(),
            ],
        }
    }

    /// Create a child SID by appending a RID.
    pub fn child(&self, rid: u32) -> Self {
        let mut sub = self.sub_authorities.clone();
        sub.push(rid);
        Self {
            revision: self.revision,
            authority: self.authority,
            sub_authorities: sub,
        }
    }

    /// Extract the RID (last sub-authority), if any.
    pub fn rid(&self) -> Option<u32> {
        self.sub_authorities.last().copied()
    }

    /// Extract the domain SID (everything except the last sub-authority).
    pub fn domain_sid(&self) -> Option<Self> {
        if self.sub_authorities.len() <= 1 {
            return None;
        }
        Some(Self {
            revision: self.revision,
            authority: self.authority,
            sub_authorities: self.sub_authorities[..self.sub_authorities.len() - 1].to_vec(),
        })
    }

    /// SID revision (always 1).
    pub fn revision(&self) -> u8 {
        self.revision
    }

    /// Identifier authority value.
    pub fn authority(&self) -> u64 {
        self.authority
    }

    /// Sub-authority values.
    pub fn sub_authorities(&self) -> &[u32] {
        &self.sub_authorities
    }

    /// Encode to the binary wire format used in LDAP `objectSid` attribute.
    ///
    /// Format: revision (1 byte) + sub_authority_count (1 byte) +
    /// authority (6 bytes big-endian) + sub_authorities (4 bytes each, little-endian).
    pub fn to_bytes(&self) -> Vec<u8> {
        let count = self.sub_authorities.len() as u8;
        let mut buf = Vec::with_capacity(8 + self.sub_authorities.len() * 4);

        buf.push(self.revision);
        buf.push(count);

        // Authority: 6 bytes big-endian
        let auth_bytes = self.authority.to_be_bytes();
        buf.extend_from_slice(&auth_bytes[2..8]);

        // Sub-authorities: 4 bytes little-endian each
        for &sub in &self.sub_authorities {
            buf.extend_from_slice(&sub.to_le_bytes());
        }

        buf
    }

    /// Decode from binary wire format.
    ///
    /// # Errors
    ///
    /// Returns `SidError` if the buffer is too short or malformed.
    pub fn from_bytes(buf: &[u8]) -> Result<Self, SidError> {
        if buf.len() < 8 {
            return Err(SidError::InvalidFormat("Buffer too short".to_string()));
        }

        let revision = buf[0];
        if revision != 1 {
            return Err(SidError::InvalidRevision(revision));
        }

        let count = buf[1] as usize;
        if buf.len() < 8 + count * 4 {
            return Err(SidError::InvalidFormat("Buffer too short for sub-authorities".to_string()));
        }

        // Authority: 6 bytes big-endian → u64
        let mut auth_bytes = [0u8; 8];
        auth_bytes[2..8].copy_from_slice(&buf[2..8]);
        let authority = u64::from_be_bytes(auth_bytes);

        let mut sub_authorities = Vec::with_capacity(count);
        for i in 0..count {
            let offset = 8 + i * 4;
            let sub = u32::from_le_bytes([
                buf[offset],
                buf[offset + 1],
                buf[offset + 2],
                buf[offset + 3],
            ]);
            sub_authorities.push(sub);
        }

        Ok(Self {
            revision,
            authority,
            sub_authorities,
        })
    }
}

impl fmt::Display for SecurityIdentifier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "S-{}-{}", self.revision, self.authority)?;
        for sub in &self.sub_authorities {
            write!(f, "-{sub}")?;
        }
        Ok(())
    }
}

impl PartialEq for SecurityIdentifier {
    fn eq(&self, other: &Self) -> bool {
        self.revision == other.revision
            && self.authority == other.authority
            && self.sub_authorities == other.sub_authorities
    }
}
```

- [ ] **Step 4: Run tests**

Run: `rtk cargo test -p signapps-ad-core -- sid`
Expected: 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add crates/signapps-ad-core/src/sid.rs
git commit -m "feat(ad-core): implement SecurityIdentifier parsing, generation, and binary encoding"
```

---

### Task 4: ObjectGUID and UserAccountControl (guid.rs + uac.rs)

**Files:**
- Create: `crates/signapps-ad-core/src/guid.rs`
- Create: `crates/signapps-ad-core/src/uac.rs`

- [ ] **Step 1: Implement guid.rs with tests**

```rust
//! ObjectGUID: UUID ↔ AD GUID binary format conversion.
//!
//! Active Directory stores objectGUID as a 16-byte binary value with
//! mixed-endian encoding (first 3 groups are little-endian, last 2 are big-endian).
//! This differs from the standard UUID byte order (RFC 4122).

use uuid::Uuid;

/// Wrapper around UUID that handles AD's mixed-endian binary format.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ObjectGuid(pub Uuid);

impl ObjectGuid {
    /// Create from a standard UUID (used internally by PostgreSQL).
    pub fn from_uuid(uuid: Uuid) -> Self {
        Self(uuid)
    }

    /// Generate a new random ObjectGuid.
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    /// Return the inner UUID.
    pub fn as_uuid(&self) -> Uuid {
        self.0
    }

    /// Encode to AD's mixed-endian binary format (16 bytes).
    ///
    /// Groups 1-3 (time_low, time_mid, time_hi) are little-endian.
    /// Groups 4-5 (clock_seq, node) are big-endian (same as RFC 4122).
    pub fn to_ad_bytes(&self) -> [u8; 16] {
        let bytes = self.0.as_bytes();
        let mut ad = [0u8; 16];

        // Group 1 (4 bytes): reverse for little-endian
        ad[0] = bytes[3];
        ad[1] = bytes[2];
        ad[2] = bytes[1];
        ad[3] = bytes[0];
        // Group 2 (2 bytes): reverse
        ad[4] = bytes[5];
        ad[5] = bytes[4];
        // Group 3 (2 bytes): reverse
        ad[6] = bytes[7];
        ad[7] = bytes[6];
        // Groups 4-5 (8 bytes): same order
        ad[8..16].copy_from_slice(&bytes[8..16]);

        ad
    }

    /// Decode from AD's mixed-endian binary format.
    pub fn from_ad_bytes(ad: &[u8; 16]) -> Self {
        let mut bytes = [0u8; 16];

        bytes[0] = ad[3];
        bytes[1] = ad[2];
        bytes[2] = ad[1];
        bytes[3] = ad[0];
        bytes[4] = ad[5];
        bytes[5] = ad[4];
        bytes[6] = ad[7];
        bytes[7] = ad[6];
        bytes[8..16].copy_from_slice(&ad[8..16]);

        Self(Uuid::from_bytes(bytes))
    }
}

impl Default for ObjectGuid {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for ObjectGuid {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_ad_bytes() {
        let guid = ObjectGuid::new();
        let ad_bytes = guid.to_ad_bytes();
        let parsed = ObjectGuid::from_ad_bytes(&ad_bytes);
        assert_eq!(guid, parsed);
    }

    #[test]
    fn ad_bytes_differ_from_uuid_bytes() {
        let uuid = Uuid::parse_str("01020304-0506-0708-090a-0b0c0d0e0f10").unwrap();
        let guid = ObjectGuid::from_uuid(uuid);
        let ad = guid.to_ad_bytes();
        // First 4 bytes should be reversed
        assert_eq!(ad[0], 0x04);
        assert_eq!(ad[1], 0x03);
        assert_eq!(ad[2], 0x02);
        assert_eq!(ad[3], 0x01);
    }

    #[test]
    fn from_uuid_preserves_value() {
        let uuid = Uuid::new_v4();
        let guid = ObjectGuid::from_uuid(uuid);
        assert_eq!(guid.as_uuid(), uuid);
    }
}
```

- [ ] **Step 2: Implement uac.rs with tests**

```rust
//! userAccountControl bit flags (MS-ADTS §2.2.16).
//!
//! Controls account behavior in Active Directory: disabled, locked,
//! password policies, trust settings, etc.

use serde::{Deserialize, Serialize};

/// userAccountControl flags as a bitfield.
///
/// The value is stored as an integer in AD (`userAccountControl` attribute)
/// and in our DB as `attributes JSONB { "uac": <integer> }`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct UserAccountControl(pub u32);

impl UserAccountControl {
    // Individual flag constants (MS-ADTS §2.2.16)
    pub const ACCOUNTDISABLE: u32 = 0x0002;
    pub const HOMEDIR_REQUIRED: u32 = 0x0008;
    pub const LOCKOUT: u32 = 0x0010;
    pub const PASSWD_NOTREQD: u32 = 0x0020;
    pub const PASSWD_CANT_CHANGE: u32 = 0x0040;
    pub const NORMAL_ACCOUNT: u32 = 0x0200;
    pub const WORKSTATION_TRUST_ACCOUNT: u32 = 0x1000;
    pub const SERVER_TRUST_ACCOUNT: u32 = 0x2000;
    pub const DONT_EXPIRE_PASSWD: u32 = 0x10000;
    pub const SMARTCARD_REQUIRED: u32 = 0x40000;
    pub const TRUSTED_FOR_DELEGATION: u32 = 0x80000;
    pub const NOT_DELEGATED: u32 = 0x100000;
    pub const USE_AES_KEYS: u32 = 0x200000;
    pub const DONT_REQUIRE_PREAUTH: u32 = 0x400000;
    pub const PASSWORD_EXPIRED: u32 = 0x800000;
    pub const TRUSTED_TO_AUTH_FOR_DELEGATION: u32 = 0x1000000;

    /// Default UAC for a normal user account.
    pub fn normal_user() -> Self {
        Self(Self::NORMAL_ACCOUNT)
    }

    /// Default UAC for a computer account.
    pub fn computer() -> Self {
        Self(Self::WORKSTATION_TRUST_ACCOUNT)
    }

    /// Default UAC for a domain controller.
    pub fn domain_controller() -> Self {
        Self(Self::SERVER_TRUST_ACCOUNT | Self::TRUSTED_FOR_DELEGATION)
    }

    /// Check if a specific flag is set.
    pub fn has(&self, flag: u32) -> bool {
        self.0 & flag != 0
    }

    /// Set a flag.
    pub fn set(&mut self, flag: u32) {
        self.0 |= flag;
    }

    /// Clear a flag.
    pub fn clear(&mut self, flag: u32) {
        self.0 &= !flag;
    }

    /// Check if the account is disabled.
    pub fn is_disabled(&self) -> bool {
        self.has(Self::ACCOUNTDISABLE)
    }

    /// Check if the account is locked out.
    pub fn is_locked(&self) -> bool {
        self.has(Self::LOCKOUT)
    }

    /// Check if pre-authentication is required (should be true for security).
    pub fn requires_preauth(&self) -> bool {
        !self.has(Self::DONT_REQUIRE_PREAUTH)
    }

    /// Raw integer value.
    pub fn value(&self) -> u32 {
        self.0
    }
}

impl From<u32> for UserAccountControl {
    fn from(val: u32) -> Self {
        Self(val)
    }
}

impl From<UserAccountControl> for u32 {
    fn from(uac: UserAccountControl) -> Self {
        uac.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_user_defaults() {
        let uac = UserAccountControl::normal_user();
        assert!(uac.has(UserAccountControl::NORMAL_ACCOUNT));
        assert!(!uac.is_disabled());
        assert!(!uac.is_locked());
        assert!(uac.requires_preauth());
    }

    #[test]
    fn computer_defaults() {
        let uac = UserAccountControl::computer();
        assert!(uac.has(UserAccountControl::WORKSTATION_TRUST_ACCOUNT));
    }

    #[test]
    fn set_and_clear_flags() {
        let mut uac = UserAccountControl::normal_user();
        assert!(!uac.is_disabled());

        uac.set(UserAccountControl::ACCOUNTDISABLE);
        assert!(uac.is_disabled());

        uac.clear(UserAccountControl::ACCOUNTDISABLE);
        assert!(!uac.is_disabled());
    }

    #[test]
    fn roundtrip_u32() {
        let uac = UserAccountControl(0x0200 | 0x10000); // NORMAL + DONT_EXPIRE
        let val: u32 = uac.into();
        let back: UserAccountControl = val.into();
        assert_eq!(uac, back);
    }

    #[test]
    fn preauth_flag() {
        let mut uac = UserAccountControl::normal_user();
        assert!(uac.requires_preauth());

        uac.set(UserAccountControl::DONT_REQUIRE_PREAUTH);
        assert!(!uac.requires_preauth());
    }
}
```

- [ ] **Step 3: Run all tests**

Run: `rtk cargo test -p signapps-ad-core -- guid --include-ignored && rtk cargo test -p signapps-ad-core -- uac`
Expected: 3 guid tests + 5 uac tests PASS

- [ ] **Step 4: Commit**

```bash
git add crates/signapps-ad-core/src/guid.rs crates/signapps-ad-core/src/uac.rs
git commit -m "feat(ad-core): implement ObjectGuid binary encoding and UserAccountControl flags"
```

---

### Task 5: Schema registry (schema/)

**Files:**
- Create: `crates/signapps-ad-core/src/schema/syntax.rs`
- Create: `crates/signapps-ad-core/src/schema/attributes.rs`
- Create: `crates/signapps-ad-core/src/schema/classes.rs`
- Create: `crates/signapps-ad-core/src/schema/mod.rs`

- [ ] **Step 1: Implement syntax.rs — attribute value types**

```rust
//! Attribute syntax types (how attribute values are encoded/decoded).

use serde::{Deserialize, Serialize};

/// The syntax type of an LDAP attribute, controlling how values are
/// stored, compared, and returned in search results.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AttributeSyntax {
    /// UTF-8 string (case-insensitive comparison).
    DirectoryString,
    /// Distinguished Name reference.
    DnString,
    /// Integer value.
    Integer,
    /// Boolean (TRUE/FALSE).
    Boolean,
    /// Binary octet string (e.g., objectSid, objectGUID).
    OctetString,
    /// Generalized time (YYYYMMDDHHMMSS.0Z).
    GeneralizedTime,
    /// NT security descriptor (binary).
    NtSecurityDescriptor,
    /// Large integer (64-bit, used for timestamps like lastLogon).
    LargeInteger,
    /// SID string.
    Sid,
}

/// A single attribute value (multi-valued attributes have Vec<AttributeValue>).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AttributeValue {
    /// String value (most common).
    String(String),
    /// Binary value (objectSid, objectGUID, certificates).
    Binary(Vec<u8>),
    /// Integer value.
    Integer(i64),
    /// Boolean value.
    Boolean(bool),
}

impl AttributeValue {
    /// Return the string representation (for LDAP responses).
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Self::String(s) => Some(s),
            _ => None,
        }
    }

    /// Return as bytes (for binary attributes).
    pub fn as_bytes(&self) -> Vec<u8> {
        match self {
            Self::String(s) => s.as_bytes().to_vec(),
            Self::Binary(b) => b.clone(),
            Self::Integer(i) => i.to_string().into_bytes(),
            Self::Boolean(b) => if *b { b"TRUE" } else { b"FALSE" }.to_vec(),
        }
    }
}

impl std::fmt::Display for AttributeValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::String(s) => write!(f, "{s}"),
            Self::Binary(b) => write!(f, "<binary:{} bytes>", b.len()),
            Self::Integer(i) => write!(f, "{i}"),
            Self::Boolean(b) => write!(f, "{}", if *b { "TRUE" } else { "FALSE" }),
        }
    }
}
```

- [ ] **Step 2: Implement attributes.rs — built-in AD attributes**

```rust
//! Built-in Active Directory attribute definitions.
//!
//! Maps standard AD attribute names to their syntax, whether they are
//! single-valued or multi-valued, and their OID.

use super::syntax::AttributeSyntax;
use serde::{Deserialize, Serialize};

/// Definition of a single LDAP attribute.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttributeDef {
    /// Attribute name (e.g., "sAMAccountName").
    pub name: &'static str,
    /// LDAP OID (e.g., "1.2.840.113556.1.4.221").
    pub oid: &'static str,
    /// Value syntax.
    pub syntax: AttributeSyntax,
    /// Whether this attribute can have multiple values.
    pub multi_valued: bool,
    /// Whether this attribute is read-only (computed by the system).
    pub read_only: bool,
}

/// Registry of all known attributes.
pub static BUILTIN_ATTRIBUTES: &[AttributeDef] = &[
    // ── Core identity ──
    AttributeDef { name: "objectGUID", oid: "1.2.840.113556.1.4.2", syntax: AttributeSyntax::OctetString, multi_valued: false, read_only: true },
    AttributeDef { name: "objectSid", oid: "1.2.840.113556.1.4.146", syntax: AttributeSyntax::Sid, multi_valued: false, read_only: true },
    AttributeDef { name: "objectClass", oid: "2.5.4.0", syntax: AttributeSyntax::DirectoryString, multi_valued: true, read_only: true },
    AttributeDef { name: "distinguishedName", oid: "2.5.4.49", syntax: AttributeSyntax::DnString, multi_valued: false, read_only: true },
    AttributeDef { name: "cn", oid: "2.5.4.3", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
    AttributeDef { name: "name", oid: "2.5.4.41", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
    AttributeDef { name: "displayName", oid: "2.5.4.13.1", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
    AttributeDef { name: "description", oid: "2.5.4.13", syntax: AttributeSyntax::DirectoryString, multi_valued: true, read_only: false },

    // ── User attributes ──
    AttributeDef { name: "sAMAccountName", oid: "1.2.840.113556.1.4.221", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
    AttributeDef { name: "userPrincipalName", oid: "1.2.840.113556.1.4.656", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
    AttributeDef { name: "givenName", oid: "2.5.4.42", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
    AttributeDef { name: "sn", oid: "2.5.4.4", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
    AttributeDef { name: "mail", oid: "0.9.2342.19200300.100.1.3", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
    AttributeDef { name: "telephoneNumber", oid: "2.5.4.20", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
    AttributeDef { name: "department", oid: "2.5.4.11", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
    AttributeDef { name: "title", oid: "2.5.4.12", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
    AttributeDef { name: "userAccountControl", oid: "1.2.840.113556.1.4.8", syntax: AttributeSyntax::Integer, multi_valued: false, read_only: false },
    AttributeDef { name: "memberOf", oid: "1.2.840.113556.1.4.222", syntax: AttributeSyntax::DnString, multi_valued: true, read_only: true },
    AttributeDef { name: "unicodePwd", oid: "1.2.840.113556.1.4.90", syntax: AttributeSyntax::OctetString, multi_valued: false, read_only: false },
    AttributeDef { name: "homeDirectory", oid: "2.5.4.39", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
    AttributeDef { name: "scriptPath", oid: "1.2.840.113556.1.4.62", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
    AttributeDef { name: "profilePath", oid: "1.2.840.113556.1.4.139", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
    AttributeDef { name: "servicePrincipalName", oid: "1.2.840.113556.1.4.771", syntax: AttributeSyntax::DirectoryString, multi_valued: true, read_only: false },

    // ── Group attributes ──
    AttributeDef { name: "member", oid: "2.5.4.31", syntax: AttributeSyntax::DnString, multi_valued: true, read_only: false },
    AttributeDef { name: "groupType", oid: "1.2.840.113556.1.4.750", syntax: AttributeSyntax::Integer, multi_valued: false, read_only: false },

    // ── Timestamps ──
    AttributeDef { name: "whenCreated", oid: "1.2.840.113556.1.2.2", syntax: AttributeSyntax::GeneralizedTime, multi_valued: false, read_only: true },
    AttributeDef { name: "whenChanged", oid: "1.2.840.113556.1.2.3", syntax: AttributeSyntax::GeneralizedTime, multi_valued: false, read_only: true },
    AttributeDef { name: "lastLogon", oid: "1.2.840.113556.1.4.52", syntax: AttributeSyntax::LargeInteger, multi_valued: false, read_only: true },

    // ── OU / Container ──
    AttributeDef { name: "ou", oid: "2.5.4.11", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },

    // ── Domain ──
    AttributeDef { name: "dc", oid: "0.9.2342.19200300.100.1.25", syntax: AttributeSyntax::DirectoryString, multi_valued: false, read_only: false },
];

/// Look up an attribute definition by name (case-insensitive).
pub fn find_attribute(name: &str) -> Option<&'static AttributeDef> {
    BUILTIN_ATTRIBUTES
        .iter()
        .find(|a| a.name.eq_ignore_ascii_case(name))
}
```

- [ ] **Step 3: Implement classes.rs — objectClass definitions**

```rust
//! Built-in objectClass definitions for Active Directory.

use serde::{Deserialize, Serialize};

/// An objectClass definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectClassDef {
    /// Class name (e.g., "user", "group", "organizationalUnit").
    pub name: &'static str,
    /// OID.
    pub oid: &'static str,
    /// Parent classes (inheritance chain).
    pub super_classes: &'static [&'static str],
    /// Required attributes (MUST).
    pub must_attributes: &'static [&'static str],
    /// Optional attributes (MAY).
    pub may_attributes: &'static [&'static str],
    /// Maps to which PostgreSQL source.
    pub pg_source: PgSource,
}

/// Which PostgreSQL table(s) back this objectClass.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum PgSource {
    /// identity.users + core.persons
    User,
    /// workforce_org_groups
    Group,
    /// workforce_org_nodes (node_type determines subtype)
    OrgNode,
    /// core.persons without user_id
    Contact,
    /// workforce_org_nodes with node_type=computer
    Computer,
    /// ad_domains (root domain object)
    Domain,
    /// Virtual (not backed by a single table)
    Virtual,
}

/// Registry of all known objectClasses.
pub static BUILTIN_CLASSES: &[ObjectClassDef] = &[
    ObjectClassDef {
        name: "top",
        oid: "2.5.6.0",
        super_classes: &[],
        must_attributes: &["objectClass"],
        may_attributes: &["objectGUID", "objectSid", "distinguishedName", "cn", "name", "description", "whenCreated", "whenChanged"],
        pg_source: PgSource::Virtual,
    },
    ObjectClassDef {
        name: "person",
        oid: "2.5.6.6",
        super_classes: &["top"],
        must_attributes: &["cn", "sn"],
        may_attributes: &["telephoneNumber", "sAMAccountName", "userPrincipalName"],
        pg_source: PgSource::User,
    },
    ObjectClassDef {
        name: "organizationalPerson",
        oid: "2.5.6.7",
        super_classes: &["person"],
        must_attributes: &[],
        may_attributes: &["title", "department", "givenName", "mail"],
        pg_source: PgSource::User,
    },
    ObjectClassDef {
        name: "user",
        oid: "1.2.840.113556.1.5.9",
        super_classes: &["organizationalPerson"],
        must_attributes: &[],
        may_attributes: &["userAccountControl", "memberOf", "unicodePwd", "homeDirectory", "scriptPath", "profilePath", "servicePrincipalName", "lastLogon"],
        pg_source: PgSource::User,
    },
    ObjectClassDef {
        name: "computer",
        oid: "1.2.840.113556.1.5.17",
        super_classes: &["user"],
        must_attributes: &[],
        may_attributes: &["dNSHostName", "operatingSystem", "operatingSystemVersion"],
        pg_source: PgSource::Computer,
    },
    ObjectClassDef {
        name: "group",
        oid: "1.2.840.113556.1.5.8",
        super_classes: &["top"],
        must_attributes: &["cn", "sAMAccountName"],
        may_attributes: &["member", "memberOf", "groupType", "mail", "description"],
        pg_source: PgSource::Group,
    },
    ObjectClassDef {
        name: "organizationalUnit",
        oid: "2.5.6.5",
        super_classes: &["top"],
        must_attributes: &["ou"],
        may_attributes: &["description"],
        pg_source: PgSource::OrgNode,
    },
    ObjectClassDef {
        name: "container",
        oid: "2.5.6.1",
        super_classes: &["top"],
        must_attributes: &["cn"],
        may_attributes: &["description"],
        pg_source: PgSource::OrgNode,
    },
    ObjectClassDef {
        name: "domainDNS",
        oid: "1.2.840.113556.1.5.66",
        super_classes: &["top"],
        must_attributes: &["dc"],
        may_attributes: &["description"],
        pg_source: PgSource::Domain,
    },
    ObjectClassDef {
        name: "contact",
        oid: "2.5.6.6.1",
        super_classes: &["organizationalPerson"],
        must_attributes: &[],
        may_attributes: &["mail", "telephoneNumber"],
        pg_source: PgSource::Contact,
    },
];

/// Look up an objectClass by name (case-insensitive).
pub fn find_class(name: &str) -> Option<&'static ObjectClassDef> {
    BUILTIN_CLASSES
        .iter()
        .find(|c| c.name.eq_ignore_ascii_case(name))
}

/// Get the full inheritance chain for a class (e.g., user → organizationalPerson → person → top).
pub fn class_hierarchy(name: &str) -> Vec<&'static str> {
    let mut chain = Vec::new();
    let mut current = name;
    loop {
        match find_class(current) {
            Some(cls) => {
                chain.push(cls.name);
                if cls.super_classes.is_empty() {
                    break;
                }
                current = cls.super_classes[0];
            }
            None => break,
        }
    }
    chain
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find_user_class() {
        let cls = find_class("user").unwrap();
        assert_eq!(cls.name, "user");
        assert_eq!(cls.pg_source, PgSource::User);
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
        assert_eq!(chain, vec!["computer", "user", "organizationalPerson", "person", "top"]);
    }

    #[test]
    fn group_hierarchy() {
        let chain = class_hierarchy("group");
        assert_eq!(chain, vec!["group", "top"]);
    }

    #[test]
    fn find_attribute_lookup() {
        use super::super::attributes::find_attribute;
        let attr = find_attribute("sAMAccountName").unwrap();
        assert_eq!(attr.name, "sAMAccountName");
        assert!(!attr.multi_valued);
    }
}
```

- [ ] **Step 4: Update schema/mod.rs**

```rust
//! AD schema registry — objectClass definitions and attribute syntax.
//!
//! Provides lookup functions for objectClasses and attributes, including
//! inheritance chains and source-table mapping for SQL query generation.

pub mod attributes;
pub mod classes;
pub mod syntax;

pub use attributes::{find_attribute, AttributeDef, BUILTIN_ATTRIBUTES};
pub use classes::{class_hierarchy, find_class, ObjectClassDef, PgSource, BUILTIN_CLASSES};
pub use syntax::{AttributeSyntax, AttributeValue};
```

- [ ] **Step 5: Run tests**

Run: `rtk cargo test -p signapps-ad-core -- schema`
Expected: 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add crates/signapps-ad-core/src/schema/
git commit -m "feat(ad-core): implement AD schema registry with objectClass and attribute definitions"
```

---

### Task 6: Database migrations (213-215)

**Files:**
- Create: `migrations/213_ad_domains.sql`
- Create: `migrations/214_ad_principal_keys.sql`
- Create: `migrations/215_ad_dns.sql`

- [ ] **Step 1: Create migration 213 — ad_domains**

```sql
-- Migration 213: AD domain configuration
-- Links a tenant's org tree to an Active Directory domain with SID, realm, and DNS name.

CREATE TABLE ad_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    tree_id UUID NOT NULL,
    dns_name TEXT NOT NULL,
    netbios_name TEXT NOT NULL,
    domain_sid TEXT NOT NULL,
    realm TEXT NOT NULL,
    forest_root BOOLEAN DEFAULT false,
    domain_function_level INT DEFAULT 7,
    schema_version INT DEFAULT 1,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, dns_name)
);

CREATE INDEX idx_ad_domains_tenant ON ad_domains(tenant_id);
CREATE INDEX idx_ad_domains_realm ON ad_domains(realm);
```

- [ ] **Step 2: Create migration 214 — ad_principal_keys**

```sql
-- Migration 214: Kerberos principal keys
-- Stores encryption keys for Kerberos principals (users, computers, services, krbtgt).
-- key_data is encrypted at rest (AES-256-GCM with master key derived from JWT_SECRET + domain_sid).

CREATE TABLE ad_principal_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES ad_domains(id) ON DELETE CASCADE,
    principal_name TEXT NOT NULL,
    principal_type TEXT NOT NULL
        CHECK (principal_type IN ('user', 'computer', 'service', 'krbtgt')),
    key_version INT NOT NULL DEFAULT 1,
    enc_type INT NOT NULL,
    key_data BYTEA NOT NULL,
    salt TEXT,
    entity_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, principal_name, enc_type, key_version)
);

CREATE INDEX idx_principal_keys_lookup ON ad_principal_keys(domain_id, principal_name);
CREATE INDEX idx_principal_keys_entity ON ad_principal_keys(entity_id);
```

- [ ] **Step 3: Create migration 215 — ad_dns_zones and ad_dns_records**

```sql
-- Migration 215: AD-integrated DNS zones and records
-- Extends securelink DNS with authoritative zones for AD domains.
-- Dynamic records have a timestamp for scavenging; static records have NULL timestamp.

CREATE TABLE ad_dns_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES ad_domains(id) ON DELETE CASCADE,
    zone_name TEXT NOT NULL,
    zone_type TEXT DEFAULT 'primary'
        CHECK (zone_type IN ('primary', 'stub', 'forwarder')),
    soa_serial BIGINT DEFAULT 1,
    soa_refresh INT DEFAULT 900,
    soa_retry INT DEFAULT 600,
    soa_expire INT DEFAULT 86400,
    soa_minimum INT DEFAULT 3600,
    allow_dynamic_update BOOLEAN DEFAULT true,
    scavenge_interval_hours INT DEFAULT 168,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, zone_name)
);

CREATE INDEX idx_ad_dns_zones_domain ON ad_dns_zones(domain_id);

CREATE TABLE ad_dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES ad_dns_zones(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    record_type TEXT NOT NULL
        CHECK (record_type IN ('A', 'AAAA', 'SRV', 'CNAME', 'PTR', 'NS', 'TXT', 'MX', 'SOA')),
    rdata JSONB NOT NULL,
    ttl INT DEFAULT 3600,
    is_static BOOLEAN DEFAULT false,
    timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dns_records_lookup ON ad_dns_records(zone_id, name, record_type);
CREATE INDEX idx_dns_records_scavenge ON ad_dns_records(timestamp)
    WHERE timestamp IS NOT NULL;
```

- [ ] **Step 4: Commit**

```bash
git add migrations/213_ad_domains.sql migrations/214_ad_principal_keys.sql migrations/215_ad_dns.sql
git commit -m "feat(db): add AD domain, Kerberos principal keys, and DNS zone migrations (213-215)"
```

---

### Task 7: Rust models for new tables

**Files:**
- Create: `crates/signapps-db/src/models/ad_domain.rs`
- Create: `crates/signapps-db/src/models/ad_principal_keys.rs`
- Create: `crates/signapps-db/src/models/ad_dns.rs`
- Modify: `crates/signapps-db/src/models/mod.rs`

- [ ] **Step 1: Create ad_domain.rs**

```rust
//! Active Directory domain configuration model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

/// An Active Directory domain linked to a tenant's org tree.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdDomain {
    /// Unique identifier.
    pub id: Uuid,
    /// Owning tenant.
    pub tenant_id: Uuid,
    /// Linked org tree (from core.org_trees).
    pub tree_id: Uuid,
    /// DNS domain name (e.g., "example.com").
    pub dns_name: String,
    /// NetBIOS name (e.g., "EXAMPLE").
    pub netbios_name: String,
    /// Domain SID (e.g., "S-1-5-21-xxx-yyy-zzz").
    pub domain_sid: String,
    /// Kerberos realm (e.g., "EXAMPLE.COM").
    pub realm: String,
    /// Whether this is the forest root domain.
    pub forest_root: bool,
    /// Domain functional level (7 = Windows Server 2016).
    pub domain_function_level: i32,
    /// Schema version for this domain.
    pub schema_version: i32,
    /// Additional configuration (require_tls, max_clock_skew, etc.).
    pub config: serde_json::Value,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request to create a new AD domain.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateAdDomain {
    /// DNS domain name.
    pub dns_name: String,
    /// NetBIOS name.
    pub netbios_name: String,
    /// Linked org tree ID.
    pub tree_id: Uuid,
}
```

- [ ] **Step 2: Create ad_principal_keys.rs**

```rust
//! Kerberos principal key model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

/// A Kerberos encryption key for a principal.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdPrincipalKey {
    /// Unique identifier.
    pub id: Uuid,
    /// AD domain this key belongs to.
    pub domain_id: Uuid,
    /// Kerberos principal name (e.g., "admin@EXAMPLE.COM" or "krbtgt/EXAMPLE.COM").
    pub principal_name: String,
    /// Principal type.
    pub principal_type: String,
    /// Key version number (kvno).
    pub key_version: i32,
    /// Encryption type (17=AES128, 18=AES256, 23=RC4).
    pub enc_type: i32,
    /// Encrypted key data (AES-256-GCM at rest).
    pub key_data: Vec<u8>,
    /// Kerberos salt for key derivation.
    pub salt: Option<String>,
    /// Linked entity (user ID, org node ID, etc.).
    pub entity_id: Option<Uuid>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}
```

- [ ] **Step 3: Create ad_dns.rs**

```rust
//! AD-integrated DNS zone and record models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

/// An AD-integrated DNS zone.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdDnsZone {
    /// Unique identifier.
    pub id: Uuid,
    /// AD domain this zone belongs to.
    pub domain_id: Uuid,
    /// Zone name (e.g., "example.com").
    pub zone_name: String,
    /// Zone type.
    pub zone_type: String,
    /// SOA serial number (incremented on changes).
    pub soa_serial: i64,
    /// SOA refresh interval (seconds).
    pub soa_refresh: i32,
    /// SOA retry interval (seconds).
    pub soa_retry: i32,
    /// SOA expire interval (seconds).
    pub soa_expire: i32,
    /// SOA minimum TTL (seconds).
    pub soa_minimum: i32,
    /// Whether dynamic updates (RFC 2136) are allowed.
    pub allow_dynamic_update: bool,
    /// Scavenging interval (hours, 0 = disabled).
    pub scavenge_interval_hours: i32,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// A DNS record within an AD-integrated zone.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdDnsRecord {
    /// Unique identifier.
    pub id: Uuid,
    /// Zone this record belongs to.
    pub zone_id: Uuid,
    /// Record name (e.g., "@", "_ldap._tcp.dc._msdcs").
    pub name: String,
    /// Record type (A, AAAA, SRV, CNAME, PTR, NS, TXT, MX, SOA).
    pub record_type: String,
    /// Record data as JSONB.
    pub rdata: serde_json::Value,
    /// Time to live (seconds).
    pub ttl: i32,
    /// Whether this is a static (manually created) record.
    pub is_static: bool,
    /// Timestamp for dynamic records (NULL = static, used for scavenging).
    pub timestamp: Option<DateTime<Utc>>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}
```

- [ ] **Step 4: Add modules to signapps-db models/mod.rs**

Add the following lines to `crates/signapps-db/src/models/mod.rs`:

```rust
pub mod ad_domain;
pub mod ad_dns;
pub mod ad_principal_keys;
```

- [ ] **Step 5: Verify compilation**

Run: `rtk cargo check -p signapps-db -p signapps-ad-core`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add crates/signapps-db/src/models/ad_domain.rs crates/signapps-db/src/models/ad_principal_keys.rs crates/signapps-db/src/models/ad_dns.rs crates/signapps-db/src/models/mod.rs
git commit -m "feat(db): add Rust models for ad_domains, ad_principal_keys, ad_dns_zones/records"
```

---

### Task 8: Repositories for new tables

**Files:**
- Create: `crates/signapps-db/src/repositories/ad_domain_repository.rs`
- Create: `crates/signapps-db/src/repositories/ad_principal_keys_repository.rs`
- Create: `crates/signapps-db/src/repositories/ad_dns_repository.rs`
- Modify: `crates/signapps-db/src/repositories/mod.rs`

- [ ] **Step 1: Create ad_domain_repository.rs**

```rust
//! Repository for AD domain CRUD operations.

use crate::models::ad_domain::{AdDomain, CreateAdDomain};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for `ad_domains` table.
pub struct AdDomainRepository;

impl AdDomainRepository {
    /// Create a new AD domain with an auto-generated SID.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        input: CreateAdDomain,
        domain_sid: &str,
        realm: &str,
    ) -> Result<AdDomain> {
        let domain = sqlx::query_as::<_, AdDomain>(
            r#"
            INSERT INTO ad_domains (tenant_id, tree_id, dns_name, netbios_name, domain_sid, realm)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(input.tree_id)
        .bind(&input.dns_name)
        .bind(&input.netbios_name)
        .bind(domain_sid)
        .bind(realm)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(domain)
    }

    /// Get a domain by ID.
    pub async fn get(pool: &PgPool, id: Uuid) -> Result<Option<AdDomain>> {
        let domain = sqlx::query_as::<_, AdDomain>(
            "SELECT * FROM ad_domains WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(domain)
    }

    /// Get domain by tenant and DNS name.
    pub async fn get_by_dns_name(
        pool: &PgPool,
        tenant_id: Uuid,
        dns_name: &str,
    ) -> Result<Option<AdDomain>> {
        let domain = sqlx::query_as::<_, AdDomain>(
            "SELECT * FROM ad_domains WHERE tenant_id = $1 AND dns_name = $2",
        )
        .bind(tenant_id)
        .bind(dns_name)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(domain)
    }

    /// Get domain by Kerberos realm.
    pub async fn get_by_realm(pool: &PgPool, realm: &str) -> Result<Option<AdDomain>> {
        let domain = sqlx::query_as::<_, AdDomain>(
            "SELECT * FROM ad_domains WHERE realm = $1",
        )
        .bind(realm)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(domain)
    }

    /// List all domains for a tenant.
    pub async fn list_by_tenant(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<AdDomain>> {
        let domains = sqlx::query_as::<_, AdDomain>(
            "SELECT * FROM ad_domains WHERE tenant_id = $1 ORDER BY dns_name",
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(domains)
    }

    /// Delete a domain (cascades to principal_keys and dns_zones).
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM ad_domains WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}
```

- [ ] **Step 2: Create ad_principal_keys_repository.rs**

```rust
//! Repository for Kerberos principal key operations.

use crate::models::ad_principal_keys::AdPrincipalKey;
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for `ad_principal_keys` table.
pub struct AdPrincipalKeysRepository;

impl AdPrincipalKeysRepository {
    /// Store a new key for a principal.
    pub async fn create(
        pool: &PgPool,
        domain_id: Uuid,
        principal_name: &str,
        principal_type: &str,
        key_version: i32,
        enc_type: i32,
        key_data: &[u8],
        salt: Option<&str>,
        entity_id: Option<Uuid>,
    ) -> Result<AdPrincipalKey> {
        let key = sqlx::query_as::<_, AdPrincipalKey>(
            r#"
            INSERT INTO ad_principal_keys
                (domain_id, principal_name, principal_type, key_version, enc_type, key_data, salt, entity_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(domain_id)
        .bind(principal_name)
        .bind(principal_type)
        .bind(key_version)
        .bind(enc_type)
        .bind(key_data)
        .bind(salt)
        .bind(entity_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(key)
    }

    /// Get the latest key for a principal with a specific encryption type.
    pub async fn get_key(
        pool: &PgPool,
        domain_id: Uuid,
        principal_name: &str,
        enc_type: i32,
    ) -> Result<Option<AdPrincipalKey>> {
        let key = sqlx::query_as::<_, AdPrincipalKey>(
            r#"
            SELECT * FROM ad_principal_keys
            WHERE domain_id = $1 AND principal_name = $2 AND enc_type = $3
            ORDER BY key_version DESC LIMIT 1
            "#,
        )
        .bind(domain_id)
        .bind(principal_name)
        .bind(enc_type)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(key)
    }

    /// Get all keys for a principal (all enc_types, latest version each).
    pub async fn get_all_keys(
        pool: &PgPool,
        domain_id: Uuid,
        principal_name: &str,
    ) -> Result<Vec<AdPrincipalKey>> {
        let keys = sqlx::query_as::<_, AdPrincipalKey>(
            r#"
            SELECT DISTINCT ON (enc_type) *
            FROM ad_principal_keys
            WHERE domain_id = $1 AND principal_name = $2
            ORDER BY enc_type, key_version DESC
            "#,
        )
        .bind(domain_id)
        .bind(principal_name)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(keys)
    }

    /// Delete all keys for a principal.
    pub async fn delete_keys(
        pool: &PgPool,
        domain_id: Uuid,
        principal_name: &str,
    ) -> Result<()> {
        sqlx::query(
            "DELETE FROM ad_principal_keys WHERE domain_id = $1 AND principal_name = $2",
        )
        .bind(domain_id)
        .bind(principal_name)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}
```

- [ ] **Step 3: Create ad_dns_repository.rs**

```rust
//! Repository for AD-integrated DNS zones and records.

use crate::models::ad_dns::{AdDnsRecord, AdDnsZone};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for AD DNS zones and records.
pub struct AdDnsRepository;

impl AdDnsRepository {
    /// Create a DNS zone for an AD domain.
    pub async fn create_zone(
        pool: &PgPool,
        domain_id: Uuid,
        zone_name: &str,
    ) -> Result<AdDnsZone> {
        let zone = sqlx::query_as::<_, AdDnsZone>(
            r#"
            INSERT INTO ad_dns_zones (domain_id, zone_name)
            VALUES ($1, $2)
            RETURNING *
            "#,
        )
        .bind(domain_id)
        .bind(zone_name)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(zone)
    }

    /// Get a zone by domain and name.
    pub async fn get_zone(
        pool: &PgPool,
        domain_id: Uuid,
        zone_name: &str,
    ) -> Result<Option<AdDnsZone>> {
        let zone = sqlx::query_as::<_, AdDnsZone>(
            "SELECT * FROM ad_dns_zones WHERE domain_id = $1 AND zone_name = $2",
        )
        .bind(domain_id)
        .bind(zone_name)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(zone)
    }

    /// Add a DNS record to a zone.
    pub async fn add_record(
        pool: &PgPool,
        zone_id: Uuid,
        name: &str,
        record_type: &str,
        rdata: serde_json::Value,
        ttl: i32,
        is_static: bool,
    ) -> Result<AdDnsRecord> {
        let timestamp = if is_static {
            None
        } else {
            Some(chrono::Utc::now())
        };

        let record = sqlx::query_as::<_, AdDnsRecord>(
            r#"
            INSERT INTO ad_dns_records (zone_id, name, record_type, rdata, ttl, is_static, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            "#,
        )
        .bind(zone_id)
        .bind(name)
        .bind(record_type)
        .bind(rdata)
        .bind(ttl)
        .bind(is_static)
        .bind(timestamp)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(record)
    }

    /// Query records by name and type within a zone.
    pub async fn query_records(
        pool: &PgPool,
        zone_id: Uuid,
        name: &str,
        record_type: Option<&str>,
    ) -> Result<Vec<AdDnsRecord>> {
        let records = if let Some(rt) = record_type {
            sqlx::query_as::<_, AdDnsRecord>(
                "SELECT * FROM ad_dns_records WHERE zone_id = $1 AND name = $2 AND record_type = $3",
            )
            .bind(zone_id)
            .bind(name)
            .bind(rt)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, AdDnsRecord>(
                "SELECT * FROM ad_dns_records WHERE zone_id = $1 AND name = $2",
            )
            .bind(zone_id)
            .bind(name)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(records)
    }

    /// Delete stale dynamic records (for scavenging).
    pub async fn scavenge(pool: &PgPool, zone_id: Uuid, older_than: chrono::DateTime<chrono::Utc>) -> Result<u64> {
        let result = sqlx::query(
            r#"
            DELETE FROM ad_dns_records
            WHERE zone_id = $1 AND is_static = false AND timestamp IS NOT NULL AND timestamp < $2
            "#,
        )
        .bind(zone_id)
        .bind(older_than)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(result.rows_affected())
    }
}
```

- [ ] **Step 4: Register in repositories/mod.rs**

Add the following lines to `crates/signapps-db/src/repositories/mod.rs`:

```rust
pub mod ad_dns_repository;
pub mod ad_domain_repository;
pub mod ad_principal_keys_repository;

pub use ad_dns_repository::AdDnsRepository;
pub use ad_domain_repository::AdDomainRepository;
pub use ad_principal_keys_repository::AdPrincipalKeysRepository;
```

- [ ] **Step 5: Verify compilation**

Run: `rtk cargo check -p signapps-db`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add crates/signapps-db/src/repositories/ad_domain_repository.rs crates/signapps-db/src/repositories/ad_principal_keys_repository.rs crates/signapps-db/src/repositories/ad_dns_repository.rs crates/signapps-db/src/repositories/mod.rs
git commit -m "feat(db): add repositories for ad_domains, ad_principal_keys, ad_dns"
```

---

### Task 9: DirectoryEntry and DN resolution from DB (entry.rs)

**Files:**
- Create: `crates/signapps-ad-core/src/entry.rs`

- [ ] **Step 1: Implement DirectoryEntry with DB-backed DN resolution**

```rust
//! DirectoryEntry — the central Active Directory object.
//!
//! Built by joining existing PostgreSQL tables (identity.users, core.persons,
//! workforce_org_nodes, workforce_org_groups) into a unified LDAP-compatible
//! representation. The LDAP server, KDC, and DNS never access the database
//! directly — they call entry-building functions from this module.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dn::DistinguishedName;
use crate::schema::syntax::AttributeValue;
use crate::sid::SecurityIdentifier;
use crate::uac::UserAccountControl;

/// Lifecycle state of a directory object.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum LifecycleState {
    /// Active object.
    Live,
    /// Deleted but recoverable (AD Recycle Bin).
    Recycled,
    /// Permanently deleted marker.
    Tombstone,
}

impl LifecycleState {
    /// Parse from the database string value.
    pub fn from_db(val: Option<&str>) -> Self {
        match val {
            Some("recycled") => Self::Recycled,
            Some("tombstone") => Self::Tombstone,
            _ => Self::Live,
        }
    }
}

/// A unified Active Directory object, constructed from PostgreSQL tables.
///
/// This is the primary data structure exchanged between `ad-core` and the
/// protocol servers (LDAP, Kerberos). It represents any AD object: user,
/// group, OU, computer, contact, domain.
#[derive(Debug, Clone, serde::Serialize)]
pub struct DirectoryEntry {
    /// objectGUID — maps to the source table's UUID primary key.
    pub guid: Uuid,
    /// objectSid — the Windows security identifier.
    pub sid: Option<SecurityIdentifier>,
    /// The full Distinguished Name, computed from the hierarchy.
    pub dn: DistinguishedName,
    /// objectClass chain (e.g., ["top", "person", "organizationalPerson", "user"]).
    pub object_classes: Vec<String>,
    /// All LDAP attributes (multi-valued).
    pub attributes: HashMap<String, Vec<AttributeValue>>,
    /// userAccountControl flags (for user/computer objects).
    pub uac: UserAccountControl,
    /// Object lifecycle state.
    pub lifecycle: LifecycleState,
    /// whenCreated.
    pub created: DateTime<Utc>,
    /// whenChanged.
    pub modified: DateTime<Utc>,
}

impl DirectoryEntry {
    /// Get a single-valued string attribute.
    pub fn get_str(&self, name: &str) -> Option<&str> {
        self.attributes
            .get(name)
            .and_then(|vals| vals.first())
            .and_then(|v| v.as_str())
    }

    /// Get all values for a multi-valued attribute.
    pub fn get_all(&self, name: &str) -> &[AttributeValue] {
        self.attributes
            .get(name)
            .map(|v| v.as_slice())
            .unwrap_or(&[])
    }

    /// Set a single-valued attribute.
    pub fn set_str(&mut self, name: &str, value: &str) {
        self.attributes.insert(
            name.to_string(),
            vec![AttributeValue::String(value.to_string())],
        );
    }

    /// Add a value to a multi-valued attribute.
    pub fn add_value(&mut self, name: &str, value: AttributeValue) {
        self.attributes
            .entry(name.to_string())
            .or_default()
            .push(value);
    }

    /// Check if this entry matches a specific objectClass (case-insensitive).
    pub fn has_class(&self, class_name: &str) -> bool {
        self.object_classes
            .iter()
            .any(|c| c.eq_ignore_ascii_case(class_name))
    }
}

/// Resolve the DN of an org node by walking up the closure table.
///
/// Returns the path from root to node as a vector of `(name, node_type)` pairs,
/// ordered from outermost (root) to innermost (target node).
pub async fn resolve_node_path(
    pool: &PgPool,
    node_id: Uuid,
) -> signapps_common::Result<Vec<(String, String)>> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        r#"
        SELECT ancestor.name, ancestor.node_type
        FROM workforce_org_closure c
        JOIN workforce_org_nodes ancestor ON ancestor.id = c.ancestor_id
        WHERE c.descendant_id = $1
        ORDER BY c.depth DESC
        "#,
    )
    .bind(node_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    Ok(rows)
}

/// Build a DN from a node path and a domain DNS name.
///
/// Converts the org hierarchy into LDAP RDN components:
/// - The last element (innermost) becomes CN=...
/// - Intermediate elements become OU=...
/// - Domain parts become DC=...
pub fn build_dn_from_path(path: &[(String, String)], domain: &str) -> DistinguishedName {
    let names: Vec<&str> = path.iter().map(|(name, _)| name.as_str()).collect();
    if names.is_empty() {
        // Root domain DN
        return DistinguishedName::build()
            .dc(domain.split('.').next().unwrap_or(domain))
            .finish();
    }
    DistinguishedName::from_path(&names, domain)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entry_get_set_attributes() {
        let mut entry = DirectoryEntry {
            guid: Uuid::new_v4(),
            sid: None,
            dn: DistinguishedName::parse("CN=Test,DC=example,DC=com").unwrap(),
            object_classes: vec!["top".into(), "user".into()],
            attributes: HashMap::new(),
            uac: UserAccountControl::normal_user(),
            lifecycle: LifecycleState::Live,
            created: Utc::now(),
            modified: Utc::now(),
        };

        entry.set_str("sAMAccountName", "testuser");
        assert_eq!(entry.get_str("sAMAccountName"), Some("testuser"));
    }

    #[test]
    fn entry_multi_valued() {
        let mut entry = DirectoryEntry {
            guid: Uuid::new_v4(),
            sid: None,
            dn: DistinguishedName::parse("CN=Test,DC=example,DC=com").unwrap(),
            object_classes: vec!["top".into(), "group".into()],
            attributes: HashMap::new(),
            uac: UserAccountControl::normal_user(),
            lifecycle: LifecycleState::Live,
            created: Utc::now(),
            modified: Utc::now(),
        };

        entry.add_value("member", AttributeValue::String("CN=User1,DC=example,DC=com".into()));
        entry.add_value("member", AttributeValue::String("CN=User2,DC=example,DC=com".into()));
        assert_eq!(entry.get_all("member").len(), 2);
    }

    #[test]
    fn entry_has_class() {
        let entry = DirectoryEntry {
            guid: Uuid::new_v4(),
            sid: None,
            dn: DistinguishedName::parse("CN=Test,DC=example,DC=com").unwrap(),
            object_classes: vec!["top".into(), "person".into(), "user".into()],
            attributes: HashMap::new(),
            uac: UserAccountControl::normal_user(),
            lifecycle: LifecycleState::Live,
            created: Utc::now(),
            modified: Utc::now(),
        };

        assert!(entry.has_class("user"));
        assert!(entry.has_class("User")); // case-insensitive
        assert!(entry.has_class("top"));
        assert!(!entry.has_class("group"));
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
        assert_eq!(
            dn.to_string(),
            "CN=John Doe,OU=Backend,OU=Engineering,DC=example,DC=com"
        );
    }
}
```

- [ ] **Step 2: Run tests**

Run: `rtk cargo test -p signapps-ad-core -- entry`
Expected: 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-ad-core/src/entry.rs
git commit -m "feat(ad-core): implement DirectoryEntry with DB-backed DN resolution"
```

---

### Task 10: LDAP filter compiler (filter.rs)

**Files:**
- Create: `crates/signapps-ad-core/src/filter.rs`

- [ ] **Step 1: Implement filter parser and SQL compiler with tests**

```rust
//! LDAP filter evaluation and SQL compilation (RFC 4515).
//!
//! Parses LDAP filter strings (e.g., `(&(objectClass=user)(sAMAccountName=admin))`)
//! into a structured AST, then compiles that AST into a parameterized SQL WHERE
//! clause for execution against PostgreSQL.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors during filter parsing.
#[derive(Debug, Error)]
pub enum FilterError {
    #[error("Invalid filter syntax: {0}")]
    InvalidSyntax(String),
    #[error("Unexpected end of filter")]
    UnexpectedEnd,
    #[error("Unbalanced parentheses")]
    UnbalancedParens,
}

/// A parsed LDAP filter (AST).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LdapFilter {
    /// `(attr=value)` — equality match.
    Equal(String, String),
    /// `(attr=*value*)` — substring match.
    Substring(String, String),
    /// `(attr=*)` — presence check.
    Present(String),
    /// `(attr>=value)` — greater or equal.
    GreaterOrEqual(String, String),
    /// `(attr<=value)` — less or equal.
    LessOrEqual(String, String),
    /// `(&(filter1)(filter2)...)` — all must match.
    And(Vec<LdapFilter>),
    /// `(|(filter1)(filter2)...)` — any must match.
    Or(Vec<LdapFilter>),
    /// `(!(filter))` — negation.
    Not(Box<LdapFilter>),
}

impl LdapFilter {
    /// Parse an LDAP filter string into the AST.
    ///
    /// # Errors
    ///
    /// Returns `FilterError` if the syntax is invalid.
    pub fn parse(input: &str) -> Result<Self, FilterError> {
        let input = input.trim();
        if input.is_empty() {
            return Err(FilterError::InvalidSyntax("Empty filter".to_string()));
        }
        let (filter, rest) = Self::parse_inner(input)?;
        if !rest.trim().is_empty() {
            return Err(FilterError::InvalidSyntax(format!(
                "Trailing content: {rest}"
            )));
        }
        Ok(filter)
    }

    fn parse_inner(input: &str) -> Result<(Self, &str), FilterError> {
        let input = input.trim();
        if !input.starts_with('(') {
            return Err(FilterError::InvalidSyntax(format!(
                "Expected '(' at: {input}"
            )));
        }
        let inner = &input[1..];

        if let Some(rest) = inner.strip_prefix('&') {
            Self::parse_compound(rest, true)
        } else if let Some(rest) = inner.strip_prefix('|') {
            Self::parse_compound(rest, false)
        } else if let Some(rest) = inner.strip_prefix('!') {
            let (child, remaining) = Self::parse_inner(rest)?;
            let remaining = remaining
                .strip_prefix(')')
                .ok_or(FilterError::UnbalancedParens)?;
            Ok((Self::Not(Box::new(child)), remaining))
        } else {
            // Simple filter: find closing paren
            let close = inner
                .find(')')
                .ok_or(FilterError::UnbalancedParens)?;
            let expr = &inner[..close];
            let rest = &inner[close + 1..];
            Ok((Self::parse_simple(expr)?, rest))
        }
    }

    fn parse_compound(input: &str, is_and: bool) -> Result<(Self, &str), FilterError> {
        let mut children = Vec::new();
        let mut remaining = input;

        loop {
            remaining = remaining.trim();
            if remaining.starts_with(')') {
                remaining = &remaining[1..];
                break;
            }
            if !remaining.starts_with('(') {
                return Err(FilterError::InvalidSyntax(format!(
                    "Expected '(' in compound filter at: {remaining}"
                )));
            }
            let (child, rest) = Self::parse_inner(remaining)?;
            children.push(child);
            remaining = rest;
        }

        let filter = if is_and {
            Self::And(children)
        } else {
            Self::Or(children)
        };
        Ok((filter, remaining))
    }

    fn parse_simple(expr: &str) -> Result<Self, FilterError> {
        // Check for >= and <=
        if let Some(pos) = expr.find(">=") {
            let attr = expr[..pos].trim().to_string();
            let value = expr[pos + 2..].trim().to_string();
            return Ok(Self::GreaterOrEqual(attr, value));
        }
        if let Some(pos) = expr.find("<=") {
            let attr = expr[..pos].trim().to_string();
            let value = expr[pos + 2..].trim().to_string();
            return Ok(Self::LessOrEqual(attr, value));
        }

        // Equality / substring / presence
        let eq_pos = expr
            .find('=')
            .ok_or_else(|| FilterError::InvalidSyntax(format!("No operator in: {expr}")))?;

        let attr = expr[..eq_pos].trim().to_string();
        let value = expr[eq_pos + 1..].trim().to_string();

        if value == "*" {
            Ok(Self::Present(attr))
        } else if value.contains('*') {
            // Substring match — convert to LIKE pattern
            Ok(Self::Substring(attr, value.replace('*', "%")))
        } else {
            Ok(Self::Equal(attr, value))
        }
    }

    /// Compile this filter into a SQL WHERE clause with bind parameters.
    ///
    /// Returns `(sql_fragment, bind_values)`. The SQL uses `$N` placeholders
    /// starting from `param_offset`.
    pub fn to_sql(&self, param_offset: usize) -> (String, Vec<String>) {
        let mut params = Vec::new();
        let sql = self.to_sql_inner(&mut params, param_offset);
        (sql, params)
    }

    fn to_sql_inner(&self, params: &mut Vec<String>, offset: usize) -> String {
        match self {
            Self::Equal(attr, value) => {
                params.push(value.clone());
                let idx = offset + params.len();
                // Case-insensitive comparison for directory strings
                format!("LOWER({}) = LOWER(${})", Self::attr_to_column(attr), idx)
            }
            Self::Substring(attr, pattern) => {
                params.push(pattern.clone());
                let idx = offset + params.len();
                format!("{} ILIKE ${}", Self::attr_to_column(attr), idx)
            }
            Self::Present(attr) => {
                format!("{} IS NOT NULL", Self::attr_to_column(attr))
            }
            Self::GreaterOrEqual(attr, value) => {
                params.push(value.clone());
                let idx = offset + params.len();
                format!("{} >= ${}", Self::attr_to_column(attr), idx)
            }
            Self::LessOrEqual(attr, value) => {
                params.push(value.clone());
                let idx = offset + params.len();
                format!("{} <= ${}", Self::attr_to_column(attr), idx)
            }
            Self::And(children) => {
                let parts: Vec<String> = children
                    .iter()
                    .map(|c| c.to_sql_inner(params, offset))
                    .collect();
                format!("({})", parts.join(" AND "))
            }
            Self::Or(children) => {
                let parts: Vec<String> = children
                    .iter()
                    .map(|c| c.to_sql_inner(params, offset))
                    .collect();
                format!("({})", parts.join(" OR "))
            }
            Self::Not(child) => {
                format!("NOT ({})", child.to_sql_inner(params, offset))
            }
        }
    }

    /// Map an LDAP attribute name to a SQL column expression.
    ///
    /// Known attributes map to specific columns; unknown ones map to
    /// JSONB lookups in the `attributes` column.
    fn attr_to_column(attr: &str) -> String {
        match attr.to_lowercase().as_str() {
            "samaccountname" => "u.username".to_string(),
            "userprincipalname" => "u.username".to_string(), // computed at query time
            "mail" => "u.email".to_string(),
            "givenname" => "p.first_name".to_string(),
            "sn" => "p.last_name".to_string(),
            "displayname" => "CONCAT(p.first_name, ' ', p.last_name)".to_string(),
            "department" => "u.department".to_string(),
            "title" => "u.job_title".to_string(),
            "telephonenumber" => "u.phone".to_string(),
            "objectclass" => "n.node_type".to_string(),
            "cn" | "name" => "n.name".to_string(),
            "ou" => "n.name".to_string(),
            "description" => "n.description".to_string(),
            "useraccountcontrol" => "CAST(n.attributes->>'uac' AS INTEGER)".to_string(),
            _ => format!("n.attributes->>'{}'", attr.replace('\'', "''")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_equality_filter() {
        let f = LdapFilter::parse("(sAMAccountName=admin)").unwrap();
        assert_eq!(f, LdapFilter::Equal("sAMAccountName".into(), "admin".into()));
    }

    #[test]
    fn parse_presence_filter() {
        let f = LdapFilter::parse("(mail=*)").unwrap();
        assert_eq!(f, LdapFilter::Present("mail".into()));
    }

    #[test]
    fn parse_substring_filter() {
        let f = LdapFilter::parse("(cn=*john*)").unwrap();
        assert_eq!(f, LdapFilter::Substring("cn".into(), "%john%".into()));
    }

    #[test]
    fn parse_and_filter() {
        let f = LdapFilter::parse("(&(objectClass=user)(sAMAccountName=admin))").unwrap();
        match f {
            LdapFilter::And(children) => {
                assert_eq!(children.len(), 2);
                assert_eq!(children[0], LdapFilter::Equal("objectClass".into(), "user".into()));
                assert_eq!(children[1], LdapFilter::Equal("sAMAccountName".into(), "admin".into()));
            }
            _ => panic!("Expected And filter"),
        }
    }

    #[test]
    fn parse_or_filter() {
        let f = LdapFilter::parse("(|(cn=Alice)(cn=Bob))").unwrap();
        match f {
            LdapFilter::Or(children) => assert_eq!(children.len(), 2),
            _ => panic!("Expected Or filter"),
        }
    }

    #[test]
    fn parse_not_filter() {
        let f = LdapFilter::parse("(!(objectClass=computer))").unwrap();
        match f {
            LdapFilter::Not(inner) => {
                assert_eq!(*inner, LdapFilter::Equal("objectClass".into(), "computer".into()));
            }
            _ => panic!("Expected Not filter"),
        }
    }

    #[test]
    fn parse_nested_compound() {
        let f = LdapFilter::parse("(&(objectClass=user)(|(mail=*@example.com)(department=IT)))").unwrap();
        match f {
            LdapFilter::And(children) => {
                assert_eq!(children.len(), 2);
                assert!(matches!(children[1], LdapFilter::Or(_)));
            }
            _ => panic!("Expected And filter"),
        }
    }

    #[test]
    fn compile_simple_to_sql() {
        let f = LdapFilter::parse("(sAMAccountName=admin)").unwrap();
        let (sql, params) = f.to_sql(0);
        assert_eq!(sql, "LOWER(u.username) = LOWER($1)");
        assert_eq!(params, vec!["admin"]);
    }

    #[test]
    fn compile_and_to_sql() {
        let f = LdapFilter::parse("(&(objectClass=user)(mail=*@example.com))").unwrap();
        let (sql, params) = f.to_sql(0);
        assert!(sql.contains("AND"));
        assert_eq!(params.len(), 2);
    }

    #[test]
    fn compile_presence_to_sql() {
        let f = LdapFilter::parse("(telephoneNumber=*)").unwrap();
        let (sql, params) = f.to_sql(0);
        assert_eq!(sql, "u.phone IS NOT NULL");
        assert!(params.is_empty());
    }

    #[test]
    fn unknown_attr_maps_to_jsonb() {
        let f = LdapFilter::parse("(homeDirectory=/home/test)").unwrap();
        let (sql, _) = f.to_sql(0);
        assert!(sql.contains("n.attributes"));
    }

    #[test]
    fn invalid_filter_errors() {
        assert!(LdapFilter::parse("").is_err());
        assert!(LdapFilter::parse("no parens").is_err());
        assert!(LdapFilter::parse("(missing-equals)").is_err());
    }
}
```

- [ ] **Step 2: Run tests**

Run: `rtk cargo test -p signapps-ad-core -- filter`
Expected: 12 tests PASS

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-ad-core/src/filter.rs
git commit -m "feat(ad-core): implement LDAP filter parser and SQL compiler (RFC 4515)"
```

---

### Task 11: Access control (acl.rs)

**Files:**
- Create: `crates/signapps-ad-core/src/acl.rs`

- [ ] **Step 1: Implement ACL checking**

```rust
//! Access control for directory operations.
//!
//! Checks whether a bound LDAP user has permission to perform an operation
//! on a target object. Uses the existing delegation and policy systems.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// The type of operation being checked.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AclOperation {
    /// Read attributes.
    Read,
    /// Write/modify attributes.
    Write,
    /// Create a new object.
    Create,
    /// Delete an object.
    Delete,
    /// Move an object (ModifyDN).
    Move,
}

/// The result of an access check.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AclDecision {
    /// Operation is allowed.
    Allow,
    /// Operation is denied.
    Deny,
}

/// Check access for an operation.
///
/// This is a simplified access model for the initial implementation:
/// 1. If the user is a domain admin (role >= 2), allow everything.
/// 2. Otherwise, default deny for write/create/delete.
/// 3. Allow read for all authenticated users.
///
/// Future versions will resolve `workforce_org_delegations` for the
/// target node's scope and check granular permissions.
pub fn check_access(
    user_role: i16,
    operation: AclOperation,
    _target_node_id: Option<Uuid>,
) -> AclDecision {
    // Domain admins can do everything
    if user_role >= 2 {
        return AclDecision::Allow;
    }

    // Regular users: read-only
    match operation {
        AclOperation::Read => AclDecision::Allow,
        _ => AclDecision::Deny,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn admin_can_do_everything() {
        let node = Some(Uuid::new_v4());
        assert_eq!(check_access(2, AclOperation::Read, node), AclDecision::Allow);
        assert_eq!(check_access(2, AclOperation::Write, node), AclDecision::Allow);
        assert_eq!(check_access(2, AclOperation::Create, node), AclDecision::Allow);
        assert_eq!(check_access(2, AclOperation::Delete, node), AclDecision::Allow);
        assert_eq!(check_access(3, AclOperation::Delete, node), AclDecision::Allow);
    }

    #[test]
    fn regular_user_read_only() {
        let node = Some(Uuid::new_v4());
        assert_eq!(check_access(1, AclOperation::Read, node), AclDecision::Allow);
        assert_eq!(check_access(1, AclOperation::Write, node), AclDecision::Deny);
        assert_eq!(check_access(1, AclOperation::Create, node), AclDecision::Deny);
        assert_eq!(check_access(1, AclOperation::Delete, node), AclDecision::Deny);
    }
}
```

- [ ] **Step 2: Run tests**

Run: `rtk cargo test -p signapps-ad-core -- acl`
Expected: 2 tests PASS

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-ad-core/src/acl.rs
git commit -m "feat(ad-core): implement simplified ACL checking for directory operations"
```

---

### Task 12: Final integration — verify everything compiles and passes

- [ ] **Step 1: Update lib.rs with complete re-exports**

Verify `crates/signapps-ad-core/src/lib.rs` has all public exports:

```rust
//! Active Directory core data layer.
//!
//! Provides the foundational types and abstractions for mapping PostgreSQL
//! tables (org-structure, identity, groups) to Active Directory concepts.
//! All protocol servers (LDAP, Kerberos, DNS) depend on this crate —
//! they never access the database directly.

pub mod acl;
pub mod dn;
pub mod entry;
pub mod filter;
pub mod guid;
pub mod schema;
pub mod sid;
pub mod uac;

pub use acl::{AclDecision, AclOperation};
pub use dn::DistinguishedName;
pub use entry::{DirectoryEntry, LifecycleState};
pub use filter::LdapFilter;
pub use guid::ObjectGuid;
pub use schema::syntax::AttributeValue;
pub use sid::SecurityIdentifier;
pub use uac::UserAccountControl;
```

- [ ] **Step 2: Run full test suite**

Run: `rtk cargo test -p signapps-ad-core`
Expected: All tests PASS (9 dn + 8 sid + 3 guid + 5 uac + 6 schema + 5 entry + 12 filter + 2 acl = ~50 tests)

- [ ] **Step 3: Run clippy**

Run: `rtk cargo clippy -p signapps-ad-core -- -D warnings`
Expected: 0 errors, 0 warnings

- [ ] **Step 4: Run full workspace check**

Run: `rtk cargo check -p signapps-ad-core -p signapps-db`
Expected: 0 errors

- [ ] **Step 5: Final commit**

```bash
git add crates/signapps-ad-core/src/lib.rs
git commit -m "feat(ad-core): complete Phase 1 — all modules integrated and tested"
```
