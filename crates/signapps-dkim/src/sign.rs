//! DKIM message signing (RFC 6376).
//!
//! Supports RSA-SHA256 and Ed25519-SHA256 algorithms.
//! Messages are canonicalized using the relaxed/relaxed method.

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use chrono::Utc;
use rsa::pkcs1v15::SigningKey as RsaSigningKey;
use rsa::pkcs8::DecodePrivateKey;
use rsa::signature::SignatureEncoding;
use rsa::signature::Signer;
use rsa::RsaPrivateKey;
use sha2::Sha256;

use crate::canonicalize::{canonicalize_body_relaxed, canonicalize_header_relaxed};
use crate::DkimError;

/// Supported DKIM signing algorithms.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DkimAlgorithm {
    /// RSA with SHA-256 (RFC 6376).
    RsaSha256,
    /// Ed25519 with SHA-256 (RFC 8463).
    Ed25519Sha256,
}

impl DkimAlgorithm {
    /// Return the algorithm tag value used in DKIM-Signature headers.
    fn tag_value(self) -> &'static str {
        match self {
            Self::RsaSha256 => "rsa-sha256",
            Self::Ed25519Sha256 => "ed25519-sha256",
        }
    }
}

/// Internal representation of a signing key (RSA or Ed25519).
#[derive(Debug)]
enum SigningKey {
    Rsa(Box<RsaSigningKey<Sha256>>),
    Ed25519(Box<ed25519_dalek::SigningKey>),
}

/// DKIM message signer.
///
/// Holds a private key, selector, and domain. Call [`DkimSigner::sign`] to produce
/// a signed message with a prepended `DKIM-Signature` header.
///
/// # Examples
///
/// ```no_run
/// use signapps_dkim::{DkimSigner, DkimAlgorithm};
///
/// let pem = std::fs::read_to_string("private.pem").unwrap();
/// let signer = DkimSigner::new_rsa(&pem, "sel1", "example.com").unwrap();
/// let signed = signer.sign(b"From: a@example.com\r\n\r\nHello").unwrap();
/// ```
#[derive(Debug)]
pub struct DkimSigner {
    private_key: SigningKey,
    /// DKIM selector (appears in DNS as `<selector>._domainkey.<domain>`).
    selector: String,
    /// Signing domain (the `d=` tag).
    domain: String,
    /// Algorithm used for signing.
    algorithm: DkimAlgorithm,
}

impl DkimSigner {
    /// Create a signer using an RSA private key in PEM (PKCS#8) format.
    ///
    /// # Errors
    ///
    /// Returns [`DkimError::InvalidKey`] if the PEM cannot be parsed.
    ///
    /// # Panics
    ///
    /// None.
    pub fn new_rsa(pem_key: &str, selector: &str, domain: &str) -> Result<Self, DkimError> {
        let rsa_key = RsaPrivateKey::from_pkcs8_pem(pem_key)
            .map_err(|e| DkimError::InvalidKey(format!("RSA PEM parse error: {e}")))?;
        let signing_key = RsaSigningKey::<Sha256>::new(rsa_key);
        Ok(Self {
            private_key: SigningKey::Rsa(Box::new(signing_key)),
            selector: selector.to_string(),
            domain: domain.to_string(),
            algorithm: DkimAlgorithm::RsaSha256,
        })
    }

    /// Create a signer using a raw Ed25519 private key (32 bytes).
    ///
    /// # Errors
    ///
    /// Returns [`DkimError::InvalidKey`] if the key bytes are not exactly 32 bytes.
    ///
    /// # Panics
    ///
    /// None.
    pub fn new_ed25519(key_bytes: &[u8], selector: &str, domain: &str) -> Result<Self, DkimError> {
        let secret_bytes: [u8; 32] = key_bytes
            .try_into()
            .map_err(|_| DkimError::InvalidKey("Ed25519 key must be exactly 32 bytes".into()))?;
        let signing_key = ed25519_dalek::SigningKey::from_bytes(&secret_bytes);
        Ok(Self {
            private_key: SigningKey::Ed25519(Box::new(signing_key)),
            selector: selector.to_string(),
            domain: domain.to_string(),
            algorithm: DkimAlgorithm::Ed25519Sha256,
        })
    }

