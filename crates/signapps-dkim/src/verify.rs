//! DKIM signature verification (RFC 6376).
//!
//! Verifies DKIM-Signature headers by fetching the public key from DNS
//! and validating the cryptographic signature.

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use rsa::pkcs1v15::VerifyingKey;
use rsa::pkcs8::DecodePublicKey;
use rsa::signature::Verifier;
use rsa::RsaPublicKey;
use sha2::Sha256;

use crate::canonicalize::{canonicalize_body_relaxed, canonicalize_header_relaxed};
use crate::sign::{parse_raw_headers, split_headers_body};
use crate::DnsResolver;

/// Result of a DKIM verification attempt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DkimResult {
    /// Signature verified successfully.
    Pass {
        /// The signing domain (`d=` tag).
        domain: String,
        /// The selector (`s=` tag).
        selector: String,
    },
    /// Signature verification failed.
    Fail {
        /// Human-readable reason for the failure.
        reason: String,
    },
    /// No DKIM-Signature header present in the message.
    None,
    /// A temporary error prevented verification (e.g. DNS timeout).
    TempError {
        /// Human-readable reason for the temporary error.
        reason: String,
    },
}

/// DKIM signature verifier.
///
/// Stateless — all state is derived from the message and DNS lookups.
///
/// # Examples
///
/// ```no_run
/// use signapps_dkim::{DkimVerifier, MockDnsResolver};
///
/// # async fn example() {
/// let resolver = MockDnsResolver::new();
/// let msg = b"DKIM-Signature: ...\r\nFrom: a@b.com\r\n\r\nBody";
/// let result = DkimVerifier::verify(msg, &resolver).await;
/// # }
/// ```
pub struct DkimVerifier;

