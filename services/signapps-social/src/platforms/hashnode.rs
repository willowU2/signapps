use async_trait::async_trait;
use serde::Deserialize;
use uuid::Uuid;

use super::{PlatformError, PlatformResult, SocialPlatform};
use crate::models::{AccountAnalytics, InboxItem, PlatformPost};

/// Hashnode GraphQL API client (Personal Access Token).
pub struct HashnodeClient {
    pub access_token: String,
    /// Publication ID (stored in platform_config)
    pub publication_id: String,
}

const HASHNODE_API: &str = "https://gql.hashnode.com";

#[derive(Deserialize)]
struct GraphQLResponse {
    data: Option<serde_json::Value>,
    errors: Option<Vec<GraphQLError>>,
}

#[derive(Deserialize)]
struct GraphQLError {
    message: String,
}

impl HashnodeClient {
    async fn graphql(
        &self,
        query: &str,
        variables: serde_json::Value,
    ) -> PlatformResult<serde_json::Value> {
        let client = reqwest::Client::new();
        let resp = client
            .post(HASHNODE_API)
            .header("Authorization", &self.access_token)
            .json(&serde_json::json!({
                "query": query,
                "variables": variables,
            }))
            .send()
            .await
            .map_err(PlatformError::Http)?;

        let status = resp.status().as_u16();
        if !resp.status().is_success() {
            let msg = resp.text().await.unwrap_or_default();
            return Err(PlatformError::Api {
                status,
                message: msg,
            });
        }

        let body: GraphQLResponse = resp.json().await.map_err(PlatformError::Http)?;

        if let Some(errors) = body.errors {
            if !errors.is_empty() {
                return Err(PlatformError::Other(format!(
                    "Hashnode GraphQL error: {}",
                    errors[0].message
                )));
            }
        }

        body.data
            .ok_or_else(|| PlatformError::Other("Hashnode: empty data in response".to_string()))
    }
}

#[async_trait]
impl SocialPlatform for HashnodeClient {
    async fn publish(&self, content: &str, _media: &[String]) -> PlatformResult<PlatformPost> {
        let (title, body) = if let Some(nl) = content.find('\n') {
            (&content[..nl], &content[nl + 1..])
        } else {
            (content, "")
        };

        let mutation = r#"
            mutation PublishPost($input: PublishPostInput!) {
                publishPost(input: $input) {
                    post {
                        id
                        url
                    }
                }
            }
        "#;

        let data = self
            .graphql(
                mutation,
                serde_json::json!({
                    "input": {
                        "title": title,
                        "contentMarkdown": body,
                        "publicationId": self.publication_id,
                    }
                }),
            )
            .await?;

        let post = &data["publishPost"]["post"];
        let id = post["id"]
            .as_str()
            .ok_or_else(|| PlatformError::Other("Hashnode: missing post id".to_string()))?
            .to_string();
        let url = post["url"].as_str().map(str::to_string);

        Ok(PlatformPost {
            platform_post_id: id,
            platform_url: url,
        })
    }

    async fn delete_post(&self, platform_post_id: &str) -> PlatformResult<()> {
        let mutation = r#"
            mutation RemovePost($input: RemovePostInput!) {
                removePost(input: $input) {
                    post {
                        id
                    }
                }
            }
        "#;

        self.graphql(
            mutation,
            serde_json::json!({ "input": { "id": platform_post_id } }),
        )
        .await?;

        Ok(())
    }

    async fn fetch_comments(&self, platform_post_id: &str) -> PlatformResult<Vec<InboxItem>> {
        let query = r#"
            query GetPost($id: ID!) {
                post(id: $id) {
                    comments(first: 100) {
                        edges {
                            node {
                                id
                                content {
                                    markdown
                                }
                                author {
                                    name
                                    profilePicture
                                }
                            }
                        }
                    }
                }
            }
        "#;

        let data = self
            .graphql(query, serde_json::json!({ "id": platform_post_id }))
            .await
            .unwrap_or_default();

        let mut items = Vec::new();
        if let Some(edges) = data["post"]["comments"]["edges"].as_array() {
            for edge in edges {
                let node = &edge["node"];
                items.push(InboxItem {
                    id: Uuid::new_v4(),
                    account_id: Uuid::nil(),
                    platform_item_id: node["id"].as_str().map(str::to_string),
                    item_type: "comment".to_string(),
                    author_name: node["author"]["name"].as_str().map(str::to_string),
                    author_avatar: node["author"]["profilePicture"]
                        .as_str()
                        .map(str::to_string),
                    content: node["content"]["markdown"].as_str().map(str::to_string),
                    post_id: None,
                    parent_id: None,
                    is_read: false,
                    sentiment: None,
                    received_at: chrono::Utc::now(),
                    created_at: chrono::Utc::now(),
                });
            }
        }

        Ok(items)
    }

    async fn reply(&self, _item_id: &str, _content: &str) -> PlatformResult<()> {
        // Hashnode API does not support posting replies via API
        Err(PlatformError::Other(
            "Hashnode does not support replies via API".to_string(),
        ))
    }

    async fn fetch_analytics(&self) -> PlatformResult<AccountAnalytics> {
        let query = r#"
            query GetPublication($id: ObjectId!) {
                publication(id: $id) {
                    postsCount: posts { totalDocuments }
                }
            }
        "#;

        let data = self
            .graphql(query, serde_json::json!({ "id": self.publication_id }))
            .await
            .unwrap_or_default();

        let posts_count = data["publication"]["postsCount"]["totalDocuments"]
            .as_i64()
            .unwrap_or(0) as i32;

        Ok(AccountAnalytics {
            followers: 0,
            following: 0,
            posts_count,
            impressions: 0,
            reach: 0,
            engagement: 0,
        })
    }
}
