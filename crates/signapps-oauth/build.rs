//! Build script — validates `catalog.json` at compile time.
//!
//! If the catalog is malformed (invalid JSON, missing required fields,
//! unparseable URLs), the build FAILS — we never ship a broken catalog.

use serde_json::Value;
use std::fs;

fn main() {
    println!("cargo:rerun-if-changed=catalog.json");

    let content = match fs::read_to_string("catalog.json") {
        Ok(c) => c,
        Err(e) => panic!("build.rs: cannot read catalog.json: {e}"),
    };

    let value: Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(e) => panic!("build.rs: catalog.json is not valid JSON: {e}"),
    };

    let root = value.as_object().expect("root must be an object");
    let _version = root
        .get("version")
        .and_then(|v| v.as_str())
        .expect("catalog.json must have `version` string");
    let providers = root
        .get("providers")
        .and_then(|v| v.as_object())
        .expect("catalog.json must have `providers` object");

    for (key, def) in providers {
        validate_provider(key, def);
    }
}

fn validate_provider(key: &str, def: &Value) {
    let obj = def
        .as_object()
        .unwrap_or_else(|| panic!("provider {key:?} must be an object"));

    // Required fields
    for field in [
        "key",
        "display_name",
        "protocol",
        "authorize_url",
        "access_url",
    ] {
        obj.get(field)
            .unwrap_or_else(|| panic!("provider {key:?} missing required field {field:?}"));
    }

    // `key` field must equal the outer map key
    let inner_key = obj.get("key").and_then(|v| v.as_str()).unwrap();
    assert_eq!(
        inner_key, key,
        "provider {key:?}: inner `key` field {inner_key:?} must match outer map key"
    );

    // Protocol must be one of the known values
    let protocol = obj.get("protocol").and_then(|v| v.as_str()).unwrap();
    assert!(
        matches!(protocol, "OAuth2" | "OAuth1a" | "Oidc" | "Saml"),
        "provider {key:?}: unknown protocol {protocol:?}"
    );

    // URLs must parse (allow {placeholders} for template_vars)
    for field in ["authorize_url", "access_url", "refresh_url", "profile_url", "revoke_url"] {
        if let Some(u) = obj.get(field).and_then(|v| v.as_str()) {
            let cleaned = strip_template_vars(u);
            // After placeholder substitution the result may be a relative path
            // (e.g. when the whole host was a template var like {base_url}).
            // Prepend a dummy scheme+host so the URL parser can still validate
            // the overall structure.
            let to_parse = if cleaned.starts_with("http://") || cleaned.starts_with("https://") {
                cleaned
            } else {
                format!("https://placeholder.example{}", if cleaned.starts_with('/') { cleaned } else { format!("/{cleaned}") })
            };
            if let Err(e) = url::Url::parse(&to_parse) {
                panic!(
                    "provider {key:?}: field {field:?} is not a valid URL ({e}): {u:?}"
                );
            }
        }
    }
}

/// Replace `{placeholder}` substrings with harmless literal values so
/// the URL parser accepts them. This is only for validation — the real
/// substitution happens at runtime in the engine.
fn strip_template_vars(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut iter = s.chars().peekable();
    while let Some(c) = iter.next() {
        if c == '{' {
            // skip until matching }
            for d in iter.by_ref() {
                if d == '}' {
                    out.push_str("placeholder");
                    break;
                }
            }
        } else {
            out.push(c);
        }
    }
    out
}
