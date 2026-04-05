//! Kerberos keytab file management.
//!
//! Keytab files store principal keys for service authentication.
//! Format: MIT keytab version 2 (0x05 0x02).

/// A keytab entry representing a principal key stored in a keytab file.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct KeytabEntry {
    /// Principal name (e.g. `HTTP/web.example.com` or `admin`).
    pub principal: String,
    /// Kerberos realm (e.g. `EXAMPLE.COM`).
    pub realm: String,
    /// Encryption type identifier (e.g. 18 = AES256-CTS-HMAC-SHA1-96, 23 = RC4-HMAC).
    pub enc_type: i32,
    /// Key version number (kvno).
    pub key_version: i32,
    /// Raw key material.
    pub key_data: Vec<u8>,
    /// Unix timestamp when the key was created.
    pub timestamp: u32,
}

/// Build a keytab file (MIT format version 2).
///
/// The produced byte sequence starts with the two-byte magic `[0x05, 0x02]`
/// followed by one length-prefixed record per entry.
///
/// # Format
///
/// `version(2)` + `records[]`
///
/// Each record: `size(4 BE)` + `component_count(2 BE)` + `realm(counted)` +
/// `components[](counted)` + `name_type(4 BE)` + `timestamp(4 BE)` +
/// `kvno(1)` + `key_type(2 BE)` + `key_length(2 BE)` + `key_data`
///
/// # Examples
///
/// ```
/// use signapps_kerberos_kdc::keytab::{build_keytab, KeytabEntry};
/// let entry = KeytabEntry {
///     principal: "HTTP/host.example.com".to_string(),
///     realm: "EXAMPLE.COM".to_string(),
///     enc_type: 18,
///     key_version: 1,
///     key_data: vec![0u8; 32],
///     timestamp: 1700000000,
/// };
/// let bytes = build_keytab(&[entry]);
/// assert_eq!(bytes[0], 0x05);
/// assert_eq!(bytes[1], 0x02);
/// ```
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub fn build_keytab(entries: &[KeytabEntry]) -> Vec<u8> {
    let mut data = Vec::new();

    // Version: 0x0502 (MIT keytab v2)
    data.push(0x05);
    data.push(0x02);

    for entry in entries {
        let mut record = Vec::new();

        // Number of components (principal name parts)
        let components: Vec<&str> = entry.principal.split('/').collect();
        record.extend_from_slice(&(components.len() as u16).to_be_bytes());

        // Realm (counted string)
        record.extend_from_slice(&(entry.realm.len() as u16).to_be_bytes());
        record.extend_from_slice(entry.realm.as_bytes());

        // Components (each is a counted string)
        for comp in &components {
            record.extend_from_slice(&(comp.len() as u16).to_be_bytes());
            record.extend_from_slice(comp.as_bytes());
        }

        // Name type (1 = KRB5_NT_PRINCIPAL, 2 = KRB5_NT_SRV_INST)
        let name_type: u32 = if components.len() > 1 { 2 } else { 1 };
        record.extend_from_slice(&name_type.to_be_bytes());

        // Timestamp
        record.extend_from_slice(&entry.timestamp.to_be_bytes());

        // Key version number (1 byte)
        record.push(entry.key_version as u8);

        // Key type (enc_type)
        record.extend_from_slice(&(entry.enc_type as u16).to_be_bytes());

        // Key data (counted)
        record.extend_from_slice(&(entry.key_data.len() as u16).to_be_bytes());
        record.extend_from_slice(&entry.key_data);

        // Write record size + record
        data.extend_from_slice(&(record.len() as u32).to_be_bytes());
        data.extend_from_slice(&record);
    }

    data
}

