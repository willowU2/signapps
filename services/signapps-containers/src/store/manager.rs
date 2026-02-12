use super::parser;
use super::types::*;
use chrono::Utc;
use signapps_db::DatabasePool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// In-memory cache of app catalogs keyed by source id.
type AppCache = Arc<RwLock<HashMap<Uuid, Vec<StoreApp>>>>;

#[derive(Clone)]
pub struct StoreManager {
    pool: DatabasePool,
    http: reqwest::Client,
    cache: AppCache,
}

impl StoreManager {
    pub fn new(pool: DatabasePool) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            pool,
            http,
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // ── Source CRUD ──────────────────────────────────────────────

    pub async fn list_sources(&self) -> Result<Vec<AppSource>, sqlx::Error> {
        sqlx::query_as::<_, AppSource>(
            "SELECT * FROM containers.app_sources ORDER BY created_at",
        )
        .fetch_all(&*self.pool)
        .await
    }

    pub async fn add_source(&self, name: &str, url: &str) -> Result<AppSource, sqlx::Error> {
        let source = sqlx::query_as::<_, AppSource>(
            "INSERT INTO containers.app_sources (name, url) VALUES ($1, $2) RETURNING *",
        )
        .bind(name)
        .bind(url)
        .fetch_one(&*self.pool)
        .await?;

        // Immediately fetch apps so the response includes app_count
        if let Err(e) = self.refresh_source(source.id).await {
            tracing::warn!(source = %name, "Failed to fetch new source: {e}");
        }

        // Re-read to get updated app_count
        let updated = sqlx::query_as::<_, AppSource>(
            "SELECT * FROM containers.app_sources WHERE id = $1",
        )
        .bind(source.id)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(source);

        Ok(updated)
    }

    pub async fn delete_source(&self, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM containers.app_sources WHERE id = $1")
            .bind(id)
            .execute(&*self.pool)
            .await?;

        self.cache.write().await.remove(&id);
        Ok(())
    }

