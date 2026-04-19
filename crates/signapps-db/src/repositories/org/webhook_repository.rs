//! CRUD for `org_webhooks` and `org_webhook_deliveries` — SO4 integrations.

use anyhow::Result;
use rand::distributions::{Alphanumeric, DistString};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{webhook::pattern_matches, Webhook, WebhookDelivery};

/// After how many consecutive delivery failures a webhook is auto-disabled.
pub const MAX_CONSECUTIVE_FAILURES: i32 = 5;

/// Repository for the canonical `org_webhooks` + `org_webhook_deliveries` tables.
pub struct WebhookRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> WebhookRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Create a webhook with auto-generated 64-char hex secret.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn create(
        &self,
        tenant_id: Uuid,
        url: &str,
        events: Vec<String>,
    ) -> Result<Webhook> {
        let secret = Alphanumeric.sample_string(&mut rand::thread_rng(), 64);
        let row = sqlx::query_as::<_, Webhook>(
            "INSERT INTO org_webhooks (tenant_id, url, secret, events)
             VALUES ($1, $2, $3, $4)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(url)
        .bind(&secret)
        .bind(&events)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Update mutable fields (url, events, active).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn update(
        &self,
        id: Uuid,
        url: Option<&str>,
        events: Option<&[String]>,
        active: Option<bool>,
    ) -> Result<Option<Webhook>> {
        let row = sqlx::query_as::<_, Webhook>(
            "UPDATE org_webhooks SET
                url        = COALESCE($2, url),
                events     = COALESCE($3, events),
                active     = COALESCE($4, active),
                updated_at = now()
             WHERE id = $1
             RETURNING *",
        )
        .bind(id)
        .bind(url)
        .bind(events)
        .bind(active)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch one webhook by primary key.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get(&self, id: Uuid) -> Result<Option<Webhook>> {
        let row = sqlx::query_as::<_, Webhook>("SELECT * FROM org_webhooks WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    /// List every webhook for a tenant (active or not).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_by_tenant(&self, tenant_id: Uuid) -> Result<Vec<Webhook>> {
        let rows = sqlx::query_as::<_, Webhook>(
            "SELECT * FROM org_webhooks
             WHERE tenant_id = $1
             ORDER BY created_at DESC",
        )
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// List active webhooks subscribed to `event_type` (across all tenants).
    /// Used by the dispatcher fan-out worker.
    ///
    /// Wildcard patterns (`org.person.*`) are matched in Rust after fetch
    /// to keep the SQL portable.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_active_subscribed_to(&self, event_type: &str) -> Result<Vec<Webhook>> {
        // Fetch all active webhooks then filter in Rust — list size is
        // bounded by the number of webhooks per tenant (small).
        let rows = sqlx::query_as::<_, Webhook>(
            "SELECT * FROM org_webhooks WHERE active = TRUE",
        )
        .fetch_all(self.pool)
        .await?;
        let filtered = rows
            .into_iter()
            .filter(|w| w.events.iter().any(|p| pattern_matches(p, event_type)))
            .collect();
        Ok(filtered)
    }

    /// List active webhooks of a tenant subscribed to `event_type`.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_active_for_tenant_event(
        &self,
        tenant_id: Uuid,
        event_type: &str,
    ) -> Result<Vec<Webhook>> {
        let rows = sqlx::query_as::<_, Webhook>(
            "SELECT * FROM org_webhooks
             WHERE tenant_id = $1 AND active = TRUE",
        )
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;
        let filtered = rows
            .into_iter()
            .filter(|w| w.events.iter().any(|p| pattern_matches(p, event_type)))
            .collect();
        Ok(filtered)
    }

    /// Delete a webhook (cascade des deliveries via FK).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn delete(&self, id: Uuid) -> Result<bool> {
        let res = sqlx::query("DELETE FROM org_webhooks WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(res.rows_affected() > 0)
    }

    // ─── Deliveries ─────────────────────────────────────────────────

    /// Record one delivery attempt.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    #[allow(clippy::too_many_arguments)]
    pub async fn record_delivery(
        &self,
        webhook_id: Uuid,
        event_type: &str,
        payload: &serde_json::Value,
        status_code: Option<i32>,
        response_body: Option<&str>,
        error_message: Option<&str>,
        attempt: i32,
    ) -> Result<WebhookDelivery> {
        let row = sqlx::query_as::<_, WebhookDelivery>(
            "INSERT INTO org_webhook_deliveries
                (webhook_id, event_type, payload_json, status_code,
                 response_body, error_message, attempt)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *",
        )
        .bind(webhook_id)
        .bind(event_type)
        .bind(payload)
        .bind(status_code)
        .bind(response_body)
        .bind(error_message)
        .bind(attempt)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Update webhook stats after a delivery (success → reset, failure → bump).
    ///
    /// Auto-disables the webhook after [`MAX_CONSECUTIVE_FAILURES`] failures.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn record_attempt_outcome(
        &self,
        id: Uuid,
        status_code: Option<i32>,
        succeeded: bool,
    ) -> Result<()> {
        if succeeded {
            sqlx::query(
                "UPDATE org_webhooks SET
                    last_delivery_at = now(),
                    last_status      = $2,
                    failure_count    = 0,
                    updated_at       = now()
                 WHERE id = $1",
            )
            .bind(id)
            .bind(status_code)
            .execute(self.pool)
            .await?;
        } else {
            sqlx::query(
                "UPDATE org_webhooks SET
                    last_delivery_at = now(),
                    last_status      = $2,
                    failure_count    = failure_count + 1,
                    active           = active AND failure_count + 1 < $3,
                    updated_at       = now()
                 WHERE id = $1",
            )
            .bind(id)
            .bind(status_code)
            .bind(MAX_CONSECUTIVE_FAILURES)
            .execute(self.pool)
            .await?;
        }
        Ok(())
    }

    /// List the last `limit` deliveries for a webhook (for UI timeline).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_recent_deliveries(
        &self,
        webhook_id: Uuid,
        limit: i64,
    ) -> Result<Vec<WebhookDelivery>> {
        let rows = sqlx::query_as::<_, WebhookDelivery>(
            "SELECT * FROM org_webhook_deliveries
             WHERE webhook_id = $1
             ORDER BY delivered_at DESC
             LIMIT $2",
        )
        .bind(webhook_id)
        .bind(limit)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::org::Webhook;

    #[test]
    fn secret_generated_is_64_chars_alphanumeric() {
        let secret = Alphanumeric.sample_string(&mut rand::thread_rng(), 64);
        assert_eq!(secret.len(), 64);
        assert!(secret.chars().all(|c| c.is_ascii_alphanumeric()));
    }

    #[test]
    fn webhook_matches_event() {
        let w = Webhook {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            url: "https://example.test/hook".into(),
            secret: "secret".into(),
            events: vec!["org.person.*".into(), "org.node.created".into()],
            active: true,
            last_delivery_at: None,
            last_status: None,
            failure_count: 0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        assert!(w.matches("org.person.created"));
        assert!(w.matches("org.person.updated"));
        assert!(w.matches("org.node.created"));
        assert!(!w.matches("org.node.updated"));
    }
}
