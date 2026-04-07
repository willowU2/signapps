//! Server-side vault crypto helpers.
//!
//! This module intentionally performs NO client-side decryption.
//! The two utilities provided are:
//!   1. TOTP code generation from a server-known secret (for use_only browser proxy).
//!   2. Strong random password generation.

use rand::Rng;
use signapps_common::{Error, Result};

// TOTP generation delegates entirely to totp-rs (already a workspace dep).
// The hmac + sha1 raw computation is provided as an internal utility only.
use totp_rs::{Algorithm, Secret, TOTP};

/// Generate a 6-digit TOTP code from a base32-encoded secret.
///
/// Uses HMAC-SHA1 with 30-second step (RFC 6238 default), identical to
/// Google Authenticator / Bitwarden / 1Password behaviour.
///
/// # Errors
/// Returns `Error::BadRequest` if the secret is not valid base32.
pub fn generate_totp(secret_base32: &str) -> Result<String> {
    let secret_bytes = Secret::Encoded(secret_base32.to_owned())
        .to_bytes()
        .map_err(|e| Error::BadRequest(format!("Invalid TOTP secret: {}", e)))?;

    let totp = TOTP::new(
        Algorithm::SHA1,
        6,  // digits
        1,  // step multiplier
        30, // step seconds
        secret_bytes,
        Some("SignApps Vault".to_string()),
        "vault".to_string(),
    )
    .map_err(|e| Error::Internal(format!("TOTP init error: {}", e)))?;

    totp.generate_current()
        .map_err(|e| Error::Internal(format!("TOTP generation error: {}", e)))
}

/// Flags controlling the character classes included in a generated password.
#[derive(Debug, Clone)]
pub struct PasswordFlags {
    pub uppercase: bool,
    pub lowercase: bool,
    pub digits: bool,
    pub symbols: bool,
}

impl Default for PasswordFlags {
    fn default() -> Self {
        Self {
            uppercase: true,
            lowercase: true,
            digits: true,
            symbols: true,
        }
    }
}

/// Generate a cryptographically random password.
///
/// * `length` — number of characters (clamped to 4–128).
/// * `flags`  — which character classes to include (at least one must be set).
///
/// Guarantees at least one character from each requested class, then fills
/// the rest randomly from the combined alphabet.
pub fn generate_password(length: usize, flags: PasswordFlags) -> String {
    let length = length.clamp(4, 128);

    let mut alphabet = String::new();
    if flags.uppercase {
        alphabet.push_str("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    }
    if flags.lowercase {
        alphabet.push_str("abcdefghijklmnopqrstuvwxyz");
    }
    if flags.digits {
        alphabet.push_str("0123456789");
    }
    if flags.symbols {
        alphabet.push_str("!@#$%^&*()-_=+[]{}|;:,.<>?");
    }

    // Fallback: if no class selected, use full printable ASCII
    if alphabet.is_empty() {
        alphabet.push_str("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
    }

    let chars: Vec<char> = alphabet.chars().collect();
    let mut rng = rand::thread_rng();

    // Ensure at least one character from each selected class
    let mut required: Vec<char> = Vec::new();
    if flags.uppercase {
        required.push(sample_from(&mut rng, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"));
    }
    if flags.lowercase {
        required.push(sample_from(&mut rng, "abcdefghijklmnopqrstuvwxyz"));
    }
    if flags.digits {
        required.push(sample_from(&mut rng, "0123456789"));
    }
    if flags.symbols {
        required.push(sample_from(&mut rng, "!@#$%^&*()-_=+[]{}|;:,.<>?"));
    }

    // Fill remaining slots
    let remaining = length.saturating_sub(required.len());
    let mut password: Vec<char> = required;
    for _ in 0..remaining {
        let idx = rng.gen_range(0..chars.len());
        password.push(chars[idx]);
    }

    // Shuffle to avoid predictable position of the required chars
    use rand::seq::SliceRandom;
    password.shuffle(&mut rng);

    password.into_iter().collect()
}

fn sample_from(rng: &mut impl Rng, s: &str) -> char {
    let chars: Vec<char> = s.chars().collect();
    chars[rng.gen_range(0..chars.len())]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_password_length() {
        let pw = generate_password(16, PasswordFlags::default());
        assert_eq!(pw.len(), 16);
    }

    #[test]
    fn test_generate_password_clamp_min() {
        let pw = generate_password(1, PasswordFlags::default());
        assert_eq!(pw.len(), 4);
    }

    #[test]
    fn test_generate_password_clamp_max() {
        let pw = generate_password(999, PasswordFlags::default());
        assert_eq!(pw.len(), 128);
    }

    #[test]
    fn test_generate_password_contains_digit_when_requested() {
        for _ in 0..20 {
            let pw = generate_password(
                8,
                PasswordFlags {
                    uppercase: false,
                    lowercase: false,
                    digits: true,
                    symbols: false,
                },
            );
            assert!(pw.chars().all(|c| c.is_ascii_digit()), "password: {}", pw);
        }
    }

    #[test]
    fn test_generate_password_all_classes_present() {
        // With length 4 and all 4 classes, each class must appear at least once.
        let pw = generate_password(20, PasswordFlags::default());
        assert!(
            pw.chars().any(|c| c.is_ascii_uppercase()),
            "missing uppercase"
        );
        assert!(
            pw.chars().any(|c| c.is_ascii_lowercase()),
            "missing lowercase"
        );
        assert!(pw.chars().any(|c| c.is_ascii_digit()), "missing digit");
        assert!(
            pw.chars().any(|c| "!@#$%^&*()-_=+[]{}|;:,.<>?".contains(c)),
            "missing symbol"
        );
    }

    #[test]
    fn test_totp_invalid_secret() {
        let result = generate_totp("not-valid-base32!!!");
        assert!(result.is_err());
    }
}
