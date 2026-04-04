//! ObjectGUID: UUID to AD GUID binary format conversion.
//!
//! Active Directory stores objectGUID as 16 bytes with mixed-endian encoding:
//! the first three groups are little-endian while the last two groups are
//! big-endian, matching the COM GUID wire format (RFC 4122 variant).

use std::fmt;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Wraps a [`Uuid`] and provides Active Directory mixed-endian binary encoding.
///
/// AD stores objectGUID on the wire as:
/// - bytes 0..4   — Data1 (32-bit), little-endian
/// - bytes 4..6   — Data2 (16-bit), little-endian
/// - bytes 6..8   — Data3 (16-bit), little-endian
/// - bytes 8..16  — Data4 (64-bit), big-endian (unchanged)
///
/// # Examples
///
/// ```
/// use signapps_ad_core::guid::ObjectGuid;
///
/// let g = ObjectGuid::new();
/// let ad_bytes = g.to_ad_bytes();
/// let roundtrip = ObjectGuid::from_ad_bytes(&ad_bytes);
/// assert_eq!(g, roundtrip);
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ObjectGuid(pub Uuid);

impl ObjectGuid {
    /// Creates an `ObjectGuid` from an existing [`Uuid`].
    ///
    /// # Examples
    ///
    /// ```
    /// use uuid::Uuid;
    /// use signapps_ad_core::guid::ObjectGuid;
    ///
    /// let uuid = Uuid::new_v4();
    /// let guid = ObjectGuid::from_uuid(uuid);
    /// assert_eq!(guid.as_uuid(), uuid);
    /// ```
    pub fn from_uuid(uuid: Uuid) -> Self {
        Self(uuid)
    }

    /// Generates a new random v4 `ObjectGuid`.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::guid::ObjectGuid;
    ///
    /// let g1 = ObjectGuid::new();
    /// let g2 = ObjectGuid::new();
    /// assert_ne!(g1, g2);
    /// ```
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    /// Returns the inner [`Uuid`].
    ///
    /// # Examples
    ///
    /// ```
    /// use uuid::Uuid;
    /// use signapps_ad_core::guid::ObjectGuid;
    ///
    /// let uuid = Uuid::new_v4();
    /// assert_eq!(ObjectGuid::from_uuid(uuid).as_uuid(), uuid);
    /// ```
    pub fn as_uuid(&self) -> Uuid {
        self.0
    }

    /// Encodes the GUID to the 16-byte AD mixed-endian wire format.
    ///
    /// Bytes 0–3 are reversed (little-endian Data1), bytes 4–5 are reversed
    /// (little-endian Data2), bytes 6–7 are reversed (little-endian Data3),
    /// and bytes 8–15 are kept as-is (big-endian Data4).
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::guid::ObjectGuid;
    ///
    /// let g = ObjectGuid::new();
    /// let bytes = g.to_ad_bytes();
    /// assert_eq!(bytes.len(), 16);
    /// ```
    pub fn to_ad_bytes(&self) -> [u8; 16] {
        let src = *self.0.as_bytes();
        let mut dst = [0u8; 16];

        // Data1: bytes 0..4, reverse to little-endian
        dst[0] = src[3];
        dst[1] = src[2];
        dst[2] = src[1];
        dst[3] = src[0];

        // Data2: bytes 4..6, reverse to little-endian
        dst[4] = src[5];
        dst[5] = src[4];

        // Data3: bytes 6..8, reverse to little-endian
        dst[6] = src[7];
        dst[7] = src[6];

        // Data4: bytes 8..16, big-endian — unchanged
        dst[8..16].copy_from_slice(&src[8..16]);

        dst
    }

    /// Decodes an `ObjectGuid` from 16 bytes in AD mixed-endian wire format.
    ///
    /// This is the inverse of [`to_ad_bytes`](Self::to_ad_bytes).
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::guid::ObjectGuid;
    ///
    /// let g = ObjectGuid::new();
    /// let restored = ObjectGuid::from_ad_bytes(&g.to_ad_bytes());
    /// assert_eq!(g, restored);
    /// ```
    pub fn from_ad_bytes(ad: &[u8; 16]) -> Self {
        let mut src = [0u8; 16];

        // Data1: reverse back
        src[0] = ad[3];
        src[1] = ad[2];
        src[2] = ad[1];
        src[3] = ad[0];

        // Data2: reverse back
        src[4] = ad[5];
        src[5] = ad[4];

        // Data3: reverse back
        src[6] = ad[7];
        src[7] = ad[6];

        // Data4: unchanged
        src[8..16].copy_from_slice(&ad[8..16]);

        Self(Uuid::from_bytes(src))
    }
}

impl Default for ObjectGuid {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for ObjectGuid {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::ObjectGuid;

    #[test]
    fn roundtrip_ad_bytes() {
        let original = ObjectGuid::new();
        let ad_bytes = original.to_ad_bytes();
        let restored = ObjectGuid::from_ad_bytes(&ad_bytes);
        assert_eq!(original, restored);
    }

    #[test]
    fn ad_bytes_differ_from_uuid_bytes() {
        // UUID "01020304-0506-0708-090a-0b0c0d0e0f10"
        // UUID bytes (big-endian): [01, 02, 03, 04, 05, 06, 07, 08, 09, 0a, 0b, 0c, 0d, 0e, 0f, 10]
        // AD bytes Data1 reversed: [04, 03, 02, 01, ...]
        let uuid = Uuid::parse_str("01020304-0506-0708-090a-0b0c0d0e0f10").unwrap();
        let guid = ObjectGuid::from_uuid(uuid);
        let uuid_bytes = *uuid.as_bytes();
        let ad_bytes = guid.to_ad_bytes();

        // First four bytes should be reversed
        assert_eq!(ad_bytes[0], uuid_bytes[3]);
        assert_eq!(ad_bytes[1], uuid_bytes[2]);
        assert_eq!(ad_bytes[2], uuid_bytes[1]);
        assert_eq!(ad_bytes[3], uuid_bytes[0]);

        // Confirm they are actually different from the UUID bytes
        assert_ne!(&ad_bytes[0..4], &uuid_bytes[0..4]);
    }

    #[test]
    fn from_uuid_preserves_value() {
        let uuid = Uuid::new_v4();
        let guid = ObjectGuid::from_uuid(uuid);
        assert_eq!(guid.as_uuid(), uuid);
    }
}
