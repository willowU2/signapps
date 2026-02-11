//! MinIO/S3 client implementation.

use aws_config::BehaviorVersion;
use aws_sdk_s3::config::{Credentials, Region};
use aws_sdk_s3::operation::get_object::GetObjectOutput;
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;
use bytes::Bytes;
use signapps_common::{Error, Result};
use std::sync::Arc;

use super::types::*;

/// MinIO/S3 client wrapper.
#[derive(Clone)]
pub struct MinioClient {
    client: Arc<Client>,
    endpoint: String,
}

impl MinioClient {
    /// Create a new MinIO client.
    ///
    /// # Arguments
    /// * `endpoint` - Full endpoint URL (e.g., "http://localhost:9000")
    /// * `access_key` - MinIO/S3 access key
    /// * `secret_key` - MinIO/S3 secret key
    /// * `region` - AWS region (e.g., "us-east-1")
    pub async fn new(
        endpoint: &str,
        access_key: &str,
        secret_key: &str,
        region: &str,
    ) -> Result<Self> {
        let credentials = Credentials::new(access_key, secret_key, None, None, "signapps");

        let config = aws_sdk_s3::Config::builder()
            .behavior_version(BehaviorVersion::latest())
            .region(Region::new(region.to_string()))
            .endpoint_url(endpoint)
            .credentials_provider(credentials)
            .force_path_style(true)
            .build();

        let client = Client::from_conf(config);

        Ok(Self {
            client: Arc::new(client),
            endpoint: endpoint.to_string(),
        })
    }

    /// Get the endpoint URL.
    pub fn endpoint(&self) -> &str {
        &self.endpoint
    }

    // =========================================================================
    // Bucket Operations
    // =========================================================================

    /// List all buckets.
    pub async fn list_buckets(&self) -> Result<Vec<BucketInfo>> {
        let response = self
            .client
            .list_buckets()
            .send()
            .await
            .map_err(|e| Error::Storage(format!("Failed to list buckets: {}", e)))?;

        let buckets = response
            .buckets()
            .iter()
            .map(|b| BucketInfo {
                name: b.name().unwrap_or_default().to_string(),
                creation_date: b.creation_date().map(|d| d.to_string()),
            })
            .collect();

        Ok(buckets)
    }

    /// Create a bucket.
    pub async fn create_bucket(&self, name: &str) -> Result<()> {
        self.client
            .create_bucket()
            .bucket(name)
            .send()
            .await
            .map_err(|e| Error::Storage(format!("Failed to create bucket: {}", e)))?;

        tracing::info!(bucket = %name, "Bucket created");
        Ok(())
    }

    /// Delete a bucket.
    pub async fn delete_bucket(&self, name: &str) -> Result<()> {
        self.client
            .delete_bucket()
            .bucket(name)
            .send()
            .await
            .map_err(|e| Error::Storage(format!("Failed to delete bucket: {}", e)))?;

        tracing::info!(bucket = %name, "Bucket deleted");
        Ok(())
    }

    /// Check if bucket exists.
    pub async fn bucket_exists(&self, name: &str) -> Result<bool> {
        match self.client.head_bucket().bucket(name).send().await {
            Ok(_) => Ok(true),
            Err(e) => {
                let err_str = e.to_string();
                if err_str.contains("404") || err_str.contains("NotFound") {
                    Ok(false)
                } else {
                    Err(Error::Storage(format!("Failed to check bucket: {}", e)))
                }
            },
        }
    }

    // =========================================================================
    // Object Operations
    // =========================================================================

    /// List objects in a bucket.
    pub async fn list_objects(
        &self,
        bucket: &str,
        query: ListObjectsQuery,
    ) -> Result<ListObjectsResponse> {
        let mut request = self.client.list_objects_v2().bucket(bucket);

        if let Some(prefix) = query.prefix {
            request = request.prefix(prefix);
        }
        if let Some(delimiter) = query.delimiter {
            request = request.delimiter(delimiter);
        }
        if let Some(max_keys) = query.max_keys {
            request = request.max_keys(max_keys);
        }
        if let Some(token) = query.continuation_token {
            request = request.continuation_token(token);
        }

        let response = request
            .send()
            .await
            .map_err(|e| Error::Storage(format!("Failed to list objects: {}", e)))?;

        let objects = response
            .contents()
            .iter()
            .map(|o| ObjectInfo {
                key: o.key().unwrap_or_default().to_string(),
                size: o.size().unwrap_or(0),
                last_modified: o.last_modified().map(|d| d.to_string()),
                etag: o.e_tag().map(|s| s.to_string()),
                content_type: None,
            })
            .collect();

        let prefixes = response
            .common_prefixes()
            .iter()
            .filter_map(|p| p.prefix().map(|s| s.to_string()))
            .collect();

        Ok(ListObjectsResponse {
            objects,
            prefixes,
            is_truncated: response.is_truncated().unwrap_or(false),
            next_continuation_token: response.next_continuation_token().map(|s| s.to_string()),
        })
    }

