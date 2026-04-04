//! BER (Basic Encoding Rules) encoder/decoder from scratch.
//!
//! Implements the subset of ASN.1 BER required for the LDAP protocol (RFC 4511):
//! BOOLEAN, INTEGER, OCTET STRING, ENUMERATED, SEQUENCE, SET, and context-specific
//! tags used for LDAP operation discriminators, filters, and controls.
//!
//! # Wire format
//!
//! Every element is encoded as a Tag-Length-Value (TLV) triplet:
//!
//! ```text
//! ┌────────┬────────────────┬───────────────┐
//! │  Tag   │    Length      │     Value     │
//! └────────┴────────────────┴───────────────┘
//! ```
//!
//! - **Tag**: encodes class, constructed flag, and tag number.
//! - **Length**: short form (1 byte, < 128) or long form (1 + N bytes).
//! - **Value**: primitive bytes or concatenation of nested TLVs.
//!
//! # Examples
//!
//! ```
//! use signapps_ldap_server::codec::ber::{
//!     encode, encode_integer, encode_octet_string, encode_sequence,
//!     decode, decode_integer, decode_octet_string,
//! };
//!
//! // Round-trip an INTEGER
//! let elem = encode_integer(42);
//! let bytes = encode(&elem);
//! let (decoded, rest) = decode(&bytes).unwrap();
//! assert_eq!(rest, b"");
//! assert_eq!(decode_integer(&decoded).unwrap(), 42);
//! ```

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

// ─── Decoding ─────────────────────────────────────────────────────────────────

/// Decode one BER TLV element from `input`.
///
/// Returns the decoded element and the remaining (unconsumed) bytes.
///
/// # Errors
///
/// Returns [`BerError::UnexpectedEnd`] if the slice is too short, and
/// [`BerError::InvalidTag`] for unrecognised universal tags.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ber::{encode_integer, encode, decode};
///
/// let bytes = encode(&encode_integer(7));
/// let (elem, rest) = decode(&bytes).unwrap();
/// assert!(rest.is_empty());
/// ```
pub fn decode(input: &[u8]) -> Result<(BerElement, &[u8]), BerError> {
    let (tag, after_tag) = decode_tag(input)?;
    let (length, after_len) = decode_length(after_tag)?;

    if after_len.len() < length {
        return Err(BerError::UnexpectedEnd);
    }

    let value_bytes = &after_len[..length];
    let rest = &after_len[length..];

    let data = if is_constructed(&tag) {
        let children = decode_all(value_bytes)?;
        BerData::Constructed(children)
    } else {
        BerData::Primitive(value_bytes.to_vec())
    };

    Ok((BerElement { tag, data }, rest))
}

/// Decode all BER elements from `input`, consuming the entire slice.
///
/// # Errors
///
/// Propagates any error from [`decode`]. Returns [`BerError::UnexpectedEnd`]
/// if the buffer ends in the middle of an element.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ber::{encode, encode_integer, encode_boolean, decode_all};
///
/// let mut buf = encode(&encode_integer(1));
/// buf.extend(encode(&encode_boolean(true)));
/// let elems = decode_all(&buf).unwrap();
/// assert_eq!(elems.len(), 2);
/// ```
pub fn decode_all(input: &[u8]) -> Result<Vec<BerElement>, BerError> {
    let mut remaining = input;
    let mut elements = Vec::new();

    while !remaining.is_empty() {
        let (elem, rest) = decode(remaining)?;
        elements.push(elem);
        remaining = rest;
    }

    Ok(elements)
}

// ─── Internal decode helpers ──────────────────────────────────────────────────

