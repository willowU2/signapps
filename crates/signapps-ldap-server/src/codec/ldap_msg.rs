//! LDAP message types (RFC 4511 §4).
//!
//! Defines all LDAP protocol operation types. These are converted to/from
//! BER elements by the codec layer.

use serde::{Deserialize, Serialize};

// ── Top-level message ──────────────────────────────────────────────────────

/// A complete LDAP protocol message.
///
/// Wraps a message ID and the protocol operation. Controls are omitted in
/// this initial implementation (see RFC 4511 §4.1.11).
///
/// ```text
/// LDAPMessage ::= SEQUENCE {
///     messageID  INTEGER,
///     protocolOp CHOICE { ... },
///     controls   [0] Controls OPTIONAL
/// }
/// ```
#[derive(Debug, Clone)]
pub struct LdapMessage {
    /// Unique identifier for this message within the session.
    pub message_id: i32,
    /// The LDAP protocol operation carried by this message.
    pub operation: LdapOperation,
}

// ── Protocol operations ────────────────────────────────────────────────────

/// LDAP protocol operations (RFC 4511 §4.2–4.14).
///
/// Covers all standard request/response pairs defined by the protocol.
#[derive(Debug, Clone)]
pub enum LdapOperation {
    // ── Requests (from client) ──────────────────────────────────────────
    /// Authenticate to the directory (RFC 4511 §4.2).
    BindRequest(BindRequest),
    /// End the session (RFC 4511 §4.3). No response is sent.
    UnbindRequest,
    /// Search the directory (RFC 4511 §4.5).
    SearchRequest(SearchRequest),
    /// Add a new entry (RFC 4511 §4.7).
    AddRequest(AddRequest),
    /// Modify an existing entry (RFC 4511 §4.6).
    ModifyRequest(ModifyRequest),
    /// Delete an entry by DN (RFC 4511 §4.8).
    DeleteRequest(String),
    /// Rename or move an entry (RFC 4511 §4.9).
    ModifyDnRequest(ModifyDnRequest),
    /// Compare an attribute value (RFC 4511 §4.10).
    CompareRequest(CompareRequest),
    /// Cancel an outstanding operation (RFC 4511 §4.11).
    AbandonRequest(i32),
    /// Extended operation (RFC 4511 §4.12).
    ExtendedRequest(ExtendedRequest),

    // ── Responses (from server) ─────────────────────────────────────────
    /// Result of a BindRequest (RFC 4511 §4.2).
    BindResponse(LdapResult),
    /// A single entry returned from a search (RFC 4511 §4.5.2).
    SearchResultEntry(SearchResultEntry),
    /// Terminal result of a search (RFC 4511 §4.5.2).
    SearchResultDone(LdapResult),
    /// Referral URIs returned during a search (RFC 4511 §4.5.3).
    SearchResultReference(Vec<String>),
    /// Result of a ModifyRequest (RFC 4511 §4.6).
    ModifyResponse(LdapResult),
    /// Result of an AddRequest (RFC 4511 §4.7).
    AddResponse(LdapResult),
    /// Result of a DeleteRequest (RFC 4511 §4.8).
    DeleteResponse(LdapResult),
    /// Result of a ModifyDnRequest (RFC 4511 §4.9).
    ModifyDnResponse(LdapResult),
    /// Result of a CompareRequest (RFC 4511 §4.10).
    CompareResponse(LdapResult),
    /// Result of an ExtendedRequest (RFC 4511 §4.12).
    ExtendedResponse(ExtendedResponse),
}

// ── LDAP result ────────────────────────────────────────────────────────────

/// LDAP result code and diagnostics, shared by all response types.
///
/// Defined in RFC 4511 §4.1.9.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::codec::ldap_msg::{LdapResult, ResultCode};
///
/// let ok = LdapResult::success();
/// assert_eq!(ok.result_code, ResultCode::Success);
///
/// let err = LdapResult::error(ResultCode::InvalidCredentials, "bad password");
/// assert_eq!(err.diagnostic_message, "bad password");
/// ```
///
/// # Errors
///
/// This struct does not perform I/O; errors come from callers constructing it.
///
/// # Panics
///
/// No panics possible.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LdapResult {
    /// The result code indicating success or failure category.
    pub result_code: ResultCode,
    /// The DN of the closest matching object (may be empty).
    pub matched_dn: String,
    /// Human-readable diagnostic message (may be empty).
    pub diagnostic_message: String,
}