    /// Sign a complete RFC 5322 message and return the message with a prepended
    /// `DKIM-Signature` header.
    ///
    /// The message must contain headers and body separated by `\r\n\r\n`.
    ///
    /// # Errors
    ///
    /// Returns [`DkimError::InvalidMessage`] if headers/body cannot be split, or
    /// [`DkimError::CryptoError`] if signing fails.
    ///
    /// # Panics
    ///
    /// None.
    pub fn sign(&self, message: &[u8]) -> Result<Vec<u8>, DkimError> {
        let msg_str = std::str::from_utf8(message)
            .map_err(|e| DkimError::InvalidMessage(format!("non-UTF-8 message: {e}")))?;

        // Split headers from body
        let (header_section, body) = split_headers_body(msg_str)?;

        // Parse individual headers
        let headers = parse_raw_headers(header_section);

        // Pick which headers to sign (standard set)
        let signed_header_names = select_headers_to_sign(&headers);

        // Step 1-2: canonicalize body (relaxed)
        let canon_body = canonicalize_body_relaxed(body.as_bytes());

        // Step 3: compute body hash
        use sha2::{Digest, Sha256 as Sha256Hash};
        let body_hash = Sha256Hash::digest(&canon_body);
        let body_hash_b64 = BASE64.encode(body_hash);

        // Step 4: build DKIM-Signature header value (with empty b=)
        let timestamp = Utc::now().timestamp();
        let dkim_value = format!(
            "v=1; a={}; c=relaxed/relaxed; d={}; s={}; t={}; h={}; bh={}; b=",
            self.algorithm.tag_value(),
            self.domain,
            self.selector,
            timestamp,
            signed_header_names.join(":"),
            body_hash_b64,
        );
        let dkim_header = format!("DKIM-Signature: {dkim_value}");

        // Step 5: canonicalize the signed headers + DKIM-Signature header
        let mut data_to_sign = String::new();
        for name in &signed_header_names {
            // Find the corresponding header (case-insensitive, last occurrence)
            if let Some(raw) = find_header(&headers, name) {
                data_to_sign.push_str(&canonicalize_header_relaxed(raw));
                data_to_sign.push_str("\r\n");
            }
        }
        // The DKIM-Signature header itself (without trailing CRLF per RFC 6376 §3.7)
        data_to_sign.push_str(&canonicalize_header_relaxed(&dkim_header));

        // Step 6: compute the signature
        let signature_bytes = self.sign_data(data_to_sign.as_bytes())?;
        let signature_b64 = BASE64.encode(signature_bytes);

        // Step 7: build the final DKIM-Signature header with b= filled in
        let final_dkim_header = format!("DKIM-Signature: {dkim_value}{signature_b64}");

        // Prepend the DKIM-Signature to the original message
        let mut result = Vec::with_capacity(final_dkim_header.len() + 2 + message.len());
        result.extend_from_slice(final_dkim_header.as_bytes());
        result.extend_from_slice(b"\r\n");
        result.extend_from_slice(message);

        Ok(result)
    }

    /// Sign raw bytes with the held private key.
    fn sign_data(&self, data: &[u8]) -> Result<Vec<u8>, DkimError> {
        match &self.private_key {
            SigningKey::Rsa(key) => {
                let signature = key.sign(data);
                Ok(signature.to_vec())
            },
            SigningKey::Ed25519(key) => {
                use ed25519_dalek::Signer as _;
                let signature = key.sign(data);
                Ok(signature.to_bytes().to_vec())
            },
        }
    }
}

