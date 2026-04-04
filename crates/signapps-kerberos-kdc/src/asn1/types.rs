//! Kerberos ASN.1 type definitions (RFC 4120).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Kerberos message types.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum MessageType {
    /// Authentication Service Request.
    AsReq = 10,
    /// Authentication Service Reply.
    AsRep = 11,
    /// Ticket Granting Service Request.
    TgsReq = 12,
    /// Ticket Granting Service Reply.
    TgsRep = 13,
    /// Application Request.
    ApReq = 14,
    /// Application Reply.
    ApRep = 15,
    /// Kerberos error message.
    KrbError = 30,
}

/// Encryption type identifiers (RFC 4120 §8.3, RFC 4757 §8).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum EncType {
    /// DES-CBC-MD5 (legacy, deprecated).
    DesCbcMd5 = 3,
    /// AES128-CTS-HMAC-SHA1-96 (RFC 3962).
    Aes128CtsHmacSha196 = 17,
    /// AES256-CTS-HMAC-SHA1-96 (RFC 3962).
    Aes256CtsHmacSha196 = 18,
    /// RC4-HMAC (Windows legacy, RFC 4757).
    Rc4Hmac = 23,
}

impl EncType {
    /// Convert from an integer encryption type identifier.
    ///
    /// Returns `None` if the value is not a recognised type.
    pub fn from_i32(val: i32) -> Option<Self> {
        match val {
            3 => Some(Self::DesCbcMd5),
            17 => Some(Self::Aes128CtsHmacSha196),
            18 => Some(Self::Aes256CtsHmacSha196),
            23 => Some(Self::Rc4Hmac),
            _ => None,
        }
    }
}

/// Kerberos error codes (RFC 4120 §7.5.9).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum KrbErrorCode {
    /// No error.
    None = 0,
    /// `KDC_ERR_C_PRINCIPAL_UNKNOWN` — client not found in Kerberos database.
    ClientNotFound = 6,
    /// `KDC_ERR_S_PRINCIPAL_UNKNOWN` — server not found in Kerberos database.
    ServerNotFound = 7,
    /// `KDC_ERR_BADOPTION` — requested option not supported by KDC.
    BadOption = 13,
    /// `KDC_ERR_ETYPE_NOSUPP` — KDC has no support for encryption type.
    EncTypeNotSupported = 14,
    /// `KDC_ERR_PREAUTH_FAILED` — pre-authentication information was invalid.
    PreAuthFailed = 24,
    /// `KDC_ERR_PREAUTH_REQUIRED` — additional pre-authentication required.
    PreAuthRequired = 25,
    /// `KRB_AP_ERR_SKEW` — clock skew too great.
    ClockSkew = 37,
}

impl KrbErrorCode {
    /// Convert from an integer error code.
    ///
    /// Returns `KrbErrorCode::None` for unrecognised values.
    pub fn from_i32(val: i32) -> Self {
        match val {
            6 => Self::ClientNotFound,
            7 => Self::ServerNotFound,
            13 => Self::BadOption,
            14 => Self::EncTypeNotSupported,
            24 => Self::PreAuthFailed,
            25 => Self::PreAuthRequired,
            37 => Self::ClockSkew,
            _ => Self::None,
        }
    }
}

/// A Kerberos principal name (RFC 4120 §5.2.6).
///
/// Represents names of the form `"user@REALM"` (NT-PRINCIPAL) or
/// `"service/instance@REALM"` (NT-SRV-INST).
///
/// # Examples
///
/// ```
/// use signapps_kerberos_kdc::asn1::types::PrincipalName;
///
/// let user = PrincipalName::user("alice");
/// assert_eq!(user.to_string_with_realm("EXAMPLE.COM"), "alice@EXAMPLE.COM");
///
/// let svc = PrincipalName::krbtgt("EXAMPLE.COM");
/// assert_eq!(svc.to_string_with_realm("EXAMPLE.COM"), "krbtgt/EXAMPLE.COM@EXAMPLE.COM");
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PrincipalName {
    /// Name type: 1 = NT-PRINCIPAL, 2 = NT-SRV-INST.
    pub name_type: i32,
    /// Name components (e.g., `["krbtgt", "EXAMPLE.COM"]`).
    pub components: Vec<String>,
}

impl PrincipalName {
    /// Create a user principal (NT-PRINCIPAL, name-type 1).
    pub fn user(name: &str) -> Self {
        Self {
            name_type: 1,
            components: vec![name.to_string()],
        }
    }

    /// Create a service principal (NT-SRV-INST, name-type 2).
    pub fn service(service: &str, instance: &str) -> Self {
        Self {
            name_type: 2,
            components: vec![service.to_string(), instance.to_string()],
        }
    }

    /// Create a `krbtgt/<realm>` principal used for TGT issuance.
    pub fn krbtgt(realm: &str) -> Self {
        Self::service("krbtgt", realm)
    }

    /// Format as `"name@REALM"` or `"service/instance@REALM"`.
    pub fn to_string_with_realm(&self, realm: &str) -> String {
        let name = self.components.join("/");
        format!("{name}@{realm}")
    }
}

