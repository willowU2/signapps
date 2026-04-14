//! Extract user_id / email / name from the provider's userinfo response
//! using JSONPath expressions defined in the provider catalog.

use crate::error::OAuthError;
use crate::types::ProviderProfile;
use serde_json::Value;

/// Extract a single string value from `body` at the given JSONPath.
///
/// Returns `None` if the path does not match any node, or if the matched
/// node is not a string.
fn extract_string(body: &Value, path: &str) -> Option<String> {
    let nodes = jsonpath_lib::select(body, path).ok()?;
    nodes.first().and_then(|v| v.as_str()).map(String::from)
}

/// Build a ProviderProfile by extracting fields from the userinfo response.
///
/// `user_id_field` is required; if it does not match, returns
/// [`OAuthError::ProviderError`] with `error = "missing_user_id"`.
///
/// # Errors
///
/// Returns [`OAuthError::ProviderError`] if `user_id_field` does not
/// resolve to a string.
pub fn extract_profile(
    body: Value,
    user_id_field: &str,
    user_email_field: Option<&str>,
    user_name_field: Option<&str>,
) -> Result<ProviderProfile, OAuthError> {
    let id = extract_string(&body, user_id_field).ok_or_else(|| OAuthError::ProviderError {
        error: "missing_user_id".to_string(),
        description: Some(format!(
            "user_id_field {user_id_field:?} did not resolve to a string in profile response"
        )),
    })?;
    let email = user_email_field.and_then(|p| extract_string(&body, p));
    let name = user_name_field.and_then(|p| extract_string(&body, p));
    Ok(ProviderProfile {
        id,
        email,
        name,
        raw: body,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn extracts_simple_field() {
        let body = json!({ "sub": "user123", "email": "u@example.com" });
        let p = extract_profile(body, "$.sub", Some("$.email"), None).unwrap();
        assert_eq!(p.id, "user123");
        assert_eq!(p.email.as_deref(), Some("u@example.com"));
        assert_eq!(p.name, None);
    }

    #[test]
    fn extracts_nested_field_twitter_style() {
        // Twitter v2 wraps user in $.data
        let body = json!({ "data": { "id": "456", "name": "Alice" } });
        let p = extract_profile(body, "$.data.id", None, Some("$.data.name")).unwrap();
        assert_eq!(p.id, "456");
        assert_eq!(p.name.as_deref(), Some("Alice"));
    }

    #[test]
    fn extracts_dropbox_nested_name() {
        // Dropbox: $.name.display_name
        let body = json!({
            "account_id": "dbid:abc",
            "email": "user@dropbox.com",
            "name": { "display_name": "Bob" }
        });
        let p = extract_profile(
            body,
            "$.account_id",
            Some("$.email"),
            Some("$.name.display_name"),
        )
        .unwrap();
        assert_eq!(p.id, "dbid:abc");
        assert_eq!(p.name.as_deref(), Some("Bob"));
    }

    #[test]
    fn missing_user_id_is_provider_error() {
        let body = json!({ "email": "u@example.com" });
        let err = extract_profile(body, "$.sub", None, None).unwrap_err();
        assert!(
            matches!(err, OAuthError::ProviderError { ref error, .. } if error == "missing_user_id")
        );
    }

    #[test]
    fn missing_optional_fields_are_none() {
        let body = json!({ "sub": "u" });
        let p = extract_profile(body, "$.sub", Some("$.missing"), Some("$.also_missing")).unwrap();
        assert_eq!(p.email, None);
        assert_eq!(p.name, None);
    }

    #[test]
    fn handles_numeric_user_id() {
        // GitHub returns id as a number — JSONPath select returns it,
        // but as_str() returns None. Verify our extractor surfaces this
        // as missing_user_id rather than panicking.
        let body = json!({ "id": 12345 });
        let err = extract_profile(body, "$.id", None, None).unwrap_err();
        assert!(
            matches!(err, OAuthError::ProviderError { ref error, .. } if error == "missing_user_id")
        );
    }
}
