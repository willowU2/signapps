# signapps-ldap-server

Complete LDAP protocol server (RFC 4511) for the SignApps Domain Controller.

BER codec written from scratch. Supports all standard operations with TCP and
TLS listeners. Directory queries are resolved through `signapps-ad-core`.

## Features

- BER encoder/decoder written from scratch (no external ASN.1 library)
- All RFC 4511 operations: Bind, Search, Add, Modify, Delete, ModifyDN, Compare, Extended
- Simple Bind with Argon2 password verification
- SASL/GSSAPI stub for Kerberos integration (Phase 3)
- StartTLS (Extended operation OID 1.3.6.1.4.1.1466.20037)
- LDAP filter → SQL compilation via `signapps-ad-core`
- ACL enforcement on all write operations
- Per-connection session state (bound DN, auth method, TLS flag)
- TCP listener with configurable max connections

## Module Structure

| Module | Description |
|--------|-------------|
| `codec` | BER encoder/decoder and LDAP message types |
| `connection` | Per-connection dispatcher and message framing |
| `listener` | TCP/TLS listener (`LdapListener`, `LdapListenerConfig`) |
| `ops` | Bind, Search, Add/Modify/Delete/ModifyDN, Compare, Extended |
| `session` | `LdapSession` — connection state |

## Quick Start

```rust
use signapps_ldap_server::listener::{LdapListener, LdapListenerConfig};

let config = LdapListenerConfig {
    ldap_addr: "0.0.0.0:389".parse().unwrap(),
    ldaps_addr: Some("0.0.0.0:636".parse().unwrap()),
    max_connections: 1024,
};
let listener = LdapListener::new(config);
// listener.run(pool, shutdown_rx).await?;
```

## Testing

```bash
cargo test -p signapps-ldap-server
```