impl DkimVerifier {
    /// Verify the DKIM-Signature on a message.
    ///
    /// If the message contains no `DKIM-Signature` header, returns [`DkimResult::None`].
    /// On DNS errors, returns [`DkimResult::TempError`].
    ///
    /// # Errors
    ///
    /// This method does not return `Result` — all outcomes are encoded in [`DkimResult`].
    ///
    /// # Panics
    ///
    /// None.
    pub async fn verify(message: &[u8], dns: &dyn DnsResolver) -> DkimResult {
        let msg_str = match std::str::from_utf8(message) {
            Ok(s) => s,
            Err(e) => {
                return DkimResult::Fail {
                    reason: format!("non-UTF-8 message: {e}"),
                }
            },
        };

        let (header_section, body) = match split_headers_body(msg_str) {
            Ok(pair) => pair,
            Err(e) => {
                return DkimResult::Fail {
                    reason: format!("cannot parse message: {e}"),
                }
            },
        };

        let headers = parse_raw_headers(header_section);

        // Find the DKIM-Signature header
        let dkim_header = headers
            .iter()
            .find(|h| h.to_lowercase().starts_with("dkim-signature:"));

        let dkim_header = match dkim_header {
            Some(h) => *h,
            None => return DkimResult::None,
        };

        // Parse the DKIM-Signature tag-value pairs
        let tags = parse_dkim_tags(dkim_header);

        let domain = match tags.get("d") {
            Some(d) => d.clone(),
            None => {
                return DkimResult::Fail {
                    reason: "missing d= tag".to_string(),
                }
            },
        };

        let selector = match tags.get("s") {
            Some(s) => s.clone(),
            None => {
                return DkimResult::Fail {
                    reason: "missing s= tag".to_string(),
                }
            },
        };

        let algorithm = tags.get("a").map(|s| s.as_str()).unwrap_or("rsa-sha256");

        let body_hash_expected = match tags.get("bh") {
            Some(bh) => bh.clone(),
            None => {
                return DkimResult::Fail {
                    reason: "missing bh= tag".to_string(),
                }
            },
        };

        let signature_b64 = match tags.get("b") {
            Some(b) => b.clone(),
            None => {
                return DkimResult::Fail {
                    reason: "missing b= tag".to_string(),
                }
            },
        };

        let signed_headers_tag = match tags.get("h") {
            Some(h) => h.clone(),
            None => {
                return DkimResult::Fail {
                    reason: "missing h= tag".to_string(),
                }
            },
        };

        // Step 1: verify body hash
        let canon_body = canonicalize_body_relaxed(body.as_bytes());
        {
            use sha2::{Digest, Sha256 as Sha256Hash};
            let computed_hash = Sha256Hash::digest(&canon_body);
            let computed_b64 = BASE64.encode(computed_hash);
            if computed_b64 != body_hash_expected {
                return DkimResult::Fail {
                    reason: format!(
                        "body hash mismatch: expected {body_hash_expected}, got {computed_b64}"
                    ),
                };
            }
        }

        // Step 2: reconstruct data that was signed
        let signed_header_names: Vec<&str> =
            signed_headers_tag.split(':').map(|s| s.trim()).collect();
        let mut data_to_verify = String::new();

        for name in &signed_header_names {
            let name_lower = name.to_lowercase();
            if let Some(raw) = headers
                .iter()
                .rev()
                .find(|h| {
                    h.split(':')
                        .next()
                        .is_some_and(|n| n.trim().to_lowercase() == name_lower)
                })
                .copied()
            {
                data_to_verify.push_str(&canonicalize_header_relaxed(raw));
                data_to_verify.push_str("\r\n");
            }
        }

        // The DKIM-Signature header with b= value removed (empty)
        let dkim_header_without_b = remove_b_value(dkim_header);
        data_to_verify.push_str(&canonicalize_header_relaxed(&dkim_header_without_b));

        // Step 3: fetch public key from DNS
        let dns_name = format!("{selector}._domainkey.{domain}");
        let txt_records = match dns.txt_lookup(&dns_name).await {
            Ok(records) => records,
            Err(crate::DnsError::NotFound(_)) => {
                return DkimResult::Fail {
                    reason: format!("DKIM key not found in DNS: {dns_name}"),
                }
            },
            Err(e) => {
                return DkimResult::TempError {
                    reason: format!("DNS error looking up {dns_name}: {e}"),
                }
            },
        };

        let public_key_b64 = match extract_public_key(&txt_records) {
            Some(k) => k,
            None => {
                return DkimResult::Fail {
                    reason: format!("no valid DKIM public key in DNS record for {dns_name}"),
                }
            },
        };

        // Step 4: verify the signature
        let signature_bytes = match BASE64.decode(signature_b64.replace([' ', '\t'], "")) {
            Ok(b) => b,
            Err(e) => {
                return DkimResult::Fail {
                    reason: format!("invalid base64 in b= tag: {e}"),
                }
            },
        };

        let public_key_bytes = match BASE64.decode(public_key_b64.replace([' ', '\t'], "")) {
            Ok(b) => b,
            Err(e) => {
                return DkimResult::Fail {
                    reason: format!("invalid base64 in DNS public key: {e}"),
                }
            },
        };

        match algorithm {
            "rsa-sha256" => verify_rsa_sha256(
                &public_key_bytes,
                data_to_verify.as_bytes(),
                &signature_bytes,
            )
            .map_or_else(
                |reason| DkimResult::Fail { reason },
                |()| DkimResult::Pass { domain, selector },
            ),
            "ed25519-sha256" => verify_ed25519_sha256(
                &public_key_bytes,
                data_to_verify.as_bytes(),
                &signature_bytes,
            )
            .map_or_else(
                |reason| DkimResult::Fail { reason },
                |()| DkimResult::Pass { domain, selector },
            ),
            other => DkimResult::Fail {
                reason: format!("unsupported algorithm: {other}"),
            },
        }
    }
}