impl LdapResult {
    /// Construct a successful result with empty DN and message.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ldap_server::codec::ldap_msg::{LdapResult, ResultCode};
    /// let r = LdapResult::success();
    /// assert_eq!(r.result_code, ResultCode::Success);
    /// ```
    pub fn success() -> Self {
        Self {
            result_code: ResultCode::Success,
            matched_dn: String::new(),
            diagnostic_message: String::new(),
        }
    }

    /// Construct a failure result with the given code and diagnostic message.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ldap_server::codec::ldap_msg::{LdapResult, ResultCode};
    /// let r = LdapResult::error(ResultCode::InvalidCredentials, "bad password");
    /// assert_eq!(r.result_code, ResultCode::InvalidCredentials);
    /// ```
    ///
    /// # Errors
    ///
    /// Always succeeds — this is a pure constructor.
    ///
    /// # Panics
    ///
    /// No panics possible.
    pub fn error(code: ResultCode, message: &str) -> Self {
        Self {
            result_code: code,
            matched_dn: String::new(),
            diagnostic_message: message.to_string(),
        }
    }
}

// ── Result codes ───────────────────────────────────────────────────────────

/// LDAP result codes (RFC 4511 §4.1.9).
///
/// The numeric value matches the wire encoding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum ResultCode {
    /// The operation completed successfully.
    Success = 0,
    /// An internal server error occurred.
    OperationsError = 1,
    /// The request was malformed.
    ProtocolError = 2,
    /// The operation exceeded the server time limit.
    TimeLimitExceeded = 3,
    /// The result set exceeded the server size limit.
    SizeLimitExceeded = 4,
    /// The authentication method is not supported.
    AuthMethodNotSupported = 7,
    /// A stronger authentication mechanism is required.
    StrongerAuthRequired = 8,
    /// The named attribute does not exist in the schema.
    NoSuchAttribute = 16,
    /// The target object does not exist in the directory.
    NoSuchObject = 32,
    /// The provided DN is syntactically invalid.
    InvalidDnSyntax = 34,
    /// The credentials are incorrect.
    InvalidCredentials = 49,
    /// The client does not have permission.
    InsufficientAccessRights = 50,
    /// The server is too busy to process the request.
    Busy = 51,
    /// The server is not available.
    Unavailable = 52,
    /// The server is unwilling to perform the operation.
    UnwillingToPerform = 53,
    /// The RDN naming constraint was violated.
    NamingViolation = 64,
    /// The object class constraint was violated.
    ObjectClassViolation = 65,
    /// The entry already exists.
    EntryAlreadyExists = 68,
    /// An unrecognised or uncategorised error.
    Other = 80,
}

impl ResultCode {
    /// Convert a raw integer to a `ResultCode`.
    ///
    /// Unrecognised values map to [`ResultCode::Other`].
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ldap_server::codec::ldap_msg::ResultCode;
    /// assert_eq!(ResultCode::from_i32(0), ResultCode::Success);
    /// assert_eq!(ResultCode::from_i32(49), ResultCode::InvalidCredentials);
    /// assert_eq!(ResultCode::from_i32(999), ResultCode::Other);
    /// ```
    ///
    /// # Panics
    ///
    /// No panics possible.
    pub fn from_i32(val: i32) -> Self {
        match val {
            0 => Self::Success,
            1 => Self::OperationsError,
            2 => Self::ProtocolError,
            3 => Self::TimeLimitExceeded,
            4 => Self::SizeLimitExceeded,
            7 => Self::AuthMethodNotSupported,
            8 => Self::StrongerAuthRequired,
            16 => Self::NoSuchAttribute,
            32 => Self::NoSuchObject,
            34 => Self::InvalidDnSyntax,
            49 => Self::InvalidCredentials,
            50 => Self::InsufficientAccessRights,
            51 => Self::Busy,
            52 => Self::Unavailable,
            53 => Self::UnwillingToPerform,
            64 => Self::NamingViolation,
            65 => Self::ObjectClassViolation,
            68 => Self::EntryAlreadyExists,
            _ => Self::Other,
        }
    }
}

// ── Bind ───────────────────────────────────────────────────────────────────

