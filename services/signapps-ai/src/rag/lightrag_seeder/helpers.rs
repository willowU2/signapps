//! Shared helpers: security constants, attribute sanitization, and `SeedResult`.

/// Columns that must NEVER be included in knowledge graph entities.
/// These contain passwords, tokens, keys, or other secrets.
pub(super) const SENSITIVE_FIELDS: &[&str] = &[
    "password",
    "password_hash",
    "secret",
    "token",
    "key_data",
    "bind_password",
    "bind_password_encrypted",
    "private_key",
    "client_secret",
    "api_key",
    "mfa_secret",
    "signature",
    "certificate",
    "credentials",
    "salt",
];

/// Tables that must NEVER be seeded into the knowledge graph.
pub(super) const EXCLUDED_TABLES: &[&str] = &[
    "identity.sessions",
    "identity.api_keys",
    "identity.sso_configs",
    "identity.ldap_config",
    "ad_principal_keys",
    "ad_dns_records",
    "ai.kg_entities",
    "ai.kg_relations",
    "ai.kg_communities",
    "ai.document_vectors",
    "ai.multimodal_vectors",
];

/// Remove any sensitive fields from a JSON value before storing in the KG.
///
/// Iterates all keys of a JSON object and drops any whose lowercase form
/// contains a name from [`SENSITIVE_FIELDS`]. Non-object values pass through
/// unchanged.
///
/// # Examples
///
/// ```
/// let attrs = serde_json::json!({"username": "alice", "password_hash": "argon2…"});
/// let clean = sanitize_attributes(attrs);
/// assert!(clean.get("username").is_some());
/// assert!(clean.get("password_hash").is_none());
/// ```
pub(super) fn sanitize_attributes(attrs: serde_json::Value) -> serde_json::Value {
    match attrs {
        serde_json::Value::Object(mut map) => {
            map.retain(|key, _| {
                let key_lower = key.to_lowercase();
                !SENSITIVE_FIELDS.iter().any(|s| key_lower.contains(s))
            });
            serde_json::Value::Object(map)
        }
        other => other,
    }
}

/// Result of a seeding operation.
///
/// # Examples
///
/// ```
/// let r = SeedResult {
///     entities_created: 10,
///     relations_created: 5,
///     source: "identity.users".to_string(),
/// };
/// assert_eq!(r.entities_created, 10);
/// ```
#[derive(Debug, Clone, serde::Serialize)]
pub struct SeedResult {
    /// Number of entities created or updated.
    pub entities_created: usize,
    /// Number of relations created or updated.
    pub relations_created: usize,
    /// Source table that was seeded.
    pub source: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_result_serializable() {
        let r = SeedResult {
            entities_created: 10,
            relations_created: 5,
            source: "test".to_string(),
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("entities_created"));
    }

    #[test]
    fn sanitize_removes_passwords() {
        let attrs = serde_json::json!({
            "username": "admin",
            "password_hash": "argon2...",
            "email": "admin@example.com",
            "mfa_secret": "JBSWY3DPEHPK3PXP"
        });
        let clean = sanitize_attributes(attrs);
        assert!(clean.get("username").is_some());
        assert!(clean.get("email").is_some());
        assert!(clean.get("password_hash").is_none());
        assert!(clean.get("mfa_secret").is_none());
    }

    #[test]
    fn sanitize_removes_all_sensitive_variants() {
        let attrs = serde_json::json!({
            "id": "abc123",
            "secret": "topsecret",
            "token": "jwt.token.here",
            "key_data": "binary-key",
            "client_secret": "oauth-secret",
            "certificate": "-----BEGIN CERT-----",
            "salt": "random-salt",
            "safe_field": "this is fine",
        });
        let clean = sanitize_attributes(attrs);
        assert!(clean.get("id").is_some());
        assert!(clean.get("safe_field").is_some());
        assert!(clean.get("secret").is_none());
        assert!(clean.get("token").is_none());
        assert!(clean.get("key_data").is_none());
        assert!(clean.get("client_secret").is_none());
        assert!(clean.get("certificate").is_none());
        assert!(clean.get("salt").is_none());
    }

    #[test]
    fn sanitize_non_object_passthrough() {
        let val = serde_json::Value::String("plain string".to_string());
        let result = sanitize_attributes(val.clone());
        assert_eq!(result, val);
    }

    #[test]
    fn excluded_tables_contains_sensitive() {
        assert!(EXCLUDED_TABLES.contains(&"identity.sessions"));
        assert!(EXCLUDED_TABLES.contains(&"identity.api_keys"));
        assert!(EXCLUDED_TABLES.contains(&"identity.sso_configs"));
        assert!(EXCLUDED_TABLES.contains(&"identity.ldap_config"));
        assert!(EXCLUDED_TABLES.contains(&"ad_principal_keys"));
        assert!(EXCLUDED_TABLES.contains(&"ai.kg_entities"));
    }

    #[test]
    fn sensitive_fields_covers_common_secrets() {
        assert!(SENSITIVE_FIELDS.contains(&"password_hash"));
        assert!(SENSITIVE_FIELDS.contains(&"mfa_secret"));
        assert!(SENSITIVE_FIELDS.contains(&"api_key"));
        assert!(SENSITIVE_FIELDS.contains(&"private_key"));
        assert!(SENSITIVE_FIELDS.contains(&"bind_password"));
    }
}
