//! BER decoding functions.

use super::types::{BerData, BerElement, BerError, BerTag};

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
        // Application (class = 0b01) — used for LDAP operation tags (0x60-0x7F)
        0b01 => BerTag::Application { number: tag_number, constructed },
        // Context-specific (class = 0b10) — used for LDAP filters and controls
        0b10 => BerTag::Context { number: tag_number, constructed },
        // Private (class = 0b11) — not used in LDAP
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
        BerTag::Application { constructed, .. } => *constructed,
        BerTag::Context { constructed, .. } => *constructed,
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