/// LDAP BindRequest (RFC 4511 §4.2).
///
/// Authenticates the client to the LDAP server.
#[derive(Debug, Clone)]
pub struct BindRequest {
    /// LDAP protocol version — always 3 in modern implementations.
    pub version: i32,
    /// The distinguished name to bind as (may be empty for anonymous).
    pub name: String,
    /// The authentication credentials.
    pub authentication: BindAuthentication,
}

/// Authentication choice for a [`BindRequest`].
#[derive(Debug, Clone)]
pub enum BindAuthentication {
    /// Simple password authentication (RFC 4511 §4.2).
    Simple(Vec<u8>),
    /// SASL authentication (RFC 4511 §4.2).
    Sasl(SaslCredentials),
}

/// SASL credentials for a [`BindRequest`] (RFC 4511 §4.2).
#[derive(Debug, Clone)]
pub struct SaslCredentials {
    /// SASL mechanism name, e.g. `"GSSAPI"` or `"EXTERNAL"`.
    pub mechanism: String,
    /// Mechanism-specific opaque credential bytes, if any.
    pub credentials: Option<Vec<u8>>,
}

// ── Search ─────────────────────────────────────────────────────────────────

/// LDAP SearchRequest (RFC 4511 §4.5.1).
///
/// Queries the directory for entries matching a filter under a base DN.
#[derive(Debug, Clone)]
pub struct SearchRequest {
    /// Base DN for the search.
    pub base_dn: String,
    /// Scope of the search.
    pub scope: SearchScope,
    /// How aliases are dereferenced during the search.
    pub deref_aliases: DerefAliases,
    /// Maximum number of entries to return (0 = no limit).
    pub size_limit: i32,
    /// Maximum time in seconds to spend searching (0 = no limit).
    pub time_limit: i32,
    /// If `true`, only attribute types are returned, not values.
    pub types_only: bool,
    /// The filter that entries must match.
    pub filter: SearchFilter,
    /// Attributes to return; empty means return all user attributes.
    pub attributes: Vec<String>,
}

/// Scope of an LDAP search (RFC 4511 §4.5.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum SearchScope {
    /// Search only the base object itself.
    BaseObject = 0,
    /// Search entries immediately subordinate to the base object.
    SingleLevel = 1,
    /// Search the entire subtree rooted at the base object.
    WholeSubtree = 2,
}

impl SearchScope {
    /// Convert a raw integer to a `SearchScope`.
    ///
    /// Values other than 0 or 1 map to [`SearchScope::WholeSubtree`].
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ldap_server::codec::ldap_msg::SearchScope;
    /// assert_eq!(SearchScope::from_i32(0), SearchScope::BaseObject);
    /// assert_eq!(SearchScope::from_i32(99), SearchScope::WholeSubtree);
    /// ```
    ///
    /// # Panics
    ///
    /// No panics possible.
    pub fn from_i32(val: i32) -> Self {
        match val {
            0 => Self::BaseObject,
            1 => Self::SingleLevel,
            _ => Self::WholeSubtree,
        }
    }
}

/// Alias dereferencing behaviour (RFC 4511 §4.5.1).
#[derive(Debug, Clone, Copy)]
#[repr(i32)]
pub enum DerefAliases {
    /// Never dereference aliases.
    NeverDerefAliases = 0,
    /// Dereference aliases while searching subordinates of the base object.
    DerefInSearching = 1,
    /// Dereference aliases when locating the base object.
    DerefFindingBaseObj = 2,
    /// Dereference aliases at all stages.
    DerefAlways = 3,
}

impl DerefAliases {
    /// Convert a raw integer to a `DerefAliases`.
    ///
    /// Unrecognised values map to [`DerefAliases::NeverDerefAliases`].
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ldap_server::codec::ldap_msg::DerefAliases;
    /// ```
    ///
    /// # Panics
    ///
    /// No panics possible.
    pub fn from_i32(val: i32) -> Self {
        match val {
            1 => Self::DerefInSearching,
            2 => Self::DerefFindingBaseObj,
            3 => Self::DerefAlways,
            _ => Self::NeverDerefAliases,
        }
    }
}

