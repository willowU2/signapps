//! Core JMAP protocol types (RFC 8620 Section 3).
//!
//! Defines the fundamental request/response envelope types used by all JMAP
//! method calls. These types are protocol-level — they carry method names and
//! opaque JSON arguments, leaving interpretation to the method dispatch layer.

use serde::{Deserialize, Serialize};

/// A JMAP request object (RFC 8620 Section 3.3).
///
/// Contains the set of capabilities the client expects (`using`) and the
/// ordered list of method calls to invoke.
///
/// # Examples
///
/// ```
/// use signapps_jmap::types::JmapRequest;
///
/// let json = r#"{
///     "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
///     "methodCalls": [
///         ["Email/get", {"accountId": "u1", "ids": ["m1"]}, "c0"]
///     ]
/// }"#;
/// let req: JmapRequest = serde_json::from_str(json).unwrap();
/// assert_eq!(req.using.len(), 2);
/// assert_eq!(req.method_calls.len(), 1);
/// ```
///
/// # Errors
///
/// Deserialization fails if `using` or `methodCalls` are missing.
///
/// # Panics
///
/// None.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JmapRequest {
    /// List of JMAP capability URIs the client wants to use.
    pub using: Vec<String>,

    /// Ordered list of method calls to execute.
    #[serde(rename = "methodCalls")]
    pub method_calls: Vec<MethodCall>,

    /// Optional map of result reference creation IDs.
    #[serde(rename = "createdIds", skip_serializing_if = "Option::is_none")]
    pub created_ids: Option<serde_json::Map<String, serde_json::Value>>,
}

/// A single JMAP method call within a request (RFC 8620 Section 3.2).
///
/// Represented as a 3-tuple: `[method_name, arguments, call_id]`.
/// We use a custom (de)serializer to handle the JSON array format.
///
/// # Examples
///
/// ```
/// use signapps_jmap::types::MethodCall;
///
/// let mc = MethodCall {
///     name: "Email/get".to_string(),
///     args: serde_json::json!({"accountId": "u1", "ids": ["m1"]}),
///     call_id: "c0".to_string(),
/// };
/// let json = serde_json::to_value(&mc).unwrap();
/// assert!(json.is_array());
/// ```
///
/// # Panics
///
/// None.
#[derive(Debug, Clone)]
pub struct MethodCall {
    /// Method name, e.g. `"Email/get"`, `"Mailbox/query"`.
    pub name: String,
    /// Method arguments as an opaque JSON object.
    pub args: serde_json::Value,
    /// Client-assigned call identifier for correlating responses.
    pub call_id: String,
}

impl Serialize for MethodCall {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeSeq;
        let mut seq = serializer.serialize_seq(Some(3))?;
        seq.serialize_element(&self.name)?;
        seq.serialize_element(&self.args)?;
        seq.serialize_element(&self.call_id)?;
        seq.end()
    }
}

impl<'de> Deserialize<'de> for MethodCall {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let arr: Vec<serde_json::Value> = Vec::deserialize(deserializer)?;
        if arr.len() != 3 {
            return Err(serde::de::Error::custom(format!(
                "MethodCall must be a 3-element array, got {}",
                arr.len()
            )));
        }

        let name = arr[0]
            .as_str()
            .ok_or_else(|| serde::de::Error::custom("MethodCall[0] must be a string"))?
            .to_string();
        let args = arr[1].clone();
        let call_id = arr[2]
            .as_str()
            .ok_or_else(|| serde::de::Error::custom("MethodCall[2] must be a string"))?
            .to_string();

        Ok(MethodCall {
            name,
            args,
            call_id,
        })
    }
}

/// A JMAP response object (RFC 8620 Section 3.4).
///
/// Contains the ordered list of method responses and the current session state.
///
/// # Examples
///
/// ```
/// use signapps_jmap::types::{JmapResponse, MethodResponse};
///
/// let resp = JmapResponse {
///     method_responses: vec![MethodResponse {
///         name: "Email/get".to_string(),
///         args: serde_json::json!({"list": [], "notFound": []}),
///         call_id: "c0".to_string(),
///     }],
///     session_state: "abc123".to_string(),
///     created_ids: None,
/// };
/// let json = serde_json::to_string(&resp).unwrap();
/// assert!(json.contains("methodResponses"));
/// ```
///
/// # Panics
///
/// None.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JmapResponse {
    /// Ordered list of method responses.
    #[serde(rename = "methodResponses")]
    pub method_responses: Vec<MethodResponse>,

    /// Opaque string representing the current session state.
    #[serde(rename = "sessionState")]
    pub session_state: String,

    /// Map of creation IDs to server-assigned IDs.
    #[serde(rename = "createdIds", skip_serializing_if = "Option::is_none")]
    pub created_ids: Option<serde_json::Map<String, serde_json::Value>>,
}

