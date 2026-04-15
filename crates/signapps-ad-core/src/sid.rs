//! Security Identifier generation and parsing (MS-DTYP §2.4.2).
//!
//! A Security Identifier (SID) is a variable-length structure that uniquely
//! identifies a user, group, or other security principal in a Windows / Active
//! Directory environment.
//!
//! # Format
//!
//! The canonical string representation is:
//!
//! ```text
//! S-<revision>-<authority>-<sub-authority-1>-...-<sub-authority-n>
//! ```
//!
//! Example: `S-1-5-21-3623811015-3361044348-30300820-1001`
//!
//! # Examples
//!
//! ```
//! use signapps_ad_core::sid::SecurityIdentifier;
//!
//! let sid: SecurityIdentifier = "S-1-5-21-100-200-300-1001".parse().unwrap();
//! assert_eq!(sid.rid(), Some(1001));
//!
//! let domain = sid.domain_sid().unwrap();
//! assert_eq!(domain.to_string(), "S-1-5-21-100-200-300");
//! ```

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors that can occur when working with [`SecurityIdentifier`].
#[derive(Debug, Error, PartialEq, Eq)]
pub enum SidError {
    /// The string or byte buffer is not a valid SID representation.
    #[error("invalid SID format: {0}")]
    InvalidFormat(String),

    /// The SID revision byte is not supported (only revision 1 is defined).
    #[error("unsupported SID revision: {0}")]
    InvalidRevision(u8),
}

/// A Windows Security Identifier (SID).
///
/// Encodes a security principal as a hierarchical series of sub-authorities
/// beneath a top-level authority value.
///
/// # Examples
///
/// ```
/// use signapps_ad_core::sid::SecurityIdentifier;
///
/// let sid = SecurityIdentifier::generate_domain_sid();
/// assert!(sid.to_string().starts_with("S-1-5-21-"));
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, Eq)]
pub struct SecurityIdentifier {
    revision: u8,
    authority: u64,
    sub_authorities: Vec<u32>,
}

impl SecurityIdentifier {
    /// Parse a SID from its canonical string form `S-<rev>-<auth>-<subs...>`.
    ///
    /// # Errors
    ///
    /// Returns [`SidError::InvalidFormat`] when the string is malformed.
    /// Returns [`SidError::InvalidRevision`] when revision ≠ 1.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::sid::SecurityIdentifier;
    ///
    /// let sid = SecurityIdentifier::parse("S-1-5-32-544").unwrap();
    /// assert_eq!(sid.authority(), 5);
    /// assert_eq!(sid.sub_authorities(), &[32u32, 544u32]);
    /// ```
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    pub fn parse(input: &str) -> Result<Self, SidError> {
        let parts: Vec<&str> = input.split('-').collect();

        // Minimum: "S", revision, authority → at least 3 parts
        if parts.len() < 3 || parts[0] != "S" {
            return Err(SidError::InvalidFormat(input.to_owned()));
        }

        let revision: u8 = parts[1]
            .parse()
            .map_err(|_| SidError::InvalidFormat(input.to_owned()))?;

        if revision != 1 {
            return Err(SidError::InvalidRevision(revision));
        }

        let authority: u64 = parts[2]
            .parse()
            .map_err(|_| SidError::InvalidFormat(input.to_owned()))?;

        let mut sub_authorities = Vec::with_capacity(parts.len().saturating_sub(3));
        for part in &parts[3..] {
            let sub: u32 = part
                .parse()
                .map_err(|_| SidError::InvalidFormat(input.to_owned()))?;
            sub_authorities.push(sub);
        }

        Ok(Self {
            revision,
            authority,
            sub_authorities,
        })
    }

    /// Generate a random domain SID in the form `S-1-5-21-<rand>-<rand>-<rand>`.
    ///
    /// The three random sub-authorities are generated with [`rand::thread_rng`]
    /// to mimic the distribution used by Microsoft's `dcpromo`.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::sid::SecurityIdentifier;
    ///
    /// let sid = SecurityIdentifier::generate_domain_sid();
    /// assert_eq!(&sid.to_string()[..9], "S-1-5-21-");
    /// assert_eq!(sid.sub_authorities().len(), 4); // 21 + 3 random components
    /// ```
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    pub fn generate_domain_sid() -> Self {
        use rand::Rng as _;
        let mut rng = rand::thread_rng();
        Self {
            revision: 1,
            authority: 5,
            sub_authorities: vec![21, rng.gen::<u32>(), rng.gen::<u32>(), rng.gen::<u32>()],
        }
    }