/// LDAP search filter (RFC 4511 §4.5.1).
///
/// Simplified representation suitable for this implementation. Maps to
/// `signapps_ad_core::LdapFilter` for actual evaluation.
#[derive(Debug, Clone)]
pub enum SearchFilter {
    /// Logical AND of sub-filters (RFC 4511 §4.5.1).
    And(Vec<SearchFilter>),
    /// Logical OR of sub-filters (RFC 4511 §4.5.1).
    Or(Vec<SearchFilter>),
    /// Logical NOT of a sub-filter (RFC 4511 §4.5.1).
    Not(Box<SearchFilter>),
    /// Equality assertion filter (RFC 4511 §4.5.1).
    EqualityMatch {
        /// Attribute description.
        attribute: String,
        /// Assertion value bytes.
        value: Vec<u8>,
    },
    /// Substring assertion filter (RFC 4511 §4.5.1).
    Substrings {
        /// Attribute description.
        attribute: String,
        /// Ordered list of substring choices.
        substrings: Vec<SubstringChoice>,
    },
    /// Greater-or-equal assertion filter (RFC 4511 §4.5.1).
    GreaterOrEqual {
        /// Attribute description.
        attribute: String,
        /// Assertion value bytes.
        value: Vec<u8>,
    },
    /// Less-or-equal assertion filter (RFC 4511 §4.5.1).
    LessOrEqual {
        /// Attribute description.
        attribute: String,
        /// Assertion value bytes.
        value: Vec<u8>,
    },
    /// Presence assertion filter — attribute exists (RFC 4511 §4.5.1).
    Present(String),
    /// Approximate match filter (RFC 4511 §4.5.1).
    ApproxMatch {
        /// Attribute description.
        attribute: String,
        /// Assertion value bytes.
        value: Vec<u8>,
    },
}

/// A component of a [`SearchFilter::Substrings`] assertion (RFC 4511 §4.5.1).
#[derive(Debug, Clone)]
pub enum SubstringChoice {
    /// The value must start with these bytes.
    Initial(Vec<u8>),
    /// The value must contain these bytes somewhere.
    Any(Vec<u8>),
    /// The value must end with these bytes.
    Final(Vec<u8>),
}

/// A single entry returned by a search (RFC 4511 §4.5.2).
#[derive(Debug, Clone)]
pub struct SearchResultEntry {
    /// Distinguished name of the entry.
    pub dn: String,
    /// The requested attributes and their values.
    pub attributes: Vec<PartialAttribute>,
}

/// An attribute type together with a set of values (RFC 4511 §4.1.7).
#[derive(Debug, Clone)]
pub struct PartialAttribute {
    /// The attribute type (description string, e.g. `"cn"`).
    pub attr_type: String,
    /// The attribute values as raw bytes.
    pub values: Vec<Vec<u8>>,
}

// ── Add ────────────────────────────────────────────────────────────────────

/// LDAP AddRequest (RFC 4511 §4.7).
///
/// Creates a new entry in the directory.
#[derive(Debug, Clone)]
pub struct AddRequest {
    /// Distinguished name of the new entry.
    pub dn: String,
    /// Attributes and values for the new entry.
    pub attributes: Vec<PartialAttribute>,
}

// ── Modify ─────────────────────────────────────────────────────────────────

/// LDAP ModifyRequest (RFC 4511 §4.6).
///
/// Modifies an existing entry.
#[derive(Debug, Clone)]
pub struct ModifyRequest {
    /// Distinguished name of the entry to modify.
    pub dn: String,
    /// Ordered list of modification operations.
    pub changes: Vec<ModifyChange>,
}

/// A single modification within a [`ModifyRequest`].
#[derive(Debug, Clone)]
pub struct ModifyChange {
    /// The type of modification to apply.
    pub operation: ModifyOperation,
    /// The attribute and values involved in the modification.
    pub modification: PartialAttribute,
}

/// Modification operation type (RFC 4511 §4.6).
#[derive(Debug, Clone, Copy)]
#[repr(i32)]
pub enum ModifyOperation {
    /// Add values to the attribute.
    Add = 0,
    /// Delete values from (or the entire) attribute.
    Delete = 1,
    /// Replace all existing values of the attribute.
    Replace = 2,
}

impl ModifyOperation {
    /// Convert a raw integer to a `ModifyOperation`.
    ///
    /// Unrecognised values map to [`ModifyOperation::Replace`].
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ldap_server::codec::ldap_msg::ModifyOperation;
    /// assert!(matches!(ModifyOperation::from_i32(0), ModifyOperation::Add));
    /// ```
    ///
    /// # Panics
    ///
    /// No panics possible.
    pub fn from_i32(val: i32) -> Self {
        match val {
            0 => Self::Add,
            1 => Self::Delete,
            _ => Self::Replace,
        }
    }
}