/// A single method response within a JMAP response (RFC 8620 Section 3.4).
///
/// Same 3-tuple serialization as [`MethodCall`]: `[name, args, call_id]`.
///
/// # Panics
///
/// None.
#[derive(Debug, Clone)]
pub struct MethodResponse {
    /// Method name (e.g. `"Email/get"`, `"error"`).
    pub name: String,
    /// Response arguments as an opaque JSON object.
    pub args: serde_json::Value,
    /// Call identifier matching the request's [`MethodCall::call_id`].
    pub call_id: String,
}

impl Serialize for MethodResponse {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeSeq;
        let mut seq = serializer.serialize_seq(Some(3))?;
        seq.serialize_element(&self.name)?;
        seq.serialize_element(&self.args)?;
        seq.serialize_element(&self.call_id)?;
        seq.end()
    }
}

impl<'de> Deserialize<'de> for MethodResponse {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let arr: Vec<serde_json::Value> = Vec::deserialize(deserializer)?;
        if arr.len() != 3 {
            return Err(serde::de::Error::custom(format!(
                "MethodResponse must be a 3-element array, got {}",
                arr.len()
            )));
        }

        let name = arr[0]
            .as_str()
            .ok_or_else(|| serde::de::Error::custom("MethodResponse[0] must be a string"))?
            .to_string();
        let args = arr[1].clone();
        let call_id = arr[2]
            .as_str()
            .ok_or_else(|| serde::de::Error::custom("MethodResponse[2] must be a string"))?
            .to_string();

        Ok(MethodResponse {
            name,
            args,
            call_id,
        })
    }
}

impl MethodResponse {
    /// Create an error response for a given call.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_jmap::types::MethodResponse;
    /// use signapps_jmap::error::MethodError;
    ///
    /// let resp = MethodResponse::error("c0", MethodError::not_found("gone"));
    /// assert_eq!(resp.name, "error");
    /// ```
    pub fn error(call_id: impl Into<String>, err: crate::error::MethodError) -> Self {
        Self {
            name: "error".to_string(),
            args: serde_json::to_value(&err).unwrap_or_default(),
            call_id: call_id.into(),
        }
    }
}

/// Standard JMAP capabilities URIs.
pub mod capabilities {
    /// JMAP Core (RFC 8620).
    pub const CORE: &str = "urn:ietf:params:jmap:core";
    /// JMAP Mail (RFC 8621).
    pub const MAIL: &str = "urn:ietf:params:jmap:mail";
    /// JMAP Submission (RFC 8621).
    pub const SUBMISSION: &str = "urn:ietf:params:jmap:submission";
    /// JMAP Vacation Response (RFC 8621).
    pub const VACATION_RESPONSE: &str = "urn:ietf:params:jmap:vacationresponse";
}

/// Common JMAP get request arguments (RFC 8620 Section 5.1).
///
/// Used by `Foo/get` methods.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetRequest {
    /// The account ID to use.
    #[serde(rename = "accountId")]
    pub account_id: String,

    /// List of IDs to fetch. `None` means fetch all.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ids: Option<Vec<String>>,

    /// Subset of properties to return. `None` means all.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<Vec<String>>,
}

/// Common JMAP get response (RFC 8620 Section 5.1).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetResponse {
    /// The account ID.
    #[serde(rename = "accountId")]
    pub account_id: String,

    /// Current state string for this object type.
    pub state: String,

    /// List of objects.
    pub list: Vec<serde_json::Value>,

    /// IDs that were requested but not found.
    #[serde(rename = "notFound")]
    pub not_found: Vec<String>,
}

/// Common JMAP query request arguments (RFC 8620 Section 5.5).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryRequest {
    /// The account ID to use.
    #[serde(rename = "accountId")]
    pub account_id: String,

    /// Filter conditions (type-specific).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter: Option<serde_json::Value>,

    /// Sort criteria.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort: Option<Vec<SortComparator>>,

    /// Zero-based position to start returning results from.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<i64>,

    /// Maximum number of results to return.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i64>,

    /// Whether to calculate the total number of results.
    #[serde(rename = "calculateTotal", skip_serializing_if = "Option::is_none")]
    pub calculate_total: Option<bool>,
}