/// Parse the tag byte(s) and advance the slice.
///
/// # Errors
///
/// - [`BerError::UnexpectedEnd`] when `input` is empty.
/// - [`BerError::InvalidTag`] for unrecognised universal tags or multi-byte
///   tag numbers (tag number = 31 indicates multi-byte tags, not used in LDAP).
fn decode_tag(input: &[u8]) -> Result<(BerTag, &[u8]), BerError> {
    let byte = *input.first().ok_or(BerError::UnexpectedEnd)?;
    let rest = &input[1..];

    let class = (byte & 0b1100_0000) >> 6;
    let constructed = (byte & 0b0010_0000) != 0;
    let tag_number = byte & 0b0001_1111;

    // Multi-byte tag (tag number == 31) — not used in LDAP.
    if tag_number == 31 {
        return Err(BerError::InvalidTag(byte));
    }

    let tag = match class {
        // Universal
        0b00 => match tag_number {
            0x01 => BerTag::Boolean,
            0x02 => BerTag::Integer,
            0x04 => BerTag::OctetString,
            0x0A => BerTag::Enumerated,
            0x10 => BerTag::Sequence, // 0x30 decoded as class=0, constructed=1, tag=16
            0x11 => BerTag::Set,      // 0x31 decoded as class=0, constructed=1, tag=17
            _ => return Err(BerError::InvalidTag(byte)),
        },
        // Context-specific (class = 0b10)
        0b10 => BerTag::Context { number: tag_number, constructed },
        _ => return Err(BerError::InvalidTag(byte)),
    };

    Ok((tag, rest))
}

/// Parse a BER length field and advance the slice.
///
/// # Errors
///
/// - [`BerError::UnexpectedEnd`] if the slice is too short.
/// - [`BerError::LengthOverflow`] if the encoded length exceeds `usize`.
fn decode_length(input: &[u8]) -> Result<(usize, &[u8]), BerError> {
    let first = *input.first().ok_or(BerError::UnexpectedEnd)?;

    if first & 0x80 == 0 {
        // Short form: single byte encodes the length directly.
        return Ok((first as usize, &input[1..]));
    }

    // Long form: lower 7 bits of the first byte give the number of subsequent
    // length bytes.
    let num_bytes = (first & 0x7F) as usize;
    if num_bytes == 0 {
        // Indefinite length — not used in LDAP and not supported here.
        return Err(BerError::InvalidEncoding(
            "indefinite length not supported".into(),
        ));
    }

    let rest = &input[1..];
    if rest.len() < num_bytes {
        return Err(BerError::UnexpectedEnd);
    }

    let length_bytes = &rest[..num_bytes];
    let after = &rest[num_bytes..];

    // Accumulate big-endian bytes into a usize, checking for overflow.
    let mut length: usize = 0;
    for &b in length_bytes {
        length = length
            .checked_shl(8)
            .and_then(|v| v.checked_add(b as usize))
            .ok_or(BerError::LengthOverflow)?;
    }

    Ok((length, after))
}

/// Returns `true` when the tag represents a constructed encoding.
fn is_constructed(tag: &BerTag) -> bool {
    match tag {
        BerTag::Boolean | BerTag::Integer | BerTag::OctetString | BerTag::Enumerated => false,
        BerTag::Sequence | BerTag::Set => true,
        BerTag::Context { constructed, .. } => *constructed,
    }
}

// ─── Encoding ─────────────────────────────────────────────────────────────────

/// Encode a [`BerElement`] to its BER wire representation.
///
/// Encoding is always definite-length DER-compatible.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ber::{encode, encode_octet_string};
///
/// let bytes = encode(&encode_octet_string(b"hello"));
/// assert_eq!(bytes, [0x04, 0x05, b'h', b'e', b'l', b'l', b'o']);
/// ```
///
/// # Panics
///
/// Panics if a `Context` tag has `number >= 31` (multi-byte tags are not
/// supported by LDAP and therefore not implemented).
pub fn encode(element: &BerElement) -> Vec<u8> {
    let tag_bytes = encode_tag(&element.tag);

    let value_bytes: Vec<u8> = match &element.data {
        BerData::Primitive(bytes) => bytes.clone(),
        BerData::Constructed(children) => children.iter().flat_map(encode).collect(),
    };

    let length_bytes = encode_length(value_bytes.len());

    let mut out = Vec::with_capacity(tag_bytes.len() + length_bytes.len() + value_bytes.len());
    out.extend_from_slice(&tag_bytes);
    out.extend_from_slice(&length_bytes);
    out.extend_from_slice(&value_bytes);
    out
}

// ─── Internal encode helpers ──────────────────────────────────────────────────

