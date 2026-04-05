//! ASN.1 BER encoder/decoder for LDAP.
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

pub mod decoder;
pub mod encoder;
pub mod types;

#[cfg(test)]
mod tests;

// Re-export everything at the same paths as before
pub use types::{BerData, BerElement, BerError, BerTag};
pub use decoder::{
    decode, decode_all, decode_boolean, decode_enumerated, decode_integer, decode_octet_string,
};
pub use encoder::{
    encode, encode_application, encode_boolean, encode_context, encode_enumerated, encode_integer,
    encode_octet_string, encode_sequence, encode_set,
};
