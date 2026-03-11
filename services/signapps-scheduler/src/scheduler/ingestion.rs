use reqwest::Client;
use serde_json::json;
use signapps_common::traits::crawler::DatabaseCrawler;
use signapps_db::DatabasePool;
use std::sync::Arc;
use tokio::time::{interval, Duration};

use crate::crawlers::calendar::CalendarCrawler;

pub async fn start_ingestion_loop(pool: DatabasePool) {
    let crawlers: Vec<Arc<dyn DatabaseCrawler>> = vec![
        Arc::new(CalendarCrawler),
        // Add more crawlers here in the future
    ];

    let mut check_interval = interval(Duration::from_secs(300)); // Run every 5 minutes
    let http_client = Client::new();

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
                                // Push to AI service
                                let payload = json!({
                                    "content": doc.content,
                                    "filename": format!("{}-{}", doc.source_table, doc.record_id),
                                    "path": format!("/{}/{}", doc.source_table, doc.record_id),
                                    "collection": doc.source_table,
                                    "security_tags": doc.security_tags
                                });

                                let res = http_client
                                    .post("http://signapps-ai:8006/ai/index") // Assume internal DNS
                                    .json(&payload)
                                    .send()
                                    .await;

                                match res {
                                    Ok(response) if response.status().is_success() => {
                                        let _ = crawler.mark_as_processed(&pool, record_id).await;
                                    },
                                    Ok(response) => {
                                        tracing::error!(
                                            "Failed to ingest {}: {}",
                                            record_id,
                                            response.status()
                                        );
                                    },
                                    Err(e) => {
                                        tracing::error!("Failed to connect to AI service: {}", e);
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
