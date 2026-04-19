//! Read-access + time-travel helpers on `org_audit_log`.
//!
//! Les writes sont automatiques via les triggers SQL (migration 500).
//! Ce repo sert uniquement à la lecture + la reconstruction de snapshots
//! passés (`?at=YYYY-MM-DD` sur `/org/nodes`).

use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::AuditLogEntry;

/// Repository for the canonical `org_audit_log` table.
pub struct AuditRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> AuditRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// History of one entity, most recent first.
    pub async fn list_for_entity(
        &self,
        entity_type: &str,
        entity_id: Uuid,
        limit: i64,
    ) -> Result<Vec<AuditLogEntry>> {
        let rows = sqlx::query_as::<_, AuditLogEntry>(
            "SELECT * FROM org_audit_log
             WHERE entity_type = $1 AND entity_id = $2
             ORDER BY at DESC
             LIMIT $3",
        )
        .bind(entity_type)
        .bind(entity_id)
        .bind(limit)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Full tenant timeline since `since` (optional), most recent first.
    pub async fn list_for_tenant(
        &self,
        tenant_id: Uuid,
        since: Option<DateTime<Utc>>,
        limit: i64,
    ) -> Result<Vec<AuditLogEntry>> {
        let rows = match since {
            Some(t) => sqlx::query_as::<_, AuditLogEntry>(
                "SELECT * FROM org_audit_log
                 WHERE tenant_id = $1 AND at >= $2
                 ORDER BY at DESC
                 LIMIT $3",
            )
            .bind(tenant_id)
            .bind(t)
            .bind(limit)
            .fetch_all(self.pool)
            .await?,
            None => sqlx::query_as::<_, AuditLogEntry>(
                "SELECT * FROM org_audit_log
                 WHERE tenant_id = $1
                 ORDER BY at DESC
                 LIMIT $2",
            )
            .bind(tenant_id)
            .bind(limit)
            .fetch_all(self.pool)
            .await?,
        };
        Ok(rows)
    }

    /// Reconstruire la liste des rows d'une table `entity_type` pour un
    /// tenant **à la date `at`**.
    ///
    /// Approche : on part de l'état courant (filtré par tenant), on
    /// charge tous les audit events postérieurs à `at`, on reverse-apply
    /// les UPDATE (restaurer `before`), on réinjecte les DELETE (restaurer
    /// `diff_json`), on retire les INSERT postérieurs.
    ///
    /// Retourne un `Vec<serde_json::Value>` plutôt que le type Rust natif
    /// — le caller décide du désérialiseur (Node / Person / ...) via
    /// `serde_json::from_value::<T>`.
    ///
    /// # Errors
    ///
    /// Propage la sqlx::Error de base en cas d'échec query.
    pub async fn snapshot_at(
        &self,
        entity_type: &str,
        tenant_id: Uuid,
        at: DateTime<Utc>,
    ) -> Result<Vec<serde_json::Value>> {
        // 1. Etat courant (peut être vide si tout a été supprimé).
        let current = current_rows_as_json(self.pool, entity_type, tenant_id).await?;
        let mut by_id: std::collections::HashMap<Uuid, serde_json::Value> = current
            .into_iter()
            .filter_map(|row| extract_id(&row).map(|id| (id, row)))
            .collect();

        // 2. Audit events postérieurs à `at`, chronologique ASC pour
        //    pouvoir reverse-apply dans l'ordre inverse (DESC) ensuite.
        let events = sqlx::query_as::<_, AuditLogEntry>(
            "SELECT * FROM org_audit_log
             WHERE entity_type = $1 AND tenant_id = $2 AND at > $3
             ORDER BY at DESC",
        )
        .bind(entity_type)
        .bind(tenant_id)
        .bind(at)
        .fetch_all(self.pool)
        .await?;

        // 3. Reverse-apply chaque event (on remonte le temps).
        for ev in events {
            match ev.action.as_str() {
                "insert" => {
                    // Un insert postérieur : la row n'existait pas à `at`.
                    by_id.remove(&ev.entity_id);
                },
                "delete" => {
                    // Un delete postérieur : la row existait à `at`,
                    // `diff_json` est le snapshot `OLD`.
                    by_id.insert(ev.entity_id, ev.diff_json);
                },
                "update" => {
                    // Un update postérieur : on restaure `before`.
                    if let Some(before) = ev.diff_json.get("before") {
                        by_id.insert(ev.entity_id, before.clone());
                    }
                },
                _ => {
                    // Action inconnue — on log et on ignore pour ne pas
                    // casser la lecture d'un audit log bizarre.
                    tracing::warn!(
                        action = %ev.action,
                        entity_type = entity_type,
                        "unknown audit action, skipping in snapshot"
                    );
                },
            }
        }

        Ok(by_id.into_values().collect())
    }
}

async fn current_rows_as_json(
    pool: &PgPool,
    entity_type: &str,
    tenant_id: Uuid,
) -> Result<Vec<serde_json::Value>> {
    // Whitelist entity_type (SQL injection guard).
    let allowed = matches!(
        entity_type,
        "org_nodes"
            | "org_persons"
            | "org_assignments"
            | "org_positions"
            | "org_position_incumbents"
    );
    if !allowed {
        anyhow::bail!("snapshot_at: entity_type `{entity_type}` not whitelisted");
    }
    // Dynamique, d'où la whitelist juste au-dessus.
    let sql =
        format!("SELECT to_jsonb(t) AS row FROM {entity_type} t WHERE tenant_id = $1");
    let rows: Vec<(serde_json::Value,)> = sqlx::query_as(&sql)
        .bind(tenant_id)
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(|(v,)| v).collect())
}

fn extract_id(row: &serde_json::Value) -> Option<Uuid> {
    row.get("id")
        .and_then(serde_json::Value::as_str)
        .and_then(|s| Uuid::parse_str(s).ok())
}
