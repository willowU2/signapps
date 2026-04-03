//! SASL authentication mechanism parsers.
//!
//! Supports PLAIN (RFC 4616), LOGIN (draft), and XOAUTH2 (Google extension).
//! All functions operate on base64-encoded strings and return structured
//! credential types.

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;

use crate::parser::SmtpError;

/// Supported SASL mechanisms.
///
/// # Examples
///
/// ```
/// use signapps_smtp::SaslMechanism;
///
/// let mech = SaslMechanism::parse("PLAIN").unwrap();
/// assert_eq!(mech, SaslMechanism::Plain);
/// ```
#[derive(Debug, Clone, PartialEq)]
pub enum SaslMechanism {
    /// SASL PLAIN (RFC 4616): `\0authcid\0password` in one shot.
    Plain,
    /// SASL LOGIN: two-step username + password exchange.
    Login,
    /// XOAUTH2 (Google): `user=...\x01auth=Bearer ...\x01\x01`.
    XOAuth2,
}

impl SaslMechanism {
    /// Parse a mechanism name string.
    ///
    /// # Errors
    ///
    /// Returns [`SmtpError::UnsupportedMechanism`] if the name is not recognized.
    ///
    /// # Panics
    ///
    /// None.
    pub fn parse(s: &str) -> Result<Self, SmtpError> {
        match s.to_uppercase().as_str() {
            "PLAIN" => Ok(Self::Plain),
            "LOGIN" => Ok(Self::Login),
            "XOAUTH2" => Ok(Self::XOAuth2),
            other => Err(SmtpError::UnsupportedMechanism(other.to_string())),
        }
    }
}

/// Decoded SASL PLAIN credentials.
///
/// Per RFC 4616, the format is `[authzid]\0authcid\0password`.
#[derive(Debug, Clone, PartialEq)]
pub struct SaslPlainCredentials {
    /// Authorization identity (may be empty — defaults to authcid).
    pub authzid: String,
    /// Authentication identity (the username).
    pub authcid: String,
    /// The password.
    pub password: String,
}

/// Decode a SASL PLAIN initial response from base64.
///
/// The decoded format is `[authzid]\0authcid\0password` (three NUL-separated fields).
///
/// # Errors
///
/// Returns [`SmtpError::Base64Error`] if decoding fails.
/// Returns [`SmtpError::SyntaxError`] if the decoded data has an invalid structure.
///
/// # Panics
///
/// None.
///
/// # Examples
///
/// ```
/// use signapps_smtp::auth::decode_plain;
/// use base64::Engine;
///
/// // "\0testuser\0testpass"
/// let encoded = base64::engine::general_purpose::STANDARD
///     .encode(b"\0testuser\0testpass");
/// let creds = decode_plain(&encoded).unwrap();
/// assert_eq!(creds.authcid, "testuser");
/// assert_eq!(creds.password, "testpass");
/// ```
pub fn decode_plain(base64_response: &str) -> Result<SaslPlainCredentials, SmtpError> {
    let bytes = BASE64
        .decode(base64_response.trim())
        .map_err(|e| SmtpError::Base64Error(e.to_string()))?;

    // Format: authzid\0authcid\0password
    // Split on NUL bytes — we expect exactly 2 NUL separators yielding 3 parts
    let parts: Vec<&[u8]> = bytes.splitn(3, |&b| b == 0).collect();
    if parts.len() != 3 {
        return Err(SmtpError::SyntaxError(
            "PLAIN credentials must contain exactly two NUL separators".into(),
        ));
    }

    let authzid = String::from_utf8(parts[0].to_vec())
        .map_err(|_| SmtpError::SyntaxError("invalid UTF-8 in authzid".into()))?;
    let authcid = String::from_utf8(parts[1].to_vec())
        .map_err(|_| SmtpError::SyntaxError("invalid UTF-8 in authcid".into()))?;
    let password = String::from_utf8(parts[2].to_vec())
        .map_err(|_| SmtpError::SyntaxError("invalid UTF-8 in password".into()))?;

    if authcid.is_empty() {
        return Err(SmtpError::SyntaxError("authcid must not be empty".into()));
    }

    Ok(SaslPlainCredentials {
        authzid,
        authcid,
        password,
    })
}