    /// Create a child SID by appending `rid` as the last sub-authority.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::sid::SecurityIdentifier;
    ///
    /// let domain = SecurityIdentifier::parse("S-1-5-21-100-200-300").unwrap();
    /// let user   = domain.child(1001);
    /// assert_eq!(user.rid(), Some(1001));
    /// ```
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[must_use]
    pub fn child(&self, rid: u32) -> Self {
        let mut subs = self.sub_authorities.clone();
        subs.push(rid);
        Self {
            revision: self.revision,
            authority: self.authority,
            sub_authorities: subs,
        }
    }

    /// Return the last sub-authority (the Relative Identifier), if any.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::sid::SecurityIdentifier;
    ///
    /// let sid = SecurityIdentifier::parse("S-1-5-21-100-200-300-1001").unwrap();
    /// assert_eq!(sid.rid(), Some(1001));
    /// ```
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[must_use]
    pub fn rid(&self) -> Option<u32> {
        self.sub_authorities.last().copied()
    }

    /// Return the domain SID (all sub-authorities except the last RID).
    ///
    /// Returns `None` when the SID has fewer than two sub-authorities (there
    /// is no meaningful domain component to extract).
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::sid::SecurityIdentifier;
    ///
    /// let sid    = SecurityIdentifier::parse("S-1-5-21-100-200-300-1001").unwrap();
    /// let domain = sid.domain_sid().unwrap();
    /// assert_eq!(domain.to_string(), "S-1-5-21-100-200-300");
    /// ```
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[must_use]
    pub fn domain_sid(&self) -> Option<Self> {
        if self.sub_authorities.len() <= 1 {
            return None;
        }
        let subs = self.sub_authorities[..self.sub_authorities.len() - 1].to_vec();
        Some(Self {
            revision: self.revision,
            authority: self.authority,
            sub_authorities: subs,
        })
    }

    /// The SID revision number (always 1 for valid SIDs).
    #[must_use]
    pub fn revision(&self) -> u8 {
        self.revision
    }

    /// The top-level authority value (e.g. 5 for NT Authority).
    #[must_use]
    pub fn authority(&self) -> u64 {
        self.authority
    }

    /// The ordered slice of sub-authority values.
    #[must_use]
    pub fn sub_authorities(&self) -> &[u32] {
        &self.sub_authorities
    }

    /// Encode the SID into the binary wire format defined by MS-DTYP §2.4.2.
    ///
    /// Layout:
    /// - 1 byte  : Revision
    /// - 1 byte  : SubAuthorityCount
    /// - 6 bytes : IdentifierAuthority (big-endian)
    /// - 4 bytes × count : SubAuthority values (little-endian)
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::sid::SecurityIdentifier;
    ///
    /// let sid   = SecurityIdentifier::parse("S-1-5-32-544").unwrap();
    /// let bytes = sid.to_bytes();
    /// let back  = SecurityIdentifier::from_bytes(&bytes).unwrap();
    /// assert_eq!(sid, back);
    /// ```
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[must_use]
    pub fn to_bytes(&self) -> Vec<u8> {
        let count = self.sub_authorities.len();
        // 2 header bytes + 6 authority bytes + 4 bytes per sub-authority
        let mut buf = Vec::with_capacity(2 + 6 + count * 4);

        buf.push(self.revision);
        buf.push(count as u8);

        // IdentifierAuthority — 6 bytes, big-endian
        let auth_bytes = self.authority.to_be_bytes(); // 8 bytes
        buf.extend_from_slice(&auth_bytes[2..]); // skip top 2 bytes (always 0 for valid SIDs)

        // SubAuthority — each 4 bytes, little-endian
        for &sub in &self.sub_authorities {
            buf.extend_from_slice(&sub.to_le_bytes());
        }

        buf
    }

