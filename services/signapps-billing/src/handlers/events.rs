//! Cross-service event handlers for the billing service.

use signapps_common::pg_events::PlatformEvent;
use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// Handle cross-service events received by the billing service.
///
/// Currently handles `crm.deal.won` by auto-creating a draft invoice.
pub async fn handle_cross_event(
    pool: &Pool<Postgres>,
    event: PlatformEvent,
) -> Result<(), sqlx::Error> {
    if event.event_type.as_str() == "crm.deal.won" {
        let amount = event.payload["amount"].as_i64().unwrap_or(0) as i32;
        let contact_id = event.payload["contact_id"]
            .as_str()
            .and_then(|s| s.parse::<Uuid>().ok());
        // Generate a unique invoice number from the deal id (first 8 chars)
        let deal_short = event
            .aggregate_id
            .map(|id| id.to_string().replace('-', "")[..8].to_string())
            .unwrap_or_else(|| "DEAL0000".to_string());
        let number = format!("AUTO-{}", deal_short.to_uppercase());
        sqlx::query(
            "INSERT INTO billing.invoices \
                 (tenant_id, number, amount_cents, currency, status, metadata) \
                 VALUES ($1, $2, $3, 'EUR', 'draft', $4)",
        )
        .bind(event.aggregate_id) // use aggregate_id as tenant proxy
        .bind(&number)
        .bind(amount)
        .bind(serde_json::json!({
            "deal_id": event.aggregate_id.map(|id| id.to_string()),
            "contact_id": contact_id,
            "auto_generated": true
        }))
        .execute(pool)
        .await?;
        tracing::info!(
            deal_id = %event.aggregate_id.map(|id| id.to_string()).unwrap_or_default(),
            amount = amount,
            "Auto-created draft invoice from won deal"
        );
    }
    Ok(())
}