/// JMAP sort comparator (RFC 8620 Section 5.5).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortComparator {
    /// Property name to sort by.
    pub property: String,

    /// Whether to sort ascending (default `true`).
    #[serde(rename = "isAscending", default = "default_true")]
    pub is_ascending: bool,
}

fn default_true() -> bool {
    true
}

/// Common JMAP query response (RFC 8620 Section 5.5).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResponse {
    /// The account ID.
    #[serde(rename = "accountId")]
    pub account_id: String,

    /// Current state string for this query.
    #[serde(rename = "queryState")]
    pub query_state: String,

    /// Whether the server can calculate changes from this state.
    #[serde(rename = "canCalculateChanges")]
    pub can_calculate_changes: bool,

    /// Zero-based position of the first result.
    pub position: i64,

    /// List of IDs matching the query.
    pub ids: Vec<String>,

    /// Total number of results (if `calculateTotal` was true).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<i64>,
}

/// Common JMAP set request arguments (RFC 8620 Section 5.3).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetRequest {
    /// The account ID to use.
    #[serde(rename = "accountId")]
    pub account_id: String,

    /// Conditional update: expected current state.
    #[serde(rename = "ifInState", skip_serializing_if = "Option::is_none")]
    pub if_in_state: Option<String>,

    /// Map of creation ID -> object to create.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub create: Option<serde_json::Map<String, serde_json::Value>>,

    /// Map of ID -> patch object to update.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub update: Option<serde_json::Map<String, serde_json::Value>>,

    /// List of IDs to destroy.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub destroy: Option<Vec<String>>,
}

/// Common JMAP set response (RFC 8620 Section 5.3).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetResponse {
    /// The account ID.
    #[serde(rename = "accountId")]
    pub account_id: String,

    /// Previous state before the changes.
    #[serde(rename = "oldState")]
    pub old_state: String,

    /// New state after the changes.
    #[serde(rename = "newState")]
    pub new_state: String,

    /// Map of creation ID -> created object.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created: Option<serde_json::Map<String, serde_json::Value>>,

    /// Map of ID -> updated object (or null if no properties changed).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated: Option<serde_json::Map<String, serde_json::Value>>,

    /// List of destroyed IDs.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub destroyed: Option<Vec<String>>,

    /// Map of creation ID -> SetError for failed creates.
    #[serde(rename = "notCreated", skip_serializing_if = "Option::is_none")]
    pub not_created: Option<serde_json::Map<String, serde_json::Value>>,

    /// Map of ID -> SetError for failed updates.
    #[serde(rename = "notUpdated", skip_serializing_if = "Option::is_none")]
    pub not_updated: Option<serde_json::Map<String, serde_json::Value>>,

    /// Map of ID -> SetError for failed destroys.
    #[serde(rename = "notDestroyed", skip_serializing_if = "Option::is_none")]
    pub not_destroyed: Option<serde_json::Map<String, serde_json::Value>>,
}

/// Common JMAP changes request (RFC 8620 Section 5.2).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangesRequest {
    /// The account ID to use.
    #[serde(rename = "accountId")]
    pub account_id: String,

    /// The state from which to calculate changes.
    #[serde(rename = "sinceState")]
    pub since_state: String,

    /// Maximum number of IDs to return.
    #[serde(rename = "maxChanges", skip_serializing_if = "Option::is_none")]
    pub max_changes: Option<i64>,
}

