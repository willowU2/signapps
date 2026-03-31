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
    pub docs: String,
    pub calendar: String,
    pub mail: String,
    pub collab: String,
    pub meet: String,
    pub forms: String,
    pub office: String,
    pub social: String,
    pub chat: String,
    pub notifications: String,
    pub billing: String,
    pub contacts: String,
    pub workforce: String,
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
            docs: Self::env_or("DOCS_URL", "http://localhost:3010/api/v1"),
            calendar: Self::env_or("CALENDAR_URL", "http://localhost:3011/api/v1"),
            mail: Self::env_or("MAIL_URL", "http://localhost:3012/api/v1"),
            collab: Self::env_or("COLLAB_URL", "http://localhost:3013/api/v1"),
            meet: Self::env_or("MEET_URL", "http://localhost:3014/api/v1"),
            forms: Self::env_or("FORMS_URL", "http://localhost:3015/api/v1"),
            office: Self::env_or("OFFICE_URL", "http://localhost:3018/api/v1"),
            social: Self::env_or("SOCIAL_URL", "http://localhost:3019/api/v1"),
            chat: Self::env_or("CHAT_URL", "http://localhost:3020/api/v1"),
            notifications: Self::env_or("NOTIFICATIONS_URL", "http://localhost:8095/api/v1"),
            billing: Self::env_or("BILLING_URL", "http://localhost:8096/api/v1"),
            contacts: Self::env_or("CONTACTS_URL", "http://localhost:3014/api/v1"),
            workforce: Self::env_or("WORKFORCE_URL", "http://localhost:3019/api/v1"),
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
            "docs" => Ok(&self.docs),
            "calendar" => Ok(&self.calendar),
            "mail" => Ok(&self.mail),
            "collab" => Ok(&self.collab),
            "meet" => Ok(&self.meet),
            "forms" => Ok(&self.forms),
            "office" => Ok(&self.office),
            "social" => Ok(&self.social),
            "chat" => Ok(&self.chat),
            "notifications" => Ok(&self.notifications),
            "billing" => Ok(&self.billing),
            "contacts" => Ok(&self.contacts),
            "workforce" => Ok(&self.workforce),
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