/// Decode an XOAUTH2 initial response from base64.
///
/// The decoded format is `user=<email>\x01auth=Bearer <token>\x01\x01`.
/// Returns `(user, access_token)`.
///
/// # Errors
///
/// Returns [`SmtpError::Base64Error`] if decoding fails.
/// Returns [`SmtpError::SyntaxError`] if the decoded data has an invalid format.
///
/// # Panics
///
/// None.
///
/// # Examples
///
/// ```
/// use signapps_smtp::auth::decode_xoauth2;
/// use base64::Engine;
///
/// let payload = "user=user@example.com\x01auth=Bearer ya29.token\x01\x01";
/// let encoded = base64::engine::general_purpose::STANDARD.encode(payload);
/// let (user, token) = decode_xoauth2(&encoded).unwrap();
/// assert_eq!(user, "user@example.com");
/// assert_eq!(token, "ya29.token");
/// ```
pub fn decode_xoauth2(base64_response: &str) -> Result<(String, String), SmtpError> {
    let bytes = BASE64
        .decode(base64_response.trim())
        .map_err(|e| SmtpError::Base64Error(e.to_string()))?;

    let text = String::from_utf8(bytes)
        .map_err(|_| SmtpError::SyntaxError("invalid UTF-8 in XOAUTH2 response".into()))?;

    // Split on \x01 (SOH) character
    let mut user = None;
    let mut token = None;

    for part in text.split('\x01') {
        if part.is_empty() {
            continue;
        }
        if let Some(u) = part.strip_prefix("user=") {
            user = Some(u.to_string());
        } else if let Some(auth) = part.strip_prefix("auth=") {
            // Strip "Bearer " prefix if present
            let t = auth
                .strip_prefix("Bearer ")
                .unwrap_or(auth);
            token = Some(t.to_string());
        }
    }

    let user = user.ok_or_else(|| SmtpError::SyntaxError("missing user= in XOAUTH2".into()))?;
    let token =
        token.ok_or_else(|| SmtpError::SyntaxError("missing auth= in XOAUTH2".into()))?;

    Ok((user, token))
}

/// State of a LOGIN SASL exchange (two-step: username then password).
#[derive(Debug, Clone, PartialEq)]
pub enum LoginState {
    /// Waiting for the base64-encoded username.
    WaitingUsername,
    /// Waiting for the base64-encoded password; username already captured.
    WaitingPassword(String),
}

/// Result of a LOGIN SASL step.
#[derive(Debug, Clone, PartialEq)]
pub enum LoginNext {
    /// Need another response from the client. Contains the challenge to send
    /// and the next state to track.
    Challenge(String, LoginState),
    /// Authentication exchange is complete. Contains `(username, password)`.
    Done(String, String),
}

