use chrono::Utc;
use sqlx::{Pool, Postgres, Row};
use tokio::time::{interval, Duration};
use uuid::Uuid;

use crate::platforms::SocialPlatform;

/// Background task: every 60 seconds, publish all posts that are due.
pub async fn start_publisher(pool: Pool<Postgres>) {
    let mut ticker = interval(Duration::from_secs(60));
    loop {
        ticker.tick().await;
        if let Err(e) = publish_due_posts(&pool).await {
            tracing::error!("publisher error: {e}");
        }
    }
}

async fn publish_due_posts(pool: &Pool<Postgres>) -> anyhow::Result<()> {
    // Fetch posts that are scheduled and due now
    let rows = sqlx::query(
        "SELECT p.id AS post_id, p.content, p.media_urls,
                pt.id AS target_id, pt.account_id, pt.content_override,
                a.platform, a.access_token, a.platform_config
         FROM social.posts p
         JOIN social.post_targets pt ON pt.post_id = p.id
         JOIN social.accounts a ON a.id = pt.account_id
         WHERE p.status = 'scheduled'
           AND p.scheduled_at <= $1
           AND pt.status = 'pending'
           AND a.is_active = true",
    )
    .bind(Utc::now())
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(());
    }

    tracing::info!("publisher: {} target(s) to publish", rows.len());

    for row in &rows {
        let post_id: Uuid = row.get("post_id");
        let target_id: Uuid = row.get("target_id");
        let content: String = row.get("content");
        let content_override: Option<String> = row.get("content_override");
        let media_urls: serde_json::Value = row.get("media_urls");
        let platform: String = row.get("platform");
        let access_token: Option<String> = row.get("access_token");
        let platform_config: serde_json::Value = row.get("platform_config");

        let publish_content = content_override.unwrap_or(content);
        let media: Vec<String> = media_urls
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        let result = match (platform.as_str(), access_token) {
            ("mastodon", Some(token)) => {
                let instance = platform_config["instance_url"]
                    .as_str()
                    .unwrap_or("https://mastodon.social")
                    .to_string();
                let client = crate::platforms::mastodon::MastodonClient::new(instance, token);
                client.publish(&publish_content, &media).await
            },
            ("bluesky", Some(token)) => {
                let pds = platform_config["pds_url"]
                    .as_str()
                    .unwrap_or("https://bsky.social")
                    .to_string();
                let did = platform_config["did"].as_str().unwrap_or("").to_string();
                let client = crate::platforms::bluesky::BlueskyClient::new(pds, did, token);
                client.publish(&publish_content, &media).await
            },
            ("twitter", Some(token)) => {
                let client = crate::platforms::twitter::TwitterClient {
                    access_token: token,
                };
                client.publish(&publish_content, &media).await
            },
            ("facebook", Some(token)) => {
                let page_id = platform_config["page_id"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let client = crate::platforms::facebook::FacebookClient {
                    access_token: token,
                    page_id,
                };
                client.publish(&publish_content, &media).await
            },
            ("linkedin", Some(token)) => {
                let author_urn = platform_config["author_urn"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let client = crate::platforms::linkedin::LinkedinClient {
                    access_token: token,
                    author_urn,
                };
                client.publish(&publish_content, &media).await
            },
            ("instagram", Some(token)) => {
                let user_id = platform_config["user_id"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let client = crate::platforms::instagram::InstagramClient {
                    access_token: token,
                    user_id,
                };
                client.publish(&publish_content, &media).await
            },
            ("tiktok", Some(token)) => {
                let open_id = platform_config["open_id"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let client = crate::platforms::tiktok::TikTokClient {
                    access_token: token,
                    open_id,
                };
                client.publish(&publish_content, &media).await
            },
            ("youtube", Some(token)) => {
                let channel_id = platform_config["channel_id"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let client = crate::platforms::youtube::YouTubeClient {
                    access_token: token,
                    channel_id,
                };
                client.publish(&publish_content, &media).await
            },
            ("pinterest", Some(token)) => {
                let board_id = platform_config["board_id"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let client = crate::platforms::pinterest::PinterestClient {
                    access_token: token,
                    board_id,
                };
                client.publish(&publish_content, &media).await
            },
            ("threads", Some(token)) => {
                let user_id = platform_config["user_id"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let client = crate::platforms::threads::ThreadsClient {
                    access_token: token,
                    user_id,
                };
                client.publish(&publish_content, &media).await
            },
            (p, _) => {
                tracing::warn!("publisher: platform '{}' not supported or missing token", p);
                // Mark as failed
                let _ = sqlx::query(
                    "UPDATE social.post_targets
                     SET status='failed', error_message=$1
                     WHERE id=$2",
                )
                .bind(format!("Platform '{}' not configured", p))
                .bind(target_id)
                .execute(pool)
                .await;
                continue;
            },
        };

        match result {
            Ok(published) => {
                tracing::info!(
                    post_id = %post_id,
                    target_id = %target_id,
                    platform_post_id = %published.platform_post_id,
                    "Published successfully"
                );
                let _ = sqlx::query(
                    "UPDATE social.post_targets
                     SET status='published', platform_post_id=$1, platform_url=$2,
                         published_at=NOW()
                     WHERE id=$3",
                )
                .bind(&published.platform_post_id)
                .bind(&published.platform_url)
                .bind(target_id)
                .execute(pool)
                .await;
            },
            Err(e) => {
                tracing::error!(post_id = %post_id, target_id = %target_id, "Publish failed: {e}");
                let _ = sqlx::query(
                    "UPDATE social.post_targets
                     SET status='failed', error_message=$1
                     WHERE id=$2",
                )
                .bind(e.to_string())
                .bind(target_id)
                .execute(pool)
                .await;
            },
        }
    }

    // Update post-level status: if ALL targets done, mark post as published or failed
    let post_ids: Vec<Uuid> = rows
        .iter()
        .map(|r| r.get::<Uuid, _>("post_id"))
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    for post_id in post_ids {
        let counts = sqlx::query(
            "SELECT
                COUNT(*) FILTER (WHERE status = 'pending') AS pending,
                COUNT(*) FILTER (WHERE status = 'published') AS published,
                COUNT(*) FILTER (WHERE status = 'failed') AS failed
             FROM social.post_targets WHERE post_id = $1",
        )
        .bind(post_id)
        .fetch_one(pool)
        .await;

        if let Ok(row) = counts {
            let pending: i64 = row.get("pending");
            let published: i64 = row.get("published");
            let failed: i64 = row.get("failed");

            if pending == 0 {
                let new_status = if published > 0 { "published" } else { "failed" };
                let published_at = if published > 0 {
                    Some(Utc::now())
                } else {
                    None
                };
                let _ = sqlx::query(
                    "UPDATE social.posts
                     SET status=$1, published_at=$2, updated_at=NOW()
                     WHERE id=$3",
                )
                .bind(new_status)
                .bind(published_at)
                .bind(post_id)
                .execute(pool)
                .await;

                tracing::info!(
                    post_id = %post_id,
                    status = new_status,
                    published = published,
                    failed = failed,
                    "Post status updated"
                );
            }
        }
    }

    Ok(())
}