    /// Get object metadata.
    pub async fn get_object_info(&self, bucket: &str, key: &str) -> Result<ObjectInfo> {
        let response = self
            .client
            .head_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| Error::Storage(format!("Object not found: {}", e)))?;

        Ok(ObjectInfo {
            key: key.to_string(),
            size: response.content_length().unwrap_or(0),
            last_modified: response.last_modified().map(|d| d.to_string()),
            etag: response.e_tag().map(|s| s.to_string()),
            content_type: response.content_type().map(|s| s.to_string()),
        })
    }

    /// Upload an object.
    pub async fn put_object(
        &self,
        bucket: &str,
        key: &str,
        data: Bytes,
        content_type: Option<&str>,
    ) -> Result<()> {
        let mut request = self
            .client
            .put_object()
            .bucket(bucket)
            .key(key)
            .body(ByteStream::from(data));

        if let Some(ct) = content_type {
            request = request.content_type(ct);
        }

        request
            .send()
            .await
            .map_err(|e| Error::Storage(format!("Failed to upload object: {}", e)))?;

        tracing::debug!(bucket = %bucket, key = %key, "Object uploaded");
        Ok(())
    }

    /// Download an object.
    pub async fn get_object(&self, bucket: &str, key: &str) -> Result<GetObjectOutput> {
        let response = self
            .client
            .get_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| Error::Storage(format!("Failed to download object: {}", e)))?;

        Ok(response)
    }

    /// Download object as bytes.
    pub async fn get_object_bytes(&self, bucket: &str, key: &str) -> Result<Bytes> {
        let response = self.get_object(bucket, key).await?;

        let data = response
            .body
            .collect()
            .await
            .map_err(|e| Error::Storage(format!("Failed to read object: {}", e)))?
            .into_bytes();

        Ok(data)
    }

    /// Delete an object.
    pub async fn delete_object(&self, bucket: &str, key: &str) -> Result<()> {
        self.client
            .delete_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| Error::Storage(format!("Failed to delete object: {}", e)))?;

        tracing::debug!(bucket = %bucket, key = %key, "Object deleted");
        Ok(())
    }

    /// Copy an object.
    pub async fn copy_object(
        &self,
        source_bucket: &str,
        source_key: &str,
        dest_bucket: &str,
        dest_key: &str,
    ) -> Result<()> {
        let copy_source = format!("{}/{}", source_bucket, source_key);

        self.client
            .copy_object()
            .copy_source(&copy_source)
            .bucket(dest_bucket)
            .key(dest_key)
            .send()
            .await
            .map_err(|e| Error::Storage(format!("Failed to copy object: {}", e)))?;

        tracing::debug!(
            from = %copy_source,
            to = format!("{}/{}", dest_bucket, dest_key),
            "Object copied"
        );
        Ok(())
    }

    /// Move an object (copy + delete).
    pub async fn move_object(
        &self,
        source_bucket: &str,
        source_key: &str,
        dest_bucket: &str,
        dest_key: &str,
    ) -> Result<()> {
        self.copy_object(source_bucket, source_key, dest_bucket, dest_key)
            .await?;
        self.delete_object(source_bucket, source_key).await?;
        Ok(())
    }

    /// Get storage stats for a bucket.
    pub async fn get_bucket_stats(&self, bucket: &str) -> Result<StorageStats> {
        let mut total_objects = 0usize;
        let mut total_size = 0i64;
        let mut continuation_token: Option<String> = None;

        loop {
            let query = ListObjectsQuery {
                prefix: None,
                delimiter: None,
                max_keys: Some(1000),
                continuation_token: continuation_token.clone(),
            };

            let response = self.list_objects(bucket, query).await?;

            total_objects += response.objects.len();
            total_size += response.objects.iter().map(|o| o.size).sum::<i64>();

            if response.is_truncated {
                continuation_token = response.next_continuation_token;
            } else {
                break;
            }
        }

        Ok(StorageStats {
            total_buckets: 1,
            total_objects,
            total_size_bytes: total_size,
        })
    }
}
