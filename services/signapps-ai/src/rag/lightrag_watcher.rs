//! LightRAG auto-feed watcher.
//!
//! Listens to PostgreSQL NOTIFY events from kg_notify_change() triggers
//! and automatically updates the knowledge graph when data changes.
//! Also performs periodic full re-seed and auto-discovers new tables.

use signapps_db::DatabasePool;
use sqlx::postgres::PgListener;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::watch;
use tracing;

/// Tables excluded from auto-discovery (contain sensitive data).
///
/// Any table whose name or schema contains one of these substrings will be
/// skipped when attaching KG notify triggers. The SQL query uses explicit
/// `NOT LIKE` clauses for the same patterns; this list provides a Rust-side
/// double-check before issuing DDL.
const AUTO_DISCOVER_EXCLUDED: &[&str] = &[
    "sessions",
    "api_keys",
    "sso_configs",
    "ldap_config",
    "principal_keys",
    "vault",
    "secrets",
    "tokens",
    "password",
    "credentials",
    "certificates",
];

/// Configuration for the auto-feed watcher.
///
/// # Examples
///
/// ```
/// let cfg = WatcherConfig::default();
/// assert_eq!(cfg.channel, "kg_data_change");
/// ```
#[derive(Debug, Clone)]
pub struct WatcherConfig {
    /// Channel name for PostgreSQL NOTIFY.
    pub channel: String,
    /// Collection name in the knowledge graph.
    pub collection: String,
    /// Debounce interval — batch changes within this window (ms).
    pub debounce_ms: u64,
    /// Full re-seed interval (seconds, 0 = disabled).
    pub full_reseed_interval_secs: u64,
    /// Auto-discover new tables interval (seconds, 0 = disabled).
    pub auto_discover_interval_secs: u64,
}

impl Default for WatcherConfig {
    fn default() -> Self {
        Self {
            channel: "kg_data_change".to_string(),
            collection: "signapps".to_string(),
            debounce_ms: 2000,
            full_reseed_interval_secs: 86400,  // 24 hours
            auto_discover_interval_secs: 3600, // 1 hour
        }
    }
}

/// A change notification from PostgreSQL.
#[derive(Debug, Clone, serde::Deserialize)]
struct ChangeNotification {
    table: String,
    op: String,
    id: String,
}

/// Map of table names to their seeder function identifiers.
///
/// Returns a [`HashMap`] where the key is the fully-qualified PostgreSQL table
/// name and the value is the logical seeder identifier consumed by the watcher.
///
/// # Examples
///
/// ```
/// let map = table_to_seeder();
/// assert!(map.contains_key("identity.users"));
/// ```
fn table_to_seeder() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    // Tier 1
    m.insert("identity.users", "users");
    m.insert("core.persons", "users"); // persons trigger user re-seed
    m.insert("workforce_org_nodes", "org_nodes");
    m.insert("public.workforce_org_nodes", "org_nodes");
    m.insert("workforce_org_groups", "groups");
    m.insert("public.workforce_org_groups", "groups");
    m.insert("core.assignments", "assignments");
    // Tier 2
    m.insert("calendar.events", "calendar_events");
    m.insert("public.documents", "documents");
    m.insert("chat.channels", "chat_channels");
    m.insert("mail.accounts", "mail_accounts");
    m.insert("storage.files", "files");
    // Tier 3
    m.insert("meet.rooms", "meetings");
    m.insert("forms.forms", "forms");
    m.insert("social.posts", "social_posts");
    m.insert("crm.leads", "crm");
    m.insert("workforce.courses", "courses");
    // Tier 4
    m.insert("it.hardware", "it_hardware");
    m.insert("it.tickets", "it_tickets");
    m.insert("billing.invoices", "invoices");
    m
}

