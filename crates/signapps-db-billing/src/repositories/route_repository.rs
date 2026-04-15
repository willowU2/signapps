//! Route repository for proxy management.

use crate::models::route::{CreateRoute, Route, UpdateRoute};
use signapps_common::Result;
use signapps_db_shared::DatabasePool;
use uuid::Uuid;

/// Repository for route operations.
pub struct RouteRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> RouteRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find route by ID.
    pub async fn find(&self, id: Uuid) -> Result<Option<Route>> {
        let route = sqlx::query_as::<_, Route>("SELECT * FROM proxy.routes WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool.inner())
            .await?;

        Ok(route)
    }

    /// Find route by name.
    pub async fn find_by_name(&self, name: &str) -> Result<Option<Route>> {
        let route = sqlx::query_as::<_, Route>("SELECT * FROM proxy.routes WHERE name = $1")
            .bind(name)
            .fetch_optional(self.pool.inner())
            .await?;

        Ok(route)
    }

    /// Find route by host.
    pub async fn find_by_host(&self, host: &str) -> Result<Option<Route>> {
        let route = sqlx::query_as::<_, Route>("SELECT * FROM proxy.routes WHERE host = $1")
            .bind(host)
            .fetch_optional(self.pool.inner())
            .await?;

        Ok(route)
    }

    /// List all routes.
    pub async fn list(&self) -> Result<Vec<Route>> {
        let routes = sqlx::query_as::<_, Route>("SELECT * FROM proxy.routes ORDER BY name")
            .fetch_all(self.pool.inner())
            .await?;

        Ok(routes)
    }

    /// List enabled routes only.
    pub async fn list_enabled(&self) -> Result<Vec<Route>> {
        let routes = sqlx::query_as::<_, Route>(
            "SELECT * FROM proxy.routes WHERE enabled = true ORDER BY name",
        )
        .fetch_all(self.pool.inner())
        .await?;

        Ok(routes)
    }

    /// Create a new route.
    pub async fn create(&self, route: &CreateRoute) -> Result<Route> {
        let mode = serde_json::to_string(&route.mode)
            .unwrap_or_else(|_| "\"proxy\"".to_string())
            .trim_matches('"')
            .to_string();

        let shield_json = route
            .shield_config
            .as_ref()
            .and_then(|c| serde_json::to_value(c).ok());

        let headers_json = route
            .headers
            .as_ref()
            .and_then(|h| serde_json::to_value(h).ok());

        let created = sqlx::query_as::<_, Route>(
            r#"
            INSERT INTO proxy.routes (name, host, target, mode, tls_enabled, auth_required, shield_config, headers, enabled, dns_records, tls_config)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
            "#
        )
        .bind(&route.name)
        .bind(&route.host)
        .bind(&route.target)
        .bind(&mode)
        .bind(route.tls_enabled)
        .bind(route.auth_required)
        .bind(&shield_json)
        .bind(&headers_json)
        .bind(route.enabled)
        .bind(&route.dns_records)
        .bind(&route.tls_config)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update a route.
    pub async fn update(&self, id: Uuid, update: &UpdateRoute) -> Result<Route> {
        // Build dynamic update query
        let mut sets = Vec::new();
        let mut param_count = 1;

        if update.name.is_some() {
            param_count += 1;
            sets.push(format!("name = ${}", param_count));
        }
        if update.host.is_some() {
            param_count += 1;
            sets.push(format!("host = ${}", param_count));
        }
        if update.target.is_some() {
            param_count += 1;
            sets.push(format!("target = ${}", param_count));
        }
        if update.mode.is_some() {
            param_count += 1;
            sets.push(format!("mode = ${}", param_count));
        }
        if update.tls_enabled.is_some() {
            param_count += 1;
            sets.push(format!("tls_enabled = ${}", param_count));
        }
        if update.auth_required.is_some() {
            param_count += 1;
            sets.push(format!("auth_required = ${}", param_count));
        }
        if update.shield_config.is_some() {
            param_count += 1;
            sets.push(format!("shield_config = ${}", param_count));
        }
        if update.headers.is_some() {
            param_count += 1;
            sets.push(format!("headers = ${}", param_count));
        }
        if update.dns_records.is_some() {
            param_count += 1;
            sets.push(format!("dns_records = ${}", param_count));
        }
        if update.tls_config.is_some() {
            param_count += 1;
            sets.push(format!("tls_config = ${}", param_count));
        }
        if update.enabled.is_some() {
            param_count += 1;
            sets.push(format!("enabled = ${}", param_count));
        }

        sets.push("updated_at = NOW()".to_string());

        let query = format!(
            "UPDATE proxy.routes SET {} WHERE id = $1 RETURNING *",
            sets.join(", ")
        );

        let mut q = sqlx::query_as::<_, Route>(&query).bind(id);

        if let Some(ref name) = update.name {
            q = q.bind(name);
        }
        if let Some(ref host) = update.host {
            q = q.bind(host);
        }
        if let Some(ref target) = update.target {
            q = q.bind(target);
        }
        if let Some(ref mode) = update.mode {
            let mode_str = serde_json::to_string(mode)
                .unwrap_or_else(|_| "\"proxy\"".to_string())
                .trim_matches('"')
                .to_string();
            q = q.bind(mode_str);
        }
        if let Some(tls) = update.tls_enabled {
            q = q.bind(tls);
        }
        if let Some(auth) = update.auth_required {
            q = q.bind(auth);
        }
        if let Some(ref shield) = update.shield_config {
            let json = serde_json::to_value(shield).ok();
            q = q.bind(json);
        }
        if let Some(ref headers) = update.headers {
            let json = serde_json::to_value(headers).ok();
            q = q.bind(json);
        }
        if let Some(ref dns) = update.dns_records {
            q = q.bind(dns);
        }
        if let Some(ref tls) = update.tls_config {
            q = q.bind(tls);
        }
        if let Some(enabled) = update.enabled {
            q = q.bind(enabled);
        }

        let updated = q.fetch_one(self.pool.inner()).await?;

        Ok(updated)
    }

    /// Delete a route.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM proxy.routes WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }

    /// Toggle route enabled status.
    pub async fn toggle_enabled(&self, id: Uuid, enabled: bool) -> Result<Route> {
        let route = sqlx::query_as::<_, Route>(
            "UPDATE proxy.routes SET enabled = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .bind(enabled)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(route)
    }
}
