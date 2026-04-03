//! RSA and Ed25519 key pair generation for DKIM.
//!
//! Generates key pairs suitable for DKIM signing, along with the DNS TXT record
//! value needed to publish the public key.

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use ed25519_dalek::SigningKey as Ed25519SigningKey;
use rand::rngs::OsRng;
use rsa::pkcs8::{EncodePrivateKey, EncodePublicKey, LineEnding};
use rsa::RsaPrivateKey;

use crate::DkimError;

/// Generate a 2048-bit RSA key pair for DKIM signing.
///
/// Returns `(private_pem, dns_txt_value)`:
/// - `private_pem`: PKCS#8 PEM-encoded private key (for [`DkimSigner::new_rsa`](crate::DkimSigner::new_rsa))
/// - `dns_txt_value`: the value to publish in a TXT record at `<selector>._domainkey.<domain>`,
///   e.g. `v=DKIM1; k=rsa; p=MIIBIjAN...`
///
/// # Examples
///
/// ```
/// use signapps_dkim::generate_rsa_2048;
///
/// let (private_pem, dns_txt) = generate_rsa_2048().unwrap();
/// assert!(private_pem.contains("BEGIN PRIVATE KEY"));
/// assert!(dns_txt.starts_with("v=DKIM1; k=rsa; p="));
/// ```
///
/// # Errors
///
/// Returns [`DkimError::CryptoError`] if key generation fails.
///
/// # Panics
///
/// None.
pub fn generate_rsa_2048() -> Result<(String, String), DkimError> {
    let mut rng = OsRng;
    let private_key = RsaPrivateKey::new(&mut rng, 2048)
        .map_err(|e| DkimError::CryptoError(format!("RSA key generation failed: {e}")))?;

    let private_pem = private_key
        .to_pkcs8_pem(LineEnding::LF)
        .map_err(|e| DkimError::CryptoError(format!("PEM encoding failed: {e}")))?;

    let public_key_der = private_key
        .to_public_key()
        .to_public_key_der()
        .map_err(|e| DkimError::CryptoError(format!("DER encoding failed: {e}")))?;

    let public_key_b64 = BASE64.encode(public_key_der.as_ref());
    let dns_txt = format!("v=DKIM1; k=rsa; p={public_key_b64}");

    Ok((private_pem.to_string(), dns_txt))
}

/// Generate an Ed25519 key pair for DKIM signing (RFC 8463).
///
/// Returns `(private_key_bytes, dns_txt_value)`:
/// - `private_key_bytes`: 32-byte raw secret key (for [`DkimSigner::new_ed25519`](crate::DkimSigner::new_ed25519))
/// - `dns_txt_value`: the value to publish in a TXT record, e.g. `v=DKIM1; k=ed25519; p=...`
///
/// # Examples
///
/// ```
/// use signapps_dkim::generate_ed25519;
///
/// let (private_bytes, dns_txt) = generate_ed25519();
/// assert_eq!(private_bytes.len(), 32);
/// assert!(dns_txt.starts_with("v=DKIM1; k=ed25519; p="));
/// ```
///
/// # Errors
///
/// This function is infallible.
///
/// # Panics
///
/// None.
pub fn generate_ed25519() -> (Vec<u8>, String) {
    let mut csprng = OsRng;
    let signing_key = Ed25519SigningKey::generate(&mut csprng);

    let private_bytes = signing_key.to_bytes().to_vec();
    let public_bytes = signing_key.verifying_key().to_bytes();
    let public_b64 = BASE64.encode(public_bytes);

    let dns_txt = format!("v=DKIM1; k=ed25519; p={public_b64}");

    (private_bytes, dns_txt)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rsa::pkcs8::DecodePrivateKey;

    #[test]
    fn test_generate_rsa_2048() {
        let (private_pem, dns_txt) = generate_rsa_2048().unwrap();
        assert!(private_pem.contains("BEGIN PRIVATE KEY"));
        assert!(private_pem.contains("END PRIVATE KEY"));
        assert!(dns_txt.starts_with("v=DKIM1; k=rsa; p="));
        // Verify the PEM can be parsed back
        assert!(
            rsa::RsaPrivateKey::from_pkcs8_pem(&private_pem).is_ok(),
            "generated PEM should be valid PKCS#8"
        );
    }

    #[test]
    fn test_generate_ed25519() {
        let (private_bytes, dns_txt) = generate_ed25519();
        assert_eq!(private_bytes.len(), 32);
        assert!(dns_txt.starts_with("v=DKIM1; k=ed25519; p="));
        // Verify the key can be used to create a signer
        let signing_key = ed25519_dalek::SigningKey::from_bytes(&private_bytes.try_into().unwrap());
        // Sign something to verify it works
        use ed25519_dalek::Signer;
        let _sig = signing_key.sign(b"test");
    }

    #[test]
    fn test_rsa_key_pair_round_trip() {
        let (private_pem, dns_txt) = generate_rsa_2048().unwrap();

        // Create a signer from the generated key
        let signer = crate::DkimSigner::new_rsa(&private_pem, "test", "example.com");
        assert!(
            signer.is_ok(),
            "generated RSA key should create a valid signer"
        );

        // Verify DNS TXT has valid base64
        let p_value = dns_txt.strip_prefix("v=DKIM1; k=rsa; p=").unwrap();
        let decoded = BASE64.decode(p_value);
        assert!(decoded.is_ok(), "DNS TXT p= value should be valid base64");
    }

    #[test]
    fn test_ed25519_key_pair_round_trip() {
        let (private_bytes, dns_txt) = generate_ed25519();

        // Create a signer from the generated key
        let signer = crate::DkimSigner::new_ed25519(&private_bytes, "test", "example.com");
        assert!(
            signer.is_ok(),
            "generated Ed25519 key should create a valid signer"
        );

        // Verify DNS TXT has valid base64
        let p_value = dns_txt.strip_prefix("v=DKIM1; k=ed25519; p=").unwrap();
        let decoded = BASE64.decode(p_value);
        assert!(decoded.is_ok(), "DNS TXT p= value should be valid base64");
    }
}
