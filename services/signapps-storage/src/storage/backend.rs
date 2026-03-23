//! Storage backend implementation using OpenDAL.

use bytes::Bytes;
use opendal::services::{Fs, S3};
use opendal::Operator;
use signapps_common::{Error, Result};

/// Validate storage path components to prevent path traversal attacks.
fn validate_storage_path(component: &str) -> Result<()> {
    if component.contains("..")
        || component.starts_with('/')
        || component.starts_with('\\')
        || component.contains('\0')
    {
        return Err(Error::Validation(
            "Invalid path component: contains forbidden characters".to_string(),
        ));
    }
    Ok(())
}

use super::types::*;

/// Storage mode.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum StorageMode {
    /// Local filesystem storage.
    Fs,
    /// S3-compatible storage (AWS, MinIO, etc.).
    S3,
}

/// Storage backend wrapping OpenDAL.
#[derive(Clone)]
pub struct StorageBackend {
    operator: Operator,
    mode: StorageMode,
    root: String,
}

impl StorageBackend {
    /// Create a filesystem-based storage backend.
    pub fn new_fs(root: &str) -> Result<Self> {
        let builder = Fs::default().root(root);

        let op = Operator::new(builder)
            .map_err(|e| Error::Storage(format!("Failed to create FS operator: {}", e)))?
            .finish();

        tracing::info!(root = %root, "Storage backend: filesystem");

        Ok(Self {
            operator: op,
            mode: StorageMode::Fs,
            root: root.to_string(),
        })
    }

    /// Create an S3-compatible storage backend.
    pub fn new_s3(
        endpoint: &str,
        access_key: &str,
        secret_key: &str,
        region: &str,
        bucket: &str,
    ) -> Result<Self> {
        let builder = S3::default()
            .endpoint(endpoint)
            .access_key_id(access_key)
            .secret_access_key(secret_key)
            .region(region)
            .bucket(bucket);

        let op = Operator::new(builder)
            .map_err(|e| Error::Storage(format!("Failed to create S3 operator: {}", e)))?
            .finish();

        tracing::info!(
            endpoint = %endpoint,
            bucket = %bucket,
            "Storage backend: S3"
        );

        Ok(Self {
            operator: op,
            mode: StorageMode::S3,
            root: format!("s3://{}", bucket),
        })
    }

    /// Get the storage mode.
    pub fn mode(&self) -> StorageMode {
        self.mode
    }

    /// Get the root path/endpoint.
    pub fn endpoint(&self) -> &str {
        &self.root
    }

    // =========================================================================
    // Bucket Operations
    // =========================================================================

    /// List all buckets.
    /// In filesystem mode, buckets are top-level directories.
    pub async fn list_buckets(&self) -> Result<Vec<BucketInfo>> {
        let entries = self
            .operator
            .list("/")
            .await
            .map_err(|e| Error::Storage(format!("Failed to list buckets: {}", e)))?;

        let buckets = entries
            .into_iter()
            .filter(|e| e.metadata().is_dir())
            .map(|e| {
                let name = e.name().trim_end_matches('/').to_string();
                BucketInfo {
                    name,
                    creation_date: None,
                }
            })
            .collect();

        Ok(buckets)
    }

    /// Create a bucket.
    pub async fn create_bucket(&self, name: &str) -> Result<()> {
        validate_storage_path(name)?;
        let path = format!("{}/", name);
        self.operator
            .create_dir(&path)
            .await
            .map_err(|e| Error::Storage(format!("Failed to create bucket: {}", e)))?;

        tracing::info!(bucket = %name, "Bucket created");
        Ok(())
    }

    /// Delete a bucket.
    pub async fn delete_bucket(&self, name: &str) -> Result<()> {
        validate_storage_path(name)?;
        // Delete all objects in the bucket first
        let path = format!("{}/", name);
        self.operator
            .remove_all(&path)
            .await
            .map_err(|e| Error::Storage(format!("Failed to delete bucket: {}", e)))?;

        tracing::info!(bucket = %name, "Bucket deleted");
        Ok(())
    }