/// Verify an RSA-SHA256 signature.
fn verify_rsa_sha256(public_key_der: &[u8], data: &[u8], signature: &[u8]) -> Result<(), String> {
    let rsa_public = RsaPublicKey::from_public_key_der(public_key_der)
        .map_err(|e| format!("invalid RSA public key: {e}"))?;
    let verifying_key = VerifyingKey::<Sha256>::new(rsa_public);
    let sig = rsa::pkcs1v15::Signature::try_from(signature)
        .map_err(|e| format!("invalid RSA signature format: {e}"))?;
    verifying_key
        .verify(data, &sig)
        .map_err(|e| format!("RSA signature verification failed: {e}"))
}

/// Verify an Ed25519-SHA256 signature.
fn verify_ed25519_sha256(
    public_key_bytes: &[u8],
    data: &[u8],
    signature: &[u8],
) -> Result<(), String> {
    let key_bytes: [u8; 32] = public_key_bytes
        .try_into()
        .map_err(|_| "Ed25519 public key must be 32 bytes".to_string())?;
    let verifying_key = ed25519_dalek::VerifyingKey::from_bytes(&key_bytes)
        .map_err(|e| format!("invalid Ed25519 public key: {e}"))?;
    let sig_bytes: [u8; 64] = signature
        .try_into()
        .map_err(|_| "Ed25519 signature must be 64 bytes".to_string())?;
    let sig = ed25519_dalek::Signature::from_bytes(&sig_bytes);
    use ed25519_dalek::Verifier as _;
    verifying_key
        .verify(data, &sig)
        .map_err(|e| format!("Ed25519 signature verification failed: {e}"))
}

/// Parse DKIM-Signature tag=value pairs.
fn parse_dkim_tags(header: &str) -> std::collections::HashMap<String, String> {
    let mut tags = std::collections::HashMap::new();

    // Strip the "DKIM-Signature:" prefix
    let value = match header.find(':') {
        Some(pos) => &header[pos + 1..],
        None => return tags,
    };

    for pair in value.split(';') {
        let pair = pair.trim();
        if let Some(eq_pos) = pair.find('=') {
            let tag = pair[..eq_pos].trim().to_string();
            let val = pair[eq_pos + 1..].trim().to_string();
            tags.insert(tag, val);
        }
    }

    tags
}

/// Extract the public key (p= value) from DKIM DNS TXT records.
fn extract_public_key(records: &[String]) -> Option<String> {
    for record in records {
        // Look for p= tag
        for pair in record.split(';') {
            let pair = pair.trim();
            if let Some(stripped) = pair.strip_prefix("p=") {
                let key = stripped.trim();
                if !key.is_empty() {
                    return Some(key.to_string());
                }
            }
        }
    }
    None
}

