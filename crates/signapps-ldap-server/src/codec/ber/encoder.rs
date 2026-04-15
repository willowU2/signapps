//! BER encoding functions.

use super::types::{BerData, BerElement, BerTag};

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
        BerTag::Application {
            number,
            constructed,
        } => {
            assert!(*number < 31, "multi-byte application tags not supported");
            let class_bits: u8 = 0b0100_0000; // application
            let constructed_bit: u8 = if *constructed { 0b0010_0000 } else { 0 };
            class_bits | constructed_bit | number
        },
        BerTag::Context {
            number,
            constructed,
        } => {
            assert!(*number < 31, "multi-byte context tags not supported");
            let class_bits: u8 = 0b1000_0000; // context-specific
            let constructed_bit: u8 = if *constructed { 0b0010_0000 } else { 0 };
            class_bits | constructed_bit | number
        },
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
        tag: BerTag::Context {
            number,
            constructed,
        },
        data,
    }
}

/// Create an application-tagged element (used for LDAP response messages).
pub fn encode_application(number: u8, constructed: bool, data: BerData) -> BerElement {
    assert!(number < 31, "multi-byte application tags not supported");
    BerElement {
        tag: BerTag::Application {
            number,
            constructed,
        },
        data,
    }
}

// ─── Internal shared helpers ──────────────────────────────────────────────────

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
        let can_strip =
            (current == 0x00 && next & 0x80 == 0) || (current == 0xFF && next & 0x80 != 0);
        if !can_strip {
            break;
        }
        start += 1;
    }

    full[start..].to_vec()
}