    pub async fn toggle_source(
        &self,
        id: Uuid,
        enabled: bool,
    ) -> Result<AppSource, sqlx::Error> {
        let source = sqlx::query_as::<_, AppSource>(
            "UPDATE containers.app_sources SET enabled = $2, updated_at = NOW() \
             WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .bind(enabled)
        .fetch_one(&*self.pool)
        .await?;

        if !enabled {
            self.cache.write().await.remove(&id);
        }
        Ok(source)
    }

    // ── Catalog fetching ────────────────────────────────────────

    /// Refresh all enabled sources (called at startup).
    pub async fn refresh_sources(&self) {
        let sources = match self.list_sources().await {
            Ok(s) => s,
            Err(e) => {
                tracing::error!("Failed to load app sources: {e}");
                return;
            }
        };

        for source in sources.iter().filter(|s| s.enabled) {
            if let Err(e) = self.refresh_source(source.id).await {
                tracing::warn!(
                    source = %source.name,
                    url = %source.url,
                    "Failed to refresh: {e}"
                );
            }
        }

        let cache = self.cache.read().await;
        let total: usize = cache.values().map(|v| v.len()).sum();
        tracing::info!(
            sources = sources.len(),
            apps = total,
            "App store catalog loaded"
        );
    }

    /// Refresh a single source.
    pub async fn refresh_source(&self, source_id: Uuid) -> Result<usize, String> {
        let source = sqlx::query_as::<_, AppSource>(
            "SELECT * FROM containers.app_sources WHERE id = $1",
        )
        .bind(source_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Source not found".to_string())?;

        let index_url = format!("{}/index.json", source.url.trim_end_matches('/'));

        let resp = self
            .http
            .get(&index_url)
            .send()
            .await
            .map_err(|e| format!("HTTP error: {e}"))?;

        if !resp.status().is_success() {
            let err = format!("HTTP {}", resp.status());
            self.update_source_error(source_id, &err).await;
            return Err(err);
        }

        let text = resp.text().await.map_err(|e| format!("Read error: {e}"))?;

        // Parse index.json – Cosmos format:
        // { "source": "...", "showcase": [...], "all": [...] }
        // where "all" is an array of app metadata objects.
        let index: CosmosIndex =
            serde_json::from_str(&text).map_err(|e| format!("JSON parse error: {e}"))?;

        let all_apps = index.all.unwrap_or_default();
        let base_url = source.url.trim_end_matches('/');
        let mut apps = Vec::new();

        for meta in &all_apps {
            let app_id = match &meta.id {
                Some(id) => id.clone(),
                None => match &meta.name {
                    Some(n) => n.clone(),
                    None => continue,
                },
            };

            let compose_url = match &meta.compose {
                Some(c) if c.starts_with("http") => c.clone(),
                Some(c) => format!("{base_url}/{c}"),
                None => format!("{base_url}/{app_id}/cosmos-compose.json"),
            };

            apps.push(StoreApp {
                id: app_id.clone(),
                name: meta.name.clone().unwrap_or_else(|| app_id.clone()),
                description: meta.description.clone().unwrap_or_default(),
                long_description: meta.long_description.clone().unwrap_or_default(),
                icon: meta.icon.clone().unwrap_or_default(),
                tags: meta.tags.clone().unwrap_or_default(),
                supported_architectures: meta
                    .supported_architectures
                    .clone()
                    .unwrap_or_default(),
                compose_url,
                source_id: source.id,
                source_name: source.name.clone(),
                image: meta.image.clone().unwrap_or_default(),
                repository: meta.repository.clone().unwrap_or_default(),
            });
        }

        let count = apps.len();
        self.cache.write().await.insert(source_id, apps);

        // Update DB metadata
        let _ = sqlx::query(
            "UPDATE containers.app_sources \
             SET last_fetched = $2, app_count = $3, last_error = NULL, updated_at = NOW() \
             WHERE id = $1",
        )
        .bind(source_id)
        .bind(Utc::now())
        .bind(count as i32)
        .execute(&*self.pool)
        .await;

        tracing::info!(source = %source.name, count, "Source refreshed");
        Ok(count)
    }

    async fn update_source_error(&self, source_id: Uuid, error: &str) {
        let _ = sqlx::query(
            "UPDATE containers.app_sources \
             SET last_error = $2, updated_at = NOW() WHERE id = $1",
        )
        .bind(source_id)
        .bind(error)
        .execute(&*self.pool)
        .await;
    }

    // ── Catalog queries ─────────────────────────────────────────

    pub async fn list_apps(
        &self,
        search: Option<&str>,
        category: Option<&str>,
    ) -> Vec<StoreApp> {
        let cache = self.cache.read().await;
        let mut result: Vec<StoreApp> = cache.values().flatten().cloned().collect();

        if let Some(q) = search {
            let q = q.to_lowercase();
            result.retain(|app| {
                app.name.to_lowercase().contains(&q)
                    || app.description.to_lowercase().contains(&q)
                    || app.tags.iter().any(|t| t.to_lowercase().contains(&q))
            });
        }

        if let Some(cat) = category {
            if cat != "all" {
                let cat_lower = cat.to_lowercase();
                result.retain(|app| {
                    app.tags.iter().any(|t| t.to_lowercase() == cat_lower)
                });
            }
        }

        result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        result
    }

    pub async fn get_app(&self, source_id: Uuid, app_id: &str) -> Option<StoreApp> {
        let cache = self.cache.read().await;
        cache
            .get(&source_id)?
            .iter()
            .find(|a| a.id == app_id)
            .cloned()
    }

    /// Fetch and parse a compose file on demand.
    pub async fn fetch_compose(&self, compose_url: &str) -> Result<ParsedAppConfig, String> {
        let resp = self
            .http
            .get(compose_url)
            .send()
            .await
            .map_err(|e| format!("HTTP error: {e}"))?;

        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status()));
        }

        let text = resp.text().await.map_err(|e| format!("Read error: {e}"))?;

        let is_yaml = parser::is_yaml_url(compose_url);
        parser::parse_compose(&text, is_yaml)
    }

    /// Get all unique categories from all cached apps.
    pub async fn categories(&self) -> Vec<String> {
        let cache = self.cache.read().await;
        let mut cats: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
        for app in cache.values().flatten() {
            for tag in &app.tags {
                cats.insert(tag.clone());
            }
        }
        cats.into_iter().collect()
    }
}