/// Encode a [`BerTag`] to its byte representation.
///
/// # Panics
///
/// Panics if a `Context` tag number is >= 31 (multi-byte tags not supported).
fn encode_tag(tag: &BerTag) -> Vec<u8> {
    let byte = match tag {
        BerTag::Boolean => 0x01,
        BerTag::Integer => 0x02,
        BerTag::OctetString => 0x04,
        BerTag::Enumerated => 0x0A,
        BerTag::Sequence => 0x30, // class=universal, constructed=1, tag=16
        BerTag::Set => 0x31,      // class=universal, constructed=1, tag=17
        BerTag::Context { number, constructed } => {
            assert!(*number < 31, "multi-byte context tags not supported");
            let class_bits: u8 = 0b1000_0000; // context-specific
            let constructed_bit: u8 = if *constructed { 0b0010_0000 } else { 0 };
            class_bits | constructed_bit | number
        }
    };
    vec![byte]
}

/// Encode a length value using the BER definite form.
fn encode_length(len: usize) -> Vec<u8> {
    if len < 128 {
        return vec![len as u8];
    }

    // Determine the minimum number of bytes needed.
    let mut temp = len;
    let mut num_bytes: u8 = 0;
    while temp > 0 {
        temp >>= 8;
        num_bytes += 1;
    }

    let mut out = Vec::with_capacity(1 + num_bytes as usize);
    out.push(0x80 | num_bytes);
    // Write big-endian length bytes.
    for i in (0..num_bytes).rev() {
        out.push((len >> (i * 8)) as u8);
    }
    out
}

// ─── Encoder helpers ──────────────────────────────────────────────────────────

/// Encode an ASN.1 INTEGER from a signed 64-bit value.
///
/// Uses the minimum number of two's-complement big-endian bytes, with a
/// leading zero byte added when the most-significant bit of the first content
/// byte would otherwise be set for a positive value.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ber::{encode_integer, encode};
///
/// // 0 encodes as a single zero byte.
/// assert_eq!(encode(&encode_integer(0)), [0x02, 0x01, 0x00]);
/// // 128 needs two bytes to avoid the sign bit.
/// assert_eq!(encode(&encode_integer(128)), [0x02, 0x02, 0x00, 0x80]);
/// ```
///
/// # Panics
///
/// No panics — encoding is always possible.
pub fn encode_integer(value: i64) -> BerElement {
    BerElement {
        tag: BerTag::Integer,
        data: BerData::Primitive(integer_to_bytes(value)),
    }
}

/// Encode an ASN.1 OCTET STRING from a byte slice.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ber::{encode_octet_string, encode};
///
/// let bytes = encode(&encode_octet_string(b""));
/// assert_eq!(bytes, [0x04, 0x00]);
/// ```
///
/// # Panics
///
/// No panics.
pub fn encode_octet_string(value: &[u8]) -> BerElement {
    BerElement {
        tag: BerTag::OctetString,
        data: BerData::Primitive(value.to_vec()),
    }
}

/// Encode an ASN.1 BOOLEAN.
///
/// Per DER/BER: `false` → `0x00`, `true` → `0xFF`.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ber::{encode_boolean, encode};
///
/// assert_eq!(encode(&encode_boolean(false)), [0x01, 0x01, 0x00]);
/// assert_eq!(encode(&encode_boolean(true)),  [0x01, 0x01, 0xFF]);
/// ```
///
/// # Panics
///
/// No panics.
pub fn encode_boolean(value: bool) -> BerElement {
    BerElement {
        tag: BerTag::Boolean,
        data: BerData::Primitive(vec![if value { 0xFF } else { 0x00 }]),
    }
}

/// Encode an ASN.1 ENUMERATED value.
///
/// Uses the same minimal two's-complement encoding as INTEGER.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ber::{encode_enumerated, encode};
///
/// assert_eq!(encode(&encode_enumerated(3)), [0x0A, 0x01, 0x03]);
/// ```
///
/// # Panics
///
/// No panics.
pub fn encode_enumerated(value: i32) -> BerElement {
    BerElement {
        tag: BerTag::Enumerated,
        data: BerData::Primitive(integer_to_bytes(i64::from(value))),
    }
}

/// Wrap a list of elements in an ASN.1 SEQUENCE.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ber::{encode_sequence, encode_integer};
///
/// let seq = encode_sequence(vec![encode_integer(1), encode_integer(2)]);
/// ```
///
/// # Panics
///
/// No panics.
pub fn encode_sequence(children: Vec<BerElement>) -> BerElement {
    BerElement {
        tag: BerTag::Sequence,
        data: BerData::Constructed(children),
    }
}

