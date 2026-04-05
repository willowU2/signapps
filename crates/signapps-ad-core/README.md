# signapps-ad-core

Active Directory core data layer for the SignApps Domain Controller.

Maps PostgreSQL tables (org-structure, identity, groups) to Active Directory
concepts. All protocol servers (LDAP, Kerberos, DNS) depend on this crate —
they never access the database directly.

## Features

- DN parsing and building (RFC 4514)
- Security Identifier (SID) generation and binary encoding
- ObjectGUID UUID ↔ AD mixed-endian format
- `userAccountControl` bit flags (MS-ADTS §2.2.16)
- objectClass and attribute schema registry
- LDAP filter parser and SQL compiler (RFC 4515)
- `DirectoryEntry` — unified runtime AD object
- Builder for constructing entries from PostgreSQL rows
- Role-based access control (`AclOperation` / `AclDecision`)
- AD domain lifecycle management
- Key derivation helpers (AES-256, NT hash)

## Module Structure

| Module | Description |
|--------|-------------|
| `dn` | `DistinguishedName`, `RdnComponent`, `DnBuilder` |
| `sid` | `SecurityIdentifier` |
| `guid` | `ObjectGuid` |
| `uac` | `UserAccountControl` |
| `schema` | Attribute and object class registry |
| `filter` | `LdapFilter` → SQL compiler |
| `entry` | `DirectoryEntry`, `LifecycleState` |
| `builder` | DB → `DirectoryEntry` builder |
| `acl` | `check_access`, `AclOperation`, `AclDecision` |
| `domain` | Domain create / delete |
| `crypto_helpers` | Key derivation utilities |

## Quick Start

```rust
use signapps_ad_core::{DistinguishedName, UserAccountControl};

let dn = DistinguishedName::parse("CN=Alice,OU=Users,DC=corp,DC=example,DC=com").unwrap();
assert_eq!(dn.domain_suffix(), "corp.example.com");

let uac = UserAccountControl::normal_user();
assert!(!uac.is_disabled());
```

## Testing

```bash
cargo test -p signapps-ad-core
```
