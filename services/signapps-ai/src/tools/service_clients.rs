//! HTTP client for calling SignApps microservices.

use reqwest::Client;
use serde_json::Value;
use std::time::Duration;

use super::errors::ToolError;

/// URLs for all SignApps microservices.
#[derive(Debug, Clone)]
pub struct ServiceEndpoints {
    pub identity: String,
    pub containers: String,
    pub proxy: String,
    pub storage: String,
    pub ai: String,
    pub securelink: String,
    pub scheduler: String,
    pub metrics: String,
    pub media: String,
}

impl ServiceEndpoints {
    /// Build endpoints from environment variables with localhost fallbacks.
    pub fn from_env() -> Self {
        Self {
            identity: Self::env_or("IDENTITY_URL", "http://localhost:3001/api/v1"),
            containers: Self::env_or("CONTAINERS_URL", "http://localhost:3002/api/v1"),
            proxy: Self::env_or("PROXY_URL", "http://localhost:3003/api/v1"),
            storage: Self::env_or("STORAGE_URL", "http://localhost:3004/api/v1"),
            ai: Self::env_or("AI_URL", "http://localhost:3005/api/v1"),
            securelink: Self::env_or("SECURELINK_URL", "http://localhost:3006/api/v1"),
            scheduler: Self::env_or("SCHEDULER_URL", "http://localhost:3007/api/v1"),
            metrics: Self::env_or("METRICS_URL", "http://localhost:3008/api/v1"),
            media: Self::env_or("MEDIA_URL", "http://localhost:3009/api/v1"),
        }
    }

    fn env_or(key: &str, default: &str) -> String {
        std::env::var(key)
            .ok()
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| default.to_string())
    }

    /// Resolve a service name to its base URL.
    pub fn resolve(&self, service: &str) -> Result<&str, ToolError> {
        match service {
            "identity" => Ok(&self.identity),
            "containers" => Ok(&self.containers),
            "proxy" => Ok(&self.proxy),
            "storage" => Ok(&self.storage),
            "ai" => Ok(&self.ai),
            "securelink" => Ok(&self.securelink),
            "scheduler" => Ok(&self.scheduler),
            "metrics" => Ok(&self.metrics),
            "media" => Ok(&self.media),
            _ => Err(ToolError::UnknownService(service.to_string())),
        }
    }
}

/// HTTP client for inter-service communication.
#[derive(Clone)]
pub struct ServiceClients {
    client: Client,
    pub endpoints: ServiceEndpoints,
}

impl ServiceClients {
    /// Create a new service client with 30s timeout.
    pub fn new(endpoints: ServiceEndpoints) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");
        Self { client, endpoints }
    }

    /// Call a service endpoint.
    ///
    /// - `service`: service name (e.g. "containers")
    /// - `method`: HTTP method ("GET", "POST", "PUT", "DELETE")
    /// - `path`: URL path (e.g. "/containers")
    /// - `body`: optional JSON body
    /// - `jwt`: JWT token to forward for auth
    pub async fn call(
        &self,
        service: &str,
        method: &str,
        path: &str,
        body: Option<&Value>,
        jwt: &str,
    ) -> Result<Value, ToolError> {
        let base_url = self.endpoints.resolve(service)?;
        let url = format!("{}{}", base_url, path);

        tracing::debug!(
            service = service,
            method = method,
            path = path,
            "Tool calling service"
        );

        let mut req = match method.to_uppercase().as_str() {
            "GET" => self.client.get(&url),
            "POST" => self.client.post(&url),
            "PUT" => self.client.put(&url),
            "DELETE" => self.client.delete(&url),
            "PATCH" => self.client.patch(&url),
            other => return Err(ToolError::InvalidMethod(other.to_string())),
        };

        req = req.header("Authorization", format!("Bearer {}", jwt));
        req = req.header("Content-Type", "application/json");

        if let Some(b) = body {
            req = req.json(b);
        }

        let resp = req.send().await?;
        let status = resp.status().as_u16();

        if status >= 400 {
            let text = resp
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ToolError::ServiceError(status, text));
        }

        // Try to parse as JSON, fall back to wrapping text
        let text = resp.text().await?;
        if text.is_empty() {
            return Ok(serde_json::json!({"status": "ok"}));
        }

        match serde_json::from_str::<Value>(&text) {
            Ok(json) => Ok(json),
            Err(_) => Ok(serde_json::json!({"response": text})),
        }
    }
}
