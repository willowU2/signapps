//! BER type definitions: [`BerTag`], [`BerElement`], [`BerData`], [`BerError`].

use thiserror::Error;

// ─── Public types ─────────────────────────────────────────────────────────────

/// ASN.1 tag, limited to the types required by LDAP (RFC 4511).
///
/// Tags encode three pieces of information: the class (universal vs.
/// context-specific), whether the encoding is constructed (contains nested
/// TLVs) or primitive (raw bytes), and the numeric tag identifier.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BerTag {
    /// Universal tag 0x01 — BOOLEAN.
    Boolean,
    /// Universal tag 0x02 — INTEGER.
    Integer,
    /// Universal tag 0x04 — OCTET STRING.
    OctetString,
    /// Universal tag 0x0A — ENUMERATED.
    Enumerated,
    /// Universal tag 0x30 — SEQUENCE (always constructed).
    Sequence,
    /// Universal tag 0x31 — SET (always constructed).
    Set,
    /// Application tag `[N]` — used for LDAP operation messages (BindRequest, SearchRequest, etc.).
    Application {
        /// Tag number (0-30).
        number: u8,
        /// Whether this is a constructed encoding.
        constructed: bool,
    },
    /// Context-specific tag `[N]`, constructed or primitive.
    ///
    /// LDAP uses these for operation discriminators (0x60–0x7F),
    /// filter components (0xA0–0xBF), and implicit primitives (0x80–0x9F).
    Context {
        /// Tag number in the range 0–30.
        number: u8,
        /// `true` if the value is a sequence of nested TLVs.
        constructed: bool,
    },
}

/// A decoded BER element consisting of a tag and its value payload.
#[derive(Debug, Clone, PartialEq)]
pub struct BerElement {
    /// The ASN.1 tag.
    pub tag: BerTag,
    /// The encoded value, either raw bytes or nested elements.
    pub data: BerData,
}

/// Payload of a [`BerElement`].
#[derive(Debug, Clone, PartialEq)]
pub enum BerData {
    /// Primitive value — raw byte content of the TLV value field.
    Primitive(Vec<u8>),
    /// Constructed value — sequence of nested BER elements.
    Constructed(Vec<BerElement>),
}

/// Errors that can occur during BER decoding.
///
/// Encoding is infallible given valid input types.
#[derive(Debug, Error)]
pub enum BerError {
    /// The input slice was shorter than required.
    #[error("Unexpected end of data")]
    UnexpectedEnd,
    /// A tag byte that does not map to a recognised ASN.1 type was found.
    #[error("Invalid tag byte: {0:#04x}")]
    InvalidTag(u8),
    /// A multi-byte length field encodes a value larger than `usize`.
    #[error("Length overflow")]
    LengthOverflow,
    /// The content of a primitive field violates the BER encoding rules.
    #[error("Invalid encoding: {0}")]
    InvalidEncoding(String),
}
