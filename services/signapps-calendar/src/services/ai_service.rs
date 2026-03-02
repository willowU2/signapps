use reqwest::Client;
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct DirectIndexRequest {
    pub content: String,
    pub filename: String,
    pub path: String,
    pub mime_type: Option<String>,
    pub collection: Option<String>,
    pub security_tags: Option<serde_json::Value>,
}

#[derive(Clone)]
pub struct AiServiceClient {
    client: Client,
    base_url: String,
}

impl AiServiceClient {
    pub fn new() -> Self {
        let base_url = std::env::var("AI_SERVICE_URL")
            .unwrap_or_else(|_| "http://signapps-ai:3005/api/v1".into());

        Self {
            client: Client::new(),
            base_url,
        }
    }

    /// Index a calendar entity (Task or Event) in the AI system for global RAG search.
    pub async fn index_entity(
        &self,
        entity_id: Uuid,
        calendar_id: Uuid,
        entity_type: &str, // "tasks" or "events"
        title: &str,
        description: Option<&str>,
    ) -> Result<(), String> {
        let content = if let Some(desc) = description {
            format!("{}\n\n{}", title, desc)
        } else {
            title.to_string()
        };

        let req = DirectIndexRequest {
            content,
            filename: title.to_string(),
            path: format!("calendar/{}/{}/{}", calendar_id, entity_type, entity_id),
            mime_type: Some(format!(
                "application/vnd.signapps.{}",
                entity_type.trim_end_matches('s')
            )),
            collection: Some("calendar".to_string()),
            security_tags: None,
        };

        let url = format!("{}/internal/index/{}", self.base_url, entity_id);

        let res = self
            .client
            .post(&url)
            .json(&req)
            .send()
            .await
            .map_err(|e| format!("Failed to send index request: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("AI service returned status: {}", res.status()));
        }

        Ok(())
    }

    /// Remove a task from the AI index.
    pub async fn remove_indexed_entity(&self, entity_id: Uuid) -> Result<(), String> {
        let url = format!("{}/internal/index/{}", self.base_url, entity_id);

        let res = self
            .client
            .delete(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to send delete request: {}", e))?;

        if !res.status().is_success() && res.status() != reqwest::StatusCode::NOT_FOUND {
            return Err(format!("AI service returned status: {}", res.status()));
        }

        Ok(())
    }
}
