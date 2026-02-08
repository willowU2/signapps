//! Value Objects (newtypes) for SignApps Platform.
//!
//! These types provide type-safe wrappers around primitive values,
//! ensuring validation at construction time.

use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use uuid::Uuid;
use validator::validate_email;

use crate::error::{Error, Result};

// =============================================================================
// UserId
// =============================================================================

/// Strongly-typed user identifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct UserId(Uuid);

impl UserId {
    /// Create a new random UserId.
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    /// Create a UserId from a UUID.
    pub fn from_uuid(uuid: Uuid) -> Self {
        Self(uuid)
    }

    /// Get the inner UUID.
    pub fn into_inner(self) -> Uuid {
        self.0
    }

    /// Get a reference to the inner UUID.
    pub fn as_uuid(&self) -> &Uuid {
        &self.0
    }
}

impl Default for UserId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for UserId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl FromStr for UserId {
    type Err = Error;

    fn from_str(s: &str) -> Result<Self> {
        let uuid = Uuid::parse_str(s).map_err(|_| Error::BadRequest("Invalid user ID".into()))?;
        Ok(Self(uuid))
    }
}

impl From<Uuid> for UserId {
    fn from(uuid: Uuid) -> Self {
        Self(uuid)
    }
}

impl From<UserId> for Uuid {
    fn from(user_id: UserId) -> Self {
        user_id.0
    }
}

// SQLx support
impl sqlx::Type<sqlx::Postgres> for UserId {
    fn type_info() -> sqlx::postgres::PgTypeInfo {
        <Uuid as sqlx::Type<sqlx::Postgres>>::type_info()
    }
}

impl<'r> sqlx::Decode<'r, sqlx::Postgres> for UserId {
    fn decode(
        value: sqlx::postgres::PgValueRef<'r>,
    ) -> std::result::Result<Self, sqlx::error::BoxDynError> {
        let uuid = <Uuid as sqlx::Decode<sqlx::Postgres>>::decode(value)?;
        Ok(Self(uuid))
    }
}

impl sqlx::Encode<'_, sqlx::Postgres> for UserId {
    fn encode_by_ref(
        &self,
        buf: &mut sqlx::postgres::PgArgumentBuffer,
    ) -> sqlx::encode::IsNull {
        self.0.encode_by_ref(buf)
    }
}

// =============================================================================
// Email
// =============================================================================

/// Validated email address.
///
/// Guarantees that the contained string is a valid email format.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
pub struct Email(String);

impl Email {
    /// Create a new Email from a string, validating the format.
    pub fn new(email: impl Into<String>) -> Result<Self> {
        let email = email.into().trim().to_lowercase();

        if email.is_empty() {
            return Err(Error::Validation("Email cannot be empty".into()));
        }

        if !validate_email(&email) {
            return Err(Error::Validation(format!("Invalid email format: {}", email)));
        }

        Ok(Self(email))
    }

    /// Create an Email without validation (use carefully).
    ///
    /// This is intended for cases where the email has already been validated,
    /// such as when loading from a trusted database.
    pub fn new_unchecked(email: impl Into<String>) -> Self {
        Self(email.into())
    }

    /// Get the email as a string slice.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Get the domain part of the email.
    pub fn domain(&self) -> Option<&str> {
        self.0.split('@').nth(1)
    }

    /// Get the local part of the email (before @).
    pub fn local_part(&self) -> Option<&str> {
        self.0.split('@').next()
    }
}

impl fmt::Display for Email {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl FromStr for Email {
    type Err = Error;

    fn from_str(s: &str) -> Result<Self> {
        Self::new(s)
    }
}

impl<'de> Deserialize<'de> for Email {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Email::new(s).map_err(serde::de::Error::custom)
    }
}

impl AsRef<str> for Email {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

// SQLx support
impl sqlx::Type<sqlx::Postgres> for Email {
    fn type_info() -> sqlx::postgres::PgTypeInfo {
        <String as sqlx::Type<sqlx::Postgres>>::type_info()
    }
}

impl<'r> sqlx::Decode<'r, sqlx::Postgres> for Email {
    fn decode(
        value: sqlx::postgres::PgValueRef<'r>,
    ) -> std::result::Result<Self, sqlx::error::BoxDynError> {
        let s = <String as sqlx::Decode<sqlx::Postgres>>::decode(value)?;
        Ok(Self::new_unchecked(s))
    }
}

impl sqlx::Encode<'_, sqlx::Postgres> for Email {
    fn encode_by_ref(
        &self,
        buf: &mut sqlx::postgres::PgArgumentBuffer,
    ) -> sqlx::encode::IsNull {
        <String as sqlx::Encode<sqlx::Postgres>>::encode_by_ref(&self.0, buf)
    }
}