/// Process one step of a LOGIN SASL exchange.
///
/// LOGIN is a two-step mechanism:
/// 1. Server sends `334 VXNlcm5hbWU6` (base64 of "Username:"), client sends username.
/// 2. Server sends `334 UGFzc3dvcmQ6` (base64 of "Password:"), client sends password.
///
/// # Errors
///
/// Returns [`SmtpError::Base64Error`] if the client response is not valid base64.
/// Returns [`SmtpError::SyntaxError`] if the decoded value is not valid UTF-8.
///
/// # Panics
///
/// None.
///
/// # Examples
///
/// ```
/// use signapps_smtp::auth::{LoginState, LoginNext, decode_login_step};
/// use base64::Engine;
///
/// let username_b64 = base64::engine::general_purpose::STANDARD.encode("alice");
/// let state = LoginState::WaitingUsername;
/// let next = decode_login_step(&state, &username_b64).unwrap();
/// match next {
///     LoginNext::Challenge(challenge, new_state) => {
///         assert_eq!(challenge, "UGFzc3dvcmQ6"); // base64("Password:")
///         let password_b64 = base64::engine::general_purpose::STANDARD.encode("secret");
///         let final_step = decode_login_step(&new_state, &password_b64).unwrap();
///         match final_step {
///             LoginNext::Done(user, pass) => {
///                 assert_eq!(user, "alice");
///                 assert_eq!(pass, "secret");
///             }
///             _ => panic!("expected Done"),
///         }
///     }
///     _ => panic!("expected Challenge"),
/// }
/// ```
pub fn decode_login_step(state: &LoginState, response: &str) -> Result<LoginNext, SmtpError> {
    let decoded_bytes = BASE64
        .decode(response.trim())
        .map_err(|e| SmtpError::Base64Error(e.to_string()))?;
    let decoded = String::from_utf8(decoded_bytes)
        .map_err(|_| SmtpError::SyntaxError("invalid UTF-8 in LOGIN response".into()))?;

    match state {
        LoginState::WaitingUsername => {
            // base64("Password:") = "UGFzc3dvcmQ6"
            let password_challenge = BASE64.encode("Password:");
            Ok(LoginNext::Challenge(
                password_challenge,
                LoginState::WaitingPassword(decoded),
            ))
        }
        LoginState::WaitingPassword(username) => {
            Ok(LoginNext::Done(username.clone(), decoded))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decode_plain_basic() {
        // "\0testuser\0testpass"
        let encoded = BASE64.encode(b"\0testuser\0testpass");
        let creds = decode_plain(&encoded).unwrap();
        assert_eq!(creds.authzid, "");
        assert_eq!(creds.authcid, "testuser");
        assert_eq!(creds.password, "testpass");
    }

    #[test]
    fn decode_plain_with_authzid() {
        // "admin\0testuser\0testpass"
        let encoded = BASE64.encode(b"admin\0testuser\0testpass");
        let creds = decode_plain(&encoded).unwrap();
        assert_eq!(creds.authzid, "admin");
        assert_eq!(creds.authcid, "testuser");
        assert_eq!(creds.password, "testpass");
    }

    #[test]
    fn decode_plain_empty_authcid_fails() {
        // "\0\0pass"
        let encoded = BASE64.encode(b"\0\0pass");
        let result = decode_plain(&encoded);
        assert!(result.is_err());
    }

    #[test]
    fn decode_plain_invalid_base64() {
        let result = decode_plain("not-valid-base64!!!");
        assert!(result.is_err());
    }

    #[test]
    fn decode_xoauth2_basic() {
        let payload = "user=user@example.com\x01auth=Bearer ya29.abcdef\x01\x01";
        let encoded = BASE64.encode(payload);
        let (user, token) = decode_xoauth2(&encoded).unwrap();
        assert_eq!(user, "user@example.com");
        assert_eq!(token, "ya29.abcdef");
    }

    #[test]
    fn decode_xoauth2_missing_user() {
        let payload = "auth=Bearer ya29.token\x01\x01";
        let encoded = BASE64.encode(payload);
        let result = decode_xoauth2(&encoded);
        assert!(result.is_err());
    }

    #[test]
    fn login_two_step_flow() {
        let username_b64 = BASE64.encode("alice");
        let state = LoginState::WaitingUsername;
        let next = decode_login_step(&state, &username_b64).unwrap();

        match next {
            LoginNext::Challenge(challenge, new_state) => {
                assert_eq!(challenge, BASE64.encode("Password:"));
                let password_b64 = BASE64.encode("secret123");
                let final_step = decode_login_step(&new_state, &password_b64).unwrap();
                match final_step {
                    LoginNext::Done(user, pass) => {
                        assert_eq!(user, "alice");
                        assert_eq!(pass, "secret123");
                    }
                    _ => panic!("expected LoginNext::Done"),
                }
            }
            _ => panic!("expected LoginNext::Challenge"),
        }
    }

    #[test]
    fn sasl_mechanism_from_str() {
        assert_eq!(SaslMechanism::parse("PLAIN").unwrap(), SaslMechanism::Plain);
        assert_eq!(SaslMechanism::parse("login").unwrap(), SaslMechanism::Login);
        assert_eq!(
            SaslMechanism::parse("XOAUTH2").unwrap(),
            SaslMechanism::XOAuth2
        );
        assert!(SaslMechanism::parse("CRAM-MD5").is_err());
    }
}