// ── ModifyDN ───────────────────────────────────────────────────────────────

/// LDAP ModifyDNRequest (RFC 4511 §4.9).
///
/// Renames or moves an entry in the directory tree.
#[derive(Debug, Clone)]
pub struct ModifyDnRequest {
    /// Current distinguished name of the entry.
    pub dn: String,
    /// New relative distinguished name component.
    pub new_rdn: String,
    /// Whether to remove the old RDN value from the entry's attributes.
    pub delete_old_rdn: bool,
    /// New parent DN when moving to a different subtree (optional).
    pub new_superior: Option<String>,
}

// ── Compare ────────────────────────────────────────────────────────────────

/// LDAP CompareRequest (RFC 4511 §4.10).
///
/// Checks whether a specific attribute value exists in an entry.
#[derive(Debug, Clone)]
pub struct CompareRequest {
    /// Distinguished name of the entry to compare against.
    pub dn: String,
    /// Attribute description for the assertion.
    pub attribute: String,
    /// Assertion value as raw bytes.
    pub value: Vec<u8>,
}

// ── Extended ───────────────────────────────────────────────────────────────

/// LDAP ExtendedRequest (RFC 4511 §4.12).
///
/// Carries an OID-identified extended operation with optional opaque value.
#[derive(Debug, Clone)]
pub struct ExtendedRequest {
    /// OID identifying the extended operation (e.g. `"1.3.6.1.4.1.1466.20037"` for StartTLS).
    pub oid: String,
    /// Opaque operation-specific request value, if any.
    pub value: Option<Vec<u8>>,
}

/// LDAP ExtendedResponse (RFC 4511 §4.12).
///
/// Response to an [`ExtendedRequest`].
#[derive(Debug, Clone)]
pub struct ExtendedResponse {
    /// Standard LDAP result fields.
    pub result: LdapResult,
    /// Optional OID echo or operation-specific OID.
    pub oid: Option<String>,
    /// Opaque operation-specific response value, if any.
    pub value: Option<Vec<u8>>,
}

// ── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ldap_result_success() {
        let r = LdapResult::success();
        assert_eq!(r.result_code, ResultCode::Success);
        assert!(r.matched_dn.is_empty());
        assert!(r.diagnostic_message.is_empty());
    }

    #[test]
    fn ldap_result_error() {
        let r = LdapResult::error(ResultCode::InvalidCredentials, "bad password");
        assert_eq!(r.result_code, ResultCode::InvalidCredentials);
        assert_eq!(r.diagnostic_message, "bad password");
        assert!(r.matched_dn.is_empty());
    }

    #[test]
    fn result_code_roundtrip() {
        assert_eq!(ResultCode::from_i32(0), ResultCode::Success);
        assert_eq!(ResultCode::from_i32(49), ResultCode::InvalidCredentials);
        assert_eq!(ResultCode::from_i32(1), ResultCode::OperationsError);
        assert_eq!(ResultCode::from_i32(32), ResultCode::NoSuchObject);
        // Unknown values must map to Other
        assert_eq!(ResultCode::from_i32(999), ResultCode::Other);
        assert_eq!(ResultCode::from_i32(-1), ResultCode::Other);
    }

    #[test]
    fn search_scope_from_i32() {
        assert_eq!(SearchScope::from_i32(0), SearchScope::BaseObject);
        assert_eq!(SearchScope::from_i32(1), SearchScope::SingleLevel);
        assert_eq!(SearchScope::from_i32(2), SearchScope::WholeSubtree);
        // Out-of-range defaults to WholeSubtree
        assert_eq!(SearchScope::from_i32(99), SearchScope::WholeSubtree);
    }

    #[test]
    fn bind_request_simple() {
        let req = BindRequest {
            version: 3,
            name: "cn=admin,dc=example,dc=com".to_string(),
            authentication: BindAuthentication::Simple(b"secret".to_vec()),
        };

        assert_eq!(req.version, 3);
        assert_eq!(req.name, "cn=admin,dc=example,dc=com");

        match &req.authentication {
            BindAuthentication::Simple(pw) => assert_eq!(pw, b"secret"),
            BindAuthentication::Sasl(_) => panic!("expected Simple authentication"),
        }
    }
}