/// Parse a keytab file and extract entries.
///
/// # Errors
///
/// Returns an error string if the data does not start with the MIT keytab v2
/// magic bytes `[0x05, 0x02]` or if the input is shorter than 2 bytes.
///
/// # Examples
///
/// ```
/// use signapps_kerberos_kdc::keytab::{build_keytab, parse_keytab, KeytabEntry};
/// let entry = KeytabEntry {
///     principal: "krbtgt/EXAMPLE.COM".to_string(),
///     realm: "EXAMPLE.COM".to_string(),
///     enc_type: 18,
///     key_version: 1,
///     key_data: vec![0xAB; 32],
///     timestamp: 1700000000,
/// };
/// let bytes = build_keytab(&[entry]);
/// let parsed = parse_keytab(&bytes).unwrap();
/// assert_eq!(parsed.len(), 1);
/// ```
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub fn parse_keytab(data: &[u8]) -> Result<Vec<KeytabEntry>, String> {
    if data.len() < 2 || data[0] != 0x05 || data[1] != 0x02 {
        return Err("Invalid keytab version (expected 0x0502)".to_string());
    }

    let mut entries = Vec::new();
    let mut pos = 2;

    while pos < data.len() {
        if pos + 4 > data.len() {
            break;
        }
        let record_len =
            u32::from_be_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;

        if pos + record_len > data.len() {
            break;
        }
        let record = &data[pos..pos + record_len];
        pos += record_len;

        if record.len() < 10 {
            continue;
        }

        let mut rpos = 0;

        // Component count
        let comp_count = u16::from_be_bytes([record[rpos], record[rpos + 1]]) as usize;
        rpos += 2;

        if rpos + 2 > record.len() {
            continue;
        }

        // Realm
        let realm_len = u16::from_be_bytes([record[rpos], record[rpos + 1]]) as usize;
        rpos += 2;
        if rpos + realm_len > record.len() {
            continue;
        }
        let realm = String::from_utf8_lossy(&record[rpos..rpos + realm_len]).to_string();
        rpos += realm_len;

        // Components
        let mut components = Vec::new();
        for _ in 0..comp_count {
            if rpos + 2 > record.len() {
                break;
            }
            let comp_len = u16::from_be_bytes([record[rpos], record[rpos + 1]]) as usize;
            rpos += 2;
            if rpos + comp_len > record.len() {
                break;
            }
            components.push(String::from_utf8_lossy(&record[rpos..rpos + comp_len]).to_string());
            rpos += comp_len;
        }

        if rpos + 7 > record.len() {
            continue;
        }

        // Name type (4 bytes) — skip
        rpos += 4;

        // Timestamp
        let timestamp = u32::from_be_bytes([
            record[rpos],
            record[rpos + 1],
            record[rpos + 2],
            record[rpos + 3],
        ]);
        rpos += 4;

        // Kvno (1 byte)
        let kvno = record[rpos] as i32;
        rpos += 1;

        if rpos + 4 > record.len() {
            continue;
        }

        // Key type
        let enc_type = u16::from_be_bytes([record[rpos], record[rpos + 1]]) as i32;
        rpos += 2;

        // Key data
        let key_len = u16::from_be_bytes([record[rpos], record[rpos + 1]]) as usize;
        rpos += 2;
        let key_data = if rpos + key_len <= record.len() {
            record[rpos..rpos + key_len].to_vec()
        } else {
            vec![]
        };

        entries.push(KeytabEntry {
            principal: components.join("/"),
            realm,
            enc_type,
            key_version: kvno,
            key_data,
            timestamp,
        });
    }

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keytab_roundtrip() {
        let entries = vec![
            KeytabEntry {
                principal: "HTTP/web.example.com".to_string(),
                realm: "EXAMPLE.COM".to_string(),
                enc_type: 18,
                key_version: 1,
                key_data: vec![0x42; 32],
                timestamp: 1_700_000_000,
            },
            KeytabEntry {
                principal: "admin".to_string(),
                realm: "EXAMPLE.COM".to_string(),
                enc_type: 23,
                key_version: 2,
                key_data: vec![0x43; 16],
                timestamp: 1_700_000_000,
            },
        ];

        let keytab = build_keytab(&entries);
        assert_eq!(keytab[0], 0x05);
        assert_eq!(keytab[1], 0x02);

        let parsed = parse_keytab(&keytab).unwrap();
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].principal, "HTTP/web.example.com");
        assert_eq!(parsed[0].realm, "EXAMPLE.COM");
        assert_eq!(parsed[0].enc_type, 18);
        assert_eq!(parsed[0].key_data.len(), 32);
        assert_eq!(parsed[1].principal, "admin");
        assert_eq!(parsed[1].enc_type, 23);
    }

    #[test]
    fn keytab_version_check() {
        assert!(parse_keytab(&[0x05, 0x01]).is_err()); // Wrong version
        assert!(parse_keytab(&[0x05]).is_err()); // Too short
    }

    #[test]
    fn empty_keytab() {
        let keytab = build_keytab(&[]);
        assert_eq!(keytab, vec![0x05, 0x02]);
        let parsed = parse_keytab(&keytab).unwrap();
        assert!(parsed.is_empty());
    }
}