/// Wrap a list of elements in an ASN.1 SET.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ber::{encode_set, encode_octet_string};
///
/// let set = encode_set(vec![encode_octet_string(b"value")]);
/// ```
///
/// # Panics
///
/// No panics.
pub fn encode_set(children: Vec<BerElement>) -> BerElement {
    BerElement {
        tag: BerTag::Set,
        data: BerData::Constructed(children),
    }
}

/// Create a context-specific tagged element.
///
/// Used for LDAP operation discriminators (e.g., `[0] CONSTRUCTED` = BindRequest)
/// and filter choices (e.g., `[3] PRIMITIVE` = equalityMatch).
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ber::{encode_context, encode_integer, BerData};
///
/// // Context tag [0] CONSTRUCTED wrapping an INTEGER
/// let elem = encode_context(0, true, BerData::Constructed(vec![encode_integer(1)]));
/// ```
///
/// # Panics
///
/// Panics if `number >= 31`.
pub fn encode_context(number: u8, constructed: bool, data: BerData) -> BerElement {
    assert!(number < 31, "multi-byte context tags not supported");
    BerElement {
        tag: BerTag::Context { number, constructed },
        data,
    }
}

// ─── Decoder helpers ──────────────────────────────────────────────────────────

/// Extract the integer value from an INTEGER element.
///
/// # Errors
///
/// Returns [`BerError::InvalidEncoding`] when:
/// - the element tag is not `BerTag::Integer`,
/// - the data is not `BerData::Primitive`, or
/// - the encoded bytes represent a value outside the `i64` range.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ber::{encode_integer, decode_integer};
///
/// assert_eq!(decode_integer(&encode_integer(-1)).unwrap(), -1);
/// ```
///
/// # Panics
///
/// No panics.
pub fn decode_integer(elem: &BerElement) -> Result<i64, BerError> {
    if elem.tag != BerTag::Integer {
        return Err(BerError::InvalidEncoding(format!(
            "expected INTEGER tag, got {:?}",
            elem.tag
        )));
    }
    let bytes = primitive_bytes(elem)?;
    bytes_to_integer(bytes)
}

/// Extract the raw bytes from an OCTET STRING element.
///
/// # Errors
///
/// Returns [`BerError::InvalidEncoding`] when the element is not an
/// `OctetString` primitive.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ber::{encode_octet_string, decode_octet_string};
///
/// let elem = encode_octet_string(b"test");
/// assert_eq!(decode_octet_string(&elem).unwrap(), b"test");
/// ```
///
/// # Panics
///
/// No panics.
pub fn decode_octet_string(elem: &BerElement) -> Result<&[u8], BerError> {
    if elem.tag != BerTag::OctetString {
        return Err(BerError::InvalidEncoding(format!(
            "expected OCTET STRING tag, got {:?}",
            elem.tag
        )));
    }
    primitive_bytes(elem)
}

/// Extract the boolean value from a BOOLEAN element.
///
/// Per BER, any non-zero byte is `true`; `0x00` is `false`.
///
/// # Errors
///
/// Returns [`BerError::InvalidEncoding`] when the element is not a `Boolean`
/// primitive, or the content length is not exactly 1 byte.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ber::{encode_boolean, decode_boolean};
///
/// assert_eq!(decode_boolean(&encode_boolean(true)).unwrap(), true);
/// ```
///
/// # Panics
///
/// No panics.
pub fn decode_boolean(elem: &BerElement) -> Result<bool, BerError> {
    if elem.tag != BerTag::Boolean {
        return Err(BerError::InvalidEncoding(format!(
            "expected BOOLEAN tag, got {:?}",
            elem.tag
        )));
    }
    let bytes = primitive_bytes(elem)?;
    if bytes.len() != 1 {
        return Err(BerError::InvalidEncoding(format!(
            "BOOLEAN must be 1 byte, got {}",
            bytes.len()
        )));
    }
    Ok(bytes[0] != 0x00)
}

