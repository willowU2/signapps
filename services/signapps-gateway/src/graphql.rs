//! DA3: Minimal GraphQL gateway handler.
//!
//! Implements a JSON-based GraphQL-compatible endpoint that routes queries
//! to the appropriate internal REST APIs without requiring `async-graphql`.
//!
//! This is a minimal implementation — it supports the core query schema:
//!   Query {
//!     me: User
//!     users(limit: Int): [User]
//!     emails(limit: Int): [Email]
//!     events(limit: Int): [Event]
//!     contacts(limit: Int): [Contact]
//!   }
//!
//! Resolvers call the internal REST APIs of the corresponding services.
//! Each resolver includes the original Authorization header from the client.
//!
//! Endpoint: POST /api/v1/graphql

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Incoming GraphQL request (POST body).
#[derive(Debug, Deserialize)]
pub struct GraphQLRequest {
    pub query: String,
    #[serde(default)]
    pub variables: Option<Value>,
    #[serde(default)]
    pub operation_name: Option<String>,
}

/// GraphQL response envelope.
#[derive(Debug, Serialize)]
pub struct GraphQLResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<GraphQLError>>,
}

/// A single GraphQL error.
#[derive(Debug, Serialize)]
pub struct GraphQLError {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<Vec<String>>,
}

/// Internal service URLs bundled in the gateway state.
#[derive(Clone)]
pub struct ServiceUrls {
    pub identity: String,
    pub mail: String,
    pub calendar: String,
    pub contacts: String,
}

impl ServiceUrls {
    pub fn from_env() -> Self {
        let env_or = |k: &str, default: &str| -> String {
            std::env::var(k).unwrap_or_else(|_| default.to_string())
        };
        Self {
            identity: env_or("IDENTITY_SERVICE_URL", "http://127.0.0.1:3001"),
            mail: env_or("MAIL_SERVICE_URL", "http://127.0.0.1:3012"),
            calendar: env_or("CALENDAR_SERVICE_URL", "http://127.0.0.1:3011"),
            contacts: env_or("CONTACTS_SERVICE_URL", "http://127.0.0.1:3021"),
        }
    }
}

// ---------------------------------------------------------------------------
// HTTP client helper
// ---------------------------------------------------------------------------

fn make_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("reqwest client")
}