/// Remove the `b=` value from a DKIM-Signature header (set it to empty).
///
/// This is needed during verification: the signature was computed over the
/// header with an empty `b=`.
fn remove_b_value(header: &str) -> String {
    // Find "b=" that is the signature (not "bh=")
    let mut result = String::with_capacity(header.len());
    let mut remaining = header;

    loop {
        if let Some(pos) = remaining.find("b=") {
            // Make sure this is not "bh="
            let before = if pos > 0 {
                remaining.as_bytes()[pos - 1]
            } else {
                b';'
            };
            if before == b'b' {
                // This is "bh=", skip past it
                result.push_str(&remaining[..pos + 2]);
                remaining = &remaining[pos + 2..];
                continue;
            }

            // Found the real b= tag — keep "b=" and remove everything until the next ";"
            result.push_str(&remaining[..pos + 2]);
            let after = &remaining[pos + 2..];
            if let Some(semi) = after.find(';') {
                remaining = &after[semi..];
            } else {
                // b= is the last tag
                remaining = "";
            }
        } else {
            result.push_str(remaining);
            break;
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::MockDnsResolver;

    #[test]
    fn test_parse_dkim_tags() {
        let header =
            "DKIM-Signature: v=1; a=rsa-sha256; d=example.com; s=sel; bh=abc; b=xyz; h=from:to";
        let tags = parse_dkim_tags(header);
        assert_eq!(tags.get("v").unwrap(), "1");
        assert_eq!(tags.get("a").unwrap(), "rsa-sha256");
        assert_eq!(tags.get("d").unwrap(), "example.com");
        assert_eq!(tags.get("s").unwrap(), "sel");
        assert_eq!(tags.get("h").unwrap(), "from:to");
    }

    #[test]
    fn test_extract_public_key() {
        let records = vec!["v=DKIM1; k=rsa; p=MIGfMA0GCS".to_string()];
        let key = extract_public_key(&records);
        assert_eq!(key, Some("MIGfMA0GCS".to_string()));
    }

    #[test]
    fn test_remove_b_value() {
        let header = "DKIM-Signature: v=1; bh=abc123; b=signaturedata; h=from";
        let result = remove_b_value(header);
        assert!(result.contains("b=;") || result.contains("b= h=") || result.ends_with("b="));
        assert!(result.contains("bh=abc123"));
    }

    #[tokio::test]
    async fn test_dkim_sign_verify_round_trip_ed25519() {
        // Generate an Ed25519 key pair
        let (private_bytes, dns_txt) = crate::generate_ed25519();

        // Extract public key from DNS TXT value
        let p_value = dns_txt.strip_prefix("v=DKIM1; k=ed25519; p=").unwrap();

        // Create signer and sign a message
        let signer = crate::DkimSigner::new_ed25519(&private_bytes, "sel1", "example.com").unwrap();
        let message = b"From: alice@example.com\r\nTo: bob@example.com\r\nSubject: Test\r\n\r\nHello World\r\n";
        let signed = signer.sign(message).unwrap();

        // Set up mock DNS with the public key
        let mut resolver = MockDnsResolver::new();
        resolver.add_txt(
            "sel1._domainkey.example.com",
            &format!("v=DKIM1; k=ed25519; p={p_value}"),
        );

        // Verify
        let result = DkimVerifier::verify(&signed, &resolver).await;
        match result {
            DkimResult::Pass { domain, selector } => {
                assert_eq!(domain, "example.com");
                assert_eq!(selector, "sel1");
            },
            other => panic!("expected Pass, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn test_dkim_verify_tampered_message_fails() {
        // Generate an Ed25519 key pair
        let (private_bytes, dns_txt) = crate::generate_ed25519();
        let p_value = dns_txt.strip_prefix("v=DKIM1; k=ed25519; p=").unwrap();

        // Sign a message
        let signer = crate::DkimSigner::new_ed25519(&private_bytes, "sel1", "example.com").unwrap();
        let message = b"From: alice@example.com\r\nTo: bob@example.com\r\nSubject: Test\r\n\r\nHello World\r\n";
        let signed = signer.sign(message).unwrap();

        // Tamper with the body
        let mut tampered = signed.clone();
        // Find the body and modify it
        let body_marker = b"\r\n\r\n";
        if let Some(pos) = tampered.windows(4).position(|w| w == body_marker) {
            // Modify a byte in the body
            if pos + 5 < tampered.len() {
                tampered[pos + 4] = b'X';
            }
        }

        // Set up mock DNS
        let mut resolver = MockDnsResolver::new();
        resolver.add_txt(
            "sel1._domainkey.example.com",
            &format!("v=DKIM1; k=ed25519; p={p_value}"),
        );

        // Verification should fail (body hash mismatch)
        let result = DkimVerifier::verify(&tampered, &resolver).await;
        match result {
            DkimResult::Fail { reason } => {
                assert!(
                    reason.contains("body hash mismatch") || reason.contains("verification failed"),
                    "unexpected fail reason: {reason}"
                );
            },
            other => panic!("expected Fail, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn test_dkim_no_signature_returns_none() {
        let resolver = MockDnsResolver::new();
        let message = b"From: alice@example.com\r\n\r\nHello";
        let result = DkimVerifier::verify(message, &resolver).await;
        assert_eq!(result, DkimResult::None);
    }
}