// =============================================================================
// Password
// =============================================================================

/// A password that is validated for minimum requirements.
///
/// This type ensures passwords meet security requirements before being accepted.
/// Once created, the password should be hashed before storage.
#[derive(Clone)]
pub struct Password(String);

impl Password {
    /// Minimum password length.
    pub const MIN_LENGTH: usize = 8;

    /// Maximum password length.
    pub const MAX_LENGTH: usize = 128;

    /// Create a new Password from a string, validating requirements.
    pub fn new(password: impl Into<String>) -> Result<Self> {
        let password = password.into();

        if password.len() < Self::MIN_LENGTH {
            return Err(Error::Validation(format!(
                "Password must be at least {} characters",
                Self::MIN_LENGTH
            )));
        }

        if password.len() > Self::MAX_LENGTH {
            return Err(Error::Validation(format!(
                "Password must be at most {} characters",
                Self::MAX_LENGTH
            )));
        }

        Ok(Self(password))
    }

    /// Create a Password without validation (use carefully).
    ///
    /// This is only for testing or migration purposes.
    pub fn new_unchecked(password: impl Into<String>) -> Self {
        Self(password.into())
    }

    /// Get the password as a string slice.
    ///
    /// Use this only for hashing. Never log or display passwords.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Get the password as bytes.
    pub fn as_bytes(&self) -> &[u8] {
        self.0.as_bytes()
    }

    /// Check password strength (basic).
    ///
    /// Returns a score from 0-4:
    /// - 0: Very weak
    /// - 1: Weak
    /// - 2: Fair
    /// - 3: Strong
    /// - 4: Very strong
    pub fn strength_score(&self) -> u8 {
        let mut score = 0u8;

        if self.0.len() >= 12 {
            score += 1;
        }
        if self.0.chars().any(|c| c.is_uppercase()) {
            score += 1;
        }
        if self.0.chars().any(|c| c.is_lowercase()) {
            score += 1;
        }
        if self.0.chars().any(|c| c.is_numeric()) {
            score += 1;
        }
        if self.0.chars().any(|c| !c.is_alphanumeric()) {
            score += 1;
        }

        score.min(4)
    }
}

impl fmt::Debug for Password {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Password([REDACTED])")
    }
}

impl fmt::Display for Password {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "********")
    }
}

impl<'de> Deserialize<'de> for Password {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Password::new(s).map_err(serde::de::Error::custom)
    }
}

// =============================================================================
// PasswordHash
// =============================================================================

/// A hashed password stored in the database.
///
/// This is the result of hashing a Password with Argon2id.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct PasswordHash(String);

impl PasswordHash {
    /// Create a new PasswordHash from a hash string.
    pub fn new(hash: impl Into<String>) -> Self {
        Self(hash.into())
    }

    /// Get the hash as a string slice.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Verify a password against this hash.
    pub fn verify(&self, password: &Password) -> Result<bool> {
        use argon2::{Argon2, PasswordHash as Argon2Hash, PasswordVerifier};

        let parsed_hash = Argon2Hash::new(&self.0)
            .map_err(|e| Error::Internal(format!("Invalid password hash: {}", e)))?;

        Ok(Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok())
    }

    /// Hash a password using Argon2id.
    pub fn from_password(password: &Password) -> Result<Self> {
        use argon2::{
            password_hash::{rand_core::OsRng, SaltString},
            Argon2, PasswordHasher,
        };

        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();

        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| Error::Internal(format!("Failed to hash password: {}", e)))?
            .to_string();

        Ok(Self(hash))
    }
}

impl AsRef<str> for PasswordHash {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

// SQLx support
impl sqlx::Type<sqlx::Postgres> for PasswordHash {
    fn type_info() -> sqlx::postgres::PgTypeInfo {
        <String as sqlx::Type<sqlx::Postgres>>::type_info()
    }
}

impl<'r> sqlx::Decode<'r, sqlx::Postgres> for PasswordHash {
    fn decode(
        value: sqlx::postgres::PgValueRef<'r>,
    ) -> std::result::Result<Self, sqlx::error::BoxDynError> {
        let s = <String as sqlx::Decode<sqlx::Postgres>>::decode(value)?;
        Ok(Self(s))
    }
}

impl sqlx::Encode<'_, sqlx::Postgres> for PasswordHash {
    fn encode_by_ref(
        &self,
        buf: &mut sqlx::postgres::PgArgumentBuffer,
    ) -> sqlx::encode::IsNull {
        <String as sqlx::Encode<sqlx::Postgres>>::encode_by_ref(&self.0, buf)
    }
}

// =============================================================================
// Username
// =============================================================================