/// Extract the enumerated integer from an ENUMERATED element.
///
/// # Errors
///
/// Returns [`BerError::InvalidEncoding`] when the element is not an
/// `Enumerated` primitive or the value overflows `i32`.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ber::{encode_enumerated, decode_enumerated};
///
/// assert_eq!(decode_enumerated(&encode_enumerated(2)).unwrap(), 2);
/// ```
///
/// # Panics
///
/// No panics.
pub fn decode_enumerated(elem: &BerElement) -> Result<i32, BerError> {
    if elem.tag != BerTag::Enumerated {
        return Err(BerError::InvalidEncoding(format!(
            "expected ENUMERATED tag, got {:?}",
            elem.tag
        )));
    }
    let bytes = primitive_bytes(elem)?;
    let value = bytes_to_integer(bytes)?;
    i32::try_from(value).map_err(|_| BerError::InvalidEncoding("ENUMERATED value overflows i32".into()))
}

// ─── Internal shared helpers ──────────────────────────────────────────────────

/// Return the primitive byte slice from an element, or an error.
fn primitive_bytes(elem: &BerElement) -> Result<&[u8], BerError> {
    match &elem.data {
        BerData::Primitive(bytes) => Ok(bytes.as_slice()),
        BerData::Constructed(_) => Err(BerError::InvalidEncoding(
            "expected primitive data, got constructed".into(),
        )),
    }
}

/// Convert a signed integer to the minimal two's-complement big-endian bytes.
fn integer_to_bytes(value: i64) -> Vec<u8> {
    if value == 0 {
        return vec![0x00];
    }

    // Start from the full 8-byte representation.
    let full = value.to_be_bytes();

    // Find the shortest prefix that still encodes the same value.
    // We can strip a leading byte when it is a sign extension of the next byte:
    // - 0x00 followed by a byte with high bit clear (positive extension)
    // - 0xFF followed by a byte with high bit set (negative extension)
    let mut start = 0usize;
    while start + 1 < full.len() {
        let current = full[start];
        let next = full[start + 1];
        let can_strip = (current == 0x00 && next & 0x80 == 0)
            || (current == 0xFF && next & 0x80 != 0);
        if !can_strip {
            break;
        }
        start += 1;
    }

    full[start..].to_vec()
}