/// Encrypted data container (RFC 4120 §5.2.9).
#[derive(Debug, Clone)]
pub struct EncryptedData {
    /// Encryption algorithm used.
    pub enc_type: EncType,
    /// Key version number (optional).
    pub kvno: Option<i32>,
    /// Ciphertext bytes.
    pub cipher: Vec<u8>,
}

/// A Kerberos ticket (RFC 4120 §5.3).
#[derive(Debug, Clone)]
pub struct Ticket {
    /// Protocol version — always 5.
    pub tkt_vno: i32,
    /// Server realm.
    pub realm: String,
    /// Server principal name.
    pub sname: PrincipalName,
    /// Encrypted ticket contents.
    pub enc_part: EncryptedData,
}

/// AS-REQ or TGS-REQ message (RFC 4120 §5.4.1).
#[derive(Debug, Clone)]
pub struct KdcReq {
    /// Message type (`AsReq` or `TgsReq`).
    pub msg_type: MessageType,
    /// Pre-authentication data list.
    pub padata: Vec<PaData>,
    /// Request body.
    pub body: KdcReqBody,
}

/// Pre-authentication data element (RFC 4120 §5.2.7).
#[derive(Debug, Clone)]
pub struct PaData {
    /// PA-DATA type identifier.
    pub padata_type: i32,
    /// Encoded value bytes.
    pub padata_value: Vec<u8>,
}

/// PA-DATA type constants (RFC 4120 §7.5.2).
pub mod pa_type {
    /// Encrypted timestamp pre-authentication (RFC 4120 §5.2.7.2).
    pub const PA_ENC_TIMESTAMP: i32 = 2;
    /// Encryption type info version 2.
    pub const PA_ETYPE_INFO2: i32 = 19;
    /// PAC request (Microsoft extension).
    pub const PA_PAC_REQUEST: i32 = 128;
}

/// Request body shared between AS-REQ and TGS-REQ (RFC 4120 §5.4.1).
#[derive(Debug, Clone)]
pub struct KdcReqBody {
    /// KDC options flags bitmask.
    pub kdc_options: u32,
    /// Client principal name (AS-REQ only).
    pub cname: Option<PrincipalName>,
    /// Client/server realm.
    pub realm: String,
    /// Requested server principal name.
    pub sname: Option<PrincipalName>,
    /// Requested start time (optional postdated tickets).
    pub from: Option<DateTime<Utc>>,
    /// Requested expiry time.
    pub till: DateTime<Utc>,
    /// Requested renewable until time.
    pub rtime: Option<DateTime<Utc>>,
    /// Random nonce to match reply to request.
    pub nonce: u32,
    /// Supported encryption types in preference order.
    pub etype: Vec<EncType>,
}

/// AS-REP or TGS-REP message (RFC 4120 §5.4.2).
#[derive(Debug, Clone)]
pub struct KdcRep {
    /// Message type (`AsRep` or `TgsRep`).
    pub msg_type: MessageType,
    /// Pre-authentication data list.
    pub padata: Vec<PaData>,
    /// Client realm.
    pub crealm: String,
    /// Client principal name.
    pub cname: PrincipalName,
    /// Issued ticket.
    pub ticket: Ticket,
    /// Encrypted reply part (session key, etc.).
    pub enc_part: EncryptedData,
}

/// KRB-ERROR message (RFC 4120 §5.9.1).
#[derive(Debug, Clone)]
pub struct KrbError {
    /// Error code.
    pub error_code: KrbErrorCode,
    /// Client realm (optional).
    pub crealm: Option<String>,
    /// Client principal name (optional).
    pub cname: Option<PrincipalName>,
    /// Server realm.
    pub realm: String,
    /// Server principal name.
    pub sname: PrincipalName,
    /// Human-readable error text (optional).
    pub e_text: Option<String>,
    /// Additional error data (optional, e.g., ETYPE-INFO2).
    pub e_data: Option<Vec<u8>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn principal_user() {
        let p = PrincipalName::user("admin");
        assert_eq!(p.name_type, 1);
        assert_eq!(p.components, vec!["admin"]);
    }

    #[test]
    fn principal_service() {
        let p = PrincipalName::service("ldap", "dc.example.com");
        assert_eq!(p.name_type, 2);
        assert_eq!(p.components.len(), 2);
        assert_eq!(p.components[0], "ldap");
        assert_eq!(p.components[1], "dc.example.com");
    }

    #[test]
    fn principal_krbtgt() {
        let p = PrincipalName::krbtgt("EXAMPLE.COM");
        assert_eq!(p, PrincipalName::service("krbtgt", "EXAMPLE.COM"));
    }

    #[test]
    fn principal_to_string() {
        let p = PrincipalName::user("admin");
        assert_eq!(p.to_string_with_realm("EXAMPLE.COM"), "admin@EXAMPLE.COM");
    }

    #[test]
    fn enc_type_from_i32() {
        assert_eq!(EncType::from_i32(18), Some(EncType::Aes256CtsHmacSha196));
        assert_eq!(EncType::from_i32(23), Some(EncType::Rc4Hmac));
        assert_eq!(EncType::from_i32(99), None);
    }
}
