//! GraphQL layer configuration and setup for federated schema support.

use serde::{Deserialize, Serialize};

/// GraphQL configuration for the application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphQlConfig {
    /// GraphQL endpoint URL (e.g., "http://localhost:4000/graphql")
    pub endpoint: String,

    /// Enable GraphQL playground for interactive query testing
    pub playground_enabled: bool,

    /// Maximum query depth to prevent deeply nested queries (0 = unlimited)
    pub max_depth: u32,
}

impl GraphQlConfig {
    /// Creates a new GraphQL configuration
    pub fn new(endpoint: String, playground_enabled: bool, max_depth: u32) -> Self {
        Self {
            endpoint,
            playground_enabled,
            max_depth,
        }
    }

    /// Default configuration for development
    pub fn dev() -> Self {
        Self {
            endpoint: "http://localhost:4000/graphql".to_string(),
            playground_enabled: true,
            max_depth: 10,
        }
    }

    /// Production configuration (stricter settings)
    pub fn production(endpoint: String) -> Self {
        Self {
            endpoint,
            playground_enabled: false,
            max_depth: 8,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_graphql_config_creation() {
        let config = GraphQlConfig::new(
            "http://localhost:4000/graphql".to_string(),
            true,
            10,
        );
        assert_eq!(config.endpoint, "http://localhost:4000/graphql");
        assert!(config.playground_enabled);
        assert_eq!(config.max_depth, 10);
    }
}