/// Validated username.
///
/// Usernames must be 3-64 characters, alphanumeric with underscores.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
pub struct Username(String);

impl Username {
    /// Minimum username length.
    pub const MIN_LENGTH: usize = 3;

    /// Maximum username length.
    pub const MAX_LENGTH: usize = 64;

    /// Create a new Username from a string, validating format.
    pub fn new(username: impl Into<String>) -> Result<Self> {
        let username = username.into().trim().to_lowercase();

        if username.len() < Self::MIN_LENGTH {
            return Err(Error::Validation(format!(
                "Username must be at least {} characters",
                Self::MIN_LENGTH
            )));
        }

        if username.len() > Self::MAX_LENGTH {
            return Err(Error::Validation(format!(
                "Username must be at most {} characters",
                Self::MAX_LENGTH
            )));
        }

        if !username
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
        {
            return Err(Error::Validation(
                "Username can only contain letters, numbers, underscores, and hyphens".into(),
            ));
        }

        if !username.chars().next().map(|c| c.is_alphabetic()).unwrap_or(false) {
            return Err(Error::Validation("Username must start with a letter".into()));
        }

        Ok(Self(username))
    }

    /// Create a Username without validation (use carefully).
    pub fn new_unchecked(username: impl Into<String>) -> Self {
        Self(username.into())
    }

    /// Get the username as a string slice.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for Username {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl FromStr for Username {
    type Err = Error;

    fn from_str(s: &str) -> Result<Self> {
        Self::new(s)
    }
}

impl<'de> Deserialize<'de> for Username {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Username::new(s).map_err(serde::de::Error::custom)
    }
}

impl AsRef<str> for Username {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

// SQLx support
impl sqlx::Type<sqlx::Postgres> for Username {
    fn type_info() -> sqlx::postgres::PgTypeInfo {
        <String as sqlx::Type<sqlx::Postgres>>::type_info()
    }
}

impl<'r> sqlx::Decode<'r, sqlx::Postgres> for Username {
    fn decode(
        value: sqlx::postgres::PgValueRef<'r>,
    ) -> std::result::Result<Self, sqlx::error::BoxDynError> {
        let s = <String as sqlx::Decode<sqlx::Postgres>>::decode(value)?;
        Ok(Self::new_unchecked(s))
    }
}

impl sqlx::Encode<'_, sqlx::Postgres> for Username {
    fn encode_by_ref(
        &self,
        buf: &mut sqlx::postgres::PgArgumentBuffer,
    ) -> sqlx::encode::IsNull {
        <String as sqlx::Encode<sqlx::Postgres>>::encode_by_ref(&self.0, buf)
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_id() {
        let id1 = UserId::new();
        let id2 = UserId::new();
        assert_ne!(id1, id2);

        let uuid_str = "550e8400-e29b-41d4-a716-446655440000";
        let id3: UserId = uuid_str.parse().unwrap();
        assert_eq!(id3.to_string(), uuid_str);
    }

    #[test]
    fn test_email_validation() {
        assert!(Email::new("test@example.com").is_ok());
        assert!(Email::new("user.name+tag@domain.org").is_ok());
        assert!(Email::new("TEST@EXAMPLE.COM").is_ok());

        assert!(Email::new("").is_err());
        assert!(Email::new("invalid").is_err());
        assert!(Email::new("@example.com").is_err());
        assert!(Email::new("test@").is_err());
    }

    #[test]
    fn test_email_normalization() {
        let email = Email::new("TEST@EXAMPLE.COM").unwrap();
        assert_eq!(email.as_str(), "test@example.com");
    }

    #[test]
    fn test_password_validation() {
        assert!(Password::new("short").is_err());
        assert!(Password::new("validpassword123").is_ok());
        assert!(Password::new("a".repeat(129)).is_err());
    }

    #[test]
    fn test_password_strength() {
        let weak = Password::new("password").unwrap();
        let strong = Password::new("MyStr0ng!Pass").unwrap();

        assert!(weak.strength_score() < strong.strength_score());
    }

    #[test]
    fn test_password_hash() {
        let password = Password::new("securepassword123").unwrap();
        let hash = PasswordHash::from_password(&password).unwrap();

        assert!(hash.verify(&password).unwrap());
        assert!(!hash.verify(&Password::new("wrongpassword1").unwrap()).unwrap());
    }

    #[test]
    fn test_username_validation() {
        assert!(Username::new("john_doe").is_ok());
        assert!(Username::new("user123").is_ok());
        assert!(Username::new("admin-user").is_ok());

        assert!(Username::new("ab").is_err()); // Too short
        assert!(Username::new("123user").is_err()); // Starts with number
        assert!(Username::new("user@name").is_err()); // Invalid char
    }
}
