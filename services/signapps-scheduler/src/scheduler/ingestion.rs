use signapps_common::traits::crawler::DatabaseCrawler;
use signapps_common::AiIndexerClient;
use signapps_db::DatabasePool;
use std::sync::Arc;
use tokio::time::{interval, Duration};

use crate::crawlers::calendar::CalendarCrawler;
use crate::crawlers::chat::ChatCrawler;
use crate::crawlers::docs::DocsCrawler;
use crate::crawlers::mail::MailCrawler;
use crate::crawlers::storage::StorageCrawler;
use crate::crawlers::projects::ProjectCrawler;
use crate::crawlers::tasks::TaskCrawler;

pub async fn start_ingestion_loop(pool: DatabasePool) {
    let crawlers: Vec<Arc<dyn DatabaseCrawler>> = vec![
        Arc::new(CalendarCrawler),
        Arc::new(MailCrawler),
        Arc::new(DocsCrawler),
        Arc::new(StorageCrawler),
        Arc::new(ChatCrawler),
        Arc::new(ProjectCrawler),
        Arc::new(TaskCrawler),
    ];

    let mut check_interval = interval(Duration::from_secs(300)); // Run every 5 minutes
    let indexer = AiIndexerClient::from_env();

    // Guards against unbounded ingestion
    const BATCH_SIZE: i64 = 50;
    const INGESTION_TIMEOUT_SECS: u64 = 120; // Max time per crawler per cycle
    const ERROR_THRESHOLD: u32 = 3; // Pause after N consecutive errors

    let mut consecutive_errors = 0;

    loop {
        check_interval.tick().await;

        // Early exit if too many consecutive errors to prevent cascade
        if consecutive_errors >= ERROR_THRESHOLD {
            tracing::warn!(
                "Ingestion loop paused after {} consecutive errors. Will retry at next interval.",
                consecutive_errors
            );
            consecutive_errors = 0;
            continue;
        }

        for crawler in &crawlers {
            // Apply timeout to fetch_pending_records to prevent deadlock
            match tokio::time::timeout(
                Duration::from_secs(INGESTION_TIMEOUT_SECS),
                crawler.fetch_pending_records(&pool, BATCH_SIZE),
            )
            .await
            {
                Ok(Ok(records)) => {
                    if records.is_empty() {
                        consecutive_errors = 0; // Reset on successful (empty) run
                        continue;
                    }

                    tracing::info!(
                        "Crawler '{}' found {} pending records",
                        crawler.table_name(),
                        records.len()
                    );

                    for record_id in records {
                        match crawler.crawl_record(&pool, record_id).await {
                            Ok(Some(doc)) => {
                                // Apply timeout to AI indexing call
                                let result = tokio::time::timeout(
                                    Duration::from_secs(30),
                                    indexer.index_text(
                                        &doc.source_table,
                                        doc.record_id,
                                        &format!("{}-{}", doc.source_table, doc.record_id),
                                        &format!("/{}/{}", doc.source_table, doc.record_id),
                                        &doc.content,
                                    ),
                                )
                                .await;

                                match result {
                                    Ok(Ok(())) => {
                                        consecutive_errors = 0;
                                        let _ = crawler.mark_as_processed(&pool, record_id).await;
                                    },
                                    Ok(Err(e)) => {
                                        consecutive_errors = consecutive_errors.saturating_add(1);
                                        tracing::error!("Failed to ingest {}: {}", record_id, e);
                                    },
                                    Err(_) => {
                                        consecutive_errors = consecutive_errors.saturating_add(1);
                                        tracing::error!("Indexing timeout for record {}", record_id);
                                    },
                                }
                            },
                            Ok(None) => {
                                // Record was deleted before we could crawl it
                                let _ = crawler.mark_as_processed(&pool, record_id).await;
                            },
                            Err(e) => {
                                consecutive_errors = consecutive_errors.saturating_add(1);
                                tracing::error!("Crawler error on record {}: {}", record_id, e);
                            },
                        }
                    }
                },
                Ok(Err(e)) => {
                    consecutive_errors = consecutive_errors.saturating_add(1);
                    tracing::error!(
                        "Failed to fetch pending records for crawler '{}': {}",
                        crawler.table_name(),
                        e
                    );
                },
                Err(_) => {
                    consecutive_errors = consecutive_errors.saturating_add(1);
                    tracing::error!(
                        "Fetch timeout for crawler '{}' after {}s",
                        crawler.table_name(),
                        INGESTION_TIMEOUT_SECS
                    );
                },
            }
        }
    }
}