/// Common JMAP changes response (RFC 8620 Section 5.2).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangesResponse {
    /// The account ID.
    #[serde(rename = "accountId")]
    pub account_id: String,

    /// The state provided by the client.
    #[serde(rename = "oldState")]
    pub old_state: String,

    /// The new (current) state.
    #[serde(rename = "newState")]
    pub new_state: String,

    /// Whether the server has more changes.
    #[serde(rename = "hasMoreChanges")]
    pub has_more_changes: bool,

    /// IDs of objects created since `sinceState`.
    pub created: Vec<String>,

    /// IDs of objects updated since `sinceState`.
    pub updated: Vec<String>,

    /// IDs of objects destroyed since `sinceState`.
    pub destroyed: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jmap_request_round_trip() {
        let json = r#"{
            "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
            "methodCalls": [
                ["Email/get", {"accountId": "u1", "ids": ["m1"]}, "c0"],
                ["Mailbox/get", {"accountId": "u1"}, "c1"]
            ]
        }"#;

        let req: JmapRequest = serde_json::from_str(json).expect("deserialize request");
        assert_eq!(req.using.len(), 2);
        assert_eq!(req.using[0], capabilities::CORE);
        assert_eq!(req.method_calls.len(), 2);
        assert_eq!(req.method_calls[0].name, "Email/get");
        assert_eq!(req.method_calls[0].call_id, "c0");
        assert_eq!(req.method_calls[1].name, "Mailbox/get");

        // Round-trip
        let serialized = serde_json::to_string(&req).expect("serialize");
        let req2: JmapRequest = serde_json::from_str(&serialized).expect("deserialize again");
        assert_eq!(req2.method_calls.len(), 2);
    }

    #[test]
    fn jmap_response_serialization() {
        let resp = JmapResponse {
            method_responses: vec![
                MethodResponse {
                    name: "Email/get".to_string(),
                    args: serde_json::json!({
                        "accountId": "u1",
                        "state": "s1",
                        "list": [{"id": "m1", "subject": "Hello"}],
                        "notFound": []
                    }),
                    call_id: "c0".to_string(),
                },
                MethodResponse {
                    name: "Mailbox/get".to_string(),
                    args: serde_json::json!({
                        "accountId": "u1",
                        "state": "s2",
                        "list": [],
                        "notFound": []
                    }),
                    call_id: "c1".to_string(),
                },
            ],
            session_state: "state-42".to_string(),
            created_ids: None,
        };

        let json = serde_json::to_value(&resp).expect("serialize response");
        let responses = json["methodResponses"].as_array().expect("array");
        assert_eq!(responses.len(), 2);

        // Each response is a 3-element array
        assert_eq!(responses[0][0], "Email/get");
        assert_eq!(responses[0][2], "c0");
        assert_eq!(json["sessionState"], "state-42");
    }

    #[test]
    fn method_call_rejects_wrong_length() {
        let json = r#"["Email/get", {}]"#;
        let result = serde_json::from_str::<MethodCall>(json);
        assert!(result.is_err());
    }

    #[test]
    fn error_response_construction() {
        let err_resp = MethodResponse::error(
            "c0",
            crate::error::MethodError::not_found("Email abc-123 not found"),
        );
        assert_eq!(err_resp.name, "error");
        assert_eq!(err_resp.call_id, "c0");
        assert_eq!(err_resp.args["type"], "notFound");
    }

    #[test]
    fn get_request_deserialization() {
        let json = r#"{"accountId":"u1","ids":["m1","m2"],"properties":["subject","from"]}"#;
        let req: GetRequest = serde_json::from_str(json).expect("deserialize");
        assert_eq!(req.account_id, "u1");
        assert_eq!(req.ids.as_ref().unwrap().len(), 2);
        assert_eq!(req.properties.as_ref().unwrap().len(), 2);
    }

    #[test]
    fn query_request_with_sort() {
        let json = r#"{
            "accountId": "u1",
            "filter": {"inMailbox": "inbox"},
            "sort": [{"property": "receivedAt", "isAscending": false}],
            "position": 0,
            "limit": 50,
            "calculateTotal": true
        }"#;
        let req: QueryRequest = serde_json::from_str(json).expect("deserialize");
        assert_eq!(req.account_id, "u1");
        let sort = req.sort.as_ref().unwrap();
        assert_eq!(sort[0].property, "receivedAt");
        assert!(!sort[0].is_ascending);
        assert_eq!(req.limit, Some(50));
    }

    #[test]
    fn set_request_with_create_and_destroy() {
        let json = r#"{
            "accountId": "u1",
            "create": {
                "k1": {"subject": "Hello", "from": [{"email": "a@b.com"}]}
            },
            "destroy": ["m-old-1", "m-old-2"]
        }"#;
        let req: SetRequest = serde_json::from_str(json).expect("deserialize");
        assert!(req.create.is_some());
        assert_eq!(req.destroy.as_ref().unwrap().len(), 2);
    }

    #[test]
    fn changes_response_round_trip() {
        let resp = ChangesResponse {
            account_id: "u1".to_string(),
            old_state: "s1".to_string(),
            new_state: "s2".to_string(),
            has_more_changes: false,
            created: vec!["m3".to_string()],
            updated: vec!["m1".to_string()],
            destroyed: vec!["m2".to_string()],
        };
        let json = serde_json::to_string(&resp).expect("serialize");
        let resp2: ChangesResponse = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(resp2.new_state, "s2");
        assert_eq!(resp2.created.len(), 1);
    }
}