    /// Check if bucket exists.
    pub async fn bucket_exists(&self, name: &str) -> Result<bool> {
        validate_storage_path(name)?;
        let path = format!("{}/", name);
        match self.operator.stat(&path).await {
            Ok(_) => Ok(true),
            Err(e) if e.kind() == opendal::ErrorKind::NotFound => Ok(false),
            Err(e) => Err(Error::Storage(format!("Failed to check bucket: {}", e))),
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
        validate_storage_path(bucket)?;
        let prefix = match query.prefix {
            Some(ref p) => format!("{}/{}", bucket, p),
            None => format!("{}/", bucket),
        };

        let entries = self
            .operator
            .list(&prefix)
            .await
            .map_err(|e| Error::Storage(format!("Failed to list objects: {}", e)))?;

        let delimiter = query.delimiter.as_deref().unwrap_or("/");
        let max_keys = query.max_keys.unwrap_or(1000) as usize;
        let mut objects = Vec::new();
        let mut prefixes = Vec::new();

        for entry in &entries {
            let meta = entry.metadata();
            let full_path = entry.path();
            // Strip bucket prefix to get the key
            let key = full_path
                .strip_prefix(&format!("{}/", bucket))
                .unwrap_or(full_path)
                .to_string();

            if key.is_empty() {
                continue;
            }

            if meta.is_dir() {
                prefixes.push(key);
            } else {
                // Stat each file to get full metadata (size, last_modified, etc.)
                let full_meta = self
                    .operator
                    .stat(full_path)
                    .await
                    .unwrap_or_else(|_| meta.clone());
                objects.push(ObjectInfo {
                    key,
                    size: full_meta.content_length() as i64,
                    last_modified: full_meta.last_modified().map(|d| d.to_rfc3339()),
                    etag: full_meta.etag().map(|s| s.to_string()),
                    content_type: full_meta.content_type().map(|s| s.to_string()),
                });
            }

            if objects.len() >= max_keys {
                break;
            }
        }

        let _ = delimiter; // Used for prefix grouping (simplified)

        Ok(ListObjectsResponse {
            is_truncated: objects.len() >= max_keys,
            next_continuation_token: None,
            objects,
            prefixes,
        })
    }

    /// Get object metadata.
    pub async fn get_object_info(&self, bucket: &str, key: &str) -> Result<ObjectInfo> {
        validate_storage_path(bucket)?;
        validate_storage_path(key)?;
        let path = format!("{}/{}", bucket, key);

        let meta = self
            .operator
            .stat(&path)
            .await
            .map_err(|e| Error::Storage(format!("Object not found: {}", e)))?;

        Ok(ObjectInfo {
            key: key.to_string(),
            size: meta.content_length() as i64,
            last_modified: meta.last_modified().map(|d| d.to_rfc3339()),
            etag: meta.etag().map(|s| s.to_string()),
            content_type: meta.content_type().map(|s| s.to_string()),
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
        validate_storage_path(bucket)?;
        validate_storage_path(key)?;
        let path = format!("{}/{}", bucket, key);

        let mut writer_builder = self.operator.writer_with(&path);
        if let Some(ct) = content_type {
            writer_builder = writer_builder.content_type(ct);
        }
        let mut writer = writer_builder
            .await
            .map_err(|e| Error::Storage(format!("Failed to create writer: {}", e)))?;
        writer
            .write(data)
            .await
            .map_err(|e| Error::Storage(format!("Failed to upload object: {}", e)))?;
        writer
            .close()
            .await
            .map_err(|e| Error::Storage(format!("Failed to finalize upload: {}", e)))?;

        tracing::debug!(bucket = %bucket, key = %key, "Object uploaded");
        Ok(())
    }

    /// Download object as bytes.
    pub async fn get_object_bytes(&self, bucket: &str, key: &str) -> Result<Bytes> {
        validate_storage_path(bucket)?;
        validate_storage_path(key)?;
        let path = format!("{}/{}", bucket, key);

        let data = self
            .operator
            .read(&path)
            .await
            .map_err(|e| Error::Storage(format!("Failed to download object: {}", e)))?;

        Ok(Bytes::from(data.to_vec()))
    }

    /// Download object, returning bytes + content type + content length.
    pub async fn get_object(&self, bucket: &str, key: &str) -> Result<ObjectData> {
        validate_storage_path(bucket)?;
        validate_storage_path(key)?;
        let path = format!("{}/{}", bucket, key);

        let meta = self
            .operator
            .stat(&path)
            .await
            .map_err(|e| Error::Storage(format!("Object not found: {}", e)))?;

        let data = self
            .operator
            .read(&path)
            .await
            .map_err(|e| Error::Storage(format!("Failed to read object: {}", e)))?;

        Ok(ObjectData {
            data: Bytes::from(data.to_vec()),
            content_type: meta
                .content_type()
                .map(|s| s.to_string())
                .unwrap_or_else(|| {
                    mime_guess::from_path(key)
                        .first_or_octet_stream()
                        .to_string()
                }),
            content_length: meta.content_length() as i64,
        })
    }

    /// Delete an object.
    pub async fn delete_object(&self, bucket: &str, key: &str) -> Result<()> {
        validate_storage_path(bucket)?;
        validate_storage_path(key)?;
        let path = format!("{}/{}", bucket, key);

        self.operator
            .delete(&path)
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
        validate_storage_path(source_bucket)?;
        validate_storage_path(source_key)?;
        validate_storage_path(dest_bucket)?;
        validate_storage_path(dest_key)?;
        let src = format!("{}/{}", source_bucket, source_key);
        let dst = format!("{}/{}", dest_bucket, dest_key);

        self.operator
            .copy(&src, &dst)
            .await
            .map_err(|e| Error::Storage(format!("Failed to copy object: {}", e)))?;

        tracing::debug!(
            from = %src,
            to = %dst,
            "Object copied"
        );
        Ok(())
    }

    /// Move an object (rename, or fallback to copy + delete).
    pub async fn move_object(
        &self,
        source_bucket: &str,
        source_key: &str,
        dest_bucket: &str,
        dest_key: &str,
    ) -> Result<()> {
        validate_storage_path(source_bucket)?;
        validate_storage_path(source_key)?;
        validate_storage_path(dest_bucket)?;
        validate_storage_path(dest_key)?;
        let src = format!("{}/{}", source_bucket, source_key);
        let dst = format!("{}/{}", dest_bucket, dest_key);

        let rename_result = self.operator.rename(&src, &dst).await;

        if rename_result.is_err() {
            // Fallback: copy + delete if rename not supported
            self.copy_object(source_bucket, source_key, dest_bucket, dest_key)
                .await?;
            self.delete_object(source_bucket, source_key).await?;
        }

        Ok(())
    }

    /// Get storage stats for a bucket.
    pub async fn get_bucket_stats(&self, bucket: &str) -> Result<StorageStats> {
        validate_storage_path(bucket)?;
        let prefix = format!("{}/", bucket);
        let entries = self
            .operator
            .list(&prefix)
            .await
            .map_err(|e| Error::Storage(format!("Failed to list for stats: {}", e)))?;

        let mut total_objects = 0usize;
        let mut total_size = 0i64;

        for entry in &entries {
            let meta = entry.metadata();
            if !meta.is_dir() {
                total_objects += 1;
                total_size += meta.content_length() as i64;
            }
        }

        Ok(StorageStats {
            total_buckets: 1,
            total_objects,
            total_size_bytes: total_size,
        })
    }
}

/// Downloaded object data.
pub struct ObjectData {
    pub data: Bytes,
    pub content_type: String,
    pub content_length: i64,
}