/// Forward an authenticated GET request to an internal service.
async fn proxy_get(
    client: &reqwest::Client,
    url: &str,
    auth_header: Option<&str>,
) -> Result<Value, String> {
    let mut req = client.get(url);
    if let Some(auth) = auth_header {
        req = req.header("authorization", auth);
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let body = resp.json::<Value>().await.map_err(|e| e.to_string())?;

    if status.is_success() {
        Ok(body)
    } else {
        Err(format!("HTTP {}: {}", status, body))
    }
}

// ---------------------------------------------------------------------------
// Query parser
// ---------------------------------------------------------------------------

/// Very lightweight GraphQL query parser.
///
/// Extracts the top-level field names from a query string.
/// Supports only simple queries without fragments (sufficient for our schema).
///
/// Examples:
///   `query { me { id } }` → ["me"]
///   `{ users(limit: 5) { id } me { id } }` → ["users", "me"]
fn extract_fields(query: &str) -> Vec<String> {
    let mut fields = Vec::new();
    // Strip query/mutation wrapper if present
    let inner = if let Some(start) = query.find('{') {
        &query[start + 1..]
    } else {
        query
    };

    // Extract identifiers at the top level (before nested braces)
    let mut depth = 0usize;
    let mut current = String::new();

    for ch in inner.chars() {
        match ch {
            '{' => {
                if depth == 0 && !current.trim().is_empty() {
                    let field = current
                        .trim()
                        .split('(')
                        .next()
                        .unwrap_or("")
                        .trim()
                        .to_string();
                    if !field.is_empty() && field != "query" && field != "mutation" {
                        fields.push(field);
                    }
                    current.clear();
                }
                depth += 1;
            },
            '}' => {
                if depth > 0 {
                    depth -= 1;
                }
            },
            _ if depth == 0 => {
                if ch == '\n' || ch == '\r' {
                    let trimmed = current.trim().to_string();
                    if !trimmed.is_empty() && !trimmed.starts_with('#') {
                        let field = trimmed.split('(').next().unwrap_or("").trim().to_string();
                        if !field.is_empty() {
                            fields.push(field);
                        }
                        current.clear();
                    }
                } else {
                    current.push(ch);
                }
            },
            _ => {},
        }
    }

    // Catch any remaining field
    let trimmed = current.trim().to_string();
    if !trimmed.is_empty() {
        let field = trimmed.split('(').next().unwrap_or("").trim().to_string();
        if !field.is_empty() {
            fields.push(field);
        }
    }

    fields.into_iter().filter(|f| !f.is_empty()).collect()
}

/// Extract a named integer argument from the query string.
fn extract_int_arg(query: &str, field: &str, arg: &str) -> Option<i64> {
    // Look for patterns like `fieldname(arg: 10)` or `fieldname(arg:10)`
    let pattern = format!("{}(", field);
    if let Some(pos) = query.find(&pattern) {
        let args_str = &query[pos + pattern.len()..];
        let arg_pattern = format!("{}:", arg);
        if let Some(arg_pos) = args_str.find(&arg_pattern) {
            let val_str = args_str[arg_pos + arg_pattern.len()..].trim_start();
            let val: String = val_str.chars().take_while(|c| c.is_ascii_digit()).collect();
            return val.parse().ok();
        }
    }
    None
}

// ---------------------------------------------------------------------------
// GraphQL handler
// ---------------------------------------------------------------------------

/// POST /api/v1/graphql — Minimal GraphQL gateway.
pub async fn graphql_handler(
    State(svc): State<Arc<ServiceUrls>>,
    headers: HeaderMap,
    Json(req): Json<GraphQLRequest>,
) -> (StatusCode, Json<GraphQLResponse>) {
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    let auth_ref = auth.as_deref();
    let client = make_client();
    let fields = extract_fields(&req.query);

    // Introspection shortcut — return a minimal schema description
    if req.query.contains("__schema") || req.query.contains("__type") {
        let schema = json!({
            "__schema": {
                "queryType": { "name": "Query" },
                "types": [
                    { "name": "Query", "kind": "OBJECT" },
                    { "name": "User",  "kind": "OBJECT" },
                    { "name": "Email", "kind": "OBJECT" },
                    { "name": "Event", "kind": "OBJECT" },
                    { "name": "Contact", "kind": "OBJECT" },
                ]
            }
        });
        return (
            StatusCode::OK,
            Json(GraphQLResponse {
                data: Some(schema),
                errors: None,
            }),
        );
    }

    let mut data = serde_json::Map::new();
    let mut errors: Vec<GraphQLError> = Vec::new();

    for field in &fields {
        match field.as_str() {
            "me" => {
                let url = format!("{}/api/v1/auth/me", svc.identity);
                match proxy_get(&client, &url, auth_ref).await {
                    Ok(val) => {
                        data.insert("me".into(), val);
                    },
                    Err(e) => errors.push(GraphQLError {
                        message: format!("me: {}", e),
                        path: Some(vec!["me".into()]),
                    }),
                }
            },
            "users" => {
                let limit = extract_int_arg(&req.query, "users", "limit").unwrap_or(10);
                let url = format!("{}/api/v1/users?limit={}", svc.identity, limit);
                match proxy_get(&client, &url, auth_ref).await {
                    Ok(val) => {
                        data.insert("users".into(), val);
                    },
                    Err(e) => errors.push(GraphQLError {
                        message: format!("users: {}", e),
                        path: Some(vec!["users".into()]),
                    }),
                }
            },
            "emails" => {
                let limit = extract_int_arg(&req.query, "emails", "limit").unwrap_or(20);
                let url = format!("{}/api/v1/mail/emails?limit={}", svc.mail, limit);
                match proxy_get(&client, &url, auth_ref).await {
                    Ok(val) => {
                        data.insert("emails".into(), val);
                    },
                    Err(e) => errors.push(GraphQLError {
                        message: format!("emails: {}", e),
                        path: Some(vec!["emails".into()]),
                    }),
                }
            },
            "events" => {
                let limit = extract_int_arg(&req.query, "events", "limit").unwrap_or(20);
                let url = format!("{}/api/v1/calendar/events?limit={}", svc.calendar, limit);
                match proxy_get(&client, &url, auth_ref).await {
                    Ok(val) => {
                        data.insert("events".into(), val);
                    },
                    Err(e) => errors.push(GraphQLError {
                        message: format!("events: {}", e),
                        path: Some(vec!["events".into()]),
                    }),
                }
            },
            "contacts" => {
                let limit = extract_int_arg(&req.query, "contacts", "limit").unwrap_or(20);
                let url = format!("{}/api/v1/contacts?limit={}", svc.contacts, limit);
                match proxy_get(&client, &url, auth_ref).await {
                    Ok(val) => {
                        data.insert("contacts".into(), val);
                    },
                    Err(e) => errors.push(GraphQLError {
                        message: format!("contacts: {}", e),
                        path: Some(vec!["contacts".into()]),
                    }),
                }
            },
            unknown => {
                errors.push(GraphQLError {
                    message: format!("Unknown field: {}", unknown),
                    path: Some(vec![unknown.to_string()]),
                });
            },
        }
    }

    if fields.is_empty() {
        errors.push(GraphQLError {
            message: "No fields requested in query".to_string(),
            path: None,
        });
    }

    let has_errors = !errors.is_empty();
    let response_errors = if has_errors { Some(errors) } else { None };
    let response_data = if data.is_empty() {
        None
    } else {
        Some(Value::Object(data))
    };

    (
        StatusCode::OK,
        Json(GraphQLResponse {
            data: response_data,
            errors: response_errors,
        }),
    )
}

// ---------------------------------------------------------------------------
// Schema introspection endpoint
// ---------------------------------------------------------------------------

/// GET /api/v1/graphql/schema — Returns the GraphQL SDL schema description.
pub async fn graphql_schema() -> Json<Value> {
    Json(json!({
        "schema": r#"
type Query {
  "Get the currently authenticated user"
  me: User

  "List users (admin only)"
  users(limit: Int = 10): [User!]!

  "List emails for the authenticated user"
  emails(limit: Int = 20): [Email!]!

  "List calendar events for the authenticated user"
  events(limit: Int = 20): [Event!]!

  "List contacts for the authenticated user"
  contacts(limit: Int = 20): [Contact!]!
}

type User {
  id: ID!
  username: String!
  email: String
  displayName: String
  role: Int
  createdAt: String
  lastLogin: String
}

type Email {
  id: ID!
  subject: String
  fromAddress: String
  toAddresses: [String!]
  isRead: Boolean
  isStarred: Boolean
  receivedAt: String
}

type Event {
  id: ID!
  title: String!
  startTime: String
  endTime: String
  location: String
  isAllDay: Boolean
}

type Contact {
  id: ID!
  displayName: String
  email: String
  phone: String
  company: String
}
"#
    }))
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_fields_simple() {
        let fields = extract_fields("{ me { id username } }");
        assert!(fields.contains(&"me".to_string()), "should extract 'me'");
    }

    #[test]
    fn test_extract_fields_multiple() {
        let query = r#"
            query {
                me { id }
                users(limit: 5) { id username }
            }
        "#;
        let fields = extract_fields(query);
        assert!(
            fields.iter().any(|f| f == "me"),
            "should extract 'me': {:?}",
            fields
        );
        assert!(
            fields.iter().any(|f| f == "users"),
            "should extract 'users': {:?}",
            fields
        );
    }

    #[test]
    fn test_extract_int_arg() {
        let query = "{ users(limit: 42) { id } }";
        let limit = extract_int_arg(query, "users", "limit");
        assert_eq!(limit, Some(42));
    }

    #[test]
    fn test_extract_int_arg_missing() {
        let query = "{ users { id } }";
        let limit = extract_int_arg(query, "users", "limit");
        assert_eq!(limit, None);
    }

    #[test]
    fn test_graphql_response_serialization() {
        let resp = GraphQLResponse {
            data: Some(json!({ "me": { "id": "1", "username": "admin" } })),
            errors: None,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("me"));
        assert!(
            !json.contains("errors"),
            "errors should not appear when None"
        );
    }
}
