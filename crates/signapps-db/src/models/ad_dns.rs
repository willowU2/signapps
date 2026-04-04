//! AD-integrated DNS zone and record models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

/// An AD-integrated DNS zone.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdDnsZone {
    pub id: Uuid,
    pub domain_id: Uuid,
    pub zone_name: String,
    pub zone_type: String,
    pub soa_serial: i64,
    pub soa_refresh: i32,
    pub soa_retry: i32,
    pub soa_expire: i32,
    pub soa_minimum: i32,
    pub allow_dynamic_update: bool,
    pub scavenge_interval_hours: i32,
    pub created_at: DateTime<Utc>,
}

/// A DNS record within an AD-integrated zone.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdDnsRecord {
    pub id: Uuid,
    pub zone_id: Uuid,
    pub name: String,
    pub record_type: String,
    pub rdata: serde_json::Value,
    pub ttl: i32,
    pub is_static: bool,
    pub timestamp: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}