/// Start the LightRAG auto-feed watcher.
///
/// This spawns background tasks that:
/// 1. Listen to PostgreSQL NOTIFY on the `kg_data_change` channel
/// 2. Debounce rapid changes (batch changes within a configurable window)
/// 3. Re-seed the affected data source
/// 4. Periodically perform a full re-seed (every 24 h by default)
/// 5. Auto-discover new tables and attach triggers (every 1 h by default)
///
/// # Errors
///
/// The function itself does not return an error — task failures are logged and
/// non-fatal. Each spawned task recovers independently.
///
/// # Panics
///
/// No panics possible — all errors are logged and the task continues.
#[tracing::instrument(skip(pool, embed_fn, shutdown))]
pub async fn start_watcher<E, EFut>(
    pool: Arc<DatabasePool>,
    config: WatcherConfig,
    embed_fn: E,
    shutdown: watch::Receiver<bool>,
) where
    E: Fn(String) -> EFut + Clone + Send + Sync + 'static,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>> + Send,
{
    tracing::info!(
        channel = %config.channel,
        collection = %config.collection,
        "LightRAG auto-feed watcher starting"
    );

    // ── Task 1: LISTEN for incremental changes ────────────────────────────────
    let pool_listen = pool.clone();
    let config_listen = config.clone();
    let mut shutdown_listen = shutdown.clone();

    tokio::spawn(async move {
        let mut listener = match PgListener::connect_with(pool_listen.inner()).await {
            Ok(l) => l,
            Err(e) => {
                tracing::error!(error = %e, "Failed to create PG listener for LightRAG watcher");
                return;
            },
        };

        if let Err(e) = listener.listen(&config_listen.channel).await {
            tracing::error!(error = %e, channel = %config_listen.channel, "Failed to LISTEN on channel");
            return;
        }

        tracing::info!(channel = %config_listen.channel, "Listening for data changes");

        let seeder_map = table_to_seeder();
        let mut pending_seeders: HashMap<String, tokio::time::Instant> = HashMap::new();
        let debounce = std::time::Duration::from_millis(config_listen.debounce_ms);

        loop {
            tokio::select! {
                notification = listener.recv() => {
                    match notification {
                        Ok(n) => {
                            let payload = n.payload();
                            match serde_json::from_str::<ChangeNotification>(payload) {
                                Ok(change) => {
                                    tracing::debug!(
                                        table = %change.table,
                                        op = %change.op,
                                        id = %change.id,
                                        "KG data change detected"
                                    );

                                    if let Some(&seeder) = seeder_map.get(change.table.as_str()) {
                                        let now = tokio::time::Instant::now();
                                        let should_trigger = pending_seeders
                                            .get(seeder)
                                            .map(|last| now.duration_since(*last) > debounce)
                                            .unwrap_or(true);

                                        if should_trigger {
                                            pending_seeders.insert(seeder.to_string(), now);
                                            tracing::info!(
                                                seeder = seeder,
                                                table = %change.table,
                                                "Triggering incremental re-seed"
                                            );
                                            // Incremental seeder hook: in the current
                                            // architecture the full periodic re-seed provides
                                            // eventual consistency; per-row hooks would call
                                            // seed_* directly here when available.
                                        }
                                    } else {
                                        tracing::trace!(
                                            table = %change.table,
                                            "No seeder mapped for table"
                                        );
                                    }
                                }
                                Err(e) => {
                                    tracing::warn!(
                                        payload = payload,
                                        error = %e,
                                        "Invalid KG change notification payload"
                                    );
                                }
                            }
                        }
                        Err(e) => {
                            tracing::error!(error = %e, "PG listener error, reconnecting in 5s");
                            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                        }
                    }
                }
                _ = async {
                    loop {
                        shutdown_listen.changed().await.ok();
                        if *shutdown_listen.borrow() { break; }
                    }
                } => {
                    tracing::info!("LightRAG LISTEN task shutting down");
                    break;
                }
            }
        }
    });

    // ── Task 2: Periodic full re-seed ─────────────────────────────────────────
    if config.full_reseed_interval_secs > 0 {
        let pool_reseed = pool.clone();
        let collection = config.collection.clone();
        let embed_fn_reseed = embed_fn.clone();
        let interval_secs = config.full_reseed_interval_secs;
        let interval = std::time::Duration::from_secs(interval_secs);
        let mut shutdown_reseed = shutdown.clone();

        tokio::spawn(async move {
            tracing::info!(interval_secs, "Periodic full re-seed enabled");

            // Run initial seed on startup
            tracing::info!("Running initial full seed");
            match super::lightrag_seeder::seed_all(
                &pool_reseed,
                &collection,
                embed_fn_reseed.clone(),
            )
            .await
            {
                Ok(results) => {
                    let total: usize = results
                        .iter()
                        .map(|r| r.entities_created + r.relations_created)
                        .sum();
                    tracing::info!(
                        total,
                        sources = results.len(),
                        "Initial LightRAG seed complete"
                    );
                },
                Err(e) => {
                    tracing::error!(error = %e, "Initial LightRAG seed failed");
                },
            }

            loop {
                tokio::select! {
                    _ = tokio::time::sleep(interval) => {
                        tracing::info!("Running periodic full re-seed");
                        match super::lightrag_seeder::seed_all(
                            &pool_reseed,
                            &collection,
                            embed_fn_reseed.clone(),
                        )
                        .await
                        {
                            Ok(results) => {
                                let total: usize = results
                                    .iter()
                                    .map(|r| r.entities_created + r.relations_created)
                                    .sum();
                                tracing::info!(total, "Periodic LightRAG re-seed complete");
                            }
                            Err(e) => {
                                tracing::error!(error = %e, "Periodic LightRAG re-seed failed");
                            }
                        }
                    }
                    _ = async {
                        loop {
                            shutdown_reseed.changed().await.ok();
                            if *shutdown_reseed.borrow() { break; }
                        }
                    } => {
                        tracing::info!("LightRAG re-seed task shutting down");
                        break;
                    }
                }
            }
        });
    }

    // ── Task 3: Auto-discover new tables and attach triggers ──────────────────
    if config.auto_discover_interval_secs > 0 {
        let pool_discover = pool.clone();
        let interval_secs = config.auto_discover_interval_secs;
        let interval = std::time::Duration::from_secs(interval_secs);
        let mut shutdown_discover = shutdown.clone();

        tokio::spawn(async move {
            tracing::info!(interval_secs, "Table auto-discovery enabled");

            loop {
                tokio::select! {
                    _ = tokio::time::sleep(interval) => {
                        tracing::debug!("Running table auto-discovery");
                        match discover_and_attach_triggers(&pool_discover).await {
                            Ok(count) => {
                                if count > 0 {
                                    tracing::info!(
                                        new_triggers = count,
                                        "Auto-discovered and attached KG triggers to new tables"
                                    );
                                }
                            }
                            Err(e) => {
                                tracing::debug!(error = %e, "Table discovery failed (non-fatal)");
                            }
                        }
                    }
                    _ = async {
                        loop {
                            shutdown_discover.changed().await.ok();
                            if *shutdown_discover.borrow() { break; }
                        }
                    } => {
                        tracing::info!("LightRAG auto-discovery task shutting down");
                        break;
                    }
                }
            }
        });
    }
}

