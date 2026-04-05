# signapps-dns-server

Active Directory DNS integration layer for the SignApps Domain Controller.

DNS hosting is delegated to `signapps-securelink`. This crate provisions
AD-specific zones and SRV records on domain creation, and handles dynamic
update requests (RFC 2136) from domain-joined machines.

## Features

- Zone provisioning with required AD SRV records on domain creation
- A record for the DC
- Dynamic DNS update processing (RFC 2136) for machine account self-registration
- Upsert semantics — stale records scavenged by `AdDnsRepository::scavenge`
- Authenticated updates only (machine account required)

## SRV Records Provisioned

| Record | Purpose |
|--------|---------|
| `_ldap._tcp.<domain>` | LDAP service discovery |
| `_kerberos._tcp.<domain>` | Kerberos KDC discovery |
| `_gc._tcp.<domain>` | Global Catalog discovery |
| `_kpasswd._tcp.<domain>` | Password change service |

## Module Structure

| Module | Description |
|--------|-------------|
| `zone` | Zone model — creates forward zone with SRV + A records |
| `provision` | High-level AD domain provisioning |
| `dynamic` | RFC 2136 dynamic update processing |

## Quick Start

```rust,ignore
// Provision DNS when creating a new AD domain
signapps_dns_server::provision::provision_ad_domain(
    &pool,
    domain_id,
    "corp.example.com",
    "dc01",
    "192.168.1.10",
).await?;
```

## Testing

```bash
cargo test -p signapps-dns-server
```
