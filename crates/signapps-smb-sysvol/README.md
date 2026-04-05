# signapps-smb-sysvol

Minimal SMB2 server exposing SYSVOL and NETLOGON shares for Active Directory
Group Policy distribution to domain-joined Windows machines.

Only the SMB2 commands required for read-only GPO serving are implemented.
File storage is backed by `signapps-storage` (OpenDAL).

## Features

- SMB2 protocol: Negotiate, Session Setup, Tree Connect, Read, Query Directory, Query Info
- SYSVOL and NETLOGON share definitions
- Group Policy Object create, update, and enumeration
- TCP listener on port 445
- Read-only share enforcement
- OpenDAL-backed storage (local filesystem or S3)

## Supported SMB2 Commands

| Command | Code |
|---------|------|
| Negotiate | 0x0000 |
| SessionSetup | 0x0001 |
| Logoff | 0x0002 |
| TreeConnect | 0x0003 |
| TreeDisconnect | 0x0004 |
| Create | 0x0005 |
| Close | 0x0006 |
| Read | 0x0008 |
| QueryDirectory | 0x000E |
| QueryInfo | 0x0010 |

## Module Structure

| Module | Description |
|--------|-------------|
| `protocol` | SMB2 command codes, header framing, response helpers |
| `share` | `SmbShare` — SYSVOL/NETLOGON definitions and path resolution |
| `gpo` | Group Policy Object management |
| `listener` | TCP listener on port 445 |

## Quick Start

```rust
use signapps_smb_sysvol::share::SmbShare;
use std::path::PathBuf;

let sysvol = SmbShare {
    name: "SYSVOL".to_string(),
    path: PathBuf::from("/data/sysvol"),
    read_only: true,
    description: "Active Directory SYSVOL".to_string(),
};
```

## Testing

```bash
cargo test -p signapps-smb-sysvol
```