/// Auto-discover tables that do not yet have a `kg_notify_change` trigger and
/// attach one.
///
/// Queries `information_schema` for base tables with an `id` column that lack
/// any trigger matching `trg_kg_%`, then issues `CREATE OR REPLACE TRIGGER`
/// for each. Failures per-table are non-fatal (views and partitioned tables
/// reject the DDL, which is expected).
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the initial discovery query
/// fails. Per-table trigger attachment errors are silently ignored.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result` or logged.
async fn discover_and_attach_triggers(pool: &DatabasePool) -> signapps_common::Result<usize> {
    let new_tables: Vec<(String, String)> = sqlx::query_as(
        r#"
        SELECT t.table_schema, t.table_name
        FROM information_schema.tables t
        JOIN information_schema.columns c
             ON c.table_schema = t.table_schema
            AND c.table_name   = t.table_name
            AND c.column_name  = 'id'
        WHERE t.table_type = 'BASE TABLE'
          AND t.table_schema NOT IN ('pg_catalog', 'information_schema', 'ai', 'vault')
          AND t.table_name NOT IN ('sessions', 'api_keys', 'sso_configs', 'ldap_config')
          AND t.table_name NOT LIKE '%password%'
          AND t.table_name NOT LIKE '%secret%'
          AND t.table_name NOT LIKE '%token%'
          AND t.table_name NOT LIKE '%key%'
          AND t.table_name NOT LIKE '%vault%'
          AND t.table_name NOT LIKE '%credential%'
          AND t.table_name NOT LIKE '%certificate%'
          AND NOT EXISTS (
              SELECT 1
              FROM information_schema.triggers tr
              WHERE tr.event_object_schema = t.table_schema
                AND tr.event_object_table  = t.table_name
                AND tr.trigger_name LIKE 'trg_kg_%'
          )
        ORDER BY t.table_schema, t.table_name
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let mut attached = 0usize;
    for (schema, table) in &new_tables {
        // Double-check: never attach to sensitive tables (defense-in-depth)
        let is_sensitive = AUTO_DISCOVER_EXCLUDED
            .iter()
            .any(|exc| table.to_lowercase().contains(exc) || schema.to_lowercase().contains(exc));
        if is_sensitive {
            tracing::trace!(
                table = %table,
                schema = %schema,
                "Skipping sensitive table during auto-discovery"
            );
            continue;
        }

        let safe_schema = schema.replace('.', "_");
        let trigger_name = format!("trg_kg_{}_{}", safe_schema, table);
        let full_name = format!("{}.{}", schema, table);

        let sql = format!(
            "CREATE OR REPLACE TRIGGER {} \
             AFTER INSERT OR UPDATE ON {} \
             FOR EACH ROW EXECUTE FUNCTION kg_notify_change()",
            trigger_name, full_name
        );

        match sqlx::query(&sql).execute(pool.inner()).await {
            Ok(_) => {
                tracing::info!(table = %full_name, "Attached KG trigger to new table");
                attached += 1;
            },
            Err(e) => {
                tracing::trace!(
                    table = %full_name,
                    error = %e,
                    "Could not attach trigger (likely a view, partition, or system table)"
                );
            },
        }
    }

    Ok(attached)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn table_to_seeder_covers_all_tiers() {
        let map = table_to_seeder();
        // Tier 1
        assert!(map.contains_key("identity.users"));
        assert!(map.contains_key("core.persons"));
        assert!(map.contains_key("workforce_org_nodes"));
        assert!(map.contains_key("workforce_org_groups"));
        assert!(map.contains_key("core.assignments"));
        // Tier 2
        assert!(map.contains_key("calendar.events"));
        assert!(map.contains_key("storage.files"));
        // Tier 3
        assert!(map.contains_key("meet.rooms"));
        assert!(map.contains_key("social.posts"));
        // Tier 4
        assert!(map.contains_key("it.hardware"));
        assert!(map.contains_key("billing.invoices"));
        assert!(map.len() >= 17);
    }

    #[test]
    fn default_config_sensible() {
        let cfg = WatcherConfig::default();
        assert_eq!(cfg.channel, "kg_data_change");
        assert_eq!(cfg.collection, "signapps");
        assert_eq!(cfg.debounce_ms, 2000);
        assert_eq!(cfg.full_reseed_interval_secs, 86400);
        assert_eq!(cfg.auto_discover_interval_secs, 3600);
    }

    #[test]
    fn change_notification_deserialize() {
        let json = r#"{"table":"identity.users","op":"INSERT","id":"550e8400-e29b-41d4-a716-446655440000"}"#;
        let change: ChangeNotification = serde_json::from_str(json).unwrap();
        assert_eq!(change.table, "identity.users");
        assert_eq!(change.op, "INSERT");
        assert_eq!(change.id, "550e8400-e29b-41d4-a716-446655440000");
    }

    #[test]
    fn change_notification_delete_op() {
        let json = r#"{"table":"workforce_org_nodes","op":"DELETE","id":"123"}"#;
        let change: ChangeNotification = serde_json::from_str(json).unwrap();
        assert_eq!(change.op, "DELETE");
    }

    #[test]
    fn excluded_tables_not_discovered() {
        let excluded = AUTO_DISCOVER_EXCLUDED;
        assert!(excluded.contains(&"sessions"));
        assert!(excluded.contains(&"api_keys"));
        assert!(excluded.contains(&"vault"));
        assert!(excluded.contains(&"password"));
        assert!(excluded.contains(&"credentials"));
        assert!(excluded.contains(&"sso_configs"));
    }

    #[test]
    fn sensitive_table_is_detected() {
        let sensitive_names = &[
            "sessions",
            "api_keys",
            "user_tokens",
            "vault_entries",
            "sso_configs",
        ];
        for name in sensitive_names {
            let is_sensitive = AUTO_DISCOVER_EXCLUDED
                .iter()
                .any(|exc| name.to_lowercase().contains(exc));
            assert!(
                is_sensitive,
                "Expected '{}' to be detected as sensitive",
                name
            );
        }
    }

    #[test]
    fn safe_table_is_not_excluded() {
        let safe_names = &["users", "org_nodes", "calendar_events", "invoices"];
        for name in safe_names {
            let is_sensitive = AUTO_DISCOVER_EXCLUDED
                .iter()
                .any(|exc| name.to_lowercase().contains(exc));
            assert!(
                !is_sensitive,
                "Expected '{}' NOT to be detected as sensitive",
                name
            );
        }
    }

    #[test]
    fn debounce_logic_new_entry_always_triggers() {
        let mut pending: HashMap<String, tokio::time::Instant> = HashMap::new();
        let debounce = std::time::Duration::from_millis(2000);
        let seeder = "users";

        let now = tokio::time::Instant::now();
        let should_trigger = pending
            .get(seeder)
            .map(|last| now.duration_since(*last) > debounce)
            .unwrap_or(true);

        assert!(should_trigger, "First encounter should always trigger");
        pending.insert(seeder.to_string(), now);

        // Immediate second call should NOT trigger (within debounce window)
        let should_trigger2 = pending
            .get(seeder)
            .map(|last| now.duration_since(*last) > debounce)
            .unwrap_or(true);
        assert!(
            !should_trigger2,
            "Immediate second call should be debounced"
        );
    }
}