    /// Decode a SID from the binary wire format (MS-DTYP §2.4.2).
    ///
    /// # Errors
    ///
    /// Returns [`SidError::InvalidFormat`] when the buffer is too short or
    /// the sub-authority count is inconsistent with the buffer length.
    /// Returns [`SidError::InvalidRevision`] when revision ≠ 1.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::sid::SecurityIdentifier;
    ///
    /// let original = SecurityIdentifier::parse("S-1-5-21-100-200-300").unwrap();
    /// let bytes    = original.to_bytes();
    /// let decoded  = SecurityIdentifier::from_bytes(&bytes).unwrap();
    /// assert_eq!(original, decoded);
    /// ```
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    pub fn from_bytes(buf: &[u8]) -> Result<Self, SidError> {
        // Minimum: 2 header + 6 authority = 8 bytes
        if buf.len() < 8 {
            return Err(SidError::InvalidFormat(
                "buffer too short (< 8 bytes)".to_owned(),
            ));
        }

        let revision = buf[0];
        if revision != 1 {
            return Err(SidError::InvalidRevision(revision));
        }

        let count = buf[1] as usize;
        let expected_len = 8 + count * 4;
        if buf.len() < expected_len {
            return Err(SidError::InvalidFormat(format!(
                "buffer length {} is too short for {} sub-authorities (need {})",
                buf.len(),
                count,
                expected_len
            )));
        }

        // IdentifierAuthority — 6 bytes big-endian, stored in the low 6 bytes of u64
        let mut auth_bytes = [0u8; 8];
        auth_bytes[2..8].copy_from_slice(&buf[2..8]);
        let authority = u64::from_be_bytes(auth_bytes);

        let mut sub_authorities = Vec::with_capacity(count);
        for i in 0..count {
            let offset = 8 + i * 4;
            let sub = u32::from_le_bytes([
                buf[offset],
                buf[offset + 1],
                buf[offset + 2],
                buf[offset + 3],
            ]);
            sub_authorities.push(sub);
        }

        Ok(Self {
            revision,
            authority,
            sub_authorities,
        })
    }
}

impl PartialEq for SecurityIdentifier {
    fn eq(&self, other: &Self) -> bool {
        self.revision == other.revision
            && self.authority == other.authority
            && self.sub_authorities == other.sub_authorities
    }
}

impl fmt::Display for SecurityIdentifier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "S-{}-{}", self.revision, self.authority)?;
        for sub in &self.sub_authorities {
            write!(f, "-{sub}")?;
        }
        Ok(())
    }
}

impl FromStr for SecurityIdentifier {
    type Err = SidError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::parse(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_domain_sid() {
        let sid = SecurityIdentifier::parse("S-1-5-21-3623811015-3361044348-30300820").unwrap();
        assert_eq!(sid.revision(), 1);
        assert_eq!(sid.authority(), 5);
        assert_eq!(
            sid.sub_authorities(),
            &[21u32, 3_623_811_015, 3_361_044_348, 30_300_820]
        );
    }

    #[test]
    fn parse_well_known_sid() {
        // BUILTIN\Administrators
        let sid = SecurityIdentifier::parse("S-1-5-32-544").unwrap();
        assert_eq!(sid.revision(), 1);
        assert_eq!(sid.authority(), 5);
        assert_eq!(sid.sub_authorities(), &[32u32, 544u32]);
    }

    #[test]
    fn generate_domain_sid() {
        let sid = SecurityIdentifier::generate_domain_sid();
        assert!(sid.to_string().starts_with("S-1-5-21-"));
        assert_eq!(sid.sub_authorities().len(), 4);
        assert_eq!(sid.sub_authorities()[0], 21);
    }

    #[test]
    fn child_sid_from_domain() {
        let domain = SecurityIdentifier::parse("S-1-5-21-100-200-300").unwrap();
        let user = domain.child(1001);
        assert_eq!(user.rid(), Some(1001));
        assert_eq!(
            user.sub_authorities().len(),
            domain.sub_authorities().len() + 1
        );
        assert_eq!(
            &user.sub_authorities()[..domain.sub_authorities().len()],
            domain.sub_authorities()
        );
    }

    #[test]
    fn rid_extraction() {
        let sid = SecurityIdentifier::parse("S-1-5-21-100-200-300-1001").unwrap();
        assert_eq!(sid.rid(), Some(1001));
    }

    #[test]
    fn domain_sid_extraction() {
        let sid = SecurityIdentifier::parse("S-1-5-21-100-200-300-1001").unwrap();
        let domain = sid.domain_sid().unwrap();
        assert_eq!(domain.to_string(), "S-1-5-21-100-200-300");
    }

    #[test]
    fn binary_roundtrip() {
        let original =
            SecurityIdentifier::parse("S-1-5-21-3623811015-3361044348-30300820-1001").unwrap();
        let bytes = original.to_bytes();
        let decoded = SecurityIdentifier::from_bytes(&bytes).unwrap();
        assert_eq!(original, decoded);
        assert_eq!(original.to_string(), decoded.to_string());
    }

    #[test]
    fn invalid_sid_format() {
        assert!(matches!(
            SecurityIdentifier::parse("not-a-sid"),
            Err(SidError::InvalidFormat(_))
        ));
        assert!(matches!(
            SecurityIdentifier::parse("S-2-5-21"),
            Err(SidError::InvalidRevision(2))
        ));
    }
}
