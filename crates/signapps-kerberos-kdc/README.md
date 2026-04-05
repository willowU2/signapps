# signapps-kerberos-kdc

Kerberos Key Distribution Center implementation (RFC 4120 / MS-KILE) for the
SignApps Domain Controller.

Handles Authentication Service (AS-REQ) and Ticket Granting Service (TGS-REQ)
requests. Generates Windows-compatible PAC structures embedded in tickets.

## Features

- AS-REQ / TGS-REQ handlers (RFC 4120)
- S4U2Self / S4U2Proxy constrained delegation stubs
- kpasswd (port 464) password change protocol
- AES-CTS-HMAC-SHA1-96 (etypes 17 and 18)
- RC4-HMAC (etype 23) for Windows legacy compatibility
- Key derivation (string-to-key, derive-key)
- HMAC-SHA1 and MD5 checksums
- Privilege Attribute Certificate (MS-PAC) generation
- Keytab file management (MIT format)
- UDP and TCP listeners on port 88

## Module Structure

| Module | Description |
|--------|-------------|
| `asn1` | ASN.1 DER codec and Kerberos message types |
| `crypto` | AES-CTS, RC4-HMAC, key derivation, checksums |
| `pac` | MS-PAC: SIDs, group memberships, domain info |
| `handlers` | AS-REQ, TGS-REQ, S4U, kpasswd handlers |
| `keytab` | Keytab read/write (MIT format) |
| `listener` | UDP/TCP listener (`KdcListener`, `KdcListenerConfig`) |

## Quick Start

```rust
use signapps_kerberos_kdc::listener::{KdcListener, KdcListenerConfig};

let config = KdcListenerConfig {
    kdc_addr: "0.0.0.0:88".parse().unwrap(),
    kpasswd_addr: "0.0.0.0:464".parse().unwrap(),
    max_udp_size: 65535,
};
let listener = KdcListener::new(config);
// listener.run(pool, shutdown_rx).await?;
```

## Testing

```bash
cargo test -p signapps-kerberos-kdc
```
