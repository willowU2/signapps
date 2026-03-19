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

    loop {
        check_interval.tick().await;

        for crawler in &crawlers {
            match crawler.fetch_pending_records(&pool, 50).await {
                Ok(records) => {
                    if records.is_empty() {
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
                                // Push to AI service via AiIndexerClient
                                let result = indexer
                                    .index_text(
                                        &doc.source_table,
                                        doc.record_id,
                                        &format!("{}-{}", doc.source_table, doc.record_id),
                                        &format!("/{}/{}", doc.source_table, doc.record_id),
                                        &doc.content,
                                    )
                                    .await;

                                match result {
                                    Ok(()) => {
                                        let _ = crawler.mark_as_processed(&pool, record_id).await;
                                    },
                                    Err(e) => {
                                        tracing::error!("Failed to ingest {}: {}", record_id, e);
                                    },
                                }
                            },
                            Ok(None) => {
                                // Record was deleted before we could crawl it
                                let _ = crawler.mark_as_processed(&pool, record_id).await;
                            },
                            Err(e) => {
                                tracing::error!("Crawler error on record {}: {}", record_id, e);
                            },
                        }
                    }
                },
                Err(e) => {
                    tracing::error!(
                        "Failed to fetch pending records for crawler '{}': {}",
                        crawler.table_name(),
                        e
                    );
                },
            }
        }
    }
}
