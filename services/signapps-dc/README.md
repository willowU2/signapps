# signapps-dc

SignApps Domain Controller — multi-protocol Active Directory server.

Runs LDAP and Kerberos KDC listeners on a shared Tokio runtime with a single
PostgreSQL connection pool. DNS is delegated to `signapps-securelink`.

## Protocols

| Protocol | Port | Crate |
|----------|------|-------|
| LDAP | 389 | `signapps-ldap-server` |
| LDAPS | 636 | `signapps-ldap-server` |
| Kerberos KDC | 88 | `signapps-kerberos-kdc` |
| kpasswd | 464 | `signapps-kerberos-kdc` |
| Health HTTP | 3088 | internal |
| DNS | delegated | `signapps-securelink` |
| SMB/SYSVOL | 445 | `signapps-smb-sysvol` (separate process) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DC_DOMAIN` | `example.com` | DNS domain name |
| `DC_REALM` | `EXAMPLE.COM` | Kerberos realm (defaults to upper-case domain) |
| `DC_NETBIOS` | `EXAMPLE` | NetBIOS domain name |
| `DC_LDAP_PORT` | `389` | LDAP port |
| `DC_LDAPS_PORT` | `636` | LDAPS port |
| `DC_KDC_PORT` | `88` | Kerberos KDC port |
| `DC_KPASSWD_PORT` | `464` | kpasswd port |
| `DC_HEALTH_PORT` | `3088` | Health check HTTP port |
| `DC_REQUIRE_TLS` | `false` | Require TLS on LDAP connections |
| `DC_MAX_CLOCK_SKEW` | `300` | Max Kerberos clock skew (seconds) |
| `DATABASE_URL` | — | PostgreSQL connection string |

## Running

```bash
# Development
cargo run -p signapps-dc

# Via justfile
just run dc
```

## Health Check

```
GET http://localhost:3088/health
```