/// Select which headers to include in the DKIM signature.
///
/// Returns lowercase header names present in the message, from the standard set.
fn select_headers_to_sign(headers: &[&str]) -> Vec<String> {
    let wanted = [
        "from",
        "to",
        "subject",
        "date",
        "message-id",
        "content-type",
        "mime-version",
        "reply-to",
        "cc",
    ];

    let present: Vec<String> = headers
        .iter()
        .filter_map(|h| {
            let name = h.split(':').next()?.trim().to_lowercase();
            if wanted.contains(&name.as_str()) {
                Some(name)
            } else {
                None
            }
        })
        .collect();

    // Deduplicate while preserving order
    let mut seen = Vec::new();
    for name in present {
        if !seen.contains(&name) {
            seen.push(name);
        }
    }
    seen
}

/// Find the raw header line matching `name` (case-insensitive).
/// Returns the last occurrence if multiple exist.
fn find_header<'a>(headers: &[&'a str], name: &str) -> Option<&'a str> {
    let name_lower = name.to_lowercase();
    headers
        .iter()
        .rev()
        .find(|h| {
            h.split(':')
                .next()
                .is_some_and(|n| n.trim().to_lowercase() == name_lower)
        })
        .copied()
}

/// Split an RFC 5322 message into header section and body.
pub(crate) fn split_headers_body(msg: &str) -> Result<(&str, &str), DkimError> {
    if let Some(pos) = msg.find("\r\n\r\n") {
        Ok((&msg[..pos], &msg[pos + 4..]))
    } else if let Some(pos) = msg.find("\n\n") {
        // Be lenient with bare LF
        Ok((&msg[..pos], &msg[pos + 2..]))
    } else {
        // No body — entire message is headers
        Ok((msg, ""))
    }
}

/// Parse raw header section into individual header lines (handling folded headers).
pub(crate) fn parse_raw_headers(header_section: &str) -> Vec<&str> {
    // Simple approach: split on CRLF (or LF) boundaries that are NOT followed by WSP
    // For DKIM purposes we work with the raw lines.
    let mut headers = Vec::new();
    let mut start = 0;
    let bytes = header_section.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        if bytes[i] == b'\r' && i + 1 < len && bytes[i + 1] == b'\n' {
            // CRLF found — check if next char is WSP (folded header)
            if i + 2 < len && (bytes[i + 2] == b' ' || bytes[i + 2] == b'\t') {
                // Folded header, continue
                i += 2;
            } else {
                headers.push(&header_section[start..i]);
                start = i + 2;
                i += 2;
            }
        } else if bytes[i] == b'\n' {
            // Bare LF
            if i + 1 < len && (bytes[i + 1] == b' ' || bytes[i + 1] == b'\t') {
                i += 1;
            } else {
                headers.push(&header_section[start..i]);
                start = i + 1;
                i += 1;
            }
        } else {
            i += 1;
        }
    }

    // Remaining text after the last line break
    if start < len {
        headers.push(&header_section[start..]);
    }

    headers
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_headers_body() {
        let msg = "From: a@b.com\r\nSubject: Hi\r\n\r\nHello body";
        let (headers, body) = split_headers_body(msg).unwrap();
        assert_eq!(headers, "From: a@b.com\r\nSubject: Hi");
        assert_eq!(body, "Hello body");
    }

    #[test]
    fn test_parse_raw_headers() {
        let section = "From: a@b.com\r\nSubject: Hi\r\nTo: c@d.com";
        let headers = parse_raw_headers(section);
        assert_eq!(headers.len(), 3);
        assert_eq!(headers[0], "From: a@b.com");
    }

    #[test]
    fn test_select_headers_to_sign() {
        let headers = vec!["From: a@b.com", "Subject: Hi", "X-Custom: value"];
        let selected = select_headers_to_sign(&headers);
        assert!(selected.contains(&"from".to_string()));
        assert!(selected.contains(&"subject".to_string()));
        assert!(!selected.contains(&"x-custom".to_string()));
    }
}