/// Decode two's-complement big-endian bytes into a signed i64.
fn bytes_to_integer(bytes: &[u8]) -> Result<i64, BerError> {
    if bytes.is_empty() {
        return Err(BerError::InvalidEncoding("INTEGER with zero bytes".into()));
    }
    if bytes.len() > 8 {
        return Err(BerError::InvalidEncoding(
            "INTEGER too large for i64".into(),
        ));
    }

    // Sign-extend to 8 bytes.
    let sign_byte: u8 = if bytes[0] & 0x80 != 0 { 0xFF } else { 0x00 };
    let mut buf = [sign_byte; 8];
    buf[8 - bytes.len()..].copy_from_slice(bytes);
    Ok(i64::from_be_bytes(buf))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── 1. INTEGER round-trip ─────────────────────────────────────────────────

    #[test]
    fn encode_decode_integer() {
        let cases: &[i64] = &[0, 1, -1, 127, 128, 256, -128, -129, i32::MAX as i64, i32::MIN as i64, i64::MAX, i64::MIN];
        for &value in cases {
            let elem = encode_integer(value);
            let bytes = encode(&elem);
            let (decoded, rest) = decode(&bytes).expect("decode should succeed");
            assert_eq!(rest, b"", "no leftover bytes for value {value}");
            assert_eq!(
                decode_integer(&decoded).expect("decode_integer should succeed"),
                value,
                "round-trip failed for {value}"
            );
        }
    }

    // ── 2. OCTET STRING round-trip ────────────────────────────────────────────

    #[test]
    fn encode_decode_octet_string() {
        let cases: &[&[u8]] = &[b"", b"hello", b"world", &[0x00, 0xFF, 0x80, 0x7F]];
        for &value in cases {
            let elem = encode_octet_string(value);
            let bytes = encode(&elem);
            let (decoded, rest) = decode(&bytes).expect("decode should succeed");
            assert_eq!(rest, b"");
            assert_eq!(
                decode_octet_string(&decoded).expect("decode_octet_string should succeed"),
                value
            );
        }
    }

    // ── 3. BOOLEAN round-trip ─────────────────────────────────────────────────

    #[test]
    fn encode_decode_boolean() {
        for &value in &[true, false] {
            let elem = encode_boolean(value);
            let bytes = encode(&elem);
            let (decoded, rest) = decode(&bytes).expect("decode should succeed");
            assert_eq!(rest, b"");
            assert_eq!(
                decode_boolean(&decoded).expect("decode_boolean should succeed"),
                value
            );
        }
        // BER: any non-zero byte is true.
        let raw = [0x01, 0x01, 0x42u8];
        let (elem, _) = decode(&raw).unwrap();
        assert!(decode_boolean(&elem).unwrap());
    }

    // ── 4. ENUMERATED round-trip ──────────────────────────────────────────────

    #[test]
    fn encode_decode_enumerated() {
        for &value in &[0i32, 1, 3, 127, -1] {
            let elem = encode_enumerated(value);
            let bytes = encode(&elem);
            let (decoded, rest) = decode(&bytes).expect("decode should succeed");
            assert_eq!(rest, b"");
            assert_eq!(
                decode_enumerated(&decoded).expect("decode_enumerated should succeed"),
                value
            );
        }
    }

    // ── 5. SEQUENCE round-trip ────────────────────────────────────────────────

    #[test]
    fn encode_decode_sequence() {
        let children = vec![encode_integer(1), encode_octet_string(b"test")];
        let seq = encode_sequence(children.clone());
        let bytes = encode(&seq);

        let (decoded, rest) = decode(&bytes).expect("decode should succeed");
        assert_eq!(rest, b"");
        assert_eq!(decoded.tag, BerTag::Sequence);

        if let BerData::Constructed(decoded_children) = &decoded.data {
            assert_eq!(decoded_children.len(), 2);
            assert_eq!(decode_integer(&decoded_children[0]).unwrap(), 1);
            assert_eq!(decode_octet_string(&decoded_children[1]).unwrap(), b"test");
        } else {
            panic!("expected Constructed data");
        }
    }

    // ── 6. Context tag round-trip ─────────────────────────────────────────────

    #[test]
    fn encode_decode_context_tag() {
        // [0] CONSTRUCTED containing an INTEGER
        let inner = encode_integer(42);
        let ctx = encode_context(0, true, BerData::Constructed(vec![inner]));
        let bytes = encode(&ctx);

        let (decoded, rest) = decode(&bytes).expect("decode should succeed");
        assert_eq!(rest, b"");
        assert_eq!(decoded.tag, BerTag::Context { number: 0, constructed: true });
        if let BerData::Constructed(children) = &decoded.data {
            assert_eq!(decode_integer(&children[0]).unwrap(), 42);
        } else {
            panic!("expected Constructed");
        }

        // [1] PRIMITIVE with raw bytes
        let ctx_prim = encode_context(1, false, BerData::Primitive(vec![0xDE, 0xAD]));
        let prim_bytes = encode(&ctx_prim);
        let (decoded_prim, _) = decode(&prim_bytes).unwrap();
        assert_eq!(decoded_prim.tag, BerTag::Context { number: 1, constructed: false });
        assert_eq!(decoded_prim.data, BerData::Primitive(vec![0xDE, 0xAD]));
    }

    // ── 7. Multi-byte length field ────────────────────────────────────────────

    #[test]
    fn decode_multi_byte_length() {
        // Build an OCTET STRING with 200 bytes — length field needs long form.
        let data: Vec<u8> = (0u8..200).collect();
        let elem = encode_octet_string(&data);
        let bytes = encode(&elem);

        // Verify the length is encoded in long form (0x81, 0xC8).
        assert_eq!(bytes[1], 0x81, "length should be long form");
        assert_eq!(bytes[2], 200u8);

        let (decoded, rest) = decode(&bytes).expect("decode should succeed");
        assert_eq!(rest, b"");
        assert_eq!(decode_octet_string(&decoded).unwrap(), data.as_slice());
    }

    // ── 8. Empty input returns UnexpectedEnd ──────────────────────────────────

    #[test]
    fn decode_empty_input_error() {
        let result = decode(b"");
        assert!(
            matches!(result, Err(BerError::UnexpectedEnd)),
            "expected UnexpectedEnd, got {result:?}"
        );
    }

    // ── 9. Truncated data returns error ───────────────────────────────────────

    #[test]
    fn decode_truncated_error() {
        // Tag + length say 5 bytes of content, but only 2 are present.
        let truncated = [0x04u8, 0x05, 0x41, 0x42];
        let result = decode(&truncated);
        assert!(
            matches!(result, Err(BerError::UnexpectedEnd)),
            "expected UnexpectedEnd for truncated input, got {result:?}"
        );
    }

    // ── 10. INTEGER uses minimal bytes ────────────────────────────────────────

    #[test]
    fn encode_integer_minimal_bytes() {
        // 0 → 1 byte
        assert_eq!(integer_to_bytes(0), vec![0x00]);
        // 127 → 1 byte
        assert_eq!(integer_to_bytes(127), vec![0x7F]);
        // 128 → 2 bytes (leading 0x00 prevents sign-bit confusion)
        assert_eq!(integer_to_bytes(128), vec![0x00, 0x80]);
        // -1 → 1 byte (0xFF)
        assert_eq!(integer_to_bytes(-1), vec![0xFF]);
        // -128 → 1 byte (0x80)
        assert_eq!(integer_to_bytes(-128), vec![0x80]);
        // -129 → 2 bytes
        assert_eq!(integer_to_bytes(-129), vec![0xFF, 0x7F]);
        // 256 → 2 bytes
        assert_eq!(integer_to_bytes(256), vec![0x01, 0x00]);
    }

    // ── 11. decode_all consumes the entire buffer ─────────────────────────────

    #[test]
    fn decode_all_multiple_elements() {
        let mut buf = encode(&encode_integer(10));
        buf.extend(encode(&encode_boolean(false)));
        buf.extend(encode(&encode_octet_string(b"dn=foo")));

        let elems = decode_all(&buf).expect("decode_all should succeed");
        assert_eq!(elems.len(), 3);
        assert_eq!(decode_integer(&elems[0]).unwrap(), 10);
        assert_eq!(decode_boolean(&elems[1]).unwrap(), false);
        assert_eq!(decode_octet_string(&elems[2]).unwrap(), b"dn=foo");
    }

    // ── 12. Nested SEQUENCE (LDAP-like structure) ─────────────────────────────

    #[test]
    fn encode_decode_nested_sequence() {
        // Simulate: SEQUENCE { INTEGER(1), SEQUENCE { OCTET_STRING("uid"), OCTET_STRING("admin") } }
        let inner_seq = encode_sequence(vec![
            encode_octet_string(b"uid"),
            encode_octet_string(b"admin"),
        ]);
        let outer_seq = encode_sequence(vec![encode_integer(1), inner_seq]);
        let bytes = encode(&outer_seq);

        let (decoded, rest) = decode(&bytes).unwrap();
        assert_eq!(rest, b"");
        assert_eq!(decoded.tag, BerTag::Sequence);
        if let BerData::Constructed(children) = &decoded.data {
            assert_eq!(children.len(), 2);
            assert_eq!(decode_integer(&children[0]).unwrap(), 1);
            if let BerData::Constructed(inner_children) = &children[1].data {
                assert_eq!(decode_octet_string(&inner_children[0]).unwrap(), b"uid");
                assert_eq!(decode_octet_string(&inner_children[1]).unwrap(), b"admin");
            } else {
                panic!("expected inner Constructed");
            }
        } else {
            panic!("expected outer Constructed");
        }
    }

    // ── 13. Known BER wire bytes (manual verification) ────────────────────────

    #[test]
    fn known_wire_bytes() {
        // BOOLEAN true: 01 01 FF
        assert_eq!(encode(&encode_boolean(true)), [0x01, 0x01, 0xFF]);
        // BOOLEAN false: 01 01 00
        assert_eq!(encode(&encode_boolean(false)), [0x01, 0x01, 0x00]);
        // INTEGER 0: 02 01 00
        assert_eq!(encode(&encode_integer(0)), [0x02, 0x01, 0x00]);
        // INTEGER 128: 02 02 00 80
        assert_eq!(encode(&encode_integer(128)), [0x02, 0x02, 0x00, 0x80]);
        // OCTET STRING "hi": 04 02 68 69
        assert_eq!(encode(&encode_octet_string(b"hi")), [0x04, 0x02, b'h', b'i']);
        // ENUMERATED 0: 0A 01 00
        assert_eq!(encode(&encode_enumerated(0)), [0x0A, 0x01, 0x00]);
        // Empty SEQUENCE: 30 00
        assert_eq!(encode(&encode_sequence(vec![])), [0x30, 0x00]);
    }
}
